import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameOverlay } from './GameOverlay'
import { GameNavProvider } from '@/components/GameNav'

const RUN_KEY = 'run:count'

function renderOverlay(seedRunCount: number) {
  if (seedRunCount > 0) sessionStorage.setItem(RUN_KEY, String(seedRunCount))
  return render(
    <GameNavProvider slug="snake">
      <GameOverlay show variant="lose" title="Game over" testId="game-over" />
    </GameNavProvider>,
  )
}

describe('GameOverlay — support-the-site nudge', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('shows the support link on a RUN milestone (3rd game in a row)', () => {
    renderOverlay(2) // provider bumps this to 3 on mount — a milestone
    expect(screen.getByTestId('overlay-support')).toBeInTheDocument()
    expect(screen.getByTestId('overlay-support')).toHaveAttribute(
      'href',
      expect.stringContaining('ko-fi.com'),
    )
  })

  it('does not show the support link on a non-milestone run (e.g. the 4th game)', () => {
    renderOverlay(3) // bumps to 4 — not a milestone
    expect(screen.queryByTestId('overlay-support')).not.toBeInTheDocument()
  })

  it('does not show the support link on the very first game of a session', () => {
    renderOverlay(0) // bumps to 1
    expect(screen.queryByTestId('overlay-support')).not.toBeInTheDocument()
  })
})

describe('GameOverlay — leaderboard discovery nudge', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('shows a leaderboard link for a game with a leaderboard (snake), even on the first game', () => {
    renderOverlay(0) // bumps to 1 — not a RUN milestone, but leaderboard link isn't gated on that
    const link = screen.getByTestId('overlay-leaderboard')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '#leaderboard')
  })

  it('does not show a leaderboard link for a game without one', () => {
    sessionStorage.setItem(RUN_KEY, '0')
    render(
      <GameNavProvider slug="no-such-leaderboard-game">
        <GameOverlay show variant="lose" title="Game over" testId="game-over" />
      </GameNavProvider>,
    )
    expect(screen.queryByTestId('overlay-leaderboard')).not.toBeInTheDocument()
  })
})
