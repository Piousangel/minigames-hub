import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { State } from '@/lib/games/dominoes/engine'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

// Lets a test swap in a hand-built deal; null = the real shuffled deal.
let rigged: State | null = null
vi.mock('@/lib/games/dominoes/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/games/dominoes/engine')>()
  return { ...real, deal: (rng: () => number) => (rigged ? structuredClone(rigged) : real.deal(rng)) }
})

import { GameDominoes } from './GameDominoes'

const STORAGE_KEY = 'best:dominoes'

/** Both players stuck on a 3-3 line with an empty boneyard and equal pips (3 vs 3). */
const BLOCKED_TIE: State = {
  hands: [
    [[1, 2]],
    [
      [0, 2],
      [0, 1],
    ],
  ],
  line: [[3, 3]],
  leftEnd: 3,
  rightEnd: 3,
  boneyard: [],
  turn: 0,
  status: 'playing',
  winner: null,
  passes: 0,
}

describe('GameDominoes', () => {
  beforeEach(() => {
    localStorage.clear()
    rigged = null
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Audit 2026-10-10 [bug/S]: a blocked tie was recorded as a loss under a red "lose" overlay.
  it('a blocked tie is a draw: no loss recorded and a neutral draw overlay', () => {
    rigged = BLOCKED_TIE
    render(<GameDominoes storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByTestId('dominoes-pass'))
    act(() => {
      vi.advanceTimersByTime(1000) // CPU turn: it also has to pass -> blocked, 3 vs 3 pips
    })

    expect(screen.getByTestId('dominoes-result-draw')).toHaveTextContent("It's a draw")
    expect(screen.queryByTestId('dominoes-result-lose')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dominoes-result-win')).not.toBeInTheDocument()
    const record = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { w?: number; l?: number; d?: number }
    expect(record.l ?? 0).toBe(0)
    expect(record.w ?? 0).toBe(0)
    expect(record.d).toBe(1)
  })

  // Audit 2026-10-10 [bug/S]: line tiles collapsed to 3×2px because the tile had no height.
  it('gives every tile on the line a fixed box and fills it', () => {
    rigged = { ...BLOCKED_TIE, line: [[3, 3], [3, 5]], rightEnd: 5 }
    render(<GameDominoes storageKey={STORAGE_KEY} />)
    const tiles = screen.getAllByTestId('line-tile')
    expect(tiles).toHaveLength(2)
    for (const slot of tiles) {
      expect(slot).toHaveClass('h-8', 'w-16')
      expect(slot.firstElementChild).toHaveClass('h-full', 'w-full')
    }
  })
})
