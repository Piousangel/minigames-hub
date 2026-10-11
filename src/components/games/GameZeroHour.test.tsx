import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameZeroHour } from './GameZeroHour'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let now = 0
let hidden = false

function advance(ms: number) {
  // Step in loop-sized chunks so performance.now() and the interval agree.
  for (let t = 0; t < ms; t += 100) {
    now += 100
    act(() => {
      vi.advanceTimersByTime(100)
    })
  }
}

function setHidden(value: boolean) {
  hidden = value
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function score() {
  return Number(screen.getByTestId('score').textContent?.replace(/\D/g, '') ?? '0')
}

describe('GameZeroHour', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    now = 1000
    hidden = false
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(7))
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('pauses on tab hide and resumes the SAME run (audit: run was lost)', () => {
    render(<GameZeroHour storageKey="best:zero-hour" />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Start' })[0])
    advance(300)
    fireEvent.pointerDown(screen.getAllByTestId('zh-tile')[0])
    const banked = score()
    expect(banked).toBeGreaterThan(0)

    setHidden(true)
    const tilesBefore = screen.getAllByTestId('zh-tile').map((t) => t.textContent)
    advance(10_000) // a long time away — fuses must not burn
    setHidden(false)
    expect(screen.getAllByTestId('zh-tile').map((t) => t.textContent)).toEqual(tilesBefore)
    expect(screen.getByTestId('zh-paused')).toBeInTheDocument()

    // Taps while paused are ignored; Resume continues with the score intact.
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(screen.queryByTestId('zh-paused')).not.toBeInTheDocument()
    expect(score()).toBe(banked)
    fireEvent.pointerDown(screen.getAllByTestId('zh-tile')[0])
    expect(score()).toBeGreaterThan(banked)
  })

  it('plays the crack effect on the emptied cell, never on a tile spawned there later', () => {
    render(<GameZeroHour storageKey="best:zero-hour" />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Start' })[0])
    let sawCrack = false
    for (let i = 0; i < 300 && !screen.queryByTestId('game-over'); i++) {
      advance(100)
      for (const crack of screen.queryAllByTestId('zh-crack')) {
        sawCrack = true
        expect(crack.closest('[data-testid="zh-tile"]')).toBeNull()
      }
    }
    expect(sawCrack).toBe(true)
    // Effects are transient — none linger once the board settles.
    advance(1000)
    expect(screen.queryAllByTestId('zh-crack')).toHaveLength(0)
  })
})
