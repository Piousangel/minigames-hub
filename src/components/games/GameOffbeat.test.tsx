import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameOffbeat } from './GameOffbeat'
import { statsKey } from '@/lib/gameStats'
import { START_GAP } from '@/lib/games/offbeat/engine'

const STORAGE_KEY = 'best:offbeat'

// Manual rAF driver: callbacks receive a controlled timestamp so frame rate is explicit.
let queue: FrameRequestCallback[] = []
let now = 0
let nextId = 1

function runFrames(durationMs: number, hz: number) {
  const dt = 1000 / hz
  const frames = Math.round(durationMs / dt)
  for (let i = 0; i < frames; i++) {
    now += dt
    const cbs = queue
    queue = []
    act(() => {
      for (const cb of cbs) cb(now)
    })
  }
}

function lives(): string {
  return screen.getByTestId('lives').getAttribute('aria-label') ?? ''
}

function plays(): number {
  const raw = localStorage.getItem(statsKey('offbeat'))
  return raw ? (JSON.parse(raw) as { plays: number }).plays : 0
}

describe('GameOffbeat', () => {
  beforeEach(() => {
    localStorage.clear()
    queue = []
    now = 1000
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queue.push(cb)
      return nextId++
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      queue = []
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('waits for the first tap instead of auto-starting (no idle game over, no stats)', async () => {
    render(<GameOffbeat storageKey={STORAGE_KEY} />)
    await screen.findByTestId('pulse-ring')
    expect(screen.getByText('Tap to start')).toBeInTheDocument()
    runFrames(5000, 60) // idle 5s — the old build was over in ~3.5s
    expect(lives()).toBe('Lives: 3')
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
    expect(plays()).toBe(0)
  })

  it('the starting tap is not judged and begins the run', async () => {
    render(<GameOffbeat storageKey={STORAGE_KEY} />)
    const ring = await screen.findByTestId('pulse-ring')
    fireEvent.pointerDown(ring)
    expect(lives()).toBe('Lives: 3') // a tick-0 tap would be an 'onbeat' fail if judged
    expect(screen.queryByText('Tap to start')).not.toBeInTheDocument()
    // untouched pulses now cost lives
    runFrames(5000, 60)
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(plays()).toBe(1)
  })

  it('runs at a fixed 60 ticks/s regardless of display refresh rate (120Hz)', async () => {
    render(<GameOffbeat storageKey={STORAGE_KEY} />)
    const ring = await screen.findByTestId('pulse-ring')
    fireEvent.pointerDown(ring)
    const firstPulseMs = (START_GAP / 60) * 1000 // 800ms at 60 ticks/s
    // At 120Hz a per-frame step would reach the first pulse (and miss) at 400ms.
    runFrames(firstPulseMs * 0.75, 120)
    expect(lives()).toBe('Lives: 3')
    runFrames(firstPulseMs * 0.35, 120)
    expect(lives()).toBe('Lives: 2')
  })

  it('Play again returns to the ready state', async () => {
    render(<GameOffbeat storageKey={STORAGE_KEY} />)
    const ring = await screen.findByTestId('pulse-ring')
    fireEvent.pointerDown(ring)
    runFrames(5000, 60)
    fireEvent.click(screen.getAllByRole('button', { name: 'Play again' })[0])
    expect(screen.getByText('Tap to start')).toBeInTheDocument()
    runFrames(5000, 60)
    expect(lives()).toBe('Lives: 3')
    expect(plays()).toBe(1)
  })
})
