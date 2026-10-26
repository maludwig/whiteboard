import { afterEach, describe, expect, it } from 'vitest'
import type { Joined, LineRow, NewLine, UploadApi } from '../api'
import type { Nav } from '../nav'
import { type Live, type LiveHandlers, type Reply, SocketClosed } from '../socket'
import { deserialize, serialize } from '../stroke'
import { BoardStore } from './boardStore'
import { DrawingStore } from './drawingStore'

/** Records calls; getLines answers from a queue (then nothing new). */
class FakeApi implements UploadApi {
  calls: unknown[][] = []
  pending: { since: number; lines: LineRow[] }[] = []
  failJoin = false

  async newBoard(): Promise<Joined> {
    this.calls.push(['new'])
    return { hash: 'ab', clientid: 1 }
  }
  async joinBoard(hash: string): Promise<Joined> {
    this.calls.push(['init', hash])
    if (this.failJoin) throw new Error('init: no such board')
    return { hash: hash.toLowerCase(), clientid: 2 }
  }
  async addLines(hash: string, client: number, lines: NewLine[]) {
    this.calls.push(['lines', hash, client, lines.map((l) => l.code)])
  }
  async clear(hash: string, client: number, code: number) {
    this.calls.push(['clear', hash, client, code])
    return 99
  }
  async undo(hash: string, owner: number, code: number) {
    this.calls.push(['undo', hash, owner, code])
  }
  async getLines(hash: string, client: number, since: number) {
    this.calls.push(['getlines', hash, client, since])
    return this.pending.shift() ?? { since, lines: [] }
  }
  of(action: string) {
    return this.calls.filter((c) => c[0] === action)
  }
}

class FakeNav implements Nav {
  pushed: string[] = []
  replaced: string[] = []
  constructor(private current = '') {}
  hash = () => this.current
  pushHash = (h: string) => {
    this.pushed.push(h)
    this.current = h
  }
  replaceHash = (h: string) => {
    this.replaced.push(h)
    this.current = h
  }
  href = () => `http://example/whiteboard/#${this.current}`
  reload = () => {}
}

/** Records requests and answers them by action; `down` makes them fail as a dropped socket would. */
class FakeLive implements Live {
  handlers: LiveHandlers | null = null
  requests: Record<string, unknown>[] = []
  answers: Record<string, Reply> = {}
  down = false
  connect(handlers: LiveHandlers) {
    this.handlers = handlers
  }
  disconnect() {
    this.handlers = null
  }
  async request<T>(fields: Record<string, unknown>): Promise<Reply<T>> {
    this.requests.push(fields)
    if (this.down) throw new SocketClosed(`${fields.action}: connection lost`)
    return (this.answers[String(fields.action)] ?? { since: 0, data: '' }) as Reply<T>
  }
  of(action: string) {
    return this.requests.filter((r) => r.action === action)
  }
}

const s = (n: number) => deserialize({ p: [n, n], c: '#000', t: 'pen', w: 3 })
const flowRow = (client: number, code: number, n: number): LineRow => ({
  type: 'flow',
  data: JSON.stringify(serialize(s(n))),
  client,
  code,
})
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const stores: BoardStore[] = []
function setup(hash = '') {
  const drawing = new DrawingStore()
  const api = new FakeApi()
  const nav = new FakeNav(hash)
  const board = new BoardStore(drawing, api, nav, 1e9)
  stores.push(board)
  return { drawing, api, nav, board }
}
afterEach(() => stores.splice(0).forEach((b) => b.stop()))

describe('BoardStore', () => {
  it('stays local until shared', () => {
    const { board, api, drawing } = setup()
    board.commit(s(1))
    expect(drawing.visible).toHaveLength(1)
    expect(api.calls).toEqual([])
  })

  it('sharing creates a board, pushes its hash, and uploads what is drawn', async () => {
    const { board, api, nav, drawing } = setup()
    drawing.add(s(1))
    drawing.add(s(2))
    await board.share()
    await settle()
    expect(board.status).toBe('online')
    expect(nav.pushed).toEqual(['ab'])
    expect(api.of('lines')).toEqual([['lines', 'ab', 1, [1, 2]]])
    expect(api.of('getlines')).toEqual([['getlines', 'ab', 1, 0]])
  })

  it('joins the board in the URL on start, keeping the server spelling', async () => {
    const { board, api, nav } = setup('AB')
    await board.start()
    expect(api.of('init')).toEqual([['init', 'AB']])
    expect(board.hash).toBe('ab')
    expect(nav.replaced).toEqual(['ab'])
  })

  it('reports a board that does not exist', async () => {
    const { board, api } = setup('zz')
    api.failJoin = true
    await board.start()
    expect(board.status).toBe('offline')
    expect(board.lastError).toContain('no such board')
  })

  it('applies remote strokes once, and remote undos', async () => {
    const { board, api, drawing } = setup('ab')
    api.pending.push({ since: 5, lines: [flowRow(7, 1, 1), flowRow(7, 2, 2), flowRow(7, 1, 1)] })
    await board.start()
    await settle()
    expect(drawing.visible).toHaveLength(2)

    api.pending.push({ since: 6, lines: [{ type: 'undo', data: '', client: 7, code: 1 }] })
    await board.poll()
    expect(drawing.visible).toHaveLength(1)
    expect(api.of('getlines').at(-1)).toEqual(['getlines', 'ab', 2, 5])
  })

  it('ignores an old clear on the first poll, but not a new one', async () => {
    const { board, api, drawing } = setup('ab')
    api.pending.push({ since: 3, lines: [{ type: 'clear', data: '', client: 9, code: 0 }, flowRow(9, 1, 1)] })
    await board.start()
    await settle()
    expect(drawing.visible).toHaveLength(1)

    api.pending.push({ since: 4, lines: [{ type: 'clear', data: '', client: 9, code: 0 }] })
    await board.poll()
    expect(drawing.visible).toHaveLength(0)
  })

  it('undo tells the server who drew the stroke', async () => {
    const { board, api } = setup('ab')
    api.pending.push({ since: 1, lines: [flowRow(7, 4, 1)] })
    await board.start()
    await settle()
    board.undo()
    await settle()
    expect(api.of('undo')).toEqual([['undo', 'ab', 7, 4]])
  })

  it('redo uploads the stroke again under a new code', async () => {
    const { board, api } = setup('ab')
    await board.start()
    await settle()
    board.commit(s(1))
    board.undo()
    board.redo()
    await settle()
    expect(api.of('lines')).toEqual([
      ['lines', 'ab', 2, [1]],
      ['lines', 'ab', 2, [2]],
    ])
    expect(api.of('undo')).toEqual([['undo', 'ab', 2, 1]])
  })

  it('clear wipes locally, tells the server, and polls from after it', async () => {
    const { board, api, drawing } = setup('ab')
    await board.start()
    await settle()
    board.commit(s(1))
    board.clear()
    await settle()
    expect(drawing.visible).toHaveLength(0)
    // Named like a stroke: the stroke before it was code 1.
    expect(api.of('clear')).toEqual([['clear', 'ab', 2, 2]])
    await board.poll()
    expect(api.of('getlines').at(-1)).toEqual(['getlines', 'ab', 2, 99])
  })
})

describe('BoardStore with a socket', () => {
  const withId = (row: LineRow, id: number): LineRow => ({ ...row, id })

  /** Joined to board ab as client 2, the first poll answered, and the socket up. */
  async function live(firstPoll: { since: number; lines: LineRow[] } = { since: 4, lines: [] }) {
    const drawing = new DrawingStore()
    const api = new FakeApi()
    const socket = new FakeLive()
    const board = new BoardStore(drawing, api, new FakeNav('ab'), 1e9, socket)
    stores.push(board)
    api.pending.push(firstPoll)
    await board.start()
    await settle()
    return { drawing, api, socket, board }
  }

  async function open(socket: FakeLive, getlines: Reply<LineRow[]> = { since: 4, data: [] }) {
    socket.answers.getlines = getlines
    socket.handlers!.opened()
    await settle()
  }

  it('rejoins as the same client, catches up from the poll, and stops polling', async () => {
    const { api, socket, board, drawing } = await live()
    expect(socket.handlers).not.toBeNull()
    await open(socket, { since: 6, data: [withId(flowRow(7, 2, 2), 6)] })
    expect(socket.requests).toEqual([
      { action: 'init', hash: 'ab', client: 2 },
      { action: 'getlines', since: 4 },
    ])
    expect(drawing.visible).toHaveLength(1)
    expect(board.liveUp).toBe(true)

    const polls = api.of('getlines').length
    await board.poll()
    expect(api.of('getlines')).toHaveLength(polls)
  })

  it('applies pushes, skipping rows it already has', async () => {
    const { socket, board, drawing } = await live()
    await open(socket, { since: 5, data: [withId({ type: 'clear', data: '', client: 9, code: 0 }, 5)] })
    board.commit(s(1)) // drawn after the clear
    socket.handlers!.pushed({ since: 5, data: [withId({ type: 'clear', data: '', client: 9, code: 0 }, 5)] })
    expect(drawing.visible).toHaveLength(1) // the same clear again doesn't wipe it
    socket.handlers!.pushed({ since: 8, data: [withId(flowRow(9, 1, 2), 8)] })
    expect(drawing.visible).toHaveLength(2)
  })

  it('writes over the socket while it is up', async () => {
    const { api, socket, board } = await live()
    api.pending.push({ since: 4, lines: [] })
    await open(socket, { since: 5, data: [withId(flowRow(7, 4, 1), 5)] })
    board.commit(s(2))
    board.undo()
    socket.answers.clear = { since: 99, data: '' }
    board.clear()
    await settle()
    expect(socket.of('lines')).toEqual([{ action: 'lines', linedata: [{ code: 1, flow: serialize(s(2)) }] }])
    expect(socket.of('undo')).toEqual([{ action: 'undo', client: 2, code: 1 }])
    expect(socket.of('clear')).toEqual([{ action: 'clear', code: 2 }])
    expect(api.of('lines').concat(api.of('undo'), api.of('clear'))).toEqual([])

    // Polling resumes from after the clear once the socket goes.
    socket.handlers!.lost()
    await settle()
    expect(board.liveUp).toBe(false)
    expect(api.of('getlines').at(-1)).toEqual(['getlines', 'ab', 2, 99])
  })

  it('sends over HTTP when the socket drops mid-request', async () => {
    const { api, socket, board } = await live()
    await open(socket)
    socket.down = true
    board.commit(s(1))
    await settle()
    expect(socket.of('lines')).toHaveLength(1)
    expect(api.of('lines')).toEqual([['lines', 'ab', 2, [1]]])
    expect(board.lastError).toBeNull()
  })
})
