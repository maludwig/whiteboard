import { reaction } from 'mobx'
import { observer } from 'mobx-react-lite'
import { type PointerEvent, useEffect, useRef } from 'react'
import { type Pt, pt } from '../geometry'
import {
  SAMPLE_MS,
  type Stroke,
  drawDot,
  drawSegment,
  drawStroke,
  segmentBounds,
  setInk,
  settledSegments,
} from '../stroke'
import { boardStore } from '../stores/boardStore'
import { drawingStore } from '../stores/drawingStore'
import { toolStore } from '../stores/toolStore'
import { paintGrid } from '../grid'
import { remoteLog } from '../remoteLog'

/** Strokes this recent are drawn on the "live" layer, so undoing them doesn't redraw everything. */
const LIVE = 5

type Box = { x: number; y: number; w: number; h: number }

const clearAll = (canvas: HTMLCanvasElement | null) => {
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
}

/**
 * The board: stacked canvases (the old flowmgmt.js idea, taken one step further)
 * plus the grid.
 *  - baked:   every shown stroke except the newest few, drawn once and kept
 *  - live:    the newest few, redrawn on any change
 *  - settled: the stroke being drawn, as far as its shape is final; only added to
 *  - tail:    that stroke's newest segment, which changes until the next point
 *             arrives; the only thing redrawn per frame, and only its own area
 * The grid sits on top, so the eraser's white paint never hides it.
 */
export const BoardCanvas = observer(function BoardCanvas() {
  const baked = useRef<HTMLCanvasElement>(null)
  const live = useRef<HTMLCanvasElement>(null)
  const settled = useRef<HTMLCanvasElement>(null)
  const tail = useRef<HTMLCanvasElement>(null)
  /** Holds settled + tail. A highlighter is painted opaque there, and this whole
   *  group made translucent, so the two layers' overlap doesn't darken. */
  const inProgress = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const layers = [baked.current!, live.current!, settled.current!, tail.current!, grid.current!]
    let bakedStrokes: readonly Stroke[] = []

    const context = (canvas: HTMLCanvasElement) => canvas.getContext('2d')
    const wipe = (canvas: HTMLCanvasElement) => {
      const ctx = context(canvas)
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
      return ctx
    }

    function render(visible: readonly Stroke[], full: boolean) {
      const split = Math.max(0, visible.length - LIVE)
      const target = visible.slice(0, split)
      // Usually strokes only get added, so the baked layer just needs the new ones drawn on.
      const appendOnly = !full && bakedStrokes.length <= target.length && bakedStrokes.every((s, i) => s === target[i])
      const bakedCtx = appendOnly ? context(layers[0]) : wipe(layers[0])
      if (bakedCtx) for (const s of target.slice(appendOnly ? bakedStrokes.length : 0)) drawStroke(bakedCtx, s)
      bakedStrokes = target
      const liveCtx = wipe(layers[1])
      if (liveCtx) for (const s of visible.slice(split)) drawStroke(liveCtx, s)
    }

    function renderGrid() {
      const ctx = wipe(layers[4])
      if (ctx) {
        paintGrid(ctx, toolStore.background, {
          color: toolStore.gridColor,
          width: toolStore.gridWidth,
          scale: window.devicePixelRatio || 1,
        })
      }
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1
      for (const canvas of layers) {
        canvas.width = Math.round(window.innerWidth * dpr)
        canvas.height = Math.round(window.innerHeight * dpr)
        context(canvas)?.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      render(drawingStore.visible, true)
      renderGrid()
    }

    resize()
    window.addEventListener('resize', resize)
    const disposers = [
      reaction(
        () => drawingStore.visible,
        (visible) => render(visible, false),
      ),
      reaction(() => [toolStore.background, toolStore.gridColor, toolStore.gridWidth], renderGrid),
    ]
    return () => {
      window.removeEventListener('resize', resize)
      disposers.forEach((dispose) => dispose())
    }
  }, [])

  // The stroke in progress lives here, not in a store: it changes at pointer speed.
  const drawing = useRef<{
    pointer: number
    points: Pt[]
    last: number
    /** segments already on the settled layer */
    settledCount: number
    /** what the tail layer last painted, to clear just that */
    tailBox: Box | null
    input: InputStats
  } | null>(null)
  const frame = useRef(0)

  function current(): Stroke | null {
    const d = drawing.current
    if (!d) return null
    return { points: d.points, color: toolStore.color, tool: toolStore.tool, width: toolStore.width }
  }

  /** Once per frame: add newly settled segments, then redraw the tail. */
  function paintInProgress() {
    frame.current = 0
    const d = drawing.current
    const stroke = current()
    const settledCtx = settled.current?.getContext('2d')
    const tailCtx = tail.current?.getContext('2d')
    if (!d || !stroke || !settledCtx || !tailCtx) return
    const started = performance.now()
    const p = d.points

    const settle = settledSegments(p.length)
    if (settle > d.settledCount) {
      setInk(settledCtx, stroke, true)
      for (let i = d.settledCount; i < settle; i++) drawSegment(settledCtx, p, i)
      d.settledCount = settle
    }

    if (d.tailBox) tailCtx.clearRect(d.tailBox.x, d.tailBox.y, d.tailBox.w, d.tailBox.h)
    setInk(tailCtx, stroke, true)
    if (p.length === 1) {
      drawDot(tailCtx, p[0], stroke.width)
      d.tailBox = segmentBounds(p, 0, stroke.width)
    } else {
      drawSegment(tailCtx, p, p.length - 2)
      d.tailBox = segmentBounds(p, p.length - 2, stroke.width)
    }

    const took = performance.now() - started
    d.input.paints += 1
    d.input.paintMs += took
    d.input.paintMaxMs = Math.max(d.input.paintMaxMs, took)
  }

  function schedulePaint() {
    if (!frame.current) frame.current = requestAnimationFrame(paintInProgress)
  }

  function onPointerDown(e: PointerEvent) {
    if (drawing.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const input: InputStats = {
      type: e.pointerType,
      first: e.timeStamp,
      last: e.timeStamp,
      events: 1,
      samples: 1,
      paints: 0,
      paintMs: 0,
      paintMaxMs: 0,
      commitMs: 0,
    }
    drawing.current = {
      pointer: e.pointerId,
      points: [pt(e.clientX, e.clientY)],
      last: e.timeStamp,
      settledCount: 0,
      tailBox: null,
      input,
    }
    if (inProgress.current) inProgress.current.style.opacity = toolStore.tool === 'highlighter' ? '0.2' : '1'
    schedulePaint()
  }

  function onPointerMove(e: PointerEvent) {
    const d = drawing.current
    if (!d || d.pointer !== e.pointerId) return
    // Counted before any filtering: the point is to see how much input arrives.
    d.input.events += 1
    d.input.samples += e.nativeEvent.getCoalescedEvents?.().length || 1
    d.input.last = e.timeStamp
    const prev = d.points[d.points.length - 1]
    if (prev.x === e.clientX && prev.y === e.clientY) return
    // Like the old client: samples closer than SAMPLE_MS apart are dropped, which smooths the curve.
    if (e.timeStamp - d.last < SAMPLE_MS) return
    d.points.push(pt(e.clientX, e.clientY))
    d.last = e.timeStamp
    schedulePaint()
  }

  function onPointerEnd(e: PointerEvent) {
    const d = drawing.current
    if (!d || d.pointer !== e.pointerId) return
    const prev = d.points[d.points.length - 1]
    if (e.type === 'pointerup' && (prev.x !== e.clientX || prev.y !== e.clientY)) d.points.push(pt(e.clientX, e.clientY))
    d.input.events += 1
    d.input.samples += 1
    d.input.last = e.timeStamp
    const stroke = current()!
    drawing.current = null
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = 0
    const committing = performance.now()
    // The finished stroke is drawn whole onto the live layer; the in-progress layers are done with.
    boardStore.commit(Object.freeze({ ...stroke, points: Object.freeze([...stroke.points]) }))
    clearAll(settled.current)
    clearAll(tail.current)
    d.input.commitMs = performance.now() - committing
    logInput(d.input, stroke.points.length)
  }

  return (
    <div
      className="board"
      data-testid="board"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <canvas ref={baked} className="layer" />
      <canvas ref={live} className="layer" />
      <div ref={inProgress} className="layer">
        <canvas ref={settled} className="layer" />
        <canvas ref={tail} className="layer" />
      </div>
      <canvas ref={grid} className="layer grid" />
    </div>
  )
})

/** Pointer input over one stroke, from pointerdown to pointerup. */
interface InputStats {
  type: string
  /** performance-clock timestamps (event.timeStamp) of the first and last event */
  first: number
  last: number
  /** every pointer event received, including ones the 30 ms throttle dropped */
  events: number
  /** hardware samples, counting each move's coalesced events where the browser reports them */
  samples: number
  /** times the scratch layer was repainted while drawing */
  paints: number
  /** JS time spent in those repaints: total and slowest, in ms */
  paintMs: number
  paintMaxMs: number
  /** JS time to commit the finished stroke: store update plus live/baked layer drawing */
  commitMs: number
}

function logInput(input: InputStats, kept: number) {
  const ms = input.last - input.first
  const perSecond = (n: number) => (ms > 0 ? Math.round((n * 1000) / ms) : 0)
  const dpr = window.devicePixelRatio || 1
  remoteLog.log(
    `stroke input (${input.type}): ${input.events} events (${perSecond(input.events)}/s), ` +
      `${input.samples} samples (${perSecond(input.samples)}/s), ${input.paints} paints (${perSecond(input.paints)}/s), ` +
      `${kept} points kept, over ${ms.toFixed(1)}ms from t=${input.first.toFixed(1)} to t=${input.last.toFixed(1)}; ` +
      `canvas ${Math.round(window.innerWidth * dpr)}x${Math.round(window.innerHeight * dpr)} at dpr ${dpr}`,
  )
  const ms3 = (n: number) => n.toFixed(3)
  const clock = timerInfo()
  remoteLog.log(
    `stroke drawing: ${input.paints} repaints took ${ms3(input.paintMs)}ms in total ` +
      `(avg ${ms3(input.paints ? input.paintMs / input.paints : 0)}ms, slowest ${ms3(input.paintMaxMs)}ms), ` +
      `commit ${ms3(input.commitMs)}ms for ${kept} points; ` +
      `clock step ~${ms3(clock.stepMs)}ms, crossOriginIsolated=${clock.isolated}, getCoalescedEvents=${clock.coalesced}`,
  )
}

let timer: { stepMs: number; isolated: boolean; coalesced: boolean } | null = null

/**
 * How finely performance.now() ticks here (browsers coarsen it; cross-origin
 * isolated pages get a finer one), and whether coalesced events exist. Measured once.
 */
function timerInfo() {
  if (timer) return timer
  let step = Infinity
  const deadline = performance.now() + 5
  let previous = performance.now()
  while (previous < deadline) {
    const now = performance.now()
    if (now > previous) {
      step = Math.min(step, now - previous)
      previous = now
    }
  }
  timer = {
    stepMs: Number.isFinite(step) ? step : 0,
    isolated: Boolean(window.crossOriginIsolated),
    coalesced: typeof PointerEvent !== 'undefined' && 'getCoalescedEvents' in PointerEvent.prototype,
  }
  return timer
}

/** The shown strokes flattened into one white-backed PNG, for Save. */
export function snapshot(): string {
  const dpr = window.devicePixelRatio || 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(window.innerWidth * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  for (const stroke of drawingStore.visible) drawStroke(ctx, stroke)
  return canvas.toDataURL('image/png')
}
