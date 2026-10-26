/**
 * Log lines sent to the server's log when its config has `"stream_logs": true`
 * (see wb_server's clientlog.rs). Asks once at start; lines logged before the
 * answer are held, then sent in batches or dropped.
 */

interface LogLine {
  at: string
  page_ms: number
  msg: string
}

export class RemoteLog {
  private state: 'asking' | 'on' | 'off' = 'asking'
  private queue: LogLine[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly pageStart = performance.timeOrigin || Date.now()
  /** Tagged onto each batch, once known. */
  board: { hash: string | null; client: number | null } = { hash: null, client: null }

  constructor(private readonly base = 'api/') {}

  async start(): Promise<void> {
    try {
      const response = await fetch(this.base + 'client-config')
      const config = (await response.json()) as { stream_logs?: boolean }
      this.state = config.stream_logs ? 'on' : 'off'
    } catch {
      this.state = 'off'
    }
    if (this.state === 'on') this.flush()
    else this.queue = []
  }

  log(msg: string, when = Date.now()): void {
    if (this.state === 'off') return
    if (this.queue.length >= 500) this.queue.shift()
    this.queue.push({ at: new Date(when).toISOString(), page_ms: when - this.pageStart, msg })
    if (this.state === 'on' && !this.timer) this.timer = setTimeout(() => this.flush(), 250)
  }

  private flush(): void {
    this.timer = null
    if (this.queue.length === 0) return
    const lines = this.queue.splice(0, 100)
    void fetch(this.base + 'log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.board, lines }),
    }).catch(() => {})
    if (this.queue.length) this.timer = setTimeout(() => this.flush(), 250)
  }
}

export const remoteLog = new RemoteLog()
