/**
 * Beatline — pure engine.
 *
 * A 4-lane rhythm game: notes fall down lanes and must be hit on the
 * judgement line at the right lane and the right tick. Judgement is pure
 * tick-integer lookup+compare — no timers, no `Date`, no `performance.now`,
 * and no `Math.random` anywhere outside chart generation.
 *
 * The full 5-stage chart is generated once in `createGame`, threading a
 * single `Rng` closure across stages in order (no per-stage re-seed). The
 * resulting `BeatlineState` never holds a function — every field is plain,
 * serializable data, so golden tests can `toEqual` it directly.
 */

export const LANES = 4
export const TICK_MS = 10 // reference real-ms-per-tick the component targets (engine doesn't know)

export const PERFECT_WINDOW_TICKS = 5 // ±50ms
export const GOOD_WINDOW_TICKS = 12 // ±120ms
export const MIN_GAP_TICKS = GOOD_WINDOW_TICKS + 1 // 13 — min tick gap chart-wide (any lane)
export const MIN_LANE_GAP_TICKS = 2 * GOOD_WINDOW_TICKS + 1 // 25 — min tick gap within the same lane

export const STARTING_LIVES = 4
export const MISS_LIFE_COST = 1

export const PERFECT_POINTS = 300
export const GOOD_POINTS = 100
export const MULTIPLIER_STEP = 10 // combo per +1 multiplier
export const MULTIPLIER_CAP = 5

export const STAGE_CLEAR_BONUS_UNIT = 200 // stage n clear bonus = UNIT * (stageIndex+1)
export const FULL_COMBO_BONUS = 500 // extra if that stage had zero misses
export const WIN_BONUS = 2500 // extra on clearing the final stage (run win)

export const MAX_GEN_SLOT_MULT = 40 // generateChart safety cap: slot attempts <= noteCount * this

export type Rng = () => number // returns a float in [0,1)
export type Judgement = 'perfect' | 'good' | 'miss'
export type NoteStatus = 'pending' | 'hit' | 'missed'

/** Immutable chart blueprint — generated once in createGame, never regenerated. */
export interface ChartNote {
  lane: number // 0..lanes-1
  tick: number // stage-local tick (stage start = 0)
}

/** Runtime note — blueprint + judgement state. */
export interface RuntimeNote extends ChartNote {
  status: NoteStatus
  judgement: Judgement | null
}

export interface StageConfig {
  bpm: number
  subdivision: number // how many candidate note slots per beat
  density: number // 0..1, probability a slot spawns a note
  noteCount: number // target note count for this stage
}

export interface BeatlineConfig {
  stages: StageConfig[]
  lanes: number // default LANES(4)
  lives: number // starting lives (default STARTING_LIVES)
}

export type BeatlineEvent = 'none' | 'perfect' | 'good' | 'miss' | 'stage-clear' | 'win' | 'lose'

export interface JudgementInfo {
  lane: number
  judgement: Judgement
  tick: number // state.tick at judgement time (miss-timeout: note.tick + GOOD_WINDOW_TICKS)
  comboAfter: number
}

export interface BeatlineState {
  config: BeatlineConfig
  seed: number

  stageCharts: ChartNote[][] // all stage blueprints, fixed at createGame
  stageIndex: number
  chart: RuntimeNote[] // runtime copy of the current stage (tick-ascending)
  cursor: number // index of the earliest possibly-'pending' note (scan cache)

  tick: number // current stage-local tick (resets to 0 on stage transition)

  combo: number
  bestCombo: number // run-wide max combo (survives stage boundaries)
  score: number

  lives: number
  perfects: number // run-wide cumulative
  goods: number // run-wide cumulative
  misses: number // run-wide cumulative
  stageMisses: number // current-stage cumulative (for full-combo bonus; reset on advance-stage)

  stageCleared: boolean // all notes in current stage resolved, not yet advanced
  won: boolean
  lost: boolean

  lastEvent: BeatlineEvent
  lastJudgement: JudgementInfo | null
}

export type BeatlineAction =
  | { type: 'tick'; tick: number } // absolute tick from the component, monotonic only
  | { type: 'press'; lane: number }
  | { type: 'advance-stage' }
  | { type: 'reset' }
  | { type: 'new'; seed: number }

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

export const DEFAULT_STAGES: StageConfig[] = [
  { bpm: 96, subdivision: 2, density: 0.35, noteCount: 20 },
  { bpm: 108, subdivision: 2, density: 0.4, noteCount: 24 },
  { bpm: 120, subdivision: 2, density: 0.45, noteCount: 28 },
  { bpm: 132, subdivision: 3, density: 0.45, noteCount: 32 },
  { bpm: 144, subdivision: 3, density: 0.5, noteCount: 36 },
]
export const DEFAULT_CONFIG: BeatlineConfig = { stages: DEFAULT_STAGES, lanes: LANES, lives: STARTING_LIVES }

// -- Pure primitives ---------------------------------------------------------

export function ticksPerBeat(bpm: number): number {
  return Math.round(60000 / bpm / TICK_MS)
}

export function judge(offsetTicks: number): Judgement | null {
  const abs = Math.abs(offsetTicks)
  if (abs <= PERFECT_WINDOW_TICKS) return 'perfect'
  if (abs <= GOOD_WINDOW_TICKS) return 'good'
  return null
}

export function multiplierFor(combo: number): number {
  return Math.min(MULTIPLIER_CAP, 1 + Math.floor(combo / MULTIPLIER_STEP))
}

export function pointsFor(judgement: Exclude<Judgement, 'miss'>): number {
  return judgement === 'perfect' ? PERFECT_POINTS : GOOD_POINTS
}

// -- Chart generation ---------------------------------------------------------

export function generateChart(stage: StageConfig, lanes: number, rng: Rng): ChartNote[] {
  const rawSlot = Math.round(ticksPerBeat(stage.bpm) / stage.subdivision)
  const slotTicks = Math.max(rawSlot, MIN_GAP_TICKS)

  const notes: ChartNote[] = []
  const lastLaneTick: (number | undefined)[] = new Array(lanes).fill(undefined)

  const maxSlots = stage.noteCount * MAX_GEN_SLOT_MULT
  let slot = 0
  while (notes.length < stage.noteCount && slot < maxSlots) {
    const tick = (slot + 1) * slotTicks
    const spawnRoll = rng()
    if (spawnRoll < stage.density) {
      const laneRoll = rng()
      let lane = Math.floor(laneRoll * lanes)
      let placed = false
      for (let attempt = 0; attempt < lanes; attempt++) {
        const last = lastLaneTick[lane]
        if (last === undefined || tick - last >= MIN_LANE_GAP_TICKS) {
          placed = true
          break
        }
        lane = (lane + 1) % lanes
      }
      if (placed) {
        notes.push({ lane, tick })
        lastLaneTick[lane] = tick
      }
    }
    slot++
  }

  return notes
}

export function createGame(config: BeatlineConfig, seed: number): BeatlineState {
  const rng = mulberry32(seed)
  const stageCharts = config.stages.map((s) => generateChart(s, config.lanes, rng))
  return {
    config,
    seed,
    stageCharts,
    stageIndex: 0,
    chart: toRuntime(stageCharts[0]),
    cursor: 0,
    tick: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    lives: config.lives,
    perfects: 0,
    goods: 0,
    misses: 0,
    stageMisses: 0,
    stageCleared: false,
    won: false,
    lost: false,
    lastEvent: 'none',
    lastJudgement: null,
  }
}

function toRuntime(notes: ChartNote[]): RuntimeNote[] {
  return notes.map((n) => ({ ...n, status: 'pending' as NoteStatus, judgement: null as Judgement | null }))
}

// -- Stage-clear resolution (shared by press/advanceTick) --------------------

function resolveStageIfCleared(state: BeatlineState): BeatlineState {
  if (state.lost) return state
  for (const n of state.chart) {
    if (n.status === 'pending') return state
  }
  const bonus =
    STAGE_CLEAR_BONUS_UNIT * (state.stageIndex + 1) + (state.stageMisses === 0 ? FULL_COMBO_BONUS : 0)
  const score = state.score + bonus
  const isLast = state.stageIndex === state.config.stages.length - 1
  if (isLast) {
    return { ...state, score: score + WIN_BONUS, won: true, lastEvent: 'win' }
  }
  return { ...state, score, stageCleared: true, lastEvent: 'stage-clear' }
}

// -- press --------------------------------------------------------------------

export function press(state: BeatlineState, lane: number): BeatlineState {
  if (state.won || state.lost || state.stageCleared) return { ...state, lastEvent: 'none' }
  if (lane < 0 || lane >= state.config.lanes) return { ...state, lastEvent: 'none' }

  let foundIdx = -1
  for (let i = state.cursor; i < state.chart.length; i++) {
    const n = state.chart[i]
    if (n.status === 'pending' && n.lane === lane && Math.abs(n.tick - state.tick) <= GOOD_WINDOW_TICKS) {
      foundIdx = i
      break
    }
  }

  if (foundIdx === -1) {
    const lives = state.lives - MISS_LIFE_COST
    const lost = lives <= 0
    const lastJudgement: JudgementInfo = {
      lane,
      judgement: 'miss',
      tick: state.tick,
      comboAfter: 0,
    }
    const missState: BeatlineState = {
      ...state,
      combo: 0,
      misses: state.misses + 1,
      stageMisses: state.stageMisses + 1,
      lives,
      lost,
      lastEvent: lost ? 'lose' : 'miss',
      lastJudgement,
    }
    return resolveStageIfCleared(missState)
  }

  const note = state.chart[foundIdx]
  const offset = state.tick - note.tick
  const j = judge(offset) as Exclude<Judgement, 'miss'>
  const mult = multiplierFor(state.combo)
  const score = state.score + pointsFor(j) * mult
  const chart = state.chart.slice()
  chart[foundIdx] = { ...note, status: 'hit', judgement: j }
  const combo = state.combo + 1
  const bestCombo = Math.max(state.bestCombo, combo)
  const perfects = state.perfects + (j === 'perfect' ? 1 : 0)
  const goods = state.goods + (j === 'good' ? 1 : 0)
  const lastJudgement: JudgementInfo = { lane, judgement: j, tick: state.tick, comboAfter: combo }

  const hitState: BeatlineState = {
    ...state,
    chart,
    score,
    combo,
    bestCombo,
    perfects,
    goods,
    lastEvent: j,
    lastJudgement,
  }
  return resolveStageIfCleared(hitState)
}

// -- advanceTick ----------------------------------------------------------------

export function advanceTick(state: BeatlineState, toTick: number): BeatlineState {
  if (state.won || state.lost || state.stageCleared) return { ...state, lastEvent: 'none' }
  if (toTick <= state.tick) return { ...state, lastEvent: 'none' }

  let chart = state.chart
  let cursor = state.cursor
  let combo = state.combo
  let misses = state.misses
  let stageMisses = state.stageMisses
  let lives = state.lives
  let lost = false
  let lastEvent: BeatlineEvent = 'none'
  let lastJudgement = state.lastJudgement
  let mutated = false

  while (cursor < chart.length) {
    const n = chart[cursor]
    if (n.status !== 'pending') {
      cursor++
      continue
    }
    if (n.tick + GOOD_WINDOW_TICKS >= toTick) break

    if (!mutated) {
      chart = chart.slice()
      mutated = true
    }
    chart[cursor] = { ...n, status: 'missed', judgement: 'miss' }
    combo = 0
    misses += 1
    stageMisses += 1
    lives -= MISS_LIFE_COST
    lastEvent = 'miss'
    lastJudgement = { lane: n.lane, judgement: 'miss', tick: n.tick + GOOD_WINDOW_TICKS, comboAfter: 0 }
    cursor++

    if (lives <= 0) {
      lost = true
      break
    }
  }

  if (lost) lastEvent = 'lose'

  const next: BeatlineState = {
    ...state,
    chart,
    cursor,
    combo,
    misses,
    stageMisses,
    lives,
    tick: toTick,
    lost,
    lastEvent,
    lastJudgement,
  }

  return lost ? next : resolveStageIfCleared(next)
}

// -- advanceStage ---------------------------------------------------------------

export function advanceStage(state: BeatlineState): BeatlineState {
  if (!state.stageCleared || state.won || state.lost) return { ...state, lastEvent: 'none' }
  const nextIndex = state.stageIndex + 1
  return {
    ...state,
    stageIndex: nextIndex,
    chart: toRuntime(state.stageCharts[nextIndex]),
    cursor: 0,
    tick: 0,
    stageMisses: 0,
    stageCleared: false,
    lastEvent: 'none',
  }
}

// -- Reducer ----------------------------------------------------------------

export function reduce(state: BeatlineState, action: BeatlineAction): BeatlineState {
  switch (action.type) {
    case 'tick':
      return advanceTick(state, action.tick)
    case 'press':
      return press(state, action.lane)
    case 'advance-stage':
      return advanceStage(state)
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    default:
      return state
  }
}
