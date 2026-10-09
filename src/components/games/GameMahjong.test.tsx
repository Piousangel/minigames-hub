import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameMahjong } from './GameMahjong'
import { MAX_SHUFFLES } from '@/lib/games/mahjong/engine'

// jsdom has no ResizeObserver; the board only uses it to scale-to-fit.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('GameMahjong', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Undo never refunds a spent shuffle (shuffles stay capped at MAX_SHUFFLES)', async () => {
    render(<GameMahjong storageKey="best:mahjong" />)
    await screen.findByRole('button', { name: `Shuffle (${MAX_SHUFFLES})` })

    // shuffle → undo, repeated: the counter must keep going down, not bounce back.
    for (let used = 1; used <= MAX_SHUFFLES; used++) {
      fireEvent.click(screen.getByRole('button', { name: /^Shuffle \(/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(screen.getByRole('button', { name: /^Shuffle \(/ }).textContent).toBe(
        `Shuffle (${MAX_SHUFFLES - used})`,
      )
    }
    expect(screen.getByRole('button', { name: /^Shuffle \(/ })).toBeDisabled()
  })

  it('Undo can still step back across a shuffle (history kept), without refunding it', async () => {
    render(<GameMahjong storageKey="best:mahjong" />)
    const shuffleBtn = await screen.findByRole('button', { name: `Shuffle (${MAX_SHUFFLES})` })
    fireEvent.click(shuffleBtn)
    const undoBtn = screen.getByRole('button', { name: 'Undo' })
    expect(undoBtn).not.toBeDisabled()
    fireEvent.click(undoBtn)
    expect(screen.getByRole('button', { name: /^Shuffle \(/ }).textContent).toBe(`Shuffle (${MAX_SHUFFLES - 1})`)
  })
})
