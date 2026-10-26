import { makeAutoObservable, observableShallow } from 'mobx'
import type { Stroke } from '../stroke'

/**
 * The strokes on this page, local and remote, with an undo mark: strokes
 * before it are shown; strokes after it are undone, waiting for redo.
 * Strokes are frozen objects, kept shallowly observable (thousands of points
 * don't need tracking, and the renderer compares them by identity).
 */
export class DrawingStore {
  strokes: Stroke[] = []
  undoMark = 0

  constructor() {
    makeAutoObservable(this, { strokes: observableShallow })
  }

  get visible(): readonly Stroke[] {
    return this.strokes.slice(0, this.undoMark)
  }

  get canUndo() {
    return this.undoMark > 0
  }

  get canRedo() {
    return this.undoMark < this.strokes.length
  }

  /** A stroke drawn here. Drawing something new discards whatever was waiting for redo. */
  add(stroke: Stroke) {
    this.strokes.splice(this.undoMark)
    this.strokes.push(stroke)
    this.undoMark = this.strokes.length
  }

  /** A stroke from someone else: shown on top, without discarding this page's redo history. */
  addRemote(stroke: Stroke) {
    this.strokes.splice(this.undoMark, 0, stroke)
    this.undoMark += 1
  }

  /** Hides the newest shown stroke and returns it. */
  undo(): Stroke | undefined {
    if (!this.canUndo) return undefined
    this.undoMark -= 1
    return this.strokes[this.undoMark]
  }

  /** Shows the most recently undone stroke again and returns it. */
  redo(): Stroke | undefined {
    if (!this.canRedo) return undefined
    this.undoMark += 1
    return this.strokes[this.undoMark - 1]
  }

  /** Drops one particular stroke (someone else undid it). */
  remove(stroke: Stroke) {
    const index = this.strokes.indexOf(stroke)
    if (index < 0) return
    this.strokes.splice(index, 1)
    if (index < this.undoMark) this.undoMark -= 1
  }

  clear() {
    this.strokes.splice(0)
    this.undoMark = 0
  }
}

export const drawingStore = new DrawingStore()
