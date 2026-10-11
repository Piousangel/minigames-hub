import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameNumberMemory } from './GameNumberMemory'

const STORAGE_KEY = 'best:number-memory'

describe('GameNumberMemory', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    // rng 0 → every generated number is "1", then "10", "100", …
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function startAndWaitForInput() {
    render(<GameNumberMemory storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Start' })[0])
    expect(screen.getByTestId('numbermemory-number')).toHaveTextContent('1')
    act(() => {
      vi.advanceTimersByTime(1300) // level 1 show window
    })
    expect(screen.getByTestId('numbermemory-input')).toBeInTheDocument()
  }

  it('does not re-flash the just-answered number as "Remember this" after a correct answer', () => {
    startAndWaitForInput()
    fireEvent.click(screen.getByRole('button', { name: 'Digit 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

    // Inside the 300ms correct-flash window: the old number must NOT be shown again.
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(screen.queryByTestId('numbermemory-number')).not.toBeInTheDocument()
    expect(screen.queryByText('Remember this')).not.toBeInTheDocument()
    expect(screen.getByTestId('numbermemory-correct')).toBeInTheDocument()

    // After the flash, the NEW (2-digit) number is revealed.
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByTestId('numbermemory-number')).toHaveTextContent('10')
  })

  it('gives the board room for the game-over overlay (no fixed 4:3 box when over)', () => {
    startAndWaitForInput()
    fireEvent.click(screen.getByRole('button', { name: 'Digit 9' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    const board = screen.getByTestId('numbermemory-board')
    expect(board.className).not.toMatch(/aspect-\[4\/3\]/)
    expect(board.className).toMatch(/min-h-\[/)
  })
})
