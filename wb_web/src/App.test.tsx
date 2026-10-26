import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from './components/Sidebar'
import { toolStore } from './stores/toolStore'
import { drawingStore } from './stores/drawingStore'
import { deserialize } from './stroke'

describe('Sidebar', () => {
  it('switches tools, colours and sizes', async () => {
    render(<Sidebar />)
    await userEvent.click(screen.getByRole('button', { name: /highlighter/i }))
    expect(toolStore.tool).toBe('highlighter')
    await userEvent.click(screen.getByRole('button', { name: 'Color #c42169' }))
    expect(toolStore.color).toBe('#c42169')
    await userEvent.click(screen.getByRole('button', { name: 'Size 3' }))
    expect(toolStore.width).toBe(3)
    expect(screen.getByRole('button', { name: 'Size 3' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the other palettes and picks a colour from one', async () => {
    render(<Sidebar />)
    await userEvent.click(screen.getByRole('button', { name: 'More palettes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Color #ff00ff' }))
    expect(toolStore.color).toBe('#ff00ff')
    expect(toolStore.paletteIndex).toBe(4)
    expect(screen.queryByRole('button', { name: 'Color #7b7a0b' })).not.toBeInTheDocument()
  })

  it('reveals grid colours and line widths, and sets them', async () => {
    render(<Sidebar />)
    expect(screen.queryByRole('button', { name: 'Grid colour Black' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Grid options' }))
    await userEvent.click(screen.getByRole('button', { name: 'Grid colour Black' }))
    expect(toolStore.gridColor).toBe('#000000ff')
    await userEvent.click(screen.getByRole('button', { name: 'Grid lines 5px' }))
    expect(toolStore.gridWidth).toBe(5)
    expect(screen.getByRole('button', { name: 'Grid lines 5px' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('enables undo only when there is something to undo', async () => {
    drawingStore.clear()
    render(<Sidebar />)
    const undo = screen.getByRole('button', { name: /undo/i })
    expect(undo).toBeDisabled()
    drawingStore.add(deserialize({ p: [1, 1], c: '#000', t: 'pen', w: 3 }))
    expect(await screen.findByRole('button', { name: /undo/i })).toBeEnabled()
    await userEvent.click(undo)
    expect(drawingStore.visible).toHaveLength(0)
  })
})
