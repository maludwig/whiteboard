import type { StoredStroke } from './stroke'

/** A row from `getlines`. `data` is the stroke JSON as a string (empty for undo/clear). */
export interface LineRow {
  type: 'flow' | 'undo' | 'clear'
  data: string
  client: number
  code: number
}

export interface Joined {
  hash: string
  clientid: number
}

export interface NewLine {
  code: number
  flow: StoredStroke
}

/** The server's `{base_path}/api/upload` protocol (the one upload.php spoke). */
export interface UploadApi {
  newBoard(): Promise<Joined>
  joinBoard(hash: string): Promise<Joined>
  addLines(hash: string, client: number, lines: NewLine[]): Promise<void>
  /** Resolves to the clear's row id, which later polls can start after. */
  clear(hash: string, client: number): Promise<number>
  /** `owner` is the client that drew the stroke, not necessarily who is undoing it. */
  undo(hash: string, owner: number, code: number): Promise<void>
  getLines(hash: string, client: number, since: number): Promise<{ since: number; lines: LineRow[] }>
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

interface Reply<T> {
  since: number
  data: T
}

export class HttpUploadApi implements UploadApi {
  /** Relative, so it resolves under whatever path the page is served from (e.g. /whiteboard/). */
  constructor(private readonly url = 'api/upload') {}

  private async post<T>(fields: Record<string, string | number>): Promise<Reply<T>> {
    const body = new URLSearchParams()
    for (const [key, value] of Object.entries(fields)) body.set(key, String(value))
    const response = await fetch(this.url, { method: 'POST', body })
    const text = await response.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      throw new ApiError(`${fields.action}: HTTP ${response.status}, not JSON`, response.status)
    }
    if (!response.ok) {
      const error = (json as { error?: string }).error ?? `HTTP ${response.status}`
      throw new ApiError(`${fields.action}: ${error}`, response.status)
    }
    return json as Reply<T>
  }

  async newBoard(): Promise<Joined> {
    return joined((await this.post<Joined>({ action: 'new' })).data)
  }

  async joinBoard(hash: string): Promise<Joined> {
    return joined((await this.post<Joined>({ action: 'init', hash })).data)
  }

  async addLines(hash: string, client: number, lines: NewLine[]): Promise<void> {
    await this.post({ action: 'lines', hash, client, linedata: JSON.stringify(lines) })
  }

  async clear(hash: string, client: number): Promise<number> {
    return (await this.post({ action: 'clear', hash, client })).since
  }

  async undo(hash: string, owner: number, code: number): Promise<void> {
    await this.post({ action: 'undo', hash, client: owner, code })
  }

  async getLines(hash: string, client: number, since: number) {
    const reply = await this.post<LineRow[]>({ action: 'getlines', hash, client, since })
    const lines = reply.data.map((row) => ({ ...row, client: Number(row.client), code: Number(row.code) }))
    return { since: Number(reply.since), lines }
  }
}

function joined(data: Joined): Joined {
  return { hash: String(data.hash), clientid: Number(data.clientid) }
}
