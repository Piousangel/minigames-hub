import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { GameRecoil } from './GameRecoil'
import { challengeQuery } from '@/lib/challenge'
import { createGameForSeed, seedWithDifficulty } from '@/lib/games/recoil/engine'
import { sendHit } from '@/lib/hit'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

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

describe('GameRecoil', () => {
  beforeEach(() => {
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
})
