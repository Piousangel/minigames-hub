import { describe, expect, it } from 'vitest'
import {
  BET_STEP,
  GEM_MAX,
  GEM_MIN,
  HOT_ZONE_MULT,
  JACKPOT_MULT,
  POT_COUNT,
  POT_SIZE,
  ROUNDS,
  STARTING_BANKROLL,
  canBetPot,
  canCommit,
  computeRound,
  createGame,
  hotZonePots,
  isBusted,
  isWon,
  mulberry32,
  payoutMultiplier,
  reduce,
  remainingCount,
  remainingGems,
  type Pot,
  type StakehouseState,
} from './engine'

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).toEqual(seqB)
  })
})

describe('createGame — shape', () => {
  it('has POT_COUNT pots of POT_SIZE tokens each', () => {
    const s = createGame(1)
    expect(s.pots.length).toBe(POT_COUNT)
    for (const p of s.pots) expect(p.tokens.length).toBe(POT_SIZE)
  })

  it('each pot gem count is within [GEM_MIN, GEM_MAX] and dud fills the rest', () => {
    const s = createGame(7)
    for (const p of s.pots) {
      expect(p.initialGems).toBeGreaterThanOrEqual(GEM_MIN)
      expect(p.initialGems).toBeLessThanOrEqual(GEM_MAX)
      const dud = POT_SIZE - p.initialGems
      const gemN = p.tokens.filter((t) => t === 'gem').length
      const dudN = p.tokens.filter((t) => t === 'dud').length
      expect(gemN).toBe(p.initialGems)
      expect(dudN).toBe(dud)
    }
  })

  it('each pot token multiset matches initialGems exactly (order-independent)', () => {
    const s = createGame(9)
    for (const p of s.pots) {
      const gemN = p.tokens.filter((t) => t === 'gem').length
      expect(gemN).toBe(p.initialGems)
      expect(p.tokens.length - gemN).toBe(POT_SIZE - p.initialGems)
    }
  })

  it('GOLDEN: createGame(1) produces the exact hardcoded board', () => {
    const s = createGame(1)
    expect(s.pots.map((p) => p.initialGems)).toEqual([7, 3, 7, 4])
    expect(s.pots.map((p) => p.tokens)).toEqual([
      ['dud', 'dud', 'gem', 'gem', 'dud', 'gem', 'gem', 'gem', 'dud', 'dud', 'gem', 'gem'],
      ['dud', 'dud', 'dud', 'dud', 'dud', 'dud', 'dud', 'gem', 'dud', 'gem', 'gem', 'dud'],
      ['gem', 'dud', 'dud', 'gem', 'dud', 'gem', 'dud', 'gem', 'gem', 'gem', 'gem', 'dud'],
      ['dud', 'dud', 'dud', 'gem', 'gem', 'dud', 'dud', 'dud', 'dud', 'gem', 'gem', 'dud'],
    ])
  })

  it('GOLDEN: createGame(1) is deep-equal across calls (no hidden mutable state)', () => {
    expect(createGame(1)).toEqual(createGame(1))
  })

  it('createGame(2) differs from createGame(1)', () => {
    expect(createGame(2)).not.toEqual(createGame(1))
  })

  it('starts at STARTING_BANKROLL, round 0, betting phase, zeroed pending bets, empty history', () => {
    const s = createGame(3)
    expect(s.bankroll).toBe(STARTING_BANKROLL)
    expect(s.score).toBe(STARTING_BANKROLL)
    expect(s.round).toBe(0)
    expect(s.phase).toBe('betting')
    expect(s.pendingBets).toEqual([0, 0, 0, 0])
    expect(s.history).toEqual([])
  })
})

describe('payoutMultiplier', () => {
  it('all-gem pot pays exactly 1 (guaranteed win)', () => {
    const p: Pot = { tokens: ['gem', 'gem'], initialGems: 2, initialSize: 2 }
    expect(payoutMultiplier(p)).toBe(1)
  })

  it('gem-less pot is dead (null)', () => {
    const p: Pot = { tokens: ['dud', 'dud'], initialGems: 0, initialSize: 2 }
    expect(payoutMultiplier(p)).toBeNull()
  })

  it('3 gems in 12 tokens -> exactly 3.7', () => {
    const p: Pot = {
      tokens: ['gem', 'gem', 'gem', 'dud', 'dud', 'dud', 'dud', 'dud', 'dud', 'dud', 'dud', 'dud'],
      initialGems: 3,
      initialSize: 12,
    }
    expect(payoutMultiplier(p)).toBe(3.7)
  })

  it('monotonicity: removing a dud (gem count fixed) never raises the multiplier', () => {
    const wide: Pot = {
      tokens: Array(2).fill('gem').concat(Array(8).fill('dud')), // total 10, gem 2
      initialGems: 2,
      initialSize: 10,
    }
    const narrow: Pot = {
      tokens: Array(2).fill('gem').concat(Array(7).fill('dud')), // total 9, gem 2
      initialGems: 2,
      initialSize: 10,
    }
    const wideMult = payoutMultiplier(wide) as number
    const narrowMult = payoutMultiplier(narrow) as number
    expect(narrowMult).toBeLessThan(wideMult)
  })
})

describe('canBetPot', () => {
  it('false when tokens are empty', () => {
    expect(canBetPot({ tokens: [], initialGems: 0, initialSize: 12 })).toBe(false)
  })

  it('false when no gems remain even if tokens remain', () => {
    expect(canBetPot({ tokens: ['dud', 'dud'], initialGems: 0, initialSize: 12 })).toBe(false)
  })

  it('true for a normal mixed pot', () => {
    expect(canBetPot({ tokens: ['gem', 'dud'], initialGems: 1, initialSize: 12 })).toBe(true)
  })
})

describe('computeRound', () => {
  it('does not mutate its inputs', () => {
    const pots: Pot[] = [
      { tokens: ['gem', 'dud'], initialGems: 1, initialSize: 2 },
      { tokens: ['dud', 'gem'], initialGems: 1, initialSize: 2 },
    ]
    const before = JSON.parse(JSON.stringify(pots))
    const bets = [5, 5]
    const betsBefore = [...bets]
    computeRound(pots, bets)
    expect(pots).toEqual(before)
    expect(bets).toEqual(betsBefore)
  })

  it('GOLDEN: hand-built 4-pot round matches hand-computed drawn/multipliers/winnings/pots', () => {
    const pots: Pot[] = [
      { tokens: ['gem', 'dud'], initialGems: 1, initialSize: 2 }, // A: tail dud
      { tokens: ['dud', 'gem'], initialGems: 1, initialSize: 2 }, // B: tail gem
      { tokens: [], initialGems: 0, initialSize: 2 }, // C: already empty
      { tokens: ['gem', 'gem'], initialGems: 2, initialSize: 2 }, // D: tail gem, all-gem
    ]
    const bets = [5, 5, 5, 0]
    const out = computeRound(pots, bets)
    expect(out.drawn).toEqual(['dud', 'gem', null, 'gem'])
    expect(out.multipliers).toEqual([1.9, 1.9, null, 1])
    expect(out.winnings).toEqual([0, 10, 0, 0])
    expect(out.pots.map((p) => p.tokens)).toEqual([['gem'], ['dud'], [], ['gem']])
  })

  it('a jar with bet=0 pays 0 even when it draws a gem', () => {
    const pots: Pot[] = [{ tokens: ['gem'], initialGems: 1, initialSize: 1 }]
    const out = computeRound(pots, [0])
    expect(out.drawn).toEqual(['gem'])
    expect(out.winnings).toEqual([0])
  })

  it('a bet jar that draws a dud pays 0, never negative', () => {
    const pots: Pot[] = [{ tokens: ['dud'], initialGems: 0, initialSize: 1 }]
    const out = computeRound(pots, [20])
    expect(out.drawn).toEqual(['dud'])
    expect(out.winnings).toEqual([0])
  })
})

describe('reducer: setBet', () => {
  it('rejects a negative amount (no-op)', () => {
    const s = createGame(1)
    const next = reduce(s, { type: 'setBet', pot: 0, amount: -5 })
    expect(next.pendingBets).toEqual(s.pendingBets)
    expect(next.pendingBets).toEqual([0, 0, 0, 0])
  })

  it('rejects a non-integer amount (no-op)', () => {
    const s = createGame(1)
    const next = reduce(s, { type: 'setBet', pot: 0, amount: 2.5 })
    expect(next.pendingBets).toEqual(s.pendingBets)
  })

  it('rejects when the new total exceeds bankroll (no-op)', () => {
    let s = createGame(1)
    s = reduce(s, { type: 'setBet', pot: 0, amount: 60 })
    const next = reduce(s, { type: 'setBet', pot: 1, amount: 60 })
    expect(next.pendingBets).toEqual(s.pendingBets)
    expect(next.lastEvent).toBe('none')
  })

  it('rejects betting on a dead (gem-less) pot (no-op)', () => {
    const s = createGame(1)
    const deadPots = s.pots.map((p, i) =>
      i === 0 ? { ...p, tokens: p.tokens.map(() => 'dud' as const), initialGems: 0 } : p,
    )
    const forced: StakehouseState = { ...s, pots: deadPots }
    const next = reduce(forced, { type: 'setBet', pot: 0, amount: 10 })
    expect(next.pendingBets).toEqual(forced.pendingBets)
    expect(next.lastEvent).toBe('none')
  })

  it('accepts a valid bet and records lastEvent bet', () => {
    const s = createGame(1)
    const next = reduce(s, { type: 'setBet', pot: 2, amount: 15 })
    expect(next.pendingBets).toEqual([0, 0, 15, 0])
    expect(next.lastEvent).toBe('bet')
  })
})

describe('reducer: allIn', () => {
  it('assigns all unallocated bankroll to the target pot; a further allIn elsewhere is a no-op', () => {
    let s = createGame(1)
    s = reduce(s, { type: 'allIn', pot: 0 })
    expect(s.pendingBets[0]).toBe(STARTING_BANKROLL)
    const before = s.pendingBets
    const next = reduce(s, { type: 'allIn', pot: 1 })
    expect(next.pendingBets).toEqual(before)
    expect(next.lastEvent).toBe('none')
  })
})

describe('reducer: clearBets', () => {
  it('zeroes a non-zero allocation', () => {
    let s = createGame(1)
    s = reduce(s, { type: 'setBet', pot: 0, amount: 10 })
    s = reduce(s, { type: 'setBet', pot: 1, amount: 20 })
    const next = reduce(s, { type: 'clearBets' })
    expect(next.pendingBets).toEqual([0, 0, 0, 0])
    expect(next.lastEvent).toBe('clear')
  })
})

describe('reducer: commit', () => {
  it('a 0-bet sit-out round: bankroll unchanged, round+1, every pot -1 token, stays betting', () => {
    const s = createGame(1)
    const next = reduce(s, { type: 'commit' })
    expect(next.bankroll).toBe(STARTING_BANKROLL)
    expect(next.round).toBe(1)
    for (let i = 0; i < POT_COUNT; i++) {
      expect(next.pots[i].tokens.length).toBe(s.pots[i].tokens.length - 1)
    }
    expect(next.phase).toBe('betting')
    expect(next.lastEvent).toBe('even')
  })

  it('GOLDEN E2E: createGame(1) + a specific bet allocation commits to hand-computed results', () => {
    let s = createGame(1)
    s = reduce(s, { type: 'setBet', pot: 0, amount: 10 })
    s = reduce(s, { type: 'setBet', pot: 1, amount: 10 })
    s = reduce(s, { type: 'setBet', pot: 3, amount: 5 })
    expect(s.pendingBets).toEqual([10, 10, 0, 5])

    const next = reduce(s, { type: 'commit' })
    expect(next.history.length).toBe(1)
    const result = next.history[0]
    expect(result.round).toBe(1)
    expect(result.bets).toEqual([10, 10, 0, 5])
    expect(result.multipliers).toEqual([1.64, 3.7, 1.64, 2.8])
    expect(result.drawn).toEqual(['gem', 'dud', 'dud', 'dud'])
    expect(result.winnings).toEqual([16, 0, 0, 0])
    expect(result.bankrollBefore).toBe(100)
    expect(result.bankrollAfter).toBe(91)
    expect(next.bankroll).toBe(91)
    expect(next.score).toBe(91)
    expect(next.lastEvent).toBe('lose')
    expect(next.pendingBets).toEqual([0, 0, 0, 0])
  })

  it('rejects commit when pendingBets exceed bankroll or are malformed (no-op)', () => {
    const s = createGame(1)
    const forced: StakehouseState = { ...s, pendingBets: [1000, 0, 0, 0] }
    const next = reduce(forced, { type: 'commit' })
    expect(next).toEqual({ ...forced, lastEvent: 'none' })
  })

  it('bankroll hitting exactly 0 -> busted, and further commit/setBet become no-ops', () => {
    // Hand-built state: pot0 is a guaranteed dud (dead-certain loss), the rest already
    // exhausted. Betting the whole bankroll on pot0 must zero it out deterministically.
    const forced: StakehouseState = {
      seed: 1,
      pots: [
        { tokens: ['dud'], initialGems: 0, initialSize: 1 },
        { tokens: [], initialGems: 0, initialSize: 1 },
        { tokens: [], initialGems: 0, initialSize: 1 },
        { tokens: [], initialGems: 0, initialSize: 1 },
      ],
      bankroll: 10,
      round: 11,
      pendingBets: [10, 0, 0, 0],
      history: [],
      score: 10,
      phase: 'betting',
      lastEvent: 'none',
    }
    const busted = reduce(forced, { type: 'commit' })
    expect(busted.bankroll).toBe(0)
    expect(busted.phase).toBe('busted')
    expect(busted.lastEvent).toBe('busted')

    const noopCommit = reduce(busted, { type: 'commit' })
    expect(noopCommit).toEqual({ ...busted, lastEvent: 'none' })
    const noopBet = reduce(busted, { type: 'setBet', pot: 1, amount: 5 })
    expect(noopBet.pendingBets).toEqual(busted.pendingBets)
  })

  it('12 consecutive 0-bet commits complete the game with bankroll untouched', () => {
    let s = createGame(4)
    for (let i = 0; i < ROUNDS; i++) {
      s = reduce(s, { type: 'commit' })
    }
    expect(s.phase).toBe('complete')
    expect(s.round).toBe(ROUNDS)
    expect(s.bankroll).toBe(STARTING_BANKROLL)
    for (const p of s.pots) expect(p.tokens.length).toBe(0)
    expect(s.lastEvent).toBe('complete')
  })
})

describe('reducer: reset / new', () => {
  it('reset restores createGame(seed) exactly, discarding progress', () => {
    let s = createGame(5)
    s = reduce(s, { type: 'setBet', pot: 0, amount: 10 })
    s = reduce(s, { type: 'commit' })
    s = reduce(s, { type: 'setBet', pot: 1, amount: 5 })
    const reset = reduce(s, { type: 'reset' })
    expect(reset).toEqual(createGame(s.seed))
  })

  it('new(seed) produces a different board and resets round/bankroll/phase', () => {
    let s = createGame(1)
    s = reduce(s, { type: 'commit' })
    const next = reduce(s, { type: 'new', seed: 2 })
    expect(next.pots).not.toEqual(s.pots)
    expect(next.round).toBe(0)
    expect(next.bankroll).toBe(STARTING_BANKROLL)
    expect(next.phase).toBe('betting')
  })
})

describe('bankroll conservation property', () => {
  it('bankrollAfter === bankrollBefore - totalBet + totalWinnings for several rounds', () => {
    let s = createGame(11)
    for (let round = 0; round < 3; round++) {
      s = reduce(s, { type: 'setBet', pot: round % POT_COUNT, amount: BET_STEP })
      const before = s
      s = reduce(s, { type: 'commit' })
      const result = s.history[s.history.length - 1]
      const totalBet = result.bets.reduce((a, b) => a + b, 0)
      const totalWinnings = result.winnings.reduce((a, b) => a + b, 0)
      expect(result.bankrollAfter).toBe(result.bankrollBefore - totalBet + totalWinnings)
      expect(result.bankrollBefore).toBe(before.bankroll)
      expect(s.bankroll).toBe(result.bankrollAfter)
      if (s.phase !== 'betting') break
    }
  })
})

describe('hotZonePots', () => {
  it('marks only the pot(s) at/above HOT_ZONE_MULT', () => {
    const s = createGame(1)
    // pot1 at seed 1 has 3/12 gems -> multiplier 3.7 >= HOT_ZONE_MULT(3.0); others (7/12, 7/12, 4/12) are below.
    const flags = hotZonePots(s)
    expect(flags).toEqual([false, true, false, false])
    expect(payoutMultiplier(s.pots[1])).toBeGreaterThanOrEqual(HOT_ZONE_MULT)
  })
})

describe('isWon / isBusted', () => {
  it('matches phase exactly across constructed states', () => {
    const betting = createGame(1)
    expect(isWon(betting)).toBe(false)
    expect(isBusted(betting)).toBe(false)

    const won: StakehouseState = { ...betting, phase: 'complete' }
    expect(isWon(won)).toBe(true)
    expect(isBusted(won)).toBe(false)

    const lost: StakehouseState = { ...betting, phase: 'busted' }
    expect(isWon(lost)).toBe(false)
    expect(isBusted(lost)).toBe(true)
  })
})

describe('canCommit', () => {
  it('true for a 0-bet betting-phase state; false once phase is terminal', () => {
    const s = createGame(1)
    expect(canCommit(s)).toBe(true)
    const terminal: StakehouseState = { ...s, phase: 'complete' }
    expect(canCommit(terminal)).toBe(false)
  })

  it('false when pendingBets exceed bankroll', () => {
    const s = createGame(1)
    const forced: StakehouseState = { ...s, pendingBets: [1000, 0, 0, 0] }
    expect(canCommit(forced)).toBe(false)
  })
})

describe('remainingGems / remainingCount', () => {
  it('remainingGems never exceeds remainingCount', () => {
    const s = createGame(6)
    for (const p of s.pots) {
      expect(remainingGems(p)).toBeLessThanOrEqual(remainingCount(p))
    }
  })
})

// JACKPOT_MULT is exercised indirectly via the payoutMultiplier/HOT_ZONE_MULT tests above;
// this assert just pins the constant relationship the spec requires (jackpot >= hot zone).
describe('constants sanity', () => {
  it('JACKPOT_MULT is at least HOT_ZONE_MULT', () => {
    expect(JACKPOT_MULT).toBeGreaterThanOrEqual(HOT_ZONE_MULT)
  })
})
