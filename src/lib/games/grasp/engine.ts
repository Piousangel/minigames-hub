/**
 * Grasp — pure engine.
 *
 * A deck of `valueMax * copiesPerValue` cards (values 1..valueMax, each
 * `copiesPerValue` times) is shuffled once from a seed into a fixed-length
 * array. A cursor walks the deck one card at a time; each card is either
 * `grasp`ed (kept — score += value, haste gauge += gaugeStep) or `release`d
 * (let go — free, gauge unchanged). The instant the haste gauge
 * (`graspCount * gaugeStep`) reaches `gaugeMax`, the round is force-ended on
 * the spot (`capped`). If the cursor reaches the end of the deck in the same
 * action that would have capped it, reaching the end wins the tie-break —
 * `cleared` — because having just looked at the very last card makes the
 * gauge risk moot. There is no undo: deciding immediately, once, is the
 * whole concept.
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through an injected `Rng`, consumed
 * solely in `generateDeck` (Fisher–Yates). `applyDecision`/`reduce` consume
 * no rng at all, so every scoring outcome is golden-testable from a fixed
 * script.
 */

export type Rng = () => number // returns a float in [0,1)
export type Card = number // 1..valueMax; higher is better
export type Decision = 'grasp' | 'release'

export interface GraspConfig {
  deckSize: number // N, total card count. Must equal valueMax * copiesPerValue
  valueMax: number // card values range 1..valueMax
  copiesPerValue: number // how many copies of each value exist
  gaugeStep: number // haste gauge increase per grasp (integer)
  gaugeMax: number // gauge >= this (right after a grasp) force-ends the round (integer)
}

export const CLEAR_BONUS = 200 // fixed bonus for clearing (reaching the end of the deck)
export const MARGIN_BONUS_MAX = 100 // max bonus for the unspent gauge margin at clear time

export const DIFFICULTIES = {
  easy: { deckSize: 20, valueMax: 5, copiesPerValue: 4, gaugeStep: 17, gaugeMax: 100 },
  normal: { deckSize: 30, valueMax: 6, copiesPerValue: 5, gaugeStep: 13, gaugeMax: 100 },
  hard: { deckSize: 42, valueMax: 7, copiesPerValue: 6, gaugeStep: 10, gaugeMax: 100 },
} satisfies Record<'easy' | 'normal' | 'hard', GraspConfig>

export const DAILY_CONFIG: GraspConfig = DIFFICULTIES.normal

export type GraspEvent = 'none' | 'grasp' | 'release' | 'capped' | 'cleared'

export interface GraspState {
  config: GraspConfig
  seed: number
  deck: Card[] // fixed length deckSize, shuffled once, never mutated
  cursor: number // # cards already decided; index of the next revealed card
  valueCounts: number[] // length valueMax; [v-1] = count of value v remaining in deck[cursor..]
  graspCount: number // # of grasp decisions so far (gauge = graspCount * gaugeStep)
  score: number // integer, never decreases
  biggestGrasp: number // largest card value ever grasped (stats/share)
  over: boolean // round ended (capped or cleared)
  cleared: boolean // over && the deck was seen through to the end
  lastEvent: GraspEvent
  lastCard: Card | null // value of the card just decided (animation/toast)
  lastGain: number // score added by the last action (release=0, grasp=card[+bonus])
}

export type GraspAction =
  | { type: 'decide'; decision: Decision }
  | { type: 'reset' } // same seed
  | { type: 'new'; seed: number } // fresh seed

/** Identical impl to the template's mulberry32. */
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

/**
 * Build `valueMax * copiesPerValue` cards (values 1..valueMax, `copiesPerValue`
 * copies each) and Fisher–Yates shuffle in place (i = length-1 -> 1, one
 * rng() per step). Consumes EXACTLY (cfg.deckSize - 1) rng draws. Same seed
 * always yields the same array. Precondition: cfg.deckSize === valueMax *
 * copiesPerValue (assumed, not enforced here).
 */
export function generateDeck(cfg: GraspConfig, rng: Rng): Card[] {
  const deck: Card[] = []
  for (let v = 1; v <= cfg.valueMax; v++) {
    for (let i = 0; i < cfg.copiesPerValue; i++) deck.push(v)
  }
  for (let i = deck.length - 1; i >= 1; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
  return deck
}

/** Tally per-value counts of deck[from..]. Pure — no rng, does not mutate deck. */
export function tallyValueCounts(deck: Card[], from: number, valueMax: number): number[] {
  const counts = new Array<number>(valueMax).fill(0)
  for (let i = from; i < deck.length; i++) counts[deck[i] - 1]++
  return counts
}

/** Constant determined solely by cfg: total allowed grasps before hitting the cap. */
export function maxGrasps(cfg: GraspConfig): number {
  return Math.ceil(cfg.gaugeMax / cfg.gaugeStep)
}

/** Current gauge value = graspCount * gaugeStep. Pure derived value (not stored separately). */
export function gaugeOf(state: GraspState): number {
  return state.graspCount * state.config.gaugeStep
}

/** 0 if over. Else maxGrasps(cfg) - graspCount, clamped to >= 0. */
export function graspsUntilCap(state: GraspState): number {
  if (state.over) return 0
  return Math.max(0, maxGrasps(state.config) - state.graspCount)
}

/** null if over or the cursor is already at the end of the deck; else the revealed card. */
export function currentCard(state: GraspState): Card | null {
  if (state.over) return null
  if (state.cursor >= state.deck.length) return null
  return state.deck[state.cursor]
}

export interface DecisionOutcome {
  card: Card
  decision: Decision
  gain: number
  graspCount: number
  gauge: number
  cursor: number
  valueCounts: number[]
  over: boolean
  cleared: boolean
  event: GraspEvent
}

/**
 * Apply one decision purely. Does not mutate `state`. Consumes no rng.
 * Returns null when the action is illegal (state.over, or the cursor is
 * already past the end of the deck).
 */
export function applyDecision(state: GraspState, decision: Decision): DecisionOutcome | null {
  if (state.over) return null
  if (state.cursor >= state.deck.length) return null

  const card = state.deck[state.cursor]
  const cursor = state.cursor + 1
  const graspCount = decision === 'grasp' ? state.graspCount + 1 : state.graspCount
  const gauge = graspCount * state.config.gaugeStep

  const valueCounts = state.valueCounts.slice()
  valueCounts[card - 1]--

  const cleared = cursor === state.deck.length
  const capped = !cleared && decision === 'grasp' && gauge >= state.config.gaugeMax
  const over = cleared || capped
  const event: GraspEvent = cleared ? 'cleared' : capped ? 'capped' : decision

  const base = decision === 'grasp' ? card : 0
  let gain = base
  if (cleared) {
    const margin = Math.max(0, state.config.gaugeMax - gauge)
    const marginBonus = Math.round((MARGIN_BONUS_MAX * margin) / state.config.gaugeMax)
    gain = base + CLEAR_BONUS + marginBonus
  }

  return { card, decision, gain, graspCount, gauge, cursor, valueCounts, over, cleared, event }
}

export function createGame(cfg: GraspConfig, seed: number): GraspState {
  const deck = generateDeck(cfg, mulberry32(seed))
  const empty = deck.length === 0
  return {
    config: cfg,
    seed,
    deck,
    cursor: 0,
    valueCounts: tallyValueCounts(deck, 0, cfg.valueMax),
    graspCount: 0,
    score: 0,
    biggestGrasp: 0,
    over: empty,
    cleared: empty,
    lastEvent: 'none',
    lastCard: null,
    lastGain: 0,
  }
}

// -- Reducer ----------------------------------------------------------------

export function reduce(state: GraspState, action: GraspAction): GraspState {
  switch (action.type) {
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    case 'decide': {
      const outcome = applyDecision(state, action.decision)
      if (outcome === null) return { ...state, lastEvent: 'none' }
      return {
        ...state,
        cursor: outcome.cursor,
        valueCounts: outcome.valueCounts,
        graspCount: outcome.graspCount,
        score: state.score + outcome.gain,
        biggestGrasp:
          action.decision === 'grasp' ? Math.max(state.biggestGrasp, outcome.card) : state.biggestGrasp,
        over: outcome.over,
        cleared: outcome.cleared,
        lastEvent: outcome.event,
        lastCard: outcome.card,
        lastGain: outcome.gain,
      }
    }
    default:
      return state
  }
}
