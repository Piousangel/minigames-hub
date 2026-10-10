import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { challengeQuery } from '@/lib/challenge'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

import { sendHit } from '@/lib/hit'
import { GameSlosh } from './GameSlosh'

const STORAGE_KEY = 'best:slosh'
const SEED = 42

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

/** Metres to the next station, read off the "Next: STOP · 12.3 m" label. */
function nextStopMetres(): number {
  const m = /([\d.]+) m$/.exec(screen.getByTestId('next-stop').textContent ?? '')
  return m ? Number(m[1]) : Infinity
}

/**
 * Plays a short real run through the UI: full gas, brake hard ~1.8 m before the
 * first station so it docks (score > 0), then floor it past everything until the
 * terminal bumper ends the run (overrun).
 */
function dockFirstThenOverrun() {
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  let braking = false
  for (let i = 0; i < 400 && !braking; i++) {
    advance(20)
    if (nextStopMetres() <= 1.9) {
      fireEvent.keyUp(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
      braking = true
    }
  }
  for (let i = 0; i < 400 && screen.getAllByTestId('station-pip')[0].dataset.status === 'next'; i++) advance(20)
  expect(screen.getAllByTestId('station-pip')[0].dataset.status).toMatch(/docked|calm/)
  fireEvent.keyUp(window, { key: 'ArrowLeft' })
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  for (let i = 0; i < 3000 && !screen.queryByTestId('game-over'); i++) advance(20)
  fireEvent.keyUp(window, { key: 'ArrowRight' })
}

describe('GameSlosh challenge links', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(sendHit).mockClear()
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('a ?vs= link shows the banner, replays the challenger seed and never writes best', () => {
    window.history.replaceState(null, '', `/slosh?${challengeQuery({ seed: SEED, score: 9000, name: 'Ana' })}`)
    render(<GameSlosh storageKey={STORAGE_KEY} />)
    const banner = screen.getByTestId('challenge-banner')
    expect(banner).toHaveTextContent('Ana scored 9000 on this exact run. Beat it!')
    expect(banner).toHaveTextContent("Challenge runs don't count toward your best.")
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.queryByTestId('challenge-leave')).not.toBeInTheDocument() // hidden mid-run
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    // the first ArrowRight already started; dockFirstThenOverrun presses it again (harmless)
    dockFirstThenOverrun()

    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(screen.getByTestId('game-over')).toHaveTextContent('Ana kept it steadier')
    expect(screen.getByTestId('challenge-result')).toHaveTextContent('short of 9000')
    expect(Number(screen.getByTestId('score').textContent)).toBeGreaterThan(0)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(screen.queryByTestId('new-best')).not.toBeInTheDocument()
    expect(sendHit).toHaveBeenCalledWith('slosh', 'challenge-done')
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument() // back once the run is over

    // Rematch replays the same rails (same seed → same station layout).
    const pipsBefore = screen.getAllByTestId('station-pip').map((p) => p.textContent).join('')
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }))
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('station-pip').map((p) => p.textContent).join('')).toBe(pipsBefore)
    expect(screen.getByTestId('challenge-banner')).toBeInTheDocument()
  })

  it('the challenge seed fixes the whole run (stations, distances) on every mount', () => {
    const layout = () =>
      screen.getAllByTestId('station-pip').map((p) => p.textContent).join('') + '|' + nextStopMetres()
    window.history.replaceState(null, '', `/slosh?${challengeQuery({ seed: SEED, score: 9000, name: 'Ana' })}`)
    const first = render(<GameSlosh storageKey={STORAGE_KEY} />)
    const a = layout()
    first.unmount()
    render(<GameSlosh storageKey={STORAGE_KEY} />)
    expect(layout()).toBe(a)
    fireEvent.keyDown(window, { key: 'r' }) // every restart stays on the challenger's seed
    expect(layout()).toBe(a)
  })

  it('Play solo clears the challenge params and drops the banner', () => {
    window.history.replaceState(null, '', `/slosh?${challengeQuery({ seed: 9, score: 40, name: 'Bo' })}&x=1`)
    render(<GameSlosh storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByTestId('challenge-leave'))
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    expect(window.location.search).toBe('?x=1')
  })

  it('a solo run still records best and offers a share link', () => {
    vi.setSystemTime(0)
    vi.spyOn(Math, 'random').mockReturnValue(SEED / 2 ** 31)
    render(<GameSlosh storageKey={STORAGE_KEY} />)
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    dockFirstThenOverrun()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBeGreaterThan(0)
    expect(screen.getByTestId('new-best')).toBeInTheDocument()
    expect(sendHit).not.toHaveBeenCalledWith('slosh', 'challenge-done')
    expect(screen.getByRole('button', { name: 'Challenge a friend' })).toBeInTheDocument()
  })
})

describe('GameSlosh keyboard & pause', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('the hint states the core rules (controls, spill = water loss, zones, time, END bumper)', () => {
    render(<GameSlosh storageKey={STORAGE_KEY} />)
    const hint = screen.getByText(/Hold GAS/, { selector: 'p.text-fg-muted' }).textContent ?? ''
    for (const s of ['BRAKE', 'over the rim', 'empty glass ends the run', 'glowing zone', 'time bar', 'END', 'P pauses'])
      expect(hint).toContain(s)
  })

  it('touch: holding the GAS button rolls the cart; releasing coasts; BRAKE wins', () => {
    render(<GameSlosh storageKey={STORAGE_KEY} />)
    const gas = screen.getByTestId('slosh-gas')
    const brake = screen.getByTestId('slosh-brake')
    const start = nextStopMetres()
    fireEvent.pointerDown(gas, { pointerId: 1 })
    expect(gas).toHaveAttribute('aria-pressed', 'true')
    advance(400)
    expect(nextStopMetres()).toBeLessThan(start)
    fireEvent.pointerDown(brake, { pointerId: 2 })
    expect(brake).toHaveAttribute('aria-pressed', 'true')
    advance(2000) // brake wins over held gas -> cart stops
    const stopped = nextStopMetres()
    advance(400)
    expect(nextStopMetres()).toBe(stopped)
    fireEvent.pointerUp(brake, { pointerId: 2 })
    fireEvent.pointerUp(gas, { pointerId: 1 })
    expect(gas).toHaveAttribute('aria-pressed', 'false')
  })

  it('ignores ctrl/meta/alt shortcuts (reload, bookmark, save)', () => {
    render(<GameSlosh storageKey={STORAGE_KEY} />)
    expect(fireEvent.keyDown(window, { key: 'd', metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true })).toBe(true)
    advance(400)
    expect(nextStopMetres()).toBeGreaterThan(9) // never started rolling (legs are >= 10 m)
    const before = nextStopMetres()
    fireEvent.keyDown(window, { key: 'd' })
    advance(400)
    expect(nextStopMetres()).toBeLessThan(before)
    const rolling = nextStopMetres()
    // Cmd/Ctrl+R must reach the browser, not restart the run.
    expect(fireEvent.keyDown(window, { key: 'r', metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'r', ctrlKey: true })).toBe(true)
    expect(nextStopMetres()).toBe(rolling)
  })

  it('pause freezes the cart; a GAS press while paused only resumes', () => {
    render(<GameSlosh storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    advance(600)
    fireEvent.keyDown(window, { key: 'p' })
    const frozen = nextStopMetres()
    advance(2000)
    expect(nextStopMetres()).toBe(frozen)
    expect(screen.getByText(/Paused/)).toBeInTheDocument()
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.queryByText(/Paused/)).not.toBeInTheDocument()
  })

  it('while paused, Space on a focused shell button (New Game) resumes the run instead of activating the button', () => {
    render(<GameSlosh storageKey={STORAGE_KEY} />)
    // A shell control outside the game (e.g. GameShell's New Game), focused by a mouse click.
    const shellBtn = document.createElement('button')
    shellBtn.textContent = 'New Game'
    document.body.appendChild(shellBtn)
    try {
      shellBtn.focus()
      fireEvent.keyDown(shellBtn, { key: 'ArrowRight' })
      advance(600)
      fireEvent.keyUp(shellBtn, { key: 'ArrowRight' })
      fireEvent.keyDown(shellBtn, { key: 'p' })
      expect(screen.getByText(/Paused/)).toBeInTheDocument()
      const travelled = nextStopMetres()
      // Space is a BRAKE key: it must be consumed (no button activation) and only resume.
      expect(fireEvent.keyDown(shellBtn, { key: ' ' })).toBe(false)
      expect(screen.queryByText(/Paused/)).not.toBeInTheDocument()
      expect(nextStopMetres()).toBe(travelled) // same run, not restarted
    } finally {
      shellBtn.remove()
    }
  })

  it('on the game-over screen Enter on an overlay button activates the button, not a restart', () => {
    vi.setSystemTime(0)
    vi.spyOn(Math, 'random').mockReturnValue(SEED / 2 ** 31)
    render(<GameSlosh storageKey={STORAGE_KEY} />)
    dockFirstThenOverrun()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()

    const share = screen.getByRole('button', { name: 'Challenge a friend' })
    share.focus()
    expect(fireEvent.keyDown(share, { key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(share, { key: ' ' })).toBe(true)
    const input = screen.getByRole('textbox', { name: 'Your name for the challenge link' })
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'r' })).toBe(true) // typing a name, not restarting
    expect(screen.getByTestId('game-over')).toBeInTheDocument()

    expect(fireEvent.keyDown(document.body, { key: 'Enter' })).toBe(false)
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
  })
})
