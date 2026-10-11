import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameCountcircle } from './GameCountcircle'
import { START_SEATS, startIdx } from '@/lib/games/countcircle/engine'

const STORAGE_KEY = 'best:countcircle'

function playerSeat(): number {
  return Number(screen.getByTestId('player-seat').getAttribute('data-seat'))
}
function buttonSeat(name: 'Move left' | 'Move right'): number {
  return Number(screen.getByRole('button', { name }).getAttribute('data-seat'))
}
/** Circular distance between two seat ids on a START_SEATS ring. */
function ringDist(a: number, b: number): number {
  const d = Math.abs(a - b) % START_SEATS
  return Math.min(d, START_SEATS - d)
}

describe('GameCountcircle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // Audit 2026-10-10 (engine.ts:262): after moving, the player ring stayed put
  // and the "Move left" button landed on a seat not adjacent to the player.
  it('the player marker follows the player and neighbor buttons stay adjacent', async () => {
    render(<GameCountcircle storageKey={STORAGE_KEY} />)
    const ring = await screen.findByRole('group', { name: 'Countcircle board' })
    const start = startIdx(START_SEATS)
    expect(playerSeat()).toBe(start)

    fireEvent.keyDown(ring, { key: 'ArrowRight' })
    fireEvent.keyDown(ring, { key: 'ArrowRight' })
    const now = playerSeat()
    expect(ringDist(now, start)).toBe(2)
    expect(ringDist(buttonSeat('Move left'), now)).toBe(1)
    expect(ringDist(buttonSeat('Move right'), now)).toBe(1)
    expect(buttonSeat('Move left')).not.toBe(buttonSeat('Move right'))
  })

  it('"Move left" is the neighbor on the screen-left side (player starts at the bottom)', async () => {
    render(<GameCountcircle storageKey={STORAGE_KEY} />)
    const ring = await screen.findByRole('group', { name: 'Countcircle board' })
    // Seat ids run clockwise from the top, so at the bottom seat the clockwise
    // neighbor (id + 1) is on the screen-left.
    const start = startIdx(START_SEATS)
    expect(buttonSeat('Move left')).toBe(start + 1)
    expect(buttonSeat('Move right')).toBe(start - 1)
    fireEvent.keyDown(ring, { key: 'ArrowLeft' })
    expect(playerSeat()).toBe(start + 1)
  })

  it('labels the move buttons with arrows and marks the player seat', async () => {
    render(<GameCountcircle storageKey={STORAGE_KEY} />)
    await screen.findByRole('group', { name: 'Countcircle board' })
    expect(screen.getByRole('button', { name: 'Move left' })).toHaveTextContent('←')
    expect(screen.getByRole('button', { name: 'Move right' })).toHaveTextContent('→')
    expect(screen.getByTestId('player-seat')).toBeInTheDocument()
  })
})
