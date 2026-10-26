import { describe, expect, it } from 'vitest'
import { TILE, dashPositions, dotPositions, tileRects } from './grid'

const close = (values: number[], digits = 3) => values.map((v) => Number(v.toFixed(digits)))

describe('dotPositions', () => {
  it('fits the odd number of dots from the formula, with equal gaps', () => {
    // 8px: n = floor(92 * 0.5 / 8) = 5; gaps (100 - 8 - 40) / 6 = 8.667
    expect(close(dotPositions(0, 100, 8))).toEqual([16.667, 33.333, 50, 66.667, 83.333])
    // 2px: floor(98 * 0.5 / 2) = 24, even, so 23
    expect(dotPositions(0, 100, 2)).toHaveLength(23)
    expect(dotPositions(0, 100, 5)).toHaveLength(9)
    expect(dotPositions(0, 100, 1)).toHaveLength(49)
  })

  it('always puts the middle dot exactly in the middle between crossings', () => {
    for (const s of [1, 2, 3, 5, 8]) {
      const dots = dotPositions(0, 100, s)
      const middle = dots[(dots.length - 1) / 2]
      expect(middle + s / 2).toBeCloseTo((s + 100) / 2)
    }
  })

  it('leaves gaps at least as wide as the dots', () => {
    for (const s of [1, 2, 3, 5, 8]) {
      const [a, b] = dotPositions(0, 100, s)
      expect(b - a - s).toBeGreaterThanOrEqual(s - 1e-9)
    }
  })
})

describe('dashPositions', () => {
  it('uses an odd number of dashes with the middle one centred', () => {
    const dashes = dashPositions(2)
    expect(dashes).toHaveLength(5)
    const middle = dashes[2]
    expect(middle.at + middle.length / 2).toBeCloseTo(TILE / 2)
    expect(dashPositions(8)).toHaveLength(1)
  })
})

describe('tileRects', () => {
  it('is empty for the blank background', () => {
    expect(tileRects(0, 2)).toEqual([])
  })

  it('draws the solid grid as a border on the left and top edges', () => {
    expect(tileRects(1, 2)).toEqual([
      { x: 0, y: 0, w: 2, h: 100 },
      { x: 0, y: 0, w: 100, h: 2 },
    ])
  })

  it('puts the dotted grid through the middle, sharing the square where its lines cross', () => {
    const rects = tileRects(3, 8)
    // 2 border lines + 5 vertical dots + 4 horizontal (the shared middle one once)
    expect(rects).toHaveLength(11)
    const atCentre = rects.filter((r) => r.w === 8 && r.h === 8 && Math.abs(r.x - 50) < 1e-9 && Math.abs(r.y - 50) < 1e-9)
    expect(atCentre).toHaveLength(1)
  })

  it('draws the 50px dotted grid with one square per crossing', () => {
    const rects = tileRects(4, 8)
    // 4 crossings, and per line segment floor(42 * 0.5 / 8) = 2, even, so 1 middle dot: 4 + 8
    expect(rects).toHaveLength(12)
    const crossings = rects.filter((r) => [0, 50].includes(r.x) && [0, 50].includes(r.y))
    expect(crossings).toHaveLength(4)
  })

  it('keeps every rectangle inside the tile', () => {
    for (const bg of [1, 2, 3, 4] as const) {
      for (const s of [1, 2, 3, 5, 8]) {
        for (const r of tileRects(bg, s)) {
          expect(r.x).toBeGreaterThanOrEqual(0)
          expect(r.y).toBeGreaterThanOrEqual(0)
          expect(r.x + r.w).toBeLessThanOrEqual(TILE + 1e-9)
          expect(r.y + r.h).toBeLessThanOrEqual(TILE + 1e-9)
        }
      }
    }
  })
})
