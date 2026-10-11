/**
 * Handful — pure engine.
 *
 * A basket holds N ripe (1) and K rotten (0) items. The whole composition is
 * public; only the draw ORDER is hidden behind the seed. Each turn the single
 * decision is how big a handful (`size`) to grab. handValue(g) is superlinear
 * (g²), so bigger grabs score more — but a single rotten item in the grab
 * spoils the WHOLE handful to zero. Clean streaks multiply the handful's own
 * value (+25% per streak step), so the combo rewards brave clean grabs rather
 * than safe singles. Turn-based, no timer, no losing.
 *
 * Balance (see engine.test.ts "balance"): the old flat combo bonus
 * (+5·(combo-1)) dwarfed a triangular hand value, so "always grab 1" averaged
 * ~368 vs ~18 for 8-at-once. Now singles and max-size both lose to mid sizes,
 * and an odds-aware player beats every fixed size.
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through an injected `Rng`, consumed
 * solely in `generateOrder` (Fisher–Yates). The reducer consumes no rng at all,
 * so every scoring / combo / clean outcome is golden-testable from a fixed
 * script and a fixed order.
 */

export type Rng = () => number // returns a float in [0,1)
export type Item = 0 | 1 // 1 = ripe, 0 = rotten

// Combo bonus = floor(handValue(g) · (combo-1) / COMBO_DIVISOR): +25% of the
// handful's value per consecutive clean grab beyond the first.
export const COMBO_DIVISOR = 4
export const DEFAULT_MAX_GRAB = 8
// Default handful size on a fresh basket (was maxGrab, which made mashing GRAB
// the worst possible first impression).
export const START_SIZE = 3

export interface HandfulConfig {
  ripe: number // N ripe items (>0)
  rotten: number // K rotten items (>=0)
  maxGrab: number // max handful size
}

export const DIFFICULTIES = {
  easy: { ripe: 18, rotten: 4, maxGrab: 6 },
  normal: { ripe: 24, rotten: 6, maxGrab: 8 },
  hard: { ripe: 30, rotten: 9, maxGrab: 8 },
} satisfies Record<'easy' | 'normal' | 'hard', HandfulConfig>

export const DAILY_CONFIG: HandfulConfig = DIFFICULTIES.normal

export type HandfulEvent = 'none' | 'size' | 'clean' | 'spoiled' | 'over'

export interface GrabOutcome {
  size: number // handful size g grabbed this turn
  ripe: number // ripe count in this handful
  rotten: number // rotten count in this handful (== g - ripe)
  clean: boolean // rotten === 0
  gained: number // score added by this handful (0 if spoiled)
  comboBonus: number // combo portion of gained
  drawn: Item[] // the actual items drawn (a copy of an order slice)
}

export interface HandfulState {
  config: HandfulConfig
  seed: number
  order: Item[] // fixed shuffled sequence, length = ripe+rotten
  cursor: number // items already drawn (index into order)
  ripeLeft: number // ripe count in order[cursor..]
  rottenLeft: number // rotten count in order[cursor..]
  size: number // currently selected handful size, [1, maxGrabNow] (0 if over)
  score: number // monotone non-decreasing integer
  combo: number // current run of consecutive clean grabs
  bestCombo: number
  grabs: number // total grabs
  cleanGrabs: number
  spoiledGrabs: number
  biggestClean: number // largest successful (clean) handful size
  over: boolean // basket empty
  lastGrab: GrabOutcome | null
  lastEvent: HandfulEvent
}

export type HandfulAction =
  | { type: 'setSize'; size: number } // absolute (number keys / slider)
  | { type: 'incSize'; delta: number } // relative (+/- , arrows)
  | { type: 'grab' } // grab at current size
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

/** Superlinear bulk reward: g². Always an integer, >= g for g >= 1. */
export function handValue(g: number): number {
  if (g <= 0) return 0
  return g * g
}

/** Streak bonus for a clean handful of size g that makes the streak `combo`. */
export function comboBonus(g: number, combo: number): number {
  if (g <= 0 || combo < 2) return 0
  return Math.floor((handValue(g) * (combo - 1)) / COMBO_DIVISOR)
}

/**
 * "All-ripe" probability of a size-g handful from a basket of `ripe` ripe and
 * `rotten` rotten items = ∏ (ripe-i)/(ripe+rotten-i) for i=0..g-1.
 * DISPLAY ONLY — the reducer never calls this (determinism). Returns [0,1].
 */
export function cleanOdds(ripe: number, rotten: number, g: number): number {
  if (g <= 0) return 1
  if (rotten <= 0) return 1
  if (g > ripe) return 0
  let p = 1
  for (let i = 0; i < g; i++) {
    p *= (ripe - i) / (ripe + rotten - i)
  }
  return p
}

/** Largest handful drawable now: min(maxGrab, itemsLeft). 0 if over. */
export function maxGrabNow(state: HandfulState): number {
  return Math.min(state.config.maxGrab, state.ripeLeft + state.rottenLeft)
}

/** Clamp a requested size into [1, maxGrabNow]; 0 if over. */
export function clampSize(state: HandfulState, size: number): number {
  const m = maxGrabNow(state)
  if (m <= 0) return 0
  return Math.max(1, Math.min(Math.floor(size), m))
}

/**
 * Build the fixed draw order: `ripe` ones and `rotten` zeros, then Fisher–Yates
 * shuffle in place (i = length-1 → 1, one rng() per step). Consumes EXACTLY
 * (length-1) rng draws.
 */
export function generateOrder(cfg: HandfulConfig, rng: Rng): Item[] {
  const order: Item[] = []
  for (let i = 0; i < cfg.ripe; i++) order.push(1)
  for (let i = 0; i < cfg.rotten; i++) order.push(0)
  for (let i = order.length - 1; i >= 1; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }
  return order
}

/**
 * Tally the handful of `size` starting at `cursor`. Never mutates `order`, uses
 * no rng. At the tail the slice may be shorter than `size`.
 */
export function computeGrab(
  order: Item[],
  cursor: number,
  size: number,
): { drawn: Item[]; ripe: number; rotten: number; clean: boolean } {
  const drawn = order.slice(cursor, cursor + size)
  let ripe = 0
  for (const x of drawn) if (x === 1) ripe++
  const rotten = drawn.length - ripe
  return { drawn, ripe, rotten, clean: rotten === 0 }
}

export function isOver(state: HandfulState): boolean {
  return state.ripeLeft + state.rottenLeft === 0
}

export function createGame(cfg: HandfulConfig, seed: number): HandfulState {
  const order = generateOrder(cfg, mulberry32(seed))
  const base: HandfulState = {
    config: cfg,
    seed,
    order,
    cursor: 0,
    ripeLeft: cfg.ripe,
    rottenLeft: cfg.rotten,
    size: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    grabs: 0,
    cleanGrabs: 0,
    spoiledGrabs: 0,
    biggestClean: 0,
    over: cfg.ripe + cfg.rotten === 0,
    lastGrab: null,
    lastEvent: 'none',
  }
  base.size = clampSize(base, START_SIZE)
  return base
}

// -- Reducer ----------------------------------------------------------------

export function reduce(state: HandfulState, action: HandfulAction): HandfulState {
  switch (action.type) {
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    case 'setSize': {
      if (state.over) return { ...state, lastEvent: 'none' }
      return { ...state, size: clampSize(state, action.size), lastEvent: 'size' }
    }
    case 'incSize': {
      if (state.over) return { ...state, lastEvent: 'none' }
      return {
        ...state,
        size: clampSize(state, state.size + action.delta),
        lastEvent: 'size',
      }
    }
    case 'grab': {
      if (state.over || maxGrabNow(state) === 0) return { ...state, lastEvent: 'none' }
      const g = clampSize(state, state.size)
      const { drawn, ripe, rotten, clean } = computeGrab(state.order, state.cursor, g)

      let combo = state.combo
      let bonus = 0
      let gained = 0
      if (clean) {
        combo = state.combo + 1
        bonus = comboBonus(drawn.length, combo)
        gained = handValue(drawn.length) + bonus
      } else {
        combo = 0
        bonus = 0
        gained = 0
      }

      const cursor = state.cursor + drawn.length
      const ripeLeft = state.ripeLeft - ripe
      const rottenLeft = state.rottenLeft - rotten
      const over = ripeLeft + rottenLeft === 0

      const grab: GrabOutcome = {
        size: drawn.length,
        ripe,
        rotten,
        clean,
        gained,
        comboBonus: bonus,
        drawn,
      }

      const next: HandfulState = {
        ...state,
        cursor,
        ripeLeft,
        rottenLeft,
        score: state.score + gained,
        combo,
        bestCombo: Math.max(state.bestCombo, combo),
        grabs: state.grabs + 1,
        cleanGrabs: state.cleanGrabs + (clean ? 1 : 0),
        spoiledGrabs: state.spoiledGrabs + (clean ? 0 : 1),
        biggestClean: clean ? Math.max(state.biggestClean, drawn.length) : state.biggestClean,
        over,
        lastGrab: grab,
        lastEvent: over ? 'over' : clean ? 'clean' : 'spoiled',
      }
      next.size = clampSize(next, state.size)
      return next
    }
    default:
      return state
  }
}
