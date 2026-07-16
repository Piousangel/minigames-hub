/**
 * Polytap — pure engine.
 *
 * Two integer grids running at coprime-ish periods (F every 3 beats, J every 4).
 * The difficulty axis is INTERFERENCE, not precision: the judgement window is
 * generous (±1/4 beat) and never shrinks. Where the two grids collide you must
 * strike both at once — drop that collision and the run ends instantly.
 *
 * Time is an atomic integer `tick` (12 per beat). Every judgement is integer
 * arithmetic, so there is no float drift anywhere in the engine. The engine
 * does not know how time flows: converting real milliseconds into ticks is the
 * component's job, and only floored integers cross the boundary.
 *
 * All functions are pure: this file reads no ambient clock and no global
 * entropy source (a test greps the source to keep it that way).
 * Randomness enters only through an injected `Rng`, consumed exactly once per
 * stage transition at stage >= 2 (the combo draw). `state.rngCalls` audits it.
 * A whole run is therefore reproducible from `(seed, [{tick, key}, ...])`.
 */

export const TICKS_PER_BEAT = 12
export const TOLERANCE = 3 // ±1/4 beat. Never shrinks — this is the design.
export const SPAWN_LEAD_TICKS = 24 // slots appear 2 beats early = approach runway
export const LIVES = 3
export const HIT_POINTS = 10
export const CONFLUENCE_BASE = 100 // confluence bonus = BASE * cyclesCleared (escalating)
export const SYNC_TICKS = 2 // both keys within this many ticks => LOCK
export const LOCK_BONUS = 50
export const STAGE_BONUS = 250 // awarded on stage entry, * stage
export const TARGET_STAGE_BEATS = 48 // target stage length -> derives cyclesPerStage
export const BPM_START = 96
export const BPM_STEP = 4
export const BPM_MAX = 132
export const WARMUP_PERIOD_BEATS = 4
export const COMBOS: readonly (readonly [number, number])[] = [
  [3, 4],
  [3, 5],
  [4, 5],
  [3, 7],
  [4, 7],
] // [F period, J period], always F < J

export type Rng = () => number // float in [0,1)
export type ClockKey = 'f' | 'j'

export interface Clock {
  id: 0 | 1 // 0 = F (the fast one), 1 = J (the slow one)
  key: ClockKey
  periodBeats: number
  periodTicks: number
  offsetTicks: number // always the stage start (= the previous confluence) tick
  tolerance: number
  spawnFromTick: number // only dues STRICTLY after this become slots
  spawnedThrough: number // spawn scan cursor (makes ensureSpawned idempotent)
}

export interface Slot {
  id: number // monotonic; doubles as React key
  clockId: 0 | 1
  key: ClockKey
  dueTick: number
  isConfluence: boolean // every active clock is due here (needs clocks.length >= 2)
  isBoundary: boolean // this tick closes a cycle
  hit: boolean
  hitTick: number | null
}

export type PolytapEvent =
  | { type: 'hit'; key: ClockKey; dueTick: number; isConfluence: boolean }
  | { type: 'stray'; key: ClockKey }
  | { type: 'miss'; key: ClockKey; dueTick: number }
  | { type: 'confluence'; locked: boolean; spread: number; bonus: number; cycle: number }
  | { type: 'cycle'; cycle: number }
  | { type: 'stageUp'; stage: number; periods: number[]; bpm: number }
  | { type: 'clockJoin'; key: ClockKey; periodBeats: number }
  | { type: 'over'; reason: 'lives' | 'confluence' }

export interface PolytapState {
  seed: number
  rngCalls: number
  tick: number
  clocks: Clock[]
  slots: Slot[] // live slots only, sorted by dueTick then clockId
  nextSlotId: number

  stage: number // 0 = warm-up (single clock)
  stageStartTick: number
  cycleTicks: number
  cyclesPerStage: number
  cyclesInStage: number
  cyclesCleared: number // headline record; warm-up cycles do NOT count
  bpm: number

  lives: number
  score: number // leaderboard value: non-negative integer, never decreases
  hits: number
  strays: number
  misses: number
  locks: number
  bestSpread: number | null

  over: boolean
  overReason: 'lives' | 'confluence' | null
  events: PolytapEvent[]
}

// -- Utilities --------------------------------------------------------------

/** Identical impl to the template's mulberry32. */
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

/** Euclid. Positive integers only. */
export function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

/** Divide before multiply to keep the intermediate small. */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return (a / gcd(a, b)) * b
}

// -- Stage parameters -------------------------------------------------------

/**
 * Monotonic non-decreasing, capped at BPM_MAX. The ramp is deliberately gentle:
 * tempo is flywheel's axis, not polytap's.
 */
export function bpmForStage(stage: number): number {
  return Math.min(BPM_MAX, BPM_START + BPM_STEP * stage)
}

/**
 * Longer cycles demand fewer repetitions, so every stage feels about the same
 * length. Always lands in 2..4.
 */
export function cyclesPerStageFor(cycleBeats: number): number {
  return Math.min(4, Math.max(2, Math.round(TARGET_STAGE_BEATS / cycleBeats)))
}

/**
 * stage 0 -> the warm-up single clock (no rng).
 * stage 1 -> always [3, 4] (no rng) — 3-against-4 IS this game's identity.
 * stage >= 2 -> one draw from COMBOS minus the previous combo (exactly 1 rng call).
 */
export function comboForStage(stage: number, prev: readonly number[] | null, rng: Rng): number[] {
  if (stage <= 0) return [WARMUP_PERIOD_BEATS]
  if (stage === 1) return [3, 4]
  const pool = COMBOS.filter(
    (c) => !(prev !== null && prev.length === 2 && c[0] === prev[0] && c[1] === prev[1]),
  )
  const pick = pool[Math.floor(rng() * pool.length)]
  return [pick[0], pick[1]]
}

// -- Clock judgement (pure integer, zero rng) --------------------------------

/** Nearest due tick to `tick`; ties resolve downward. Exact for |tick| < 2^31. */
export function nearestDueTick(clock: Clock, tick: number): number {
  const rel = tick - clock.offsetTicks
  const p = clock.periodTicks
  const q = Math.floor(rel / p)
  const r = rel - q * p // 0..p-1, always non-negative
  const idx = r * 2 <= p ? q : q + 1
  return clock.offsetTicks + idx * p
}

export function distanceToDue(clock: Clock, tick: number): number {
  return Math.abs(tick - nearestDueTick(clock, tick))
}

export function isDueAt(clock: Clock, tick: number): boolean {
  const p = clock.periodTicks
  return (((tick - clock.offsetTicks) % p) + p) % p === 0
}

export function isConfluenceTick(state: PolytapState, tick: number): boolean {
  return state.clocks.length >= 2 && state.clocks.every((c) => isDueAt(c, tick))
}

export function isBoundaryTick(state: PolytapState, tick: number): boolean {
  return tick > state.stageStartTick && (tick - state.stageStartTick) % state.cycleTicks === 0
}

// -- Construction / stage transitions ---------------------------------------

export function newGame(seed: number): PolytapState {
  const warm: Clock = {
    id: 1,
    key: 'j',
    periodBeats: WARMUP_PERIOD_BEATS,
    periodTicks: WARMUP_PERIOD_BEATS * TICKS_PER_BEAT,
    offsetTicks: 0,
    tolerance: TOLERANCE,
    // spawnFromTick 0 => the first J is due at tick 48. Those 48 ticks are the count-in.
    spawnFromTick: 0,
    spawnedThrough: -1,
  }
  return {
    seed,
    rngCalls: 0,
    tick: 0,
    clocks: [warm],
    slots: [],
    nextSlotId: 1,
    stage: 0,
    stageStartTick: 0,
    cycleTicks: warm.periodTicks,
    cyclesPerStage: cyclesPerStageFor(WARMUP_PERIOD_BEATS),
    cyclesInStage: 0,
    cyclesCleared: 0,
    bpm: bpmForStage(0),
    lives: LIVES,
    score: 0,
    hits: 0,
    strays: 0,
    misses: 0,
    locks: 0,
    bestSpread: null,
    over: false,
    overReason: null,
    events: [],
  }
}

function draft(s: PolytapState): PolytapState {
  return {
    ...s,
    clocks: s.clocks.map((c) => ({ ...c })),
    slots: s.slots.slice(),
    events: [],
  }
}

function sortSlots(s: PolytapState): void {
  s.slots.sort((a, b) => (a.dueTick !== b.dueTick ? a.dueTick - b.dueTick : a.clockId - b.clockId))
}

/**
 * Rebuild the grid at `atTick`. Every clock is re-phased onto `atTick`, which
 * is the confluence that was just cleared — so it is never re-used as a due,
 * and the next confluence lands at `atTick + cycleTicks`.
 */
function startStage(s: PolytapState, stage: number, atTick: number, rng: Rng): void {
  const prev = s.clocks.map((c) => c.periodBeats)
  const combo = comboForStage(stage, prev, rng)
  if (stage >= 2) s.rngCalls += 1 // comboForStage consumed exactly one draw

  const mk = (id: 0 | 1, key: ClockKey, periodBeats: number): Clock => ({
    id,
    key,
    periodBeats,
    periodTicks: periodBeats * TICKS_PER_BEAT,
    offsetTicks: atTick,
    tolerance: TOLERANCE,
    spawnFromTick: atTick,
    spawnedThrough: atTick,
  })

  const clocks: Clock[] =
    combo.length === 2 ? [mk(0, 'f', combo[0]), mk(1, 'j', combo[1])] : [mk(1, 'j', combo[0])]

  let cycleTicks = clocks[0].periodTicks
  for (let i = 1; i < clocks.length; i++) cycleTicks = lcm(cycleTicks, clocks[i].periodTicks)

  s.clocks = clocks
  s.cycleTicks = cycleTicks
  s.cyclesPerStage = cyclesPerStageFor(cycleTicks / TICKS_PER_BEAT)
  s.stage = stage
  s.stageStartTick = atTick
  s.cyclesInStage = 0
  s.bpm = bpmForStage(stage)
  // Drop any unresolved slot from the old grid. The SPAWN_LEAD + TOLERANCE + 1
  // < MIN_PERIOD_TICKS invariant makes this provably a no-op (always []), but
  // the grid must never inherit a stale due.
  s.slots = s.slots.filter((sl) => sl.dueTick <= atTick)
  s.score += STAGE_BONUS * stage

  s.events.push({ type: 'stageUp', stage, periods: clocks.map((c) => c.periodBeats), bpm: s.bpm })
  if (stage === 1 && clocks.length === 2) {
    s.events.push({ type: 'clockJoin', key: clocks[0].key, periodBeats: clocks[0].periodBeats })
  }
}

// -- Spawning (idempotent) ---------------------------------------------------

function ensureSpawned(s: PolytapState, throughTick: number): void {
  let added = false
  for (const c of s.clocks) {
    const from = Math.max(c.spawnedThrough + 1, c.spawnFromTick + 1)
    for (let d = from; d <= throughTick; d++) {
      if (!isDueAt(c, d)) continue
      s.slots.push({
        id: s.nextSlotId++,
        clockId: c.id,
        key: c.key,
        dueTick: d,
        isConfluence: isConfluenceTick(s, d),
        isBoundary: isBoundaryTick(s, d),
        hit: false,
        hitTick: null,
      })
      added = true
    }
    if (throughTick > c.spawnedThrough) c.spawnedThrough = throughTick
  }
  if (added) sortSlots(s)
}

// -- Time advance — the heart --------------------------------------------------

/**
 * Process every tick in (state.tick, toTick]. No upper clamp: chunking the
 * frame differently must not change the outcome. Runaway background tabs are
 * the COMPONENT's problem (MAX_FRAME_MS) — the engine stays pure.
 */
export function advance(state: PolytapState, toTick: number, rng: Rng): PolytapState {
  if (state.over || toTick <= state.tick) return { ...state, events: [] }
  const s = draft(state)

  for (let t = state.tick + 1; t <= toTick; t++) {
    s.tick = t

    // 1) SPAWN
    ensureSpawned(s, t + SPAWN_LEAD_TICKS)

    // 2) RESOLVE — slots whose window closed exactly now.
    const closing = s.slots.filter((sl) => sl.dueTick + TOLERANCE + 1 === t)
    if (closing.length > 0) {
      // Uniform tolerance => `closing` is exactly one dueTick group.
      const dueTick = closing[0].dueTick
      const boundary = closing.some((sl) => sl.isBoundary)

      for (const sl of closing) {
        if (!sl.hit) {
          s.misses += 1
          // Warm-up (stage 0) is a no-fail sandbox: a missed beat still counts
          // for feedback and stats but never costs a life. The gate to the
          // polyrhythm is landing J hits, not surviving — so a beginner can
          // never die before the game's actual mechanic (F joining) appears.
          if (s.stage >= 1) s.lives -= 1
          s.events.push({ type: 'miss', key: sl.key, dueTick: sl.dueTick })
        }
      }
      s.slots = s.slots.filter((sl) => sl.dueTick + TOLERANCE + 1 !== t)

      if (boundary) {
        const allHit = closing.every((sl) => sl.hit)
        const duo = s.clocks.length >= 2
        if (allHit && duo) {
          s.cyclesCleared += 1
          const f = closing.find((sl) => sl.key === 'f')
          const j = closing.find((sl) => sl.key === 'j')
          const spread = f && j ? Math.abs((f.hitTick as number) - (j.hitTick as number)) : 0
          const locked = spread <= SYNC_TICKS
          const bonus = CONFLUENCE_BASE * s.cyclesCleared + (locked ? LOCK_BONUS : 0)
          s.score += bonus
          if (locked) s.locks += 1
          s.bestSpread = s.bestSpread === null ? spread : Math.min(s.bestSpread, spread)
          s.cyclesInStage += 1
          s.events.push({ type: 'confluence', locked, spread, bonus, cycle: s.cyclesCleared })
          s.events.push({ type: 'cycle', cycle: s.cyclesCleared })
        } else if (allHit) {
          // Warm-up cycle: onboarding, not a record. No confluence bonus.
          s.cyclesInStage += 1
        } else if (duo) {
          // Dropping the collision ends the run outright, lives be damned.
          s.over = true
          s.overReason = 'confluence'
          s.events.push({ type: 'over', reason: 'confluence' })
        }
        // else: warm-up miss — lives already docked above, no sudden death.
      }

      if (s.lives <= 0 && !s.over) {
        s.over = true
        s.overReason = 'lives'
        s.events.push({ type: 'over', reason: 'lives' })
      }

      // 3) STAGE UP — re-phase onto the boundary's DUE tick, not the resolve
      // tick, so the grid stays musically continuous.
      if (!s.over && boundary && s.cyclesInStage >= s.cyclesPerStage) {
        startStage(s, s.stage + 1, dueTick, rng)
      }
    }

    if (s.over) break
  }

  return s
}

// -- Input ------------------------------------------------------------------

export function tap(state: PolytapState, key: ClockKey): PolytapState {
  if (state.over) return { ...state, events: [] }
  const t = state.tick
  const events: PolytapEvent[] = []

  const cands = state.slots.filter(
    (sl) => sl.key === key && !sl.hit && Math.abs(sl.dueTick - t) <= TOLERANCE,
  )

  if (cands.length === 0) {
    // A stray does NOT consume a future slot — that beat still comes back as a
    // miss later. The double punishment is the point: it lands exactly when the
    // two hands start eating each other. In warm-up (stage 0) it still counts
    // as a stray for feedback, but costs no life — the sandbox is no-fail.
    const lives = state.stage >= 1 ? state.lives - 1 : state.lives
    events.push({ type: 'stray', key })
    const over = lives <= 0
    if (over) events.push({ type: 'over', reason: 'lives' })
    return {
      ...state,
      strays: state.strays + 1,
      lives,
      over,
      overReason: over ? 'lives' : state.overReason,
      events,
    }
  }

  let best = cands[0]
  for (const c of cands) {
    const d = Math.abs(c.dueTick - t)
    const bd = Math.abs(best.dueTick - t)
    if (d < bd || (d === bd && c.dueTick < best.dueTick)) best = c
  }

  // No grades: anything inside the window scores the same. Precision is not
  // this game's axis.
  return {
    ...state,
    slots: state.slots.map((sl) => (sl.id === best.id ? { ...sl, hit: true, hitTick: t } : sl)),
    hits: state.hits + 1,
    score: state.score + HIT_POINTS,
    events: [{ type: 'hit', key, dueTick: best.dueTick, isConfluence: best.isConfluence }],
  }
}

// -- Render helpers (component-only) ----------------------------------------

export function msPerTick(bpm: number): number {
  return 60000 / (bpm * TICKS_PER_BEAT)
}

export function laneSlots(state: PolytapState, key: ClockKey): Slot[] {
  return state.slots.filter((sl) => sl.key === key)
}

export function nextConfluenceTick(state: PolytapState): number {
  const rel = state.tick - state.stageStartTick
  return state.stageStartTick + (Math.floor(rel / state.cycleTicks) + 1) * state.cycleTicks
}

export function cycleProgress(state: PolytapState): { done: number; total: number } {
  return { done: state.cyclesInStage, total: state.cyclesPerStage }
}
