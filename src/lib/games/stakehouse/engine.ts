/**
 * Stakehouse — pure engine.
 *
 * Four jars each hold a fixed number of tokens (gem/dud), fully visible to the
 * player at all times. Each round, the player distributes chips across the
 * jars, then all four jars simultaneously pop one token from the top of their
 * (pre-shuffled) stack. A gem pays out at a multiplier derived purely from how
 * many gems remain vs. how many tokens remain in that jar — no house trickery,
 * the odds are exactly what's on the label.
 *
 * Randomness is consumed ONLY inside `createGame` (jar composition + shuffle).
 * `computeRound` and `reduce` never touch the injected `Rng` — round
 * resolution is a pure pop off an already-shuffled array, which is what makes
 * this game golden-testable end to end.
 */

export const POT_COUNT = 4 // jars
export const POT_SIZE = 12 // tokens per jar (gem+dud), identical across jars
export const ROUNDS = POT_SIZE // 12 rounds — every round all 4 jars pop 1, so they empty in lockstep
export const GEM_MIN = 3 // lower bound on a jar's initial gem count
export const GEM_MAX = 9 // upper bound
export const STARTING_BANKROLL = 100
export const HOUSE_EDGE = 0.9 // payout-multiplier shrink factor, see payoutMultiplier()
export const BET_STEP = 5 // stepper click increment
export const HOT_ZONE_MULT = 3.0 // multiplier at/above which a jar is visually "hot"
export const JACKPOT_MULT = 5.0 // multiplier at/above which a win is a jackpot event

export type Rng = () => number // [0,1)

export type Token = 'gem' | 'dud'

export interface Pot {
  tokens: Token[] // remaining (undrawn) tokens; the array's tail is the next pop.
  initialGems: number // gem count at creation (display/debug only, immutable)
  initialSize: number // === POT_SIZE (immutable)
}

export type Phase = 'betting' | 'busted' | 'complete'

export interface RoundResult {
  round: number // 1-based, the round that was just settled
  bets: number[] // length POT_COUNT — chips wagered on each jar this round
  multipliers: (number | null)[] // length POT_COUNT — payoutMultiplier just before the pop, always recorded regardless of bet, null for a dead jar
  drawn: (Token | null)[] // length POT_COUNT — token popped this round, null if the jar was already empty
  winnings: number[] // length POT_COUNT — chips paid out per jar (0 if no bet / no win)
  bankrollBefore: number
  bankrollAfter: number
}

export type StakehouseEvent =
  | 'none'
  | 'bet' // setBet succeeded
  | 'clear' // clearBets
  | 'win' // commit: totalWinnings > totalBet
  | 'lose' // commit: totalWinnings < totalBet
  | 'even' // commit: totalWinnings === totalBet (incl. 0-bet rounds)
  | 'jackpot' // commit: a winning jar had multiplier >= JACKPOT_MULT (takes priority over win/lose/even)
  | 'busted' // commit transitioned phase to 'busted'
  | 'complete' // commit transitioned phase to 'complete'

export interface StakehouseState {
  seed: number
  pots: Pot[] // length POT_COUNT
  bankroll: number // integer, never negative
  round: number // 0..ROUNDS, rounds settled so far
  pendingBets: number[] // length POT_COUNT, draft allocation for the next commit
  history: RoundResult[] // oldest -> newest, at most ROUNDS entries
  score: number // === bankroll; alias kept for cross-engine field-name convention
  phase: Phase
  lastEvent: StakehouseEvent
}

export type StakehouseAction =
  | { type: 'setBet'; pot: number; amount: number } // absolute value, not an increment
  | { type: 'allIn'; pot: number } // all unallocated bankroll onto this jar
  | { type: 'clearBets' }
  | { type: 'commit' } // lock in pendingBets, settle the round
  | { type: 'reset' } // restart with the same seed
  | { type: 'new'; seed: number }

/** Identical impl to the template's mulberry32 (copied locally — no cross-game imports). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// -- Pure primitives --------------------------------------------------------

/** Builds one shuffled pot. Consumes exactly 1 + (size-1) rng calls. New array, no input mutation. */
function makePot(size: number, gemCount: number, rng: Rng): Pot {
  const tokens: Token[] = []
  for (let i = 0; i < gemCount; i++) tokens.push('gem')
  for (let i = 0; i < size - gemCount; i++) tokens.push('dud')
  // Fisher-Yates, j = size-1 down to 1
  for (let j = tokens.length - 1; j >= 1; j--) {
    const k = Math.floor(rng() * (j + 1))
    const tmp = tokens[j]
    tokens[j] = tokens[k]
    tokens[k] = tmp
  }
  return { tokens, initialGems: gemCount, initialSize: size }
}

export function createGame(seed: number): StakehouseState {
  const rng = mulberry32(seed)
  const pots: Pot[] = []
  for (let i = 0; i < POT_COUNT; i++) {
    const gemCount = GEM_MIN + Math.floor(rng() * (GEM_MAX - GEM_MIN + 1))
    pots.push(makePot(POT_SIZE, gemCount, rng))
  }
  return {
    seed,
    pots,
    bankroll: STARTING_BANKROLL,
    round: 0,
    pendingBets: Array(POT_COUNT).fill(0),
    history: [],
    score: STARTING_BANKROLL,
    phase: 'betting',
    lastEvent: 'none',
  }
}

export function remainingGems(pot: Pot): number {
  let n = 0
  for (const t of pot.tokens) if (t === 'gem') n++
  return n
}

export function remainingCount(pot: Pot): number {
  return pot.tokens.length
}

/** null when the jar is dead (no gems left to win); otherwise >= 1, rounded to 2 decimals. */
export function payoutMultiplier(pot: Pot): number | null {
  const gems = remainingGems(pot)
  if (gems === 0) return null
  const total = remainingCount(pot)
  const fair = total / gems
  const raw = 1 + (fair - 1) * HOUSE_EDGE
  return Math.round(raw * 100) / 100
}

export function canBetPot(pot: Pot): boolean {
  return remainingCount(pot) > 0 && remainingGems(pot) > 0
}

export function hotZonePots(state: StakehouseState): boolean[] {
  return state.pots.map((p) => canBetPot(p) && (payoutMultiplier(p) as number) >= HOT_ZONE_MULT)
}

function totalPending(bets: number[]): number {
  let sum = 0
  for (const b of bets) sum += b
  return sum
}

export function canCommit(state: StakehouseState): boolean {
  return (
    state.phase === 'betting' &&
    state.pendingBets.every((n) => Number.isInteger(n) && n >= 0) &&
    totalPending(state.pendingBets) <= state.bankroll
  )
}

/**
 * Resolve one round: every jar with tokens left pops its tail token. Pure —
 * consumes no rng (the jars are already shuffled). Does not mutate inputs.
 */
export function computeRound(
  pots: Pot[],
  bets: number[],
): { pots: Pot[]; drawn: (Token | null)[]; multipliers: (number | null)[]; winnings: number[] } {
  const outPots: Pot[] = []
  const drawn: (Token | null)[] = []
  const multipliers: (number | null)[] = []
  const winnings: number[] = []

  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i]
    if (pot.tokens.length === 0) {
      outPots.push(pot)
      drawn.push(null)
      multipliers.push(null)
      winnings.push(0)
      continue
    }
    const mult = payoutMultiplier(pot)
    const drawnToken = pot.tokens[pot.tokens.length - 1]
    const newTokens = pot.tokens.slice(0, -1)
    const bet = bets[i]
    const win = bet > 0 && drawnToken === 'gem' ? Math.round(bet * (mult as number)) : 0
    outPots.push({ ...pot, tokens: newTokens })
    drawn.push(drawnToken)
    multipliers.push(mult)
    winnings.push(win)
  }

  return { pots: outPots, drawn, multipliers, winnings }
}

export function reduce(state: StakehouseState, action: StakehouseAction): StakehouseState {
  switch (action.type) {
    case 'setBet': {
      if (state.phase !== 'betting') return { ...state, lastEvent: 'none' }
      const { pot, amount } = action
      if (pot < 0 || pot >= state.pots.length) return { ...state, lastEvent: 'none' }
      if (!Number.isInteger(amount) || amount < 0) return { ...state, lastEvent: 'none' }
      if (!canBetPot(state.pots[pot])) return { ...state, lastEvent: 'none' }
      const nextBets = state.pendingBets.slice()
      nextBets[pot] = amount
      if (totalPending(nextBets) > state.bankroll) return { ...state, lastEvent: 'none' }
      return { ...state, pendingBets: nextBets, lastEvent: 'bet' }
    }
    case 'allIn': {
      if (state.phase !== 'betting') return { ...state, lastEvent: 'none' }
      const { pot } = action
      if (pot < 0 || pot >= state.pots.length) return { ...state, lastEvent: 'none' }
      if (!canBetPot(state.pots[pot])) return { ...state, lastEvent: 'none' }
      let othersTotal = 0
      for (let i = 0; i < state.pendingBets.length; i++) {
        if (i !== pot) othersTotal += state.pendingBets[i]
      }
      const available = state.bankroll - othersTotal
      if (available <= 0) return { ...state, lastEvent: 'none' }
      const nextBets = state.pendingBets.slice()
      nextBets[pot] = available
      return { ...state, pendingBets: nextBets, lastEvent: 'bet' }
    }
    case 'clearBets': {
      return { ...state, pendingBets: Array(state.pots.length).fill(0), lastEvent: 'clear' }
    }
    case 'commit': {
      if (!canCommit(state)) return { ...state, lastEvent: 'none' }
      const bets = state.pendingBets
      const totalBet = totalPending(bets)
      const bankrollAfterBet = state.bankroll - totalBet
      const outcome = computeRound(state.pots, bets)
      const totalWinnings = outcome.winnings.reduce((a, b) => a + b, 0)
      const bankrollAfter = bankrollAfterBet + totalWinnings
      const round = state.round + 1

      const result: RoundResult = {
        round,
        bets: bets.slice(),
        multipliers: outcome.multipliers,
        drawn: outcome.drawn,
        winnings: outcome.winnings,
        bankrollBefore: state.bankroll,
        bankrollAfter,
      }
      const history = [...state.history, result]

      let phase: Phase
      if (bankrollAfter === 0) phase = 'busted'
      else if (round === ROUNDS) phase = 'complete'
      else phase = 'betting'

      let lastEvent: StakehouseEvent
      if (phase === 'busted') {
        lastEvent = 'busted'
      } else if (phase === 'complete') {
        lastEvent = 'complete'
      } else {
        const jackpot = outcome.winnings.some(
          (w, i) => w > 0 && (outcome.multipliers[i] ?? 0) >= JACKPOT_MULT,
        )
        if (jackpot) lastEvent = 'jackpot'
        else if (totalWinnings > totalBet) lastEvent = 'win'
        else if (totalWinnings < totalBet) lastEvent = 'lose'
        else lastEvent = 'even'
      }

      return {
        ...state,
        pots: outcome.pots,
        bankroll: bankrollAfter,
        round,
        pendingBets: Array(state.pots.length).fill(0),
        history,
        score: bankrollAfter,
        phase,
        lastEvent,
      }
    }
    case 'reset':
      return createGame(state.seed)
    case 'new':
      return createGame(action.seed)
    default:
      return state
  }
}

export function isWon(state: StakehouseState): boolean {
  return state.phase === 'complete'
}

export function isBusted(state: StakehouseState): boolean {
  return state.phase === 'busted'
}
