import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GamePolytap } from './GamePolytap'

// Skip the no-fail warm-up so off-beat taps cost lives and the run can end.
vi.mock('@/lib/games/polytap/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/games/polytap/engine')>()
  return { ...real, newGame: (seed: number) => ({ ...real.newGame(seed), stage: 1 }) }
})

describe('GamePolytap game-over overlay', () => {
  beforeEach(() => {
    localStorage.clear()
    // Freeze the clock: the run never advances on its own, only taps move it.
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function playToGameOver() {
    render(<GamePolytap storageKey="best:polytap" />)
    await screen.findByTestId('polytap-board')
    fireEvent.keyDown(window, { key: ' ' })
    // Off-beat taps are strays; enough of them end the run.
    for (let i = 0; i < 30 && !screen.queryByTestId('game-over'); i++) {
      fireEvent.keyDown(window, { key: 'j' })
    }
    return screen.findByTestId('game-over')
  }

  it('is not clipped by an overflow-hidden ancestor (audit: title/leaderboard link cut off)', async () => {
    const overlay = await playToGameOver()
    for (let el = overlay.parentElement; el && el !== document.body; el = el.parentElement) {
      expect(el.className, `ancestor <${el.tagName.toLowerCase()} class="${el.className}">`).not.toMatch(
        /\boverflow-hidden\b/,
      )
    }
  })

  it('spans the board AND the tap pads, so it has more than two lanes of height to fill', async () => {
    const overlay = await playToGameOver()
    const host = overlay.parentElement!
    expect(host.contains(screen.getByTestId('polytap-board'))).toBe(true)
    expect(host.contains(screen.getByTestId('pad-j'))).toBe(true)
  })
})
