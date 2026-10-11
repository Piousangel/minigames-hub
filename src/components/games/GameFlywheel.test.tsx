import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameFlywheel } from './GameFlywheel'

const STORAGE_KEY = 'best:flywheel'

let rafQueue: FrameRequestCallback[] = []
let ts = 0

/** Run one animation frame `ms` after the previous one. */
function frame(ms = 50) {
  ts += ms
  const q = rafQueue
  rafQueue = []
  act(() => {
    for (const cb of q) cb(ts)
  })
}

function space() {
  fireEvent.keyDown(window, { key: ' ' })
}

/** Start a run and let it end with no taps (3 missed beats). */
function stallRun() {
  space() // idle → playing (starting tap doesn't grade)
  for (let i = 0; i < 400 && !screen.queryByTestId('game-over'); i++) frame()
}

describe('GameFlywheel', () => {
  beforeEach(() => {
    localStorage.clear()
    rafQueue = []
    ts = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("game over shows this run's peak, not the all-time best", () => {
    localStorage.setItem(STORAGE_KEY, '120')
    render(<GameFlywheel storageKey={STORAGE_KEY} />)
    frame(0)
    stallRun()
    const over = screen.getByTestId('game-over')
    expect(screen.getByTestId('flywheel-run-peak')).toHaveTextContent('Peak RPM: 40')
    expect(over).toHaveTextContent('Best: 120')
    expect(over).not.toHaveTextContent('New best!')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('120')
  })

  it('a first run that never sped up is not a "New best!"', () => {
    render(<GameFlywheel storageKey={STORAGE_KEY} />)
    frame(0)
    stallRun()
    expect(screen.getByTestId('game-over')).not.toHaveTextContent('New best!')
    expect(screen.getByTestId('flywheel-run-peak')).toHaveTextContent('Peak RPM: 40')
  })

  it('shows a visible verdict for an in-window tap and for a too-early whiff', () => {
    render(<GameFlywheel storageKey={STORAGE_KEY} />)
    frame(0)
    space() // start
    frame(0) // first playing frame (dt 0)
    // 40rpm → 1 turn = 1.5s; the zone center is at phase 1.0.
    for (let i = 0; i < 30; i++) frame(50)
    space()
    frame(1)
    const grade = screen.getByTestId('flywheel-grade')
    expect(grade).toHaveAttribute('data-grade', 'perfect')
    expect(grade).toHaveTextContent('PERFECT')

    // Next beat: tap way before its window opens → whiff.
    for (let i = 0; i < 6; i++) frame(50)
    space()
    frame(1)
    expect(screen.getByTestId('flywheel-grade')).toHaveTextContent('TOO EARLY')
  })
})
