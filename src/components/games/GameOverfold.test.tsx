import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { GameOverfold } from './GameOverfold'
import { dailySeed, legalCreases, mulberry32, newGame, previewFold } from '@/lib/games/overfold/engine'

// Pin "today" so the daily board is fixed: 2026-01-02 is a 2×4 board (par 3, solution
// h2 → h1 → v1, all low-side) where crease h3 jams two different colours. Without the
// pin the jam test silently passed on days whose board had no single jamming fold.
const FIXED_DAY = '2026-01-02'
vi.mock('@/lib/dailyDate', () => ({ todayUTC: () => FIXED_DAY }))

const STORAGE_KEY = 'best:overfold'

function dailyState() {
  const seed = dailySeed(FIXED_DAY)
  return newGame(mulberry32(seed), 'daily', seed, 1)
}

function clickCrease(axis: string, index: number) {
  const el = document.querySelector<HTMLElement>(
    `[data-testid="overfold-crease"][data-axis="${axis}"][data-index="${index}"]`,
  )
  expect(el).not.toBeNull()
  fireEvent.click(el!)
}

function stats(): { plays: number; wins: number } {
  const raw = JSON.parse(localStorage.getItem('stats:overfold') ?? 'null') as { plays?: number; wins?: number } | null
  return { plays: raw?.plays ?? 0, wins: raw?.wins ?? 0 }
}

async function settle() {
  // fold animation runs on a timer (FOLD_MS); flush it.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 600))
  })
}

describe('GameOverfold — audit 2026-10-10', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('a fold that jams ends the board as a loss and does NOT bump the daily streak', async () => {
    render(<GameOverfold storageKey={STORAGE_KEY} />)
    await screen.findByTestId('overfold-board')
    const s = dailyState()
    // Find a fold that jams (any crease, auto-picked side as the UI does for non-ties).
    let target: { axis: string; index: number } | null = null
    for (const cr of legalCreases(s.board)) {
      for (const pref of ['low', 'high'] as const) {
        const pv = previewFold(s.board, cr.axis, cr.index, pref)
        const isTie = cr.axis === 'v' ? cr.index * 2 === s.board.w : cr.index * 2 === s.board.h
        if (pv.jamsFormed > 0 && (isTie ? pref === 'low' : true)) target = cr
      }
    }
    expect(target).not.toBeNull() // the pinned board must offer a jamming fold
    clickCrease(target!.axis, target!.index)
    await settle()
    const over = await screen.findByTestId('game-over')
    expect(over).toHaveTextContent('Jammed!')
    expect(over).not.toHaveTextContent('Sealed!')
    // the lose overlay offers an Unfold so a jam can be rewound
    expect(within(over).getByRole('button', { name: /Unfold \(3\)/ })).toBeInTheDocument()
    const streak = localStorage.getItem(`${STORAGE_KEY}:streak`)
    expect(streak === null || !streak.includes('"streak":1')).toBe(true)
  })

  it('pips are square (sized from the shorter cell side), not stretched pills', async () => {
    render(<GameOverfold storageKey={STORAGE_KEY} />)
    await screen.findByTestId('overfold-board')
    const pips = document.querySelectorAll<HTMLElement>('[data-testid="overfold-pip"]')
    expect(pips.length).toBeGreaterThan(0)
    const s = dailyState()
    for (const p of pips) {
      expect(p.className).toContain('aspect-square')
      expect(p.className).not.toMatch(/\bh-3\/5\b/)
      expect(p.style.width).toBe(`${60 * Math.min(1, s.board.w / s.board.h)}%`)
    }
  })

  it('a jam rewound with Unfold and then solved records ONE win — not a loss plus a win', async () => {
    render(<GameOverfold storageKey={STORAGE_KEY} />)
    await screen.findByTestId('overfold-board')
    clickCrease('h', 3) // jams
    await settle()
    const over = await screen.findByTestId('game-over')
    expect(over).toHaveTextContent('Jammed!')
    fireEvent.click(within(over).getByRole('button', { name: /Unfold/ }))
    await settle()
    for (const m of dailyState().solution) {
      clickCrease(m.axis, m.index)
      await settle()
    }
    expect(await screen.findByTestId('game-over')).toHaveTextContent('Sealed!')
    expect(stats()).toEqual({ plays: 1, wins: 1 })
  })

  it('a jam that is abandoned (Retry board) is recorded as exactly one loss', async () => {
    render(<GameOverfold storageKey={STORAGE_KEY} />)
    await screen.findByTestId('overfold-board')
    clickCrease('h', 3)
    await settle()
    const over = await screen.findByTestId('game-over')
    fireEvent.click(within(over).getByRole('button', { name: /Retry board/ }))
    await settle()
    expect(stats()).toEqual({ plays: 1, wins: 0 })
  })
})
