/**
 * Siteswap — pure engine (one-hand vanilla siteswap).
 *
 * Time is an integer beat. On a beat where a ball lands in the hand, the
 * player must toss it to a height h ∈ 1..5 before the beat ends; it then
 * lands on beat + h. Landing on a beat already taken by a ball, a bird or an
 * incoming new ball kills the run, and so does ending a beat still holding.
 *
 * The future is a rolling window `slots` (slots[k] = absolute beat beat+k),
 * so a collision check is a single lookup `slots[h]`.
 *
 * No forced deaths: with ≤ 4 balls, birds ≥ 5 beats apart, drops ≥ 16 beats
 * apart, and both generated at the window edge (LOOKAHEAD = 8 > MAX_HEIGHT),
 * at least one of the 5 reachable slots is always free when holding.
 *
 * All functions are pure and total: no timers, no `Date`, no `Math.random`.
 * Randomness enters only through mulberry32 seeded from the run seed; the
 * accumulator lives in the state (`rngState`) so a state is serializable.
 */

export type Rng = () => number // [0,1)

export const MAX_HEIGHT = 5
export const LOOKAHEAD = 8
export const WINDOW = LOOKAHEAD + 1 // slots.length === 9
export const START_BALLS = 2
export const MAX_BALLS = 4
export const FIRST_DROP_BEAT = 16
export const DROP_INTERVAL = 16
export const DROP_JITTER = 5 // +0..4 beats
export const GRACE_BEATS = 8 // no birds before beat 8
export const BIRD_GAP = 5 // bird beats differ by >= 5
export const BIRD_STAGE_LEN = 32
export const BIRD_CHANCE = [0.12, 0.18, 0.24, 0.3, 0.34] as const
export const STAGE_LEN = 16 // BPM rises every 16 beats
export const BASE_BPM = 66
export const BPM_STEP = 6
export const MAX_BPM = 150
export const PATTERN_LEN = 8

export type Slot = 'empty' | 'ball' | 'bird' | 'drop'
export type Status = 'ready' | 'running' | 'dead'
export type DeathCause = 'collision' | 'bird' | 'drop' | 'dropped'
export type SiteswapEvent =
  | 'none'
  | 'toss'
  | 'buffered'
  | 'empty-press'
  | 'catch'
  | 'join'
  | 'bird'
  | 'rest'
  | 'dead'

export interface SiteswapConfig {
  startBalls: number
  maxBalls: number
  birds: boolean
  drops: boolean
}

export const DEFAULT_CONFIG: SiteswapConfig = {
  startBalls: START_BALLS,
  maxBalls: MAX_BALLS,
  birds: true,
  drops: true,
}

/** A ball in the air. Absolute beats; height = to - from. */
export interface Flight {
  id: number
  from: number
  to: number
}

export interface TickInfo {
  beat: number
  arrived: Slot
  stageUp: boolean
}

export interface GenCtx {
  scheduledBalls: number // balls in play + pending drops in the window
  nextDropBeat: number
  lastBirdBeat: number
}

export interface SiteswapState {
  seed: number
  config: SiteswapConfig
  rngState: number // mulberry32 accumulator (serializable)
  status: Status
  beat: number // current absolute beat = beats survived
  slots: Slot[] // length WINDOW; slots[k] = beat+k. slots[0] = what arrived this beat
  held: boolean // a ball is in hand and not yet tossed
  heldId: number | null
  flights: Flight[] // balls in the air, sorted by `to` ascending
  balls: number // balls in play (held + in the air)
  gen: GenCtx
  nextBallId: number
  buffered: number | null // early input applied on the next beat
  score: number
  tosses: number
  peakBalls: number
  pattern: number[] // last PATTERN_LEN heights tossed
  lastToss: { h: number; from: number; to: number } | null
  deathCause: DeathCause | null
  deathHeight: number | null
  lastEvent: SiteswapEvent
  lastTick: TickInfo | null
}

export type SiteswapAction = { type: 'toss'; h: number; early?: boolean } | { type: 'tick' }

// ---------------------------------------------------------------------------
// rng (bit-identical to lagline/decant mulberry32; copied, not imported)
// ---------------------------------------------------------------------------

export function mulberry32Step(a: number): { value: number; a: number } {
  let x = a | 0
  x = (x + 0x6d2b79f5) | 0
  let t = Math.imul(x ^ (x >>> 15), 1 | x)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, a: x }
}

/** Closure over the step; read the accumulator back with `state()` after use. */
export function rngFromState(a: number): { rng: Rng; state: () => number } {
  let acc = a | 0
  return {
    rng: () => {
      const r = mulberry32Step(acc)
      acc = r.a
      return r.value
    },
    state: () => acc,
  }
}

export function mulberry32(seed: number): Rng {
  return rngFromState(seed >>> 0).rng
}

// ---------------------------------------------------------------------------
// tempo / difficulty curves (pure functions of the beat; no rng)
// ---------------------------------------------------------------------------

export function stageForBeat(b: number): number {
  return Math.floor(Math.max(0, b) / STAGE_LEN)
}

export function bpmForBeat(b: number): number {
  return Math.min(MAX_BPM, BASE_BPM + BPM_STEP * stageForBeat(b))
}

export function beatMs(b: number): number {
  return Math.round(60000 / bpmForBeat(b))
}

export function birdChance(B: number): number {
  if (B < GRACE_BEATS) return 0
  const idx = Math.min(BIRD_CHANCE.length - 1, Math.floor((B - GRACE_BEATS) / BIRD_STAGE_LEN))
  return BIRD_CHANCE[idx]
}

// ---------------------------------------------------------------------------
// generation
// ---------------------------------------------------------------------------

/**
 * Generate the slot for absolute beat B (always the window edge). Never
 * returns 'ball'. rng order is fixed: a drop consumes exactly 1 call (jitter);
 * otherwise, once birds are possible, exactly 1 call is consumed even when the
 * gap rule rejects the bird.
 */
export function genSlot(B: number, ctx: GenCtx, cfg: SiteswapConfig, rng: Rng): { slot: Slot; ctx: GenCtx } {
  if (cfg.drops && ctx.scheduledBalls < cfg.maxBalls && B >= ctx.nextDropBeat) {
    return {
      slot: 'drop',
      ctx: {
        ...ctx,
        scheduledBalls: ctx.scheduledBalls + 1,
        nextDropBeat: B + DROP_INTERVAL + Math.floor(rng() * DROP_JITTER),
      },
    }
  }
  if (cfg.birds && B >= GRACE_BEATS) {
    const r = rng()
    if (r < birdChance(B) && B - ctx.lastBirdBeat >= BIRD_GAP) {
      return { slot: 'bird', ctx: { ...ctx, lastBirdBeat: B } }
    }
  }
  return { slot: 'empty', ctx: { ...ctx } }
}

export function createGame(seed: number, cfg: SiteswapConfig = DEFAULT_CONFIG): SiteswapState {
  const config = { ...cfg }
  const startBalls = Math.max(1, Math.min(config.startBalls, MAX_HEIGHT))
  const { rng, state } = rngFromState(seed >>> 0)
  let gen: GenCtx = {
    scheduledBalls: startBalls,
    nextDropBeat: FIRST_DROP_BEAT + Math.floor(rng() * DROP_JITTER),
    lastBirdBeat: -BIRD_GAP,
  }
  const slots: Slot[] = []
  for (let k = 0; k < WINDOW; k++) {
    if (k < startBalls) {
      slots.push('ball')
    } else {
      const r = genSlot(k, gen, config, rng)
      gen = r.ctx
      slots.push(r.slot)
    }
  }
  const flights: Flight[] = []
  for (let k = 1; k < startBalls; k++) flights.push({ id: k, from: k - startBalls, to: k })
  return {
    seed: seed >>> 0,
    config,
    rngState: state(),
    status: 'ready',
    beat: 0,
    slots,
    held: true,
    heldId: 0,
    flights,
    balls: startBalls,
    gen,
    nextBallId: startBalls,
    buffered: null,
    score: 0,
    tosses: 0,
    peakBalls: startBalls,
    pattern: [],
    lastToss: null,
    deathCause: null,
    deathHeight: null,
    lastEvent: 'none',
    lastTick: null,
  }
}

// ---------------------------------------------------------------------------
// queries
// ---------------------------------------------------------------------------

/** Heights 1..5 whose landing slot is free. Tests / bots only — the UI must not show it. */
export function legalHeights(s: SiteswapState): number[] {
  const out: number[] = []
  for (let h = 1; h <= MAX_HEIGHT; h++) if (s.slots[h] === 'empty') out.push(h)
  return out
}

/** Held + airborne. Invariant: equals `balls`. */
export function inHandCount(s: SiteswapState): number {
  return (s.held ? 1 : 0) + s.flights.length
}

function isValidHeight(h: unknown): h is number {
  return typeof h === 'number' && Number.isInteger(h) && h >= 1 && h <= MAX_HEIGHT
}

// ---------------------------------------------------------------------------
// transitions
// ---------------------------------------------------------------------------

export function toss(s: SiteswapState, h: number, early = false): SiteswapState {
  if (s.status === 'dead' || !isValidHeight(h)) return { ...s, lastEvent: 'none' }
  if (!s.held) {
    if (s.status === 'running' && early) return { ...s, buffered: h, lastEvent: 'buffered' }
    return { ...s, lastEvent: 'empty-press' }
  }
  const status: Status = 'running'
  const target = s.slots[h]
  if (target !== 'empty') {
    return {
      ...s,
      status: 'dead',
      deathCause: target === 'ball' ? 'collision' : target === 'bird' ? 'bird' : 'drop',
      deathHeight: h,
      lastEvent: 'dead',
    }
  }
  const slots = s.slots.slice()
  slots[h] = 'ball'
  const flight: Flight = { id: s.heldId ?? s.nextBallId, from: s.beat, to: s.beat + h }
  const flights = [...s.flights, flight].sort((a, b) => a.to - b.to)
  const pattern = [...s.pattern, h].slice(-PATTERN_LEN)
  return {
    ...s,
    status,
    slots,
    flights,
    held: false,
    heldId: null,
    tosses: s.tosses + 1,
    pattern,
    lastToss: { h, from: s.beat, to: s.beat + h },
    lastEvent: 'toss',
  }
}

export function tick(s: SiteswapState): SiteswapState {
  if (s.status !== 'running') return s
  if (s.held) {
    return { ...s, status: 'dead', deathCause: 'dropped', deathHeight: null, lastEvent: 'dead' }
  }
  const score = s.score + s.balls
  const beat = s.beat + 1
  const { rng, state } = rngFromState(s.rngState)
  const g = genSlot(beat + LOOKAHEAD, s.gen, s.config, rng)
  const slots = [...s.slots.slice(1), g.slot]
  const arrived = slots[0]

  let next: SiteswapState = {
    ...s,
    score,
    beat,
    slots,
    gen: g.ctx,
    rngState: state(),
    buffered: null,
  }

  if (arrived === 'ball') {
    const idx = next.flights.findIndex((f) => f.to === beat)
    const caught = idx >= 0 ? next.flights[idx] : null
    next = {
      ...next,
      flights: idx >= 0 ? next.flights.filter((_, i) => i !== idx) : next.flights,
      held: true,
      heldId: caught ? caught.id : next.nextBallId,
      lastEvent: 'catch',
    }
  } else if (arrived === 'drop') {
    const balls = next.balls + 1
    next = {
      ...next,
      balls,
      peakBalls: Math.max(next.peakBalls, balls),
      held: true,
      heldId: next.nextBallId,
      nextBallId: next.nextBallId + 1,
      lastEvent: 'join',
    }
  } else if (arrived === 'bird') {
    next = { ...next, lastEvent: 'bird' }
  } else {
    next = { ...next, lastEvent: 'rest' }
  }

  next = {
    ...next,
    lastTick: { beat, arrived, stageUp: stageForBeat(beat) > stageForBeat(beat - 1) },
  }

  if (s.buffered !== null && next.held) next = toss(next, s.buffered)
  return next
}

export function reduce(s: SiteswapState, a: SiteswapAction): SiteswapState {
  switch (a.type) {
    case 'toss':
      return toss(s, a.h, a.early ?? false)
    case 'tick':
      return tick(s)
    default:
      return s
  }
}
