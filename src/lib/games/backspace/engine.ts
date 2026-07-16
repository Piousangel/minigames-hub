// Backspace — pure, deterministic 5-lane endless dodger with a metered
// world-REWIND. The signature verb: hold to scrub the whole world backward
// (obstacles retreat, distance unwinds), release to resume forward from that
// earlier instant and re-pick your lane. A crash is only fatal when the rewind
// meter is empty; otherwise a safety net auto-rewinds you and you fork.
//
// Coordinate system: y grows DOWNWARD (same convention as flappy/latch). The
// marker is fixed near the bottom; obstacle rows scroll down toward it. All
// motion is INTEGER pixels per fixed 1/60s tick — no fractional dt ever reaches
// this engine, which is what makes the ring-buffer rewind bit-exact.
//
// Determinism: all randomness derives from a single uint32 `rngState` carried
// INSIDE each TickState snapshot and advanced purely via a mulberry32-style
// integer step consumed in a fixed documented order (see `spawnRow`). A run is
// fully defined by (seed, input log) and is bit-exact under rewind. No
// Math.random / Date.now / performance.now in here — the only impure boundary
// is the component, which picks the seed at newSession time.
//
// The rewind split: `TickState` is the physical world, snapshotted every tick
// into a bounded ring buffer — restoring an older TickState IS the rewind.
// `Session` is the meta economy (meter, peak score, clutch multiplier) and does
// NOT rewind, so spent meter is never refunded. That is what turns rewind into
// a genuine resource cost rather than free undo.

export type Rng = () => number

/** A single spawned horizontal row of blocks. */
export interface Row {
  id: number // strictly increasing, unique per session
  y: number // integer top-edge y (px); moves +speed each forward tick
  blocked: number // 5-bit mask; bit L set => lane L is a solid block
}

/** Snapshotted every tick into the ring buffer. Fully defines a replayable instant. */
export interface TickState {
  tick: number // monotonic forward tick counter at this snapshot
  markerLane: number // 0..4
  rows: Row[] // ordered by id ascending
  worldDistance: number // integer px scrolled; drives speed & spawn density
  scoreDistance: number // integer; sum of speed*clutchMult over forward ticks
  speed: number // current px/tick (derived, cached for exactness)
  spawnAccum: number // px since last spawn
  nextRowId: number // id to assign the next spawned row
  rngState: number // uint32 mulberry32 cursor
}

export type SessionMode = 'idle' | 'playing' | 'rewinding' | 'over'

export interface BackspaceEvents {
  moved: boolean // marker changed lane this advance
  spawned: boolean // a row was spawned this advance
  rewound: boolean // a manual rewind tick was applied
  meterEmpty: boolean // a rewind was requested but meter/history blocked it
  clutch: boolean // a manual rewind qualified as a clutch save this advance
  autoSaved: boolean // safety-net forced rewind fired this advance (non-fatal crash)
  crashed: boolean // FATAL crash this advance (meter empty at impact)
  banked: boolean // clutchMult increased this advance
}

/** Meta tier — NOT part of the ring buffer, NOT restored on rewind. */
export interface Session {
  history: TickState[] // ring buffer, index 0 = oldest, bounded to MAX_HISTORY
  cursor: number // index of the LIVE state within history (== length-1 unless rewound)
  meter: number // centi-ticks, 0..METER_MAX
  peakScore: number // monotonic; max score reached this run
  clutchMult: number // 1..MAX_CLUTCH
  ticksSinceClutch: number
  seed: number // original seed (for replay/debug)
  mode: SessionMode
  over: boolean
  events: BackspaceEvents
}

export interface AdvanceInput {
  move: -1 | 0 | 1 // lane delta requested this tick (0 = none)
  rewind: boolean // player is holding BACKSPACE this tick
}

// ---- Field / lanes ----
export const FIELD_W = 400
export const FIELD_H = 560
export const LANES = 5
export const LANE_W = 80

// ---- Marker ----
export const MARKER_W = 56
export const MARKER_H = 44
export const MARKER_CY = 500
export const MARKER_TOP = 478 // collision band top
export const MARKER_BOT = 522 // collision band bottom

// ---- Obstacle ----
export const BLOCK_H = 64
export const BLOCK_W = LANE_W // 80

// ---- Speed / difficulty ----
export const BASE_SPEED = 3
export const SPEED_RAMP = 900
export const MAX_SPEED = 11

// ---- Spawn ----
export const SPAWN_GAP = 150
export const DENSITY_RAMP = 1200

// ---- Meter (centi-ticks; 1 tick = 100 units) ----
export const METER_MAX = 18000
export const METER_START = 7000
export const REWIND_COST = 100
export const REFILL_PER_TICK = 22

// ---- Ring buffer ----
export const MAX_HISTORY = 180 // == METER_MAX / REWIND_COST

// ---- Clutch ----
export const CLUTCH_WINDOW = 24
export const MAX_CLUTCH = 5
export const DECAY_TICKS = 240

// ---- Safety net ----
export const FORCED_REWIND = 20 // ticks auto-rewound on non-fatal crash

// ---- Scoring ----
export const DISTANCE_PER_POINT = 10

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function noEvents(): BackspaceEvents {
  return {
    moved: false,
    spawned: false,
    rewound: false,
    meterEmpty: false,
    clutch: false,
    autoSaved: false,
    crashed: false,
    banked: false,
  }
}

/** Identical impl to latch/flywheel. Documents the integer step; used in tests. */
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
 * Pure integer PRNG step. Returns the draw in [0,1) AND the advanced state.
 * This is the ONLY source of randomness; consumed in a fixed order in spawnRow.
 */
export function nextRandom(rngState: number): { value: number; rngState: number } {
  let a = rngState | 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, rngState: a >>> 0 }
}

/** min(MAX_SPEED, BASE_SPEED + floor(worldDistance / SPEED_RAMP)) */
export function speedFor(worldDistance: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + Math.floor(worldDistance / SPEED_RAMP))
}

/** min(LANES-1, 1 + floor(worldDistance / DENSITY_RAMP)) — 1..4 */
export function maxBlockedFor(worldDistance: number): number {
  return Math.min(LANES - 1, 1 + Math.floor(worldDistance / DENSITY_RAMP))
}

/**
 * Spawn one obstacle row. Fixed draw order: draw #1 picks k (count of blocked
 * lanes in 1..maxBlocked), draws #2..#(k+1) run a partial Fisher–Yates over
 * [0,1,2,3,4] to pick k distinct blocked lanes.
 *
 * GUARANTEE: 1 <= k <= LANES-1, so at least one lane is always open (the run is
 * always survivable). Returns a NEW TickState with the row appended (y=-BLOCK_H),
 * spawnAccum reduced by SPAWN_GAP, nextRowId++, and rngState advanced.
 */
export function spawnRow(state: TickState): TickState {
  const maxBlocked = maxBlockedFor(state.worldDistance)
  let rng = state.rngState

  // Draw #1: how many lanes are blocked (1..maxBlocked).
  const d1 = nextRandom(rng)
  rng = d1.rngState
  const k = 1 + Math.floor(d1.value * maxBlocked)

  // Draws #2..#(k+1): partial Fisher–Yates to pick k distinct lanes.
  const lanes = [0, 1, 2, 3, 4]
  let blocked = 0
  for (let i = 0; i < k; i++) {
    const d = nextRandom(rng)
    rng = d.rngState
    const j = i + Math.floor(d.value * (LANES - i))
    const tmp = lanes[i]
    lanes[i] = lanes[j]
    lanes[j] = tmp
    blocked |= 1 << lanes[i]
  }

  const row: Row = { id: state.nextRowId, y: -BLOCK_H, blocked }
  return {
    ...state,
    rows: [...state.rows, row],
    spawnAccum: state.spawnAccum - SPAWN_GAP,
    nextRowId: state.nextRowId + 1,
    rngState: rng,
  }
}

/** The current live TickState. */
export function live(session: Session): TickState {
  return session.history[session.cursor]
}

export function newSession(seed: number): Session {
  const initial: TickState = {
    tick: 0,
    markerLane: 2, // center
    rows: [],
    worldDistance: 0,
    scoreDistance: 0,
    speed: BASE_SPEED,
    spawnAccum: 0,
    nextRowId: 0,
    rngState: seed >>> 0,
  }
  return {
    history: [initial],
    cursor: 0,
    meter: METER_START,
    peakScore: 0,
    clutchMult: 1,
    ticksSinceClutch: 0,
    seed: seed >>> 0,
    mode: 'idle',
    over: false,
    events: noEvents(),
  }
}

/**
 * Smallest ceil((MARKER_TOP - (row.y + BLOCK_H)) / speed) over rows that block
 * markerLane and are still above the collision band; Infinity if none.
 */
export function nearestImpactTicks(state: TickState): number {
  const speed = speedFor(state.worldDistance)
  let best = Infinity
  for (const r of state.rows) {
    if (!((r.blocked >> state.markerLane) & 1)) continue
    const bottom = r.y + BLOCK_H
    if (bottom > MARKER_TOP) continue // already at/past the band
    const ticks = Math.ceil((MARKER_TOP - bottom) / speed)
    if (ticks < best) best = ticks
  }
  return best
}

/** Does any row block the marker lane and overlap the collision band? */
function collides(state: TickState): boolean {
  const lane = state.markerLane
  for (const r of state.rows) {
    if (r.y < MARKER_BOT && r.y + BLOCK_H > MARKER_TOP && (r.blocked >> lane) & 1) {
      return true
    }
  }
  return false
}

/**
 * THE core transition. Advances exactly ONE fixed tick. Pure: identical inputs
 * always yield a deep-equal Session. See the module header for the two-tier
 * rewind model.
 */
export function advance(session: Session, input: AdvanceInput): Session {
  // 1. Idempotent when over.
  if (session.over) return session

  // 2. Fresh events; snapshot meta fields into locals.
  const events = noEvents()
  const prevMode = session.mode
  let history = session.history
  let cursor = session.cursor
  let meter = session.meter
  let peakScore = session.peakScore
  let clutchMult = session.clutchMult
  let ticksSinceClutch = session.ticksSinceClutch
  let mode = session.mode
  let over = false

  let cur = history[cursor]

  // 3. Apply lane move (works in both tiers — this is how you edit your past).
  if (input.move !== 0) {
    const newLane = clamp(cur.markerLane + input.move, 0, LANES - 1)
    if (newLane !== cur.markerLane) {
      cur = { ...cur, markerLane: newLane }
      history = history.slice()
      history[cursor] = cur // copy-on-write; forks the branch point if rewound
      events.moved = true
    }
  }

  // 4A. Rewind requested.
  if (input.rewind) {
    if (meter >= REWIND_COST && cursor > 0) {
      // Clutch fires only on the tick the hold BEGINS (prevMode !== 'rewinding').
      if (prevMode !== 'rewinding' && nearestImpactTicks(cur) <= CLUTCH_WINDOW) {
        events.clutch = true
        if (clutchMult < MAX_CLUTCH) {
          clutchMult += 1
          events.banked = true
        }
        ticksSinceClutch = 0
      }
      cursor -= 1
      meter -= REWIND_COST
      mode = 'rewinding'
      events.rewound = true
    } else {
      // Meter empty OR at buffer start: no work ⇒ no drain, still visually scrubbing.
      events.meterEmpty = true
      mode = 'rewinding'
    }
    return {
      ...session,
      history,
      cursor,
      meter,
      peakScore,
      clutchMult,
      ticksSinceClutch,
      mode,
      over: false,
      events,
    }
  }

  // 4B. Forward.
  // Committing a fork: discard the abandoned future.
  if (cursor < history.length - 1) {
    history = history.slice(0, cursor + 1)
  }
  mode = 'playing'

  const moveSpeed = speedFor(cur.worldDistance)
  const rows = cur.rows.map((r) => ({ ...r, y: r.y + moveSpeed })).filter((r) => r.y <= FIELD_H)
  const worldDistance = cur.worldDistance + moveSpeed

  let next: TickState = {
    tick: cur.tick + 1,
    markerLane: cur.markerLane,
    rows,
    worldDistance,
    scoreDistance: cur.scoreDistance + moveSpeed * clutchMult,
    speed: speedFor(worldDistance),
    spawnAccum: cur.spawnAccum + moveSpeed,
    nextRowId: cur.nextRowId,
    rngState: cur.rngState,
  }

  // Spawn (may loop, though SPAWN_GAP > MAX_SPEED means at most one per tick).
  while (next.spawnAccum >= SPAWN_GAP) {
    next = spawnRow(next)
    events.spawned = true
  }

  // Collision resolution.
  const hit = collides(next)
  if (hit && meter < REWIND_COST) {
    // FATAL — meter can't fund even one rewind step.
    history = pushRing(history, next)
    cursor = history.length - 1
    over = true
    mode = 'over'
    events.crashed = true
  } else if (hit) {
    // SAFETY NET — auto-rewind, drain meter, do NOT push the crashed state.
    const n = Math.min(FORCED_REWIND, cursor, Math.floor(meter / REWIND_COST))
    if (n === 0) {
      // Can't fund a single step ⇒ FATAL.
      history = pushRing(history, next)
      cursor = history.length - 1
      over = true
      mode = 'over'
      events.crashed = true
    } else {
      cursor -= n
      meter -= n * REWIND_COST
      events.autoSaved = true
      mode = 'rewinding'
    }
  } else {
    // Clean survival: commit and refill.
    history = pushRing(history, next)
    cursor = history.length - 1
    meter = Math.min(METER_MAX, meter + REFILL_PER_TICK)
  }

  // Clutch decay (forward tier).
  ticksSinceClutch += 1
  if (ticksSinceClutch >= DECAY_TICKS && clutchMult > 1) {
    clutchMult -= 1
    ticksSinceClutch = 0
  }

  // 5. Peak score — monotonic (max keeps it from dipping on a safety-net rewind).
  const liveState = history[cursor]
  peakScore = Math.max(peakScore, Math.floor(liveState.scoreDistance / DISTANCE_PER_POINT))

  meter = clamp(meter, 0, METER_MAX)

  return {
    ...session,
    history,
    cursor,
    meter,
    peakScore,
    clutchMult,
    ticksSinceClutch,
    mode,
    over,
    events,
  }
}

/** Push a state onto the ring buffer, dropping the oldest if over MAX_HISTORY. */
function pushRing(history: TickState[], next: TickState): TickState[] {
  const grown = [...history, next]
  if (grown.length > MAX_HISTORY) grown.shift()
  return grown
}

export function currentScore(session: Session): number {
  return session.peakScore
}

export function meterPct(session: Session): number {
  return session.meter / METER_MAX
}
