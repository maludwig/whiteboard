import type { Background } from './stores/toolStore'

/** The grid colours on offer, as #rrggbbaa. Only black is fully solid. */
export const GRID_COLORS: readonly { hex: string; label: string }[] = [
  { hex: '#4646aa66', label: 'Default' },
  { hex: '#000000ff', label: 'Black' },
  { hex: '#00000033', label: 'Grey' },
  { hex: '#1e77b966', label: 'Blue' },
  { hex: '#e7b6e799', label: 'Pink' },
]

/** The grid line thicknesses on offer, in px. */
export const GRID_WIDTHS: readonly number[] = [1, 2, 3, 5, 8]

export const DEFAULT_GRID_COLOR = GRID_COLORS[0].hex
export const DEFAULT_GRID_WIDTH = 2

/**
 * Every pattern repeats every TILE px. The grid is built as rectangles in one
 * tile, so dots and dashes always sit in the same places in every cell, then
 * that tile is repeated across the canvas.
 */
export const TILE = 100

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Where to put square dots of size `s` between a line's crossings `length` px
 * apart, the first crossing occupying [start, start + s). An odd number of
 * them, so one sits exactly in the middle, with equal gaps all round:
 * n = floor((length - s) / 2 / s), less one if even.
 */
export function dotPositions(start: number, length: number, s: number): number[] {
  let n = Math.floor(((length - s) * 0.5) / s)
  if (n % 2 === 0) n -= 1
  n = Math.max(0, n)
  const gap = (length - s - n * s) / (n + 1)
  return Array.from({ length: n }, (_, i) => start + s + gap * (i + 1) + s * i)
}

/** Dashes for pattern 2: an odd number per tile, the middle one centred. */
export function dashPositions(s: number): { at: number; length: number }[] {
  const length = Math.max(10, 3 * s)
  let n = Math.floor((TILE * 0.5) / length)
  if (n % 2 === 0) n -= 1
  n = Math.max(1, n)
  const gap = (TILE - n * length) / n
  return Array.from({ length: n }, (_, i) => ({ at: gap / 2 + i * (length + gap), length }))
}

const square = (x: number, y: number, s: number): Rect => ({ x, y, w: s, h: s })

/** The rectangles that make up one tile of a background, for lines `s` px thick. */
export function tileRects(background: Background, s: number): Rect[] {
  switch (background) {
    case 0:
      return []
    case 1:
      // Solid grid: a border along the tile's left and top edges.
      return [
        { x: 0, y: 0, w: s, h: TILE },
        { x: 0, y: 0, w: TILE, h: s },
      ]
    case 2:
      // Dashed horizontal lines.
      return dashPositions(s).map((d) => ({ x: d.at, y: 0, w: d.length, h: s }))
    case 3: {
      // The solid grid, plus a dotted grid through the middle of each cell.
      // The dotted lines sit at 50px, where their middle dots meet: that one
      // square belongs to the vertical line, and the horizontal one skips it.
      const mid = TILE / 2
      const dots = dotPositions(0, TILE, s)
      const middle = (dots.length - 1) / 2
      return [
        ...tileRects(1, s),
        ...dots.map((y) => square(mid, y, s)),
        ...dots.filter((_, i) => i !== middle).map((x) => square(x, mid, s)),
      ]
    }
    case 4: {
      // Dotted grid every 50px: a square at each crossing, dots between them.
      const rects: Rect[] = []
      const step = TILE / 2
      for (const a of [0, step]) {
        for (const b of [0, step]) {
          rects.push(square(a, b, s))
          for (const p of dotPositions(b, step, s)) {
            rects.push(square(a, p, s)) // along the vertical line at x = a
            rects.push(square(p, a, s)) // along the horizontal line at y = a
          }
        }
      }
      return rects
    }
  }
}

/**
 * One tile, painted at `scale` device pixels per grid pixel. Edges are rounded
 * to whole device pixels, and every rectangle is the same rounded size, so
 * squares stay identical and the gaps absorb the leftover pixels. Everything is
 * one path filled once, so translucent colours don't darken where rects overlap.
 */
function makeTile(rects: Rect[], color: string, scale: number): HTMLCanvasElement | null {
  const size = Math.max(1, Math.round(TILE * scale))
  const tile = document.createElement('canvas')
  tile.width = size
  tile.height = size
  const ctx = tile.getContext('2d')
  if (!ctx) return null
  ctx.beginPath()
  for (const r of rects) {
    const x = Math.round(r.x * scale)
    const y = Math.round(r.y * scale)
    ctx.rect(x, y, Math.max(1, Math.round(r.w * scale)), Math.max(1, Math.round(r.h * scale)))
  }
  ctx.fillStyle = color
  ctx.fill()
  return tile
}

export interface GridLook {
  color?: string
  width?: number
  /** Device pixels per grid pixel: the screen's pixel ratio, times any shrinking for previews. */
  scale?: number
  /** Where a tile's top-left corner falls, in device pixels. */
  originX?: number
  originY?: number
}

/** Fill the whole canvas with a background's grid, by repeating its tile. */
export function paintGrid(ctx: CanvasRenderingContext2D, background: Background, look: GridLook = {}): void {
  const { color = DEFAULT_GRID_COLOR, width = DEFAULT_GRID_WIDTH, scale = 1, originX = 0, originY = 0 } = look
  const rects = tileRects(background, width)
  if (rects.length === 0) return
  const tile = makeTile(rects, color, scale)
  const pattern = tile && ctx.createPattern(tile, 'repeat')
  if (!pattern) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, originX, originY)
  ctx.fillStyle = pattern
  ctx.fillRect(-originX, -originY, ctx.canvas.width, ctx.canvas.height)
  ctx.restore()
}
