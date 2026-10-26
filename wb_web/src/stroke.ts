import { type Pt, add, length, perpendicular, pt, reflect, sub, withLength } from './geometry'

export type Tool = 'pen' | 'highlighter' | 'eraser'

/** One stroke. Frozen once finished: strokes are shared between the store and the renderer. */
export interface Stroke {
  readonly points: readonly Pt[]
  /** "#rrggbb" */
  readonly color: string
  readonly tool: Tool
  readonly width: number
}

/**
 * The stored form, exactly as the old frontend wrote it into `lines.json`, so
 * old and new clients can share a board: `{"p":[x1,y1,x2,y2,...],"c":"#1e77b9","t":"pen","w":10}`.
 */
export interface StoredStroke {
  p: number[]
  c: string
  t: string
  w: number
}

export function serialize(stroke: Stroke): StoredStroke {
  return {
    p: stroke.points.flatMap((p) => [p.x, p.y]),
    c: stroke.color,
    t: stroke.tool,
    w: stroke.width,
  }
}

export function deserialize(stored: StoredStroke): Stroke {
  const points: Pt[] = []
  for (let i = 0; i + 1 < stored.p.length; i += 2) points.push(pt(Number(stored.p[i]), Number(stored.p[i + 1])))
  const tool: Tool = stored.t === 'highlighter' || stored.t === 'eraser' ? stored.t : 'pen'
  return Object.freeze({ points: Object.freeze(points), color: toHex(stored.c), tool, width: Number(stored.w) || 3 })
}

/** "#abc", "#aabbcc", "rgb(r, g, b)" or "rgba(r, g, b, a)" to "#aabbcc"; black if unreadable. */
export function toHex(color: string): string {
  const c = color.trim().toLowerCase()
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(c)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
  const long = /^#?([0-9a-f]{6})$/.exec(c)
  if (long) return `#${long[1]}`
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(c)
  if (rgb) return '#' + rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')
  return '#000000'
}

/** What the stroke paints with: the eraser paints white, the highlighter at 20%. */
export function inkOf(stroke: Pick<Stroke, 'color' | 'tool'>): string {
  if (stroke.tool === 'eraser') return '#ffffff'
  const hex = toHex(stroke.color)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${stroke.tool === 'highlighter' ? 0.2 : 1})`
}

/** Points closer together in time than this are dropped while drawing, which smooths lines. */
export const SAMPLE_MS = 30

/**
 * Draw a stroke as the old frontend did: one point is a dot, two a line, and
 * longer strokes a chain of Bézier curves whose control points follow the
 * neighbouring points (flow.js line3a / line4 / line3b).
 */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const p = stroke.points
  if (p.length === 0) return
  setInk(ctx, stroke)
  if (p.length === 1) {
    drawDot(ctx, p[0], stroke.width)
    return
  }
  // One path for the whole stroke, so a translucent highlighter doesn't darken where it overlaps itself.
  ctx.beginPath()
  ctx.moveTo(p[0].x, p[0].y)
  for (let i = 0; i + 1 < p.length; i++) segmentTo(ctx, p, i)
  ctx.stroke()
}

/**
 * Set the context up to paint `stroke`. `opaque` paints the highlighter at full
 * strength, for layers whose opacity is applied as a whole instead.
 */
export function setInk(ctx: CanvasRenderingContext2D, stroke: Pick<Stroke, 'color' | 'tool' | 'width'>, opaque = false) {
  const ink = inkOf(opaque && stroke.tool === 'highlighter' ? { ...stroke, tool: 'pen' } : stroke)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1, stroke.width)
  ctx.strokeStyle = ink
  ctx.fillStyle = ink
}

export function drawDot(ctx: CanvasRenderingContext2D, at: Pt, width: number) {
  ctx.beginPath()
  ctx.arc(at.x, at.y, Math.max(1, width) / 2, 0, 2 * Math.PI)
  ctx.fill()
}

/**
 * How many of a growing stroke's segments have their final shape. Segment i,
 * from point i to point i+1, is shaped by the points around it up to i+2, so
 * all but the newest segment are settled; that one is drawn as the stroke's
 * end until another point arrives.
 */
export const settledSegments = (pointCount: number) => Math.max(0, pointCount - 2)

/** Draw segment i on its own, in the shape it has given exactly these points. */
export function drawSegment(ctx: CanvasRenderingContext2D, p: readonly Pt[], i: number) {
  ctx.beginPath()
  ctx.moveTo(p[i].x, p[i].y)
  segmentTo(ctx, p, i)
  ctx.stroke()
}

/** The area segment i can paint into, for clearing just that much. */
export function segmentBounds(p: readonly Pt[], i: number, width: number) {
  const a = p[i]
  const b = p[i + 1] ?? a
  // Control points sit at most a third of the segment's length off its ends.
  const pad = length(sub(b, a)) / 3 + Math.max(1, width) / 2 + 2
  return {
    x: Math.min(a.x, b.x) - pad,
    y: Math.min(a.y, b.y) - pad,
    w: Math.abs(a.x - b.x) + 2 * pad,
    h: Math.abs(a.y - b.y) + 2 * pad,
  }
}

/** Continue the current path from point i to point i+1. */
function segmentTo(ctx: CanvasRenderingContext2D, p: readonly Pt[], i: number) {
  const n = p.length
  if (n === 2) ctx.lineTo(p[1].x, p[1].y)
  else if (i === 0) startCurve(ctx, p[0], p[1], p[2])
  else if (i === n - 2) endCurve(ctx, p[n - 3], p[n - 2], p[n - 1])
  else middleCurve(ctx, p[i - 1], p[i], p[i + 1], p[i + 2])
}

const curve = (ctx: CanvasRenderingContext2D, c1: Pt, c2: Pt, to: Pt) => ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y)

/** p1 to p2, bending to lead into p3 (flow.js line3a). */
function startCurve(ctx: CanvasRenderingContext2D, p1: Pt, p2: Pt, p3: Pt) {
  const bisector = perpendicular(sub(p1, p2))
  const toward = withLength(sub(p1, p3), length(sub(p2, p1)) / 3)
  curve(ctx, add(p1, reflect(toward, bisector)), add(p2, toward), p2)
}

/** p2 to p3, shaped by p1 before and p4 after (flow.js line4). */
function middleCurve(ctx: CanvasRenderingContext2D, p1: Pt, p2: Pt, p3: Pt, p4: Pt) {
  const third = length(sub(p3, p2)) / 3
  curve(ctx, add(p2, withLength(sub(p3, p1), third)), add(p3, withLength(sub(p2, p4), third)), p3)
}

/** p2 to p3, bending out of p1 (flow.js line3b). */
function endCurve(ctx: CanvasRenderingContext2D, p1: Pt, p2: Pt, p3: Pt) {
  const bisector = perpendicular(sub(p3, p2))
  const from = withLength(sub(p3, p1), length(sub(p2, p3)) / 3)
  curve(ctx, add(p2, from), add(p3, reflect(from, bisector)), p3)
}
