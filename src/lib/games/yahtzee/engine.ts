/**
 * Yahtzee — classic solo 5-dice score-category game, pure engine.
 *
 * Each turn: roll 5 dice, then re-roll any non-held subset up to 2 more times
 * (3 rolls total), HOLDING dice between rolls. After rolling you assign the
 * result to ONE unused category. 13 categories → 13 turns → game over.
 *
 * PURITY: every function here is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through the mulberry32 PRNG whose state
 * is carried in `State.rngState` and advanced deterministically inside `roll`.
 * All move functions are (state, …) -> state and REJECT illegal moves by
 * returning the SAME reference (so callers/tests can assert a no-op with `===`).
 * This makes the whole game golden-testable from a fixed seed + a scripted
 * sequence of moves.
 */

export type Rng = () => number // float in [0,1)

// -- PRNG (byte-identical to the solitaire template's mulberry32) -------------

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

/**
 * Pure single step of mulberry32: takes the previous internal state and returns
 * `[value in [0,1), nextState]`. Byte-identical to one call of the closure form
 * above, so `createGame(seed)` + `roll` is a golden, replayable sequence.
 */
export function mulberry32Step(prev: number): [number, number] {
  let a = prev | 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, a]
}

/** Map a float in [0,1) to a die face 1..6. */
export function dieFromFloat(v: number): number {
  return Math.floor(v * 6) + 1
}

// -- Categories --------------------------------------------------------------

export type UpperCategory = 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes'
export type LowerCategory =
  | 'threeKind'
  | 'fourKind'
  | 'fullHouse'
  | 'smallStraight'
  | 'largeStraight'
  | 'yahtzee'
  | 'chance'
export type Category = UpperCategory | LowerCategory

export const UPPER_CATEGORIES: readonly UpperCategory[] = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
]
export const LOWER_CATEGORIES: readonly LowerCategory[] = [
  'threeKind',
  'fourKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
]
export const ALL_CATEGORIES: readonly Category[] = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES]

/** Face value each upper category matches (ones→1 … sixes→6). */
const UPPER_FACE: Record<UpperCategory, number> = {
  ones: 1,
  twos: 2,
  threes: 3,
  fours: 4,
  fives: 5,
  sixes: 6,
}

export const UPPER_BONUS_THRESHOLD = 63
export const UPPER_BONUS = 35
export const YAHTZEE_BONUS = 100
export const NUM_DICE = 5
export const MAX_ROLLS = 3
export const NUM_TURNS = ALL_CATEGORIES.length // 13

export type ScoreMap = Record<Category, number | null>

// -- State -------------------------------------------------------------------

export type Status = 'playing' | 'over'

export interface State {
  dice: number[] // 5 die faces (1..6)
  held: boolean[] // 5 hold flags — reset each turn
  rollsLeft: number // rolls remaining THIS turn (starts MAX_ROLLS)
  rolled: boolean // has the player rolled at least once this turn?
  scores: ScoreMap // null = unused category, number = locked score
  yahtzeeBonus: number // accumulated +100 bonuses for extra yahtzees
  turn: number // completed turns (0..13)
  status: Status
  rngState: number // mulberry32 internal state (advances on every reroll)
}

// -- Pure scoring functions (each takes a plain dice array) -------------------

/** counts[f] = how many dice show face f (index 1..6; index 0 unused). */
export function counts(dice: number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0]
  for (const d of dice) if (d >= 1 && d <= 6) c[d]++
  return c
}

export function sumDice(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0)
}

/** Sum of dice matching the given face (upper section). */
export function upperScore(dice: number[], face: number): number {
  return dice.reduce((a, d) => a + (d === face ? face : 0), 0)
}

export function isYahtzee(dice: number[]): boolean {
  return counts(dice).some((n) => n === NUM_DICE)
}

/** Three of a Kind: sum of ALL dice if any face appears ≥3 times, else 0. */
export function threeKindScore(dice: number[]): number {
  return counts(dice).some((n) => n >= 3) ? sumDice(dice) : 0
}

/** Four of a Kind: sum of ALL dice if any face appears ≥4 times, else 0. */
export function fourKindScore(dice: number[]): number {
  return counts(dice).some((n) => n >= 4) ? sumDice(dice) : 0
}

/**
 * Full House: 25 for exactly a three-of-a-kind PLUS a distinct pair.
 * Five-of-a-kind is NOT counted as a full house (strict rule — see README note).
 */
export function fullHouseScore(dice: number[]): number {
  const c = counts(dice)
  const hasThree = c.some((n) => n === 3)
  const hasTwo = c.some((n) => n === 2)
  return hasThree && hasTwo ? 25 : 0
}

/** True if `dice` contains every face in `run` (a run of consecutive faces). */
function hasRun(c: number[], run: number[]): boolean {
  return run.every((f) => c[f] > 0)
}

/** Small Straight: 30 for any 4 consecutive faces, else 0. */
export function smallStraightScore(dice: number[]): number {
  const c = counts(dice)
  const runs = [
    [1, 2, 3, 4],
    [2, 3, 4, 5],
    [3, 4, 5, 6],
  ]
  return runs.some((r) => hasRun(c, r)) ? 30 : 0
}

/** Large Straight: 40 for 5 consecutive faces (1-5 or 2-6), else 0. */
export function largeStraightScore(dice: number[]): number {
  const c = counts(dice)
  return hasRun(c, [1, 2, 3, 4, 5]) || hasRun(c, [2, 3, 4, 5, 6]) ? 40 : 0
}

/** Yahtzee: 50 for five of a kind, else 0. */
export function yahtzeeScore(dice: number[]): number {
  return isYahtzee(dice) ? 50 : 0
}

/** Chance: sum of all dice, always. */
export function chanceScore(dice: number[]): number {
  return sumDice(dice)
}

/** The raw score a category would earn for the given dice, right now. */
export function categoryScore(cat: Category, dice: number[]): number {
  switch (cat) {
    case 'ones':
    case 'twos':
    case 'threes':
    case 'fours':
    case 'fives':
    case 'sixes':
      return upperScore(dice, UPPER_FACE[cat])
    case 'threeKind':
      return threeKindScore(dice)
    case 'fourKind':
      return fourKindScore(dice)
    case 'fullHouse':
      return fullHouseScore(dice)
    case 'smallStraight':
      return smallStraightScore(dice)
    case 'largeStraight':
      return largeStraightScore(dice)
    case 'yahtzee':
      return yahtzeeScore(dice)
    case 'chance':
      return chanceScore(dice)
  }
}

/** The score-if-picked-now for EVERY category (the potential-preview map). */
export function potentialScores(dice: number[]): Record<Category, number> {
  const out = {} as Record<Category, number>
  for (const cat of ALL_CATEGORIES) out[cat] = categoryScore(cat, dice)
  return out
}

// -- Totals ------------------------------------------------------------------

function sumMap(scores: ScoreMap, cats: readonly Category[]): number {
  return cats.reduce((a, cat) => a + (scores[cat] ?? 0), 0)
}

/** Upper section subtotal (ones..sixes), before the bonus. */
export function upperTotal(state: State): number {
  return sumMap(state.scores, UPPER_CATEGORIES)
}

/** +35 once the upper subtotal reaches 63, else 0. */
export function upperBonus(state: State): number {
  return upperTotal(state) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0
}

/** Lower section total (its 7 categories) plus accumulated yahtzee bonuses. */
export function lowerTotal(state: State): number {
  return sumMap(state.scores, LOWER_CATEGORIES) + state.yahtzeeBonus
}

/** Grand total = upper + upper bonus + lower + yahtzee bonuses. */
export function grandTotal(state: State): number {
  return upperTotal(state) + upperBonus(state) + lowerTotal(state)
}

/** Points still needed for the +35 upper bonus (0 once reached). */
export function upperRemaining(state: State): number {
  return Math.max(0, UPPER_BONUS_THRESHOLD - upperTotal(state))
}

export function isGameOver(state: State): boolean {
  return state.status === 'over'
}

/** The unused category with the highest score-if-picked-now (ties → first). */
export function bestCategory(state: State): Category | null {
  let best: Category | null = null
  let bestVal = -1
  for (const cat of ALL_CATEGORIES) {
    if (state.scores[cat] !== null) continue
    const v = categoryScore(cat, state.dice)
    if (v > bestVal) {
      bestVal = v
      best = cat
    }
  }
  return best
}

// -- Game construction -------------------------------------------------------

function emptyScores(): ScoreMap {
  const s = {} as ScoreMap
  for (const cat of ALL_CATEGORIES) s[cat] = null
  return s
}

export function createGame(seed: number): State {
  return {
    dice: [1, 1, 1, 1, 1],
    held: [false, false, false, false, false],
    rollsLeft: MAX_ROLLS,
    rolled: false,
    scores: emptyScores(),
    yahtzeeBonus: 0,
    turn: 0,
    status: 'playing',
    rngState: seed >>> 0,
  }
}

// -- Moves (each pure; illegal → same reference) -----------------------------

/**
 * Roll: reroll every non-held die (on the first roll of a turn nothing is held,
 * so all 5 roll). Consumes one PRNG step per rerolled die. Illegal (game over,
 * or no rolls left) → same reference.
 */
export function roll(state: State): State {
  if (state.status !== 'playing') return state
  if (state.rollsLeft <= 0) return state
  let rngState = state.rngState
  const dice = state.dice.slice()
  for (let i = 0; i < NUM_DICE; i++) {
    if (state.held[i]) continue
    const [v, next] = mulberry32Step(rngState)
    rngState = next
    dice[i] = dieFromFloat(v)
  }
  return { ...state, dice, rngState, rollsLeft: state.rollsLeft - 1, rolled: true }
}

/**
 * Toggle the hold flag on die `i`. Illegal (game over, out of range, before the
 * first roll of the turn, or after the last roll when no reroll remains) → same
 * reference.
 */
export function hold(state: State, i: number): State {
  if (state.status !== 'playing') return state
  if (i < 0 || i >= NUM_DICE) return state
  if (!state.rolled) return state // can't hold before rolling
  if (state.rollsLeft <= 0) return state // nothing left to reroll — holding is moot
  const held = state.held.slice()
  held[i] = !held[i]
  return { ...state, held }
}

/**
 * Assign the current dice to `cat`, locking its score and ending the turn.
 * Applies the +100 yahtzee bonus when the current dice are a yahtzee AND the
 * Yahtzee box already holds 50. Illegal (game over, not yet rolled, or category
 * already used) → same reference.
 */
export function score(state: State, cat: Category): State {
  if (state.status !== 'playing') return state
  if (!state.rolled) return state
  if (state.scores[cat] !== null) return state

  const value = categoryScore(cat, state.dice)
  const scores: ScoreMap = { ...state.scores, [cat]: value }

  // Extra yahtzee while the Yahtzee box already scored 50 → +100 bonus.
  let yahtzeeBonus = state.yahtzeeBonus
  if (isYahtzee(state.dice) && state.scores.yahtzee === 50) {
    yahtzeeBonus += YAHTZEE_BONUS
  }

  const over = ALL_CATEGORIES.every((c) => scores[c] !== null)
  return {
    ...state,
    scores,
    yahtzeeBonus,
    turn: state.turn + 1,
    dice: state.dice.slice(),
    held: [false, false, false, false, false],
    rollsLeft: MAX_ROLLS,
    rolled: false,
    status: over ? 'over' : 'playing',
  }
}
