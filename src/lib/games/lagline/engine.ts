/**
 * Lagline — pure engine.
 *
 * Five lanes scroll toward the player one row per beat. Every command the
 * player gives is appended to a FIFO queue and executes exactly D beats later
 * (D = 3, or 4 in the late "long lag" windows). To survive you read the world
 * D rows ahead, not the row under your feet.
 *
 * All functions are pure and total: no timers, no `Date`, no `Math.random`.
 * Randomness enters only through an injected `Rng`, and only `generateRow`
 * consumes it. The rng accumulator lives in the state (`rngState`) so a state
 * is fully serializable and every run is golden-testable from (seed, actions).
 */

export type Rng = () => number // [0,1)
export type Cmd = 'left' | 'right' | 'jump' | 'stay'
export type Cell = 'empty' | 'wall' | 'hurdle'
export type Row = Cell[] // length LANES, index = lane
export type Status = 'ready' | 'running' | 'dead'

export type LagEvent =
  | 'none'
  | 'start'
  | 'queued'
  | 'locked'
  | 'step'
  | 'move'
  | 'bump'
  | 'jump'
  | 'delay-up'
  | 'delay-down'
  | 'stage'
  | 'dead'

export interface TickInfo {
  beat: number // absolute beat this tick processed (1-based)
  cmd: Cmd // command executed this beat
  from: number // lane before
  to: number // lane after (clamped)
  bumped: boolean // left/right blocked by the edge
  jumped: boolean // cmd === 'jump'
  inputDropped: boolean // always false by design (shrink beats lock input instead)
  cell: Cell // cell of the landing lane on this beat
}

export interface LagState {
  seed: number
  rngState: number // mulberry32 accumulator (serializable rng state)
  status: Status
  beat: number // beats survived = score
  lane: number // 0..4
  queue: Cmd[] // committed future commands; queue[0] runs next. length 3 or 4
  pending: Cmd | null // input received during this beat (last one wins)
  current: Row // the row the player stands on (for drawing)
  ahead: Row[] // length VIEW; ahead[k] is absolute beat beat+1+k
  reach: boolean[] // lanes reachable at the last ahead row (generation guarantee)
  deathCause: 'wall' | 'hurdle' | null
  lastEvent: LagEvent
  lastTick: TickInfo | null
}

export type LagAction =
  | { type: 'start' }
  | { type: 'input'; cmd: Cmd }
  | { type: 'tick' }
  | { type: 'new'; seed: number }

export const LANES = 5
export const START_LANE = 2
export const VIEW = 12
export const BASE_DELAY = 3
export const LONG_DELAY = 4
export const GRACE_BEATS = 8
export const STAGE_LEN = 32
export const MAX_ROW_ATTEMPTS = 8
export const CLEAR_BEATS = 160

export interface StageSpec {
  bpm: number
  gapP: number // probability a row is empty
  maxCells: number // max obstacles per row
  hurdleP: number // probability an obstacle is a hurdle (jumpable)
}

export const STAGES: readonly StageSpec[] = [
  { bpm: 96, gapP: 0.55, maxCells: 2, hurdleP: 0 },
  { bpm: 104, gapP: 0.45, maxCells: 2, hurdleP: 0.2 },
  { bpm: 112, gapP: 0.4, maxCells: 3, hurdleP: 0.25 },
  { bpm: 120, gapP: 0.35, maxCells: 3, hurdleP: 0.3 },
  { bpm: 128, gapP: 0.3, maxCells: 3, hurdleP: 0.3 },
  { bpm: 138, gapP: 0.28, maxCells: 4, hurdleP: 0.35 },
  { bpm: 148, gapP: 0.25, maxCells: 4, hurdleP: 0.35 },
  { bpm: 160, gapP: 0.22, maxCells: 4, hurdleP: 0.4 },
]

// ---------------------------------------------------------------------------
// rng
// ---------------------------------------------------------------------------

/** One mulberry32 step — bit-identical to decant's mulberry32. */
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
// beat schedule
// ---------------------------------------------------------------------------

export function stageForBeat(b: number): number {
  return Math.min(STAGES.length - 1, Math.floor((Math.max(1, b) - 1) / STAGE_LEN))
}

export function bpmForBeat(b: number): number {
  return STAGES[stageForBeat(b)].bpm
}

export function beatMs(b: number): number {
  return Math.round(60000 / bpmForBeat(b))
}

/** 4 in the second half of every stage from stage 4 on (first: 145..160). */
export function delayForBeat(b: number): 3 | 4 {
  const bb = Math.max(1, b)
  return stageForBeat(bb) >= 4 && (bb - 1) % STAGE_LEN >= STAGE_LEN / 2 ? LONG_DELAY : BASE_DELAY
}

/**
 * A "grow" beat is where the lag goes 3 → 4: the queue takes the input without
 * shifting, so the player is forced to 'stay' on that beat (no move, no jump).
 */
export function isGrowBeat(b: number): boolean {
  return b > 1 && delayForBeat(b) > delayForBeat(b - 1)
}

export function isCleared(s: LagState): boolean {
  return s.beat >= CLEAR_BEATS
}

// ---------------------------------------------------------------------------
// rules
// ---------------------------------------------------------------------------

export function applyCommand(lane: number, cmd: Cmd): { lane: number; bumped: boolean } {
  if (cmd === 'left') return lane <= 0 ? { lane: 0, bumped: true } : { lane: lane - 1, bumped: false }
  if (cmd === 'right') {
    return lane >= LANES - 1 ? { lane: LANES - 1, bumped: true } : { lane: lane + 1, bumped: false }
  }
  return { lane: Math.max(0, Math.min(LANES - 1, lane)), bumped: false }
}

export function isFatal(cell: Cell, cmd: Cmd): boolean {
  if (cell === 'wall') return true
  if (cell === 'hurdle') return cmd !== 'jump'
  return false
}

export function emptyRow(): Row {
  return Array.from({ length: LANES }, () => 'empty' as Cell)
}

/**
 * Free beat: move ±1 or stay. A hurdle is passable only by jumping, and a jump
 * never changes lane — so a hurdle cell is reachable only from the same lane.
 */
export function nextReach(reach: boolean[], row: Row): boolean[] {
  const out: boolean[] = []
  for (let x = 0; x < LANES; x++) {
    if (row[x] === 'wall') {
      out.push(false)
      continue
    }
    if (row[x] === 'hurdle') {
      out.push(!!reach[x])
      continue
    }
    let ok = false
    for (let r = Math.max(0, x - 1); r <= Math.min(LANES - 1, x + 1); r++) {
      if (reach[r]) ok = true
    }
    out.push(ok)
  }
  return out
}

/** Forced-stay beat (grow): no lateral move and nothing but empty cells pass. */
export function stayReach(reach: boolean[], row: Row): boolean[] {
  return reach.map((r, x) => !!r && row[x] === 'empty')
}

/** Reach propagation that respects the beat's rules (grow beats force 'stay'). */
export function reachForBeat(reach: boolean[], row: Row, absBeat: number): boolean[] {
  return isGrowBeat(absBeat) ? stayReach(reach, row) : nextReach(reach, row)
}

/**
 * Generate the row for absolute beat `absBeat`, guaranteeing that at least one
 * lane stays reachable. Consumption order is part of the contract (see tests):
 * r1 gap roll; else r2 count roll; then (lane, kind) pairs; up to
 * MAX_ROW_ATTEMPTS tries, then an empty row with no further consumption.
 * On grow beats every obstacle is a wall (same rng consumption) since the
 * forced 'stay' can't jump.
 */
export function generateRow(reach: boolean[], absBeat: number, rng: Rng): { row: Row; reach: boolean[] } {
  if (absBeat <= GRACE_BEATS) {
    const row = emptyRow()
    return { row, reach: reachForBeat(reach, row, absBeat) }
  }
  const spec = STAGES[stageForBeat(absBeat)]
  const grow = isGrowBeat(absBeat)
  for (let attempt = 0; attempt < MAX_ROW_ATTEMPTS; attempt++) {
    const row = emptyRow()
    const r1 = rng()
    if (r1 >= spec.gapP) {
      const r2 = rng()
      const count = 1 + Math.floor(r2 * spec.maxCells)
      for (let i = 0; i < count; i++) {
        const lane = Math.min(LANES - 1, Math.floor(rng() * LANES))
        const kind: Cell = rng() < spec.hurdleP && !grow ? 'hurdle' : 'wall'
        row[lane] = kind
      }
    }
    const next = reachForBeat(reach, row, absBeat)
    if (next.some(Boolean)) return { row, reach: next }
  }
  const row = emptyRow()
  return { row, reach: reachForBeat(reach, row, absBeat) }
}

export function createGame(seed: number): LagState {
  const { rng, state } = rngFromState(seed >>> 0)
  let reach: boolean[] = [false, false, true, false, false]
  const ahead: Row[] = []
  for (let b = 1; b <= VIEW; b++) {
    const g = generateRow(reach, b, rng)
    ahead.push(g.row)
    reach = g.reach
  }
  return {
    seed: seed >>> 0,
    rngState: state(),
    status: 'ready',
    beat: 0,
    lane: START_LANE,
    queue: ['stay', 'stay', 'stay'],
    pending: null,
    current: emptyRow(),
    ahead,
    reach,
    deathCause: null,
    lastEvent: 'none',
    lastTick: null,
  }
}

/** True on the beat whose tick shrinks the lag 4 → 3: this beat's input is refused. */
export function isInputLocked(s: LagState): boolean {
  return s.status === 'running' && delayForBeat(s.beat + 1) < s.queue.length
}

interface QueueStep {
  queue: Cmd[]
  cmd: Cmd
  kind: 'grow' | 'shrink' | 'same'
}

function stepQueue(queue: Cmd[], input: Cmd, n: number): QueueStep {
  const d = delayForBeat(n)
  if (queue.length < d) return { queue: [...queue, input], cmd: 'stay', kind: 'grow' }
  if (queue.length > d) return { queue: queue.slice(1), cmd: queue[0], kind: 'shrink' }
  const q = [...queue, input]
  return { queue: q.slice(1), cmd: q[0], kind: 'same' }
}

/** Where the already-committed queue will take you over the next queue.length beats. */
export function predictPath(s: LagState): Array<{ beat: number; lane: number; cmd: Cmd; fatal: boolean }> {
  const out: Array<{ beat: number; lane: number; cmd: Cmd; fatal: boolean }> = []
  let queue = s.queue
  let lane = s.lane
  const len = s.queue.length
  for (let k = 0; k < len; k++) {
    const n = s.beat + 1 + k
    const input: Cmd = k === 0 ? (s.pending ?? 'stay') : 'stay'
    const st = stepQueue(queue, input, n)
    queue = st.queue
    lane = applyCommand(lane, st.cmd).lane
    const row = s.ahead[k] ?? emptyRow()
    out.push({ beat: n, lane, cmd: st.cmd, fatal: isFatal(row[lane], st.cmd) })
  }
  return out
}

function tick(s: LagState): LagState {
  if (s.status !== 'running') return { ...s, lastEvent: 'none' }
  const n = s.beat + 1
  const input: Cmd = s.pending ?? 'stay'
  const st = stepQueue(s.queue, input, n)
  const cmd = st.cmd
  const from = s.lane
  const { lane: to, bumped } = applyCommand(from, cmd)
  const row = s.ahead[0]
  const cell = row[to]
  const info: TickInfo = {
    beat: n,
    cmd,
    from,
    to,
    bumped,
    jumped: cmd === 'jump',
    inputDropped: false,
    cell,
  }

  if (isFatal(cell, cmd)) {
    return {
      ...s,
      status: 'dead',
      lane: to,
      queue: st.queue,
      pending: null,
      current: row,
      deathCause: cell === 'hurdle' ? 'hurdle' : 'wall',
      lastEvent: 'dead',
      lastTick: info,
    }
  }

  const { rng, state } = rngFromState(s.rngState)
  const g = generateRow(s.reach, n + VIEW, rng)

  // Lag changes outrank 'stage': the 4 → 3 shrink always lands on a stage's
  // first beat, so 'stage' first would swallow every 'delay-down'. The UI reads
  // stage changes from lastTick.beat instead.
  let ev: LagEvent
  if (st.kind === 'grow') ev = 'delay-up'
  else if (st.kind === 'shrink') ev = 'delay-down'
  else if (stageForBeat(n) > stageForBeat(n - 1)) ev = 'stage'
  else if (bumped) ev = 'bump'
  else if (cmd === 'jump') ev = 'jump'
  else if (to !== from) ev = 'move'
  else ev = 'step'

  return {
    ...s,
    beat: n,
    lane: to,
    queue: st.queue,
    pending: null,
    current: row,
    ahead: [...s.ahead.slice(1), g.row],
    reach: g.reach,
    rngState: state(),
    lastEvent: ev,
    lastTick: info,
  }
}

export function reduce(s: LagState, a: LagAction): LagState {
  switch (a.type) {
    case 'new':
      return createGame(a.seed)
    case 'start':
      if (s.status === 'ready') return { ...s, status: 'running', lastEvent: 'start' }
      return { ...s, lastEvent: 'none' }
    case 'input': {
      if (s.status === 'dead') return { ...s, lastEvent: 'none' }
      const base: LagState = s.status === 'ready' ? { ...s, status: 'running' } : s
      if (isInputLocked(base)) return { ...base, lastEvent: 'locked' }
      return { ...base, pending: a.cmd, lastEvent: 'queued' }
    }
    case 'tick':
      return tick(s)
  }
}
