/**
 * Gridlock — pure engine.
 *
 * A single intersection cell shared by four straight lanes (N/S/E/W). Traffic
 * approaches continuously on integer distance-to-intersection coordinates; the
 * player grants right-of-way to one lane at a time (`activeLane`). Get the
 * timing wrong — switch too early while the intersection is still occupied,
 * or leave a lane waiting too long — and it's game over. There is no win
 * condition: this is an infinite-survival throughput game, score = vehicles
 * safely processed.
 *
 * Unlike Decant (rng consumed only at generation time), Gridlock spawns
 * traffic every tick forever, so the reducer itself must keep consuming rng.
 * A closure-based `Rng` can't live inside a plain-object `GridlockState`, so
 * the mulberry32 step is exposed as a pure state-transition function,
 * `nextRandom(rngState) -> { value, state }`, and `GridlockState.rngState`
 * carries the stream position. This keeps `stepTick` fully pure while still
 * being able to draw exactly the rng sequence `mulberry32(seed)` would have
 * produced call-for-call.
 *
 * All functions here are pure and total: no timers, no `Date`, no
 * `Math.random`. The component owns real time and turns elapsed ms into
 * discrete `{ type: 'tick' }` dispatches.
 */

export type Rng = () => number // returns a float in [0,1)

export type Lane = 'N' | 'S' | 'E' | 'W'
// Fixed iteration order — the determinism basis for rng consumption and the
// "process lanes N,S,E,W, stop at the fatal one" partial-apply rule.
export const LANES: readonly Lane[] = ['N', 'S', 'E', 'W']

export type GridlockEvent =
  | 'none'
  | 'switch' // setLane changed activeLane
  | 'spawn' // a new vehicle spawned this tick
  | 'cross' // a vehicle entered the intersection this tick (score +1)
  | 'crash' // collision game over
  | 'timeout' // wait-time exceeded game over
  | 'tick' // nothing notable, time just passed

export interface Vehicle {
  id: number
  lane: Lane
  distance: number // 1..config.laneLength (integer cells to the intersection)
  speed: number // ticks required per cell, config.minSpeed..config.maxSpeed
  cooldown: number // ticks remaining until next move; 0 == eligible to move
  waitTicks: number // consecutive ticks spent at distance===1 with lane!==activeLane
}

export interface Occupant {
  lane: Lane
  clearTick: number // occupied while tick < clearTick
}

export interface GridlockConfig {
  laneLength: number
  crossTicks: number
  minSpeed: number
  maxSpeed: number
  baseSpawnGap: number
  minSpawnGap: number
  spawnRampDivisor: number
  spawnGapJitter: number
  maxWaitTicks: number
}

export const DEFAULT_CONFIG: GridlockConfig = {
  laneLength: 5,
  crossTicks: 3,
  minSpeed: 2,
  maxSpeed: 5,
  baseSpawnGap: 16,
  minSpawnGap: 6,
  spawnRampDivisor: 5,
  spawnGapJitter: 5,
  maxWaitTicks: 45,
}

export interface GridlockState {
  config: GridlockConfig
  seed: number
  rngState: number // mulberry32 stream position (see file header)
  tick: number
  activeLane: Lane
  vehicles: Record<Lane, Vehicle | null>
  nextSpawnTick: Record<Lane, number>
  nextVehicleId: number
  occupant: Occupant | null
  score: number
  gameOver: boolean
  failCause: 'crash' | 'timeout' | null
  failLane: Lane | null
  lastEvent: GridlockEvent
}

export type GridlockAction =
  | { type: 'setLane'; lane: Lane }
  | { type: 'tick' }
  | { type: 'reset' }
  | { type: 'new'; seed: number }

/** Identical impl to the template's mulberry32 (Decant). */
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
 * Pure single-step version of mulberry32: `rngState` plays the role of the
 * closure's internal `a` *before* the step that produces `value`. Threading
 * `state` through repeated calls reproduces exactly the sequence
 * `mulberry32(seed)()` would yield when `rngState` starts at `seed >>> 0`.
 */
export function nextRandom(rngState: number): { value: number; state: number } {
  const a = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, state: a >>> 0 }
}

/** N:(0,1) S:(0,-1) E:(1,0) W:(-1,0) — fixed unit-vector mapping. */
export function laneOffset(lane: Lane): { dx: number; dy: number } {
  switch (lane) {
    case 'N':
      return { dx: 0, dy: 1 }
    case 'S':
      return { dx: 0, dy: -1 }
    case 'E':
      return { dx: 1, dy: 0 }
    case 'W':
      return { dx: -1, dy: 0 }
  }
}

export function vehicleCoord(v: Vehicle): { x: number; y: number } {
  const { dx, dy } = laneOffset(v.lane)
  return { x: dx * v.distance, y: dy * v.distance }
}

export function pickSpeed(cfg: GridlockConfig, r: number): number {
  return cfg.minSpeed + Math.floor(r * (cfg.maxSpeed - cfg.minSpeed + 1))
}

export function spawnGap(cfg: GridlockConfig, score: number, r: number): number {
  const base = Math.max(cfg.minSpawnGap, cfg.baseSpawnGap - Math.floor(score / cfg.spawnRampDivisor))
  return base + Math.floor(r * (cfg.spawnGapJitter + 1))
}

export function isUrgent(v: Vehicle, cfg: GridlockConfig): boolean {
  return v.distance === 1 && v.waitTicks >= Math.floor(cfg.maxWaitTicks * 0.7)
}

export function createGame(cfg: GridlockConfig, seed: number): GridlockState {
  let state = seed >>> 0
  const draw = () => {
    const r = nextRandom(state)
    state = r.state
    return r.value
  }

  const activeLane = LANES[Math.floor(draw() * 4)]

  const nextSpawnTick: Record<Lane, number> = { N: 0, S: 0, E: 0, W: 0 }
  for (const lane of LANES) {
    nextSpawnTick[lane] = Math.floor(draw() * cfg.baseSpawnGap)
  }

  return {
    config: cfg,
    seed,
    rngState: state,
    tick: 0,
    activeLane,
    vehicles: { N: null, S: null, E: null, W: null },
    nextSpawnTick,
    nextVehicleId: 0,
    occupant: null,
    score: 0,
    gameOver: false,
    failCause: null,
    failLane: null,
    lastEvent: 'none',
  }
}

/**
 * Advance the simulation by exactly one tick. The only place any vehicle's
 * position, wait, or the intersection's occupancy changes. Idempotent once
 * `gameOver` is true (the death frame is frozen for rendering).
 */
export function stepTick(state: GridlockState): GridlockState {
  if (state.gameOver) return state

  const t = state.tick + 1
  let occupant = state.occupant
  if (occupant && t >= occupant.clearTick) occupant = null

  const vehicles: Record<Lane, Vehicle | null> = { ...state.vehicles }
  const nextSpawnTick: Record<Lane, number> = { ...state.nextSpawnTick }
  let nextVehicleId = state.nextVehicleId
  let score = state.score
  let rngState = state.rngState
  let event: GridlockEvent = 'tick'

  const draw = (): number => {
    const r = nextRandom(rngState)
    rngState = r.state
    return r.value
  }

  for (const lane of LANES) {
    const v = vehicles[lane]

    if (v === null) {
      if (t >= nextSpawnTick[lane]) {
        const r = draw()
        const speed = pickSpeed(state.config, r)
        nextVehicleId += 1
        vehicles[lane] = {
          id: nextVehicleId,
          lane,
          distance: state.config.laneLength,
          speed,
          cooldown: speed,
          waitTicks: 0,
        }
        event = 'spawn'
      }
      continue
    }

    if (v.cooldown > 0) {
      vehicles[lane] = { ...v, cooldown: v.cooldown - 1 }
      continue
    }

    // cooldown === 0: this vehicle is eligible to move this tick.
    if (v.distance > 1) {
      vehicles[lane] = { ...v, distance: v.distance - 1, cooldown: v.speed, waitTicks: 0 }
      continue
    }

    // v.distance === 1: at the stop line.
    if (lane !== state.activeLane) {
      const newWait = v.waitTicks + 1
      if (newWait > state.config.maxWaitTicks) {
        return {
          ...state,
          tick: t,
          occupant,
          vehicles,
          nextSpawnTick,
          nextVehicleId,
          score,
          rngState,
          gameOver: true,
          failCause: 'timeout',
          failLane: lane,
          lastEvent: 'timeout',
        }
      }
      vehicles[lane] = { ...v, waitTicks: newWait }
      continue
    }

    // Green light — attempt entry.
    if (occupant !== null && occupant.lane !== lane) {
      return {
        ...state,
        tick: t,
        occupant,
        vehicles,
        nextSpawnTick,
        nextVehicleId,
        score,
        rngState,
        gameOver: true,
        failCause: 'crash',
        failLane: lane,
        lastEvent: 'crash',
      }
    }

    // Entry succeeds.
    const r = draw()
    occupant = { lane, clearTick: t + state.config.crossTicks }
    score += 1
    vehicles[lane] = null
    nextSpawnTick[lane] = t + spawnGap(state.config, score, r)
    event = 'cross'
  }

  return {
    ...state,
    tick: t,
    occupant,
    vehicles,
    nextSpawnTick,
    nextVehicleId,
    score,
    rngState,
    gameOver: false,
    failCause: null,
    failLane: null,
    lastEvent: event,
  }
}

export function reduce(state: GridlockState, action: GridlockAction): GridlockState {
  switch (action.type) {
    case 'setLane': {
      if (state.gameOver || action.lane === state.activeLane) {
        return { ...state, lastEvent: 'none' }
      }
      return { ...state, activeLane: action.lane, lastEvent: 'switch' }
    }
    case 'tick':
      return stepTick(state)
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    default:
      return state
  }
}
