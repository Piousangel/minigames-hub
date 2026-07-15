export type Rng = () => number

/**
 * Aim Trainer — pure state machine.
 *
 * The player must hit `targetCount` targets as fast as possible. One target is
 * shown at a time; clicking it is a hit (and advances toward completion),
 * clicking empty space is a miss (tracked only for accuracy).
 *
 * No `Math.random` / `performance.now` / `Date.now` inside this module: the
 * component injects the RNG and measures elapsed time. That keeps every
 * transition deterministic and unit-testable.
 */

/** A target position in normalized [0, 1] coordinates (fraction of the area). */
export interface Target {
  x: number
  y: number
}

export interface AimState {
  /** Total targets required to finish the run. */
  targetCount: number
  /** Targets successfully clicked. */
  hits: number
  /** Empty-space clicks (misses). */
  misses: number
  /** True once `hits` reaches `targetCount`. */
  done: boolean
}

export const DEFAULT_TARGET_COUNT = 30

/**
 * Margin (as a fraction of each axis) kept clear of the edges so a target is
 * never clipped at the border. Guarantees `nextTarget` stays within [0, 1].
 */
export const MARGIN = 0.08

export function newGame(targetCount: number = DEFAULT_TARGET_COUNT): AimState {
  return { targetCount: Math.max(1, Math.floor(targetCount)), hits: 0, misses: 0, done: false }
}

/**
 * A fresh target position, always within [MARGIN, 1 - MARGIN] on each axis.
 * `rng` must yield values in [0, 1); it is sampled once per axis.
 */
export function nextTarget(_state: AimState, rng: Rng): Target {
  const span = 1 - 2 * MARGIN
  return { x: MARGIN + rng() * span, y: MARGIN + rng() * span }
}

/** Record a hit and advance toward completion. Ignored once `done`. */
export function registerHit(state: AimState): AimState {
  if (state.done) return state
  const hits = state.hits + 1
  return { ...state, hits, done: hits >= state.targetCount }
}

/** Record a miss (accuracy only — it never advances completion). Ignored once `done`. */
export function registerMiss(state: AimState): AimState {
  if (state.done) return state
  return { ...state, misses: state.misses + 1 }
}

/** True when the run is finished (all targets hit). */
export function isComplete(state: AimState): boolean {
  return state.hits >= state.targetCount
}

/** Accuracy as a whole-number percent. 0 when nothing has been clicked yet. */
export function accuracy(state: AimState): number {
  const total = state.hits + state.misses
  if (total === 0) return 0
  return Math.round((state.hits / total) * 100)
}

/**
 * Targets per second given the elapsed time (ms) measured by the component.
 * Returns 0 for non-positive elapsed to avoid divide-by-zero.
 */
export function targetsPerSecond(state: AimState, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  return state.hits / (elapsedMs / 1000)
}
