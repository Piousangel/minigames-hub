import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { challengeQuery } from '@/lib/challenge'
import { beatMs } from '@/lib/games/siteswap/engine'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

import { sendHit } from '@/lib/hit'
import { GameSiteswap } from './GameSiteswap'

const STORAGE_KEY = 'best:siteswap'

// Toss "2" on the opening beat, then never toss again: beat 1 is survived with 2 balls
// (score 2), the caught ball is still held when beat 2 ends → "Dropped it!" with score 2.
// Holds for every seed: birds start at beat 8 and the first new ball at beat 16.
const QUICK_SCORE = 2

function runUntilOver() {
  for (let i = 0; i < 200; i++) {
    act(() => {
      vi.advanceTimersByTime(100)
    })
    if (screen.queryByTestId('game-over')) return
  }
}

describe('GameSiteswap challenge links', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(sendHit).mockClear()
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('a ?vs= link shows the banner, hides Play solo mid-run and never writes best', () => {
    window.history.replaceState(null, '', `/siteswap?${challengeQuery({ seed: 1234, score: QUICK_SCORE + 5, name: 'Ana' })}`)
    render(<GameSiteswap storageKey={STORAGE_KEY} />)
    const banner = screen.getByTestId('challenge-banner')
    expect(banner).toHaveTextContent(`Ana scored ${QUICK_SCORE + 5} on this exact run. Beat it!`)
    expect(banner).toHaveTextContent("Challenge runs don't count toward your best.")
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '2' })
    expect(screen.queryByTestId('challenge-leave')).not.toBeInTheDocument()
    runUntilOver()

    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(screen.getByTestId('score')).toHaveTextContent(String(QUICK_SCORE))
    expect(screen.getByTestId('challenge-result')).toHaveTextContent('5 short of')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(screen.getByTestId('best')).toHaveTextContent('0')
    expect(sendHit).toHaveBeenCalledWith('siteswap', 'challenge-done')
    expect(sendHit).not.toHaveBeenCalledWith('siteswap', 'challenge-sent')
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeInTheDocument()
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument()
  })

  it('every restart replays the challenger seed', () => {
    window.history.replaceState(null, '', `/siteswap?${challengeQuery({ seed: 77, score: 50, name: 'Bo' })}`)
    render(<GameSiteswap storageKey={STORAGE_KEY} />)
    const seedOf = () => screen.getByTestId('siteswap-board').getAttribute('data-seed')
    expect(seedOf()).toBe('77')
    fireEvent.keyDown(window, { key: 'r' })
    expect(seedOf()).toBe('77')
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
    expect(seedOf()).toBe('77')
    fireEvent.keyDown(window, { key: '2' })
    runUntilOver()
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }))
    expect(seedOf()).toBe('77')
    expect(screen.getByTestId('challenge-banner')).toBeInTheDocument()
  })

  it('a solo restart rolls a fresh seed', () => {
    let r = 0
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => (r = (r + 0.37) % 1))
    try {
      render(<GameSiteswap storageKey={STORAGE_KEY} />)
      const seedOf = () => screen.getByTestId('siteswap-board').getAttribute('data-seed')
      const seeds = [seedOf()]
      fireEvent.keyDown(window, { key: 'r' })
      seeds.push(seedOf())
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
      seeds.push(seedOf())
      expect(seeds.every((s) => s !== null)).toBe(true)
      expect(new Set(seeds).size).toBe(3)
    } finally {
      spy.mockRestore()
    }
  })

  it('Play solo clears the challenge params and drops the banner', () => {
    window.history.replaceState(null, '', `/siteswap?${challengeQuery({ seed: 9, score: 40, name: 'Bo' })}&x=1`)
    render(<GameSiteswap storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByTestId('challenge-leave'))
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    expect(window.location.search).toBe('?x=1')
  })

  it('a solo run records best and does not send challenge-done', () => {
    render(<GameSiteswap storageKey={STORAGE_KEY} />)
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: '2' })
    runUntilOver()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(QUICK_SCORE))
    expect(screen.getByTestId('best')).toHaveTextContent(String(QUICK_SCORE))
    expect(sendHit).not.toHaveBeenCalledWith('siteswap', 'challenge-done')
  })
})

describe('GameSiteswap input', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('ignores ctrl/meta/alt combos', () => {
    render(<GameSiteswap storageKey={STORAGE_KEY} />)
    expect(fireEvent.keyDown(window, { key: '2', ctrlKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: '2', metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: '2', altKey: true })).toBe(true)
    expect(screen.getByTestId('pattern')).toHaveTextContent('Your siteswap: —')
    expect(fireEvent.keyDown(window, { key: '2' })).toBe(false)
    expect(screen.getByTestId('pattern')).toHaveTextContent('Your siteswap: 2')
  })

  it('touch buttons toss on pointer-down, and a keyboard-activated button tosses too', () => {
    render(<GameSiteswap storageKey={STORAGE_KEY} />)
    fireEvent.pointerDown(screen.getByTestId('toss-2'))
    expect(screen.getByTestId('pattern')).toHaveTextContent('Your siteswap: 2')
    // A mouse click after the pointer-down must not toss a second time.
    fireEvent.click(screen.getByTestId('toss-2'), { detail: 1 })
    expect(screen.getByTestId('pattern')).toHaveTextContent('Your siteswap: 2')
    act(() => {
      vi.advanceTimersByTime(1000) // beat 1: the second ball lands in the hand
    })
    fireEvent.click(screen.getByTestId('toss-2'), { detail: 0 }) // Enter/Space on a focused button
    expect(screen.getByTestId('pattern')).toHaveTextContent('Your siteswap: 2 2')
  })

  it('on the game-over screen Enter on an overlay button activates it instead of restarting', () => {
    render(<GameSiteswap storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: '2' })
    runUntilOver()
    const share = screen.getByRole('button', { name: 'Challenge a friend' })
    share.focus()
    expect(fireEvent.keyDown(share, { key: 'Enter' })).toBe(true)
    const input = screen.getByRole('textbox', { name: 'Your name for the challenge link' })
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true)
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    // Enter with focus elsewhere restarts.
    ;(document.activeElement as HTMLElement | null)?.blur()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
  })

  it('pausing freezes the score and does not refill the beat', () => {
    render(<GameSiteswap storageKey={STORAGE_KEY} />)
    const beat = beatMs(0)
    fireEvent.keyDown(window, { key: '2' })
    act(() => {
      vi.advanceTimersByTime(beat - 100) // most of the first beat already spent
    })
    expect(screen.getByTestId('beats')).toHaveTextContent('0')
    fireEvent.keyDown(window, { key: 'p' })
    expect(screen.getByTestId('pause-card')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByTestId('beats')).toHaveTextContent('0')
    fireEvent.keyDown(window, { key: 'p' })
    expect(screen.queryByTestId('pause-card')).not.toBeInTheDocument()
    // The beat resumes where it left off: it ends ~100ms later, not a full beat later.
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(screen.getByTestId('beats')).toHaveTextContent('1')
  })
})
