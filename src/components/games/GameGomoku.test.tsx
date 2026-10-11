import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { GameGomoku } from './GameGomoku'
import { loadStats } from '@/lib/gameStats'
import { SIZE } from '@/lib/games/gomoku/engine'

// A harmless CPU: it always fills the bottom row from the left, far away from
// the human's five-in-a-row on row 1, so a scripted human win is guaranteed.
vi.mock('@/lib/games/gomoku/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/games/gomoku/engine')>()
  return {
    ...real,
    aiMove: (state: { board: number[] }) => {
      const start = (real.SIZE - 1) * real.SIZE
      for (let i = start; i < start + real.SIZE; i++) if (state.board[i] === 0) return i
      return -1
    },
  }
})

const cell = (r: number, c: number) =>
  screen.getByRole('button', { name: new RegExp(`^Row ${r}, column ${c},`) })

const wins = () => screen.getByTestId('gomoku-wins').textContent

describe('GameGomoku record integrity', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('a finished vs-CPU win cannot be undone and replayed for extra wins', async () => {
    render(<GameGomoku storageKey="best:gomoku" />)
    for (let c = 1; c <= 5; c++) {
      await waitFor(() => expect((cell(1, c) as HTMLButtonElement).disabled).toBe(false))
      fireEvent.click(cell(1, c))
    }
    await screen.findByTestId('gomoku-result-win')
    expect(wins()).toContain('1')
    expect(loadStats('gomoku').plays).toBe(1)

    // Undo is dead once the game is decided — button and keyboard alike.
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true)
    act(() => {
      fireEvent.keyDown(window, { key: 'u' })
    })
    expect(screen.getByTestId('gomoku-result-win')).toBeTruthy()
    expect(cell(1, 5).getAttribute('aria-label')).toContain('Black stone')
    expect(wins()).toContain('1')
    expect(localStorage.getItem('best:gomoku')).toBe('1')
    expect(loadStats('gomoku').plays).toBe(1)
  })

  it('a 2-player win does not count toward vs-CPU Wins, the leaderboard, or stats', async () => {
    render(<GameGomoku storageKey="best:gomoku" />)
    await screen.findByTestId('gomoku-board')
    fireEvent.click(screen.getByRole('button', { name: '2 Player' }))
    for (let c = 1; c <= 5; c++) {
      fireEvent.click(cell(1, c)) // Black
      if (c < 5) fireEvent.click(cell(SIZE, c)) // White, far away
    }
    await screen.findByTestId('gomoku-result-win')
    expect(wins()).toContain('0')
    expect(localStorage.getItem('best:gomoku')).toBeNull()
    expect(loadStats('gomoku').plays).toBe(0)
  })
})
