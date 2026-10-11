import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DAILY_CONFIG, createGame, dailySeed } from '@/lib/games/bearing/engine'
import { todayUTC } from '@/lib/dailyDate'
import { GameBearing } from './GameBearing'

const STORAGE_KEY = 'best:bearing'

function dailyTarget() {
  return createGame(DAILY_CONFIG, dailySeed(todayUTC())).target
}

function cellAt(x: number, y: number): HTMLElement {
  const el = document.querySelector(`[data-testid="cell"][data-x="${x}"][data-y="${y}"]`)
  if (!el) throw new Error(`no cell ${x},${y}`)
  return el as HTMLElement
}

/** Burn the whole budget on distinct non-target cells. */
function loseDaily() {
  const t = dailyTarget()
  let dug = 0
  for (let y = 0; y < DAILY_CONFIG.size && dug < DAILY_CONFIG.digBudget; y++) {
    for (let x = 0; x < DAILY_CONFIG.size && dug < DAILY_CONFIG.digBudget; x++) {
      if (x === t.x && y === t.y) continue
      fireEvent.click(cellAt(x, y))
      dug++
    }
  }
}

describe('GameBearing daily integrity', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('first daily win counts toward streak and best', () => {
    render(<GameBearing storageKey={STORAGE_KEY} />)
    const t = dailyTarget()
    fireEvent.click(cellAt(t.x, t.y))
    expect(screen.getByTestId('you-win')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('bearing:daily') ?? 'null')?.streak).toBe(1)
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBeGreaterThan(0)
  })

  it('a retry after losing the daily (target revealed) does not bump streak or best', () => {
    render(<GameBearing storageKey={STORAGE_KEY} />)
    loseDaily()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0])
    const t = dailyTarget()
    fireEvent.click(cellAt(t.x, t.y))

    expect(screen.getByTestId('you-win')).toBeInTheDocument()
    expect(localStorage.getItem('bearing:daily')).toBeNull()
    expect(Number(localStorage.getItem(STORAGE_KEY) ?? 0)).toBe(0)
    expect(screen.getByTestId('you-win')).toHaveTextContent(/not counted/i)
  })

  it('replaying an already-won daily cannot raise best', () => {
    render(<GameBearing storageKey={STORAGE_KEY} />)
    const t = dailyTarget()
    // Win inefficiently first: one wasted dig, then the target.
    fireEvent.click(cellAt(t.x === 0 ? 1 : 0, t.y === 0 ? 1 : 0))
    fireEvent.click(cellAt(t.x, t.y))
    const firstBest = Number(localStorage.getItem(STORAGE_KEY))
    expect(firstBest).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: 'Play again' })[0])
    fireEvent.click(cellAt(t.x, t.y))
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBe(firstBest)
  })

  it('a daily already finished today is still a replay after remount', () => {
    const { unmount } = render(<GameBearing storageKey={STORAGE_KEY} />)
    loseDaily()
    unmount()
    render(<GameBearing storageKey={STORAGE_KEY} />)
    const t = dailyTarget()
    fireEvent.click(cellAt(t.x, t.y))
    expect(localStorage.getItem('bearing:daily')).toBeNull()
    expect(Number(localStorage.getItem(STORAGE_KEY) ?? 0)).toBe(0)
  })

  describe('across UTC midnight', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("finishing yesterday's board after midnight does not lock out today's daily", () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-10T23:59:00Z'))
      const { unmount } = render(<GameBearing storageKey={STORAGE_KEY} />)
      const yesterday = createGame(DAILY_CONFIG, dailySeed('2026-10-10')).target

      vi.setSystemTime(new Date('2026-10-11T00:01:00Z'))
      fireEvent.click(cellAt(yesterday.x, yesterday.y))
      expect(screen.getByTestId('you-win')).toBeInTheDocument()
      expect(localStorage.getItem('bearing:daily-done')).toBe('2026-10-10')
      unmount()

      render(<GameBearing storageKey={STORAGE_KEY} />)
      const today = createGame(DAILY_CONFIG, dailySeed('2026-10-11')).target
      fireEvent.click(cellAt(today.x, today.y))
      expect(screen.getByTestId('you-win')).not.toHaveTextContent(/not counted/i)
      expect(localStorage.getItem('bearing:daily-done')).toBe('2026-10-11')
    })
  })
})
