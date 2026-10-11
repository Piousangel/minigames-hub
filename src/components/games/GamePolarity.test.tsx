import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { challengeQuery } from '@/lib/challenge'
import { createGame, reduce, type PolarityState } from '@/lib/games/polarity/engine'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

import { sendHit } from '@/lib/hit'
import { GamePolarity } from './GamePolarity'

const STORAGE_KEY = 'best:polarity'

/** Final state of an idle run (started, never flipped). */
function idleRun(seed: number): PolarityState {
  let s = reduce(createGame(seed), { type: 'start' })
  for (let i = 0; i < 20000 && s.status === 'running'; i++) s = reduce(s, { type: 'tick' })
  return s
}

/** An idle run that dies quickly; prefer one that scores (so the share button appears). */
function quickSeed(): { seed: number; score: number; ticks: number } {
  let pick = { seed: 1, score: 0, ticks: Infinity }
  for (let seed = 1; seed <= 60; seed++) {
    const s = idleRun(seed)
    if (s.status !== 'dead') continue
    const better = (s.score > 0 && pick.score === 0) || (s.score > 0 === pick.score > 0 && s.tick < pick.ticks)
    if (better) pick = { seed, score: s.score, ticks: s.tick }
  }
  return pick
}

function runUntilOver() {
  for (let i = 0; i < 4000; i++) {
    act(() => {
      vi.advanceTimersByTime(100)
    })
    if (screen.queryByTestId('game-over')) return
  }
}

const pinSeed = (seed: number) => {
  // freshSeed() = Date.now() ^ (Math.random() * 2^31)
  vi.setSystemTime(0)
  return vi.spyOn(Math, 'random').mockReturnValue(seed / 2 ** 31)
}

const FAKE = { toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'] } as const

describe('GamePolarity challenge links', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(sendHit).mockClear()
    vi.useFakeTimers({ toFake: [...FAKE.toFake] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('a ?vs= link shows the banner, replays the challenger seed and never writes best', () => {
    const { seed, score } = quickSeed()
    const target = score + 30
    window.history.replaceState(null, '', `/polarity?${challengeQuery({ seed, score: target, name: 'Ana' })}`)

    render(<GamePolarity storageKey={STORAGE_KEY} />)
    const banner = screen.getByTestId('challenge-banner')
    expect(banner).toHaveTextContent(`Ana scored ${target} on this exact run. Beat it!`)
    expect(banner).toHaveTextContent("Challenge runs don't count toward your best.")
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: ' ' }) // start (no flip)
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(screen.queryByTestId('challenge-leave')).not.toBeInTheDocument() // hidden mid-run
    runUntilOver()

    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(screen.getByTestId('score')).toHaveTextContent(String(score))
    expect(screen.getByTestId('challenge-result')).toHaveTextContent('30 short of')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(sendHit).toHaveBeenCalledWith('polarity', 'challenge-done')
    expect(sendHit).not.toHaveBeenCalledWith('polarity', 'challenge-sent')
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeInTheDocument()
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument()

    // Rematch replays the same seed: same idle run → same score.
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }))
    expect(screen.getByTestId('challenge-banner')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: ' ' })
    runUntilOver()
    expect(screen.getByTestId('score')).toHaveTextContent(String(score))
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('Play solo clears the challenge params and drops the banner', () => {
    window.history.replaceState(null, '', `/polarity?${challengeQuery({ seed: 9, score: 40, name: 'Bo' })}&x=1`)
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByTestId('challenge-leave'))
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    expect(window.location.search).toBe('?x=1')
  })

  it('a solo scoring run records best and does not send challenge-done', () => {
    const { seed, score } = quickSeed()
    expect(score).toBeGreaterThan(0)
    pinSeed(seed)
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: ' ' })
    runUntilOver()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBe(score)
    expect(sendHit).not.toHaveBeenCalledWith('polarity', 'challenge-done')
  })

  it('share counts challenge-sent only after a successful share', async () => {
    const { seed } = quickSeed()
    pinSeed(seed)
    const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: ' ' })
    runUntilOver()
    const share = screen.getByRole('button', { name: 'Challenge a friend' })
    await act(async () => {
      fireEvent.click(share)
    })
    expect(sendHit).not.toHaveBeenCalledWith('polarity', 'challenge-sent')
    await act(async () => {
      fireEvent.click(share)
    })
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(String(writeText.mock.calls[1][0])).toContain('/polarity?vs=')
    expect(sendHit).toHaveBeenCalledWith('polarity', 'challenge-sent')
  })
})

describe('GamePolarity keyboard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: [...FAKE.toFake] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms)
    })

  it('ignores ctrl/meta/alt shortcuts entirely', () => {
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    expect(fireEvent.keyDown(window, { key: ' ', ctrlKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'f', metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true })).toBe(true)
    // still on the ready card
    expect(screen.getByText('Tap or press Space to start')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: ' ' })
    advance(200)
    expect(screen.getByTestId('polarity-state')).toHaveAttribute('data-polarity', 'pull')
    // Cmd/Ctrl+R reaches the browser rather than restarting
    expect(fireEvent.keyDown(window, { key: 'r', metaKey: true })).toBe(true)
    expect(screen.queryByText('Tap or press Space to start')).not.toBeInTheDocument()
    // plain F flips
    expect(fireEvent.keyDown(window, { key: 'f' })).toBe(false)
    advance(50)
    expect(screen.getByTestId('polarity-state')).toHaveAttribute('data-polarity', 'push')
  })

  it('R restarts only outside a live run — a stray R mid-run (or while paused) is ignored', () => {
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    // ready: R is handled (restart → default prevented)
    expect(fireEvent.keyDown(window, { key: 'r' })).toBe(false)
    fireEvent.keyDown(window, { key: ' ' })
    advance(300)
    expect(screen.queryByText('Tap or press Space to start')).not.toBeInTheDocument()
    // mid-run: R is left alone and the run survives
    expect(fireEvent.keyDown(window, { key: 'r' })).toBe(true)
    advance(50)
    expect(screen.queryByText('Tap or press Space to start')).not.toBeInTheDocument()
    // paused (still a live run): R is still ignored
    fireEvent.keyDown(window, { key: 'p' })
    expect(fireEvent.keyDown(window, { key: 'r' })).toBe(true)
    expect(screen.getByTestId('pause-card')).toBeInTheDocument()
  })

  it('R after game over starts a new run', () => {
    const { seed } = quickSeed()
    pinSeed(seed)
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: ' ' })
    runUntilOver()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(fireEvent.keyDown(document.body, { key: 'r' })).toBe(false)
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
  })

  it('Space starts the run even when the header New Run button kept focus', () => {
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    const header = screen.getByRole('button', { name: 'New Run' })
    header.focus()
    expect(fireEvent.keyDown(header, { key: ' ' })).toBe(false) // swallowed, no native click
    expect(document.activeElement).not.toBe(header) // keyup can no longer click it
    expect(screen.queryByText('Tap or press Space to start')).not.toBeInTheDocument()
    advance(200)
    expect(screen.getByTestId('polarity-state')).toHaveAttribute('data-polarity', 'pull')
  })

  it('Space on the challenge banner button on the ready card stays with the button', () => {
    const { seed } = quickSeed()
    window.history.replaceState(null, '', `/polarity?${challengeQuery({ seed, score: 5, name: 'Bo' })}`)
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    const leave = screen.getByTestId('challenge-leave')
    leave.focus()
    expect(fireEvent.keyDown(leave, { key: ' ' })).toBe(true)
    expect(screen.getByText('Tap or press Space to start')).toBeInTheDocument()
  })

  it('Enter on the focused FLIP button flips; tap on the board flips', () => {
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    const flip = screen.getByRole('button', { name: 'Flip polarity' })
    flip.focus()
    fireEvent.keyDown(flip, { key: 'Enter' }) // starts
    advance(200)
    fireEvent.keyDown(flip, { key: 'Enter' })
    advance(50)
    expect(screen.getByTestId('polarity-state')).toHaveAttribute('data-polarity', 'push')
    advance(300) // past the cooldown
    fireEvent.pointerDown(screen.getByTestId('polarity-board'))
    advance(50)
    expect(screen.getByTestId('polarity-state')).toHaveAttribute('data-polarity', 'pull')
  })

  it('on the game-over screen Enter on overlay controls activates them, not the game', () => {
    const { seed } = quickSeed()
    pinSeed(seed)
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: ' ' })
    runUntilOver()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()

    const share = screen.getByRole('button', { name: 'Challenge a friend' })
    share.focus()
    expect(fireEvent.keyDown(share, { key: 'Enter' })).toBe(true) // not swallowed → native click
    const input = screen.getByRole('textbox', { name: 'Your name for the challenge link' })
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'r' })).toBe(true)
    expect(screen.getByTestId('game-over')).toBeInTheDocument()

    // Enter with focus on the page body starts a new run.
    expect(fireEvent.keyDown(document.body, { key: 'Enter' })).toBe(false)
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
  })

  it('after game over Space/arrows/flip keys are not swallowed (page can scroll)', () => {
    const { seed } = quickSeed()
    pinSeed(seed)
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: ' ' })
    runUntilOver()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    for (const key of [' ', 'ArrowUp', 'ArrowDown', 'f', 'j', 'k']) {
      expect(fireEvent.keyDown(document.body, { key })).toBe(true)
    }
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
  })

  it('the pause card is opaque and the flip preview is hidden while paused', () => {
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: ' ' })
    advance(300)
    expect(screen.getByTestId('polarity-preview')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'p' })
    const card = screen.getByTestId('pause-card')
    expect(card.className).toMatch(/(^|\s)bg-bg(\s|$)/) // no /55-style see-through alpha
    expect(screen.queryByTestId('polarity-preview')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'p' })
    expect(screen.getByTestId('polarity-preview')).toBeInTheDocument()
  })

  it('pause freezes the run and a tap resumes without flipping', () => {
    render(<GamePolarity storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: ' ' })
    advance(300)
    fireEvent.keyDown(window, { key: 'p' })
    const before = screen.getByText(/ m$/).textContent
    advance(3000)
    expect(screen.getByText(/ m$/).textContent).toBe(before)
    expect(screen.getByText('Paused')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: ' ' })
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
    advance(50)
    expect(screen.getByTestId('polarity-state')).toHaveAttribute('data-polarity', 'pull')
  })
})
