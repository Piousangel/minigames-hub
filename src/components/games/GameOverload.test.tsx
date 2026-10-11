import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  addCharge,
  CELLS,
  mulberry32,
  newGame,
  nextBoard,
  type GameState,
} from '@/lib/games/overload/engine'
import { GameOverload } from './GameOverload'

const STORAGE_KEY = 'best:overload'

/** First cell whose single tap is a Perfect Storm, or -1. */
function stormTap(s: GameState): number {
  for (let i = 0; i < CELLS; i++) if (addCharge(s, i).state.cleared) return i
  return -1
}

/**
 * A seed whose level-1 board has a one-tap storm AND whose level-2 board
 * (same seed — the component's randomSeed() is pinned) is lost by tapping
 * cell 0 until the taps run out.
 */
function findScenario() {
  for (let seed = 1; seed < 5000; seed++) {
    const b1 = newGame(mulberry32(seed), 'puzzle', seed)
    const storm = stormTap(b1)
    if (storm < 0) continue
    const cleared = addCharge(b1, storm).state
    const b2 = nextBoard(cleared, mulberry32(seed), seed)
    let s = b2
    while (!s.over && !s.cleared) s = addCharge(s, 0).state
    if (s.over) return { seed, storm, cleared, b2 }
  }
  throw new Error('no scenario seed')
}

const charges = () =>
  screen.getAllByTestId('overload-cell').map((el) => Number(el.getAttribute('data-charge')))

function flush() {
  act(() => {
    vi.advanceTimersByTime(10_000)
  })
}

describe('GameOverload Retry board (audit 2026-10-10)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('retries the SAME level-2 board with the score it started with', () => {
    const { seed, storm, cleared, b2 } = findScenario()
    // randomSeed() = floor(Math.random() * 2^32) → exactly `seed`.
    vi.spyOn(Math, 'random').mockReturnValue(seed / 2 ** 32)

    render(<GameOverload storageKey={STORAGE_KEY} />)
    flush()

    fireEvent.click(screen.getAllByTestId('overload-cell')[storm])
    flush()
    fireEvent.click(screen.getByRole('button', { name: 'Next board' }))
    flush()
    expect(charges()).toEqual(b2.charges)

    for (let i = 0; i < 20 && !screen.queryByRole('button', { name: 'Retry board' }); i++) {
      fireEvent.click(screen.getAllByTestId('overload-cell')[0])
      flush()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Retry board' }))
    flush()

    expect(charges()).toEqual(b2.charges)
    expect(screen.getByTestId('score').textContent).toContain(String(cleared.score))
    expect(screen.getByTestId('taps').textContent).toContain(String(b2.tapsLeft))
    expect(screen.getByTestId('storm').textContent).toContain('45')
  })
})
