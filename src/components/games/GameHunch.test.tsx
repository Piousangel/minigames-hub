import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { challengeQuery } from '@/lib/challenge'
import { createGame, judge, prevCard, reduce, type HunchAction, type HunchState } from '@/lib/games/hunch/engine'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

import { sendHit } from '@/lib/hit'
import { GameHunch } from './GameHunch'

const STORAGE_KEY = 'best:hunch'
const SEED = 424242

/**
 * Drives the UI and a mirror engine in lockstep — the mirror (same seed) tells
 * the test each probe's true verdict, proving the challenge run replays the seed.
 */
function driver(seed = SEED) {
  let mirror: HunchState = createGame(seed)
  const step = (a: HunchAction) => {
    mirror = reduce(mirror, a)
  }
  return {
    get state() {
      return mirror
    },
    testFirstCard() {
      const card = screen.getAllByTestId('hunch-card')[0]
      fireEvent.click(card) // select
      fireEvent.click(card) // play
      step({ type: 'play', index: 0 })
    },
    predict() {
      fireEvent.click(screen.getByTestId('hunch-predict'))
      step({ type: 'predict' })
    },
    answer(correct: boolean) {
      const truth = judge(mirror.stages[mirror.stageIndex].ruleId, prevCard(mirror), mirror.probe!.id)
      const accept = correct ? truth : !truth
      fireEvent.click(screen.getByTestId(accept ? 'hunch-accept' : 'hunch-reject'))
      step({ type: 'answer', accept })
    },
    nextStage() {
      fireEvent.click(screen.getByRole('button', { name: /Next rule/ }))
      step({ type: 'nextStage' })
    },
  }
}

function openChallenge(score: number) {
  window.history.replaceState(null, '', `/hunch?${challengeQuery({ seed: SEED, score, name: 'Ana' })}`)
}

describe('GameHunch challenge links', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(sendHit).mockClear()
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('?vs= shows the banner, replays the seed and a lost run never writes best', () => {
    openChallenge(50)
    render(<GameHunch storageKey={STORAGE_KEY} />)
    const banner = screen.getByTestId('challenge-banner')
    expect(banner).toHaveTextContent('Ana scored 50 on this exact run. Beat it!')
    expect(banner).toHaveTextContent("Challenge runs don't count toward your best.")
    expect(screen.queryByRole('button', { name: 'Daily' })).not.toBeInTheDocument()

    const d = driver()
    d.testFirstCard()
    expect(screen.queryByTestId('challenge-leave')).not.toBeInTheDocument() // hidden mid-run
    d.predict()
    d.answer(true) // +10
    d.answer(false)
    d.predict()
    d.answer(false)
    d.predict()
    d.answer(false)
    expect(d.state.phase).toBe('lost')

    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(screen.getByTestId('challenge-result')).toHaveTextContent('40 short of 50')
    expect(screen.getByTestId('challenge-share')).toHaveTextContent('Challenge a friend')
    expect(screen.getAllByRole('button', { name: 'Rematch' }).length).toBeGreaterThan(0)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(sendHit).toHaveBeenCalledWith('hunch', 'challenge-done')
  })

  it('a won challenge run beats the link score but bumps neither best nor the daily streak', () => {
    openChallenge(100)
    render(<GameHunch storageKey={STORAGE_KEY} />)
    const d = driver()
    for (let guard = 0; guard < 100 && d.state.phase !== 'won'; guard++) {
      if (d.state.phase === 'stageClear') d.nextStage()
      else if (d.state.phase === 'test') {
        if (d.state.tests === 0) d.testFirstCard()
        else d.predict()
      } else d.answer(true)
    }
    expect(d.state.phase).toBe('won')
    const overlay = screen.getByTestId('you-win')
    expect(overlay).toHaveTextContent('You beat Ana!')
    expect(screen.getByTestId('challenge-share')).toHaveTextContent('Send it back to Ana')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('hunch:daily')).toBeNull()
    expect(sendHit).toHaveBeenCalledWith('hunch', 'challenge-done')
  })

  it('Play solo clears the challenge params and drops the banner', () => {
    openChallenge(50)
    render(<GameHunch storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByTestId('challenge-leave'))
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    expect(window.location.search).toBe('')
    expect(screen.getByRole('button', { name: 'Practice' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('without ?vs= a finished run writes best as before', () => {
    render(<GameHunch storageKey={STORAGE_KEY} />)
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    const now = new Date()
    const d = driver(now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate())
    d.testFirstCard()
    d.predict()
    d.answer(true)
    for (let i = 0; i < 3; i++) {
      if (d.state.phase === 'test') d.predict()
      d.answer(false)
    }
    expect(d.state.phase).toBe('lost')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('10')
    expect(sendHit).not.toHaveBeenCalledWith('hunch', 'challenge-done')
  })
})
