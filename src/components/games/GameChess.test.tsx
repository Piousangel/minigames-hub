import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { GameChess } from './GameChess'

const STORAGE_KEY = 'best:chess'

const square = (name: string) => screen.getByRole('gridcell', { name: new RegExp(`^${name},`) })

describe('GameChess', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('never renders the emoji-prone pawn character ♟ (U+265F); pawns are drawn as SVG in both colours', () => {
    render(<GameChess storageKey={STORAGE_KEY} />)
    const board = screen.getByTestId('chess-board')
    // U+265F is an Emoji codepoint: colour-emoji fonts paint it black and ignore CSS color,
    // so White's pawns used to look identical to Black's.
    expect(board.textContent).not.toContain('♟')
    const white = square('e2').querySelector('svg[data-piece="pawn"]')
    const black = square('e7').querySelector('svg[data-piece="pawn"]')
    expect(white).not.toBeNull()
    expect(black).not.toBeNull()
    expect(white!.getAttribute('fill')).not.toBe(black!.getAttribute('fill'))
  })

  it('other piece glyphs carry the text-presentation selector (U+FE0E)', () => {
    render(<GameChess storageKey={STORAGE_KEY} />)
    for (const name of ['a1', 'b1', 'c1', 'd1', 'e1', 'a8', 'e8']) {
      const t = square(name).textContent ?? ''
      expect(t).toMatch(/[♚-♞]︎/)
    }
  })

  it('highlights the last move (from + to) and moves the highlight to the CPU reply', () => {
    render(<GameChess storageKey={STORAGE_KEY} />)
    expect(document.querySelectorAll('[data-last-move]')).toHaveLength(0)
    fireEvent.click(square('e2'))
    fireEvent.click(square('e4'))
    expect(square('e2')).toHaveAttribute('data-last-move', 'from')
    expect(square('e4')).toHaveAttribute('data-last-move', 'to')
    expect(document.querySelectorAll('[data-last-move]')).toHaveLength(2)
    // CPU (Black) replies after its delay — the highlight follows its move.
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const marked = Array.from(document.querySelectorAll('[data-last-move]'))
    expect(marked).toHaveLength(2)
    expect(square('e2')).not.toHaveAttribute('data-last-move')
    const to = marked.find((el) => el.getAttribute('data-last-move') === 'to')!
    expect(to.getAttribute('aria-label')).toMatch(/black/)
  })

  it('undo removes the highlight back to the previous move', () => {
    render(<GameChess storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByRole('button', { name: '2 Player' }))
    fireEvent.click(square('e2'))
    fireEvent.click(square('e4'))
    fireEvent.click(square('e7'))
    fireEvent.click(square('e5'))
    expect(square('e7')).toHaveAttribute('data-last-move', 'from')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(square('e2')).toHaveAttribute('data-last-move', 'from')
    expect(square('e4')).toHaveAttribute('data-last-move', 'to')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(document.querySelectorAll('[data-last-move]')).toHaveLength(0)
  })
})
