import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Game2048 } from './Game2048'
import { loadStats } from '@/lib/gameStats'
import { themes2048 } from '@/lib/games/g2048/themes'
import type { Board, GameState } from '@/lib/games/g2048/engine'

// The test controls the opening board: one ArrowLeft merges the first row and the
// spawned tile lands in the only empty cell, leaving no legal move (game over).
const opening = vi.hoisted(() => ({ board: null as Board | null }))

vi.mock('@/lib/games/g2048/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/games/g2048/engine')>()
  return {
    ...real,
    newGame: (rng: () => number): GameState =>
      opening.board ? { board: opening.board.map((r) => [...r]), score: 0, over: false, won: false } : real.newGame(rng),
  }
})

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const theme = Object.values(themes2048)[0]

async function playLastMove() {
  render(<Game2048 theme={theme} storageKey="best:2048" />)
  await screen.findByTestId('board')
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  await waitFor(() => expect(loadStats('2048').plays).toBe(1))
}

describe('Game2048 result recording', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    opening.board = null
  })

  it('records a game over without the 2048 tile as a loss', async () => {
    opening.board = [
      [2, 2, 8, 16],
      [32, 64, 128, 256],
      [4, 8, 16, 32],
      [64, 128, 256, 512],
    ]
    await playLastMove()
    expect(loadStats('2048')).toMatchObject({ plays: 1, wins: 0 })
  })

  it('records a game over that reached 2048 (even on the same final move) as a win', async () => {
    opening.board = [
      [1024, 1024, 8, 16],
      [32, 64, 128, 256],
      [4, 8, 16, 32],
      [64, 128, 256, 512],
    ]
    await playLastMove()
    expect(loadStats('2048')).toMatchObject({ plays: 1, wins: 1 })
  })

  it('records the win the moment 2048 appears, even if the board is not locked (New Game from the win overlay)', async () => {
    opening.board = [
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    await playLastMove()
    expect(loadStats('2048')).toMatchObject({ plays: 1, wins: 1 })
    // a further move in the same game must not record it again
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await new Promise((r) => setTimeout(r, 50))
    expect(loadStats('2048').plays).toBe(1)
  })
})
