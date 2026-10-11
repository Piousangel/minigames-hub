import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

import { GameHogline } from './GameHogline'

const STORAGE_KEY = 'best:hogline'

describe('GameHogline', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Audit 2026-10-10 [bug/S]: Bank on shot 0 scored 90 ≥ target and won (streak +1).
  it('banking before throwing does not clear the target or bump the daily streak', () => {
    render(<GameHogline storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByTestId('bank'))
    const overlay = screen.getByTestId('you-win')
    expect(overlay).toHaveAttribute('aria-label', 'End of ends')
    expect(localStorage.getItem('hogline:daily')).toBeNull()
  })

  // Audit 2026-10-10 [major/S]: the overlay covered the final throw's playback.
  it('holds the result overlay until the last throw has finished playing back', () => {
    render(<GameHogline storageKey={STORAGE_KEY} />)
    const shots = Number(screen.getByTestId('shots').textContent?.replace(/\D/g, ''))
    for (let i = 0; i < shots; i++) {
      fireEvent.click(screen.getByTestId('throw'))
      act(() => {
        vi.advanceTimersByTime(16)
      })
    }
    // Last throw released: the game is finished but the stone is still sliding.
    expect(screen.queryByTestId('you-win')).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByTestId('you-win')).toBeInTheDocument()
  })

  // Audit 2026-10-10 [major/S]: the drag-to-aim hack was ~21px on screen.
  it('gives the drag-to-aim hack a hit radius of at least 8 sheet units', () => {
    render(<GameHogline storageKey={STORAGE_KEY} />)
    const hack = screen.getByTestId('hack')
    expect(Number(hack.getAttribute('r'))).toBeGreaterThanOrEqual(8)
  })
})
