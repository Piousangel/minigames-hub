import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { challengeQuery } from '@/lib/challenge'
import { createGame, reduce } from '@/lib/games/lagline/engine'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

import { sendHit } from '@/lib/hit'
import { GameLagline } from './GameLagline'

const STORAGE_KEY = 'best:lagline'

/** Beats survived when nobody presses anything after starting (player stays in lane 3). */
function idleDeathBeat(seed: number): number {
  let s = reduce(createGame(seed), { type: 'start' })
  for (let i = 0; i < 400 && s.status === 'running'; i++) s = reduce(s, { type: 'tick' })
  return s.status === 'dead' ? s.beat : Infinity
}

/** A seed whose idle run dies early (but after the empty grace rows, so score > 0). */
function quickDeathSeed(): { seed: number; beat: number } {
  let pick = { seed: 1, beat: Infinity }
  for (let seed = 1; seed <= 200; seed++) {
    const beat = idleDeathBeat(seed)
    if (beat > 0 && beat < pick.beat) pick = { seed, beat }
  }
  return pick
}

/** Advance the rAF-driven beat clock far enough for an idle run to end. */
function runUntilOver() {
  for (let i = 0; i < 400; i++) {
    act(() => {
      vi.advanceTimersByTime(100)
    })
    if (screen.queryByTestId('game-over')) return
  }
}

describe('GameLagline challenge links', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(sendHit).mockClear()
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('a ?vs= link shows the banner, replays the challenger seed and never writes best', () => {
    const { seed, beat } = quickDeathSeed()
    window.history.replaceState(null, '', `/lagline?${challengeQuery({ seed, score: beat + 5, name: 'Ana' })}`)

    render(<GameLagline storageKey={STORAGE_KEY} />)
    const banner = screen.getByTestId('challenge-banner')
    expect(banner).toHaveTextContent(`Ana scored ${beat + 5} on this exact run. Beat it!`)
    expect(banner).toHaveTextContent("Challenge runs don't count toward your best.")
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowDown' }) // 'stay' — starts the run without moving
    expect(screen.queryByTestId('challenge-leave')).not.toBeInTheDocument() // hidden mid-run
    runUntilOver()

    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(screen.getByTestId('score')).toHaveTextContent(String(beat))
    expect(screen.getByTestId('challenge-result')).toHaveTextContent('5 short of')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(sendHit).toHaveBeenCalledWith('lagline', 'challenge-done')
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeInTheDocument()
  })

  it('Play solo clears the challenge params and drops the banner', () => {
    window.history.replaceState(null, '', `/lagline?${challengeQuery({ seed: 9, score: 40, name: 'Bo' })}&x=1`)
    render(<GameLagline storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByTestId('challenge-leave'))
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    expect(window.location.search).toBe('?x=1')
  })

  it('a solo run still records best', () => {
    // freshSeed() = Date.now() ^ (Math.random() * 2^31) — pin both so the run is a known quick death.
    const { seed } = quickDeathSeed()
    vi.setSystemTime(0)
    const rand = vi.spyOn(Math, 'random').mockReturnValue(seed / 2 ** 31)
    render(<GameLagline storageKey={STORAGE_KEY} />)
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    runUntilOver()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBeGreaterThan(0)
    expect(sendHit).not.toHaveBeenCalledWith('lagline', 'challenge-done')
    rand.mockRestore()
  })
})
