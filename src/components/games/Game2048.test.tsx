import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Game2048 } from './Game2048'
import { loadStats } from '@/lib/gameStats'
import { themes2048 } from '@/lib/games/g2048/themes'
import type { Board, GameState } from '@/lib/games/g2048/engine'

// The test controls the opening board: one ArrowLeft merges the first row and the
// spawned tile lands in the only empty cell, leaving no legal move (game over).
const opening = vi.hoisted(() => ({ board: null as Board | null, moves: 0 }))

vi.mock('@/lib/games/g2048/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/games/g2048/engine')>()
  return {
    ...real,
    newGame: (rng: () => number): GameState =>
      opening.board ? { board: opening.board.map((r) => [...r]), score: 0, over: false, won: false } : real.newGame(rng),
    // 실제로 처리된 이동 수를 센다(엔진 규칙은 그대로 real.move).
    move: (...args: Parameters<typeof real.move>) => {
      opening.moves++
      return real.move(...args)
    },
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

// 한 칸짜리 판: right → down → left 는 스폰 위치와 무관하게 셋 다 실제로 움직인다.
const SINGLE: Board = [
  [2, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
]

describe('Game2048 rapid input queue', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    opening.moves = 0
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    opening.board = null
  })

  it('3 quick inputs during the slide animation produce 3 moves (none swallowed)', async () => {
    opening.board = SINGLE
    render(<Game2048 theme={theme} storageKey="best:2048" />)
    await screen.findByTestId('board')
    fireEvent.keyDown(window, { key: 'ArrowRight' }) // starts a 130ms slide
    fireEvent.keyDown(window, { key: 'ArrowDown' }) // arrives mid-slide
    fireEvent.keyDown(window, { key: 'ArrowLeft' }) // arrives mid-slide
    expect(opening.moves).toBe(3)
    // the last slide settles normally: 1 start tile + 3 spawns (merges can only lower this)
    await waitFor(() => expect(screen.getAllByTestId('tile').length).toBeGreaterThanOrEqual(3))
    await new Promise((r) => setTimeout(r, 200))
    expect(opening.moves).toBe(3)
  })

  it('restart mid-slide cancels the pending slide and leaves no queued moves behind', async () => {
    opening.board = SINGLE
    render(<Game2048 theme={theme} storageKey="best:2048" />)
    await screen.findByTestId('board')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
    await new Promise((r) => setTimeout(r, 200)) // past SLIDE_MS: a stale settle would spawn a tile here
    expect(screen.getAllByTestId('tile')).toHaveLength(1)
    expect(screen.getByTestId('score')).toHaveTextContent('0')
    expect(opening.moves).toBe(1)
    // the fresh game takes exactly one move per input
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await new Promise((r) => setTimeout(r, 200))
    expect(opening.moves).toBe(2)
    expect(screen.getAllByTestId('tile')).toHaveLength(2)
  })
})

describe('Game2048 merge vibration', () => {
  let vibrate: ReturnType<typeof vi.fn>
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    opening.board = null
    delete (navigator as { vibrate?: unknown }).vibrate
  })

  const mergeBoard = (v: number): Board => [
    [v, v, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]

  it('buzzes 8ms on a small merge and 18ms on a 128+ merge', async () => {
    opening.board = mergeBoard(2)
    const { unmount } = render(<Game2048 theme={theme} storageKey="best:2048" />)
    await screen.findByTestId('board')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(vibrate).toHaveBeenCalledWith(8))
    unmount()

    vibrate.mockClear()
    opening.board = mergeBoard(64)
    render(<Game2048 theme={theme} storageKey="best:2048" />)
    await screen.findByTestId('board')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(vibrate).toHaveBeenCalledWith(18))
  })

  it('does not buzz when muted, and survives a browser without navigator.vibrate', async () => {
    localStorage.setItem('minigames:muted', '1')
    opening.board = mergeBoard(2)
    const { unmount } = render(<Game2048 theme={theme} storageKey="best:2048" />)
    await screen.findByTestId('board')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unmute sound' })).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await new Promise((r) => setTimeout(r, 200))
    expect(vibrate).not.toHaveBeenCalled()
    unmount()

    localStorage.clear()
    delete (navigator as { vibrate?: unknown }).vibrate
    render(<Game2048 theme={theme} storageKey="best:2048" />)
    await screen.findByTestId('board')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(screen.getByTestId('score')).toHaveTextContent('4'))
  })
})
