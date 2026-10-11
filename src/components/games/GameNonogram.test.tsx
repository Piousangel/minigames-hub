import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameNonogram } from './GameNonogram'
import { newGame } from '@/lib/games/nonogram/engine'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SEED = 4242

function cellAt(r: number, c: number, size: number) {
  return screen.getAllByTestId('nonogram-cell')[r * size + c]
}

describe('GameNonogram', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(SEED))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function mount() {
    render(<GameNonogram storageKey="best:nonogram" />)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    return newGame(mulberry32(SEED), 'easy') // the same puzzle the component generated
  }

  function firstBlank(sol: boolean[][]): [number, number] {
    for (let r = 0; r < sol.length; r++) for (let c = 0; c < sol.length; c++) if (!sol[r][c]) return [r, c]
    throw new Error('no blank cell')
  }

  it('does not leak the answer: a wrong fill changes no live counter (audit: Mistakes oracle)', () => {
    const g = mount()
    const [r, c] = firstBlank(g.solution)
    expect(screen.queryByTestId('mistakes')).not.toBeInTheDocument()
    fireEvent.pointerDown(cellAt(r, c, g.size))
    expect(cellAt(r, c, g.size)).toHaveAttribute('data-value', 'filled')
    expect(screen.getByTestId('checks')).toHaveTextContent('0')
    expect(document.querySelector('[data-wrong="true"]')).toBeNull()
  })

  it('Check reveals wrong fills on demand, counts the check, and clears on the next paint', () => {
    const g = mount()
    const [r, c] = firstBlank(g.solution)
    fireEvent.pointerDown(cellAt(r, c, g.size))
    fireEvent.click(screen.getByTestId('nonogram-check'))
    expect(cellAt(r, c, g.size)).toHaveAttribute('data-wrong', 'true')
    expect(screen.getByTestId('checks')).toHaveTextContent('1')
    // Painting again hides the stale check result.
    fireEvent.pointerDown(cellAt(r, c, g.size))
    expect(document.querySelector('[data-wrong="true"]')).toBeNull()
  })

  it('filling the picture wins', () => {
    const g = mount()
    for (let r = 0; r < g.size; r++)
      for (let c = 0; c < g.size; c++) if (g.solution[r][c]) fireEvent.pointerDown(cellAt(r, c, g.size))
    expect(screen.getByTestId('you-win')).toBeInTheDocument()
  })
})
