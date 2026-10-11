import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameBeatline, noteTopY } from './GameBeatline'

const STORAGE_KEY = 'best:beatline'

// Drive rAF from fake timers so "time passing" is deterministic.
function installRaf() {
  let now = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    return setTimeout(() => {
      now += 16
      cb(now)
    }, 16) as unknown as number
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => clearTimeout(id))
}

describe('GameBeatline — audit 2026-10-10', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    installRaf()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not run the chart (or cost lives) before the player starts', async () => {
    render(<GameBeatline storageKey={STORAGE_KEY} />)
    expect(screen.getByTestId('beatline-start')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(10_000) // old build: Run over within ~3s
    })
    expect(screen.getByTestId('lives').textContent).toBe('♥♥♥♥')
    expect(screen.queryByText('Run over')).toBeNull()
  })

  it('first lane tap starts a 3-2-1 count-in without costing a life, then the chart runs', async () => {
    render(<GameBeatline storageKey={STORAGE_KEY} />)
    fireEvent.pointerDown(screen.getAllByTestId('lane-button')[0])
    expect(screen.getByTestId('beatline-countdown')).toHaveTextContent('3')
    expect(screen.getByTestId('lives').textContent).toBe('♥♥♥♥')
    // presses during the count-in are ignored too
    fireEvent.pointerDown(screen.getAllByTestId('lane-button')[1])
    expect(screen.getByTestId('lives').textContent).toBe('♥♥♥♥')
    await act(async () => {
      vi.advanceTimersByTime(2200)
    })
    expect(screen.queryByTestId('beatline-countdown')).toBeNull()
    // Lead-in guarantees nothing is missed in the first 1.5s of the chart.
    await act(async () => {
      vi.advanceTimersByTime(1200)
    })
    expect(screen.getByTestId('lives').textContent).toBe('♥♥♥♥')
    // Left alone long enough, notes are now actually judged (the chart is live).
    await act(async () => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.getByTestId('lives').textContent).not.toBe('♥♥♥♥')
  })

  it('Space also starts the count-in', () => {
    render(<GameBeatline storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: ' ' })
    expect(screen.getByTestId('beatline-countdown')).toBeInTheDocument()
  })

  it('rendered notes are positioned with noteTopY (centre on the line at the hit tick)', async () => {
    render(<GameBeatline storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: ' ' })
    await act(async () => {
      vi.advanceTimersByTime(2100 + 600) // count-in, then ~0.6s of chart
    })
    const notes = screen.getAllByTestId('beatline-note')
    expect(notes.length).toBeGreaterThan(0)
    for (const n of notes) {
      const remaining = Number(n.getAttribute('data-remaining'))
      expect(n.style.transform).toBe(`translateY(${noteTopY(remaining)}px)`)
    }
  })

  it('note centre sits on the judgement line centre at the hit tick', () => {
    const NOTE_HEIGHT = 26
    const lineCenter = 360 - 40 + 3 / 2
    expect(noteTopY(0) + NOTE_HEIGHT / 2).toBe(lineCenter)
    // and it moves down the track as time passes
    expect(noteTopY(50)).toBeLessThan(noteTopY(10))
  })
})
