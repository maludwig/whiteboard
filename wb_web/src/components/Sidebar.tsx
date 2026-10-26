import { observer } from 'mobx-react-lite'
import type { ReactNode } from 'react'
import type { Tool } from '../stroke'
import { boardStore } from '../stores/boardStore'
import { drawingStore } from '../stores/drawingStore'
import { GRID_COLORS, GRID_WIDTHS } from '../grid'
import { BACKGROUNDS, PALETTES, SIZE_ROWS, TOOLS, toolStore } from '../stores/toolStore'
import { uiStore } from '../stores/uiStore'
import { snapshot } from './BoardCanvas'
import { ExpandableSidebarElement } from './ExpandableSidebarElement'
import { GridIcon } from './GridIcon'
import {
  ChevronIcon,
  ClearIcon,
  EraserIcon,
  PencilIcon,
  RedoIcon,
  SaveIcon,
  ShareIcon,
  SunIcon,
  UndoIcon,
} from './icons'

const TOOL_ICONS: Record<Tool, ReactNode> = {
  pen: <PencilIcon size={36} />,
  highlighter: <SunIcon size={36} />,
  eraser: <EraserIcon size={36} />,
}

export const Sidebar = observer(function Sidebar() {
  return (
    <aside className={uiStore.sidebarOpen ? 'sidebar open' : 'sidebar'}>
      {/* Outside the scrolling panel: a scroll box clips everything past its edge, this tab included. */}
      <button className="sidebar-toggle" aria-label="Toggle sidebar" onClick={() => uiStore.toggleSidebar()}>
        <ChevronIcon open={uiStore.sidebarOpen} />
      </button>
      <div className="sidebar-panel">
        <Palettes />
        <hr />
        <Sizes />
        <hr />
        <Tools />
        <hr />
        <Backgrounds />
        <hr />
        <Functions />
        <hr />
        <p className="copyright">Designed, implemented, and hosted by Mitchell Ludwig. Copyright 2014 by Mitchell Ludwig.</p>
        {boardStore.lastError && <p className="error">{boardStore.lastError}</p>}
        <Saved />
      </div>
    </aside>
  )
})

const Palettes = observer(function Palettes() {
  return (
    <ExpandableSidebarElement
      className="palettes"
      expanded={uiStore.palettesOpen}
      onToggle={() => uiStore.togglePalettes()}
      label="More palettes"
    >
      <PaletteList expanded={uiStore.palettesOpen} />
    </ExpandableSidebarElement>
  )
})

/** The current palette, or all of them, one under another, when expanded. */
const PaletteList = observer(function PaletteList({ expanded }: { expanded: boolean }) {
  const shown = expanded ? PALETTES.map((_, i) => i) : [toolStore.paletteIndex]
  return (
    <>
      {shown.map((index) => (
        <div className="palette" key={index}>
          {PALETTES[index].map((color) => (
            <button
              key={color}
              className={color === toolStore.color ? 'swatch active' : 'swatch'}
              style={{ background: color }}
              aria-label={`Color ${color}`}
              aria-pressed={color === toolStore.color}
              onClick={() => {
                toolStore.setColor(color)
                if (expanded) uiStore.togglePalettes()
              }}
            />
          ))}
        </div>
      ))}
    </>
  )
})

const Sizes = observer(function Sizes() {
  return (
    <ExpandableSidebarElement
      className="sizes"
      expanded={uiStore.sizesOpen}
      onToggle={() => uiStore.toggleSizes()}
      label="More sizes"
    >
      <SizeList expanded={uiStore.sizesOpen} />
    </ExpandableSidebarElement>
  )
})

/** The common sizes, plus the larger rows when expanded; each row spans the full width. */
const SizeList = observer(function SizeList({ expanded }: { expanded: boolean }) {
  const rows = expanded ? SIZE_ROWS : SIZE_ROWS.slice(0, 1)
  return (
    <div className="size-list">
      {rows.map((row) => (
        <div className="size-row" key={row.join()}>
          {row.map((size) => (
            <button
              key={size}
              className={size === toolStore.width ? 'size active' : 'size'}
              aria-label={`Size ${size}`}
              aria-pressed={size === toolStore.width}
              onClick={() => toolStore.setWidth(size)}
            >
              <span style={{ width: size, height: size, background: toolStore.tool === 'eraser' ? '#999' : toolStore.color }} />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
})

const Tools = observer(function Tools() {
  return (
    <section className="tools">
      {TOOLS.map(({ id, label }) => (
        <button
          key={id}
          className={id === toolStore.tool ? 'tool active' : 'tool'}
          style={id === toolStore.tool ? { color: toolStore.color } : undefined}
          aria-pressed={id === toolStore.tool}
          onClick={() => toolStore.setTool(id)}
        >
          {TOOL_ICONS[id]}
          <span>{label}</span>
        </button>
      ))}
    </section>
  )
})

const Backgrounds = observer(function Backgrounds() {
  return (
    <ExpandableSidebarElement
      className="backgrounds"
      expanded={uiStore.backgroundsOpen}
      onToggle={() => uiStore.toggleBackgrounds()}
      label="Grid options"
    >
      <BackgroundOptions expanded={uiStore.backgroundsOpen} />
    </ExpandableSidebarElement>
  )
})

/** The grid patterns, plus the grid's colours and line widths when expanded. */
const BackgroundOptions = observer(function BackgroundOptions({ expanded }: { expanded: boolean }) {
  const { background, gridColor, gridWidth } = toolStore
  return (
    <>
      <div className="option-row">
        {BACKGROUNDS.map((bg) => (
          <button
            key={bg}
            className={bg === background ? 'background active' : 'background'}
            aria-label={`Background ${bg}`}
            aria-pressed={bg === background}
            onClick={() => toolStore.setBackground(bg)}
          >
            <GridIcon background={bg} color={gridColor} width={gridWidth} />
          </button>
        ))}
      </div>
      {expanded && (
        <>
          <div className="option-row">
            {GRID_COLORS.map(({ hex, label }) => (
              <button
                key={hex}
                className={hex === gridColor ? 'grid-color active' : 'grid-color'}
                aria-label={`Grid colour ${label}`}
                aria-pressed={hex === gridColor}
                onClick={() => toolStore.setGridColor(hex)}
              >
                <span style={{ background: hex }} />
              </button>
            ))}
          </div>
          <div className="option-row">
            {GRID_WIDTHS.map((width) => (
              <button
                key={width}
                className={width === gridWidth ? 'background active' : 'background'}
                aria-label={`Grid lines ${width}px`}
                aria-pressed={width === gridWidth}
                onClick={() => toolStore.setGridWidth(width)}
              >
                {/* Blank has no lines to show a thickness with, so these preview the plain grid. */}
                <GridIcon background={background || 1} color={gridColor} width={width} />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
})

const Functions = observer(function Functions() {
  return (
    <section className="functions">
      <FunctionButton label="Clear" onClick={() => boardStore.clear()}>
        <ClearIcon />
      </FunctionButton>
      <FunctionButton
        label="Share"
        onClick={() => {
          uiStore.showShare()
          void boardStore.share()
        }}
      >
        <ShareIcon />
      </FunctionButton>
      <FunctionButton label="Save" onClick={() => uiStore.showSaved(snapshot())}>
        <SaveIcon />
      </FunctionButton>
      <FunctionButton label="Undo" disabled={!drawingStore.canUndo} onClick={() => boardStore.undo()}>
        <UndoIcon />
      </FunctionButton>
      <FunctionButton label="Redo" disabled={!drawingStore.canRedo} onClick={() => boardStore.redo()}>
        <RedoIcon />
      </FunctionButton>
    </section>
  )
})

function FunctionButton(props: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="function" disabled={props.disabled} onClick={props.onClick}>
      {props.children}
      <span>{props.label}</span>
    </button>
  )
}

const Saved = observer(function Saved() {
  return (
    <div className="saved">
      {uiStore.saved.map((image, i) => (
        <a key={i} href={image} target="_blank" rel="noreferrer" download="whiteboard.png">
          <img src={image} alt="Saved whiteboard" />
        </a>
      ))}
    </div>
  )
})
