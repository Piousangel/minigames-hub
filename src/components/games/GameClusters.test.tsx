import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { GameClusters } from './GameClusters'

// Pin every board (daily and practice) to a known seed: Kitchen tools,
// Continents, Ballroom dances, Amino acids.
vi.mock('@/lib/games/clusters/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/games/clusters/engine')>()
  return { ...real, createGame: () => real.createGame(12345) }
})

const WRONG = ['Fork', 'Knife', 'Africa', 'Asia']

function guess(items: string[]) {
  const deselect = screen.queryByRole('button', { name: 'Deselect' })
  if (deselect && !(deselect as HTMLButtonElement).disabled) fireEvent.click(deselect)
  for (const it of items) fireEvent.click(screen.getByRole('button', { name: it }))
  fireEvent.click(screen.getByRole('button', { name: /^Submit/ }))
}

describe('GameClusters', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reveals every unsolved group after a loss', async () => {
    render(<GameClusters storageKey="best:clusters" />)
    await screen.findAllByTestId('tile')
    // solve one group, then burn all four lives
    guess(['Fork', 'Spoon', 'Knife', 'Plate'])
    guess(['Africa', 'Asia', 'Tango', 'Waltz'])
    guess(['Africa', 'Asia', 'Lysine', 'Glycine'])
    guess(['Tango', 'Waltz', 'Lysine', 'Glycine'])
    guess(['Africa', 'Asia', 'Europe', 'Lysine'])

    // The answers are on the board before the overlay covers them.
    expect(screen.queryByTestId('game-over')).toBeNull()
    expect(screen.getAllByTestId('revealed-group')).toHaveLength(3)
    await screen.findByTestId('game-over', undefined, { timeout: 3000 })
    const board = screen.getByTestId('clusters-board')
    expect(within(board).getAllByTestId('solved-group')).toHaveLength(1)
    const revealed = within(board).getAllByTestId('revealed-group')
    expect(revealed.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Continents'),
      expect.stringContaining('Ballroom dances'),
      expect.stringContaining('Amino acids'),
    ])
    expect(revealed[0].textContent).toContain('Antarctica')
    // the unsolved tiles are gone, replaced by the answers
    expect(within(board).queryAllByTestId('tile')).toHaveLength(0)
  })

  it('keeps the selection after a wrong guess and refuses an exact repeat for free', async () => {
    render(<GameClusters storageKey="best:clusters" />)
    await screen.findAllByTestId('tile')
    for (const it of WRONG) fireEvent.click(screen.getByRole('button', { name: it }))
    fireEvent.click(screen.getByRole('button', { name: /^Submit/ }))
    expect(screen.getByRole('button', { name: /^Submit \(4\/4\)/ })).toBeTruthy()
    expect(screen.getByLabelText('3 lives remaining')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Submit/ }))
    expect(screen.getByText('Already guessed')).toBeTruthy()
    expect(screen.getByLabelText('3 lives remaining')).toBeTruthy()
  })
})
