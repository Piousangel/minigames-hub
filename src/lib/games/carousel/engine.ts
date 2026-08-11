/**
 * Carousel — pure engine.
 *
 * A ring of `ringSize` physical slots holds colored marbles. A fixed
 * "loader" position advances by `rotateStep` slots after every successful
 * placement — this advance is a pure counter driven only by the number of
 * placements made, entirely independent of what colors sit in the ring.
 * The player never chooses *where* a marble lands (that's forced); the only
 * decision is *which* of the three hand marbles to feed into the forced
 * slot. Landing 3+ same-colored marbles in a contiguous circular run clears
 * them and scores points. The ring filling up so the loader's next stop is
 * already occupied ends the game.
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness is folded into `(seed, cursor)` integer pairs —
 * `nextColor` builds and discards a fresh mulberry32 generator per draw, so
 * CarouselState never holds a live rng closure and is plain, deep-equal-able
 * data.
 */

export const HAND_SIZE = 3
export const MATCH_BASE = 10
export const COMBO_BASE = 15
export const GOLDEN_INCREMENT = 0x9e3779b9

export type Rng = () => number // returns a float in [0,1)
export type Color = number // 1..K
export type Slot = Color | null // null = empty

export interface CarouselConfig {
  ringSize: number // N, physical slot count
  rotateStep: number // S, slots the loader advances after every placement
  colors: number // K, color count
}

export type CarouselEvent =
  | 'none'
  | 'place'
  | 'match'
  | 'combo'
  | 'gameover'

export interface PlacementOutcome {
  handIndex: number
  color: Color
  ringIndex: number
  runIndices: number[]
  runLength: number
  points: number
  matched: boolean
  gameOverAfter: boolean
}

export interface CarouselState {
  config: CarouselConfig
  seed: number
  ring: Slot[]
  loaderPos: number
  hand: Color[]
  rngCursor: number
  score: number
  placements: number
  cleared: number
  comboStreak: number
  longestRun: number
  gameOver: boolean
  lastEvent: CarouselEvent
  lastPlacement: PlacementOutcome | null
}

export type CarouselAction =
  | { type: 'place'; handIndex: number }
  | { type: 'reset' }
  | { type: 'new'; seed: number }

/** Identical impl to the template's mulberry32 (defined independently here, no shared utils). */
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

export const DIFFICULTIES = {
  easy: { ringSize: 10, rotateStep: 3, colors: 4 },
  normal: { ringSize: 12, rotateStep: 5, colors: 5 },
  hard: { ringSize: 14, rotateStep: 5, colors: 6 },
} satisfies Record<'easy' | 'normal' | 'hard', CarouselConfig>

export const DEFAULT_CONFIG: CarouselConfig = DIFFICULTIES.normal

// -- Rng plumbing -------------------------------------------------------

/** Consumes rng() exactly once; result is always 1..colors. */
export function colorFromRng(rng: Rng, colors: number): Color {
  const raw = Math.floor(rng() * colors) + 1
  if (raw < 1) return 1
  if (raw > colors) return colors
  return raw
}

/** Mixes seed and draw index so distinct draws decorrelate. */
export function splitSeed(seed: number, cursor: number): number {
  return (seed + cursor * GOLDEN_INCREMENT) >>> 0
}

/**
 * The sole rng entry point. Builds a fresh mulberry32(splitSeed(seed,cursor))
 * and consumes it exactly once via colorFromRng — never a stored closure, so
 * (seed, cursor) alone fully determines every draw.
 */
export function nextColor(seed: number, cursor: number, colors: number): Color {
  const rng = mulberry32(splitSeed(seed, cursor))
  return colorFromRng(rng, colors)
}

// -- Ring primitives ------------------------------------------------------

export function emptyRing(size: number): Slot[] {
  return Array<Slot>(size).fill(null)
}

export function occupiedCount(ring: Slot[]): number {
  let n = 0
  for (const s of ring) if (s !== null) n++
  return n
}

/**
 * The circular contiguous same-color run through `index`, in circular
 * order (wrap allowed), `index` itself always included. `[]` if the slot
 * is empty. Walks backward then forward from `index`, each direction
 * capped at N-1 steps and stopping the moment it would revisit an index
 * already collected (a full-ring single color terminates cleanly at N
 * elements with no duplicates).
 */
export function matchRun(ring: Slot[], index: number): number[] {
  const n = ring.length
  const color = ring[index]
  if (color === null || color === undefined) return []

  const result: number[] = [index]

  for (let step = 1; step < n; step++) {
    const i = (index - step + n) % n
    if (ring[i] === color) {
      result.unshift(i)
    } else {
      break
    }
  }

  for (let step = 1; step < n; step++) {
    const i = (index + step) % n
    if (result.includes(i)) break
    if (ring[i] === color) {
      result.push(i)
    } else {
      break
    }
  }

  return result
}

/** Returns a new ring with `indices` cleared to null. Never mutates input. */
export function applyMatch(ring: Slot[], indices: number[]): Slot[] {
  const next = ring.slice()
  for (const i of indices) next[i] = null
  return next
}

// -- Game lifecycle ---------------------------------------------------------

export function createGame(config: CarouselConfig, seed: number): CarouselState {
  const hand: Color[] = []
  for (let i = 0; i < HAND_SIZE; i++) hand.push(nextColor(seed, i, config.colors))

  return {
    config,
    seed,
    ring: emptyRing(config.ringSize),
    loaderPos: 0,
    hand,
    rngCursor: HAND_SIZE,
    score: 0,
    placements: 0,
    cleared: 0,
    comboStreak: 0,
    longestRun: 0,
    gameOver: false,
    lastEvent: 'none',
    lastPlacement: null,
  }
}

/**
 * One placement: feed hand[handIndex] into the forced loader slot, clear
 * any resulting 3+ run, score it, refill the used hand slot, advance the
 * loader by rotateStep, and detect game-over (the loader's *next* stop is
 * already occupied). No-op (only lastEvent changes) if already game over
 * or handIndex is out of range.
 */
export function place(state: CarouselState, handIndex: number): CarouselState {
  if (state.gameOver || handIndex < 0 || handIndex >= HAND_SIZE) {
    return { ...state, lastEvent: 'none' }
  }

  const target = state.loaderPos
  const color = state.hand[handIndex]

  const placed = state.ring.slice()
  placed[target] = color

  const runIndices = matchRun(placed, target)
  const matched = runIndices.length >= 3
  const runLength = matched ? runIndices.length : 0

  let ring = placed
  let comboStreak = state.comboStreak
  let points = 0
  let cleared = state.cleared
  let longestRun = state.longestRun

  if (matched) {
    ring = applyMatch(placed, runIndices)
    comboStreak = state.comboStreak + 1
    points = MATCH_BASE * runLength + COMBO_BASE * (comboStreak - 1)
    cleared = state.cleared + runLength
    longestRun = Math.max(state.longestRun, runLength)
  } else {
    comboStreak = 0
  }

  const score = state.score + points
  const placements = state.placements + 1

  const drawnColor = nextColor(state.seed, state.rngCursor, state.config.colors)
  const rngCursor = state.rngCursor + 1
  const hand = state.hand.slice()
  hand[handIndex] = drawnColor

  const newLoaderPos = (target + state.config.rotateStep) % state.config.ringSize
  const gameOverAfter = ring[newLoaderPos] !== null

  let event: CarouselEvent
  if (gameOverAfter) event = 'gameover'
  else if (matched) event = comboStreak > 1 ? 'combo' : 'match'
  else event = 'place'

  const lastPlacement: PlacementOutcome = {
    handIndex,
    color,
    ringIndex: target,
    runIndices: matched ? runIndices : [],
    runLength,
    points,
    matched,
    gameOverAfter,
  }

  return {
    ...state,
    ring,
    loaderPos: newLoaderPos,
    hand,
    rngCursor,
    score,
    placements,
    cleared,
    comboStreak,
    longestRun,
    gameOver: gameOverAfter,
    lastEvent: event,
    lastPlacement,
  }
}

export function reduce(state: CarouselState, action: CarouselAction): CarouselState {
  switch (action.type) {
    case 'place':
      return place(state, action.handIndex)
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    default:
      return state
  }
}
