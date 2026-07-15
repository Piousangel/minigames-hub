// Ripple — pure, deterministic "aim in time, not space" arcade engine.
//
// You tap empty water; a stone drops and a concentric ring expands outward at a
// constant rate. A buoy pops the instant the ring's growing circumference
// crosses its distance from the drop point — collision is a swept radial test
// (prevR < dist <= newR) so a fast ring can never skip a buoy between frames.
// Up to 3 rings expand at once; two crests reaching one buoy on the same tick
// is an interference combo. A periodic swell drowns un-popped buoys; drown too
// many and the run ends.
//
// No Math.random in this file: the only randomness source is the injected
// `Rng` (produced by the pure `mulberry32` PRNG), used for buoy spawn positions
// and drift. Collision, scoring, and progression are fully deterministic.

export type Rng = () => number // () => [0,1); the ONLY randomness source

export interface Point {
  x: number
  y: number
}

export interface Ring {
  id: number
  ox: number // origin x (drop point)
  oy: number // origin y
  radius: number // current crest radius
  popCount: number // buoys this ring has crossed over its lifetime (perfect sweep)
}

export interface Buoy {
  id: number
  x: number
  y: number
  vx: number // drift velocity (px/frame)
  vy: number
  colorIndex: number // 0..BUOY_COLORS-1, deterministic from rng at spawn
  swellsLeft: number // drowns when this reaches 0 on a swell
}

export interface PopEvent {
  buoyId: number
  x: number
  y: number
  interferenceMult: number // 1 | 2 | 3
  chain: number // combo chain length AFTER this pop (>=1), drives pitch ramp
  points: number // points awarded for this buoy
}

export interface RippleEvents {
  droppedRing: boolean // a stone was dropped this tick
  pops: PopEvent[] // buoys popped this tick (sorted by buoyId asc)
  perfectSweeps: number // rings that died this tick with popCount >= PERFECT_SWEEP_N
  swell: boolean // a swell fired this tick
  drowns: number // buoys lost to the swell this tick
  over: boolean // run ended this tick
}

export interface RippleState {
  rings: Ring[]
  buoys: Buoy[]
  score: number
  popped: number // cumulative buoys popped (drives level)
  drowned: number // cumulative buoys drowned
  chain: number // current combo chain
  comboMeter: number // 0..1, decays each tick; hitting 0 resets chain
  swellTimer: number // frames until next swell
  level: number // derived progression tier
  nextRingId: number
  nextBuoyId: number
  over: boolean
  events: RippleEvents
}

export interface StepInput {
  dt: number
  drop: Point | null // drop point this tick, or null
}

// ---- Constants ----
export const FIELD_W = 400
export const FIELD_H = 400

export const MAX_RINGS = 3
export const RING_SPEED = 2.4 // radius px/frame
export const RING_MAX_R = 566 // > field diagonal (565.7): guarantees full coverage

export const BUOY_R = 12 // visual radius (collision uses center distance)
export const BUOY_COLORS = 5
export const BUOY_DRIFT_MAX = 0.25 // |vx|,|vy| ceiling at spawn
export const INITIAL_BUOYS = 3
export const BUOY_SWELLS = 2 // survives up to 2 swells before drowning

export const BASE_POP = 10
export const INTERFERENCE_MAX = 3
export const PERFECT_SWEEP_N = 4
export const PERFECT_SWEEP_BONUS = 50

export const COMBO_WINDOW = 90 // frames for comboMeter to decay 1 -> 0
export const COMBO_TIER_STEP = 4 // chain per +1 combo multiplier
export const COMBO_TIER_MAX = 3 // comboMult in 1..4

export const SWELL_PERIOD_BASE = 300 // frames (5s)
export const SWELL_PERIOD_MIN = 150
export const SWELL_PERIOD_STEP = 12 // shorter per level
export const LEVEL_STEP = 6 // pops per level
export const BUOYS_PER_SWELL_MAX = 4

export const MAX_DROWN = 5 // run ends at this many drowned (Lives = MAX_DROWN - drowned)

const SPAWN_MARGIN = 24 // extra inset from the field edge at spawn

// ---- Pure helpers ----

/** mulberry32 PRNG — identical to src/lib/games/overload/engine.ts. */
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

/** 1 + min(floor(chain / COMBO_TIER_STEP), COMBO_TIER_MAX) => 1..4 */
export function comboMult(chain: number): number {
  return 1 + Math.min(Math.floor(chain / COMBO_TIER_STEP), COMBO_TIER_MAX)
}

/** max(SWELL_PERIOD_MIN, SWELL_PERIOD_BASE - level * SWELL_PERIOD_STEP) */
export function swellPeriodFor(level: number): number {
  return Math.max(SWELL_PERIOD_MIN, SWELL_PERIOD_BASE - level * SWELL_PERIOD_STEP)
}

/** min(BUOYS_PER_SWELL_MAX, 1 + floor(level / 2)) */
export function buoysPerSwell(level: number): number {
  return Math.min(BUOYS_PER_SWELL_MAX, 1 + Math.floor(level / 2))
}

/** floor(popped / LEVEL_STEP) */
export function levelFor(popped: number): number {
  return Math.floor(popped / LEVEL_STEP)
}

/** Euclidean distance. */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Spawn one buoy. Draw order is load-bearing (exactly 5 rng draws):
 * x, y (within the inset field), vx, vy, colorIndex.
 */
export function spawnBuoy(id: number, rng: Rng): Buoy {
  const lo = BUOY_R + SPAWN_MARGIN
  const hiX = FIELD_W - BUOY_R - SPAWN_MARGIN
  const hiY = FIELD_H - BUOY_R - SPAWN_MARGIN
  const x = lo + rng() * (hiX - lo)
  const y = lo + rng() * (hiY - lo)
  const vx = (rng() * 2 - 1) * BUOY_DRIFT_MAX
  const vy = (rng() * 2 - 1) * BUOY_DRIFT_MAX
  const colorIndex = Math.floor(rng() * BUOY_COLORS)
  return { id, x, y, vx, vy, colorIndex, swellsLeft: BUOY_SWELLS }
}

/**
 * The sequence of buoys a ring dropped at `origin` will sweep, in the order it
 * reaches them (ascending distance). Buoys beyond RING_MAX_R are unreachable.
 * Pure, no rng — powers the press-hold ghost preview.
 */
export function previewSweep(origin: Point, buoys: Buoy[]): Array<{ id: number; dist: number }> {
  const out: Array<{ id: number; dist: number }> = []
  for (const b of buoys) {
    const d = dist(origin.x, origin.y, b.x, b.y)
    if (d <= RING_MAX_R) out.push({ id: b.id, dist: d })
  }
  out.sort((p, q) => p.dist - q.dist)
  return out
}

function emptyEvents(): RippleEvents {
  return { droppedRing: false, pops: [], perfectSweeps: 0, swell: false, drowns: 0, over: false }
}

export function newGame(rng: Rng): RippleState {
  const buoys: Buoy[] = []
  for (let i = 0; i < INITIAL_BUOYS; i++) buoys.push(spawnBuoy(i, rng))
  return {
    rings: [],
    buoys,
    score: 0,
    popped: 0,
    drowned: 0,
    chain: 0,
    comboMeter: 0,
    swellTimer: swellPeriodFor(0),
    level: 0,
    nextRingId: 0,
    nextBuoyId: INITIAL_BUOYS,
    over: false,
    events: emptyEvents(),
  }
}

export function step(state: RippleState, input: StepInput, rng: Rng): RippleState {
  if (state.over) return state

  const { dt, drop } = input
  const events = emptyEvents()

  let nextRingId = state.nextRingId
  let nextBuoyId = state.nextBuoyId
  let score = state.score
  let popped = state.popped
  let drowned = state.drowned
  let chain = state.chain
  let comboMeter = state.comboMeter
  let swellTimer = state.swellTimer

  // 1) Drop.
  const rings: Ring[] = state.rings.map((r) => ({ ...r }))
  if (drop) {
    if (rings.length < MAX_RINGS) {
      rings.push({ id: nextRingId, ox: drop.x, oy: drop.y, radius: 0, popCount: 0 })
      nextRingId += 1
      events.droppedRing = true
    }
  }

  // 2) Drift buoys (reflect on edges).
  let buoys: Buoy[] = state.buoys.map((b) => {
    let x = b.x + b.vx * dt
    let y = b.y + b.vy * dt
    let vx = b.vx
    let vy = b.vy
    if (x < BUOY_R) {
      x = BUOY_R
      vx = -vx
    } else if (x > FIELD_W - BUOY_R) {
      x = FIELD_W - BUOY_R
      vx = -vx
    }
    if (y < BUOY_R) {
      y = BUOY_R
      vy = -vy
    } else if (y > FIELD_H - BUOY_R) {
      y = FIELD_H - BUOY_R
      vy = -vy
    }
    return { ...b, x, y, vx, vy }
  })

  // 3) Swept collision — for each un-popped buoy, count crossing rings.
  const newRadius = rings.map((r) => r.radius + RING_SPEED * dt)
  const poppedThisTick: Array<{ buoy: Buoy; k: number }> = []
  for (const b of buoys) {
    let k = 0
    for (let i = 0; i < rings.length; i++) {
      const prevR = rings[i].radius
      const nR = newRadius[i]
      const d = dist(rings[i].ox, rings[i].oy, b.x, b.y)
      if (prevR < d && d <= nR) {
        k += 1
        rings[i].popCount += 1 // every crossing ring gets sweep credit
      }
    }
    if (k >= 1) poppedThisTick.push({ buoy: b, k })
  }

  // 4) Score pops (sorted by id ascending for determinism).
  poppedThisTick.sort((a, z) => a.buoy.id - z.buoy.id)
  const poppedIds = new Set<number>()
  for (const { buoy, k } of poppedThisTick) {
    const interferenceMult = Math.min(k, INTERFERENCE_MAX)
    chain += 1
    comboMeter = 1
    const mult = comboMult(chain)
    const points = BASE_POP * interferenceMult * mult
    score += points
    popped += 1
    poppedIds.add(buoy.id)
    events.pops.push({
      buoyId: buoy.id,
      x: buoy.x,
      y: buoy.y,
      interferenceMult,
      chain,
      points,
    })
  }

  // 5) Advance rings & harvest perfect sweeps.
  for (let i = 0; i < rings.length; i++) rings[i].radius = newRadius[i]
  const survivingRings: Ring[] = []
  for (const r of rings) {
    if (r.radius > RING_MAX_R) {
      if (r.popCount >= PERFECT_SWEEP_N) {
        score += PERFECT_SWEEP_BONUS
        events.perfectSweeps += 1
      }
    } else {
      survivingRings.push(r)
    }
  }

  // 6) Remove popped buoys.
  if (poppedIds.size > 0) buoys = buoys.filter((b) => !poppedIds.has(b.id))

  // 7) Combo decay.
  comboMeter -= dt / COMBO_WINDOW
  if (comboMeter <= 0) {
    comboMeter = 0
    chain = 0
  }

  // 8) Level.
  const level = levelFor(popped)

  // 9) Swell.
  swellTimer -= dt
  if (swellTimer <= 0) {
    events.swell = true
    const survivors: Buoy[] = []
    let drownCount = 0
    for (const b of buoys) {
      const swellsLeft = b.swellsLeft - 1
      if (swellsLeft <= 0) {
        drownCount += 1
      } else {
        survivors.push({ ...b, swellsLeft })
      }
    }
    buoys = survivors
    drowned += drownCount
    events.drowns = drownCount
    const spawnN = buoysPerSwell(level)
    for (let i = 0; i < spawnN; i++) buoys.push(spawnBuoy(nextBuoyId++, rng))
    swellTimer = swellPeriodFor(level)
  }

  // 10) Over.
  let over = false
  if (drowned >= MAX_DROWN) {
    over = true
    events.over = true
  }

  return {
    rings: survivingRings,
    buoys,
    score,
    popped,
    drowned,
    chain,
    comboMeter,
    swellTimer,
    level,
    nextRingId,
    nextBuoyId,
    over,
    events,
  }
}
