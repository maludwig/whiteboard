import { useEffect, useRef } from 'react'
import { paintGrid } from '../grid'
import type { Background } from '../stores/toolStore'

/** Previews show the board's grid this much smaller: one 100px tile spans 20px. */
const PREVIEW_SCALE = 0.2

/**
 * A small preview of a grid: the board's own tile, shrunk, and shifted half a
 * tile so the main border crosses the middle of the preview.
 */
export function GridIcon(props: { background: Background; color: string; width: number; size?: number }) {
  const { background, color, width, size = 25 } = props
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = window.devicePixelRatio || 1
    el.width = Math.round(size * dpr)
    el.height = Math.round(size * dpr)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, el.width, el.height)
    paintGrid(ctx, background, { color, width, scale: PREVIEW_SCALE * dpr, originX: el.width / 2, originY: el.height / 2 })
  }, [background, color, width, size])

  return <canvas ref={canvas} className="grid-icon" style={{ width: size, height: size }} aria-hidden="true" />
}
