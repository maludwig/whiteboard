import { describe, expect, it } from 'vitest'
import { deserialize } from '../stroke'
import { DrawingStore } from './drawingStore'

const s = (n: number) => deserialize({ p: [n, n], c: '#000', t: 'pen', w: 3 })

describe('DrawingStore', () => {
  it('undoes and redoes in order', () => {
    const d = new DrawingStore()
    const [a, b] = [s(1), s(2)]
    d.add(a)
    d.add(b)
    expect(d.undo()).toBe(b)
    expect(d.visible).toEqual([a])
    expect(d.canRedo).toBe(true)
    expect(d.redo()).toBe(b)
    expect(d.visible).toEqual([a, b])
    expect(d.redo()).toBeUndefined()
  })

  it('drops the redo history when something new is drawn', () => {
    const d = new DrawingStore()
    d.add(s(1))
    d.add(s(2))
    d.undo()
    d.add(s(3))
    expect(d.canRedo).toBe(false)
    expect(d.strokes).toHaveLength(2)
  })

  it('keeps the redo history when a remote stroke arrives', () => {
    const d = new DrawingStore()
    const [mine, undone, theirs] = [s(1), s(2), s(3)]
    d.add(mine)
    d.add(undone)
    d.undo()
    d.addRemote(theirs)
    expect(d.visible).toEqual([mine, theirs])
    expect(d.redo()).toBe(undone)
  })

  it('removes one stroke without hiding the ones after it', () => {
    const d = new DrawingStore()
    const [a, b, c] = [s(1), s(2), s(3)]
    d.add(a)
    d.add(b)
    d.add(c)
    d.remove(a)
    expect(d.visible).toEqual([b, c])
  })
})
