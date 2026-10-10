/**
 * Polarity — pure engine.
 *
 * A steel ball rolls down an endless rail studded with fixed magnets. One bit of
 * input — the global polarity — flips every magnet between PULL and PUSH. Thread
 * the ball through the gates, keep it off the spikes, and don't fall behind the
 * camera, which scrolls down at an ever-rising minimum speed.
 *
 * Fixed-point integer physics (FP = 256 per px, 60 ticks/s). Every division goes
 * through `itrunc`, so a state is all integers and a run is golden-testable from
 * (seed, actions). No timers, no `Date`, no `Math.random`: the only randomness is
 * the mulberry32 accumulator `rngState`, consumed solely by `ensureChunks`, chunk
 * by chunk in index order — so the board is the same whatever the player does.
 */

export type Rng = () => number // [0,1)
export type Sign = 1 | -1
export type Status = 'ready' | 'running' | 'dead'
export type DeathCause = 'spike' | 'crushed'
export type PolEvent = 'none' | 'start' | 'queued' | 'flip' | 'bump' | 'wall' | 'gate' | 'miss' | 'dead'

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
} // all fp integers

export interface Magnet {
  id: number
  x: number
  y: number
  charge: Sign
  strength: 1 | 2
}

export interface Spike {
  id: number
  x: number
  y: number
}

export interface Gate {
  id: number
  chunk: number
  x: number // gap centre (fp)
  y: number // crossing line (fp)
  halfW: number // fp
  state: 'pending' | 'passed' | 'missed'
}

export interface TickInfo {
  tick: number
  flipped: boolean
  bumped: boolean
  walled: boolean
  passed: number[]
  missed: number[]
  gained: number
  mult: number
}

export interface PolarityState {
  seed: number
  rngState: number
  status: Status
  tick: number
  polarity: Sign
  pendingFlip: boolean
  flipCooldown: number
  flips: number
  ball: Ball
  camY: number
  magnets: Magnet[]
  spikes: Spike[]
  gates: Gate[]
  nextChunk: number
  genY: number
  nextId: number
  score: number
  combo: number
  bestCombo: number
  gatesPassed: number
  gatesMissed: number
  deathCause: DeathCause | null
  lastEvent: PolEvent
  lastTick: TickInfo | null
}

export type PolAction = { type: 'start' } | { type: 'flip' } | { type: 'tick' } | { type: 'new'; seed: number }

export interface TierSpec {
  magMin: number
  magMax: number
  spikeMin: number
  spikeMax: number
  gateW: number // px
  negP: number
  strongP: number
}

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------

export const FP = 256
export const BOARD_W = 320
export const VIEW_H = 480
export const BALL_R = 9
export const CORE_R = 11
export const SPIKE_R = 7
export const BALL_START_X = 160
export const BALL_START_Y = 120
export const FOLLOW_OFFSET = 170
export const TILT_ACC = 6
export const DAMP_DIV = 64
export const V_MAX = 1536
export const K_FORCE = 64000
export const EPS = 100
export const F_MAX = 64
export const A_MAX = 96
export const R_MAX = 150
export const WALL_REST_NUM = 3
export const WALL_REST_DEN = 4
export const FLIP_COOLDOWN = 9
export const SCROLL_BASE = 160
export const SCROLL_MAX = 320
export const SCROLL_RAMP_PX = 40
export const CHUNK0_Y = 360
export const CHUNK_H = 320
export const GATE_Y_OFF = 260
export const GATE_MARGIN = 56
export const MAG_MARGIN = 40
export const SPIKE_MARGIN = 20
export const MAG_Y_MIN = 30
export const MAG_Y_SPAN = 220
export const MAG_MIN_SEP = 64
export const SPIKE_MIN_SEP = 40
/**
 * Min spike↔magnet centre distance (px): a ball must fit between core and spike
 * with a margin. The design doc writes CORE_R+SPIKE_R+2*BALL_R+4 "(=45px)"; that sum
 * is actually 40, so the documented 45 is kept explicitly (more room for the ball).
 */
export const SPIKE_MAG_SEP = 45
export const GATE_CORRIDOR_DY = 48
export const MAG_GATE_PAD = 24
export const SPIKE_GATE_PAD = 28
export const MAX_PLACE_ATTEMPTS = 6
export const PRUNE_MARGIN = R_MAX + 40
export const GATE_POINTS = 10
export const MULT_MAX = 8
export const TICK_HZ = 60

// ---------------------------------------------------------------------------
// rng (bit-identical to lagline / decant)
// ---------------------------------------------------------------------------

export function mulberry32Step(a: number): { value: number; a: number } {
  let x = a | 0
  x = (x + 0x6d2b79f5) | 0
  let t = Math.imul(x ^ (x >>> 15), 1 | x)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, a: x }
}

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
// integer helpers
// ---------------------------------------------------------------------------

/** Truncating division helper that never yields -0. */
export function itrunc(x: number): number {
  return Math.trunc(x) + 0
}

/** Integer square root: r*r <= n < (r+1)^2 for integer n >= 0. */
export function isqrt(n: number): number {
  if (n <= 0) return 0
  let r = Math.floor(Math.sqrt(n))
  while (r * r > n) r--
  while ((r + 1) * (r + 1) <= n) r++
  return r
}

function clampV(v: number): number {
  return v > V_MAX ? V_MAX : v < -V_MAX ? -V_MAX : v
}

// ---------------------------------------------------------------------------
// schedule
// ---------------------------------------------------------------------------

const TIERS: readonly { upTo: number; spec: TierSpec }[] = [
  { upTo: 0, spec: { magMin: 1, magMax: 1, spikeMin: 0, spikeMax: 0, gateW: 96, negP: 0, strongP: 0 } },
  { upTo: 2, spec: { magMin: 2, magMax: 2, spikeMin: 0, spikeMax: 1, gateW: 88, negP: 0, strongP: 0 } },
  { upTo: 5, spec: { magMin: 2, magMax: 3, spikeMin: 1, spikeMax: 2, gateW: 80, negP: 0, strongP: 0 } },
  { upTo: 9, spec: { magMin: 2, magMax: 3, spikeMin: 1, spikeMax: 3, gateW: 72, negP: 0.25, strongP: 0 } },
  { upTo: 14, spec: { magMin: 3, magMax: 4, spikeMin: 2, spikeMax: 3, gateW: 64, negP: 0.35, strongP: 0.15 } },
  { upTo: Infinity, spec: { magMin: 3, magMax: 4, spikeMin: 2, spikeMax: 4, gateW: 56, negP: 0.45, strongP: 0.25 } },
]

export function tierForChunk(c: number): TierSpec {
  for (const t of TIERS) if (c <= t.upTo) return t.spec
  return TIERS[TIERS.length - 1].spec
}

export function chunkTop(c: number): number {
  return (CHUNK0_Y + c * CHUNK_H) * FP
}

export function scrollSpeed(camY: number): number {
  return Math.min(SCROLL_MAX, SCROLL_BASE + Math.floor(Math.max(0, camY) / (SCROLL_RAMP_PX * FP)))
}

export function comboMult(combo: number): number {
  return Math.min(MULT_MAX, Math.max(1, combo))
}

export function gatePoints(comboAfterPass: number): number {
  return GATE_POINTS * comboMult(comboAfterPass)
}

// ---------------------------------------------------------------------------
// generation
// ---------------------------------------------------------------------------

function dist2(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) * (ax - bx) + (ay - by) * (ay - by)
}

/**
 * Generate chunk `c`. Fixed rng consumption order (see design doc §3):
 * nMag(1) → gateX(1) → per magnet attempt 4 → nSpike(1) → per spike attempt 2.
 * Works in px internally; stored coordinates are px * FP.
 */
export function generateChunk(
  c: number,
  rng: Rng,
  startId: number,
): { magnets: Magnet[]; spikes: Spike[]; gate: Gate; nextId: number } {
  const t = tierForChunk(c)
  const y0 = CHUNK0_Y + c * CHUNK_H // px
  let id = startId

  const nMag = t.magMin + Math.floor(rng() * (t.magMax - t.magMin + 1))
  const gx = GATE_MARGIN + Math.floor(rng() * (BOARD_W - 2 * GATE_MARGIN))
  const gy = y0 + GATE_Y_OFF
  const halfW = t.gateW / 2
  const gate: Gate = { id: id++, chunk: c, x: gx * FP, y: gy * FP, halfW: halfW * FP, state: 'pending' }

  const mags: { x: number; y: number; charge: Sign; strength: 1 | 2 }[] = []
  for (let i = 0; i < nMag; i++) {
    for (let attempt = 0; attempt < MAX_PLACE_ATTEMPTS; attempt++) {
      const x = MAG_MARGIN + Math.floor(rng() * (BOARD_W - 2 * MAG_MARGIN))
      const y = y0 + MAG_Y_MIN + Math.floor(rng() * MAG_Y_SPAN)
      const charge: Sign = rng() < t.negP ? -1 : 1
      const strength: 1 | 2 = rng() < t.strongP ? 2 : 1
      const tooClose = mags.some((m) => dist2(m.x, m.y, x, y) < MAG_MIN_SEP * MAG_MIN_SEP)
      const inCorridor = Math.abs(y - gy) < GATE_CORRIDOR_DY && Math.abs(x - gx) < halfW + MAG_GATE_PAD
      if (tooClose || inCorridor) continue
      mags.push({ x, y, charge, strength })
      break
    }
  }
  const magnets: Magnet[] = mags.map((m) => ({ id: id++, x: m.x * FP, y: m.y * FP, charge: m.charge, strength: m.strength }))

  const nSpike = t.spikeMin + Math.floor(rng() * (t.spikeMax - t.spikeMin + 1))
  const sp: { x: number; y: number }[] = []
  for (let j = 0; j < nSpike; j++) {
    for (let attempt = 0; attempt < MAX_PLACE_ATTEMPTS; attempt++) {
      const x = SPIKE_MARGIN + Math.floor(rng() * (BOARD_W - 2 * SPIKE_MARGIN))
      const y = y0 + Math.floor(rng() * CHUNK_H)
      const inCorridor = Math.abs(y - gy) < GATE_CORRIDOR_DY && Math.abs(x - gx) < halfW + SPIKE_GATE_PAD
      const nearMag = mags.some((m) => dist2(m.x, m.y, x, y) < SPIKE_MAG_SEP * SPIKE_MAG_SEP)
      const nearSpike = sp.some((s) => dist2(s.x, s.y, x, y) < SPIKE_MIN_SEP * SPIKE_MIN_SEP)
      if (inCorridor || nearMag || nearSpike) continue
      sp.push({ x, y })
      break
    }
  }
  const spikes: Spike[] = sp.map((s) => ({ id: id++, x: s.x * FP, y: s.y * FP }))

  return { magnets, spikes, gate, nextId: id }
}

/** Generate until the board reaches one chunk below the view, then prune what scrolled off. */
export function ensureChunks(s: PolarityState): PolarityState {
  const need = s.camY + (VIEW_H + CHUNK_H) * FP
  let out = s
  if (s.genY < need) {
    const { rng, state } = rngFromState(s.rngState)
    const magnets = s.magnets.slice()
    const spikes = s.spikes.slice()
    const gates = s.gates.slice()
    let c = s.nextChunk
    let nextId = s.nextId
    let genY = s.genY
    while (genY < need) {
      const ch = generateChunk(c, rng, nextId)
      magnets.push(...ch.magnets)
      spikes.push(...ch.spikes)
      gates.push(ch.gate)
      nextId = ch.nextId
      c++
      genY = chunkTop(c)
    }
    out = { ...s, rngState: state(), magnets, spikes, gates, nextChunk: c, genY, nextId }
  }
  return prune(out)
}

function prune(s: PolarityState): PolarityState {
  const cut = s.camY - PRUNE_MARGIN * FP
  const keep = <T extends { y: number }>(arr: T[]): T[] => (arr.some((e) => e.y < cut) ? arr.filter((e) => e.y >= cut) : arr)
  const magnets = keep(s.magnets)
  const spikes = keep(s.spikes)
  const gates = keep(s.gates)
  if (magnets === s.magnets && spikes === s.spikes && gates === s.gates) return s
  return { ...s, magnets, spikes, gates }
}

// ---------------------------------------------------------------------------
// physics
// ---------------------------------------------------------------------------

export function magnetForce(ball: Ball, m: Magnet, polarity: Sign): { ax: number; ay: number } {
  const dx = m.x - ball.x
  const dy = m.y - ball.y
  const d2 = Math.floor((dx * dx + dy * dy) / 65536) // px²
  if (d2 > R_MAX * R_MAX) return { ax: 0, ay: 0 }
  const d = Math.max(1, isqrt(d2))
  const mag = Math.min(F_MAX * m.strength, itrunc((K_FORCE * m.strength) / (d2 + EPS)))
  const sgn = m.charge * polarity
  return {
    ax: sgn * itrunc((mag * dx) / (d * FP)) + 0,
    ay: sgn * itrunc((mag * dy) / (d * FP)) + 0,
  }
}

export function accelAt(ball: Ball, magnets: readonly Magnet[], polarity: Sign): { ax: number; ay: number } {
  let ax = 0
  let ay = TILT_ACC
  for (const m of magnets) {
    const f = magnetForce(ball, m, polarity)
    ax += f.ax
    ay += f.ay
  }
  ax = Math.max(-A_MAX, Math.min(A_MAX, ax)) + 0
  ay = Math.max(-A_MAX, Math.min(A_MAX, ay)) + 0
  return { ax, ay }
}

/**
 * Integrate one tick: accel → damping → per-axis clamp → move → walls → magnet cores.
 * Velocity is clamped again after the core bounce (a 1/2-restitution reflection can
 * push one axis past V_MAX), so |vx|,|vy| <= V_MAX always holds.
 */
export function stepBall(
  ball: Ball,
  magnets: readonly Magnet[],
  polarity: Sign,
): { ball: Ball; bumped: boolean; walled: boolean } {
  const { ax, ay } = accelAt(ball, magnets, polarity)
  let vx = ball.vx + ax
  let vy = ball.vy + ay
  vx -= itrunc(vx / DAMP_DIV)
  vy -= itrunc(vy / DAMP_DIV)
  vx = clampV(vx)
  vy = clampV(vy)
  let x = ball.x + vx
  let y = ball.y + vy
  let walled = false
  let bumped = false

  const minX = BALL_R * FP
  const maxX = (BOARD_W - BALL_R) * FP
  if (x < minX) {
    x = minX
    vx = itrunc((-vx * WALL_REST_NUM) / WALL_REST_DEN)
    walled = true
  } else if (x > maxX) {
    x = maxX
    vx = itrunc((-vx * WALL_REST_NUM) / WALL_REST_DEN)
    walled = true
  }

  const RR = (CORE_R + BALL_R) * FP
  for (const m of magnets) {
    let bx = x - m.x
    let by = y - m.y
    const b2 = bx * bx + by * by
    if (b2 >= RR * RR) continue
    let dfp = isqrt(b2)
    if (dfp === 0) {
      bx = 0
      by = -1
      dfp = 1
    }
    x = m.x + itrunc((bx * RR) / dfp)
    y = m.y + itrunc((by * RR) / dfp)
    const vn = itrunc((vx * bx + vy * by) / dfp)
    if (vn < 0) {
      vx -= itrunc((3 * vn * bx) / (2 * dfp))
      vy -= itrunc((3 * vn * by) / (2 * dfp))
    }
    bumped = true
  }
  vx = clampV(vx) + 0
  vy = clampV(vy) + 0

  return { ball: { x: x + 0, y: y + 0, vx, vy }, bumped, walled }
}

function hitsSpike(ball: Ball, spikes: readonly Spike[]): boolean {
  const r = (SPIKE_R + BALL_R) * FP
  for (const sp of spikes) {
    if (dist2(ball.x, ball.y, sp.x, sp.y) < r * r) return true
  }
  return false
}

/** Ballistic preview under a fixed polarity (fp points). Stops at (and includes) a spike hit. */
export function predictPath(s: PolarityState, ticks: number, polarity: Sign): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  let b = s.ball
  for (let i = 0; i < ticks; i++) {
    b = stepBall(b, s.magnets, polarity).ball
    out.push({ x: b.x, y: b.y })
    if (hitsSpike(b, s.spikes)) break
  }
  return out
}

// ---------------------------------------------------------------------------
// state machine
// ---------------------------------------------------------------------------

export function createGame(seed: number): PolarityState {
  const s0: PolarityState = {
    seed: seed >>> 0,
    rngState: (seed >>> 0) | 0,
    status: 'ready',
    tick: 0,
    polarity: 1,
    pendingFlip: false,
    flipCooldown: 0,
    flips: 0,
    ball: { x: BALL_START_X * FP, y: BALL_START_Y * FP, vx: 0, vy: 0 },
    camY: 0,
    magnets: [],
    spikes: [],
    gates: [],
    nextChunk: 0,
    genY: chunkTop(0),
    nextId: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    gatesPassed: 0,
    gatesMissed: 0,
    deathCause: null,
    lastEvent: 'none',
    lastTick: null,
  }
  return ensureChunks(s0)
}

export function distanceM(s: PolarityState): number {
  return Math.floor(s.camY / FP / 10)
}

function tick(s: PolarityState): PolarityState {
  const t = s.tick + 1
  let polarity = s.polarity
  let pendingFlip = s.pendingFlip
  let flipCooldown = s.flipCooldown
  let flips = s.flips
  let flipped = false
  // A buffered flip fires on the first tick the cooldown reads 0; otherwise the
  // cooldown ticks down. Flip at tick T → the earliest next flip is T+10
  // (FLIP_COOLDOWN = 9 blocked ticks in between).
  if (pendingFlip && flipCooldown === 0) {
    polarity = polarity === 1 ? -1 : 1
    flipCooldown = FLIP_COOLDOWN
    pendingFlip = false
    flips++
    flipped = true
  } else if (flipCooldown > 0) {
    flipCooldown--
  }

  const prevY = s.ball.y
  const step = stepBall(s.ball, s.magnets, polarity)
  const ball = step.ball

  const passed: number[] = []
  const missed: number[] = []
  let gained = 0
  let combo = s.combo
  let bestCombo = s.bestCombo
  let gatesPassed = s.gatesPassed
  let gatesMissed = s.gatesMissed
  let gates = s.gates
  let camY = s.camY
  let status: Status = s.status
  let deathCause: DeathCause | null = s.deathCause

  if (hitsSpike(ball, s.spikes)) {
    status = 'dead'
    deathCause = 'spike'
  } else {
    let changed: Gate[] | null = null
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i]
      if (g.state !== 'pending' || !(prevY < g.y && ball.y >= g.y)) continue
      if (!changed) changed = gates.slice()
      if (Math.abs(ball.x - g.x) <= g.halfW) {
        changed[i] = { ...g, state: 'passed' }
        passed.push(g.id)
        combo++
        if (combo > bestCombo) bestCombo = combo
        gained += gatePoints(combo)
        gatesPassed++
      } else {
        changed[i] = { ...g, state: 'missed' }
        missed.push(g.id)
        combo = 0
        gatesMissed++
      }
    }
    if (changed) gates = changed

    camY = Math.max(camY + scrollSpeed(camY), ball.y - FOLLOW_OFFSET * FP)
    if (ball.y - BALL_R * FP < camY) {
      status = 'dead'
      deathCause = 'crushed'
    }
  }

  const lastEvent: PolEvent =
    status === 'dead'
      ? 'dead'
      : passed.length
        ? 'gate'
        : missed.length
          ? 'miss'
          : flipped
            ? 'flip'
            : step.bumped
              ? 'bump'
              : step.walled
                ? 'wall'
                : 'none'

  let next: PolarityState = {
    ...s,
    status,
    tick: t,
    polarity,
    pendingFlip,
    flipCooldown,
    flips,
    ball,
    camY,
    gates,
    score: s.score + gained,
    combo,
    bestCombo,
    gatesPassed,
    gatesMissed,
    deathCause,
    lastEvent,
    lastTick: {
      tick: t,
      flipped,
      bumped: step.bumped,
      walled: step.walled,
      passed,
      missed,
      gained,
      mult: comboMult(combo),
    },
  }
  if (status !== 'dead') next = ensureChunks(next)
  return next
}

export function reduce(s: PolarityState, a: PolAction): PolarityState {
  switch (a.type) {
    case 'new':
      return createGame(a.seed)
    case 'start':
      if (s.status !== 'ready') return s
      return { ...s, status: 'running', lastEvent: 'start' }
    case 'flip':
      if (s.status === 'ready') return { ...s, status: 'running', lastEvent: 'start' }
      if (s.status !== 'running') return s
      if (s.pendingFlip && s.lastEvent === 'queued') return s
      return { ...s, pendingFlip: true, lastEvent: 'queued' }
    case 'tick':
      if (s.status !== 'running') return s
      return tick(s)
    default:
      return s
  }
}
