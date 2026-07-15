export type Rng = () => number

/**
 * Reaction Time Test — pure state machine.
 *
 *   idle → waiting (red, random delay) → ready (green, timer) → result (ms)
 *                    └─ click too soon ─────────────────────→ early (fail)
 *
 * No `Math.random` / `performance.now` / `Date.now` inside this module: the
 * component injects the RNG and measures elapsed time. That keeps every
 * transition deterministic and unit-testable.
 */

export type Phase = 'idle' | 'waiting' | 'ready' | 'result' | 'early'

export interface ReactionState {
  phase: Phase
  /** Random delay (ms) chosen for the current `waiting` phase. */
  delayMs: number
  /** Most recent successful reaction time (ms), or null before the first. */
  lastMs: number | null
  /** Successful reaction times (ms), oldest → newest. Cleared on reset. */
  attempts: number[]
}

export const MIN_DELAY = 1000
export const MAX_DELAY = 3000

export function newReactionGame(): ReactionState {
  return { phase: 'idle', delayMs: 0, lastMs: null, attempts: [] }
}

/**
 * Random wait before the screen turns green, in [MIN_DELAY, MAX_DELAY).
 * `rng` must yield a value in [0, 1).
 */
export function randomDelay(rng: Rng): number {
  return Math.floor(MIN_DELAY + rng() * (MAX_DELAY - MIN_DELAY))
}

/** idle / result / early → waiting: pick a fresh delay and go red. */
export function start(state: ReactionState, rng: Rng): ReactionState {
  return { ...state, phase: 'waiting', delayMs: randomDelay(rng) }
}

/** waiting → ready: the screen turns green and the timer starts. */
export function arm(state: ReactionState): ReactionState {
  if (state.phase !== 'waiting') return state
  return { ...state, phase: 'ready' }
}

/** ready → result: record the reaction time (ms). Ignored in other phases. */
export function react(state: ReactionState, reactionMs: number): ReactionState {
  if (state.phase !== 'ready') return state
  const ms = Math.max(0, Math.round(reactionMs))
  return { ...state, phase: 'result', lastMs: ms, attempts: [...state.attempts, ms] }
}

/** waiting → early: the user clicked before green. History is untouched. */
export function tooSoon(state: ReactionState): ReactionState {
  if (state.phase !== 'waiting') return state
  return { ...state, phase: 'early' }
}

/** Back to a fresh idle state, clearing the attempt history. */
export function reset(): ReactionState {
  return newReactionGame()
}

/** Average of the last `n` attempts (rounded), or null when there are none. */
export function average(attempts: number[], n = 5): number | null {
  if (attempts.length === 0) return null
  const recent = attempts.slice(-n)
  const sum = recent.reduce((a, b) => a + b, 0)
  return Math.round(sum / recent.length)
}

/** Fastest (lowest) attempt, or null when there are none. Lower is better. */
export function best(attempts: number[]): number | null {
  if (attempts.length === 0) return null
  return Math.min(...attempts)
}
