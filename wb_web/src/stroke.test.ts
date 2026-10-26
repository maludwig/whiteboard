import { describe, expect, it } from 'vitest'
import { pt, reflect } from './geometry'
import {
  type Stroke,
  deserialize,
  drawSegment,
  drawStroke,
  inkOf,
  segmentBounds,
  serialize,
  settledSegments,
  toHex,
} from './stroke'

describe('stored strokes', () => {
  it('read the format the old frontend wrote', () => {
    const stroke = deserialize({ p: [10, 20, 30, 40, 50.5, 60], c: '#1e77b9', t: 'pen', w: 10 })
    expect(stroke.points).toEqual([pt(10, 20), pt(30, 40), pt(50.5, 60)])
    expect(stroke).toMatchObject({ color: '#1e77b9', tool: 'pen', width: 10 })
  })

  it('round-trip unchanged', () => {
    const stored = { p: [1, 2, 3, 4], c: '#c42169', t: 'highlighter', w: 18 }
    expect(serialize(deserialize(stored))).toEqual(stored)
  })

  it('tolerate old colour spellings and unknown tools', () => {
    expect(deserialize({ p: [], c: 'rgb(30, 119, 185)', t: 'wand', w: 3 })).toMatchObject({ color: '#1e77b9', tool: 'pen' })
    expect(toHex('#0F0')).toBe('#00ff00')
    expect(toHex('rgba(255, 0, 0, 0.2)')).toBe('#ff0000')
  })
})

describe('ink', () => {
  it('is the colour for the pen, 20% for the highlighter, white for the eraser', () => {
    expect(inkOf({ color: '#1e77b9', tool: 'pen' })).toBe('rgba(30, 119, 185, 1)')
    expect(inkOf({ color: '#1e77b9', tool: 'highlighter' })).toBe('rgba(30, 119, 185, 0.2)')
    expect(inkOf({ color: '#1e77b9', tool: 'eraser' })).toBe('#ffffff')
  })
})

describe('geometry', () => {
  it('reflects a vector across a direction', () => {
    expect(reflect(pt(1, 1), pt(1, 0))).toEqual(pt(1, -1))
    expect(reflect(pt(3, 4), pt(0, 0))).toEqual(pt(3, 4))
  })
})

/** Records canvas calls, standing in for a 2D context. */
function recorder() {
  const calls: [string, ...number[]][] = []
  const record =
    (name: string) =>
    (...args: number[]) =>
      calls.push([name, ...args])
  const ctx = {
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    bezierCurveTo: record('bezierCurveTo'),
    arc: record('arc'),
    stroke: record('stroke'),
    fill: record('fill'),
  } as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

const stroke = (...coords: number[]): Stroke => deserialize({ p: coords, c: '#000', t: 'pen', w: 4 })

describe('drawing', () => {
  it('draws one point as a dot and two as a line', () => {
    const dot = recorder()
    drawStroke(dot.ctx, stroke(5, 5))
    expect(dot.calls.map((c) => c[0])).toEqual(['beginPath', 'arc', 'fill'])

    const line = recorder()
    drawStroke(line.ctx, stroke(0, 0, 10, 0))
    expect(line.calls).toEqual([['beginPath'], ['moveTo', 0, 0], ['lineTo', 10, 0], ['stroke']])
  })

  it('chains one curve per segment, ending on each point', () => {
    const { ctx, calls } = recorder()
    drawStroke(ctx, stroke(0, 0, 10, 0, 20, 5, 30, 0, 40, 0))
    const curves = calls.filter((c) => c[0] === 'bezierCurveTo')
    expect(curves).toHaveLength(4)
    expect(curves.map((c) => [c[5], c[6]])).toEqual([[10, 0], [20, 5], [30, 0], [40, 0]])
    for (const c of curves) expect(c.slice(1).every(Number.isFinite)).toBe(true)
  })

  it('draws the same curves one settled segment at a time as all at once', () => {
    const coords = [0, 0, 12, 3, 25, 11, 31, 30, 28, 44, 15, 50, 4, 61, 9, 75]
    const whole = recorder()
    drawStroke(whole.ctx, stroke(...coords))
    const shapes = (calls: [string, ...number[]][]) => calls.filter((c) => c[0] === 'bezierCurveTo' || c[0] === 'lineTo')

    // As the canvas does while points arrive: each segment once its shape is settled...
    const growing = recorder()
    const all = stroke(...coords).points
    let drawn = 0
    for (let n = 1; n <= all.length; n++) {
      const settled = settledSegments(n)
      for (let i = drawn; i < settled; i++) drawSegment(growing.ctx, all.slice(0, n), i)
      drawn = settled
    }
    // ...plus the final tail.
    drawSegment(growing.ctx, all, all.length - 2)

    expect(shapes(growing.calls)).toEqual(shapes(whole.calls))
  })

  it('bounds a segment generously enough to contain its curve', () => {
    const p = stroke(0, 0, 30, 0, 30, 30).points
    const box = segmentBounds(p, 1, 10)
    expect(box.x).toBeLessThan(30 - 5)
    expect(box.y).toBeLessThan(0 - 5)
    expect(box.x + box.w).toBeGreaterThan(30 + 5)
    expect(box.y + box.h).toBeGreaterThan(30 + 5)
  })

  it('stays finite when a stroke doubles back on itself', () => {
    const { ctx, calls } = recorder()
    drawStroke(ctx, stroke(0, 0, 10, 0, 0, 0, 10, 0))
    for (const c of calls) expect(c.slice(1).every(Number.isFinite)).toBe(true)
  })
})
