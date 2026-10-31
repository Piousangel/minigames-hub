import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DailyDock } from './DailyDock'
import { GameNavProvider } from '@/components/GameNav'

describe('DailyDock', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it("includes tomorrow's spotlight teaser below the daily progress", () => {
    render(
      <GameNavProvider slug="snake">
        <DailyDock />
      </GameNavProvider>,
    )
    expect(screen.getByTestId('daily-dock')).toBeInTheDocument()
    expect(screen.getByTestId('daily-dock')).toContainElement(screen.getByTestId('spotlight-teaser'))
  })
})
