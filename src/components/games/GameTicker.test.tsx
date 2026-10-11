import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GameTicker } from './GameTicker'

const STORAGE_KEY = 'best:ticker'

/** Seed 2, always picking A, ends at Worth 66 — a loss (below the 100 start) without busting. */
const LOSING_SEED = 2
const LOSING_FINAL = 66

function mockSeed(seed: number) {
  // pickSeed() = floor(Math.random() * 0x7fffffff)
  vi.spyOn(Math, 'random').mockReturnValue((seed + 0.5) / 0x7fffffff)
}

function playAllA() {
  for (let i = 0; i < 40 && !screen.queryByTestId('game-over'); i++) {
    fireEvent.keyDown(window, { key: '1' })
  }
}

describe('GameTicker', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a losing first run is not celebrated as "New best!"', () => {
    mockSeed(LOSING_SEED)
    render(<GameTicker storageKey={STORAGE_KEY} />)
    expect(screen.getByTestId('ticker-seed')).toHaveTextContent(String(LOSING_SEED))
    playAllA()

    const over = screen.getByTestId('game-over')
    expect(screen.getByTestId('score')).toHaveTextContent(String(LOSING_FINAL))
    expect(over).toHaveTextContent('Run over')
    expect(over).not.toHaveTextContent('New best!')
    // The record itself is still kept.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(LOSING_FINAL))
  })

  it('a losing run that beats a previous (also losing) best is still not a win', () => {
    localStorage.setItem(STORAGE_KEY, '40')
    mockSeed(LOSING_SEED)
    render(<GameTicker storageKey={STORAGE_KEY} />)
    playAllA()
    expect(screen.getByTestId('game-over')).not.toHaveTextContent('New best!')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(LOSING_FINAL))
  })

  it('pointerdown alone does not commit an all-in bet; a click does', () => {
    mockSeed(LOSING_SEED)
    render(<GameTicker storageKey={STORAGE_KEY} />)
    const btnA = screen.getAllByTestId('ticker-choice').find((b) => b.dataset.choice === 'A')!
    expect(screen.getByTestId('ticker-tick')).toHaveTextContent('Tick 1/20')

    fireEvent.pointerDown(btnA)
    expect(screen.getByTestId('ticker-tick')).toHaveTextContent('Tick 1/20')

    fireEvent.click(btnA)
    expect(screen.getByTestId('ticker-tick')).toHaveTextContent('Tick 2/20')
  })

  it('Cmd/Ctrl+C (copy) does not commit an all-in bet on C', () => {
    mockSeed(LOSING_SEED)
    render(<GameTicker storageKey={STORAGE_KEY} />)
    expect(fireEvent.keyDown(window, { key: 'c', metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'c', ctrlKey: true })).toBe(true)
    expect(screen.getByTestId('ticker-tick')).toHaveTextContent('Tick 1/20')
  })
})
