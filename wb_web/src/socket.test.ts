import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import {
  BACKOFF_MS,
  BoardSocket,
  CONNECT_TIMEOUT_MS,
  PROBE_MS,
  SocketClosed,
  type SocketLike,
  WATCHDOG_MS,
  socketUrl,
} from './socket'

const CLOSED = 3

class FakeSocket extends EventTarget implements SocketLike {
  readyState = 0
  sent: Record<string, unknown>[] = []
  constructor(readonly url: string) {
    super()
  }
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    if (this.readyState === CLOSED) return
    this.readyState = CLOSED
    this.dispatchEvent(new CloseEvent('close', { code: 1005 }))
  }
  open() {
    this.readyState = 1
    this.dispatchEvent(new Event('open'))
  }
  receive(message: object) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
  /** The network went away. */
  drop() {
    this.readyState = CLOSED
    this.dispatchEvent(new CloseEvent('close', { code: 1006 }))
  }
}

let sockets: FakeSocket[]
let live: BoardSocket
const handlers = { opened: vi.fn(), pushed: vi.fn(), lost: vi.fn() }
const latest = () => sockets[sockets.length - 1]

function connected(): FakeSocket {
  live.connect(handlers)
  latest().open()
  return latest()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  sockets = []
  live = new BoardSocket('ws://example/whiteboard/ws', (url) => {
    const socket = new FakeSocket(url)
    sockets.push(socket)
    return socket
  })
})
afterEach(() => {
  live.disconnect()
  vi.useRealTimers()
})

describe('socketUrl', () => {
  it('sits beside the page, wss for https', () => {
    expect(socketUrl('https://example.com/whiteboard/#ab')).toBe('wss://example.com/whiteboard/ws')
    expect(socketUrl('http://192.168.1.102:5173/whiteboard/')).toBe('ws://192.168.1.102:5173/whiteboard/ws')
  })
})

describe('BoardSocket', () => {
  it('numbers requests and matches replies to them, in any order', async () => {
    const socket = connected()
    expect(handlers.opened).toHaveBeenCalledTimes(1)
    const lines = live.request({ action: 'getlines', since: 3 })
    const clear = live.request({ action: 'clear' })
    expect(socket.sent).toEqual([
      { id: 1, action: 'getlines', since: 3 },
      { id: 2, action: 'clear' },
    ])
    socket.receive({ id: 2, since: 9, data: '' })
    socket.receive({ id: 1, error: 'boom' })
    await expect(clear).resolves.toEqual({ id: 2, since: 9, data: '' })
    await expect(lines).rejects.toThrow(ApiError)
    await expect(lines).rejects.toThrow('getlines: boom')
  })

  it('refuses requests while closed, and fails those in flight when it drops', async () => {
    live.connect(handlers)
    await expect(live.request({ action: 'clear' })).rejects.toThrow(SocketClosed)
    latest().open()
    const pending = live.request({ action: 'clear' })
    latest().drop()
    await expect(pending).rejects.toThrow(SocketClosed)
    expect(handlers.lost).toHaveBeenCalledTimes(1)
  })

  it('answers pings and hands pushes over', () => {
    const socket = connected()
    socket.receive({ action: 'ping' })
    expect(socket.sent).toEqual([{ action: 'pong' }])
    socket.receive({ since: 8, data: [] })
    expect(handlers.pushed).toHaveBeenCalledWith({ since: 8, data: [] })
  })

  it('reconnects after WATCHDOG_MS of silence, with anything counting as a sign of life', () => {
    const socket = connected()
    vi.advanceTimersByTime(WATCHDOG_MS - 1)
    socket.receive({ action: 'ping' })
    vi.advanceTimersByTime(WATCHDOG_MS - 1)
    expect(socket.readyState).not.toBe(CLOSED)

    vi.advanceTimersByTime(1)
    expect(socket.readyState).toBe(CLOSED)
    expect(handlers.lost).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(BACKOFF_MS[0])
    expect(sockets).toHaveLength(2)
    latest().open()
    expect(handlers.opened).toHaveBeenCalledTimes(2)
  })

  it('backs off while it cannot connect, and starts over once it does', () => {
    live.connect(handlers)
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS) // never opened
    vi.advanceTimersByTime(BACKOFF_MS[0])
    expect(sockets).toHaveLength(2)
    latest().drop() // refused
    vi.advanceTimersByTime(BACKOFF_MS[1] - 1)
    expect(sockets).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(3)

    latest().open()
    latest().drop()
    vi.advanceTimersByTime(BACKOFF_MS[0])
    expect(sockets).toHaveLength(4)
    expect(handlers.lost).toHaveBeenCalledTimes(1) // only an open connection counts as lost
  })

  it('on waking, redials at once if it has no connection', () => {
    connected().drop()
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(0)
    expect(sockets).toHaveLength(2)
  })

  it('on waking with an open connection, pings it and gives up after PROBE_MS', () => {
    const socket = connected()
    window.dispatchEvent(new Event('online'))
    expect(socket.sent).toEqual([{ action: 'ping' }])
    socket.receive({ action: 'pong' })
    vi.advanceTimersByTime(PROBE_MS)
    expect(socket.readyState).not.toBe(CLOSED) // it answered

    window.dispatchEvent(new Event('pageshow'))
    vi.advanceTimersByTime(PROBE_MS)
    expect(socket.readyState).toBe(CLOSED)
  })

  it('stays down once disconnected', () => {
    connected()
    live.disconnect()
    vi.advanceTimersByTime(60_000)
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(60_000)
    expect(sockets).toHaveLength(1)
    expect(handlers.lost).not.toHaveBeenCalled()
  })
})
