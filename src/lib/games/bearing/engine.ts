/**
 * Bearing — pure, deterministic deduction engine.
 *
 * A treasure is buried on an N×N grid. `dig(x,y)` compares SIGNS only — no
 * atan2, no magnitude comparison:
 *
 *   dx = target.x - x   (x = column, increases East)
 *   dy = target.y - y   (y = row,    increases South)
 *
 *   dx=0, dy=0  -> 'found'
 *   dx=0, dy<0  -> 'N'      dx=0, dy>0  -> 'S'
 *   dx>0, dy=0  -> 'E'      dx<0, dy=0  -> 'W'
 *   dx>0, dy<0  -> 'NE'     dx>0, dy>0  -> 'SE'
 *   dx<0, dy<0  -> 'NW'     dx<0, dy>0  -> 'SW'
 *
 * Because sign(dx) and sign(dy) are each independently one of {-1,0,1}, ties
 * are structurally impossible regardless of grid parity — that would only be
 * a concern for an angle/atan2-based bucketing, which this deliberately is
 * not. Grid sizes are still fixed to ODD here for a different, simpler
 * reason: it gives a well-defined integer center cell ((size-1)/2) to seed
 * the keyboard cursor, mirroring sonar's `mid`.
 *
 * The deduction insight: a single dig reveals the sign of dx AND the sign of
 * dy independently — two ternary facts, not one angle bucket. That's what
 * collapses a 9x9 board to a handful of candidate cells in 2-3 digs. The
 * engine tracks this explicitly as a shrinking axis-aligned bounding box
 * (`Region`), which doubles as the render hook for "shade out the ruled-out
 * area."
 *
 * Purity: NO Math.random / Date / performance.now anywhere in this file. The
 * only randomness source is an injected `Rng`, consumed ONLY when placing the
 * target (exactly twice, in createGame). dig/narrowRegion/bearingOf/reduce/
 * scoreOnWin consume zero rng, so every outcome is a pure function of a fixed
 * script and fully golden-testable.
 */

export type Rng = () => number // () => [0,1); the ONLY randomness source

export interface Pos {
  x: number // column, East+
  y: number // row, South+
}

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
export type DigResult = Direction | 'found'

export interface BearingConfig {
  size: number // N; board is N×N. MUST be odd, >=5 (documented invariant, not runtime-enforced)
  digBudget: number // hard cap on digs; reaching it without 'found' => lose
}

export interface DigRecord {
  at: Pos
  result: DigResult
  seq: number // 1-based, in play order
}

/** Axis-aligned bounding box of cells not yet ruled out. Shrinks monotonically. */
export interface Region {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export type BearingEvent =
  | 'none'
  | 'dig' // informative dig, bearing returned
  | 'dig-repeat' // re-dig of an already-dug cell; no cost, no new info
  | 'found' // exact hit -> win
  | 'illegal' // OOB, or game already resolved
  | 'lose' // this dig exhausted the budget without finding the target

export type BearingStatus = 'playing' | 'won' | 'lost'

export interface BearingState {
  config: BearingConfig
  seed: number
  size: number
  target: Pos // oracle; always present in state, UI hides it until resolved
  digs: DigRecord[] // full history, in order
  digGrid: (DigResult | null)[][] // [y][x], null = undug
  region: Region // current provably-possible bounding box
  cursor: Pos // keyboard focus, clamped to [0,size)
  digsUsed: number // === digs.length
  digBudget: number // === config.digBudget (copied for convenience)
  par: number // optimalPar(size); efficiency-bonus baseline
  score: number // 0 while playing/lost; set once on 'found'
  status: BearingStatus
  lastEvent: BearingEvent
  lastDig: DigRecord | null
}

export type BearingAction =
  | { type: 'dig'; at: Pos }
  | { type: 'move'; dx: number; dy: number } // relative cursor move, clamped
  | { type: 'cursor'; at: Pos } // absolute cursor move, clamped
  | { type: 'reset' } // regenerate same seed
  | { type: 'new'; seed: number } // new seed

// ---- Constants ----
export const WIN_BONUS = 1000
export const PAR_BONUS_MAX = 1000
export const SHOVEL_BONUS = 100 // per unused dig remaining at the moment of the find

export const STAGE_SIZES: number[] = [7, 9, 11, 13, 15, 17, 19, 21] // all odd, ladder plateaus at 21
const STAGE_SLACK = 3

export const DIFFICULTIES = {
  easy: { size: 7, digBudget: optimalPar(7) + 4 },
  normal: { size: 9, digBudget: optimalPar(9) + 4 },
  hard: { size: 13, digBudget: optimalPar(13) + 4 },
} satisfies Record<'easy' | 'normal' | 'hard', BearingConfig>

export const DAILY_CONFIG: BearingConfig = DIFFICULTIES.normal

// ---- Pure primitives ----

/** mulberry32 PRNG — byte-identical to decant/sonar. */
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
 * Pure sign comparison per the header table. Total function — every (dx,dy)
 * in Z×Z maps to exactly one of the 9 results. No branch depends on |dx| vs
 * |dy| — magnitude is irrelevant, only the sign of each axis matters.
 */
export function bearingOf(dx: number, dy: number): DigResult {
  const sx = dx === 0 ? 0 : dx > 0 ? 1 : -1
  const sy = dy === 0 ? 0 : dy > 0 ? 1 : -1
  if (sx === 0 && sy === 0) return 'found'
  if (sx === 0) return sy < 0 ? 'N' : 'S'
  if (sy === 0) return sx > 0 ? 'E' : 'W'
  if (sx > 0) return sy < 0 ? 'NE' : 'SE'
  return sy < 0 ? 'NW' : 'SW'
}

export function inBounds(size: number, p: Pos): boolean {
  return p.x >= 0 && p.x < size && p.y >= 0 && p.y < size
}

/** Clamp to [0, size-1]. Identical to sonar's clampCoord (rename param only). */
export function clampCoord(v: number, size: number): number {
  return v < 0 ? 0 : v > size - 1 ? size - 1 : v
}

/**
 * Theoretical min-dig count for a perfect simultaneous binary search on both
 * axes. Used ONLY for the score's efficiency bonus — decoupled from
 * digBudget (the lose-condition ceiling), same separation of concerns as
 * sonar's `par` vs `lives`.
 */
export function optimalPar(size: number): number {
  return Math.max(1, Math.ceil(Math.log2(size)) + 1)
}

/**
 * Algebraic inverse of bearingOf: narrows `region` given a dig at `at` whose
 * result was `result`. Never returns a region wider than the input
 * (monotonic shrink). East-ish results (E,NE,SE) raise xMin to at.x+1;
 * west-ish (W,NW,SW) lower xMax to at.x-1; axis results with dx=0 (N,S)
 * collapse x to exactly at.x. Symmetric rule for y using north-ish
 * (N,NE,NW) / south-ish (S,SE,SW) / dy=0 (E,W). Never called with
 * result='found' (dig() short-circuits to the win branch first).
 */
export function narrowRegion(region: Region, at: Pos, result: Direction): Region {
  let { xMin, xMax, yMin, yMax } = region

  const eastish = result === 'E' || result === 'NE' || result === 'SE'
  const westish = result === 'W' || result === 'NW' || result === 'SW'
  const axisX = result === 'N' || result === 'S' // dx === 0

  if (eastish) xMin = Math.max(xMin, at.x + 1)
  else if (westish) xMax = Math.min(xMax, at.x - 1)
  else if (axisX) {
    xMin = at.x
    xMax = at.x
  }

  const southish = result === 'S' || result === 'SE' || result === 'SW'
  const northish = result === 'N' || result === 'NE' || result === 'NW'
  const axisY = result === 'E' || result === 'W' // dy === 0

  if (southish) yMin = Math.max(yMin, at.y + 1)
  else if (northish) yMax = Math.min(yMax, at.y - 1)
  else if (axisY) {
    yMin = at.y
    yMax = at.y
  }

  return { xMin, xMax, yMin, yMax }
}

/**
 * Consumes rng EXACTLY twice, in order: x = floor(rng()*size), then
 * y = floor(rng()*size). Uniform over the size×size grid, no rejection
 * sampling (single target, no separation constraint needed).
 */
export function placeTarget(size: number, rng: Rng): Pos {
  const x = Math.floor(rng() * size)
  const y = Math.floor(rng() * size)
  return { x, y }
}

export function emptyDigGrid(size: number): (DigResult | null)[][] {
  const grid: (DigResult | null)[][] = []
  for (let y = 0; y < size; y++) {
    grid.push(new Array<DigResult | null>(size).fill(null))
  }
  return grid
}

export function createGame(cfg: BearingConfig, seed: number): BearingState {
  const target = placeTarget(cfg.size, mulberry32(seed))
  const mid = Math.floor((cfg.size - 1) / 2)
  return {
    config: cfg,
    seed,
    size: cfg.size,
    target,
    digs: [],
    digGrid: emptyDigGrid(cfg.size),
    region: { xMin: 0, xMax: cfg.size - 1, yMin: 0, yMax: cfg.size - 1 },
    cursor: { x: mid, y: mid },
    digsUsed: 0,
    digBudget: cfg.digBudget,
    par: optimalPar(cfg.size),
    score: 0,
    status: 'playing',
    lastEvent: 'none',
    lastDig: null,
  }
}

/**
 * = WIN_BONUS + round(PAR_BONUS_MAX * min(1, par/digsUsed))
 *   + max(0, digBudget-digsUsed) * SHOVEL_BONUS
 * Strictly decreasing in digsUsed for fixed (par, digBudget) once
 * digsUsed >= par (both bonus terms shrink or stay flat as digsUsed grows) —
 * the "fewer digs = more score" contract.
 */
export function scoreOnWin(par: number, digsUsed: number, digBudget: number): number {
  const parBonus = Math.round(PAR_BONUS_MAX * Math.min(1, par / digsUsed))
  const shovelBonus = Math.max(0, digBudget - digsUsed) * SHOVEL_BONUS
  return WIN_BONUS + parBonus + shovelBonus
}

/**
 * Pure: returns a NEW state, never mutates input, consumes no rng.
 * Rules, checked in order:
 *  1. status !== 'playing'         -> illegal, no other change
 *  2. !inBounds                    -> illegal
 *  3. digGrid[at.y][at.x] !== null -> dig-repeat, no cost
 *  4. else compute bearingOf, append DigRecord, write digGrid, digsUsed += 1
 *     4a. 'found' -> won, region collapses to the found cell, score set
 *     4b. else -> region narrows; digsUsed >= digBudget -> lost (score 0)
 */
export function dig(state: BearingState, at: Pos): BearingState {
  if (state.status !== 'playing') return { ...state, lastEvent: 'illegal' }
  if (!inBounds(state.size, at)) return { ...state, lastEvent: 'illegal' }
  if (state.digGrid[at.y][at.x] !== null) return { ...state, lastEvent: 'dig-repeat' }

  const dx = state.target.x - at.x
  const dy = state.target.y - at.y
  const result = bearingOf(dx, dy)
  const seq = state.digs.length + 1
  const record: DigRecord = { at, result, seq }

  const digGrid = state.digGrid.map((row) => row.slice())
  digGrid[at.y][at.x] = result

  const digs = [...state.digs, record]
  const digsUsed = state.digsUsed + 1

  if (result === 'found') {
    const region: Region = { xMin: at.x, xMax: at.x, yMin: at.y, yMax: at.y }
    const score = scoreOnWin(state.par, digsUsed, state.digBudget)
    return {
      ...state,
      digs,
      digGrid,
      digsUsed,
      region,
      status: 'won',
      score,
      lastEvent: 'found',
      lastDig: record,
    }
  }

  const region = narrowRegion(state.region, at, result)
  const lost = digsUsed >= state.digBudget
  return {
    ...state,
    digs,
    digGrid,
    digsUsed,
    region,
    status: lost ? 'lost' : state.status,
    lastEvent: lost ? 'lose' : 'dig',
    lastDig: record,
  }
}

export function reduce(state: BearingState, action: BearingAction): BearingState {
  switch (action.type) {
    case 'dig':
      return dig(state, action.at)
    case 'move': {
      const cursor: Pos = {
        x: clampCoord(state.cursor.x + action.dx, state.size),
        y: clampCoord(state.cursor.y + action.dy, state.size),
      }
      return { ...state, cursor, lastEvent: 'none' }
    }
    case 'cursor': {
      const cursor: Pos = {
        x: clampCoord(action.at.x, state.size),
        y: clampCoord(action.at.y, state.size),
      }
      return { ...state, cursor, lastEvent: 'none' }
    }
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    default:
      return state
  }
}

export function isWon(state: BearingState): boolean {
  return state.status === 'won'
}

export function isLost(state: BearingState): boolean {
  return state.status === 'lost'
}

/** FNV-1a hash of a 'YYYY-MM-DD' string. Pure. Byte-identical copy of sonar's. */
export function dailySeed(dateStr: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function stageConfig(stage: number): BearingConfig {
  const clamped = Math.min(Math.max(1, Math.floor(stage)), STAGE_SIZES.length)
  const size = STAGE_SIZES[clamped - 1]
  return { size, digBudget: optimalPar(size) + STAGE_SLACK }
}
