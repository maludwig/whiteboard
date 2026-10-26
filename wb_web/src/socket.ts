import { ApiError } from './api'
import { remoteLog } from './remoteLog'

/**
 * The server's `{base_path}/ws`: the upload protocol as JSON messages, plus
 * pushes. See wb_server's ws.rs for the protocol.
 */

export interface Reply<T = unknown> {
  since: number
  data: T
}

/** What BoardStore needs from a live connection (a BoardSocket, or a fake in tests). */
export interface Live {
  /** Connect, and keep reconnecting until `disconnect`. `opened` runs on every connect. */
  connect(handlers: LiveHandlers): void
  disconnect(): void
  /** Rejects with SocketClosed if the connection isn't open or drops first. */
  request<T>(fields: Record<string, unknown>): Promise<Reply<T>>
}

export interface LiveHandlers {
  opened(): void
  /** New rows the server sent unasked, after a getlines. */
  pushed(reply: Reply): void
  /** An open connection was lost (a reconnect is already scheduled). */
  lost(): void
}

/** The parts of a WebSocket BoardSocket uses, so tests can fake one. */
export interface SocketLike extends EventTarget {
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
}

/** The request never got an answer: the connection wasn't open, or dropped. */
export class SocketClosed extends Error {}

/** Silence longer than this means the connection is dead (the server pings every 20s). */
export const WATCHDOG_MS = 25_000
/** When the page wakes or the network changes, how long a probe ping may take. */
export const PROBE_MS = 5_000
export const CONNECT_TIMEOUT_MS = 10_000
export const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000]

const OPEN = 1

/** `ws` beside the page, e.g. wss://host/whiteboard/ws for https://host/whiteboard/. */
export function socketUrl(base = location.href, path = 'ws'): string {
  const url = new URL(path, base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.hash = ''
  return url.href
}

interface Pending {
  action: string
  resolve: (reply: Reply<never>) => void
  reject: (error: Error) => void
}

/**
 * One WebSocket to the server, kept alive: answers the server's pings,
 * reconnects with backoff when the connection drops or goes quiet for
 * WATCHDOG_MS, and when the page wakes up or comes back online, checks the
 * connection at once rather than waiting for the watchdog.
 */
export class BoardSocket implements Live {
  private socket: SocketLike | null = null
  private handlers: LiveHandlers | null = null
  private isOpen = false
  private nextId = 1
  private readonly pending = new Map<number, Pending>()
  private failures = 0
  /** One timer for all three deadlines: connecting, silence, and a probe. */
  private watchdog: ReturnType<typeof setTimeout> | null = null
  private retry: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly url: string,
    private readonly makeSocket: (url: string) => SocketLike = (url) => new WebSocket(url),
  ) {}

  connect(handlers: LiveHandlers): void {
    const first = this.handlers === null
    this.handlers = handlers
    if (!first) return
    document.addEventListener('visibilitychange', this.wake)
    window.addEventListener('online', this.wake)
    window.addEventListener('pageshow', this.wake)
    this.dial()
  }

  disconnect(): void {
    this.handlers = null
    document.removeEventListener('visibilitychange', this.wake)
    window.removeEventListener('online', this.wake)
    window.removeEventListener('pageshow', this.wake)
    this.drop('disconnected')
  }

  request<T>(fields: Record<string, unknown>): Promise<Reply<T>> {
    const action = String(fields.action)
    const socket = this.socket
    if (!this.isOpen || !socket) return Promise.reject(new SocketClosed(`${action}: not connected`))
    const id = this.nextId++
    return new Promise<Reply<T>>((resolve, reject) => {
      this.pending.set(id, { action, resolve: resolve as (reply: Reply<never>) => void, reject })
      socket.send(JSON.stringify({ id, ...fields }))
    })
  }

  /** The page became visible, was restored, or the network came back. */
  private readonly wake = () => {
    if (!this.handlers || document.visibilityState === 'hidden') return
    if (this.retry || !this.socket || this.socket.readyState > OPEN) {
      // Waiting out a backoff, or the socket is closing: try now.
      this.drop('woke up without a connection', 0)
    } else if (this.isOpen) {
      // It may have died while we slept without telling us; anything back proves it didn't.
      this.send({ action: 'ping' })
      this.arm(PROBE_MS, 'no answer to a wake-up ping')
    }
    // Still connecting: its own deadline stands.
  }

  private dial() {
    this.retry = null
    if (!this.handlers) return
    let socket: SocketLike
    try {
      socket = this.makeSocket(this.url)
    } catch (e) {
      this.socket = null
      this.drop(`could not open: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
    this.socket = socket
    this.arm(CONNECT_TIMEOUT_MS, 'connect timed out')
    // Events from a socket we've since given up on are ignored.
    socket.addEventListener('open', () => socket === this.socket && this.opened())
    socket.addEventListener('message', (e) => socket === this.socket && this.received((e as MessageEvent).data))
    socket.addEventListener('close', (e) => socket === this.socket && this.drop(`closed (${(e as CloseEvent).code})`))
    // An 'error' is always followed by a 'close'.
  }

  private opened() {
    this.isOpen = true
    this.failures = 0
    this.arm(WATCHDOG_MS, 'silent too long')
    remoteLog.log('socket open')
    this.handlers?.opened()
  }

  private received(data: unknown) {
    this.arm(WATCHDOG_MS, 'silent too long')
    let message: { id?: unknown; action?: unknown; error?: unknown; since?: unknown }
    try {
      message = JSON.parse(String(data))
    } catch {
      return
    }
    if (message.action === 'ping') this.send({ action: 'pong' })
    else if (message.action === 'pong') return
    else if (typeof message.id === 'number') {
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      if (typeof message.error === 'string') pending.reject(new ApiError(`${pending.action}: ${message.error}`, 0))
      else pending.resolve(message as Reply<never>)
    } else if (typeof message.error === 'string') remoteLog.log(`socket: server said ${message.error}`)
    else if (typeof message.since === 'number') this.handlers?.pushed(message as Reply)
  }

  private send(message: object) {
    try {
      this.socket?.send(JSON.stringify(message))
    } catch {
      // A closing socket; its close event is on the way.
    }
  }

  /** Any message resets the deadline; missing it drops the connection. */
  private arm(ms: number, why: string) {
    if (this.watchdog) clearTimeout(this.watchdog)
    this.watchdog = setTimeout(() => this.drop(why), ms)
  }

  /** Give up on the current socket, and unless disconnected, dial again after `delay`. */
  private drop(why: string, delay?: number) {
    const socket = this.socket
    const wasOpen = this.isOpen
    this.socket = null
    this.isOpen = false
    if (this.watchdog) clearTimeout(this.watchdog)
    if (this.retry) clearTimeout(this.retry)
    this.watchdog = this.retry = null
    try {
      socket?.close()
    } catch {
      // Already closed.
    }
    for (const pending of this.pending.values()) pending.reject(new SocketClosed(`${pending.action}: connection lost`))
    this.pending.clear()
    if (socket || wasOpen) remoteLog.log(`socket lost: ${why}`)
    if (!this.handlers) return
    if (wasOpen) this.handlers.lost()
    const wait = delay ?? BACKOFF_MS[Math.min(this.failures++, BACKOFF_MS.length - 1)]
    this.retry = setTimeout(() => this.dial(), wait)
  }
}
