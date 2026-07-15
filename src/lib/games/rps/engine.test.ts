import { describe, expect, it } from 'vitest'
import {
  MOVES,
  computerMove,
  judge,
  newGame,
  play,
  type Move,
} from './engine'

// rng that yields a fixed value, forcing a specific computer move index.
const rngFor = (move: Move) => () => MOVES.indexOf(move) / MOVES.length

describe('judge', () => {
  it('rock beats scissors', () => {
    expect(judge('rock', 'scissors')).toBe('win')
  })
  it('paper beats rock', () => {
    expect(judge('paper', 'rock')).toBe('win')
  })
  it('scissors beats paper', () => {
    expect(judge('scissors', 'paper')).toBe('win')
  })
  it('scissors loses to rock', () => {
    expect(judge('scissors', 'rock')).toBe('lose')
  })
  it('rock loses to paper', () => {
    expect(judge('rock', 'paper')).toBe('lose')
  })
  it('paper loses to scissors', () => {
    expect(judge('paper', 'scissors')).toBe('lose')
  })
  it('equal moves are a draw', () => {
    for (const m of MOVES) expect(judge(m, m)).toBe('draw')
  })
})

describe('computerMove', () => {
  it('maps rng buckets to the three moves', () => {
    expect(computerMove(() => 0)).toBe('rock')
    expect(computerMove(() => 0.34)).toBe('paper')
    expect(computerMove(() => 0.67)).toBe('scissors')
  })
  it('stays within MOVES for edge and out-of-range rng values', () => {
    for (const v of [0, 0.999, 1, -0.1, 1.5]) {
      expect(MOVES).toContain(computerMove(() => v))
    }
  })
})

describe('play / tallies', () => {
  it('increments wins on a winning round and records the round', () => {
    const s = play(newGame(), 'rock', rngFor('scissors'))
    expect(s.tallies).toEqual({ wins: 1, losses: 0, draws: 0 })
    expect(s.last).toEqual({ player: 'rock', computer: 'scissors', outcome: 'win' })
  })
  it('increments losses on a losing round', () => {
    const s = play(newGame(), 'rock', rngFor('paper'))
    expect(s.tallies).toEqual({ wins: 0, losses: 1, draws: 0 })
    expect(s.last?.outcome).toBe('lose')
  })
  it('increments draws on a tie', () => {
    const s = play(newGame(), 'rock', rngFor('rock'))
    expect(s.tallies).toEqual({ wins: 0, losses: 0, draws: 1 })
    expect(s.last?.outcome).toBe('draw')
  })
  it('accumulates tallies across rounds and does not mutate prior state', () => {
    const g0 = newGame()
    const g1 = play(g0, 'rock', rngFor('scissors')) // win
    const g2 = play(g1, 'rock', rngFor('paper')) // lose
    const g3 = play(g2, 'rock', rngFor('rock')) // draw
    expect(g3.tallies).toEqual({ wins: 1, losses: 1, draws: 1 })
    expect(g0.tallies).toEqual({ wins: 0, losses: 0, draws: 0 })
  })
})

describe('streak', () => {
  it('grows on consecutive wins and resets on a non-win', () => {
    let s = newGame()
    s = play(s, 'rock', rngFor('scissors'))
    expect(s.streak).toBe(1)
    s = play(s, 'rock', rngFor('scissors'))
    expect(s.streak).toBe(2)
    s = play(s, 'rock', rngFor('rock')) // draw resets
    expect(s.streak).toBe(0)
    s = play(s, 'rock', rngFor('scissors'))
    expect(s.streak).toBe(1)
    s = play(s, 'rock', rngFor('paper')) // loss resets
    expect(s.streak).toBe(0)
  })
})

describe('newGame', () => {
  it('starts with zeroed tallies and no last round', () => {
    const s = newGame()
    expect(s.tallies).toEqual({ wins: 0, losses: 0, draws: 0 })
    expect(s.last).toBeNull()
    expect(s.streak).toBe(0)
  })
})
