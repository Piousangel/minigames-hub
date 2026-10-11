import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameBankshot, AIM_HANDLE_R, pathIndexFor } from './GameBankshot'
import {
  BALL_R,
  DAILY_CONFIG,
  FP,
  LAUNCH_POINT,
  createGame,
  reduce,
  shotLimit,
} from '@/lib/games/bankshot/engine'

const STORAGE_KEY = 'best:bankshot'

// Same formula as the component's local dailySeed().
function todaySeed(): number {
  const d = new Date()
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

describe('pathIndexFor (audit: displayPath[-1] crash)', () => {
  it('never returns a negative or out-of-range index', () => {
    expect(pathIndexFor(-0.01, 50)).toBe(0)
    expect(pathIndexFor(-5, 50)).toBe(0)
    expect(pathIndexFor(0.5, 50)).toBe(24)
    expect(pathIndexFor(1, 50)).toBe(49)
    expect(pathIndexFor(3, 50)).toBe(49)
    expect(pathIndexFor(Number.NaN, 50)).toBe(49)
    expect(pathIndexFor(0.3, 1)).toBe(0)
  })
})

describe('GameBankshot — audit 2026-10-10', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not crash when the rAF timestamp predates the effect t0 (negative progress)', async () => {
    // rAF timestamps lag performance.now() by 1s: (t - t0) < 0 on the first frame.
    vi.spyOn(performance, 'now').mockReturnValue(10_000)
    let frames = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      frames++
      if (frames < 4) queueMicrotask(() => cb(9_000))
      return frames
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    render(<GameBankshot storageKey={STORAGE_KEY} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('fire'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByTestId('ball')).toBeInTheDocument()
    expect(Number(screen.getByTestId('ball').getAttribute('cx'))).toBe(LAUNCH_POINT.normal.x / FP)
  })

  it('the drag handle is a large hit area drawn above the ball, and the ball ignores pointers', () => {
    render(<GameBankshot storageKey={STORAGE_KEY} />)
    const handle = screen.getByTestId('aim-handle')
    const ball = screen.getByTestId('ball')
    expect(Number(handle.getAttribute('r'))).toBeGreaterThan(BALL_R / FP * 2)
    expect(Number(handle.getAttribute('r'))).toBe(AIM_HANDLE_R)
    expect(ball.getAttribute('pointer-events')).toBe('none')
    expect(screen.getByTestId('launch-point').getAttribute('pointer-events')).toBe('none')
    // handle is painted after (on top of) the ball
    expect(ball.compareDocumentPosition(handle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // a bare tap on the handle doesn't reset aim
    const angleBefore = screen.getByTestId('angle').textContent
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(screen.getByTestId('angle').textContent).toBe(angleBefore)
  })

  it('shows Out of shots after par+3 misses and disables Fire', async () => {
    // reduced motion -> no animation gate
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (q: string) =>
        ({
          matches: q.includes('reduce'),
          media: q,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
    // pick a +10° step count whose shot misses today's daily board
    const g = createGame(DAILY_CONFIG, todaySeed(), LAUNCH_POINT.normal)
    let steps = -1
    for (let k = 1; k < 36; k++) {
      const s = reduce(reduce(g, { type: 'setAngle', deg: g.aimDeg + 10 * k }), { type: 'fire' })
      if (!s.won) {
        steps = k
        break
      }
    }
    expect(steps).toBeGreaterThan(0)

    render(<GameBankshot storageKey={STORAGE_KEY} />)
    const board = screen.getByTestId('bankshot-board')
    for (let i = 0; i < steps; i++) fireEvent.keyDown(board, { key: 'ArrowRight', shiftKey: true })
    const limit = shotLimit(DAILY_CONFIG.par)
    for (let i = 0; i < limit; i++) fireEvent.keyDown(board, { key: ' ' })
    expect(screen.getByTestId('shots')).toHaveTextContent(`${limit}/${limit}`)
    expect(await screen.findByTestId('game-over')).toHaveTextContent('Out of shots')
    expect(screen.getByTestId('fire')).toBeDisabled()
    // a lost board is final in the engine, so the Undo button must not look usable
    expect(screen.getByTestId('undo')).toBeDisabled()
    fireEvent.keyDown(board, { key: ' ' })
    expect(screen.getByTestId('shots')).toHaveTextContent(`${limit}/${limit}`)
    const stats = JSON.parse(localStorage.getItem('stats:bankshot') ?? 'null')
    if (stats) expect(stats.wins ?? 0).toBe(0)
  })
})
