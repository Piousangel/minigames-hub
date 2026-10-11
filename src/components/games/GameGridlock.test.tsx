import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameGridlock } from './GameGridlock'

const STORAGE_KEY = 'best:gridlock'

let now = 1000
let hidden = false

function advance(ms: number) {
  // Step in small chunks so the 40ms interval sees a moving clock.
  for (let t = 0; t < ms; t += 40) {
    now += 40
    act(() => {
      vi.advanceTimersByTime(40)
    })
  }
}

function setHidden(h: boolean) {
  hidden = h
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function vehiclesMoved(ms: number): boolean {
  const before = document.querySelector('[data-testid="gridlock-board"]')!.innerHTML
  advance(ms)
  const after = document.querySelector('[data-testid="gridlock-board"]')!.innerHTML
  return before !== after
}

describe('GameGridlock', () => {
  beforeEach(() => {
    localStorage.clear()
    now = 1000
    hidden = false
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('waits for the first input before the clock runs', () => {
    render(<GameGridlock storageKey={STORAGE_KEY} />)
    expect(screen.getByTestId('gridlock-ready')).toBeInTheDocument()
    expect(vehiclesMoved(3000)).toBe(false)
  })

  it('arrow keys work with focus on <body> (window listener) and start the game', () => {
    render(<GameGridlock storageKey={STORAGE_KEY} />)
    expect(document.activeElement).toBe(document.body)
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(screen.getByTestId('gridlock-lane-E')).toHaveAttribute('data-active')
    expect(screen.queryByTestId('gridlock-ready')).not.toBeInTheDocument()
    expect(vehiclesMoved(3000)).toBe(true)
  })

  it('pauses when the tab is hidden and can resume afterwards (no permanent freeze)', () => {
    render(<GameGridlock storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(document.body, { key: 'ArrowUp' })
    advance(600)

    setHidden(true)
    setHidden(false)
    expect(screen.getByTestId('gridlock-paused')).toBeInTheDocument()
    expect(vehiclesMoved(3000)).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    expect(screen.queryByTestId('gridlock-paused')).not.toBeInTheDocument()
    expect(vehiclesMoved(3000)).toBe(true)
  })

  it('a lane key also resumes from pause', () => {
    render(<GameGridlock storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(document.body, { key: 'ArrowUp' })
    setHidden(true)
    setHidden(false)
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    expect(screen.queryByTestId('gridlock-paused')).not.toBeInTheDocument()
    expect(vehiclesMoved(3000)).toBe(true)
  })

  it('ignores keys typed into inputs', () => {
    render(
      <>
        <input data-testid="other-input" />
        <GameGridlock storageKey={STORAGE_KEY} />
      </>,
    )
    fireEvent.keyDown(screen.getByTestId('other-input'), { key: 'ArrowRight' })
    expect(screen.getByTestId('gridlock-ready')).toBeInTheDocument()
  })
})
