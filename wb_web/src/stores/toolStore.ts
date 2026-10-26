import { makeAutoObservable } from 'mobx'
import { DEFAULT_GRID_COLOR, DEFAULT_GRID_WIDTH } from '../grid'
import { type Tool, toHex } from '../stroke'

/** The five palettes from the old js/palettes.json. */
export const PALETTES: readonly (readonly string[])[] = [
  ['7b7a0b', '219dae', 'ebd468', '2b1603', '633c1e', 'b88355', 'a33969', 'fbaa7d', 'fde8c5'],
  ['332c22', '72604c', '5f3e60', '3c5435', '933a3a', '314c56', 'a8b57f', 'c68d8d', '638f9e'],
  ['404040', '828282', 'aaaaaa', 'dbdbdb', 'f6f6f6', 'ffcd57', 'c7cd57', 'df5039', '68b3d2'],
  ['000000', 'c42169', '8bad21', '183a67', '1e77b9', '2cb8f3', '9f70bb', 'f99c3d', 'fed572'],
  ['000', '666', 'ccc', 'f00', '0f0', '00f', 'ff0', 'f0f', '0ff'],
].map((palette) => palette.map((c) => toHex(c)))

/** Brush sizes as the sidebar lays them out: the common ones, then two rows of larger ones. */
export const SIZE_ROWS: readonly (readonly number[])[] = [[1, 3, 6, 10, 18], [27, 33, 40], [120]]
export const SIZES = SIZE_ROWS[0]
export const EXTRA_SIZES = SIZE_ROWS.slice(1).flat()

/** 0 is plain white; 1-4 are the old grid backgrounds. */
export const BACKGROUNDS = [0, 1, 2, 3, 4] as const
export type Background = (typeof BACKGROUNDS)[number]

export const TOOLS: readonly { id: Tool; label: string }[] = [
  { id: 'pen', label: 'Pen' },
  { id: 'highlighter', label: 'Highlighter' },
  { id: 'eraser', label: 'Eraser' },
]

export class ToolStore {
  tool: Tool = 'pen'
  color = '#1e77b9'
  width = 10
  background: Background = 3
  /** The grid's colour (#rrggbbaa) and line width in px. */
  gridColor = DEFAULT_GRID_COLOR
  gridWidth = DEFAULT_GRID_WIDTH
  /** The palette shown while the palette picker is closed. */
  paletteIndex = 3

  constructor() {
    makeAutoObservable(this)
  }

  get palette(): readonly string[] {
    return PALETTES[this.paletteIndex]
  }

  setTool(tool: Tool) {
    this.tool = tool
  }

  setColor(color: string) {
    this.color = toHex(color)
    const index = PALETTES.findIndex((palette) => palette.includes(this.color))
    if (index >= 0) this.paletteIndex = index
  }

  setWidth(width: number) {
    this.width = width
  }

  setBackground(background: Background) {
    this.background = background
  }

  setGridColor(color: string) {
    this.gridColor = color
  }

  setGridWidth(width: number) {
    this.gridWidth = width
  }
}

export const toolStore = new ToolStore()
