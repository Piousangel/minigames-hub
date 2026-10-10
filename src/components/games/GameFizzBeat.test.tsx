import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { challengeQuery, parseChallenge } from '@/lib/challenge'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

import { sendHit } from '@/lib/hit'
import { GameFizzBeat } from './GameFizzBeat'

const STORAGE_KEY = 'best:fizzbeat'
/**
 * Phase 0 is seed-independent (3/5, count +1 from 1). Idling scores the rests on 1, 2, 4
 * (3 × 10 = 30) and loses all three lives on 3, 5 and 6.
 */
const IDLE_SCORE = 30

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

function runUntilOver() {
  for (let i = 0; i < 200; i++) {
    advance(100)
    if (screen.queryByTestId('game-over')) return
  }
}

function start() {
  fireEvent.keyDown(window, { code: 'Space', key: ' ' })
}

describe('GameFizzBeat challenge links', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(sendHit).mockClear()
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('a ?vs= link shows the banner, replays the challenger seed and never writes best', async () => {
    window.history.replaceState(null, '', `/fizzbeat?${challengeQuery({ seed: 4242, score: 50, name: 'Ana' })}`)
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)

    const banner = screen.getByTestId('challenge-banner')
    expect(banner).toHaveTextContent('Ana scored 50 on this exact run. Beat it!')
    expect(banner).toHaveTextContent("Challenge runs don't count toward your best.")
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument()

    start()
    expect(screen.queryByTestId('challenge-leave')).not.toBeInTheDocument() // hidden mid-run
    runUntilOver()

    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(screen.getByTestId('score')).toHaveTextContent(String(IDLE_SCORE))
    expect(screen.getByTestId('challenge-result')).toHaveTextContent('20 short of 50 (60%)')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(sendHit).toHaveBeenCalledWith('fizzbeat', 'challenge-done')
    expect(sendHit).not.toHaveBeenCalledWith('fizzbeat', 'challenge-sent')
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument() // back after the run

    // Sharing re-uses the challenger's seed, and challenge-sent fires only after success.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    fireEvent.change(screen.getByRole('textbox', { name: 'Your name for the challenge link' }), {
      target: { value: 'Bo' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }))
    })
    expect(writeText).toHaveBeenCalledTimes(1)
    const shared = String(writeText.mock.calls[0][0])
    const query = new URL(shared.slice(shared.indexOf('http'))).search
    expect(parseChallenge(query)).toEqual({ seed: 4242, score: IDLE_SCORE, name: 'Bo' })
    expect(sendHit).toHaveBeenCalledWith('fizzbeat', 'challenge-sent')
    expect(screen.getByRole('button', { name: 'Link copied!' })).toBeInTheDocument()

    // Rematch keeps the challenge (banner stays) and still never writes best.
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }))
    expect(screen.getByTestId('challenge-banner')).toBeInTheDocument()
    start()
    runUntilOver()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('a failed share does not send challenge-sent', async () => {
    window.history.replaceState(null, '', `/fizzbeat?${challengeQuery({ seed: 7, score: 900, name: 'Cy' })}`)
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    start()
    runUntilOver()
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }))
    })
    expect(sendHit).not.toHaveBeenCalledWith('fizzbeat', 'challenge-sent')
  })

  it('Play solo clears the challenge params and drops the banner', () => {
    window.history.replaceState(null, '', `/fizzbeat?${challengeQuery({ seed: 9, score: 40, name: 'Bo' })}&x=1`)
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByTestId('challenge-leave'))
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    expect(window.location.search).toBe('?x=1')
  })

  it('a solo run records best, and only improves it', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    start()
    runUntilOver()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(IDLE_SCORE))
    expect(screen.getByTestId('best')).toHaveTextContent(String(IDLE_SCORE))
    expect(sendHit).not.toHaveBeenCalledWith('fizzbeat', 'challenge-done')
  })
})

describe('GameFizzBeat input & pause', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('ignores ctrl/meta/alt combos: Ctrl+Space does not start, Cmd+Arrow is not a press', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    expect(fireEvent.keyDown(window, { code: 'Space', key: ' ', ctrlKey: true })).toBe(true)
    expect(screen.getByTestId('fizzbeat-board')).toHaveAttribute('data-status', 'ready')
    start()
    expect(screen.getByTestId('fizzbeat-board')).toHaveAttribute('data-status', 'running')
    // reach beat 1 (value 1 is a rest) — a modified key must not be judged as a press
    advance(2700)
    expect(fireEvent.keyDown(window, { code: 'ArrowLeft', key: 'ArrowLeft', metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { code: 'KeyF', key: 'f', altKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { code: 'KeyR', key: 'r', ctrlKey: true })).toBe(true)
    advance(400)
    expect(screen.getByTestId('judgment')).toHaveTextContent('rest')
    expect(screen.getByTestId('lives')).toHaveAttribute('aria-label', 'Lives: 3')
  })

  it('P pauses (opaque card, clock frozen) and Space resumes', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    start()
    advance(1000)
    fireEvent.keyDown(window, { code: 'KeyP', key: 'p' })
    expect(screen.getByTestId('paused')).toBeInTheDocument()
    advance(20_000) // would be long past game over if the clock kept running
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
    expect(screen.getByTestId('lives')).toHaveAttribute('aria-label', 'Lives: 3')
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(screen.queryByTestId('paused')).not.toBeInTheDocument()
    runUntilOver()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
  })

  it('hiding the tab pauses; the Resume button continues the run', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    start()
    advance(500)
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    vis.mockRestore()
    expect(screen.getByTestId('paused')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('fizzbeat-resume'))
    expect(screen.queryByTestId('paused')).not.toBeInTheDocument()
  })

  it('on the game-over screen Enter/Space on overlay controls are not swallowed by the game', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    start()
    runUntilOver()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    const again = screen.getByRole('button', { name: 'Try again' })
    again.focus()
    expect(fireEvent.keyDown(again, { code: 'Enter', key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(again, { code: 'Space', key: ' ' })).toBe(true)
    const input = screen.getByRole('textbox', { name: 'Your name for the challenge link' })
    expect(fireEvent.keyDown(input, { code: 'KeyF', key: 'f' })).toBe(true) // typing a name
    expect(fireEvent.keyDown(input, { code: 'Space', key: ' ' })).toBe(true)
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    fireEvent.click(again)
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
    expect(screen.getByTestId('fizzbeat-board')).toHaveAttribute('data-status', 'ready')
  })

  it('Space mid-run is swallowed (no page scroll) and does not pause or restart the run', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    start()
    advance(1000)
    expect(fireEvent.keyDown(window, { code: 'Space', key: ' ' })).toBe(false)
    expect(screen.getByTestId('fizzbeat-board')).toHaveAttribute('data-status', 'running')
    expect(screen.queryByTestId('paused')).not.toBeInTheDocument()
    // Even with the header button focused, Space must not fall through and click "New Game".
    const header = screen.getByRole('button', { name: 'New Game' })
    header.focus()
    expect(fireEvent.keyDown(header, { code: 'Space', key: ' ' })).toBe(false)
    expect(document.activeElement).not.toBe(header)
    expect(screen.getByTestId('fizzbeat-board')).toHaveAttribute('data-status', 'running')
  })

  it('Space starts the run even when the header button kept focus after a mouse click', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    start()
    runUntilOver()
    const header = screen.getByRole('button', { name: 'Play again' })
    header.focus()
    fireEvent.click(header)
    expect(screen.getByTestId('fizzbeat-board')).toHaveAttribute('data-status', 'ready')
    const focused = screen.getByRole('button', { name: 'New Game' })
    expect(fireEvent.keyDown(focused, { code: 'Space', key: ' ' })).toBe(false)
    expect(document.activeElement).not.toBe(focused) // the keyup can no longer click it
    expect(screen.getByTestId('fizzbeat-board')).toHaveAttribute('data-status', 'running')
  })

  it('Space on the challenge banner "Play solo" button stays with the button', () => {
    window.history.replaceState(null, '', `/fizzbeat?${challengeQuery({ seed: 9, score: 40, name: 'Bo' })}`)
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    const leave = screen.getByTestId('challenge-leave')
    leave.focus()
    expect(fireEvent.keyDown(leave, { code: 'Space', key: ' ' })).toBe(true)
    expect(screen.getByTestId('fizzbeat-board')).toHaveAttribute('data-status', 'ready')
  })

  it('the hint states the core rules: count-in, both sides, silence, lives, rule changes', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    const hint = screen.getByText(/count-in clicks/)
    for (const part of ['multiple of 3 → LEFT', 'multiple of 5 → RIGHT', 'both at once', 'stay silent', '3 lives', 'count down']) {
      expect(hint).toHaveTextContent(part)
    }
  })

  it('every finished run (solo or challenge) counts one play in stats:fizzbeat, never a win', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    start()
    runUntilOver()
    expect(JSON.parse(localStorage.getItem('stats:fizzbeat') ?? '{}')).toMatchObject({ plays: 1, wins: 0 })
    expect(screen.getByTestId('game-over')).toHaveTextContent('Lost the count')
  })

  it('hiding the tab before the next window opens costs nothing: the count-in replaces that number', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    start()
    // "3" replaces "2" once beat 2's window closes (tick 343) — before its own window opens at 384.
    advance(3600)
    expect(screen.getByTestId('beat-number')).toHaveTextContent('3')
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    vis.mockRestore()
    expect(screen.getByTestId('paused')).toBeInTheDocument()
    advance(60_000)
    fireEvent.click(screen.getByTestId('fizzbeat-resume'))
    // nothing judged: neither "3" (window not open) nor anything after it
    expect(screen.getByTestId('lives')).toHaveAttribute('aria-label', 'Lives: 3')
    expect(screen.queryByText(/✗ 3/)).not.toBeInTheDocument()
    expect(screen.getByTestId('count-in')).toBeInTheDocument()
    expect(screen.queryByTestId('beat-number')).not.toBeInTheDocument()
    // after the fresh count-in "3" is played normally and can be hit
    advance(2640)
    fireEvent.pointerDown(screen.getByTestId('pad-left'))
    advance(300)
    expect(screen.getByTestId('judgment')).toHaveTextContent('✓ 3')
    expect(screen.getByTestId('lives')).toHaveAttribute('aria-label', 'Lives: 3')
  })

  it('pausing (P) inside a number\'s window forfeits it: resume cannot be used to think, then hit', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    start()
    advance(3900) // "3" window is [3840, 4080] ms
    fireEvent.keyDown(window, { code: 'KeyP', key: 'p' })
    advance(60_000) // all the time in the world to work out "3 → LEFT"
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(screen.getByTestId('judgment')).toHaveTextContent('✗ 3 wanted L')
    expect(screen.getByTestId('lives')).toHaveAttribute('aria-label', 'Lives: 2')
    // a fresh count-in plays before the next beat ("4")
    expect(screen.getByTestId('count-in')).toBeInTheDocument()
    expect(screen.queryByTestId('beat-number')).not.toBeInTheDocument()
    // tapping LEFT right away is not a late hit on "3"
    fireEvent.pointerDown(screen.getByTestId('pad-left'))
    advance(300)
    expect(screen.getByTestId('judgment')).not.toHaveTextContent('✓ 3')
    expect(screen.getByTestId('lives')).toHaveAttribute('aria-label', 'Lives: 2')
    advance(2400)
    expect(screen.getByTestId('beat-number')).toHaveTextContent('4')
  })

  it('pausing during the count-in costs nothing and restarts the count-in', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    start()
    advance(1500)
    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' })
    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' })
    expect(screen.getByTestId('count-in')).toBeInTheDocument()
    expect(screen.getByTestId('lives')).toHaveAttribute('aria-label', 'Lives: 3')
    advance(2000) // 2.6 s count-in from the resume: still counting in
    expect(screen.getByTestId('count-in')).toBeInTheDocument()
  })

  it('a pad tap on a multiple of 3 is judged a hit', () => {
    render(<GameFizzBeat storageKey={STORAGE_KEY} />)
    start()
    // beat value 3 is centred on tick (4 + 2) * 66 = 396 → 3960 ms
    advance(3960)
    fireEvent.pointerDown(screen.getByTestId('pad-left'))
    advance(300)
    expect(screen.getByTestId('judgment')).toHaveTextContent('✓ 3')
    expect(screen.getByTestId('lives')).toHaveAttribute('aria-label', 'Lives: 3')
  })
})
