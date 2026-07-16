/**
 * Cleave — pure engine.
 *
 * Each round you split N loot items into two piles. Every item carries two
 * numbers: `myValue` (what it is worth to you) and `theirValue` (what the rival
 * sees). The rival is a published, fully deterministic rule: it takes whichever
 * pile has the larger `theirValue` total. Whatever it leaves behind is yours,
 * and its `myValue` total is the round score.
 *
 * Exactly one item per round is SEALED: its `theirValue` is pre-rolled at
 * generation time but the player only ever sees a band (`bandLo..bandHi`).
 * Because the band is public, the worst case is computable by the player, so
 * `bestGuaranteed` — the best score you can lock in against ANY value inside the
 * band — is knowable before committing. The quota is derived from it, which is
 * why a loss is never luck.
 *
 * Every function here is pure and total. There are no timers, no clock reads and
 * no ambient entropy: randomness enters solely through the injected `Rng`, and
 * only inside `generateBoard`. The rival rule, `evaluate` and the reducer draw
 * zero numbers from the stream, so every outcome is golden-testable.
 */

export type Rng = () => number // float in [0,1)
export type Pile = 'A' | 'B'

export interface Item {
  /** 0..N-1; generation order === display order. */
  id: number
  /** 1..maxVal — cyan, what the item is worth to you. */
  myValue: number
  /** 1..maxVal — magenta. Sealed items carry the true value here too. */
  theirValue: number
  /** Exactly one item per round is sealed. */
  sealed: boolean
  /** Only meaningful when sealed; unsealed items have lo === hi === theirValue. */
  bandLo: number
  bandHi: number
}

export interface RoundBoard {
  round: number // 1-based
  items: Item[] // length === itemCount(round)
  maxVal: number
  sealedIndex: number
  /** Best kept mySum assuming the worst legal value inside the sealed band. */
  bestGuaranteed: number
  /** Best kept mySum if the sealed true value had been known. Display only. */
  hindsightOptimum: number
  /** ceil(QUOTA_RATIO * bestGuaranteed) — always reachable. */
  quota: number
}

export interface RoundResult {
  round: number
  assign: Pile[]
  rivalTook: Pile
  keptPile: Pile
  myKept: number // === roundScore
  myGiven: number
  theirA: number
  theirB: number
  margin: number // |theirA - theirB|
  robbed: boolean // the fat pile walked: myGiven > myKept
  sealedTheirValue: number
  bestGuaranteed: number
  hindsightOptimum: number
  leftOnTable: number // max(0, hindsightOptimum - myKept)
  metQuota: boolean
}

export type CleavePhase = 'split' | 'reveal' | 'over'

export type CleaveEvent =
  | 'none'
  | 'assign'
  | 'illegal'
  | 'commit'
  | 'safe' // metQuota && !robbed
  | 'perfect' // myKept === hindsightOptimum
  | 'robbed'
  | 'quotaFail' // costs a life
  | 'next'
  | 'over'

export interface CleaveState {
  seed: number
  round: number
  board: RoundBoard
  assign: Pile[] // length === board.items.length
  phase: CleavePhase
  score: number // cumulative, monotone non-decreasing
  lives: number
  /** Tightest margin among non-robbed rounds. `Infinity` until the first one. */
  bestMargin: number
  perfects: number
  lastResult: RoundResult | null
  lastEvent: CleaveEvent
}

export type CleaveAction =
  | { type: 'toggle'; item: number }
  | { type: 'assign'; item: number; pile: Pile }
  | { type: 'commit' }
  | { type: 'next' }
  | { type: 'reset' }
  | { type: 'new'; seed: number }

// -- Constants --------------------------------------------------------------

export const BASE_ITEMS = 4
export const MAX_ITEMS = 9
export const START_LIVES = 3
export const BAND_BUCKET = 3
export const QUOTA_RATIO = 0.5
export const MAX_GEN_ATTEMPTS = 8
export const ROUND_SALT = 0x9e3779b1

// -- Round scaling ----------------------------------------------------------

/** Monotone non-decreasing in `round`; always within [2, MAX_ITEMS]. */
export function itemCount(round: number): number {
  return Math.max(2, Math.min(BASE_ITEMS + Math.floor((round - 1) / 2), MAX_ITEMS))
}

/** maxValue(1) === 6, capped at 12. */
export function maxValue(round: number): number {
  return Math.min(5 + round, 12)
}

// -- Rng --------------------------------------------------------------------

/** Byte-identical to the Decant engine's mulberry32. */
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
 * Per-round stream. Rounds are isolated from one another, so round N can be
 * pinned as a standalone golden fixture without replaying rounds 1..N-1.
 */
export function roundRng(seed: number, round: number): Rng {
  return mulberry32((seed + round * ROUND_SALT) >>> 0)
}

// -- Bands ------------------------------------------------------------------

/**
 * The public band a sealed value hides inside. Consumes no rng. The band never
 * pins the true value down (bucket width >= 2, except a narrowed edge bucket at
 * the maxVal boundary, which is accepted).
 */
export function bandOf(theirValue: number, maxVal: number): { lo: number; hi: number } {
  const bucket = Math.floor((theirValue - 1) / BAND_BUCKET)
  const lo = bucket * BAND_BUCKET + 1
  const hi = Math.min(maxVal, lo + BAND_BUCKET - 1)
  return { lo, hi }
}

// -- Sums -------------------------------------------------------------------

export function sumMy(items: Item[], assign: Pile[], pile: Pile): number {
  let s = 0
  for (let i = 0; i < items.length; i++) if (assign[i] === pile) s += items[i].myValue
  return s
}

/** `sealedOverride`, when given, stands in for the sealed item's theirValue. */
export function sumTheir(
  items: Item[],
  assign: Pile[],
  pile: Pile,
  sealedOverride?: number,
): number {
  let s = 0
  for (let i = 0; i < items.length; i++) {
    if (assign[i] !== pile) continue
    const it = items[i]
    s += it.sealed && sealedOverride !== undefined ? sealedOverride : it.theirValue
  }
  return s
}

// -- The rival --------------------------------------------------------------

/**
 * The contract of the game, published to the player in full:
 *   1. bigger theirValue total wins;
 *   2. on a tie, the rival takes the pile with the bigger myValue total (the
 *      worst outcome for you);
 *   3. on a total tie it always takes 'B'.
 *
 * Rule 3 is the one asymmetry: flipping every A/B label flips the answer for
 * every board EXCEPT a total tie, which stays 'B'.
 */
export function rivalPick(items: Item[], assign: Pile[], sealedOverride?: number): Pile {
  const tA = sumTheir(items, assign, 'A', sealedOverride)
  const tB = sumTheir(items, assign, 'B', sealedOverride)
  if (tA !== tB) return tA > tB ? 'A' : 'B'
  const mA = sumMy(items, assign, 'A')
  const mB = sumMy(items, assign, 'B')
  if (mA !== mB) return mA > mB ? 'A' : 'B'
  return 'B'
}

export function evaluate(
  items: Item[],
  assign: Pile[],
  sealedOverride?: number,
): {
  rivalTook: Pile
  keptPile: Pile
  myKept: number
  myGiven: number
  margin: number
  robbed: boolean
} {
  const rivalTook = rivalPick(items, assign, sealedOverride)
  const keptPile: Pile = rivalTook === 'A' ? 'B' : 'A'
  const myKept = sumMy(items, assign, keptPile)
  const myGiven = sumMy(items, assign, rivalTook)
  const tA = sumTheir(items, assign, 'A', sealedOverride)
  const tB = sumTheir(items, assign, 'B', sealedOverride)
  return {
    rivalTook,
    keptPile,
    myKept,
    myGiven,
    margin: Math.abs(tA - tB),
    robbed: myGiven > myKept,
  }
}

// -- Splits -----------------------------------------------------------------

/** Both piles must hold at least one item. */
export function isValidSplit(assign: Pile[]): boolean {
  let a = 0
  let b = 0
  for (const p of assign) {
    if (p === 'A') a++
    else b++
  }
  return a > 0 && b > 0
}

/** All 2^n - 2 splits that leave neither pile empty. n <= 9 -> <= 510. */
export function enumerateSplits(n: number): Pile[][] {
  const out: Pile[][] = []
  if (n < 2) return out
  const total = 1 << n
  for (let mask = 1; mask < total - 1; mask++) {
    const a: Pile[] = []
    for (let i = 0; i < n; i++) a.push((mask >> i) & 1 ? 'B' : 'A')
    out.push(a)
  }
  return out
}

function sealedBand(items: Item[]): { lo: number; hi: number } | null {
  for (const it of items) if (it.sealed) return { lo: it.bandLo, hi: it.bandHi }
  return null
}

/**
 * max over valid splits of ( min over v in the sealed band of myKept ).
 *
 * Uses only information the player has (the band, never the true value), which
 * is precisely why the quota derived from it cannot be missed by bad luck.
 */
export function bestGuaranteed(items: Item[]): number {
  const band = sealedBand(items)
  let best = 0
  let seen = false
  for (const split of enumerateSplits(items.length)) {
    let worst: number
    if (band === null) {
      worst = evaluate(items, split).myKept
    } else {
      worst = Infinity
      for (let v = band.lo; v <= band.hi; v++) {
        const k = evaluate(items, split, v).myKept
        if (k < worst) worst = k
      }
    }
    if (!seen || worst > best) {
      best = worst
      seen = true
    }
  }
  return seen ? best : 0
}

/** max over valid splits of myKept, using the sealed item's true value. */
export function hindsightOptimum(items: Item[]): number {
  let best = 0
  let seen = false
  for (const split of enumerateSplits(items.length)) {
    const k = evaluate(items, split).myKept
    if (!seen || k > best) {
      best = k
      seen = true
    }
  }
  return seen ? best : 0
}

/** Alternating A/B — never all-one-pile, so always a valid split. */
export function defaultAssign(n: number): Pile[] {
  const out: Pile[] = []
  for (let i = 0; i < n; i++) out.push(i % 2 === 0 ? 'A' : 'B')
  return out
}

// -- Generation -------------------------------------------------------------

/**
 * Draw order per attempt (2N+1 values): for each item myValue then theirValue,
 * then the sealed index. A board with fewer than two items where myValue and
 * theirValue disagree has no adversarial tension, so it is redrawn from the same
 * stream (up to MAX_GEN_ATTEMPTS; the last attempt is then accepted as-is).
 * One stream throughout keeps generation fully deterministic.
 */
export function generateBoard(round: number, rng: Rng): RoundBoard {
  const n = itemCount(round)
  const maxVal = maxValue(round)

  let items: Item[] = []
  let sealedIndex = 0

  for (let attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
    const rolled: { my: number; their: number }[] = []
    for (let i = 0; i < n; i++) {
      const my = 1 + Math.floor(rng() * maxVal)
      const their = 1 + Math.floor(rng() * maxVal)
      rolled.push({ my, their })
    }
    sealedIndex = Math.min(n - 1, Math.floor(rng() * n))

    items = rolled.map((r, i) => {
      const sealed = i === sealedIndex
      const band = sealed ? bandOf(r.their, maxVal) : { lo: r.their, hi: r.their }
      return {
        id: i,
        myValue: r.my,
        theirValue: r.their,
        sealed,
        bandLo: band.lo,
        bandHi: band.hi,
      }
    })

    let tension = 0
    for (const r of rolled) if (r.my !== r.their) tension++
    if (tension >= 2) break
  }

  const guaranteed = bestGuaranteed(items)
  return {
    round,
    items,
    maxVal,
    sealedIndex,
    bestGuaranteed: guaranteed,
    hindsightOptimum: hindsightOptimum(items),
    quota: Math.ceil(QUOTA_RATIO * guaranteed),
  }
}

export function createGame(seed: number): CleaveState {
  const board = generateBoard(1, roundRng(seed, 1))
  return {
    seed,
    round: 1,
    board,
    assign: defaultAssign(board.items.length),
    phase: 'split',
    score: 0,
    lives: START_LIVES,
    bestMargin: Infinity,
    perfects: 0,
    lastResult: null,
    lastEvent: 'none',
  }
}

// -- Reducer ----------------------------------------------------------------

export function reduce(state: CleaveState, action: CleaveAction): CleaveState {
  switch (action.type) {
    case 'reset':
      return createGame(state.seed)
    case 'new':
      return createGame(action.seed)

    case 'toggle': {
      if (state.phase !== 'split') return { ...state, lastEvent: 'none' }
      const i = action.item
      if (i < 0 || i >= state.assign.length) return { ...state, lastEvent: 'none' }
      const assign = state.assign.slice()
      assign[i] = assign[i] === 'A' ? 'B' : 'A'
      return { ...state, assign, lastEvent: 'assign' }
    }

    case 'assign': {
      if (state.phase !== 'split') return { ...state, lastEvent: 'none' }
      const i = action.item
      if (i < 0 || i >= state.assign.length) return { ...state, lastEvent: 'none' }
      if (state.assign[i] === action.pile) return { ...state, lastEvent: 'none' }
      const assign = state.assign.slice()
      assign[i] = action.pile
      return { ...state, assign, lastEvent: 'assign' }
    }

    case 'commit': {
      if (state.phase !== 'split') return { ...state, lastEvent: 'none' }
      if (!isValidSplit(state.assign)) return { ...state, lastEvent: 'illegal' }

      const { items, quota, sealedIndex } = state.board
      const ev = evaluate(items, state.assign)
      const metQuota = ev.myKept >= quota
      const perfect = ev.myKept === state.board.hindsightOptimum

      const result: RoundResult = {
        round: state.round,
        assign: state.assign.slice(),
        rivalTook: ev.rivalTook,
        keptPile: ev.keptPile,
        myKept: ev.myKept,
        myGiven: ev.myGiven,
        theirA: sumTheir(items, state.assign, 'A'),
        theirB: sumTheir(items, state.assign, 'B'),
        margin: ev.margin,
        robbed: ev.robbed,
        sealedTheirValue: items[sealedIndex].theirValue,
        bestGuaranteed: state.board.bestGuaranteed,
        hindsightOptimum: state.board.hindsightOptimum,
        leftOnTable: Math.max(0, state.board.hindsightOptimum - ev.myKept),
        metQuota,
      }

      // Score never depends on the sealed true value: the round score is exactly
      // what you kept. No hindsight bonus — that would smuggle luck in.
      const score = state.score + ev.myKept
      const lives = metQuota ? state.lives : state.lives - 1
      const phase: CleavePhase = lives <= 0 ? 'over' : 'reveal'

      // One event only, in priority order.
      let lastEvent: CleaveEvent
      if (lives <= 0) lastEvent = 'over'
      else if (!metQuota) lastEvent = 'quotaFail'
      else if (ev.robbed) lastEvent = 'robbed'
      else if (perfect) lastEvent = 'perfect'
      else lastEvent = 'safe'

      return {
        ...state,
        phase,
        score,
        lives,
        bestMargin: ev.robbed ? state.bestMargin : Math.min(state.bestMargin, ev.margin),
        perfects: state.perfects + (perfect ? 1 : 0),
        lastResult: result,
        lastEvent,
      }
    }

    case 'next': {
      if (state.phase !== 'reveal') return { ...state, lastEvent: 'none' }
      const round = state.round + 1
      const board = generateBoard(round, roundRng(state.seed, round))
      return {
        ...state,
        round,
        board,
        assign: defaultAssign(board.items.length),
        phase: 'split',
        lastEvent: 'next',
      }
    }

    default:
      return state
  }
}
