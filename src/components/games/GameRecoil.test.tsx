import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, fireEvent, within } from '@testing-library/react'
import { GameRecoil } from './GameRecoil'
import { challengeQuery } from '@/lib/challenge'
import { FP, createGameForSeed, dailySeedFor, seedWithDifficulty, type Layout } from '@/lib/games/recoil/engine'
import { sendHit } from '@/lib/hit'
import { hasLeaderboard } from '@/lib/leaderboard'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

// One star 20 units right of spawn: aim left (8) + fire → the kick carries the ship into it (~tick 8).
// Opt-in per test: when set, every board the component builds uses this layout (seed/rules unchanged).
let easyLayout: Layout | null = null
vi.mock('@/lib/games/recoil/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/games/recoil/engine')>()
  return {
    ...real,
    createGameForSeed: (seed: number) =>
      easyLayout
        ? real.createGameFromLayout(real.DIFFICULTIES[real.difficultyOfSeed(seed)], easyLayout, seed >>> 0)
        : real.createGameForSeed(seed),
  }
})
const ONE_STAR: Layout = {
  walls: [],
  stars: [{ id: 0, x: 180 * FP, y: 112 * FP, taken: false, takenAt: null }],
}

const STORAGE_KEY = 'best:recoil'
const SEED = seedWithDifficulty(49380, 'normal')

// rAF를 수동 큐로 바꿔 틱을 결정적으로 돌린다(17ms ≈ 1틱).
let rafQueue: FrameRequestCallback[] = []
let now = 0
function flushFrame(ms = 17) {
  now += ms
  const q = rafQueue
  rafQueue = []
  act(() => {
    for (const cb of q) cb(now)
  })
}

/** Alternate up/down shots: every pair cancels exactly, so the last round leaves the ship dead in space. */
function playToStall(board: HTMLElement) {
  const ammo = createGameForSeed(SEED).config.ammo
  for (let i = 0; i < ammo; i++) {
    fireEvent.keyDown(board, { key: i % 2 === 0 ? 'ArrowUp' : 'ArrowDown' })
    fireEvent.keyDown(board, { key: ' ' })
    flushFrame(0) // first frame of a fresh loop only primes the clock
    flushFrame()
  }
  for (let i = 0; i < 3; i++) flushFrame()
}

/** Aim left, fire, fly into the single ONE_STAR star. */
function playToWin(board: HTMLElement) {
  fireEvent.keyDown(board, { key: 'ArrowRight' }) // aim 0 → 1
  for (let i = 0; i < 7; i++) fireEvent.keyDown(board, { key: 'ArrowRight' }) // → 8 (left)
  fireEvent.keyDown(board, { key: ' ' })
  flushFrame(0)
  for (let i = 0; i < 20; i++) flushFrame()
}

function starPositions(): string[] {
  return screen.getAllByTestId('recoil-star').map((el) => el.getAttribute('transform') ?? '')
}
function enginePositions(seed: number): string[] {
  return createGameForSeed(seed).stars.map((st) => `translate(${st.x / FP} ${st.y / FP})`)
}

describe('GameRecoil', () => {
  beforeEach(() => {
    easyLayout = null
    localStorage.clear()
    rafQueue = []
    now = 0
    vi.mocked(sendHit).mockClear()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })

  it('?vs= shows the challenge banner and a challenge run never writes best or streak', async () => {
    window.history.replaceState(null, '', `/recoil?${challengeQuery({ seed: SEED, score: 900, name: 'Ana' })}`)
    render(<GameRecoil storageKey={STORAGE_KEY} />)
    const board = await screen.findByTestId('recoil-board')

    const banner = screen.getByTestId('challenge-banner')
    expect(banner).toHaveTextContent('Ana scored 900 on this exact run. Beat it!')
    expect(banner).toHaveTextContent("Challenge runs don't count toward your best.")
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument()

    playToStall(board)

    expect(await screen.findByTestId('challenge-result')).toHaveTextContent('900 short of 900')
    expect(screen.getByTestId('game-over')).toHaveTextContent('Ana still leads')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('recoil:daily')).toBeNull()
    expect(sendHit).toHaveBeenCalledWith('recoil', 'challenge-done')
    // score 0 → nothing worth sharing
    expect(screen.queryByTestId('challenge-share')).toBeNull()
  })

  it('Play solo clears the challenge params and drops the banner', async () => {
    window.history.replaceState(null, '', `/recoil?${challengeQuery({ seed: SEED, score: 900, name: 'Ana' })}`)
    render(<GameRecoil storageKey={STORAGE_KEY} />)
    await screen.findByTestId('recoil-board')
    fireEvent.click(screen.getByTestId('challenge-leave'))
    expect(screen.queryByTestId('challenge-banner')).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('a solo run does write best', async () => {
    render(<GameRecoil storageKey={STORAGE_KEY} />)
    const board = await screen.findByTestId('recoil-board')
    expect(screen.queryByTestId('challenge-banner')).toBeNull()
    playToStall(board)
    await screen.findByTestId('game-over')
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(sendHit).not.toHaveBeenCalledWith('recoil', 'challenge-done')
  })

  it('Enter/Space on an overlay button activates the button instead of firing', async () => {
    render(<GameRecoil storageKey={STORAGE_KEY} />)
    const board = await screen.findByTestId('recoil-board')
    playToStall(board)
    const over = await screen.findByTestId('game-over')
    const retryBtn = within(over).getByRole('button', { name: 'Retry' })
    // fireEvent returns false when the handler called preventDefault (which blocks native activation)
    expect(fireEvent.keyDown(retryBtn, { key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(retryBtn, { key: ' ' })).toBe(true)
    // …but on the board itself Space still belongs to the game
    expect(fireEvent.keyDown(board, { key: ' ' })).toBe(false)
  })

  it('ignores keys with ctrl/meta/alt (Ctrl+R reloads, it does not restart the run)', async () => {
    render(<GameRecoil storageKey={STORAGE_KEY} />)
    const board = await screen.findByTestId('recoil-board')
    playToStall(board)
    await screen.findByTestId('game-over')
    fireEvent.keyDown(board, { key: 'r', ctrlKey: true })
    fireEvent.keyDown(board, { key: 'r', metaKey: true })
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(fireEvent.keyDown(board, { key: ' ', altKey: true })).toBe(true)
    fireEvent.keyDown(board, { key: 'r' })
    expect(screen.queryByTestId('game-over')).toBeNull()
  })

  it('daily win keeps freezes/maxStreak in the shared streak format (same recoil:daily key)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-09T12:00:00Z'))
    localStorage.setItem('recoil:daily', JSON.stringify({ lastDate: '2026-10-08', streak: 4, freezes: 1, maxStreak: 9 }))
    easyLayout = ONE_STAR
    render(<GameRecoil storageKey={STORAGE_KEY} />)
    const board = await screen.findByTestId('recoil-board')
    playToWin(board)
    await screen.findByTestId('you-win')
    // streak 5 → +1 freeze (capped at 2); maxStreak preserved
    expect(JSON.parse(localStorage.getItem('recoil:daily')!)).toEqual({
      lastDate: '2026-10-09',
      streak: 5,
      freezes: 2,
      maxStreak: 9,
    })
  })

  it('Replay Daily after UTC midnight deals today’s board, not yesterday’s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-09T23:59:00Z'))
    render(<GameRecoil storageKey={STORAGE_KEY} />)
    await screen.findByTestId('recoil-board')
    expect(starPositions()).toEqual(enginePositions(dailySeedFor(20261009)))
    vi.setSystemTime(new Date('2026-10-10T00:01:00Z'))
    fireEvent.click(screen.getByRole('button', { name: 'Replay Daily' }))
    expect(starPositions()).toEqual(enginePositions(dailySeedFor(20261010)))
  })

  it('finishing yesterday’s daily board after midnight does not credit today’s streak', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-09T23:59:00Z'))
    easyLayout = ONE_STAR
    render(<GameRecoil storageKey={STORAGE_KEY} />)
    const board = await screen.findByTestId('recoil-board')
    vi.setSystemTime(new Date('2026-10-10T00:01:00Z'))
    playToWin(board)
    await screen.findByTestId('you-win')
    expect(localStorage.getItem('recoil:daily')).toBeNull()
  })

  it('best counts only the first attempt of a board — same-seed Retry never raises it', async () => {
    easyLayout = ONE_STAR
    render(<GameRecoil storageKey={STORAGE_KEY} />)
    const board = await screen.findByTestId('recoil-board')
    playToWin(board)
    await screen.findByTestId('you-win')
    const first = Number(localStorage.getItem(STORAGE_KEY))
    expect(first).toBeGreaterThan(0)
    // Make the record beatable, then win the same board again via Retry (R).
    localStorage.setItem(STORAGE_KEY, '1')
    fireEvent.keyDown(board, { key: 'r' })
    expect(screen.queryByTestId('you-win')).toBeNull()
    playToWin(board)
    await screen.findByTestId('you-win')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
    expect(screen.getByTestId('you-win')).toHaveTextContent("Replays of the same board don't count toward your best.")
  })

  it('recoil is not on the weekly leaderboard (difficulty/retry farming)', () => {
    expect(hasLeaderboard('recoil')).toBe(false)
  })
})
