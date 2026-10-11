import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { GameOverfold } from './GameOverfold'
import { todayUTC } from '@/lib/dailyDate'
import { dailySeed, legalCreases, mulberry32, newGame, previewFold } from '@/lib/games/overfold/engine'

const STORAGE_KEY = 'best:overfold'

function dailyState() {
  const seed = dailySeed(todayUTC())
  return newGame(mulberry32(seed), 'daily', seed, 1)
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
    if (!target) return // today's board has no single jamming fold — nothing to assert
    const el = document.querySelector<HTMLElement>(
      `[data-testid="overfold-crease"][data-axis="${target.axis}"][data-index="${target.index}"]`,
    )
    fireEvent.click(el!)
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
})
