// Overload — a solo, combo-scored chain-reaction puzzle on a 6×6 grid.
//
// Pure, deterministic engine. NO Math.random anywhere in this file: the only
// randomness source is the injected `Rng` (produced by the pure `mulberry32`
// PRNG) and it is used exclusively for board generation. Cascade resolution
// takes no rng — it is a bounded deterministic BFS.

export const ROWS = 6
export const COLS = 6
export const CELLS = 36 // ROWS * COLS

export const BASE_SCORE = 10 // score per overload before multiplier
export const TAP_BUDGET = 12 // puzzle-mode taps per board
export const ENDLESS_START_TAPS = 10 // endless starting pool
export const ENDLESS_REFILL = 5 // taps granted on each Perfect Storm in endless
export const PERFECT_STORM_BONUS = 500
export const TAP_SAVE_BONUS = 50 // per unused tap when board is cleared
export const MAX_STEPS = 200 // hard cascade cap — guarantees termination

// -- DOCUMENTED, DELIBERATE DEVIATION (Perfect Storm win condition) ----------
// The spec defines a "Perfect Storm" as the whole board reaching zero
// (`charges.every(c => c === 0)`). Under the spec's own reset-to-0 + push-to-
// neighbours semantics this is PROVABLY UNREACHABLE: after any wave, every cell
// adjacent to the overloaded set has received +1 and therefore holds charge > 0,
// so a non-empty cascade can never terminate on an all-zero board. Implementing
// the literal condition would make the game permanently unwinnable (puzzle never
// advances, endless never refills).
//
// Faithful, achievable reinterpretation: a Perfect Storm is a single tap whose
// chain SWEEPS THE WHOLE BOARD — a cascade of at least CELLS overloads (one
// board's worth). This preserves the concept ("one tap unravels the whole
// board"), the scoring/bonus structure, and the "find THE perfect tap / fewest
// taps" loop, while being reachable and cleanly testable.
export const CLEAR_TARGET = CELLS // overloads in one tap that count as a Perfect Storm

export type Rng = () => number // returns [0,1)
export type Mode = 'puzzle' | 'endless'

/** One resolution wave (for animation replay + scoring). */
export interface Wave {
  overloaded: number[] // flat indices that overloaded this wave, ascending
  chargesAfter: number[] // length-36 board state AFTER this wave is applied
  multiplier: number // = 1-based wave number
  gained: number // overloaded.length * BASE_SCORE * multiplier
}

/** Full result of resolving a single tap's cascade. */
export interface CascadeResult {
  charges: number[] // final stable board (length 36)
  waves: Wave[] // ordered; empty if the tap caused no overload
  chainLength: number // total overloads across all waves
  scoreDelta: number // sum of wave.gained
  truncated: boolean // true only if MAX_STEPS was hit (expected false)
}

export interface GameState {
  charges: number[] // length 36, charge held per cell (always < capacity when stable)
  tapsLeft: number // remaining taps (both modes decrement per tap)
  score: number
  mode: Mode
  level: number // 1-based board index (drives density)
  seed: number // seed used to generate THIS board (for per-board best keying)
  cleared: boolean // Perfect Storm achieved on the current board
  over: boolean // run ended: tapsLeft hit 0 without clearing
}

// ---------------------------------------------------------------------------
// 1.2 Geometry (precomputed lookups)
// ---------------------------------------------------------------------------

/** Capacity = number of orthogonal on-board neighbours. corner=2, edge=3, centre=4. */
export function capacityOf(index: number): number {
  const r = Math.floor(index / COLS)
  const c = index % COLS
  let cap = 0
  if (r > 0) cap++
  if (r < ROWS - 1) cap++
  if (c > 0) cap++
  if (c < COLS - 1) cap++
  return cap
}

function computeNeighbors(index: number): number[] {
  const r = Math.floor(index / COLS)
  const c = index % COLS
  const out: number[] = []
  if (r > 0) out.push(index - COLS)
  if (c > 0) out.push(index - 1)
  if (c < COLS - 1) out.push(index + 1)
  if (r < ROWS - 1) out.push(index + COLS)
  // Ascending order: up (< index), left, right, down — already ascending because
  // up = index-COLS, left = index-1, right = index+1, down = index+COLS.
  return out.sort((a, b) => a - b)
}

export const CAPACITY: number[] = Array.from({ length: CELLS }, (_, i) => capacityOf(i))
export const NEIGHBORS: number[][] = Array.from({ length: CELLS }, (_, i) => computeNeighbors(i))

export function neighborsOf(index: number): number[] {
  return NEIGHBORS[index]
}

// ---------------------------------------------------------------------------
// 1.3 Deterministic PRNG + board generation
// ---------------------------------------------------------------------------

/** Pure seeded PRNG. Uses Math.imul + bit ops only — NO Math.random. */
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

/** Density in [0,1]: probability a cell is seeded critical (capacity-1). */
export function puzzleDensity(level: number): number {
  return Math.min(0.85, 0.45 + 0.05 * (level - 1))
}

export function endlessDensity(round: number): number {
  return Math.min(0.9, 0.4 + 0.06 * (round - 1))
}

/**
 * Seed a near-critical, STABLE board (every charge < capacity, no auto-overload).
 * Per cell: with prob=density set charge = capacity-1 (critical); else uniform int
 * in [0, capacity-1]. Guarantees ≥1 critical cell exists so a tap can always ignite.
 */
export function seedBoard(rng: Rng, density: number): number[] {
  const charges = new Array<number>(CELLS)
  let hasCritical = false
  for (let i = 0; i < CELLS; i++) {
    const cap = CAPACITY[i]
    if (rng() < density) {
      charges[i] = cap - 1 // critical
      hasCritical = true
    } else {
      // uniform int in [0, cap-1]
      charges[i] = Math.floor(rng() * cap)
      if (charges[i] === cap - 1) hasCritical = true
    }
  }
  if (!hasCritical) {
    const i = Math.floor(rng() * CELLS)
    charges[i] = CAPACITY[i] - 1
  }
  return charges
}

// ---------------------------------------------------------------------------
// 1.4 Cascade resolution (deterministic, no rng)
// ---------------------------------------------------------------------------

/**
 * One simultaneous wave. Snapshot semantics:
 *  1. overloaded = all i where charges[i] >= CAPACITY[i] (ascending).
 *  2. If none → return null (board is stable).
 *  3. next = copy; set next[i]=0 for every overloaded i (reset-to-0);
 *     then for every overloaded i, add +1 to each NEIGHBORS[i].
 */
export function resolveStep(
  charges: number[],
): { next: number[]; overloaded: number[] } | null {
  const overloaded: number[] = []
  for (let i = 0; i < CELLS; i++) {
    if (charges[i] >= CAPACITY[i]) overloaded.push(i)
  }
  if (overloaded.length === 0) return null

  const next = charges.slice()
  for (const i of overloaded) next[i] = 0
  for (const i of overloaded) {
    for (const n of NEIGHBORS[i]) next[n] += 1
  }
  return { next, overloaded }
}

/**
 * Repeatedly applies resolveStep, wave by wave, until stable or MAX_STEPS.
 * Wave w (1-based) multiplier = w; gained = overloaded.length * BASE_SCORE * w.
 */
export function resolveCascade(charges: number[]): CascadeResult {
  let current = charges.slice()
  const waves: Wave[] = []
  let chainLength = 0
  let scoreDelta = 0
  let truncated = false

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = resolveStep(current)
    if (res === null) {
      return { charges: current, waves, chainLength, scoreDelta, truncated: false }
    }
    const multiplier = step + 1
    const gained = res.overloaded.length * BASE_SCORE * multiplier
    chainLength += res.overloaded.length
    scoreDelta += gained
    waves.push({
      overloaded: res.overloaded,
      chargesAfter: res.next,
      multiplier,
      gained,
    })
    current = res.next
  }

  // MAX_STEPS reached. Because exact-capacity overloads conserve total charge,
  // some configurations (e.g. a fully-critical board) OSCILLATE and never reach
  // a stable state — the spec's "never reached" claim does not hold for those.
  // This cap is therefore load-bearing, not merely theoretical: it guarantees
  // the function returns instead of hanging. The partial result is returned with
  // truncated=true. (A board-spanning chain like this still counts as a Perfect
  // Storm via CLEAR_TARGET, so gameplay stays coherent.)
  truncated = true
  return { charges: current, waves, chainLength, scoreDelta, truncated }
}

/** Empty cascade over an already-stable board — used for no-op taps. */
export function emptyCascade(charges: number[]): CascadeResult {
  return { charges: charges.slice(), waves: [], chainLength: 0, scoreDelta: 0, truncated: false }
}

// ---------------------------------------------------------------------------
// 1.5 Headline pure functions
// ---------------------------------------------------------------------------

/**
 * THE core function. Applies a tap at `index` and returns the fully-resolved
 * post-cascade state PLUS the CascadeResult (for animation). Pure; never mutates
 * input. Takes NO rng (cascade is deterministic).
 */
export function addCharge(
  state: GameState,
  index: number,
): { state: GameState; result: CascadeResult } {
  if (state.over || state.cleared || state.tapsLeft <= 0 || index < 0 || index >= CELLS) {
    return { state, result: emptyCascade(state.charges) }
  }

  const charges = state.charges.slice()
  charges[index] += 1
  const result = resolveCascade(charges)

  const tapsLeft = state.tapsLeft - 1
  let score = state.score + result.scoreDelta
  // Perfect Storm — a board-spanning chain (see CLEAR_TARGET note above).
  const cleared = result.chainLength >= CLEAR_TARGET
  let over = false

  if (cleared) {
    score += PERFECT_STORM_BONUS + Math.max(0, tapsLeft) * TAP_SAVE_BONUS
  } else if (tapsLeft <= 0) {
    over = true
  }

  const next: GameState = {
    ...state,
    charges: result.charges,
    tapsLeft,
    score,
    cleared,
    over,
  }
  return { state: next, result }
}

/** Fresh run. seed stored on state for per-board best keying. */
export function newGame(rng: Rng, mode: Mode, seed: number): GameState {
  const density = mode === 'puzzle' ? puzzleDensity(1) : endlessDensity(1)
  return {
    charges: seedBoard(rng, density),
    tapsLeft: mode === 'puzzle' ? TAP_BUDGET : ENDLESS_START_TAPS,
    score: 0,
    mode,
    level: 1,
    seed,
    cleared: false,
    over: false,
  }
}

/** Advance to the next (denser) board after a Perfect Storm. Carries score. */
export function nextBoard(state: GameState, rng: Rng, seed: number): GameState {
  const level = state.level + 1
  const density = state.mode === 'puzzle' ? puzzleDensity(level) : endlessDensity(level)
  return {
    ...state,
    charges: seedBoard(rng, density),
    level,
    seed,
    tapsLeft: state.mode === 'puzzle' ? TAP_BUDGET : state.tapsLeft + ENDLESS_REFILL,
    cleared: false,
    over: false,
  }
}
