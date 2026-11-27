import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

// ── animals 전용: 진화 사다리 · 도달한 동물 결과 줄 · 역대 최고 타일(bestTile:<slug>) ──
const animals = themes2048.animals
const classic = themes2048.classic
// 한 번의 ArrowLeft로 2+2가 합쳐지고 빈칸 하나에 스폰 → 더 둘 곳이 없다(게임오버). 최고 타일 512(🐯 Tiger).
const LAST_MOVE_512: Board = [
  [2, 2, 8, 16],
  [32, 64, 128, 256],
  [4, 8, 16, 32],
  [64, 128, 256, 512],
]

async function playLastMoveAs(t: typeof animals, key: string) {
  const r = render(<Game2048 theme={t} storageKey={key} />)
  await screen.findByTestId('board')
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  const over = await screen.findByTestId('game-over')
  return { over, unmount: r.unmount }
}

describe('Game2048 animals evolution ladder and result', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    opening.board = null
  })

  it('ladder marks steps up to the best tile on the board as reached and the following one as next', async () => {
    opening.board = [
      [16, 4, 0, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    render(<Game2048 theme={animals} storageKey="best:2048-animals" />)
    const ladder = await screen.findByTestId('evolution-ladder')
    const states = Array.from(ladder.querySelectorAll('[data-step]')).map((el) => el.getAttribute('data-state'))
    expect(states).toEqual(['reached', 'reached', 'reached', 'reached', 'next', ...Array(6).fill('locked')])
    expect(ladder).toHaveAttribute('aria-label', 'Evolution: Mouse, Hamster, Rabbit, Fox — next: Cat')
    // 각 타일 모서리에 단계 값
    expect(screen.getAllByTestId('tile-value').map((el) => el.textContent).sort()).toEqual(['16', '2', '4'])
  })

  it('game over shows the reached animal and the next one, and stores bestTile', async () => {
    opening.board = LAST_MOVE_512
    const { over } = await playLastMoveAs(animals, 'best:2048-animals')
    expect(within(over).getByTestId('result-animal')).toHaveTextContent('You reached 🐯 Tiger · next: 🐻 Bear')
    await waitFor(() => expect(localStorage.getItem('bestTile:2048-animals')).toBe('512'))
  })

  it('bestTile only moves up on a record; a record run says "New animal!"', async () => {
    localStorage.setItem('bestTile:2048-animals', '1024')
    opening.board = LAST_MOVE_512
    const first = await playLastMoveAs(animals, 'best:2048-animals')
    expect(within(first.over).getByTestId('result-animal')).toHaveTextContent(/^You reached 🐯 Tiger/)
    expect(localStorage.getItem('bestTile:2048-animals')).toBe('1024')
    first.unmount()

    localStorage.setItem('bestTile:2048-animals', '256')
    const second = await playLastMoveAs(animals, 'best:2048-animals')
    expect(within(second.over).getByTestId('result-animal')).toHaveTextContent(/^New animal! 🐯 Tiger/)
    await waitFor(() => expect(localStorage.getItem('bestTile:2048-animals')).toBe('512'))
  })

  it('keeps the score record (best:<slug>) a score, separate from the tile record', async () => {
    opening.board = LAST_MOVE_512
    await playLastMoveAs(animals, 'best:2048-animals')
    await waitFor(() => expect(localStorage.getItem('best:2048-animals')).toBe('4'))
  })

  it('classic 2048 has no ladder, no tile values, no animal result line and no bestTile key', async () => {
    opening.board = LAST_MOVE_512
    const { over } = await playLastMoveAs(classic, 'best:2048')
    expect(screen.queryByTestId('evolution-ladder')).toBeNull()
    expect(screen.queryByTestId('tile-value')).toBeNull()
    expect(within(over).queryByTestId('result-animal')).toBeNull()
    await waitFor(() => expect(over).toHaveTextContent('Score: 4 · Best: 4'))
    expect(Object.keys(localStorage).filter((k) => k.startsWith('bestTile:'))).toEqual([])
  })
})

// ── #263 animals 리마스터: 새 친구 등장 연출 · 평생 도감 (새 저장 키 0) ──
const FRIEND_128: Board = [
  [64, 64, 0, 0],
  [0, 0, 0, 0],
  [64, 0, 0, 0],
  [64, 0, 0, 0],
]
// ArrowLeft 한 번: 32+32 → 64(이번 판 첫 64). 아래 칸은 더 합쳐질 게 없다.
const FRIEND_64: Board = [
  [32, 32, 0, 0],
  [2, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
]

describe('Game2048 animals new-friend banner and lifetime collection', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    opening.board = null
  })

  it('(a) lifetime best 64 → making 128 says "New friend!" once; making 128 again shows nothing', async () => {
    localStorage.setItem('bestTile:2048-animals', '64')
    opening.board = FRIEND_128
    render(<Game2048 theme={animals} storageKey="best:2048-animals" />)
    await screen.findByTestId('board')
    fireEvent.keyDown(window, { key: 'ArrowLeft' }) // row 0: 64+64 → 128
    const banner = await screen.findByTestId('friend-banner')
    expect(banner).toHaveTextContent('New friend!')
    expect(banner).toHaveTextContent('Wolf')
    expect(banner).toHaveAttribute('data-kind', 'lifetime')
    // 연출은 0.8초 안에 스스로 사라진다
    await waitFor(() => expect(screen.queryByTestId('friend-banner')).toBeNull(), { timeout: 1500 })
    fireEvent.keyDown(window, { key: 'ArrowUp' }) // column 0: 64+64 → a second 128 this game
    await waitFor(() => expect(screen.getByTestId('score')).toHaveTextContent('256'))
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.queryByTestId('friend-banner')).toBeNull()
  })

  it('(b) 32 → 64 when 64 was already met in a past game: this-game banner only, no "New friend!"', async () => {
    localStorage.setItem('bestTile:2048-animals', '64')
    opening.board = FRIEND_64
    render(<Game2048 theme={animals} storageKey="best:2048-animals" />)
    await screen.findByTestId('board')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    const banner = await screen.findByTestId('friend-banner')
    expect(banner).toHaveAttribute('data-kind', 'round')
    expect(banner).toHaveTextContent('Dog')
    expect(banner).not.toHaveTextContent('New friend!')
    // 배너는 입력을 막지 않는다
    expect(banner.className).toContain('pointer-events-none')
  })

  it('lifetime collection shows met animals and silhouettes "?" for the rest', async () => {
    localStorage.setItem('bestTile:2048-animals', '64')
    opening.board = FRIEND_128
    render(<Game2048 theme={animals} storageKey="best:2048-animals" />)
    const col = await screen.findByTestId('friend-collection')
    await waitFor(() => expect(col).toHaveAttribute('data-met', '6'))
    const cells = Array.from(col.querySelectorAll('[data-friend]'))
    expect(cells).toHaveLength(11)
    expect(cells.map((c) => c.getAttribute('data-met'))).toEqual([...Array(6).fill('yes'), ...Array(5).fill('no')])
    expect(cells[5]).toHaveTextContent('Dog')
    expect(cells[6]).toHaveTextContent('?')
    expect(cells[6]).not.toHaveTextContent('Wolf')
    // 이번 판에서 128을 만들면 도감도 바로 7칸
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(col).toHaveAttribute('data-met', '7'))
    expect(cells[6]).toHaveTextContent('Wolf')
  })

  it('writes no new storage keys (only the existing best:, bestTile:, stats:, vid)', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    localStorage.setItem('bestTile:2048-animals', '64')
    opening.board = LAST_MOVE_512
    await playLastMoveAs(animals, 'best:2048-animals')
    await waitFor(() => expect(localStorage.getItem('bestTile:2048-animals')).toBe('512'))
    const keys = new Set(setItem.mock.calls.map(([k]) => k))
    expect([...keys].sort()).toEqual(['best:2048-animals', 'bestTile:2048-animals', 'stats:2048-animals', 'vid'])
  })

  it('(c) classic 2048 renders no banner and no collection', async () => {
    opening.board = FRIEND_128
    render(<Game2048 theme={classic} storageKey="best:2048" />)
    await screen.findByTestId('board')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(screen.getByTestId('score')).toHaveTextContent('128'))
    expect(screen.queryByTestId('friend-banner')).toBeNull()
    expect(screen.queryByTestId('friend-collection')).toBeNull()
  })
})
