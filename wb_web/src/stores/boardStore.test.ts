import { afterEach, describe, expect, it } from 'vitest'
import type { Joined, LineRow, NewLine, UploadApi } from '../api'
import type { Nav } from '../nav'
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
  async clear(hash: string, client: number) {
    this.calls.push(['clear', hash, client])
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
    expect(api.of('clear')).toEqual([['clear', 'ab', 2]])
    await board.poll()
    expect(api.of('getlines').at(-1)).toEqual(['getlines', 'ab', 2, 99])
  })
})
