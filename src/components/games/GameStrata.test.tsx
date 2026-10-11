import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DAILY_CONFIG, createGame } from '@/lib/games/strata/engine'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

import { GameStrata } from './GameStrata'

const STORAGE_KEY = 'best:strata'

function todaySeed(): number {
  const d = new Date()
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

/** Paints today's daily answer layer by layer (default view: Z axis, layer 0) and submits it. */
function solveDaily() {
  const { voxels, size } = createGame(DAILY_CONFIG, todaySeed())
  for (let z = 0; z < size; z++) {
    const cells = screen.getAllByTestId('guess-cell')
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (voxels[col + row * size + z * size * size]) fireEvent.click(cells[row * size + col])
      }
    }
    if (z < size - 1) fireEvent.click(screen.getByRole('button', { name: 'Next layer' }))
  }
  fireEvent.click(screen.getByTestId('submit-guess'))
}

describe('GameStrata daily integrity', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('a first-try daily win bumps the streak and best', () => {
    render(<GameStrata storageKey={STORAGE_KEY} />)
    solveDaily()
    expect(screen.getByTestId('you-win')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('strata:daily') ?? 'null')?.streak).toBe(1)
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBeGreaterThan(1000)
  })

  // Audit 2026-10-10 [bug/S]: losing reveals the answer, then Replay Daily re-solves it for streak + best.
  it('replaying the daily after a loss (answer revealed) does not bump streak or best', () => {
    render(<GameStrata storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByRole('button', { name: 'Give Up' }))
    const lost = screen.getByTestId('game-over')
    expect(within(lost).getByTestId('answer-preview')).toBeInTheDocument()
    const bestAfterLoss = Number(localStorage.getItem(STORAGE_KEY) ?? 0)

    fireEvent.click(within(lost).getByRole('button', { name: 'Play again' }))
    solveDaily()

    const win = screen.getByTestId('you-win')
    expect(within(win).getByTestId('daily-replay-note')).toBeInTheDocument()
    expect(localStorage.getItem('strata:daily')).toBeNull()
    expect(Number(localStorage.getItem(STORAGE_KEY) ?? 0)).toBe(bestAfterLoss)
    expect(screen.getByTestId('score')).toHaveTextContent(String(bestAfterLoss))
  })

  it('a second daily win the same day does not count either', () => {
    const { unmount } = render(<GameStrata storageKey={STORAGE_KEY} />)
    solveDaily()
    const bestAfterWin = localStorage.getItem(STORAGE_KEY)
    unmount()

    render(<GameStrata storageKey={STORAGE_KEY} />)
    solveDaily()
    expect(within(screen.getByTestId('you-win')).getByTestId('daily-replay-note')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(bestAfterWin)
  })
})
