import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  DEFAULT_STAGES,
  FULL_COMBO_BONUS,
  GOOD_POINTS,
  GOOD_WINDOW_TICKS,
  LANES,
  LEAD_IN_TICKS,
  MIN_GAP_TICKS,
  MIN_LANE_GAP_TICKS,
  MULTIPLIER_CAP,
  MULTIPLIER_STEP,
  PERFECT_POINTS,
  PERFECT_WINDOW_TICKS,
  STAGE_CLEAR_BONUS_UNIT,
  STARTING_LIVES,
  WIN_BONUS,
  advanceStage,
  advanceTick,
  createGame,
  generateChart,
  judge,
  multiplierFor,
  mulberry32,
  pointsFor,
  press,
  reduce,
  ticksPerBeat,
  type BeatlineConfig,
  type BeatlineState,
  type ChartNote,
  type RuntimeNote,
} from './engine'

// -- Helpers ------------------------------------------------------------------

function note(lane: number, tick: number): ChartNote {
  return { lane, tick }
}

function toRuntimeNotes(notes: ChartNote[]): RuntimeNote[] {
  return notes.map((n) => ({ ...n, status: 'pending', judgement: null }))
}

/** Hand-build a state from a single-stage chart (bypasses generateChart). */
function stateWith(chart: ChartNote[], overrides: Partial<BeatlineState> = {}): BeatlineState {
  const config: BeatlineConfig = { stages: [DEFAULT_STAGES[0]], lanes: LANES, lives: STARTING_LIVES }
  return {
    config,
    seed: 1,
    stageCharts: [chart],
    stageIndex: 0,
    chart: toRuntimeNotes(chart),
    cursor: 0,
    tick: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    lives: STARTING_LIVES,
    perfects: 0,
    goods: 0,
    misses: 0,
    stageMisses: 0,
    stageCleared: false,
    won: false,
    lost: false,
    lastEvent: 'none',
    lastJudgement: null,
    ...overrides,
  }
}

/** Multi-stage state for stage-transition tests. */
function multiStageState(charts: ChartNote[][], overrides: Partial<BeatlineState> = {}): BeatlineState {
  const config: BeatlineConfig = {
    stages: charts.map(() => DEFAULT_STAGES[0]),
    lanes: LANES,
    lives: STARTING_LIVES,
  }
  return {
    config,
    seed: 1,
    stageCharts: charts,
    stageIndex: 0,
    chart: toRuntimeNotes(charts[0]),
    cursor: 0,
    tick: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    lives: STARTING_LIVES,
    perfects: 0,
    goods: 0,
    misses: 0,
    stageMisses: 0,
    stageCleared: false,
    won: false,
    lost: false,
    lastEvent: 'none',
    lastJudgement: null,
    ...overrides,
  }
}

// -- Pure helpers -------------------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(777)
    const b = mulberry32(777)
    const seqA = [a(), a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })
})

describe('ticksPerBeat', () => {
  it('computes an exact known value', () => {
    // 60000 / 120 / TICK_MS(10) = 50
    expect(ticksPerBeat(120)).toBe(50)
  })
})

describe('judge', () => {
  it('classifies perfect / good / miss with inclusive boundaries, symmetric on sign', () => {
    expect(judge(0)).toBe('perfect')
    expect(judge(PERFECT_WINDOW_TICKS)).toBe('perfect')
    expect(judge(-PERFECT_WINDOW_TICKS)).toBe('perfect')
    expect(judge(PERFECT_WINDOW_TICKS + 1)).toBe('good')
    expect(judge(-(PERFECT_WINDOW_TICKS + 1))).toBe('good')
    expect(judge(GOOD_WINDOW_TICKS)).toBe('good')
    expect(judge(-GOOD_WINDOW_TICKS)).toBe('good')
    expect(judge(GOOD_WINDOW_TICKS + 1)).toBeNull()
    expect(judge(-(GOOD_WINDOW_TICKS + 1))).toBeNull()
  })
})

describe('multiplierFor', () => {
  it('steps every MULTIPLIER_STEP combo, capped at MULTIPLIER_CAP', () => {
    expect(multiplierFor(0)).toBe(1)
    expect(multiplierFor(9)).toBe(1)
    expect(multiplierFor(10)).toBe(2)
    expect(multiplierFor(19)).toBe(2)
    expect(multiplierFor(20)).toBe(3)
    expect(multiplierFor(39)).toBe(4)
    expect(multiplierFor(40)).toBe(5)
    expect(multiplierFor(9999)).toBe(MULTIPLIER_CAP)
    expect(MULTIPLIER_STEP).toBe(10)
  })
})

describe('pointsFor', () => {
  it('maps perfect/good to their point values', () => {
    expect(pointsFor('perfect')).toBe(PERFECT_POINTS)
    expect(pointsFor('good')).toBe(GOOD_POINTS)
    expect(PERFECT_POINTS).toBe(300)
    expect(GOOD_POINTS).toBe(100)
  })
})

// -- generateChart --------------------------------------------------------------

describe('generateChart', () => {
  const stage = DEFAULT_STAGES[0]

  it('is deterministic: two independent rng instances with the same seed produce identical charts', () => {
    const a = generateChart(stage, LANES, mulberry32(1))
    const b = generateChart(stage, LANES, mulberry32(1))
    expect(a).toEqual(b)
  })

  it('produces exactly noteCount notes for DEFAULT_STAGES[0] with seed 1 (no clamp)', () => {
    const chart = generateChart(stage, LANES, mulberry32(1))
    expect(chart.length).toBe(stage.noteCount)
  })

  it('is strictly ascending by tick', () => {
    const chart = generateChart(stage, LANES, mulberry32(1))
    for (let i = 1; i < chart.length; i++) {
      expect(chart[i].tick).toBeGreaterThan(chart[i - 1].tick)
    }
  })

  it('keeps every lane within [0, lanes)', () => {
    const chart = generateChart(stage, LANES, mulberry32(1))
    for (const n of chart) {
      expect(n.lane).toBeGreaterThanOrEqual(0)
      expect(n.lane).toBeLessThan(LANES)
    }
  })

  it('MAX_GEN_SLOT_MULT safety cap: a zero-density stage never places a note and terminates instead of looping forever', () => {
    const starvedStage = { ...stage, density: 0 }
    const chart = generateChart(starvedStage, LANES, mulberry32(1))
    // With density 0, spawnRoll < density is never true, so the loop must run
    // the full noteCount*MAX_GEN_SLOT_MULT slots and give up short of noteCount
    // rather than spin forever. This proves the cap is the actual exit condition.
    expect(chart.length).toBe(0)
    expect(chart.length).toBeLessThan(starvedStage.noteCount)
  })

  it('respects MIN_GAP_TICKS between any two adjacent notes', () => {
    const chart = generateChart(stage, LANES, mulberry32(1))
    for (let i = 1; i < chart.length; i++) {
      expect(chart[i].tick - chart[i - 1].tick).toBeGreaterThanOrEqual(MIN_GAP_TICKS)
    }
  })

  it('respects MIN_LANE_GAP_TICKS between consecutive same-lane notes', () => {
    const chart = generateChart(stage, LANES, mulberry32(1))
    for (let lane = 0; lane < LANES; lane++) {
      const laneNotes = chart.filter((n) => n.lane === lane)
      for (let i = 1; i < laneNotes.length; i++) {
        expect(laneNotes[i].tick - laneNotes[i - 1].tick).toBeGreaterThanOrEqual(MIN_LANE_GAP_TICKS)
      }
    }
  })
})

// -- createGame -----------------------------------------------------------------

describe('createGame', () => {
  it('initializes a fresh run', () => {
    const g = createGame(DEFAULT_CONFIG, 1)
    expect(g.stageIndex).toBe(0)
    expect(g.tick).toBe(0)
    expect(g.lives).toBe(STARTING_LIVES)
    expect(g.chart.length).toBe(g.stageCharts[0].length)
    for (const n of g.chart) expect(n.status).toBe('pending')
    expect(g.score).toBe(0)
    expect(g.combo).toBe(0)
    expect(g.won).toBe(false)
    expect(g.lost).toBe(false)
  })

  it('is deterministic across repeated calls with the same seed', () => {
    const a = createGame(DEFAULT_CONFIG, 42)
    const b = createGame(DEFAULT_CONFIG, 42)
    expect(a).toEqual(b)
  })

  it('produces different charts for different seeds', () => {
    const a = createGame(DEFAULT_CONFIG, 1)
    const b = createGame(DEFAULT_CONFIG, 2)
    expect(a.stageCharts[0]).not.toEqual(b.stageCharts[0])
  })
})

// -- press / advanceTick unit behavior -------------------------------------------

describe('press', () => {
  it('perfect hit exactly on the note tick', () => {
    const chart = [note(0, 50), note(1, 100)]
    let s = stateWith(chart)
    s = advanceTick(s, 50)
    s = press(s, 0)
    expect(s.lastJudgement?.judgement).toBe('perfect')
    expect(s.combo).toBe(1)
    expect(s.score).toBe(PERFECT_POINTS * 1)
    expect(s.chart[0].status).toBe('hit')
    expect(s.chart[0].judgement).toBe('perfect')
  })

  it('good hit at exactly the GOOD_WINDOW_TICKS boundary', () => {
    const chart = [note(0, 50), note(1, 200)]
    let s = stateWith(chart, { combo: 12 }) // multiplier 2 at combo=12
    s = advanceTick(s, 50 + GOOD_WINDOW_TICKS)
    s = press(s, 0)
    expect(s.lastJudgement?.judgement).toBe('good')
    expect(s.score).toBe(GOOD_POINTS * multiplierFor(12))
  })

  it('miss when no note is in-window for that lane: resets combo, costs a life, chart unchanged', () => {
    const chart = [note(0, 50), note(1, 200)]
    let s = stateWith(chart, { combo: 5, lives: 3 })
    s = advanceTick(s, 50)
    const before = s.chart
    s = press(s, 2) // lane 2 has no note anywhere
    expect(s.combo).toBe(0)
    expect(s.lives).toBe(2)
    expect(s.misses).toBe(1)
    expect(s.chart).toBe(before) // unchanged reference
  })

  it('out-of-range lane is a total no-op (defensive guard, unreachable via the 4-key UI but part of the API contract)', () => {
    const chart = [note(0, 50)]
    let s = stateWith(chart, { combo: 5, lives: 3 })
    s = advanceTick(s, 50)
    const before = s
    const negative = press(before, -1)
    expect(negative).toEqual({ ...before, lastEvent: 'none' })
    const tooHigh = press(before, before.config.lanes)
    expect(tooHigh).toEqual({ ...before, lastEvent: 'none' })
    // Crucially: no combo reset, no life lost, no miss counted — this is not a miss, it's rejected input.
    expect(negative.combo).toBe(before.combo)
    expect(negative.lives).toBe(before.lives)
    expect(negative.misses).toBe(before.misses)
  })

  it('miss that drains the last life sets lastEvent to lose (not miss)', () => {
    const chart = [note(0, 50), note(1, 200)]
    let s = stateWith(chart, { lives: 1 })
    s = advanceTick(s, 50)
    s = press(s, 2) // wrong lane -> miss, drains the last life
    expect(s.lives).toBe(0)
    expect(s.lost).toBe(true)
    expect(s.lastEvent).toBe('lose')
  })

  it('multiplier ramp-up golden sequence: 12 perfects across combo 0..11', () => {
    // 12 notes, each in a distinct lane cycling 0..3, spaced far enough apart, all offset 0.
    // Plus one sentinel note far in the future that is never pressed, so the chart never
    // fully resolves — otherwise the 12th hit would also trigger a stage-clear/win bonus,
    // polluting the expected pure-hit-points total below.
    const chart: ChartNote[] = []
    for (let i = 0; i < 12; i++) chart.push(note(i % LANES, (i + 1) * 200))
    chart.push(note(0, 100000))
    let s = stateWith(chart)
    let expectedScore = 0
    for (let i = 0; i < 12; i++) {
      const comboBefore = s.combo
      s = advanceTick(s, chart[i].tick)
      s = press(s, chart[i].lane)
      expectedScore += PERFECT_POINTS * multiplierFor(comboBefore)
      expect(s.score).toBe(expectedScore)
      expect(s.combo).toBe(comboBefore + 1)
    }
    expect(s.stageCleared).toBe(false)
    expect(s.won).toBe(false)
  })
})

describe('advanceTick', () => {
  it('toTick <= state.tick is a total no-op', () => {
    const chart = [note(0, 50)]
    const s = stateWith(chart, { tick: 30 })
    const next = advanceTick(s, 30)
    expect(next.lastEvent).toBe('none')
    expect(next.chart).toBe(s.chart)
    expect(next.tick).toBe(s.tick)
    expect(next.lives).toBe(s.lives)

    const next2 = advanceTick(s, 10)
    expect(next2).toEqual({ ...s, lastEvent: 'none' })
  })

  it('times out a pending note once its window fully closes', () => {
    const chart = [note(0, 50), note(1, 200)]
    let s = stateWith(chart, { lives: 3 })
    s = advanceTick(s, 50 + GOOD_WINDOW_TICKS + 1)
    expect(s.chart[0].status).toBe('missed')
    expect(s.combo).toBe(0)
    expect(s.lives).toBe(2)
    expect(s.misses).toBe(1)
    expect(s.lastEvent).toBe('miss')
  })

  it('fast-forward equivalence: many small ticks == one big tick', () => {
    // 6 notes; the last one's window is deliberately left open at the final
    // toTick so the chart never fully resolves (no stage-clear/win/lose
    // mid-script) — once the run goes terminal, advanceTick freezes `tick`
    // (guarded no-op), so a chunked driver and a single big jump would
    // legitimately diverge on where they stop. Keeping the run "live"
    // throughout keeps the equivalence well-defined and tests exactly what
    // it's meant to: many small ticks vs one big tick under ordinary
    // (non-terminal) progression.
    const chart: ChartNote[] = []
    for (let i = 0; i < 6; i++) chart.push(note(i % LANES, (i + 1) * 20))
    const finalTick = 125 // < chart[5].tick(120) + GOOD_WINDOW_TICKS(12) => note 5 stays pending

    // Script: hit even-indexed notes perfectly, let odd-indexed ones time out.
    function run(tickFn: (s: BeatlineState, toTick: number) => BeatlineState): BeatlineState {
      let s = stateWith(chart, { lives: 10 })
      for (let i = 0; i < chart.length; i++) {
        s = tickFn(s, chart[i].tick)
        if (i % 2 === 0) s = press(s, chart[i].lane)
      }
      s = tickFn(s, finalTick)
      return s
    }

    const bigJump = run((s, toTick) => advanceTick(s, toTick))
    const stepwise = run((s, toTick) => {
      let cur = s
      while (cur.tick < toTick) cur = advanceTick(cur, cur.tick + 1)
      return cur
    })

    // Sanity: the run must still be live (not terminal) for the equivalence to be well-defined.
    expect(bigJump.won || bigJump.lost || bigJump.stageCleared).toBe(false)
    expect(bigJump.chart[5].status).toBe('pending')

    expect(stepwise).toEqual(bigJump)
  })

  it('lose mid-loop freezes the remaining pending notes (no further processing)', () => {
    const chart = [note(0, 50), note(1, 100), note(2, 150)]
    let s = stateWith(chart, { lives: 1 })
    s = advanceTick(s, 200) // all three windows closed in one jump
    expect(s.lost).toBe(true)
    expect(s.lives).toBe(0)
    expect(s.lastEvent).toBe('lose')
    // Only the first note is processed before lives hit 0; the rest stay pending.
    expect(s.chart[0].status).toBe('missed')
    expect(s.chart[1].status).toBe('pending')
    expect(s.chart[2].status).toBe('pending')
  })
})

// -- Stage progression / win-lose ------------------------------------------------

describe('stage progression', () => {
  it('clearing a non-final stage sets stageCleared and adds the stage bonus (+ full combo bonus if flawless)', () => {
    const chart = [note(0, 50)]
    let s = multiStageState([chart, [note(0, 500)]])
    s = advanceTick(s, 50)
    s = press(s, 0)
    expect(s.stageCleared).toBe(true)
    expect(s.won).toBe(false)
    expect(s.lastEvent).toBe('stage-clear')
    const expectedBonus = STAGE_CLEAR_BONUS_UNIT * 1 + FULL_COMBO_BONUS
    expect(s.score).toBe(PERFECT_POINTS * 1 + expectedBonus)
  })

  it('advance-stage moves to the next stage with a fresh runtime chart, keeping run-wide counters', () => {
    const stage2Chart = [note(0, 500), note(1, 600)]
    let s = multiStageState([[note(0, 50)], stage2Chart])
    s = advanceTick(s, 50)
    s = press(s, 0)
    expect(s.stageCleared).toBe(true)
    const scoreBefore = s.score
    const livesBefore = s.lives
    const comboBefore = s.combo
    const bestComboBefore = s.bestCombo

    s = advanceStage(s)
    expect(s.stageIndex).toBe(1)
    expect(s.tick).toBe(0)
    expect(s.cursor).toBe(0)
    expect(s.stageMisses).toBe(0)
    expect(s.stageCleared).toBe(false)
    expect(s.chart).toEqual(toRuntimeNotes(stage2Chart))
    expect(s.score).toBe(scoreBefore)
    expect(s.lives).toBe(livesBefore)
    expect(s.combo).toBe(comboBefore)
    expect(s.bestCombo).toBe(bestComboBefore)
  })

  it('advance-stage is a no-op when stageCleared is false', () => {
    const s = multiStageState([[note(0, 50)], [note(0, 500)]])
    const next = advanceStage(s)
    expect(next).toEqual({ ...s, lastEvent: 'none' })
  })

  it('clearing the final stage wins immediately with the win bonus, no advance-stage needed', () => {
    const chart = [note(0, 50)]
    let s = multiStageState([[note(0, 500)], chart], { stageIndex: 1, chart: toRuntimeNotes(chart) })
    s = advanceTick(s, 50)
    s = press(s, 0)
    expect(s.won).toBe(true)
    expect(s.lastEvent).toBe('win')
    const expectedBonus = STAGE_CLEAR_BONUS_UNIT * 2 + FULL_COMBO_BONUS + WIN_BONUS
    expect(s.score).toBe(PERFECT_POINTS * 1 + expectedBonus)
  })

  it('loss priority: a fatal timeout on the last pending note of a stage loses, never clears/wins', () => {
    const chart = [note(0, 50)]
    let s = multiStageState([chart, [note(0, 500)]], { lives: 1 })
    s = advanceTick(s, 50 + GOOD_WINDOW_TICKS + 1)
    expect(s.lost).toBe(true)
    expect(s.won).toBe(false)
    expect(s.stageCleared).toBe(false)
    expect(s.lastEvent).toBe('lose')
  })

  it('terminal states freeze: further press/tick/advance-stage are no-ops', () => {
    const chart = [note(0, 50)]
    let s = multiStageState([chart], { lives: 1 })
    s = advanceTick(s, 50 + GOOD_WINDOW_TICKS + 1)
    expect(s.lost).toBe(true)
    const frozen = { ...s }

    const afterPress = press(s, 0)
    expect(afterPress).toEqual({ ...frozen, lastEvent: 'none' })

    const afterTick = advanceTick(s, 9999)
    expect(afterTick).toEqual({ ...frozen, lastEvent: 'none' })

    const afterAdvance = advanceStage(s)
    expect(afterAdvance).toEqual({ ...frozen, lastEvent: 'none' })
  })
})

// -- Reducer / reset --------------------------------------------------------------

describe('reduce', () => {
  it('reset reproduces createGame(config, seed) exactly, even after score/combo/lives were mutated', () => {
    let s = createGame(DEFAULT_CONFIG, 5)
    s = { ...s, score: 9999, combo: 40, lives: 1 }
    const reset = reduce(s, { type: 'reset' })
    expect(reset).toEqual(createGame(s.config, s.seed))
  })

  it('new seeds a different chart and resets counters to defaults', () => {
    const s = createGame(DEFAULT_CONFIG, 1)
    const next = reduce(s, { type: 'new', seed: 2 })
    expect(next.stageCharts).not.toEqual(s.stageCharts)
    expect(next.score).toBe(0)
    expect(next.lives).toBe(STARTING_LIVES)
    expect(next.combo).toBe(0)
  })

  it('dispatches tick/press/advance-stage to their respective pure functions', () => {
    const chart = [note(0, 50)]
    const s = stateWith(chart)
    const viaTick = reduce(s, { type: 'tick', tick: 50 })
    expect(viaTick).toEqual(advanceTick(s, 50))
    const viaPress = reduce(viaTick, { type: 'press', lane: 0 })
    expect(viaPress).toEqual(press(viaTick, 0))
  })
})

// -- Golden regression: default config, flawless full clear ----------------------

describe('golden regression: flawless full run on DEFAULT_CONFIG seed 1', () => {
  it('matches hand-computed score / combo / perfects / misses', () => {
    let s = createGame(DEFAULT_CONFIG, 1)

    // Sanity: every default stage generated exactly its target note count with this seed —
    // required for the hand-computed totals below to hold.
    const totalNotes = s.stageCharts.reduce((sum, c) => sum + c.length, 0)
    const expectedTotalNotes = DEFAULT_STAGES.reduce((sum, st) => sum + st.noteCount, 0)
    expect(totalNotes).toBe(expectedTotalNotes)

    for (let stageIdx = 0; stageIdx < s.stageCharts.length; stageIdx++) {
      const chart = s.stageCharts[stageIdx]
      for (const n of chart) {
        s = reduce(s, { type: 'tick', tick: n.tick })
        expect(Number.isInteger(s.score)).toBe(true)
        expect(s.score).toBeGreaterThanOrEqual(0)
        s = reduce(s, { type: 'press', lane: n.lane })
        expect(Number.isInteger(s.score)).toBe(true)
        expect(s.score).toBeGreaterThanOrEqual(0)
      }
      if (stageIdx < s.stageCharts.length - 1) {
        expect(s.stageCleared).toBe(true)
        s = reduce(s, { type: 'advance-stage' })
      }
    }

    expect(s.won).toBe(true)

    // Hand-computed expected totals (see spec §8 test 31):
    // hit points = sum over combo=0..139 of 300 * multiplierFor(combo)
    //   combo 0-9   (10 hits) * mult 1 = 3000
    //   combo 10-19 (10 hits) * mult 2 = 6000
    //   combo 20-29 (10 hits) * mult 3 = 9000
    //   combo 30-39 (10 hits) * mult 4 = 12000
    //   combo 40-139(100 hits)* mult 5 = 150000
    //   => 180000
    // stage-clear bonuses: 200+400+600+800+1000 = 3000, all flawless => +500*5 = 2500
    // win bonus: 2500
    // total = 180000 + 3000 + 2500 + 2500 = 188000
    expect(s.score).toBe(188000)
    expect(s.bestCombo).toBe(expectedTotalNotes)
    expect(s.perfects).toBe(expectedTotalNotes)
    expect(s.misses).toBe(0)
  })
})

// -- Lead-in (audit 2026-10-10: notes reached the line 310ms after load) ------

describe('lead-in', () => {
  it('LEAD_IN_TICKS covers a full on-screen travel (>= 150 ticks = 1.5s)', () => {
    expect(LEAD_IN_TICKS).toBeGreaterThanOrEqual(150)
  })

  it('every stage of every seed starts its first note no earlier than LEAD_IN_TICKS', () => {
    for (let seed = 0; seed < 200; seed++) {
      const g = createGame(DEFAULT_CONFIG, seed)
      for (const chart of g.stageCharts) {
        expect(chart.length).toBeGreaterThan(0)
        expect(chart[0].tick).toBeGreaterThanOrEqual(LEAD_IN_TICKS)
      }
    }
  })

  it('no life is lost before the first note can be judged', () => {
    const g = createGame(DEFAULT_CONFIG, 20261010)
    const s = advanceTick(g, LEAD_IN_TICKS)
    expect(s.lives).toBe(STARTING_LIVES)
    expect(s.misses).toBe(0)
  })
})
