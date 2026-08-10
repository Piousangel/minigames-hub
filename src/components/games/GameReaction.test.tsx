import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameReaction } from './GameReaction'
import { statsKey } from '@/lib/gameStats'
import { MIN_DELAY } from '@/lib/games/reaction/engine'

const STORAGE_KEY = 'best:reaction-time'

describe('GameReaction', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0) // delayMs = MIN_DELAY, deterministic
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function playOneRound(reactionMs: number) {
    const pad = screen.getByTestId('reaction-pad')
    fireEvent.click(pad) // idle -> waiting
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    act(() => {
      vi.advanceTimersByTime(MIN_DELAY) // waiting -> ready (green)
    })
    now = 1000 + reactionMs
    fireEvent.click(pad) // ready -> result
  }

  it('records a new best, persists it, and shows the New best overlay on the first attempt', () => {
    render(<GameReaction storageKey={STORAGE_KEY} />)
    playOneRound(180)

    expect(screen.getByTestId('reaction-ms')).toHaveTextContent('180 ms')
    expect(screen.getByTestId('new-best')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('180')

    const stats = JSON.parse(localStorage.getItem(statsKey('reaction-time')) ?? '{}')
    expect(stats).toEqual({ plays: 1, wins: 1 })
  })

  it('does not re-show New best on a slower second attempt, but still records the play', () => {
    localStorage.setItem(STORAGE_KEY, '150')
    render(<GameReaction storageKey={STORAGE_KEY} />)
    playOneRound(220)

    expect(screen.getByTestId('reaction-ms')).toHaveTextContent('220 ms')
    expect(screen.queryByTestId('new-best')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('150') // unchanged — 220ms didn't beat 150ms

    const stats = JSON.parse(localStorage.getItem(statsKey('reaction-time')) ?? '{}')
    expect(stats).toEqual({ plays: 1, wins: 1 }) // recordResult still fires on a non-best round
  })

  it('clicking during the waiting (red) phase fails the attempt as "too soon" without recording a result', () => {
    render(<GameReaction storageKey={STORAGE_KEY} />)
    const pad = screen.getByTestId('reaction-pad')
    fireEvent.click(pad) // idle -> waiting
    fireEvent.click(pad) // waiting -> early (clicked before green)

    expect(screen.getByText('Too soon!')).toBeInTheDocument()
    expect(localStorage.getItem(statsKey('reaction-time'))).toBeNull()
  })
})
