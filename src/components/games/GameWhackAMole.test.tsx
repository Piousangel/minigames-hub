import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { GameWhackAMole } from './GameWhackAMole'

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

const holes = () => screen.getAllByTestId('whack-hole')
const isUp = (i: number) => holes()[i].getAttribute('aria-label') === 'Mole up — whack it'
const shellButton = (name: string) => screen.getByRole('button', { name })
const statValue = (label: string) => screen.getByText(label).parentElement!.textContent!.replace(label, '').trim()

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

/** Runs until hole 0 is up (Math.random is pinned to 0, so hole 0 is always the first pick). */
function untilHole0Up() {
  for (let i = 0; i < 40 && !isUp(0); i++) advance(80)
  expect(isUp(0)).toBe(true)
}

/** True if hole 0 goes down at least once in the next `ms`. */
function hole0GoesDown(ms: number): boolean {
  for (let t = 0; t < ms; t += 80) {
    advance(80)
    if (!isUp(0)) return true
  }
  return false
}

describe('GameWhackAMole', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance', 'Date'] })
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    setHidden(false)
  })

  it('Restart mid-round starts a fresh round (score and time reset)', () => {
    render(<GameWhackAMole storageKey="best:whack-a-mole" />)
    fireEvent.click(shellButton('Start'))
    untilHole0Up()
    fireEvent.pointerDown(holes()[0])
    expect(screen.getByTestId('score')).toHaveTextContent('1')
    advance(3000)
    expect(Number(statValue('Time'))).toBeLessThan(28)

    fireEvent.click(shellButton('Restart'))
    expect(screen.getByTestId('score')).toHaveTextContent('0')
    expect(statValue('Time')).toBe('30')
  })

  it('a mole that was up when Restart is pressed does not stay up forever', () => {
    render(<GameWhackAMole storageKey="best:whack-a-mole" />)
    fireEvent.click(shellButton('Start'))
    untilHole0Up()
    fireEvent.click(shellButton('Restart'))
    expect(hole0GoesDown(4000)).toBe(true)
  })

  it('pausing (tab hidden) and resuming does not strand a mole that was up', () => {
    render(<GameWhackAMole storageKey="best:whack-a-mole" />)
    fireEvent.click(shellButton('Start'))
    untilHole0Up()
    setHidden(true)
    advance(500)
    setHidden(false)
    const timeAtPause = Number(statValue('Time'))

    fireEvent.click(shellButton('Resume'))
    // Resume keeps the round going, it does not reset it.
    expect(Number(statValue('Time'))).toBe(timeAtPause)
    expect(hole0GoesDown(4000)).toBe(true)
  })

  it('whacking an empty hole costs time and is shown as a miss', () => {
    render(<GameWhackAMole storageKey="best:whack-a-mole" />)
    fireEvent.click(shellButton('Start'))
    expect(statValue('Time')).toBe('30')
    fireEvent.pointerDown(holes()[8])
    expect(statValue('Misses')).toBe('1')
    expect(statValue('Time')).toBe('29')
  })
})
