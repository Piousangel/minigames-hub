import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameQuarry } from './GameQuarry'
import { loadStats } from '@/lib/gameStats'
import { todayUTC } from '@/lib/dailyDate'
import { dailySeed, mulberry32, newGame } from '@/lib/games/quarry/engine'

function cell(row: number, col: number): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-testid="quarry-cell"][data-row="${row}"][data-col="${col}"]`)
  if (!el) throw new Error(`cell ${row},${col} not found`)
  return el
}

describe('GameQuarry result recording', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('records a run that ends with the quarry escaping as a loss', async () => {
    render(<GameQuarry storageKey="best:quarry" />)
    await screen.findByTestId('quarry-board')

    // Default mode is daily → the opening level is reproducible. The quarry always
    // flees AWAY from a probe, so it never steps onto the probed cell; probing a
    // single cell it doesn't start on burns the whole budget without a catch.
    const start = newGame(mulberry32(dailySeed(todayUTC())))
    const target = start.quarry.row === 0 && start.quarry.col === 0 ? { row: 0, col: 1 } : { row: 0, col: 0 }
    for (let i = 0; i < start.budget; i++) fireEvent.click(cell(target.row, target.col))

    expect(screen.getByText('It slipped away')).toBeInTheDocument()
    expect(loadStats('quarry')).toMatchObject({ plays: 1, wins: 0 })
  })
})
