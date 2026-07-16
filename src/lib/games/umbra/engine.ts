/**
 * Umbra — pure engine.
 *
 * A marble launches from x=0 and travels right at a constant integer speed. It
 * is lit only across the entrance (`revealX`); past that it enters the tunnel
 * and is NEVER drawn again — not at the exit marker, not after it. There is no
 * arrival signal, so reaction is structurally impossible: the only solution is
 * to read the speed in the light and extrapolate the arrival tick.
 *
 * Design decisions baked into the types:
 *  - D1 `TRACK` is fixed and the marker is always the right edge. Difficulty
 *    comes from shrinking `revealX` per level, not from a per-marble lottery,
 *    so the exit never moves and the golden tests stay strong.
 *  - D2 every `vx` divides `TRACK`, so `exitTick = spawnTick + TRACK / vx` is an
 *    exact integer. Judgement is integer subtraction — no float drift, ever.
 *
 * All functions are pure and total: no timers, no `Date`, no `performance.now`,
 * and NO `Math.random`. Randomness enters only through an injected `Rng`, and
 * only on the spawn-success path inside `step` (exactly 3 draws, fixed order).
 */

export type Rng = () => number // returns a float in [0,1)
export type Grade = 'perfect' | 'good' | 'blown' | 'missed'
export type Phase = 'ready' | 'running' | 'over'

/** One in-flight marble. Removed from the array the moment it resolves. */
export interface Marble {
  id: number // monotonically increasing within a run, unique
  lane: number // 0..LANES-1
  vx: number // units per tick. Invariant: TRACK % vx === 0
  spawnTick: number // the tick at which x === 0
  exitTick: number // spawnTick + TRACK / vx (an exact integer)
  revealX: number // this marble's lit entrance length, frozen at spawn
}

export interface UmbraJudgement {
  id: number
  lane: number
  vx: number
  grade: Grade
  deltaTicks: number // tapTick - exitTick. 0 for 'missed'
  points: number // 0 for 'blown' / 'missed'
  simul: number // marbles in flight at judgement (incl. self, >= 1)
  perfectStreak: number // the streak AFTER this judgement
}

export interface UmbraEvents {
  spawned: number[] // ids spawned by this call
  judged: UmbraJudgement[] // tap: 0..1, step: 0..LANES (misses)
  levelUp: boolean
  over: boolean
}

export interface UmbraState {
  phase: Phase
  tick: number
  marbles: Marble[] // in-flight only, ascending by id
  nextId: number
  nextSpawnTick: number // spawn is attempted at ticks >= this
  score: number // monotonically non-decreasing integer
  lives: number
  hits: number // perfect + good (drives level)
  perfects: number
  goods: number
  perfectStreak: number
  bestStreak: number
  level: number // 1..MAX_LEVEL, a cache of levelForHits(hits)
  lastJudgement: UmbraJudgement | null
  events: UmbraEvents
}

// -- Constants --------------------------------------------------------------

export const TICK_HZ = 60
export const TRACK = 720 // units
export const LANES = 3
export const LIVES = 3

export const PERFECT_TICKS = 2 // |d| <= 2  (~33ms)
export const GOOD_TICKS = 6 // |d| <= 6  (~100ms)

export const PERFECT_BASE = 100
export const GOOD_BASE = 40
export const SPEED_POINT = 5 // score += vx * SPEED_POINT
export const COMBO_UNIT = 25
export const COMBO_CAP = 10

export const MAX_LEVEL = 10
export const HITS_PER_LEVEL = 5
export const REVEAL_START = 360 // level 1: half the track is lit
export const REVEAL_STEP = 36
export const REVEAL_FLOOR = 40 // guarantees 2 frames at the fastest vx (20)

export const FIRST_SPAWN_DELAY = 45 // 0.75s
export const SPAWN_MIN = 30
export const SPAWN_MAX = 75

export const SPEED_POOLS = {
  low: [8, 9, 10, 12], // travel 90..60 ticks
  mid: [6, 8, 9, 10, 12, 15], // travel 120..48 ticks
  high: [5, 6, 8, 9, 10, 12, 15, 16, 18, 20], // travel 144..36 ticks
} as const

const NO_EVENTS: UmbraEvents = Object.freeze({
  spawned: [],
  judged: [],
  levelUp: false,
  over: false,
})

/** A fresh empty events object — never share the frozen singleton's arrays. */
function emptyEvents(): UmbraEvents {
  return { spawned: [], judged: [], levelUp: false, over: false }
}

/** Clear the events/lastJudgement of a state without touching anything else. */
function quiet(s: UmbraState): UmbraState {
  return { ...s, lastJudgement: null, events: emptyEvents() }
}

/** Identical impl to decant/flywheel's mulberry32. */
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

// -- Lifecycle --------------------------------------------------------------

/** Pure, argument-free, consumes no rng. */
export function newGame(): UmbraState {
  return {
    phase: 'ready',
    tick: 0,
    marbles: [],
    nextId: 0,
    nextSpawnTick: FIRST_SPAWN_DELAY,
    score: 0,
    lives: LIVES,
    hits: 0,
    perfects: 0,
    goods: 0,
    perfectStreak: 0,
    bestStreak: 0,
    level: 1,
    lastJudgement: null,
    events: emptyEvents(),
  }
}

/** ready -> running. Any other phase returns `s` untouched. Consumes no rng. */
export function start(s: UmbraState): UmbraState {
  if (s.phase !== 'ready') return s
  return {
    ...quiet(s),
    phase: 'running',
    nextSpawnTick: FIRST_SPAWN_DELAY,
  }
}

// -- Level curves -----------------------------------------------------------

/** Non-decreasing in hits, always 1..MAX_LEVEL. */
export function levelForHits(hits: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(hits / HITS_PER_LEVEL))
}

/** Non-increasing in level, always REVEAL_FLOOR..REVEAL_START. */
export function revealForLevel(level: number): number {
  return Math.max(REVEAL_FLOOR, REVEAL_START - (level - 1) * REVEAL_STEP)
}

/** Non-decreasing in level, always 1..LANES. */
export function maxConcurrentForLevel(level: number): number {
  if (level <= 2) return 1
  if (level <= 5) return 2
  return LANES
}

/** Non-empty; every element divides TRACK. */
export function speedPoolForLevel(level: number): readonly number[] {
  if (level <= 2) return SPEED_POOLS.low
  if (level <= 5) return SPEED_POOLS.mid
  return SPEED_POOLS.high
}

// -- Marble geometry --------------------------------------------------------

/** Exact integer position. positionAt(m, m.exitTick) === TRACK, always. */
export function positionAt(m: Marble, tick: number): number {
  return m.vx * (tick - m.spawnTick)
}

/**
 * The game's central promise: a marble is lit only inside the entrance.
 * Because revealX <= REVEAL_START < TRACK, this is structurally never true at
 * or after the exit marker.
 */
export function isVisible(m: Marble, tick: number): boolean {
  if (tick < m.spawnTick) return false
  return positionAt(m, tick) < m.revealX
}

/** How many ticks this marble is lit for. Always >= 2. */
export function visibleFrames(m: Marble): number {
  return Math.ceil(m.revealX / m.vx)
}

// -- Judgement --------------------------------------------------------------

/** Never returns 'missed' — that grade is produced by `step` alone. */
export function gradeFor(deltaTicks: number): Grade {
  const d = Math.abs(deltaTicks)
  if (d <= PERFECT_TICKS) return 'perfect'
  if (d <= GOOD_TICKS) return 'good'
  return 'blown'
}

/** Always a non-negative integer. No path subtracts points. */
export function pointsFor(grade: Grade, vx: number, streakAfter: number, simul: number): number {
  if (grade === 'blown' || grade === 'missed') return 0
  const base = grade === 'perfect' ? PERFECT_BASE : GOOD_BASE
  const speed = vx * SPEED_POINT
  const combo =
    grade === 'perfect' ? COMBO_UNIT * Math.min(Math.max(streakAfter - 1, 0), COMBO_CAP) : 0
  return (base + speed + combo) * simul
}

/** The lane of the only in-flight marble, else null. Routes the Space key. */
export function soleLane(s: UmbraState): number | null {
  return s.marbles.length === 1 ? s.marbles[0].lane : null
}

// -- step -------------------------------------------------------------------

/**
 * Advance exactly one tick. Order is fixed and is part of the golden:
 *   1) resolve misses  2) spawn  3) game over  4) commit tick
 * Misses resolve BEFORE spawning so a lane freed this tick is reusable now.
 *
 * `level` never changes here (hits only grow in `tap`), so events.levelUp is
 * always false from `step`.
 */
export function step(s: UmbraState, rng: Rng): UmbraState {
  if (s.phase !== 'running') return { ...s, lastJudgement: null, events: { ...NO_EVENTS, spawned: [], judged: [] } }

  const t = s.tick + 1
  const events = emptyEvents()

  let marbles = s.marbles
  let lives = s.lives
  let perfectStreak = s.perfectStreak
  let lastJudgement = s.lastJudgement

  // 1) Misses — anything past the good window with no tap. id-ascending.
  const missed = marbles.filter((m) => t > m.exitTick + GOOD_TICKS)
  if (missed.length > 0) {
    const missedIds = new Set(missed.map((m) => m.id))
    marbles = marbles.filter((m) => !missedIds.has(m.id))
    for (const m of missed) {
      lives -= 1
      perfectStreak = 0
      const j: UmbraJudgement = {
        id: m.id,
        lane: m.lane,
        vx: m.vx,
        grade: 'missed',
        deltaTicks: 0,
        points: 0,
        simul: 1,
        perfectStreak: 0,
      }
      events.judged.push(j)
      lastJudgement = j
    }
  }

  // 2) Spawn — blocked spawns consume zero rng and leave nextSpawnTick alone,
  //    so the marble fires the instant a lane frees up.
  let nextId = s.nextId
  let nextSpawnTick = s.nextSpawnTick
  if (t >= nextSpawnTick && marbles.length < maxConcurrentForLevel(s.level)) {
    const free: number[] = []
    for (let l = 0; l < LANES; l++) {
      if (!marbles.some((m) => m.lane === l)) free.push(l)
    }
    if (free.length > 0) {
      const lane = free[Math.floor(rng() * free.length)] // draw 1: lane
      const pool = speedPoolForLevel(s.level)
      const vx = pool[Math.floor(rng() * pool.length)] // draw 2: speed
      const gap = SPAWN_MIN + Math.floor(rng() * (SPAWN_MAX - SPAWN_MIN + 1)) // draw 3: gap
      const m: Marble = {
        id: nextId,
        lane,
        vx,
        spawnTick: t,
        exitTick: t + TRACK / vx,
        revealX: revealForLevel(s.level),
      }
      marbles = [...marbles, m]
      events.spawned.push(m.id)
      nextId += 1
      nextSpawnTick = t + gap
    }
  }

  // 3) Game over.
  let phase: Phase = s.phase
  if (lives === 0) {
    phase = 'over'
    events.over = true
  }

  // 4) Commit.
  return {
    ...s,
    phase,
    tick: t,
    marbles: marbles === s.marbles ? s.marbles.slice() : marbles,
    nextId,
    nextSpawnTick,
    lives,
    perfectStreak,
    lastJudgement,
    events,
  }
}

// -- tap --------------------------------------------------------------------

/**
 * Judge the marble in `lane` at the current tick. Never advances the tick and
 * never consumes rng.
 *
 * At most one marble per lane (spawn only picks free lanes), so target
 * selection is unambiguous — that is the real reason for the one-per-lane rule.
 *
 * Tapping an empty lane is completely harmless: no judgement, no penalty. Spam
 * still cannot pay, because tapping a lane that HAS a marble at the wrong
 * moment costs a life.
 */
export function tap(s: UmbraState, lane: number): UmbraState {
  if (s.phase !== 'running') return quiet(s)
  const m = s.marbles.find((x) => x.lane === lane)
  if (!m) return quiet(s)

  const deltaTicks = s.tick - m.exitTick
  const grade = gradeFor(deltaTicks)
  const simul = s.marbles.length

  let perfectStreak = s.perfectStreak
  let hits = s.hits
  let perfects = s.perfects
  let goods = s.goods
  let lives = s.lives

  if (grade === 'perfect') {
    perfectStreak += 1
    hits += 1
    perfects += 1
  } else if (grade === 'good') {
    perfectStreak = 0
    hits += 1
    goods += 1
  } else {
    perfectStreak = 0
    lives -= 1
  }

  const bestStreak = Math.max(s.bestStreak, perfectStreak)
  const points = pointsFor(grade, m.vx, perfectStreak, simul)

  const judgement: UmbraJudgement = {
    id: m.id,
    lane: m.lane,
    vx: m.vx,
    grade,
    deltaTicks,
    points,
    simul,
    perfectStreak,
  }

  const level = levelForHits(hits)
  const events = emptyEvents()
  events.judged.push(judgement)
  events.levelUp = level > s.level

  let phase: Phase = s.phase
  if (lives === 0) {
    phase = 'over'
    events.over = true
  }

  return {
    ...s,
    phase,
    marbles: s.marbles.filter((x) => x.id !== m.id),
    score: s.score + points,
    lives,
    hits,
    perfects,
    goods,
    perfectStreak,
    bestStreak,
    level,
    lastJudgement: judgement,
    events,
  }
}
