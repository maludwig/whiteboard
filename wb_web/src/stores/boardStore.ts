import { makeAutoObservable, runInAction } from 'mobx'
import { HttpUploadApi, type Joined, type LineRow, type UploadApi } from '../api'
import { type Nav, browserNav } from '../nav'
import { remoteLog } from '../remoteLog'
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
 * uploads what's drawn so far, and polls for everyone else's strokes. Each
 * synced stroke is known by (client that drew it, code), the server's key.
 */
export class BoardStore {
  status: Status = 'offline'
  hash: string | null = null
  client: number | null = null
  /** The last server error, shown until something succeeds again. */
  lastError: string | null = null

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
  ) {
    makeAutoObservable<BoardStore, 'drawing' | 'api' | 'nav' | 'keyOf' | 'byKey' | 'timer'>(this, {
      drawing: false,
      api: false,
      nav: false,
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
    if (this.timer) clearInterval(this.timer)
    this.timer = null
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
    void this.send(this.api.undo(this.hash, owner, code))
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
    void this.send(this.api.clear(this.hash, this.client)).then((id) => {
      if (typeof id === 'number') runInAction(() => (this.since = Math.max(this.since, id)))
    })
  }

  /** Fetch and apply everything new on the board. Skipped while a poll is in flight. */
  async poll(): Promise<void> {
    if (!this.isOnline || this.polling || this.hash === null || this.client === null) return
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
        remoteLog.log(`drawing ${reply.lines.length} rows: started`, got)
      }
      runInAction(() => {
        this.since = Math.max(this.since, reply.since)
        this.apply(reply.lines, first)
        this.lastError = null
      })
      if (logIt) remoteLog.log(`drawing ${reply.lines.length} rows: ended in ${Date.now() - got}ms`)
    } catch (e) {
      this.failed(e)
    } finally {
      runInAction(() => (this.polling = false))
    }
  }

  private apply(lines: LineRow[], first: boolean) {
    for (const line of lines) {
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
        // on the first poll, the rows after it are the board.
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
    this.stop()
    this.timer = setInterval(() => void this.poll(), this.pollMs)
    void this.poll()
  }

  private async upload(strokes: Stroke[]) {
    if (this.hash === null || this.client === null) return
    const lines = []
    for (const stroke of strokes) {
      if (this.keyOf.has(stroke)) continue
      this.code = (this.code + 1) % CODE_WRAP
      this.remember(stroke, `${this.client}:${this.code}`)
      lines.push({ code: this.code, flow: serialize(stroke) })
    }
    if (lines.length) await this.send(this.api.addLines(this.hash, this.client, lines))
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

export const boardStore = new BoardStore(drawingStore, new HttpUploadApi(), browserNav)
