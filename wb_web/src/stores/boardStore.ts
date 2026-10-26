import { makeAutoObservable, runInAction } from 'mobx'
import { HttpUploadApi, type Joined, type LineRow, type NewLine, type UploadApi } from '../api'
import { type Nav, browserNav } from '../nav'
import { remoteLog } from '../remoteLog'
import { BoardSocket, type Live, type Reply, SocketClosed, socketUrl } from '../socket'
import { type Stroke, deserialize, serialize } from '../stroke'
import { type DrawingStore, drawingStore } from './drawingStore'

export type Status = 'offline' | 'connecting' | 'online'

/** Stroke codes wrap here, as the old client's did (the column is a smallint). */
const CODE_WRAP = 65536

/**
 * This page's connection to a shared board, and every action that has to
 * change the drawing and tell the server about it.
 *
 * Offline, the page is a private board. Sharing creates a board on the server,
 * uploads what's drawn so far, and follows everyone else's strokes. Each
 * synced stroke is known by (client that drew it, code), the server's key.
 *
 * Joining is over HTTP. Then the WebSocket (`live`) rejoins as the same client
 * and carries everything while it's up: the server pushes new rows, and writes
 * go over it. Whenever it's down, the board polls over HTTP instead.
 */
export class BoardStore {
  status: Status = 'offline'
  hash: string | null = null
  client: number | null = null
  /** The last server error, shown until something succeeds again. */
  lastError: string | null = null
  /** The WebSocket is joined and watching the board, so polling is off. */
  liveUp = false

  private since = 0
  private code = 0
  private polling = false
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly keyOf = new Map<Stroke, string>()
  private readonly byKey = new Map<string, Stroke>()

  constructor(
    private readonly drawing: DrawingStore,
    private readonly api: UploadApi,
    private readonly nav: Nav,
    private readonly pollMs = 1000,
    private readonly live: Live | null = null,
  ) {
    makeAutoObservable<BoardStore, 'drawing' | 'api' | 'nav' | 'live' | 'keyOf' | 'byKey' | 'timer'>(this, {
      drawing: false,
      api: false,
      nav: false,
      live: false,
      keyOf: false,
      byKey: false,
      timer: false,
    })
  }

  get isOnline() {
    return this.status === 'online'
  }

  /** Join the board named in the URL, if there is one. */
  async start(): Promise<void> {
    const hash = this.nav.hash()
    // Once only (React's StrictMode runs effects twice in development).
    if (!hash || this.status !== 'offline') return
    this.status = 'connecting'
    try {
      const joined = await this.api.joinBoard(hash)
      this.goOnline(joined)
      // The server's spelling (e.g. lowercase), so later URL checks compare equal.
      if (joined.hash !== hash) this.nav.replaceHash(joined.hash)
    } catch (e) {
      this.failed(e, 'offline')
    }
  }

  /** Make this page's board shareable: create it on the server if it isn't yet. */
  async share(): Promise<void> {
    if (this.status !== 'offline') return
    this.status = 'connecting'
    try {
      const joined = await this.api.newBoard()
      const hadHash = this.nav.hash() !== ''
      this.goOnline(joined)
      if (hadHash) this.nav.replaceHash(joined.hash)
      else this.nav.pushHash(joined.hash)
      await this.upload([...this.drawing.visible])
    } catch (e) {
      this.failed(e, 'offline')
    }
  }

  get shareUrl(): string {
    return this.nav.href()
  }

  stop() {
    this.stopPolling()
    this.live?.disconnect()
  }

  /** A finished stroke drawn on this page. */
  commit(stroke: Stroke) {
    this.drawing.add(stroke)
    if (this.isOnline) void this.upload([stroke])
  }

  undo() {
    const stroke = this.drawing.undo()
    if (!stroke || !this.isOnline || this.hash === null) return
    const key = this.keyOf.get(stroke)
    if (!key) return
    this.forget(stroke)
    const [owner, code] = key.split(':').map(Number)
    const hash = this.hash
    void this.send(
      this.either(
        async (live) => void (await live.request({ action: 'undo', client: owner, code })),
        () => this.api.undo(hash, owner, code),
      ),
    )
  }

  redo() {
    const stroke = this.drawing.redo()
    if (stroke && this.isOnline) void this.upload([stroke])
  }

  clear() {
    this.drawing.clear()
    this.keyOf.clear()
    this.byKey.clear()
    if (!this.isOnline || this.hash === null || this.client === null) return
    const [hash, client, code] = [this.hash, this.client, this.nextCode()]
    const cleared = this.either(
      async (live) => (await live.request({ action: 'clear', code })).since,
      () => this.api.clear(hash, client, code),
    )
    void this.send(cleared).then((id) => {
      if (typeof id === 'number') runInAction(() => (this.since = Math.max(this.since, id)))
    })
  }

  /** Fetch and apply everything new on the board over HTTP. Skipped while a poll is in flight. */
  async poll(): Promise<void> {
    if (!this.isOnline || this.liveUp || this.polling || this.hash === null || this.client === null) return
    this.polling = true
    const first = this.since === 0
    const since = this.since
    const asked = Date.now()
    try {
      const reply = await this.api.getLines(this.hash, this.client, since)
      const got = Date.now()
      // Empty polls happen every second; log only the first and those that bring rows.
      const logIt = first || reply.lines.length > 0
      if (logIt) {
        remoteLog.log(`getlines since ${since}: request started`, asked)
        remoteLog.log(`getlines since ${since}: got ${reply.lines.length} rows in ${got - asked}ms`, got)
      }
      this.receive(reply.since, reply.lines, first)
      runInAction(() => (this.lastError = null))
    } catch (e) {
      this.failed(e)
    } finally {
      runInAction(() => (this.polling = false))
    }
  }

  /** Apply rows from a poll, a getlines over the socket, or a push. */
  private receive(since: number, lines: LineRow[], first: boolean) {
    const started = Date.now()
    runInAction(() => {
      this.apply(lines, first)
      this.since = Math.max(this.since, since)
    })
    if (lines.length) remoteLog.log(`drawing ${lines.length} rows: ended in ${Date.now() - started}ms`)
  }

  private apply(lines: LineRow[], first: boolean) {
    for (const line of lines) {
      // Already seen, through the other of poll and socket.
      if (line.id !== undefined) {
        if (line.id <= this.since) continue
        this.since = line.id
      }
      const key = `${line.client}:${line.code}`
      if (line.type === 'flow') {
        if (this.byKey.has(key)) continue
        let stroke: Stroke
        try {
          stroke = deserialize(JSON.parse(line.data))
        } catch {
          continue
        }
        this.remember(stroke, key)
        this.drawing.addRemote(stroke)
      } else if (line.type === 'undo') {
        const stroke = this.byKey.get(key)
        if (stroke) {
          this.forget(stroke)
          this.drawing.remove(stroke)
        }
      } else if (line.type === 'clear' && !first) {
        // A clear in the history only matters if it happens while we watch;
        // on the first read, the rows after it are the board.
        this.drawing.clear()
        this.keyOf.clear()
        this.byKey.clear()
      }
    }
  }

  private goOnline(joined: Joined) {
    this.status = 'online'
    this.hash = joined.hash
    this.client = joined.clientid
    this.lastError = null
    remoteLog.board = { hash: joined.hash, client: joined.clientid }
    remoteLog.log(`online on board ${joined.hash} as client ${joined.clientid}`)
    this.startPolling()
    this.live?.connect({
      opened: () => void this.liveOpened(),
      pushed: (reply) => this.pushed(reply),
      lost: () => this.liveLost(),
    })
  }

  /** A (re)connected socket: rejoin as this client, catch up, and stop polling. */
  private async liveOpened() {
    const live = this.live
    if (!live || this.hash === null || this.client === null) return
    try {
      await live.request({ action: 'init', hash: this.hash, client: this.client })
      const since = this.since
      const reply = await live.request<LineRow[]>({ action: 'getlines', since })
      this.receive(reply.since, reply.data, since === 0)
      runInAction(() => {
        this.liveUp = true
        this.lastError = null
      })
      this.stopPolling()
      remoteLog.log(`live from since ${since}: ${reply.data.length} rows`)
    } catch (e) {
      // Polling carries on; the next reconnect tries again.
      if (!(e instanceof SocketClosed)) this.failed(e)
    }
  }

  private pushed(reply: Reply) {
    if (!this.liveUp || !Array.isArray(reply.data)) return
    remoteLog.log(`pushed ${reply.data.length} rows`)
    this.receive(reply.since, reply.data as LineRow[], false)
  }

  private liveLost() {
    if (!this.liveUp) return
    runInAction(() => (this.liveUp = false))
    remoteLog.log('live lost: polling')
    this.startPolling()
  }

  private startPolling() {
    if (!this.timer) this.timer = setInterval(() => void this.poll(), this.pollMs)
    void this.poll()
  }

  private stopPolling() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /**
   * A write over the socket while it's up, otherwise (or if it drops before
   * answering) over HTTP. If the server had already acted, the resend is
   * recognised by its (client, code) and skipped.
   */
  private async either<T>(viaLive: (live: Live) => Promise<T>, viaHttp: () => Promise<T>): Promise<T> {
    if (this.live && this.liveUp) {
      try {
        return await viaLive(this.live)
      } catch (e) {
        if (!(e instanceof SocketClosed)) throw e
      }
    }
    return viaHttp()
  }

  private async upload(strokes: Stroke[]) {
    if (this.hash === null || this.client === null) return
    const [hash, client] = [this.hash, this.client]
    const lines: NewLine[] = []
    for (const stroke of strokes) {
      if (this.keyOf.has(stroke)) continue
      const code = this.nextCode()
      this.remember(stroke, `${client}:${code}`)
      lines.push({ code, flow: serialize(stroke) })
    }
    if (!lines.length) return
    await this.send(
      this.either(
        async (live) => void (await live.request({ action: 'lines', linedata: lines })),
        () => this.api.addLines(hash, client, lines),
      ),
    )
  }

  /** Names this page's next write (a stroke or a clear), so resends are recognised. */
  private nextCode(): number {
    this.code = (this.code + 1) % CODE_WRAP
    return this.code
  }

  private remember(stroke: Stroke, key: string) {
    this.keyOf.set(stroke, key)
    this.byKey.set(key, stroke)
  }

  private forget(stroke: Stroke) {
    const key = this.keyOf.get(stroke)
    if (key) this.byKey.delete(key)
    this.keyOf.delete(stroke)
  }

  /** Await a request, recording (not throwing) a failure. */
  private async send<T>(request: Promise<T>): Promise<T | undefined> {
    try {
      const result = await request
      runInAction(() => (this.lastError = null))
      return result
    } catch (e) {
      this.failed(e)
      return undefined
    }
  }

  private failed(e: unknown, status?: Status) {
    const message = e instanceof Error ? e.message : String(e)
    remoteLog.log(`error: ${message}`)
    runInAction(() => {
      this.lastError = message
      if (status) this.status = status
    })
  }
}

export const boardStore = new BoardStore(
  drawingStore,
  new HttpUploadApi(),
  browserNav,
  1000,
  new BoardSocket(socketUrl()),
)
