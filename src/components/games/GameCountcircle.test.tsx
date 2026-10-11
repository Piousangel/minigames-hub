import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameCountcircle } from './GameCountcircle'
import { START_SEATS, startIdx } from '@/lib/games/countcircle/engine'

const STORAGE_KEY = 'best:countcircle'

function playerSeat(): number {
  return Number(screen.getByTestId('player-seat').getAttribute('data-seat'))
}
function buttonSeat(name: 'Move left' | 'Move right' | 'Move up' | 'Move down'): number {
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
    const neighbors = screen.getAllByRole('button', { name: /^Move / }).map((b) => Number(b.getAttribute('data-seat')))
    expect(neighbors).toHaveLength(2)
    for (const seat of neighbors) expect(ringDist(seat, now)).toBe(1)
    expect(neighbors[0]).not.toBe(neighbors[1])
  })

  // QA 2026-10-11: at the side of the ring (3 o'clock) the two neighbors sit
  // above/below each other, so ← / → glyphs on them were meaningless — the
  // labels must switch to ↑ / ↓ and match what the ↑ / ↓ keys do.
  it('labels side-of-ring neighbors ↑ / ↓ and the keys agree with the labels', async () => {
    render(<GameCountcircle storageKey={STORAGE_KEY} />)
    const ring = await screen.findByRole('group', { name: 'Countcircle board' })
    fireEvent.keyDown(ring, { key: 'ArrowRight' })
    fireEvent.keyDown(ring, { key: 'ArrowRight' })
    // 8 seats, clockwise from the top: seat 2 is 3 o'clock, seat 1 above it, seat 3 below.
    expect(playerSeat()).toBe(START_SEATS / 4)
    expect(screen.queryByRole('button', { name: 'Move left' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Move up' })).toHaveTextContent('↑')
    expect(screen.getByRole('button', { name: 'Move down' })).toHaveTextContent('↓')
    expect(buttonSeat('Move up')).toBe(START_SEATS / 4 - 1)
    expect(buttonSeat('Move down')).toBe(START_SEATS / 4 + 1)
    fireEvent.keyDown(ring, { key: 'ArrowUp' })
    expect(playerSeat()).toBe(START_SEATS / 4 - 1)
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
