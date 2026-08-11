/**
 * Slotter — pure engine.
 *
 * A single integer card approaches a deadline, one at a time. The player must
 * click the exact gap in an ascending, sorted row where the card belongs
 * before the deadline elapses. A correct insertion scores points and spawns
 * the next card (with a slightly tighter deadline). A wrong insertion is not
 * rejected — it is actually spliced into the row at the clicked index, visibly
 * breaking the ascending invariant, and the run ends immediately. A timeout
 * (deadline reaches 0 before a decision) also ends the run immediately,
 * without inserting the card.
 *
 * Function-per-action style (createGame / tick / place, no combined reducer)
 * — this game's "always-decrementing deadline + single active entity" shape
 * mirrors zerohour's tick()/harvest()/spawnTile() split more than decant's
 * unified reduce(). All functions here are pure and total: no timers, no
 * `Date`, and NO `Math.random`. Randomness enters only through an injected
 * `Rng`, and only `pickCardValue` ever consumes it — `tick()` and the guard
 * branches of `place()` never touch rng, so any fixed-seed script of
 * tick/place calls is golden-testable.
 */

export type Rng = () => number // returns a float in [0,1)

export interface SlotterConfig {
  initialDeadlineTicks: number // first card's deadlineTicks
  minDeadlineTicks: number // floor deadlineTicks never drops below, however long the streak
  deadlineShrinkPerStreak: number // deadlineTicks decrease per streak point
  maxRowLength: number // row length cap; trimmed from the left (min) when exceeded
  valueMin: number
  valueMax: number
}

export interface Card {
  id: number
  value: number
  deadlineTicks: number // fixed at spawn time — this card's total grace period in ticks
  remainingTicks: number // decremented by 1 every tick()
}

export type SlotterEvent =
  | { type: 'none' }
  | { type: 'spawn'; value: number }
  | {
      type: 'insert'
      index: number
      value: number
      gained: number
      streak: number
      multiplier: number
    }
  | { type: 'wrong'; index: number; correctIndex: number; value: number }
  | { type: 'timeout'; value: number }

export interface SlotterState {
  config: SlotterConfig
  row: number[] // ascending, length 0..maxRowLength (broken only in the frame right after 'wrong')
  card: Card | null // active approaching card; null only once over===true or before init
  score: number
  streak: number // current consecutive-correct count; frozen (not reset) on wrong/timeout
  bestStreak: number // max(streak) this run — flex stat
  placed: number // total successful insertions this run
  over: boolean
  lastEvent: SlotterEvent
  nextId: number
}

// -- Constants ----------------------------------------------------------------

export const INITIAL_DEADLINE_TICKS = 45 // ~3.6s @ 80ms/tick recommended
export const MIN_DEADLINE_TICKS = 15 // ~1.2s floor
export const DEADLINE_SHRINK_PER_STREAK = 1
export const MAX_ROW_LENGTH = 10
export const VALUE_MIN = 1
export const VALUE_MAX = 99
export const MAX_VALUE_ATTEMPTS = 25

export const BASE_POINTS = 10
export const BONUS_PER_ROW_LEN = 2
export const SPEED_BONUS_MAX = 20
export const STREAK_MULT_STEP = 5
export const STREAK_MULT_CAP = 4

export const DEFAULT_CONFIG: SlotterConfig = {
  initialDeadlineTicks: INITIAL_DEADLINE_TICKS,
  minDeadlineTicks: MIN_DEADLINE_TICKS,
  deadlineShrinkPerStreak: DEADLINE_SHRINK_PER_STREAK,
  maxRowLength: MAX_ROW_LENGTH,
  valueMin: VALUE_MIN,
  valueMax: VALUE_MAX,
}

// -- RNG (identical impl to the template's mulberry32) ------------------------

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

// -- Pure primitives ------------------------------------------------------------

/**
 * The unique index at which `value` must be inserted into ascending, no-dup
 * `row` to keep it sorted = count of elements strictly less than `value`.
 * Invariant: 0 <= correctIndex(row, v) <= row.length.
 */
export function correctIndex(row: number[], value: number): number {
  let i = 0
  while (i < row.length && row[i] < value) i++
  return i
}

/**
 * The next card's deadlineTicks, shrinking (floor-clamped) with streak.
 * Monotonically non-increasing in streak; always >= cfg.minDeadlineTicks.
 */
export function deadlineForStreak(streak: number, cfg: SlotterConfig): number {
  return Math.max(cfg.minDeadlineTicks, cfg.initialDeadlineTicks - streak * cfg.deadlineShrinkPerStreak)
}

/**
 * A unique integer in [valueMin, valueMax] not already present in `row`.
 * Retries on collision (up to MAX_VALUE_ATTEMPTS), and falls back to a linear
 * scan for the first free value if that's exhausted (practically impossible
 * given range >> maxRowLength) — pure and total, never throws.
 * Consumes exactly one rng() draw per attempt.
 */
export function pickCardValue(row: number[], cfg: SlotterConfig, rng: Rng): number {
  const present = new Set(row)
  const span = cfg.valueMax - cfg.valueMin + 1
  for (let attempt = 0; attempt < MAX_VALUE_ATTEMPTS; attempt++) {
    const v = cfg.valueMin + Math.floor(rng() * span)
    if (!present.has(v)) return v
  }
  for (let v = cfg.valueMin; v <= cfg.valueMax; v++) {
    if (!present.has(v)) return v
  }
  // Every value in range is present (row longer than the range) — total fallback.
  return cfg.valueMin
}

/**
 * Spawn a new active card onto `state`. Only meaningful when card===null and
 * !over. deadlineTicks is fixed at the spawn-time streak.
 * Consumes rng via pickCardValue (usually one draw).
 */
export function spawnCard(state: SlotterState, rng: Rng): SlotterState {
  const value = pickCardValue(state.row, state.config, rng)
  const deadlineTicks = deadlineForStreak(state.streak, state.config)
  const card: Card = {
    id: state.nextId,
    value,
    deadlineTicks,
    remainingTicks: deadlineTicks,
  }
  return {
    ...state,
    card,
    nextId: state.nextId + 1,
    lastEvent: { type: 'spawn', value },
  }
}

/** Empty row + first card spawned. */
export function createGame(cfg: SlotterConfig, seed: number, rng?: Rng): SlotterState {
  const r = rng ?? mulberry32(seed)
  const base: SlotterState = {
    config: cfg,
    row: [],
    card: null,
    score: 0,
    streak: 0,
    bestStreak: 0,
    placed: 0,
    over: false,
    lastEvent: { type: 'none' },
    nextId: 1,
  }
  return spawnCard(base, r)
}

// -- Tick -----------------------------------------------------------------------

/**
 * Pure tick progression. Consumes no rng.
 * - over or card===null: zero-op (lastEvent 'none').
 * - remainingTicks - 1.
 *   - > 0: card updated only, lastEvent 'none'.
 *   - <= 0: over=true, lastEvent {type:'timeout', value}, card kept as-is
 *     (not nulled) so the UI can render the "collision" frame.
 */
export function tick(state: SlotterState): SlotterState {
  if (state.over || state.card === null) {
    return { ...state, lastEvent: { type: 'none' } }
  }
  const remainingTicks = state.card.remainingTicks - 1
  if (remainingTicks > 0) {
    return {
      ...state,
      card: { ...state.card, remainingTicks },
      lastEvent: { type: 'none' },
    }
  }
  return {
    ...state,
    card: { ...state.card, remainingTicks },
    over: true,
    lastEvent: { type: 'timeout', value: state.card.value },
  }
}

// -- Place ------------------------------------------------------------------------

/**
 * Player clicks gap `index` (0..row.length).
 * Guards (all zero-op, lastEvent 'none', rng unconsumed):
 *   - state.over
 *   - state.card === null
 *   - index < 0 || index > state.row.length
 *
 * index !== correctIndex: WRONG. The value is actually spliced into `index`
 * (breaking the ascending invariant on purpose), over=true, card=null.
 * index === correctIndex: CORRECT. Insert, trim from the left if over cap,
 * score, spawn the next card.
 */
export function place(state: SlotterState, index: number, rng: Rng): SlotterState {
  if (state.over) return { ...state, lastEvent: { type: 'none' } }
  if (state.card === null) return { ...state, lastEvent: { type: 'none' } }
  if (index < 0 || index > state.row.length) return { ...state, lastEvent: { type: 'none' } }

  const card = state.card
  const ci = correctIndex(state.row, card.value)

  if (index !== ci) {
    const newRow = [...state.row.slice(0, index), card.value, ...state.row.slice(index)]
    return {
      ...state,
      row: newRow,
      card: null,
      over: true,
      lastEvent: { type: 'wrong', index, correctIndex: ci, value: card.value },
    }
  }

  // Correct insertion.
  let newRow = [...state.row.slice(0, ci), card.value, ...state.row.slice(ci)]
  if (newRow.length > state.config.maxRowLength) {
    newRow = newRow.slice(newRow.length - state.config.maxRowLength)
  }

  const newStreak = state.streak + 1
  const bestStreak = Math.max(state.bestStreak, newStreak)

  const base = BASE_POINTS + state.row.length * BONUS_PER_ROW_LEN
  const speedFrac = card.remainingTicks / card.deadlineTicks
  const speedBonus = Math.round(SPEED_BONUS_MAX * speedFrac)
  const multiplier = Math.min(STREAK_MULT_CAP, 1 + Math.floor(newStreak / STREAK_MULT_STEP))
  const gained = (base + speedBonus) * multiplier

  const midState: SlotterState = {
    ...state,
    row: newRow,
    card: null,
    score: state.score + gained,
    streak: newStreak,
    bestStreak,
    placed: state.placed + 1,
  }

  const spawned = spawnCard(midState, rng)
  return {
    ...spawned,
    lastEvent: {
      type: 'insert',
      index,
      value: card.value,
      gained,
      streak: newStreak,
      multiplier,
    },
  }
}

/** UI render helper: active card's progress toward the deadline, [0,1]. */
export function cardProgress(state: SlotterState): number {
  if (state.card === null) return 0
  return (state.card.deadlineTicks - state.card.remainingTicks) / state.card.deadlineTicks
}
