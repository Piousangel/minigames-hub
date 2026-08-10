import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameAimTrainer } from './GameAimTrainer'
import { statsKey } from '@/lib/gameStats'
import { DEFAULT_TARGET_COUNT } from '@/lib/games/aim/engine'

const STORAGE_KEY = 'best:aim-trainer'

describe('GameAimTrainer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // deterministic target placement
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now++)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function completeRun() {
    fireEvent.click(screen.getAllByRole('button', { name: 'Start' })[0])
    for (let i = 0; i < DEFAULT_TARGET_COUNT; i++) {
      fireEvent.click(screen.getByTestId('aim-target'))
    }
  }

  it('records a completed run, always as a win, regardless of best', () => {
    render(<GameAimTrainer storageKey={STORAGE_KEY} />)
    completeRun()

    expect(screen.getByTestId('aim-results')).toBeInTheDocument()
    expect(screen.getByTestId('hits')).toHaveTextContent(String(DEFAULT_TARGET_COUNT))

    const stats = JSON.parse(localStorage.getItem(statsKey('aim-trainer')) ?? '{}')
    expect(stats).toEqual({ plays: 1, wins: 1 })
  })

  it('sets a new best and persists it as a plain number on the first completed run', () => {
    render(<GameAimTrainer storageKey={STORAGE_KEY} />)
    completeRun()

    expect(screen.getByText('New best!')).toBeInTheDocument()
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    expect(Number.isFinite(saved)).toBe(true)
    expect(saved).toBeGreaterThan(0)
  })

  it('does not overwrite a higher existing best, but still records the play', () => {
    localStorage.setItem(STORAGE_KEY, '999999') // effectively unbeatable tps
    render(<GameAimTrainer storageKey={STORAGE_KEY} />)
    completeRun()

    expect(screen.getByText('Complete!')).toBeInTheDocument()
    expect(screen.queryByText('New best!')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('999999')

    const stats = JSON.parse(localStorage.getItem(statsKey('aim-trainer')) ?? '{}')
    expect(stats).toEqual({ plays: 1, wins: 1 })
  })
})
