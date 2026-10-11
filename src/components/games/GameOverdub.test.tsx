import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GameOverdub } from './GameOverdub'

const STORAGE_KEY = 'best:overdub'
const notes = () => screen.queryAllByTestId('note').length

describe('GameOverdub keyboard (audit 2026-10-10: Space only worked with the board focused)', () => {
  beforeEach(() => {
    localStorage.clear()
    // Freeze the playhead so the tap lands deterministically.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0)
  })
  afterEach(() => vi.restoreAllMocks())

  it('Space stamps a note without focusing the board first, and does not scroll the page', () => {
    render(<GameOverdub storageKey={STORAGE_KEY} />)
    expect(document.activeElement).toBe(document.body)
    const n0 = notes()
    const ev = fireEvent.keyDown(document.body, { key: ' ' })
    expect(ev).toBe(false) // preventDefault → no page scroll
    expect(notes()).toBe(n0 + 1)
  })

  it('still works when the board itself is focused (no double tap)', () => {
    render(<GameOverdub storageKey={STORAGE_KEY} />)
    const board = screen.getByTestId('overdub-board')
    board.focus()
    const n0 = notes()
    fireEvent.keyDown(board, { key: ' ' })
    expect(notes()).toBe(n0 + 1)
  })

  it('ignores typing targets, held-key repeats, and Space/Enter on other buttons', () => {
    render(<GameOverdub storageKey={STORAGE_KEY} />)
    const n0 = notes()
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: ' ' })
    fireEvent.keyDown(document.body, { key: ' ', repeat: true })
    const btn = screen.getByRole('button', { name: /new loop/i })
    fireEvent.keyDown(btn, { key: ' ' })
    fireEvent.keyDown(btn, { key: 'Enter' })
    expect(notes()).toBe(n0)
    input.remove()
  })

  it('Cmd/Ctrl+R is left to the browser (reload), not hijacked as restart', () => {
    render(<GameOverdub storageKey={STORAGE_KEY} />)
    const ev = fireEvent.keyDown(document.body, { key: 'r', metaKey: true })
    expect(ev).toBe(true)
  })
})
