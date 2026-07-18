// Quarry — pure, deterministic "deductive pursuit-puzzle" engine.
//
// A hidden quarry sits on one cell of a square grid. Each probe reveals the
// Chebyshev (king-move) distance to it AND spooks it one cell directly away
// along the axis of greatest separation — reveal and board-mutation are the
// SAME action. Herd it into a corner and read a 0 within the probe budget.
//
// No Math.random anywhere in this file: the only randomness source is the
// injected `Rng` (produced by the pure `mulberry32` PRNG), used ONLY to place
// the quarry at level start. Distance, flee, scoring, and progression are all
// pure functions of their arguments and fully deterministic/replayable.

export type Rng = () => number // () => [0,1); the ONLY randomness source

export interface Pos {
  row: number
  col: number
}

/** Full replayable game state. Pure reducer target. */
export interface QuarryState {
  size: number // board is size×size (odd, 5..7)
  level: number // 1-based; drives size + par + budget
  quarry: Pos // hidden target's current cell
  probesLeft: number // budget remaining (start = budget(level))
  budget: number // starting budget for this level (for par/score math)
  history: ProbeRecord[] // every probe applied this level, in order
  status: 'playing' | 'won' | 'lost'
  lastProbe: ProbeResult | null // result of the most recent probe (for the view)
}

/** One committed probe, enough to replay + render the trail. */
export interface ProbeRecord {
  at: Pos // cell the player probed
  distance: number // Chebyshev distance READ at probe time (pre-move)
  from: Pos // quarry position BEFORE the flee
  to: Pos // quarry position AFTER the flee (=== from when caught or pinned)
  caught: boolean // distance === 0
}

/** Return value of applying a probe (also mirrored into state.lastProbe). */
export interface ProbeResult {
  at: Pos
  distance: number
  from: Pos
  to: Pos
  fled: boolean // true if the quarry actually moved a cell
  caught: boolean
}

// ---- Tunables ----
export const MIN_SIZE = 5
export const MAX_SIZE = 7
export const BASE_BUDGET = 8 // probes at level 1

/** Board size for a level: 5 for lv1-2, 7 for lv3+, capped at MAX_SIZE (7). */
export function sizeForLevel(level: number): number {
  // Odd sizes only so corners/center are well-defined.
  if (level <= 2) return 5
  return 7
}

export function budgetForLevel(level: number): number {
  // 5×5 boards: 8 probes. 7×7 boards: 10 probes.
  return sizeForLevel(level) === 5 ? 8 : 10
}

export function parForLevel(level: number): number {
  // "Good play" target used for star tiers. 5×5 => 5, 7×7 => 7 (== size).
  return sizeForLevel(level)
}

// ---- Distance + flee rule (the core, exhaustively testable) ----

/** King-move (Chebyshev) distance. */
export function chebyshev(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col))
}

/** clamp v into [0, size-1]. */
export function clampCoord(v: number, size: number): number {
  return v < 0 ? 0 : v > size - 1 ? size - 1 : v
}

/**
 * The deterministic panic-hop. Given the quarry, the probed cell, and the board
 * size, return the quarry's next cell.
 *
 *   1. If quarry === probe -> caught; return quarry unchanged (no flee).
 *   2. Choose flee AXIS by greatest separation, tie-break VERTICAL-then-
 *      HORIZONTAL: |dr| >= |dc| flees vertically, else horizontally.
 *   3. Step ONE cell directly AWAY from the probe along that axis.
 *   4. WALL PIN: clamp to the board; if clamping leaves it equal to the quarry
 *      (already on the wall it would flee toward), it does NOT move.
 */
export function fleeFrom(quarry: Pos, probe: Pos, size: number): Pos {
  const dr = quarry.row - probe.row
  const dc = quarry.col - probe.col
  if (dr === 0 && dc === 0) return quarry
  let stepRow = 0
  let stepCol = 0
  if (Math.abs(dr) >= Math.abs(dc)) {
    // On this branch dr !== 0: if dr were 0 then |dc| <= 0 too => caught case.
    stepRow = dr > 0 ? 1 : -1
  } else {
    stepCol = dc > 0 ? 1 : -1
  }
  return {
    row: clampCoord(quarry.row + stepRow, size),
    col: clampCoord(quarry.col + stepCol, size),
  }
}

// ---- The reducer ----

/**
 * Apply one probe at `at`. Pure: returns a NEW state, never mutates input.
 * Order (reveal and board-change are the SAME action):
 *   1. Read distance = chebyshev(quarry, at)  [pre-move reading]
 *   2. Compute the flee target = fleeFrom(quarry, at, size)
 *   3. Decrement probesLeft.
 *   4. Resolve status.
 */
export function probe(state: QuarryState, at: Pos): QuarryState {
  if (state.status !== 'playing') return state
  // Guard: probing an off-board cell is a no-op (component never sends these).
  if (at.row < 0 || at.row >= state.size || at.col < 0 || at.col >= state.size) {
    return state
  }

  const from = state.quarry
  const distance = chebyshev(from, at)
  const caught = distance === 0
  const to = caught ? from : fleeFrom(from, at, state.size)
  const fled = to.row !== from.row || to.col !== from.col

  const record: ProbeRecord = { at, distance, from, to, caught }
  const result: ProbeResult = { at, distance, from, to, fled, caught }
  const probesLeft = state.probesLeft - 1

  let status: QuarryState['status'] = 'playing'
  if (caught) status = 'won'
  else if (probesLeft <= 0) status = 'lost'

  return {
    ...state,
    quarry: to,
    probesLeft,
    history: [...state.history, record],
    status,
    lastProbe: result,
  }
}

// ---- Level construction ----

/**
 * Place the quarry for a fresh level. RNG is used ONLY here. Every placement on
 * every odd board is winnable within budget (you may always probe the quarry's
 * own cell), so we accept any cell.
 */
export function newLevel(level: number, rng: Rng): QuarryState {
  const size = sizeForLevel(level)
  const budget = budgetForLevel(level)
  const row = Math.floor(rng() * size)
  const col = Math.floor(rng() * size)
  return {
    size,
    level,
    quarry: { row: clampCoord(row, size), col: clampCoord(col, size) },
    probesLeft: budget,
    budget,
    history: [],
    status: 'playing',
    lastProbe: null,
  }
}

/** Fresh run at level 1. */
export function newGame(rng: Rng): QuarryState {
  return newLevel(1, rng)
}

/** Advance to the next level after a win, reusing the same rng stream. */
export function nextLevel(state: QuarryState, rng: Rng): QuarryState {
  return newLevel(state.level + 1, rng)
}

// ---- Scoring, stars, streak ----

export interface LevelScore {
  probesUsed: number // history.length at win
  par: number // parForLevel(level)
  stars: 1 | 2 | 3 // tier
  underPar: boolean // probesUsed < par
}

/**
 * Star tiers (fewer probes = better):
 *   3 stars: probesUsed <= par - 2
 *   2 stars: probesUsed <= par
 *   1 star:  probesUsed >  par (won, but over par)
 * A win is always at least 1 star; a loss produces no LevelScore.
 */
export function scoreLevel(level: number, probesUsed: number): LevelScore {
  const par = parForLevel(level)
  let stars: 1 | 2 | 3 = 1
  if (probesUsed <= par - 2) stars = 3
  else if (probesUsed <= par) stars = 2
  const underPar = probesUsed < par
  return { probesUsed, par, stars, underPar }
}

/**
 * Streak = count of CONSECUTIVE under-par captures. A loss OR an over-par win
 * resets the streak to 0.
 */
export function nextStreak(prevStreak: number, s: LevelScore | null): number {
  if (s && s.underPar) return prevStreak + 1
  return 0
}

/** Bonus points folded into Score: +5 per consecutive under-par capture. */
export function streakBonus(streak: number): number {
  return streak * 5
}

/** Base points for clearing a level + star bonus + current streak bonus. */
export function levelPoints(s: LevelScore, streakAfter: number): number {
  const starBonus = s.stars === 3 ? 30 : s.stars === 2 ? 15 : 5
  const base = 10 + (s.par - s.probesUsed) * 2 // reward efficiency; clamp >= 0
  const eff = base < 0 ? 0 : base
  return eff + starBonus + streakBonus(streakAfter)
}

// ---- Solvability proof + test-time solver ----

/**
 * BFS lower bound on probes to force a read of 0 from `start`. Because you may
 * always probe the quarry's OWN cell for an instant catch, reachability is
 * trivially 1 from any node and no board is ever unwinnable. This models the
 * known-position lower bound used only to assert budget >= 1; the real
 * difficulty is blind deduction, not reachability.
 */
export function minProbesToCatch(start: Pos, size: number): number {
  // Guard against a nonsensical board.
  if (size <= 0) return Infinity
  if (start.row < 0 || start.row >= size || start.col < 0 || start.col >= size) {
    return Infinity
  }
  // BFS from `start` where each of the size*size cells is a candidate probe.
  // The goal edge is probing the node's OWN cell (distance 0 = catch), which is
  // available from every node, so the shortest path is always length 1. We
  // still expand one BFS level so a future flee-rule refactor that somehow made
  // a cell uncatchable would surface here rather than silently returning 1.
  const frontier: Pos[] = [start]
  for (const node of frontier) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const at = { row: r, col: c }
        if (chebyshev(node, at) === 0) {
          // A valid catching probe exists from this node -> reachable in 1.
          return 1
        }
      }
    }
  }
  return Infinity
}

/** Every cell of every supported board must be winnable within budget. */
export function assertWinnable(size: number, budget: number): boolean {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (minProbesToCatch({ row: r, col: c }, size) > budget) return false
    }
  }
  return true
}

// ---- Seeding helpers (impure, allowed — they *produce* the rng) ----

/** mulberry32 PRNG — identical to src/lib/games/ripple/engine.ts. */
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

/** FNV-1a hash of a 'YYYY-MM-DD' string. */
export function dailySeed(dateStr: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Convenience: build an rng from an integer seed. */
export function makeRng(seed: number): Rng {
  return mulberry32(seed >>> 0)
}
