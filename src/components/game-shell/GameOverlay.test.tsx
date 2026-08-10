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
