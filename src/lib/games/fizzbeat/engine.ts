/**
 * FizzBeat — FizzBuzz as a rhythm game.
 *
 * A metronome counts. On multiples of `a` hit LEFT, on multiples of `b` hit
 * RIGHT, on both hit both, otherwise stay silent. Every 30 beats the rule
 * (divisors, count step, direction) changes and the tempo creeps up.
 *
 * Pure & deterministic: the only time unit is the integer tick
 * (1 tick = TICK_MS ms, driven by the component). Randomness is used once, in
 * `createGame`, to pre-roll the whole phase table from the seed — `reduce`
 * never touches an Rng, so seed + (tick, side) input script = identical run.
 */

export type Rng = () => number // [0,1)
export type Side = 'L' | 'R'
export interface Expect {
  L: boolean
  R: boolean
}
export type Judgment = 'hit' | 'rest' | 'wrong' | 'miss'
export type Status = 'ready' | 'running' | 'over'

export interface PhaseRule {
  index: number // k (0-based)
  pairIndex: number // PAIR_POOL index
  a: number // LEFT divisor
  b: number // RIGHT divisor
  step: number // 1 | 2 | 3 | 7
  dir: 1 | -1
  start: number // value of this phase's i=0 beat (>=1)
  period: number // click spacing (ticks)
  window: number // judgment half-width W (ticks)
}

export interface FizzEvents {
  click: 'count' | 'beat' | null
  tap: Side | null
  judged: Judgment | null
  judgedBeat: number | null
  ignored: boolean
  phaseChanged: boolean
  over: boolean
}

export interface FizzState {
  seed: number
  phases: PhaseRule[]
  phaseStart: number[]
  status: Status
  tick: number
  cursor: number
  pressed: Expect
  resolved: Judgment | null
  lives: number
  score: number
  streak: number
  bestStreak: number
  survived: number
  hits: number
  rests: number
  mistakes: number
  phaseMistakes: number
  /** Beat that gets a fresh count-in after a resume (-1 = none). Phase-first beats always have one. */
  recountBeat: number
  lastJudgment: { beat: number; value: number; kind: Judgment; expected: Expect } | null
  events: FizzEvents
}

/**
 * `resume` ends a pause (the component freezes the clock; the engine never sees the pause itself).
 * Pausing must not buy thinking time on numbers already on screen, so resume first closes every beat
 * whose number was visible — judged with whatever was pressed so far, exactly as if the clock had run
 * through its window with no further input — then plays a fresh count-in before the first unseen beat.
 */
export type FizzAction = { type: 'start' } | { type: 'tick' } | { type: 'press'; side: Side } | { type: 'resume' }

// ---------------------------------------------------------------- constants

export const TICK_MS = 10
export const COUNT_IN = 4
export const PHASE_BEATS = 30
export const CLICKS_PER_PHASE = COUNT_IN + PHASE_BEATS // 34
export const MAX_PHASES = 100
export const STARTING_LIVES = 3
export const PERIOD_START = 66
export const PERIOD_DROP = 4
export const PERIOD_MIN = 32
export const WINDOW_FRACTION = 0.3
export const WINDOW_MIN = 6
export const WINDOW_MAX = 12
export const BEAT_POINTS = 10
export const MULT_STEP = 10
export const MULT_CAP = 8
export const PHASE_BONUS = 100
export const BACKWARD_FROM_PHASE = 4
export const BACKWARD_CHANCE = 0.4
export const PAIR_POOL: ReadonlyArray<readonly [number, number]> = [
  [3, 5],
  [4, 7],
  [2, 9],
  [2, 5],
  [3, 4],
  [3, 7],
  [5, 6],
  [4, 9],
  [6, 7],
  [3, 8],
  [2, 7],
  [5, 7],
  [4, 5],
]

// ---------------------------------------------------------------- pure helpers

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

function gcd(x: number, y: number): number {
  let a = Math.abs(x)
  let b = Math.abs(y)
  while (b) {
    const t = a % b
    a = b
    b = t
  }
  return a
}

export function expected(value: number, a: number, b: number): Expect {
  return { L: value % a === 0, R: value % b === 0 }
}

export function expectKey(e: Expect): '' | 'L' | 'R' | 'LR' {
  if (e.L && e.R) return 'LR'
  if (e.L) return 'L'
  if (e.R) return 'R'
  return ''
}

export function periodFor(k: number): number {
  return Math.max(PERIOD_MIN, PERIOD_START - PERIOD_DROP * k)
}

export function windowFor(period: number): number {
  return Math.min(WINDOW_MAX, Math.max(WINDOW_MIN, Math.floor(period * WINDOW_FRACTION)))
}

export function stepTable(k: number): number[] {
  if (k <= 1) return [1]
  if (k === 2) return [1, 2]
  if (k === 3) return [1, 3]
  return [1, 3, 7]
}

/** Pre-rolls the phase table. Consumes exactly 3*(count-1) rng calls. */
export function generatePhases(rng: Rng, count: number): PhaseRule[] {
  const phases: PhaseRule[] = []
  if (count <= 0) return phases
  const p0 = periodFor(0)
  phases.push({ index: 0, pairIndex: 0, a: 3, b: 5, step: 1, dir: 1, start: 1, period: p0, window: windowFor(p0) })
  let anchor = PHASE_BEATS // largest value so far
  for (let k = 1; k < count; k++) {
    const r1 = rng()
    const r2 = rng()
    const r3 = rng()
    const prev = phases[k - 1]
    let idx = Math.floor(r1 * (PAIR_POOL.length - 1))
    if (idx >= prev.pairIndex) idx++
    const [a, b] = PAIR_POOL[idx]
    const tbl = stepTable(k)
    let step = tbl[Math.floor(r2 * tbl.length)]
    if (gcd(step, a) > 1 || gcd(step, b) > 1) step = 1
    const dir: 1 | -1 = k >= BACKWARD_FROM_PHASE && r3 < BACKWARD_CHANCE ? -1 : 1
    const start = dir === 1 ? anchor + 1 : anchor + 1 + step * (PHASE_BEATS - 1)
    anchor = dir === 1 ? start + step * (PHASE_BEATS - 1) : start
    const period = periodFor(k)
    phases.push({ index: k, pairIndex: idx, a, b, step, dir, start, period, window: windowFor(period) })
  }
  return phases
}

export function buildPhaseStart(phases: PhaseRule[]): number[] {
  const out = [0]
  for (let k = 0; k < phases.length; k++) out.push(out[k] + CLICKS_PER_PHASE * phases[k].period)
  return out
}

export function phaseOf(j: number): number {
  return Math.floor(j / PHASE_BEATS)
}

export function beatValue(phases: PhaseRule[], j: number): number {
  const p = phases[phaseOf(j)]
  const i = j % PHASE_BEATS
  return p.start + p.dir * p.step * i
}

export function beatTick(phases: PhaseRule[], phaseStart: number[], j: number): number {
  const k = phaseOf(j)
  const i = j % PHASE_BEATS
  return phaseStart[k] + (COUNT_IN + i) * phases[k].period
}

export function expectedAt(state: FizzState, j: number): Expect {
  const p = state.phases[phaseOf(j)]
  return expected(beatValue(state.phases, j), p.a, p.b)
}

/** Beat `j` is preceded by a count-in: the first beat of every phase, and the beat after a resume. */
export function hasCountIn(state: FizzState, j: number): boolean {
  return j % PHASE_BEATS === 0 || j === state.recountBeat
}

/** Which metronome click (if any) sounds at `tick`, relative to the cursor's phase. */
export function clickAt(state: FizzState, tick: number): 'count' | 'beat' | null {
  const k = phaseOf(state.cursor)
  if (k >= state.phases.length) return null
  const P = state.phases[k].period
  const T = beatTick(state.phases, state.phaseStart, state.cursor)
  if (tick < T && hasCountIn(state, state.cursor)) {
    const c = tick - (T - COUNT_IN * P)
    return c >= 0 && c % P === 0 ? 'count' : null
  }
  const d = tick - state.phaseStart[k]
  if (d < 0 || d % P !== 0) return null
  const m = d / P
  if (m >= CLICKS_PER_PHASE) return null
  return m < COUNT_IN ? 'count' : 'beat'
}

export function multiplierFor(streak: number): number {
  return Math.min(MULT_CAP, 1 + Math.floor(streak / MULT_STEP))
}

function emptyEvents(): FizzEvents {
  return { click: null, tap: null, judged: null, judgedBeat: null, ignored: false, phaseChanged: false, over: false }
}

export function createGame(seed: number): FizzState {
  const phases = generatePhases(mulberry32(seed), MAX_PHASES)
  return {
    seed: seed >>> 0,
    phases,
    phaseStart: buildPhaseStart(phases),
    status: 'ready',
    tick: 0,
    cursor: 0,
    pressed: { L: false, R: false },
    resolved: null,
    lives: STARTING_LIVES,
    score: 0,
    streak: 0,
    bestStreak: 0,
    survived: 0,
    hits: 0,
    rests: 0,
    mistakes: 0,
    phaseMistakes: 0,
    recountBeat: -1,
    lastJudgment: null,
    events: emptyEvents(),
  }
}

// ---------------------------------------------------------------- reducer

/** Applies a judgment to `s` (a fresh copy owned by reduce — safe to mutate). */
function applyJudgment(s: FizzState, j: number, kind: Judgment): void {
  const exp = expectedAt(s, j)
  s.events.judged = kind
  s.events.judgedBeat = j
  s.lastJudgment = { beat: j, value: beatValue(s.phases, j), kind, expected: exp }
  if (kind === 'hit' || kind === 'rest') {
    s.streak += 1
    s.bestStreak = Math.max(s.bestStreak, s.streak)
    s.survived += 1
    if (kind === 'hit') s.hits += 1
    else s.rests += 1
    s.score += BEAT_POINTS * multiplierFor(s.streak)
    return
  }
  s.lives -= 1
  s.streak = 0
  s.mistakes += 1
  s.phaseMistakes += 1
  if (s.lives <= 0) {
    s.lives = 0
    s.status = 'over'
    s.events.over = true
  }
}

/** Closes the cursor beat (judging it unless a wrong press already did), as at T+W+1. */
function closeBeat(s: FizzState): void {
  const j = s.cursor
  const k = phaseOf(j)
  if (s.resolved !== 'wrong') {
    const exp = expectedAt(s, j)
    const ok = s.pressed.L === exp.L && s.pressed.R === exp.R
    const kind: Judgment = ok ? (exp.L || exp.R ? 'hit' : 'rest') : 'miss'
    applyJudgment(s, j, kind)
    if (s.status === 'over') return
  }
  if (j % PHASE_BEATS === PHASE_BEATS - 1) {
    s.score += PHASE_BONUS * (k + 1) * (s.phaseMistakes === 0 ? 2 : 1)
    s.phaseMistakes = 0
    s.events.phaseChanged = true
  }
  s.cursor = j + 1
  s.pressed = { L: false, R: false }
  s.resolved = null
  if (s.cursor >= MAX_PHASES * PHASE_BEATS) {
    s.status = 'over'
    s.events.over = true
  }
}

export function reduce(state: FizzState, action: FizzAction): FizzState {
  switch (action.type) {
    case 'start': {
      if (state.status !== 'ready') return { ...state, events: emptyEvents() }
      return { ...state, status: 'running', tick: 0, events: { ...emptyEvents(), click: 'count' } }
    }

    case 'press': {
      if (state.status !== 'running') return { ...state, events: { ...emptyEvents(), ignored: true } }
      const j = state.cursor
      const k = phaseOf(j)
      if (k >= state.phases.length) return { ...state, events: { ...emptyEvents(), ignored: true } }
      const T = beatTick(state.phases, state.phaseStart, j)
      const W = state.phases[k].window
      const side = action.side
      if (Math.abs(state.tick - T) > W || state.resolved !== null || state.pressed[side]) {
        return { ...state, events: { ...emptyEvents(), ignored: true } }
      }
      const s: FizzState = { ...state, events: emptyEvents() }
      if (!expectedAt(state, j)[side]) {
        s.resolved = 'wrong'
        applyJudgment(s, j, 'wrong')
        return s
      }
      s.pressed = { ...state.pressed, [side]: true }
      s.events.tap = side
      return s
    }

    case 'tick': {
      if (state.status !== 'running') return { ...state, events: emptyEvents() }
      const s: FizzState = { ...state, tick: state.tick + 1, events: emptyEvents() }
      const j = s.cursor
      const k = phaseOf(j)
      if (k < s.phases.length) {
        const T = beatTick(s.phases, s.phaseStart, j)
        const W = s.phases[k].window
        if (s.tick === T + W + 1) {
          closeBeat(s)
          if (s.status === 'over') return s
        }
      }
      s.events.click = clickAt(s, s.tick)
      return s
    }

    case 'resume': {
      if (state.status !== 'running') return { ...state, events: emptyEvents() }
      const s: FizzState = { ...state, events: emptyEvents() }
      const j = s.cursor
      const T = beatTick(s.phases, s.phaseStart, j)
      const W = s.phases[phaseOf(j)].window
      // Mirrors what the board showed: the cursor's number (hidden only during its count-in) and,
      // once its click has sounded, the next number of the same phase.
      const shownCurrent = !(hasCountIn(s, j) && s.tick < T - W)
      const shownNext = s.tick >= T && (j + 1) % PHASE_BEATS !== 0 && j + 1 < MAX_PHASES * PHASE_BEATS
      const toClose = (shownCurrent ? 1 : 0) + (shownNext ? 1 : 0)
      let worst: { judged: Judgment; beat: number; last: FizzState['lastJudgment'] } | null = null
      let phaseChanged = false
      const costly = (x: Judgment | undefined) => x === 'miss' || x === 'wrong'
      for (let n = 0; n < toClose; n++) {
        closeBeat(s)
        phaseChanged ||= s.events.phaseChanged
        const kind = s.events.judged
        if (kind && !costly(worst?.judged)) {
          worst = { judged: kind, beat: s.events.judgedBeat as number, last: s.lastJudgment }
        }
        if (s.status === 'over') break
      }
      // Several beats may close in one call: report (and show) the costly one, not a trailing rest.
      if (worst) {
        s.events.judged = worst.judged
        s.events.judgedBeat = worst.beat
        s.lastJudgment = worst.last
      }
      s.events.phaseChanged = phaseChanged
      if (s.status === 'over') return s
      // Fresh count-in from now before the first unseen beat: shift this phase and every later one.
      const c = s.cursor
      const k = phaseOf(c)
      const delta = s.tick + COUNT_IN * s.phases[k].period - beatTick(s.phases, s.phaseStart, c)
      s.phaseStart = s.phaseStart.map((t, i) => (i >= k ? t + delta : t))
      s.recountBeat = c
      s.events.click = 'count'
      return s
    }
  }
}
