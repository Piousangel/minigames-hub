/**
 * Slosh — carry a sloshing glass of water along a rail on a tray-cart.
 *
 * Pure, deterministic engine. All arithmetic is integer fixed-point so the
 * same seed + same input log always produces the same run (and score).
 * Randomness is consumed only inside `generateTrack` via the injected Rng.
 *
 * Sign convention: travel is +x (right). theta < 0 = water pushed BACK
 * (accelerating), theta > 0 = water pushed FORWARD (braking).
 */

export const TICK_MS = 20
export const U_PER_M = 4000
export const ACC = 8
export const BRK = 16
export const SLOPE = 4
export const VMAX = 480
export const LIQ_SCALE = 4096
export const LIQ_K = 45
export const LIQ_C = 43
export const LIQ_G = 6
export const SPILL = 8000
export const SPILL_DIV = 1
export const WATER_MAX = 10000
export const REFILL = 1500
export const CELL = 8000
export const LEG_MIN = 40000
export const LEG_MAX = 72000
export const LEG_STEP = 1000
export const RUNOUT = 16000
export const FLAT_BEFORE = 12000
export const FLAT_AFTER = 8000
export const ZONE = 4000
export const DWELL = 40
export const LEG_SLACK = 90
export const ACC_PTS = 500
export const CALM_R = 1500
export const CALM_PTS = 400
export const PERFECT_BONUS = 1000

export type Rng = () => number
export type Throttle = -1 | 0 | 1
export type Grade = -1 | 0 | 1
export type StationKind = 'stop' | 'refill' | 'terminal'
export type SloshStatus = 'ready' | 'running' | 'over'
export type LoseReason = 'dry' | 'overrun' | 'timeout'
export type SloshEvent =
  | 'none'
  | 'start'
  | 'spill'
  | 'dock'
  | 'calm'
  | 'missed'
  | 'win'
  | 'dry'
  | 'overrun'
  | 'timeout'

export interface Station {
  target: number
  kind: StationKind
  legLen: number
}

export interface Track {
  seed: number
  stations: Station[]
  grades: Grade[]
  trackEnd: number
  timeLimit: number
}

export interface StationResult {
  index: number
  kind: StationKind
  docked: boolean
  offset: number
  accuracyPts: number
  calm: boolean
  calmPts: number
  refilled: number
  tick: number
}

export interface SloshState {
  seed: number
  track: Track
  status: SloshStatus
  throttle: Throttle
  x: number
  v: number
  a: number
  theta: number
  omega: number
  water: number
  ticks: number
  nextStation: number
  dwell: number
  results: StationResult[]
  stationScore: number
  won: boolean
  loseReason: LoseReason | null
  lastEvent: SloshEvent
  lastSpill: number
  totalSpilled: number
  score: number
}

export type SloshAction = { type: 'input'; throttle: Throttle } | { type: 'tick' }

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

/** Truncating integer division (toward 0), never returns -0. */
export function idiv(n: number, d: number): number {
  const q = (n / d) | 0
  return q === 0 ? 0 : q
}

export function generateTrack(seed: number, rng: Rng): Track {
  const S = 3 + Math.floor(rng() * 2)
  const stations: Station[] = []
  let pos = 0
  const legSteps = (LEG_MAX - LEG_MIN) / LEG_STEP + 1
  for (let i = 0; i < S; i++) {
    const len = LEG_MIN + LEG_STEP * Math.floor(rng() * legSteps)
    const kr = rng()
    pos += len
    const kind: StationKind = i === S - 1 ? 'terminal' : kr < 0.5 ? 'refill' : 'stop'
    stations.push({ target: pos, kind, legLen: len })
  }
  if (!stations.slice(0, S - 1).some((s) => s.kind === 'refill')) {
    stations[Math.floor((S - 1) / 2)].kind = 'refill'
  }
  const trackEnd = stations[S - 1].target + RUNOUT
  const n = Math.ceil(trackEnd / CELL)
  const grades: Grade[] = []
  for (let c = 0; c < n; c++) {
    const r = rng()
    let g: Grade = r < 0.45 ? 0 : r < 0.725 ? 1 : -1
    if (c === 0) g = 0
    else {
      for (const st of stations) {
        if (c * CELL < st.target + FLAT_AFTER && (c + 1) * CELL > st.target - FLAT_BEFORE) {
          g = 0
          break
        }
      }
    }
    grades.push(g)
  }
  let timeLimit = (S - 1) * DWELL
  for (const st of stations) timeLimit += Math.floor(st.legLen / 200) + LEG_SLACK
  return { seed, stations, grades, trackEnd, timeLimit }
}

export function createGame(seed: number): SloshState {
  const track = generateTrack(seed >>> 0, mulberry32(seed))
  return {
    seed: seed >>> 0,
    track,
    status: 'ready',
    throttle: 0,
    x: 0,
    v: 0,
    a: 0,
    theta: 0,
    omega: 0,
    water: WATER_MAX,
    ticks: 0,
    nextStation: 0,
    dwell: 0,
    results: [],
    stationScore: 0,
    won: false,
    loseReason: null,
    lastEvent: 'none',
    lastSpill: 0,
    totalSpilled: 0,
    score: 0,
  }
}

export function gradeAt(track: Track, x: number): Grade {
  const c = Math.floor(x / CELL)
  if (c < 0 || c >= track.grades.length) return 0
  return track.grades[c]
}

export function stepCart(v: number, throttle: Throttle, grade: Grade): { v: number; a: number } {
  const dv = (throttle === 1 ? ACC : throttle === -1 ? -BRK : 0) - grade * SLOPE
  const nv = Math.min(VMAX, Math.max(0, v + dv))
  return { v: nv, a: nv - v }
}

export function stepLiquid(theta: number, omega: number, a: number): { theta: number; omega: number } {
  const nOmega = omega + idiv(-LIQ_K * theta - LIQ_C * omega, LIQ_SCALE) - LIQ_G * a
  return { theta: theta + nOmega, omega: nOmega }
}

export function applySpill(
  theta: number,
  omega: number,
  water: number,
): { theta: number; omega: number; water: number; spilled: number } {
  const abs = Math.abs(theta)
  if (abs <= SPILL) return { theta, omega, water, spilled: 0 }
  const excess = abs - SPILL
  const spilled = Math.min(water, Math.ceil(excess / SPILL_DIV))
  return { theta: Math.sign(theta) * SPILL, omega: 0, water: water - spilled, spilled }
}

export function isGlassCalm(theta: number, omega: number): boolean {
  return theta * theta + 100 * omega * omega <= CALM_R * CALM_R
}

export function accuracyPoints(offset: number): number {
  const d = Math.abs(offset)
  if (d > ZONE) return 0
  return idiv(ACC_PTS * (ZONE - d), ZONE)
}

export interface ScoreBreakdown {
  accuracy: number
  calm: number
  water: number
  time: number
  perfect: number
  total: number
}

export function scoreBreakdown(s: SloshState): ScoreBreakdown {
  let accuracy = 0
  let calm = 0
  for (const r of s.results) {
    accuracy += r.accuracyPts
    calm += r.calmPts
  }
  let water = 0
  let time = 0
  let perfect = 0
  if (s.won) {
    water = idiv(s.water * 4, 10)
    time = Math.max(0, Math.floor((s.track.timeLimit - s.ticks) / 2))
    perfect =
      s.results.length === s.track.stations.length && s.results.every((r) => r.docked && r.calm) ? PERFECT_BONUS : 0
  }
  return { accuracy, calm, water, time, perfect, total: accuracy + calm + water + time + perfect }
}

export function finalScore(s: SloshState): number {
  return scoreBreakdown(s).total
}

function finalize(s: SloshState): SloshState {
  s.score = s.status === 'over' ? finalScore(s) : s.stationScore
  return s
}

export function reduce(s: SloshState, action: SloshAction): SloshState {
  if (s.status === 'over') return s
  if (action.type === 'input') {
    if (s.status === 'ready' && action.throttle === 1) {
      return { ...s, throttle: action.throttle, status: 'running', lastEvent: 'start' }
    }
    return { ...s, throttle: action.throttle, lastEvent: 'none' }
  }
  if (s.status !== 'running') return { ...s, lastEvent: 'none' }

  const n: SloshState = { ...s, results: s.results.slice(), lastEvent: 'none', lastSpill: 0 }
  // 1. cart
  if (n.dwell > 0) {
    n.dwell -= 1
    n.a = 0
  } else {
    const c = stepCart(n.v, n.throttle, gradeAt(n.track, n.x))
    n.v = c.v
    n.a = c.a
    n.x += n.v
  }
  // 2. liquid
  const liq = stepLiquid(n.theta, n.omega, n.a)
  // 3. spill
  const sp = applySpill(liq.theta, liq.omega, n.water)
  n.theta = sp.theta
  n.omega = sp.omega
  n.water = sp.water
  if (sp.spilled > 0) {
    n.lastSpill = sp.spilled
    n.totalSpilled += sp.spilled
    n.lastEvent = 'spill'
  }
  // 4.
  n.ticks += 1
  // 5. dry
  if (n.water <= 0) {
    n.status = 'over'
    n.loseReason = 'dry'
    n.lastEvent = 'dry'
    return finalize(n)
  }
  // 6. station judgement
  const stations = n.track.stations
  if (n.dwell === 0 && n.nextStation < stations.length) {
    const st = stations[n.nextStation]
    const off = n.x - st.target
    if (n.v === 0 && Math.abs(off) <= ZONE) {
      const calm = isGlassCalm(n.theta, n.omega)
      const acc = accuracyPoints(off)
      const cp = calm ? CALM_PTS : 0
      const refilled = st.kind === 'refill' ? Math.min(REFILL, WATER_MAX - n.water) : 0
      n.water += refilled
      n.results.push({
        index: n.nextStation,
        kind: st.kind,
        docked: true,
        offset: off,
        accuracyPts: acc,
        calm,
        calmPts: cp,
        refilled,
        tick: n.ticks,
      })
      n.stationScore += acc + cp
      n.lastEvent = calm ? 'calm' : 'dock'
      if (st.kind === 'terminal') {
        n.status = 'over'
        n.won = true
        n.lastEvent = 'win'
        return finalize(n)
      }
      n.dwell = DWELL
      n.nextStation += 1
    } else if (off > ZONE) {
      if (st.kind === 'terminal') {
        n.status = 'over'
        n.loseReason = 'overrun'
        n.lastEvent = 'overrun'
        return finalize(n)
      }
      n.results.push({
        index: n.nextStation,
        kind: st.kind,
        docked: false,
        offset: off,
        accuracyPts: 0,
        calm: false,
        calmPts: 0,
        refilled: 0,
        tick: n.ticks,
      })
      n.nextStation += 1
      n.lastEvent = 'missed'
    }
  }
  // 7. timeout
  if (n.ticks >= n.track.timeLimit) {
    n.status = 'over'
    n.loseReason = 'timeout'
    n.lastEvent = 'timeout'
  }
  return finalize(n)
}

export function simulate(seed: number, inputs: readonly Throttle[]): SloshState {
  let s = createGame(seed)
  for (const throttle of inputs) {
    if (s.status === 'over') break
    s = reduce(s, { type: 'input', throttle })
    s = reduce(s, { type: 'tick' })
  }
  return s
}

export function liveDistance(s: SloshState): number {
  const st = s.track.stations[s.nextStation]
  if (!st) return 0
  return Math.max(0, st.target - s.x)
}
