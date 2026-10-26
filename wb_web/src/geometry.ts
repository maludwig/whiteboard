/** Plain 2D points and vectors: the pieces of the old linearalgebra-1.3.js that strokes use. */

export interface Pt {
  x: number
  y: number
}

export const pt = (x: number, y: number): Pt => ({ x, y })
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (v: Pt, k: number): Pt => ({ x: v.x * k, y: v.y * k })
export const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y
export const length = (v: Pt): number => Math.hypot(v.x, v.y)
export const midpoint = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** `v` stretched or shrunk to length `len`. A zero vector stays zero (the old code made NaN). */
export function withLength(v: Pt, len: number): Pt {
  const current = length(v)
  return current === 0 ? { x: 0, y: 0 } : scale(v, len / current)
}

/** `v` turned a quarter turn clockwise on screen (y grows downward). */
export const perpendicular = (v: Pt): Pt => ({ x: v.y, y: -v.x })

/** `v` mirrored across a line running in direction `along`. */
export function reflect(v: Pt, along: Pt): Pt {
  const lenSq = dot(along, along)
  if (lenSq === 0) return v
  const projected = scale(along, dot(along, v) / lenSq)
  return sub(scale(projected, 2), v)
}
