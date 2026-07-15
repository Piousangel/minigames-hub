/**
 * Stackpot — pure engine.
 *
 * Parallel forced-placement blackjack. Four lanes each carry an escalating
 * exact target. Every turn a chip (1..9) is dealt into the tray and MUST be
 * placed into a lane, adding its value to that lane's running total. Hit the
 * target EXACTLY = LOCK (bank target × combo, target grows +5, combo climbs).
 * Overshoot = BUST (lose a life, lane resets, combo drops to ×1). No cashout —
 * the combo multiplier is the greed dial. Run ends at 0 lives.
 *
 * All functions here are pure and total: they never throw, contain no timers,
 * no `Date`, and NO `Math.random`. Randomness enters only through an injected
 * `Rng`. A given `Rng` sequence fully determines the run (golden-testable).
 */

export const LANES = 4 // fixed
export const INITIAL_TARGETS = [15, 20, 25, 30] as const
export const TARGET_STEP = 5 // lane target grows by +5 per lock
export const START_LIVES = 3
export const START_TOSSES = 1
export const TOSS_GRANT_EVERY = 5 // +1 toss every 5 total locks
export const CHIP_MIN = 1
export const CHIP_MAX = 9
export const START_COMBO = 1 // multiplier, ×1

// bust-risk thresholds by lane distance (target - total), for lane tinting
export const RISK_DANGER_DISTANCE = 2 // distance ≤ 2 → 'danger' (7..9 of 9 chips bust)
export const RISK_WARN_DISTANCE = 4 // distance ≤ 4 → 'warn' (5..6 of 9 chips bust)

export type Rng = () => number // yields [0, 1); injected — NEVER Math.random here

export type ChipValue = number // integer 1..9

export interface Lane {
  total: number // running sum, 0..target-1 between turns
  target: number // exact target to hit; grows +5 each lock
}

export type EventType = 'none' | 'place' | 'lock' | 'bust' | 'toss'

/** Describes what the LAST action did — the component reads this for juice/sound. */
export interface StackpotEvent {
  type: EventType
  lane: number // affected lane index, -1 for toss/none
  chip: number // the chip value consumed this action, 0 for none
  banked: number // points banked this action (lock only), else 0
  multiplier: number // combo multiplier applied at lock, else 0
  brokeCombo: boolean // true when this action reset combo to ×1 (bust)
  lifeLost: boolean // true on bust
}

export interface StackpotState {
  lanes: Lane[] // length 4
  tray: ChipValue // the chip you MUST place now
  next: ChipValue // preview of the chip after this one
  lives: number // 0..3
  combo: number // current multiplier (≥1); applied at next lock
  score: number // total banked this run
  locksTotal: number // cumulative locks this run (drives toss grants)
  longestCombo: number // max multiplier reached this run (flex stat)
  tossesLeft: number // discards available
  over: boolean // true once lives === 0
  event: StackpotEvent // result of the last action (for the view)
}

// ---------------------------------------------------------------------------
// Pure PRNG + chip draw
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

/** Uniform integer chip in [CHIP_MIN, CHIP_MAX]. Consumes exactly one rng() call. */
export function drawChip(rng: Rng): ChipValue {
  return CHIP_MIN + Math.floor(rng() * (CHIP_MAX - CHIP_MIN + 1))
}

/** Deterministic seed for a Daily Chip Sequence from a 'YYYY-MM-DD' string (djb2/xfnv hash). */
export function dailySeed(dateStr: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const NO_EVENT: StackpotEvent = {
  type: 'none',
  lane: -1,
  chip: 0,
  banked: 0,
  multiplier: 0,
  brokeCombo: false,
  lifeLost: false,
}

function cloneLanes(lanes: Lane[]): Lane[] {
  return lanes.map((l) => ({ total: l.total, target: l.target }))
}

// ---------------------------------------------------------------------------
// Lifecycle + reducer
// ---------------------------------------------------------------------------

/**
 * Fresh run: targets = INITIAL_TARGETS, totals 0, lives 3, combo ×1, tosses 1,
 * score/locks 0, longestCombo 1. Draws tray then next (2 rng calls). over=false.
 */
export function newGame(rng: Rng): StackpotState {
  const lanes: Lane[] = INITIAL_TARGETS.map((target) => ({ total: 0, target }))
  const tray = drawChip(rng)
  const next = drawChip(rng)
  return {
    lanes,
    tray,
    next,
    lives: START_LIVES,
    combo: START_COMBO,
    score: 0,
    locksTotal: 0,
    longestCombo: START_COMBO,
    tossesLeft: START_TOSSES,
    over: false,
    event: NO_EVENT,
  }
}

/**
 * Place the tray chip into lane `laneIndex` (0..3), then reveal the next chip.
 * No-op (returns the SAME reference, consumes NO rng) if state.over or
 * laneIndex ∉ [0,4).
 */
export function placeChip(state: StackpotState, laneIndex: number, rng: Rng): StackpotState {
  if (state.over) return state
  if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= LANES) return state

  const lanes = cloneLanes(state.lanes)
  const lane = lanes[laneIndex]
  const chip = state.tray
  const t = lane.total + chip

  let { lives, combo, score, locksTotal, longestCombo, tossesLeft } = state
  let over = false
  let event: StackpotEvent

  if (t === lane.target) {
    // LOCK
    const multiplier = combo
    const banked = lane.target * multiplier
    score += banked
    lane.total = 0
    lane.target += TARGET_STEP
    locksTotal += 1
    combo += 1
    if (combo > longestCombo) longestCombo = combo
    if (locksTotal % TOSS_GRANT_EVERY === 0) tossesLeft += 1
    event = {
      type: 'lock',
      lane: laneIndex,
      chip,
      banked,
      multiplier,
      brokeCombo: false,
      lifeLost: false,
    }
  } else if (t > lane.target) {
    // BUST
    const brokeCombo = combo > 1
    lives -= 1
    lane.total = 0
    combo = START_COMBO
    over = lives <= 0
    event = {
      type: 'bust',
      lane: laneIndex,
      chip,
      banked: 0,
      multiplier: 0,
      brokeCombo,
      lifeLost: true,
    }
  } else {
    // PLACE (sub-target)
    lane.total = t
    event = {
      type: 'place',
      lane: laneIndex,
      chip,
      banked: 0,
      multiplier: 0,
      brokeCombo: false,
      lifeLost: false,
    }
  }

  // Advance the tray (exactly ONE rng call), even when the run just ended, so
  // the final view is consistent.
  const tray = state.next
  const next = drawChip(rng)

  return {
    lanes,
    tray,
    next,
    lives,
    combo,
    score,
    locksTotal,
    longestCombo,
    tossesLeft,
    over,
    event,
  }
}

/**
 * Spend one toss to discard the tray chip. No-op (same ref, no rng) if
 * state.over or tossesLeft <= 0. Otherwise: tossesLeft -= 1; tray = state.next;
 * next = drawChip(rng) (one rng call); event.type='toss', chip=old tray.
 * combo/lives/lanes unchanged.
 */
export function toss(state: StackpotState, rng: Rng): StackpotState {
  if (state.over || state.tossesLeft <= 0) return state

  const oldTray = state.tray
  const tray = state.next
  const next = drawChip(rng)

  return {
    ...state,
    lanes: cloneLanes(state.lanes),
    tray,
    next,
    tossesLeft: state.tossesLeft - 1,
    event: {
      type: 'toss',
      lane: -1,
      chip: oldTray,
      banked: 0,
      multiplier: 0,
      brokeCombo: false,
      lifeLost: false,
    },
  }
}

// ---------------------------------------------------------------------------
// Pure read-model helpers (zero rng, zero mutation)
// ---------------------------------------------------------------------------

export function laneDistance(lane: Lane): number {
  return lane.target - lane.total
}

export function wouldLock(lane: Lane, chip: number): boolean {
  return lane.total + chip === lane.target
}

export function wouldBust(lane: Lane, chip: number): boolean {
  return lane.total + chip > lane.target
}

/** How many of the 9 possible chip values (1..9) would bust this lane: clamp(9 - distance, 0, 9). */
export function bustingChipCount(lane: Lane): number {
  const n = (CHIP_MAX - CHIP_MIN + 1) - laneDistance(lane)
  if (n < 0) return 0
  if (n > CHIP_MAX - CHIP_MIN + 1) return CHIP_MAX - CHIP_MIN + 1
  return n
}

/** Fraction in [0,1] of the 9 chip values that bust this lane. */
export function bustFraction(lane: Lane): number {
  return bustingChipCount(lane) / (CHIP_MAX - CHIP_MIN + 1)
}

/** Lane risk tint driven by distance. */
export function laneRisk(lane: Lane): 'safe' | 'warn' | 'danger' {
  const d = laneDistance(lane)
  if (d <= RISK_DANGER_DISTANCE) return 'danger'
  if (d <= RISK_WARN_DISTANCE) return 'warn'
  return 'safe'
}

export function canToss(state: StackpotState): boolean {
  return !state.over && state.tossesLeft > 0
}
