// Flywheel — pure, deterministic timing governor.
//
// A wheel spins with a marker on its rim; a fixed strike-zone arc sits at the
// top. Each revolution the marker sweeps the zone and the player taps. The
// wheel's RPM *is* the score and it directly sets how fast the next beat
// arrives — a closed positive-feedback loop.
//
// Coordinate model: all angular quantities are in TURNS (1 turn = 360°). Top
// of the wheel (12 o'clock) is the zone center. `phase` is cumulative turns
// travelled, monotonic within a run (the rendered marker never teleports).
//
// No Math.random / Date.now / performance.now in here: flutter scheduling is
// the only stochastic element and it consumes an injected `rng` (() => number
// in [0,1)), exactly like snake's food placement.

export type Rng = () => number

export type Grade = 'perfect' | 'good' | 'early' | 'late'
export type BeatStatus = 'pending' | 'hit' | 'whiffed'

export interface FlywheelEvents {
  grade: Grade | null // set by tap() on a valid in-window tap
  whiff: boolean // set by tap() when tapped before the window opened
  missed: boolean // set by step() when a beat exited untapped (a life was lost)
  flutterStarted: boolean // set by step() when the beat that just began is a flutter (twin marker)
  newPeak: boolean // set by tap() when rpm rose to a new run-peak
  over: boolean // set by step() when lives hit 0 this call
}

export interface FlywheelState {
  rpm: number // current speed = live score
  peakRpm: number // max rpm this run (the score that persists)
  phase: number // cumulative turns (monotonic)
  beatStartPhase: number // phase at which the current beat's window reference opened
  beatSpacing: number // turns from beatStartPhase to this beat's center
  isFlutter: boolean // current beat is a flutter beat (twin marker)
  arcWidth: number // full strike-zone arc width in turns (shrinks with progress)
  status: BeatStatus // resolution state of the current beat
  hits: number // total valid taps this run (drives arc narrowing)
  perfects: number // count of perfect taps this run (stats/telemetry)
  lives: number // starts at LIVES; run ends at 0
  beatsSinceFlutter: number
  over: boolean
  events: FlywheelEvents
}

// ---- Constants (tuned per spec) ----
export const START_RPM = 40
export const MIN_RPM = 30
export const PERFECT_RPM_DELTA = 2
export const GOOD_RPM_DELTA = 0
export const MISTIME_RPM_DELTA = -3
export const LIVES = 3
export const ARC_START = 0.24
export const ARC_FLOOR = 0.09
export const ARC_NARROW = 0.9
export const HITS_PER_NARROW = 8
export const PERFECT_FRAC = 0.05
export const GOOD_FRAC = 0.15
export const NORMAL_SPACING = 1.0
export const FLUTTER_SPACING = 0.5
export const FLUTTER_MIN_GAP = 20
export const FLUTTER_CHANCE = 0.1
export const MAX_DT = 0.05

const NO_EVENTS: FlywheelEvents = {
  grade: null,
  whiff: false,
  missed: false,
  flutterStarted: false,
  newPeak: false,
  over: false,
}

export function newGame(): FlywheelState {
  return {
    rpm: START_RPM,
    peakRpm: START_RPM,
    phase: 0,
    beatStartPhase: 0,
    beatSpacing: NORMAL_SPACING,
    isFlutter: false,
    arcWidth: ARC_START,
    status: 'pending',
    hits: 0,
    perfects: 0,
    lives: LIVES,
    beatsSinceFlutter: 0,
    over: false,
    events: NO_EVENTS,
  }
}

/** Turns per second for a given rpm. */
export function omega(rpm: number): number {
  return rpm / 60
}

/** Absolute phase of the current beat's strike-zone center. */
export function center(s: FlywheelState): number {
  return s.beatStartPhase + s.beatSpacing
}

/** Half the current strike-zone arc width (turns). */
export function arcHalf(s: FlywheelState): number {
  return s.arcWidth / 2
}

/** Signed tap offset in turns: <0 early (marker not yet at center), >0 late. */
export function offsetTurns(s: FlywheelState): number {
  return s.phase - center(s)
}

/** Is the marker currently inside the strike zone? */
export function inWindow(s: FlywheelState): boolean {
  return Math.abs(offsetTurns(s)) <= arcHalf(s)
}

/** Turns of travel remaining until the marker reaches center (<0 after). */
export function markerToCenter(s: FlywheelState): number {
  return center(s) - s.phase
}

/** Pure grading of a signed offset against the current arc width. */
export function gradeOffset(offset: number, arcWidth: number): Grade {
  const a = Math.abs(offset)
  if (a <= PERFECT_FRAC * arcWidth) return 'perfect'
  if (a <= GOOD_FRAC * arcWidth) return 'good'
  return offset < 0 ? 'early' : 'late'
}

/** Wheel hue in degrees: rpm [40,220] → hue [210,20] (blue → orange), clamped. */
export function hueForRpm(rpm: number): number {
  const lo = 40
  const hi = 220
  const t = Math.max(0, Math.min(1, (rpm - lo) / (hi - lo)))
  return 210 + t * (20 - 210)
}

function withEvents(s: FlywheelState, events: FlywheelEvents): FlywheelState {
  return { ...s, events }
}

/**
 * Register a single tap. rng-free; applies rpm change immediately (instant
 * "perfect accelerates" feel). Cadence/lives are owned by step().
 */
export function tap(s: FlywheelState): FlywheelState {
  // Extra taps within a resolved beat, or taps after game over, are ignored —
  // natural anti-mash guard.
  if (s.over || s.status !== 'pending') return withEvents(s, NO_EVENTS)

  const off = offsetTurns(s)
  const half = arcHalf(s)

  // Early whiff: tapped before the window opened. Burns the beat → guaranteed
  // miss (step resolves it as a life loss). This is the mash punishment.
  if (off < -half) {
    return {
      ...s,
      status: 'whiffed',
      events: { ...NO_EVENTS, whiff: true },
    }
  }

  // Defensive: a late-of-window tap cannot occur (step resolves on exit first).
  if (off > half) return withEvents(s, NO_EVENTS)

  // Valid in-window tap.
  const g = gradeOffset(off, s.arcWidth)
  const rpmDelta =
    g === 'perfect' ? PERFECT_RPM_DELTA : g === 'good' ? GOOD_RPM_DELTA : MISTIME_RPM_DELTA
  const newRpm = Math.max(MIN_RPM, s.rpm + rpmDelta)
  const newPeak = Math.max(s.peakRpm, newRpm)
  const hits = s.hits + 1
  const perfects = s.perfects + (g === 'perfect' ? 1 : 0)
  const arcWidth =
    hits % HITS_PER_NARROW === 0 ? Math.max(ARC_FLOOR, s.arcWidth * ARC_NARROW) : s.arcWidth

  return {
    ...s,
    rpm: newRpm,
    peakRpm: newPeak,
    arcWidth,
    status: 'hit',
    hits,
    perfects,
    events: { ...NO_EVENTS, grade: g, newPeak: newRpm > s.peakRpm },
  }
}

/**
 * Advance the wheel one frame. `rng()` in [0,1) is consumed exactly once per
 * resolved beat (for flutter scheduling). Deterministic given identical dt /
 * tap timing / rng sequence.
 */
export function step(s: FlywheelState, dt: number, rng: Rng): FlywheelState {
  if (s.over) return s
  if (dt <= 0) return withEvents(s, NO_EVENTS)

  const clampedDt = Math.min(dt, MAX_DT)

  const phase = s.phase + omega(s.rpm) * clampedDt
  let beatStartPhase = s.beatStartPhase
  let beatSpacing = s.beatSpacing
  let isFlutter = s.isFlutter
  let status = s.status
  let lives = s.lives
  let beatsSinceFlutter = s.beatsSinceFlutter
  let over = false
  let missed = false
  let flutterStarted = false

  // Resolve loop: a `while` (not `if`) so a large dt at high rpm can never
  // silently skip a beat. MAX_DT keeps this to ≤1 iteration in practice.
  let curCenter = beatStartPhase + beatSpacing
  let curHalf = /* arcWidth is fixed within this call */ s.arcWidth / 2
  while (phase > curCenter + curHalf && !over) {
    // Untapped or whiffed → a true miss costs a life. A `hit` costs nothing.
    if (status === 'pending' || status === 'whiffed') {
      lives -= 1
      missed = true
    }

    // Continuity: the next beat begins exactly where this one's center was.
    beatStartPhase = curCenter

    // Flutter schedule (the only rng consumer).
    beatsSinceFlutter += 1
    const eligible = beatsSinceFlutter >= FLUTTER_MIN_GAP
    if (eligible && rng() < FLUTTER_CHANCE) {
      beatSpacing = FLUTTER_SPACING
      isFlutter = true
      beatsSinceFlutter = 0
      flutterStarted = true
    } else {
      beatSpacing = NORMAL_SPACING
      isFlutter = false
    }

    status = 'pending'

    if (lives <= 0) {
      over = true
      break
    }

    curCenter = beatStartPhase + beatSpacing
    curHalf = s.arcWidth / 2
  }

  return {
    ...s,
    phase,
    beatStartPhase,
    beatSpacing,
    isFlutter,
    status,
    lives,
    beatsSinceFlutter,
    over,
    events: { ...NO_EVENTS, missed, flutterStarted, over },
  }
}

/** Tiny deterministic PRNG. Seed the component per-run; never used in pure fns. */
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
