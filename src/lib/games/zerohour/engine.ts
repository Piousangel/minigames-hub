/**
 * Zero Hour — pure engine.
 *
 * Novel rule: every tile's number is BOTH its point value AND its fuse. One
 * integer tick decrements every tile by 1. Tapping a tile harvests its current
 * value; a tile reaching 0 cracks (a strike). Three strikes end the run.
 * Harvesting strictly-descending values within a tick window builds a
 * multiplier.
 *
 * All functions here are pure and total: they never throw, contain no timers,
 * no `Date`, and NO `Math.random`. Randomness enters only through an injected
 * `Rng`. Ticks consume no RNG at all, so every scoring/strike/combo outcome is
 * golden-testable from a seeded RNG.
 */

export const GRID = 5 // 5 columns
export const CELLS = GRID * GRID // 25 cells, fixed
export const MAX_STRIKES = 3 // 3rd crack ends the run
export const COMBO_WINDOW = 3 // next descending harvest must land within 3 ticks
export const COMBO_MAX = 8 // multiplier hard cap
export const TICKS_PER_LEVEL = 30 // difficulty ramps every 30 ticks
export const URGENT_AT = 3 // value <= 3 renders as "danger"

export type Rng = () => number // returns a float in [0, 1)

export interface Tile {
  value: number // >= 1 while on board; 0 is never displayed (0 => crack same tick)
  id: number // unique, monotonic per spawn; React key + test anchor
}

export type Cell = Tile | null // null = empty cell

export interface ZeroHourState {
  cells: Cell[] // length CELLS (25); index = row*GRID + col
  score: number
  strikes: number // 0..MAX_STRIKES (clamped)
  over: boolean // true once strikes >= MAX_STRIKES
  tick: number // integer tick counter, starts 0, +1 per tick()
  combo: number // current descending-chain length; 0 = no active chain
  multiplier: number // multiplier the NEXT harvest of the active chain scored at (1 when idle)
  comboLastValue: number | null // value of the last harvested tile in the active chain
  comboDeadline: number // tick by which the next chain harvest must occur (valid only when combo>0)
  longestChain: number // max combo length reached this run (flex stat)
  nextId: number // id source; increment on every spawn
}

export type HarvestEvent =
  | { type: 'none' }
  | { type: 'harvest'; value: number; gained: number; combo: number; multiplier: number; brokeChain: boolean }
  | { type: 'chain'; value: number; gained: number; combo: number; multiplier: number; brokeChain: boolean }

export interface HarvestResult {
  state: ZeroHourState
  event: HarvestEvent
}

export interface TickEvent {
  cracked: number[] // indices that hit 0 this tick (ascending), cleared to null
  strikesAdded: number // cracked.length, before clamping
  chainEnded: boolean // true if an active chain was reset this tick (crack or window expiry)
  over: boolean // strikes reached MAX_STRIKES this tick
}

export interface TickResult {
  state: ZeroHourState
  event: TickEvent
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n
}

export function newGame(): ZeroHourState {
  return {
    cells: Array<Cell>(CELLS).fill(null),
    score: 0,
    strikes: 0,
    over: false,
    tick: 0,
    combo: 0,
    multiplier: 1,
    comboLastValue: null,
    comboDeadline: 0,
    longestChain: 0,
    nextId: 1,
  }
}

/** Ascending indices where cells[i] === null. */
export function emptyCells(state: ZeroHourState): number[] {
  const out: number[] = []
  for (let i = 0; i < state.cells.length; i++) {
    if (state.cells[i] === null) out.push(i)
  }
  return out
}

/**
 * Pure difficulty curve. High tiles early (long fuse, low urgency); low,
 * short-fuse tiles late (panic). Value and time are the same number.
 */
export function valueBounds(tick: number): { min: number; max: number } {
  const level = Math.floor(tick / TICKS_PER_LEVEL)
  const max = clamp(9 - level, 4, 9)
  const min = clamp(5 - level, 2, 5)
  return { min, max }
}

/**
 * Places one fresh tile. RNG draw order is fixed and load-bearing for golden
 * tests: position first, then value.
 */
export function spawnTileExcluding(state: ZeroHourState, rng: Rng, exclude: number): ZeroHourState {
  const all = emptyCells(state)
  let pool = all.filter((i) => i !== exclude)
  if (pool.length === 0) pool = all
  if (pool.length === 0) return state // full board -> no-op, zero rng

  const pos = pool[Math.floor(rng() * pool.length)] // draw #1: position
  const { min, max } = valueBounds(state.tick)
  const value = min + Math.floor(rng() * (max - min + 1)) // draw #2: value

  const cells = state.cells.slice()
  cells[pos] = { value, id: state.nextId }
  return { ...state, cells, nextId: state.nextId + 1 }
}

export function spawnTile(state: ZeroHourState, rng: Rng): ZeroHourState {
  return spawnTileExcluding(state, rng, -1)
}

export function harvest(state: ZeroHourState, index: number, rng: Rng): HarvestResult {
  // Guard: over / out-of-range / empty -> no-op, zero rng.
  if (state.over || index < 0 || index >= CELLS || state.cells[index] === null) {
    return { state, event: { type: 'none' } }
  }

  const v = state.cells[index]!.value
  const t = state.tick

  const continuing =
    state.combo > 0 && state.comboLastValue !== null && v < state.comboLastValue && t <= state.comboDeadline
  const brokeChain = state.combo > 0 && !continuing
  const combo = continuing ? state.combo + 1 : 1
  const multiplier = Math.min(combo, COMBO_MAX)
  const gained = v * multiplier

  const cells = state.cells.slice()
  cells[index] = null

  const cleared: ZeroHourState = {
    ...state,
    cells,
    score: state.score + gained,
    combo,
    multiplier,
    comboLastValue: v,
    comboDeadline: t + COMBO_WINDOW,
    longestChain: Math.max(state.longestChain, combo),
  }

  // Respawn elsewhere. `index` is now empty so a spawn always happens and
  // harvest always consumes exactly 2 rng() (position then value).
  const next = spawnTileExcluding(cleared, rng, index)

  const type: 'harvest' | 'chain' = combo >= 2 ? 'chain' : 'harvest'
  return { state: next, event: { type, value: v, gained, combo, multiplier, brokeChain } }
}

/** NO rng — cracks CLEAR cells, never respawn. */
export function tick(state: ZeroHourState): TickResult {
  if (state.over) {
    return { state, event: { cracked: [], strikesAdded: 0, chainEnded: false, over: true } }
  }

  const newTick = state.tick + 1
  const cells = state.cells.slice()
  const cracked: number[] = []

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    if (cell === null) continue
    const value = cell.value - 1
    if (value <= 0) {
      cracked.push(i)
      cells[i] = null
    } else {
      cells[i] = { value, id: cell.id }
    }
  }

  const strikesAdded = cracked.length
  const strikes = clamp(state.strikes + strikesAdded, 0, MAX_STRIKES)
  const over = state.strikes + strikesAdded >= MAX_STRIKES

  let combo = state.combo
  let multiplier = state.multiplier
  let comboLastValue = state.comboLastValue
  let chainEnded = false
  if (state.combo > 0 && (strikesAdded > 0 || newTick > state.comboDeadline)) {
    combo = 0
    multiplier = 1
    comboLastValue = null
    chainEnded = true
  }

  const next: ZeroHourState = {
    ...state,
    cells,
    tick: newTick,
    strikes,
    over,
    combo,
    multiplier,
    comboLastValue,
  }

  return { state: next, event: { cracked, strikesAdded, chainEnded, over } }
}
