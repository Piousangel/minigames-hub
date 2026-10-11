import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { VALID_GUESSES, dailySeed, mulberry32, newGame } from '@/lib/games/wordguess/engine'
import { todayUTC } from '@/lib/dailyDate'
import { GameWordGuess } from './GameWordGuess'

const STORAGE_KEY = 'best:word-guess'

const dailyAnswer = () => newGame(mulberry32(dailySeed(todayUTC()))).answer

/** Valid words that are not today's answer (so they never win). */
function wrongWords(n: number): string[] {
  const answer = dailyAnswer()
  const out: string[] = []
  for (const w of VALID_GUESSES) {
    if (w !== answer) out.push(w)
    if (out.length === n) break
  }
  return out
}

function type(word: string) {
  for (const ch of word) fireEvent.keyDown(window, { key: ch })
  fireEvent.keyDown(window, { key: 'Enter' })
  act(() => {
    vi.advanceTimersByTime(3000) // past the flip reveal
  })
}

const rowText = (i: number) => screen.getAllByTestId('wordguess-row')[i].textContent
const wins = () => screen.getByText('Wins').parentElement?.textContent ?? ''

describe('GameWordGuess daily integrity', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('a lost daily cannot be replayed and re-won for streak/wins (no Replay Daily; remount restores the loss)', () => {
    const { unmount } = render(<GameWordGuess storageKey={STORAGE_KEY} />)
    for (const w of wrongWords(6)) type(w)
    expect(screen.getByTestId('wordguess-lose')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Replay Daily' })).not.toBeInTheDocument()

    // Header "new game" in daily mode leads to practice — it never resets today's daily.
    unmount()
    render(<GameWordGuess storageKey={STORAGE_KEY} />)
    expect(screen.getByTestId('wordguess-lose')).toBeInTheDocument()
    expect(rowText(5)?.toLowerCase()).toBe(wrongWords(6)[5])
    // The board is finished — typing the answer now does nothing.
    type(dailyAnswer())
    expect(screen.queryByTestId('wordguess-win')).not.toBeInTheDocument()
    expect(screen.getByTestId('day-streak')).toHaveTextContent('0')
  })

  it('in-progress daily guesses survive a reload and a Practice round-trip', () => {
    const [a, b] = wrongWords(2)
    const { unmount } = render(<GameWordGuess storageKey={STORAGE_KEY} />)
    type(a)
    type(b)
    unmount()
    render(<GameWordGuess storageKey={STORAGE_KEY} />)
    expect(rowText(0)?.toLowerCase()).toBe(a)
    expect(rowText(1)?.toLowerCase()).toBe(b)

    fireEvent.click(screen.getByRole('button', { name: 'practice' }))
    expect(rowText(0)).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'daily' }))
    expect(rowText(0)?.toLowerCase()).toBe(a)
    expect(rowText(1)?.toLowerCase()).toBe(b)
    expect(rowText(2)).toBe('')
  })

  it('a daily win counts once: streak 1 / wins 1, and a reload does not count it again', () => {
    const { unmount } = render(<GameWordGuess storageKey={STORAGE_KEY} />)
    type(dailyAnswer())
    expect(screen.getByTestId('wordguess-win')).toBeInTheDocument()
    expect(screen.getByTestId('day-streak')).toHaveTextContent('1')
    expect(wins()).toContain('1')
    unmount()
    render(<GameWordGuess storageKey={STORAGE_KEY} />)
    expect(screen.getByTestId('wordguess-win')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ wins: 1, streak: 1 })
    expect(screen.getByTestId('day-streak')).toHaveTextContent('1')
  })

  it('a daily finished mid-reveal (reload before the flip ends) is still recorded exactly once', () => {
    const { unmount } = render(<GameWordGuess storageKey={STORAGE_KEY} />)
    for (const ch of dailyAnswer()) fireEvent.keyDown(window, { key: ch })
    fireEvent.keyDown(window, { key: 'Enter' })
    unmount() // reveal timers cleared before finishEnd ran
    render(<GameWordGuess storageKey={STORAGE_KEY} />)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ wins: 1, streak: 1 })
    expect(screen.getByTestId('day-streak')).toHaveTextContent('1')
    render(<GameWordGuess storageKey={STORAGE_KEY} />)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ wins: 1, streak: 1 })
  })

  it('Practice round-trip after a lost daily (overlay button, header button, mode toggle) never reopens it', () => {
    render(<GameWordGuess storageKey={STORAGE_KEY} />)
    for (const w of wrongWords(6)) type(w)
    expect(screen.getByTestId('wordguess-lose')).toBeInTheDocument()
    const before = localStorage.getItem(STORAGE_KEY)

    fireEvent.click(screen.getByRole('button', { name: 'Play Practice' }))
    expect(screen.queryByTestId('wordguess-lose')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'daily' }))
    expect(screen.getByTestId('wordguess-lose')).toBeInTheDocument()

    // Header button in daily mode also goes to practice, never resets the daily.
    fireEvent.click(screen.getByRole('button', { name: 'Practice' }))
    expect(screen.getByRole('button', { name: 'practice' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'daily' }))
    expect(screen.getByTestId('wordguess-lose')).toBeInTheDocument()
    type(dailyAnswer())
    expect(screen.queryByTestId('wordguess-win')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })

  it('switching to Practice mid-reveal of a winning daily still counts it exactly once on return', () => {
    render(<GameWordGuess storageKey={STORAGE_KEY} />)
    for (const ch of dailyAnswer()) fireEvent.keyDown(window, { key: ch })
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'practice' })) // cancels the reveal timers
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'daily' }))
    expect(screen.getByTestId('wordguess-win')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ wins: 1, streak: 1 })
    expect(screen.getByTestId('day-streak')).toHaveTextContent('1')
    fireEvent.click(screen.getByRole('button', { name: 'practice' }))
    fireEvent.click(screen.getByRole('button', { name: 'daily' }))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ wins: 1, streak: 1 })
  })

  it("yesterday's save is ignored (fresh board today)", () => {
    localStorage.setItem(
      `${STORAGE_KEY}:daily`,
      JSON.stringify({ date: '2000-01-01', answer: dailyAnswer(), guesses: wrongWords(1), recorded: true }),
    )
    render(<GameWordGuess storageKey={STORAGE_KEY} />)
    expect(rowText(0)).toBe('')
  })

  it('practice keeps unlimited New Game', () => {
    render(<GameWordGuess storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByRole('button', { name: 'practice' }))
    for (const w of wrongWords(6)) type(w)
    expect(screen.getByTestId('wordguess-lose')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.queryByTestId('wordguess-lose')).not.toBeInTheDocument()
    expect(rowText(0)).toBe('')
  })
})
