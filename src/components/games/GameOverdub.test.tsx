import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { createGame } from '@/lib/games/overdub/engine'
import { GameOverdub } from './GameOverdub'

const STORAGE_KEY = 'best:overdub'
const notes = () => screen.queryAllByTestId('note').length

describe('GameOverdub keyboard (audit 2026-10-10: Space only worked with the board focused)', { timeout: 20_000 }, () => {
  beforeEach(() => {
    localStorage.clear()
    // Freeze the playhead so the tap lands deterministically.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0)
    // Pin the loop seed (Date.now() ^ Math.random()) to one whose step 0 — where
    // the frozen playhead sits — is empty. Unpinned, a ghost landed there ~1 run
    // in 8: the Space tap then hit a note (game over) and "+1 note" flaked.
    let seed = 1
    while (createGame(seed).notes[0]) seed++
    vi.spyOn(Date, 'now').mockReturnValue(seed)
    vi.spyOn(Math, 'random').mockReturnValue(0)
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
