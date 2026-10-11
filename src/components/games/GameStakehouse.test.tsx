import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameStakehouse } from './GameStakehouse'
import { ROUNDS } from '@/lib/games/stakehouse/engine'

const STORAGE_KEY = 'best:stakehouse'

function pots(): HTMLElement[] {
  return screen.getAllByTestId('stakehouse-pot')
}

describe('GameStakehouse', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // Audit 2026-10-10 (GameStakehouse.tsx:375): an effect called
  // cardRefs[focus].focus() on every state change, so the first pot stole focus
  // on load and again after every +/Commit click.
  it('does not steal focus on mount', async () => {
    render(<GameStakehouse storageKey={STORAGE_KEY} />)
    await screen.findAllByTestId('stakehouse-pot')
    expect(pots()).not.toContain(document.activeElement)
  })

  it('does not move focus onto a pot after clicking + or Commit', async () => {
    render(<GameStakehouse storageKey={STORAGE_KEY} />)
    await screen.findAllByTestId('stakehouse-pot')
    const commitBtn = screen.getByRole('button', { name: 'Commit Round' })
    commitBtn.focus()
    fireEvent.click(screen.getAllByRole('button', { name: /Increase pot/ })[0])
    expect(pots()).not.toContain(document.activeElement)
    commitBtn.focus()
    fireEvent.click(commitBtn)
    expect(document.activeElement).toBe(commitBtn)
  })

  it('arrow keys still move DOM focus between pots', async () => {
    render(<GameStakehouse storageKey={STORAGE_KEY} />)
    await screen.findAllByTestId('stakehouse-pot')
    const board = screen.getByTestId('stakehouse-board')
    fireEvent.keyDown(board, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(pots()[1])
    fireEvent.keyDown(pots()[1], { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(pots()[0])
  })

  it('shows each jar’s face-up floor token', async () => {
    render(<GameStakehouse storageKey={STORAGE_KEY} />)
    await screen.findAllByTestId('stakehouse-pot')
    const floors = screen.getAllByTestId('pot-floor')
    expect(floors).toHaveLength(4)
    for (const f of floors) expect(f.getAttribute('data-floor')).toMatch(/^(gem|dud)$/)
  })

  // Audit 2026-10-10 (engine.ts:141): sitting out every round used to win.
  it('sitting out all rounds ends in a missed-target loss, not a win', async () => {
    render(<GameStakehouse storageKey={STORAGE_KEY} />)
    await screen.findAllByTestId('stakehouse-pot')
    const commitBtn = screen.getByRole('button', { name: 'Commit Round' })
    for (let i = 0; i < ROUNDS; i++) {
      act(() => {
        fireEvent.click(commitBtn)
      })
    }
    expect(screen.queryByTestId('you-win')).toBeNull()
    expect(await screen.findByTestId('game-over')).toHaveTextContent(/target/i)
    const stats = JSON.parse(localStorage.getItem('stats:stakehouse') ?? '{}')
    expect(stats.wins ?? 0).toBe(0)
  })
})
