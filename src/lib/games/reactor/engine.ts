/**
 * Reactor — a pure, deterministic idle/incremental engine.
 *
 * Design contract (why it looks like this):
 * - Idle games are time-driven, so `tick` takes ELAPSED TIME as an explicit
 *   input. The COMPONENT owns the real-time loop and reads the wall clock; the
 *   engine never calls Date.now / performance.now / Math.random. This keeps the
 *   whole thing golden-testable.
 * - Every mutator returns a NEW state object, except `buy`/`prestige` which
 *   return the SAME reference on a no-op (so tests can assert `===`).
 */

export interface Module {
  id: string
  name: string
  /** Cost of the FIRST level (level 0 → 1). */
  baseCost: number
  /** Charge/sec contributed per owned level, before the prestige multiplier. */
  baseRate: number
}

export interface State {
  /** Spendable charge right now. */
  charge: number
  /** Total charge ever earned — drives prestige gating + the leaderboard. */
  lifetime: number
  /** Owned count per module, index-aligned with MODULES. */
  levels: number[]
  /** Number of reboots performed. */
  prestige: number
  /** Charge added per manual tap (before the prestige multiplier). */
  tapPower: number
}

/** Ordered generator tiers. Costs grow ×COST_GROWTH per owned level. */
export const MODULES: readonly Module[] = [
  { id: 'capacitor', name: 'Capacitor', baseCost: 10, baseRate: 0.1 },
  { id: 'coil', name: 'Coil', baseCost: 100, baseRate: 1 },
  { id: 'cell', name: 'Cell', baseCost: 1_100, baseRate: 8 },
  { id: 'core', name: 'Core', baseCost: 12_000, baseRate: 47 },
  { id: 'array', name: 'Array', baseCost: 130_000, baseRate: 260 },
  { id: 'singularity', name: 'Singularity', baseCost: 1_400_000, baseRate: 1_400 },
]

/** Standard idle cost curve. */
export const COST_GROWTH = 1.15
/** Lifetime charge needed before a Reboot is allowed. */
export const PRESTIGE_THRESHOLD = 1_000_000
/** Each reboot multiplies all production by an extra +10%. */
export const PRESTIGE_STEP = 0.1
/** Leaderboard score ceiling (shared MAX_SCORE across the hub). */
export const MAX_SCORE = 100_000_000

export function initialState(): State {
  return {
    charge: 0,
    lifetime: 0,
    levels: MODULES.map(() => 0),
    prestige: 0,
    tapPower: 1,
  }
}

/** Cost to buy the NEXT level of `module` when it currently has `level` owned. */
export function costOf(module: Module, level: number): number {
  return Math.ceil(module.baseCost * COST_GROWTH ** level)
}

/** Cost to buy the next level of MODULES[index] in the given state. */
export function nextCost(state: State, index: number): number {
  return costOf(MODULES[index], state.levels[index])
}

/** Production multiplier from reboots: 1 + prestige*0.10. */
export function prestigeMultiplier(state: State): number {
  return 1 + state.prestige * PRESTIGE_STEP
}

/** Total charge/sec at the current levels, including the prestige multiplier. */
export function productionPerSec(state: State): number {
  let base = 0
  for (let i = 0; i < MODULES.length; i++) {
    base += state.levels[i] * MODULES[i].baseRate
  }
  return base * prestigeMultiplier(state)
}

/** Charge gained per manual tap, including the prestige multiplier. */
export function tapGain(state: State): number {
  return state.tapPower * prestigeMultiplier(state)
}

/** Advance the simulation by `elapsedMs`. Pure; applies exactly what it's given. */
export function tick(state: State, elapsedMs: number): State {
  if (elapsedMs <= 0) return state
  const gained = productionPerSec(state) * (elapsedMs / 1000)
  if (gained <= 0) return state
  return {
    ...state,
    charge: state.charge + gained,
    lifetime: state.lifetime + gained,
  }
}

/** Manual tap: add tapGain to charge & lifetime. */
export function tap(state: State): State {
  const gained = tapGain(state)
  return {
    ...state,
    charge: state.charge + gained,
    lifetime: state.lifetime + gained,
  }
}

/** Buy one level of MODULES[index] if affordable; otherwise a no-op (same ref). */
export function buy(state: State, index: number): State {
  if (index < 0 || index >= MODULES.length) return state
  const cost = nextCost(state, index)
  if (state.charge < cost) return state
  const levels = state.levels.slice()
  levels[index] += 1
  return { ...state, charge: state.charge - cost, levels }
}

/** Whether a Reboot is unlocked. */
export function canPrestige(state: State): boolean {
  return state.lifetime >= PRESTIGE_THRESHOLD
}

/**
 * Reboot: reset charge + levels, +1 prestige (→ stronger multiplier), +1
 * tapPower. Lifetime is KEPT so the leaderboard/threshold never regress.
 * No-op (same ref) if not yet unlocked.
 */
export function prestige(state: State): State {
  if (!canPrestige(state)) return state
  return {
    charge: 0,
    lifetime: state.lifetime,
    levels: MODULES.map(() => 0),
    prestige: state.prestige + 1,
    tapPower: state.tapPower + 1,
  }
}

/**
 * Charge that WOULD accrue over min(elapsedMs, capMs) at the current
 * production. Pure; used for the welcome-back popup. The component applies the
 * matching `tick` with the same clamped elapsed afterwards.
 */
export function offlineGain(state: State, elapsedMs: number, capMs: number): number {
  const clamped = Math.max(0, Math.min(elapsedMs, capMs))
  return productionPerSec(state) * (clamped / 1000)
}

/**
 * Leaderboard score: a positive integer, monotonic in real progress, capped at
 * MAX_SCORE. Both lifetime and prestige only ever grow, so this never regresses.
 */
export function score(state: State): number {
  const raw = Math.floor(state.lifetime) + state.prestige * PRESTIGE_THRESHOLD
  return Math.min(Math.max(0, raw), MAX_SCORE)
}

const UNITS: ReadonlyArray<{ v: number; s: string }> = [
  { v: 1e15, s: 'Q' },
  { v: 1e12, s: 'T' },
  { v: 1e9, s: 'B' },
  { v: 1e6, s: 'M' },
  { v: 1e3, s: 'K' },
]

/** Compact number formatting: 1200 → "1.2K", 3.4e6 → "3.4M", 5.6e9 → "5.6B". */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const sign = n < 0 ? '-' : ''
  const x = Math.abs(n)
  for (const { v, s } of UNITS) {
    if (x >= v) {
      const scaled = x / v
      const str = (scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1)).replace(/\.0$/, '')
      return sign + str + s
    }
  }
  return sign + String(Math.floor(x))
}
