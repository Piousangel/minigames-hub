/**
 * Offbeat — pure engine.
 *
 * A steady pulse fires every `gapEffective(cycle)` ticks and gets faster as
 * `cycle` grows. The player must NOT tap on the beat — they tap the silent
 * midpoint BETWEEN two pulses. Tapping too close to either pulse is an
 * 'onbeat' failure; tapping too far from the midpoint (but away from the
 * pulses) is 'early'/'late'. This is the inverted-rhythm-game pitch.
 *
 * Pattern: follows flywheel's continuous-tick shape (`step()` / `tap()` two
 * pure entry points + an `events` snapshot), not decant's single `reduce`,
 * because Offbeat is "always-flowing pulse + 1 tick/frame + input any time" —
 * much closer to flywheel's timing-governor shape than to a turn-based
 * reducer.
 *
 * No Math.random / Date.now / performance.now in here. The ONLY randomness is
 * the syncopation push schedule, drawn once in `newGame()` from an injected
 * `Rng`. `step()`, `tap()`, and every geometry helper below are 100% pure and
 * rng-free, so a (seed, call script) pair is fully golden-testable.
 */

export type Rng = () => number // [0,1)

export type Outcome = 'perfect' | 'good' | 'early' | 'late' | 'onbeat' | 'miss'

export interface OffbeatEvents {
  outcome: Outcome | null // judged this call (tap()'s verdict, or step()'s timeout 'miss')
  cycleAdvanced: boolean // a new pulse just fired this call
  over: boolean // lives hit 0 this exact call
}

export interface OffbeatState {
  schedule: boolean[] // fixed at newGame(); schedule[c]===true pulls cycle c's gap in by PUSH_TICKS
  tick: number // integer tick counter, monotonic while !over
  cycle: number // index of the pulse..pulse+1 gap currently in play
  resolved: boolean // this cycle already judged by tap() (dup-tap guard + timeout skip)
  score: number // integer, monotonic non-decreasing
  lives: number
  combo: number
  bestCombo: number
  hits: number // perfect + good count
  perfects: number
  over: boolean
  events: OffbeatEvents
}

// -- Constants ----------------------------------------------------------

export const START_GAP = 48
export const MIN_GAP = 14
export const ABS_MIN_GAP = 10
export const SHRINK_STEP = 1
export const PUSH_TICKS = 4
export const SYNCOPATION_CHANCE = 0.12
export const SYNCOPATION_COOLDOWN = 4
export const FIRST_ELIGIBLE_CYCLE = 6
export const SCHEDULE_HORIZON = 400
export const WINDOW_FRACTION = 0.22
export const WINDOW_MIN = 1
export const WINDOW_MAX = 8
export const PERFECT_FRACTION = 0.4
export const ONBEAT_TOL = 1
export const LIVES = 3
export const BASE_HIT_SCORE = 10
export const PERFECT_BONUS = 10
export const COMBO_STEP = 2
export const COMBO_CAP = 20
export const SPEED_BONUS_DIVISOR = 4

const NO_EVENTS: OffbeatEvents = { outcome: null, cycleAdvanced: false, over: false }

/** Identical impl to the repo-wide mulberry32 (decant/flywheel). */
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
 * Pre-draws the entire round's syncopation pushes. Consumes `rng()` EXACTLY
 * `horizon` times, one call per index regardless of outcome — this fixed
 * consumption order is what makes (seed, horizon) fully deterministic.
 */
export function generatePushSchedule(rng: Rng, horizon: number): boolean[] {
  const pushed: boolean[] = new Array(horizon).fill(false)
  let lastPushIndex = -Infinity
  for (let i = 0; i < horizon; i++) {
    const roll = rng()
    const sinceLastPush = i - lastPushIndex
    if (sinceLastPush > SYNCOPATION_COOLDOWN && i >= FIRST_ELIGIBLE_CYCLE && roll < SYNCOPATION_CHANCE) {
      pushed[i] = true
      lastPushIndex = i
    }
  }
  return pushed
}

/** Nominal (un-pushed) gap for a cycle: shrinks by 1 tick/cycle, floors at MIN_GAP. */
export function gapNominal(cycle: number): number {
  return Math.max(MIN_GAP, START_GAP - cycle * SHRINK_STEP)
}

/** Gap actually used this cycle: nominal, minus a syncopation push, floored at ABS_MIN_GAP. */
export function gapEffective(cycle: number, schedule: boolean[]): number {
  const nominal = gapNominal(cycle)
  if (schedule[cycle] === true) return Math.max(ABS_MIN_GAP, nominal - PUSH_TICKS)
  return nominal
}

/** Absolute tick at which pulse `cycle` fires. pulseTick(0) === 0, strictly increasing. */
export function pulseTick(cycle: number, schedule: boolean[]): number {
  let t = 0
  for (let c = 0; c < cycle; c++) t += gapEffective(c, schedule)
  return t
}

/** Absolute tick of the silent midpoint between pulse `cycle` and pulse `cycle+1`. */
export function offbeatTick(cycle: number, schedule: boolean[]): number {
  return pulseTick(cycle, schedule) + Math.floor(gapEffective(cycle, schedule) / 2)
}

/** Half-width (ticks) of the perfect/good judging window for a given gap. */
export function halfWindow(gap: number): number {
  return Math.max(WINDOW_MIN, Math.min(WINDOW_MAX, Math.floor(gap * WINDOW_FRACTION)))
}

/** Pure judge: classifies an absolute tap tick against the current cycle. */
export function classifyTap(tick: number, cycle: number, schedule: boolean[]): Outcome {
  const pStart = pulseTick(cycle, schedule)
  const pEnd = pulseTick(cycle + 1, schedule)
  const mid = offbeatTick(cycle, schedule)
  const half = halfWindow(gapEffective(cycle, schedule))

  if (tick <= pStart + ONBEAT_TOL || tick >= pEnd - ONBEAT_TOL) return 'onbeat'

  const dist = Math.abs(tick - mid)
  if (dist <= Math.floor(half * PERFECT_FRACTION)) return 'perfect'
  if (dist <= half) return 'good'
  return tick < mid ? 'early' : 'late'
}

function hitScore(outcome: 'perfect' | 'good', gap: number, comboAfter: number): number {
  const base = BASE_HIT_SCORE + (outcome === 'perfect' ? PERFECT_BONUS : 0)
  const comboBonus = Math.min(COMBO_CAP, comboAfter * COMBO_STEP)
  const speedBonus = Math.max(0, Math.floor((START_GAP - gap) / SPEED_BONUS_DIVISOR))
  return base + comboBonus + speedBonus
}

export function newGame(seed: number, horizon: number = SCHEDULE_HORIZON): OffbeatState {
  const rng = mulberry32(seed)
  const schedule = generatePushSchedule(rng, horizon)
  return {
    schedule,
    tick: 0,
    cycle: 0,
    resolved: false,
    score: 0,
    lives: LIVES,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    perfects: 0,
    over: false,
    events: NO_EVENTS,
  }
}

/** Advance exactly one tick. The component's contract: call once per rAF frame. */
export function step(state: OffbeatState): OffbeatState {
  if (state.over) return { ...state, events: NO_EVENTS }

  const tick = state.tick + 1
  const boundary = pulseTick(state.cycle + 1, state.schedule)

  if (tick >= boundary) {
    let lives = state.lives
    let combo = state.combo
    let outcome: Outcome | null = null

    if (!state.resolved) {
      lives -= 1
      combo = 0
      outcome = 'miss'
    }

    const over = lives <= 0

    return {
      ...state,
      tick,
      cycle: state.cycle + 1,
      resolved: false,
      lives,
      combo,
      over,
      events: { outcome, cycleAdvanced: true, over },
    }
  }

  return { ...state, tick, events: NO_EVENTS }
}

/** Register a single tap at the current tick. rng-free; cadence stays step()'s job. */
export function tap(state: OffbeatState): OffbeatState {
  if (state.over || state.resolved) return { ...state, events: NO_EVENTS }

  const outcome = classifyTap(state.tick, state.cycle, state.schedule)

  if (outcome === 'perfect' || outcome === 'good') {
    const combo = state.combo + 1
    const hits = state.hits + 1
    const perfects = state.perfects + (outcome === 'perfect' ? 1 : 0)
    const bestCombo = Math.max(state.bestCombo, combo)
    const gap = gapEffective(state.cycle, state.schedule)
    const score = state.score + hitScore(outcome, gap, combo)

    return {
      ...state,
      resolved: true,
      combo,
      hits,
      perfects,
      bestCombo,
      score,
      events: { outcome, cycleAdvanced: false, over: false },
    }
  }

  const lives = state.lives - 1
  const over = lives <= 0

  return {
    ...state,
    resolved: true,
    combo: 0,
    lives,
    over,
    events: { outcome, cycleAdvanced: false, over },
  }
}
