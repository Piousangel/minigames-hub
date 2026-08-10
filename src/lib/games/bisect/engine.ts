/**
 * Bisect — pure engine.
 *
 * Pure time-sense game: the player is shown a START signal and, later, an END
 * signal, with no ruler, no countdown, and no tick counter on screen. The
 * task is to tap the instant that bisects the interval — exactly halfway
 * between START and END — using nothing but felt duration.
 *
 * The round's start/end ticks are decided by an injected `Rng` the moment the
 * round is armed, and are never exposed to the player before they resolve
 * the round. The END signal itself never precedes a tap: if the player
 * hasn't tapped by `endTick + TIMEOUT_TICKS`, the round auto-resolves as a
 * miss. That ordering is what makes "predict the midpoint" (rather than
 * "react to a revealed answer") the only viable strategy.
 *
 * All functions here are pure and total: no timers, no `Date`, and no
 * `Math.random` — randomness only enters through an injected `Rng`, and only
 * at round-generation time (`generateRound`, called from `arm`). `step` and
 * `tap` consume zero rng, so every judged outcome is golden-testable from a
 * fixed script.
 */

export type Rng = () => number // returns a float in [0,1)

export type Phase = 'idle' | 'armed' | 'live' | 'resolved' | 'over'
export type Grade = 'perfect' | 'good' | 'ok' | 'miss'

export type BisectEvent =
  | 'none'
  | 'start' // armed -> live transition (START signal fires)
  | 'end' // live tick first crosses endTick (courtesy; phase unchanged)
  | 'falseStart' // tap while armed (before START)
  | 'timeout' // live, no tap, endTick + TIMEOUT_TICKS elapsed
  | 'perfect'
  | 'good'
  | 'ok'
  | 'miss' // live tap whose grade is 'miss'
  | 'over' // any failure event above, when it also drains the last life

export interface BisectRound {
  startTick: number
  endTick: number
  intervalLength: number
  trueMid: number // (startTick + endTick) / 2 — never rounded
}

export interface BisectState {
  phase: Phase
  tick: number
  round: BisectRound | null
  tapTick: number | null
  lastError: number | null
  lastNormError: number | null
  lastGrade: Grade | null
  score: number
  streak: number
  bestStreak: number
  roundsPlayed: number
  perfects: number
  lives: number
  lastEvent: BisectEvent
}

// -- Constants ---------------------------------------------------------------

export const LIVES = 3
export const MIN_LEAD = 20
export const MAX_LEAD = 90
export const MIN_INTERVAL = 30
export const MAX_INTERVAL = 180
export const TIMEOUT_TICKS = 60
export const PERFECT_MAX = 0.06
export const GOOD_MAX = 0.18
export const OK_MAX = 0.4
export const POINTS: Record<Grade, number> = { perfect: 100, good: 60, ok: 25, miss: 0 }
export const STREAK_BONUS_PER_HIT = 10

/** Identical impl to the template's mulberry32 (decant/flywheel share this). */
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

// -- Round generation (the only rng consumer) --------------------------------

/**
 * Consumes rng exactly twice, in order: lead, then intervalLength.
 */
export function generateRound(rng: Rng): BisectRound {
  const lead = MIN_LEAD + Math.floor(rng() * (MAX_LEAD - MIN_LEAD + 1))
  const intervalLength = MIN_INTERVAL + Math.floor(rng() * (MAX_INTERVAL - MIN_INTERVAL + 1))
  const startTick = lead
  const endTick = startTick + intervalLength
  const trueMid = (startTick + endTick) / 2
  return { startTick, endTick, intervalLength, trueMid }
}

// -- Pure grading -------------------------------------------------------------

export function gradeForNormError(normError: number): Grade {
  if (normError <= PERFECT_MAX) return 'perfect'
  if (normError <= GOOD_MAX) return 'good'
  if (normError <= OK_MAX) return 'ok'
  return 'miss'
}

export function judge(
  startTick: number,
  endTick: number,
  tapTick: number,
): { error: number; absError: number; normError: number; grade: Grade } {
  const trueMid = (startTick + endTick) / 2
  const error = tapTick - trueMid
  const absError = Math.abs(error)
  const halfInterval = (endTick - startTick) / 2
  const normError = halfInterval === 0 ? (absError === 0 ? 0 : Infinity) : absError / halfInterval
  const grade = gradeForNormError(normError)
  return { error, absError, normError, grade }
}

// -- Lifecycle ----------------------------------------------------------------

export function newGame(): BisectState {
  return {
    phase: 'idle',
    tick: 0,
    round: null,
    tapTick: null,
    lastError: null,
    lastNormError: null,
    lastGrade: null,
    score: 0,
    streak: 0,
    bestStreak: 0,
    roundsPlayed: 0,
    perfects: 0,
    lives: LIVES,
    lastEvent: 'none',
  }
}

/** The sole rng-consuming entry point (via generateRound, exactly 2 calls). */
export function arm(state: BisectState, rng: Rng): BisectState {
  if (state.phase !== 'idle' && state.phase !== 'resolved') {
    return { ...state, lastEvent: 'none' }
  }
  const round = generateRound(rng)
  return {
    ...state,
    round,
    phase: 'armed',
    tick: 0,
    tapTick: null,
    lastError: null,
    lastNormError: null,
    lastGrade: null,
    lastEvent: 'none',
  }
}

/** Pure tick advance. Never consumes rng. */
export function step(state: BisectState, tick: number): BisectState {
  if (state.phase !== 'armed' && state.phase !== 'live') {
    return { ...state, lastEvent: 'none' }
  }
  if (tick < state.tick) return { ...state, lastEvent: 'none' }

  const round = state.round as BisectRound

  if (state.phase === 'armed') {
    if (tick >= round.startTick) {
      return { ...state, tick, phase: 'live', lastEvent: 'start' }
    }
    return { ...state, tick, lastEvent: 'none' }
  }

  // phase === 'live'
  if (state.tapTick === null && tick >= round.endTick + TIMEOUT_TICKS) {
    const lives = state.lives - 1
    const over = lives <= 0
    return {
      ...state,
      tick,
      lives,
      streak: 0,
      lastGrade: 'miss',
      lastError: null,
      lastNormError: null,
      tapTick: null,
      roundsPlayed: state.roundsPlayed + 1,
      phase: over ? 'over' : 'resolved',
      lastEvent: over ? 'over' : 'timeout',
    }
  }

  const prevTick = state.tick
  const crossedEnd = prevTick < round.endTick && tick >= round.endTick
  return { ...state, tick, lastEvent: crossedEnd ? 'end' : 'none' }
}

/** Pure tap registration. Never consumes rng. */
export function tap(state: BisectState, tick: number): BisectState {
  if (state.phase === 'idle' || state.phase === 'resolved' || state.phase === 'over') {
    return { ...state, lastEvent: 'none' }
  }

  if (state.phase === 'armed') {
    const lives = state.lives - 1
    const over = lives <= 0
    return {
      ...state,
      lives,
      streak: 0,
      tapTick: tick,
      lastError: null,
      lastNormError: null,
      lastGrade: 'miss',
      roundsPlayed: state.roundsPlayed + 1,
      phase: over ? 'over' : 'resolved',
      lastEvent: over ? 'over' : 'falseStart',
    }
  }

  // phase === 'live'
  const round = state.round as BisectRound
  const { error, normError, grade } = judge(round.startTick, round.endTick, tick)

  if (grade === 'miss') {
    const lives = state.lives - 1
    const over = lives <= 0
    return {
      ...state,
      lives,
      streak: 0,
      tapTick: tick,
      lastError: error,
      lastNormError: normError,
      lastGrade: 'miss',
      roundsPlayed: state.roundsPlayed + 1,
      phase: over ? 'over' : 'resolved',
      lastEvent: over ? 'over' : 'miss',
    }
  }

  const streak = state.streak + 1
  const points = POINTS[grade] + STREAK_BONUS_PER_HIT * (streak - 1)
  const score = state.score + points
  const bestStreak = Math.max(state.bestStreak, streak)
  const perfects = state.perfects + (grade === 'perfect' ? 1 : 0)

  return {
    ...state,
    score,
    streak,
    bestStreak,
    perfects,
    roundsPlayed: state.roundsPlayed + 1,
    tapTick: tick,
    lastError: error,
    lastNormError: normError,
    lastGrade: grade,
    phase: 'resolved',
    lastEvent: grade,
  }
}
