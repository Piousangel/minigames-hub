import { describe, expect, it } from 'vitest'
import {
  BACKWARD_FROM_PHASE,
  COUNT_IN,
  MAX_PHASES,
  PAIR_POOL,
  PHASE_BEATS,
  STARTING_LIVES,
  type FizzAction,
  type FizzState,
  type PhaseRule,
  type Rng,
  type Side,
  beatTick,
  beatValue,
  buildPhaseStart,
  clickAt,
  createGame,
  expected,
  expectedAt,
  expectKey,
  generatePhases,
  mulberry32,
  multiplierFor,
  periodFor,
  reduce,
  windowFor,
} from './engine'

// ---------------------------------------------------------------- helpers

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b]
  return a
}

function started(seed = 1): FizzState {
  return reduce(createGame(seed), { type: 'start' })
}

function T(s: FizzState, j: number): number {
  return beatTick(s.phases, s.phaseStart, j)
}

function W(s: FizzState, j: number): number {
  return s.phases[Math.floor(j / PHASE_BEATS)].window
}

/** Tick until state.tick === target (collecting every state along the way). */
function tickTo(s: FizzState, target: number, log?: FizzState[]): FizzState {
  while (s.tick < target && s.status === 'running') {
    s = reduce(s, { type: 'tick' })
    log?.push(s)
  }
  return s
}

/** Presses every expected side at T(j), then ticks until the window closes. */
function runPerfect(s: FizzState, nBeats: number, log?: FizzState[]): FizzState {
  for (let n = 0; n < nBeats; n++) {
    const j = s.cursor
    s = tickTo(s, T(s, j), log)
    const exp = expectedAt(s, j)
    if (exp.L) s = reduce(s, { type: 'press', side: 'L' })
    if (exp.R) s = reduce(s, { type: 'press', side: 'R' })
    s = tickTo(s, T(s, j) + W(s, j) + 1, log)
  }
  return s
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o as object)) deepFreeze(v)
  }
  return o
}

/** Field snapshot without the per-call events. */
function core(s: FizzState) {
  const { events: _e, ...rest } = s
  void _e
  return rest
}

// ---------------------------------------------------------------- pure rules

describe('expected / expectKey', () => {
  it('1. 15 is LR under (3,5)', () => {
    expect(expectKey(expected(15, 3, 5))).toBe('LR')
  })
  it('2. 9 is L', () => {
    expect(expectKey(expected(9, 3, 5))).toBe('L')
  })
  it('3. 7 is silence', () => {
    expect(expectKey(expected(7, 3, 5))).toBe('')
  })
  it('4. 10 is R', () => {
    expect(expectKey(expected(10, 3, 5))).toBe('R')
  })
  it('5. phase 0 (1..30): 8 L, 4 R, 2 LR, 16 silent', () => {
    const counts: Record<string, number> = { '': 0, L: 0, R: 0, LR: 0 }
    for (let v = 1; v <= 30; v++) counts[expectKey(expected(v, 3, 5))]++
    expect(counts).toEqual({ '': 16, L: 8, R: 4, LR: 2 })
  })
})

describe('tempo', () => {
  it('6. periodFor values and monotone non-increasing', () => {
    expect(periodFor(0)).toBe(66)
    expect(periodFor(1)).toBe(62)
    expect(periodFor(8)).toBe(34)
    expect(periodFor(9)).toBe(32)
    expect(periodFor(50)).toBe(32)
    for (let k = 1; k < 200; k++) expect(periodFor(k)).toBeLessThanOrEqual(periodFor(k - 1))
  })
  it('7. windowFor and period >= 2W+2 for every phase', () => {
    expect(windowFor(66)).toBe(12)
    expect(windowFor(32)).toBe(9)
    for (let k = 0; k < 200; k++) {
      const p = periodFor(k)
      expect(p).toBeGreaterThanOrEqual(2 * windowFor(p) + 2)
    }
  })
  it('multiplierFor steps every 10 and caps at 8', () => {
    for (let s = 0; s <= 9; s++) expect(multiplierFor(s)).toBe(1)
    expect(multiplierFor(10)).toBe(2)
    expect(multiplierFor(70)).toBe(8)
    expect(multiplierFor(500)).toBe(8)
  })
})

describe('generatePhases', () => {
  it('8. consumes exactly 3*(count-1) rng calls', () => {
    let calls = 0
    const base = mulberry32(7)
    const counting: Rng = () => {
      calls++
      return base()
    }
    generatePhases(counting, 10)
    expect(calls).toBe(27)
    calls = 0
    generatePhases(counting, MAX_PHASES)
    expect(calls).toBe(297)
  })

  it('9. phases[0] is seed-independent (3,5,step1,+1,start1)', () => {
    for (const seed of [1, 2, 999]) {
      const p = createGame(seed).phases[0]
      expect([p.a, p.b, p.step, p.dir, p.start, p.pairIndex]).toEqual([3, 5, 1, 1, 1, 0])
    }
  })

  const many: PhaseRule[][] = []
  for (let seed = 1; seed <= 50; seed++) many.push(generatePhases(mulberry32(seed * 7919), MAX_PHASES))

  it('10. consecutive phases never repeat the divisor pair', () => {
    for (const phases of many) {
      for (let k = 1; k < phases.length; k++) expect(phases[k].pairIndex).not.toBe(phases[k - 1].pairIndex)
      for (const p of phases) expect([p.a, p.b]).toEqual([...PAIR_POOL[p.pairIndex]])
    }
  })

  it('11. every beat value is a positive integer', () => {
    const bad: number[] = []
    for (const phases of many) {
      for (let j = 0; j < phases.length * PHASE_BEATS; j++) {
        const v = beatValue(phases, j)
        if (!Number.isInteger(v) || v < 1) bad.push(v)
      }
    }
    expect(bad).toEqual([])
  })

  it('12. step is coprime with both divisors', () => {
    for (const phases of many) {
      for (const p of phases) {
        expect(gcd(p.step, p.a)).toBe(1)
        expect(gcd(p.step, p.b)).toBe(1)
      }
    }
  })

  it('13. early phases: forward only before phase 4, step 1 for k<=1', () => {
    let sawBackward = false
    for (const phases of many) {
      for (const p of phases) {
        if (p.index < BACKWARD_FROM_PHASE) expect(p.dir).toBe(1)
        if (p.index <= 1) expect(p.step).toBe(1)
        if (p.dir === -1) sawBackward = true
      }
    }
    expect(sawBackward).toBe(true)
  })

  it('14. createGame is deterministic per seed and varies across seeds', () => {
    expect(createGame(123).phases).toEqual(createGame(123).phases)
    const a = createGame(1).phases.slice(1)
    const b = createGame(2).phases.slice(1)
    expect(a).not.toEqual(b)
  })
})

describe('timing', () => {
  it('15. beatTick: count-in offset, phase boundary, strictly increasing', () => {
    const s = createGame(5)
    expect(T(s, 0)).toBe(264)
    expect(T(s, 29)).toBe(264 + 29 * 66)
    expect(T(s, 30)).toBe(34 * 66 + 4 * 62)
    for (let j = 1; j < MAX_PHASES * PHASE_BEATS; j++) expect(T(s, j)).toBeGreaterThan(T(s, j - 1))
    expect(s.phaseStart).toEqual(buildPhaseStart(s.phases))
    expect(s.phaseStart.length).toBe(MAX_PHASES + 1)
  })

  it('16. beatValue: forward climbs by step, backward descends to anchor+1', () => {
    const fwd: PhaseRule = { index: 0, pairIndex: 0, a: 3, b: 5, step: 7, dir: 1, start: 31, period: 66, window: 12 }
    const back: PhaseRule = { ...fwd, dir: -1, start: 31 + 7 * 29 }
    const phases = [fwd, back]
    for (let i = 1; i < 30; i++) expect(beatValue(phases, i) - beatValue(phases, i - 1)).toBe(7)
    for (let i = 31; i < 60; i++) expect(beatValue(phases, i) - beatValue(phases, i - 1)).toBe(-7)
    expect(beatValue(phases, 59)).toBe(31) // anchor (30) + 1
  })
})

// ---------------------------------------------------------------- reducer

describe('reduce: lifecycle', () => {
  it("17. 'ready' ignores tick/press; start → running with a count click; start again is a no-op", () => {
    const g = createGame(1)
    expect(g.status).toBe('ready')
    expect(core(reduce(g, { type: 'tick' }))).toEqual(core(g))
    const p = reduce(g, { type: 'press', side: 'L' })
    expect(core(p)).toEqual(core(g))
    expect(p.events.ignored).toBe(true)
    const s = reduce(g, { type: 'start' })
    expect(s.status).toBe('running')
    expect(s.tick).toBe(0)
    expect(s.events.click).toBe('count')
    const again = reduce(s, { type: 'start' })
    expect(core(again)).toEqual(core(s))
    expect(again.events.click).toBeNull()
  })

  it('23. count-in input is ignored; clicks at 0/66/132/198 are count, 264 is beat', () => {
    let s = started()
    const clicks: Array<[number, string]> = [[0, s.events.click as string]]
    for (let t = 1; t <= 264; t++) {
      s = reduce(s, { type: 'tick' })
      if (s.events.click) clicks.push([s.tick, s.events.click])
      if (t === 100) {
        const p = reduce(s, { type: 'press', side: 'L' })
        expect(p.events.ignored).toBe(true)
        expect(core(p)).toEqual(core(s))
      }
    }
    expect(clicks).toEqual([
      [0, 'count'],
      [66, 'count'],
      [132, 'count'],
      [198, 'count'],
      [264, 'beat'],
    ])
    const early = reduce(tickTo(started(), 264 - 13), { type: 'press', side: 'L' })
    expect(early.events.ignored).toBe(true)
  })

  it('click sequence of a whole phase is 4 counts + 30 beats, then the next phase starts', () => {
    const log: FizzState[] = []
    const s0 = started()
    const end = runPerfect(s0, 30, log)
    const tags = [s0, ...log].map((x) => x.events.click).filter(Boolean)
    expect(tags.filter((t) => t === 'count').length).toBe(COUNT_IN)
    expect(tags.filter((t) => t === 'beat').length).toBe(PHASE_BEATS)
    expect(clickAt(end, end.phaseStart[1])).toBe('count')
    expect(clickAt(end, end.phaseStart[1] + 4 * end.phases[1].period)).toBe('beat')
  })
})

describe('reduce: judging (golden)', () => {
  it('18. perfect phase 0 → score 830, 30 survived, one phaseChanged', () => {
    const log: FizzState[] = []
    const s = runPerfect(started(), 30, log)
    expect(s.score).toBe(830)
    expect(s.survived).toBe(30)
    expect(s.streak).toBe(30)
    expect(s.bestStreak).toBe(30)
    expect(s.hits).toBe(14)
    expect(s.rests).toBe(16)
    expect(s.lives).toBe(STARTING_LIVES)
    expect(s.cursor).toBe(30)
    expect(log.filter((x) => x.events.phaseChanged).length).toBe(1)
  })

  it('19. pressing on a silent beat (7) is an immediate wrong; further presses ignored', () => {
    let s = runPerfect(started(), 6)
    expect(s.cursor).toBe(6)
    expect(beatValue(s.phases, 6)).toBe(7)
    s = tickTo(s, T(s, 6))
    s = reduce(s, { type: 'press', side: 'L' })
    expect(s.events.judged).toBe('wrong')
    expect(s.events.judgedBeat).toBe(6)
    expect(s.lives).toBe(2)
    expect(s.streak).toBe(0)
    const r = reduce(s, { type: 'press', side: 'R' })
    expect(r.events.ignored).toBe(true)
    expect(r.lives).toBe(2)
    // closing the window doesn't double-judge
    const closed = tickTo(r, T(r, 6) + W(r, 6) + 1)
    expect(closed.lives).toBe(2)
    expect(closed.cursor).toBe(7)
    expect(closed.events.judged).toBeNull()
  })

  it('20. LR beat (15): only L → miss on close; L+R → hit', () => {
    const base = runPerfect(started(), 14)
    expect(beatValue(base.phases, 14)).toBe(15)
    const at = tickTo(base, T(base, 14))
    let partial = reduce(at, { type: 'press', side: 'L' })
    expect(partial.events.tap).toBe('L')
    partial = tickTo(partial, T(at, 14) + W(at, 14) + 1)
    expect(partial.events.judged).toBe('miss')
    expect(partial.lives).toBe(base.lives - 1)
    expect(partial.lastJudgment?.expected).toEqual({ L: true, R: true })

    let both = reduce(at, { type: 'press', side: 'L' })
    both = reduce(both, { type: 'press', side: 'R' })
    both = tickTo(both, T(at, 14) + W(at, 14) + 1)
    expect(both.events.judged).toBe('hit')
    expect(both.lives).toBe(base.lives)
  })

  it('21. mashing L+R on an L-only beat (9) makes the R press wrong', () => {
    let s = runPerfect(started(), 8)
    expect(beatValue(s.phases, 8)).toBe(9)
    s = tickTo(s, T(s, 8))
    s = reduce(s, { type: 'press', side: 'L' })
    expect(s.events.tap).toBe('L')
    s = reduce(s, { type: 'press', side: 'R' })
    expect(s.events.judged).toBe('wrong')
    expect(s.lives).toBe(2)
  })

  it('22. window edges: T±W valid, T±(W+1) ignored', () => {
    const base = runPerfect(started(), 2) // j=2 → value 3 (L)
    const t = T(base, 2)
    const w = W(base, 2)
    for (const at of [t - w, t + w]) {
      const s = reduce(tickTo(base, at), { type: 'press', side: 'L' })
      expect(s.events.tap).toBe('L')
    }
    const before = reduce(tickTo(base, t - w - 1), { type: 'press', side: 'L' })
    expect(before.events.ignored).toBe(true)
    expect(before.lives).toBe(3)
    // at T+W+1 the window has already closed (as a miss) and the cursor moved on
    const afterClose = tickTo(base, t + w + 1)
    expect(afterClose.cursor).toBe(3)
    const after = reduce(afterClose, { type: 'press', side: 'L' })
    expect(after.events.ignored).toBe(true)
    expect(after.lives).toBe(afterClose.lives)
  })

  it('24. silence on a sounding beat is a miss at T+W+1; silence on a silent beat is a rest', () => {
    const base = runPerfect(started(), 2)
    const t = T(base, 2)
    const w = W(base, 2)
    const pre = tickTo(base, t + w)
    expect(pre.events.judged).toBeNull()
    const miss = reduce(pre, { type: 'tick' })
    expect(miss.tick).toBe(t + w + 1)
    expect(miss.events.judged).toBe('miss')
    expect(miss.lives).toBe(2)

    const restBase = runPerfect(started(), 3) // j=3 → value 4 (silent)
    const scoreBefore = restBase.score
    const rest = tickTo(restBase, T(restBase, 3) + W(restBase, 3) + 1)
    expect(rest.events.judged).toBe('rest')
    expect(rest.score).toBeGreaterThan(scoreBefore)
    expect(rest.lives).toBe(3)
  })

  it('25. three mistakes → over; afterwards tick/press change nothing', () => {
    let s = started()
    let overEvents = 0
    while (s.status === 'running') {
      s = reduce(s, { type: 'tick' })
      if (s.events.over) overEvents++
    }
    // beats 1,2 silent (rest), 3 L (miss), 4 rest, 5 R (miss), 6 L (miss) → over
    expect(s.status).toBe('over')
    expect(overEvents).toBe(1)
    expect(s.lives).toBe(0)
    expect(s.mistakes).toBe(3)
    expect(s.cursor).toBe(5)
    const frozen = core(s)
    const t1 = reduce(s, { type: 'tick' })
    const p1 = reduce(t1, { type: 'press', side: 'R' })
    expect(core(t1)).toEqual(frozen)
    expect(core(p1)).toEqual(frozen)
    expect(p1.events.ignored).toBe(true)
  })

  it('a phase with a mistake earns the ×1 bonus (100), not ×2', () => {
    // Phase 0 with one miss on beat j=2 (value 3).
    let s = runPerfect(started(), 2)
    s = tickTo(s, T(s, 2) + W(s, 2) + 1) // miss
    expect(s.events.judged).toBe('miss')
    const log: FizzState[] = []
    s = runPerfect(s, 27, log)
    const bonusTick = log.find((x) => x.events.phaseChanged)!
    const prevScore = log[log.indexOf(bonusTick) - 1].score
    // the closing tick adds the last beat's points + bonus
    const beatPts = 10 * multiplierFor(bonusTick.streak)
    expect(bonusTick.score - prevScore).toBe(beatPts + 100)
    expect(bonusTick.phaseMistakes).toBe(0)
  })

  it('second phase uses its own divisors and the cursor/phase bookkeeping carries over', () => {
    const s = runPerfect(started(77), 60)
    expect(s.cursor).toBe(60)
    expect(s.survived).toBe(60)
    expect(s.lives).toBe(3)
    // phase 1 bonus doubled: 100*2*2 = 400 included
    expect(s.score).toBeGreaterThan(830 + 400)
  })
})

describe('determinism', () => {
  it('26. same seed + same input script → identical final state; reduce never mutates input', () => {
    const script: Array<[number, Side]> = [
      [264 + 2 * 66, 'L'], // 3 → hit
      [264 + 4 * 66 + 3, 'R'], // 5 → hit
      [264 + 5 * 66 - 5, 'L'], // 6 → hit
      [264 + 6 * 66, 'R'], // 7 → wrong
      [264 + 8 * 66 + 1, 'L'], // 9 → hit
      [264 + 8 * 66 + 2, 'R'], // 9 → wrong
    ]
    const play = (): FizzState => {
      let s = deepFreeze(reduce(deepFreeze(createGame(42)), { type: 'start' }))
      const actions: FizzAction[] = []
      for (let t = 1; t <= 264 + 9 * 66; t++) {
        actions.push({ type: 'tick' })
        for (const [at, side] of script) if (at === t) actions.push({ type: 'press', side })
      }
      for (const a of actions) {
        if (s.status !== 'running') break
        s = deepFreeze(reduce(s, a))
      }
      return s
    }
    const a = play()
    const b = play()
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.mistakes).toBe(2)
    expect(a.lives).toBe(1)
    expect(a.cursor).toBe(9)
    expect(a.hits).toBe(3)
  })
})

describe('reduce: resume (pause must not buy thinking time)', () => {
  /** Ticks from `s` until the next beat click, collecting every click tag on the way. */
  function clicksUntilBeat(s: FizzState): { s: FizzState; tags: string[] } {
    const tags: string[] = []
    for (let n = 0; n < 1000; n++) {
      s = reduce(s, { type: 'tick' })
      if (s.events.click) tags.push(s.events.click)
      if (s.events.click === 'beat') break
    }
    return { s, tags }
  }

  it('ready/over: resume is a no-op', () => {
    const g = createGame(1)
    expect(core(reduce(g, { type: 'resume' }))).toEqual(core(g))
  })

  it('during the count-in nothing was revealed: nothing is judged, the count-in restarts', () => {
    const s = tickTo(started(), 100)
    const r = reduce(deepFreeze(s), { type: 'resume' })
    expect(r.cursor).toBe(0)
    expect(r.lives).toBe(STARTING_LIVES)
    expect(r.lastJudgment).toBeNull()
    expect(r.events.click).toBe('count')
    expect(T(r, 0)).toBe(100 + COUNT_IN * 66)
    const { s: atBeat, tags } = clicksUntilBeat(r)
    expect(tags).toEqual(['count', 'count', 'count', 'beat'])
    expect(atBeat.tick).toBe(T(r, 0))
  })

  it('the beat on screen is forfeited: the previewed 3 can no longer be hit', () => {
    let s = runPerfect(started(), 2)
    expect(beatValue(s.phases, 2)).toBe(3)
    const t2 = T(s, 2)
    s = tickTo(s, t2 - 30) // "3" is on screen, its window is not open yet
    const r = reduce(deepFreeze(s), { type: 'resume' })
    expect(r.lives).toBe(STARTING_LIVES - 1)
    expect(r.lastJudgment).toMatchObject({ beat: 2, value: 3, kind: 'miss' })
    expect(r.events.judged).toBe('miss')
    expect(r.streak).toBe(0)
    expect(r.cursor).toBe(3)
    // fresh count-in before the first unseen beat (4)
    expect(r.events.click).toBe('count')
    expect(T(r, 3)).toBe(r.tick + COUNT_IN * 66)
    // the old window of beat 2 is gone: pressing there is ignored, not a hit
    const late = reduce(tickTo(r, t2), { type: 'press', side: 'L' })
    expect(late.events.ignored).toBe(true)
    expect(late.hits).toBe(s.hits)
    const { tags } = clicksUntilBeat(r)
    expect(tags).toEqual(['count', 'count', 'count', 'beat'])
  })

  it('inside the window: the current beat keeps what was pressed, the previewed next one is closed unpressed', () => {
    let s = runPerfect(started(), 2)
    s = tickTo(s, T(s, 2))
    s = reduce(s, { type: 'press', side: 'L' }) // 3 → L, correct
    const before = s.score
    const r = reduce(s, { type: 'resume' }) // next-number "4" (silent) was also on screen
    expect(r.cursor).toBe(4)
    expect(r.lives).toBe(STARTING_LIVES)
    expect(r.lastJudgment).toMatchObject({ beat: 3, kind: 'rest' })
    expect(r.score).toBeGreaterThan(before)
    expect(T(r, 4)).toBe(r.tick + COUNT_IN * 66)
  })

  it('a sounding previewed next beat cannot be dodged: it is a miss', () => {
    let s = runPerfect(started(), 1)
    s = tickTo(s, T(s, 1)) // "2" (silent) in its window, "3" previewed
    const r = reduce(s, { type: 'resume' })
    expect(r.cursor).toBe(3)
    expect(r.lives).toBe(STARTING_LIVES - 1)
    expect(r.rests).toBe(s.rests + 1)
    expect(r.events.judged).toBe('miss')
    expect(r.lastJudgment).toMatchObject({ beat: 2, kind: 'miss' })
  })

  it('forfeiting the last beat of a phase closes the phase and counts in the next one', () => {
    let s = runPerfect(started(), 29)
    s = tickTo(s, T(s, 29) - 20) // "30" (L+R) on screen
    const r = reduce(s, { type: 'resume' })
    expect(r.cursor).toBe(30)
    expect(r.events.phaseChanged).toBe(true)
    expect(r.phaseMistakes).toBe(0)
    expect(r.score).toBe(s.score + 100) // phase had a mistake → ×1 bonus
    expect(T(r, 30)).toBe(r.tick + COUNT_IN * r.phases[1].period)
    expect(r.events.click).toBe('count')
    expect(r.phaseStart[2] - r.phaseStart[1]).toBe(s.phaseStart[2] - s.phaseStart[1])
  })

  it('pausing again inside the resume count-in judges nothing more', () => {
    let s = runPerfect(started(), 2)
    s = tickTo(s, T(s, 2) - 30)
    let r = reduce(s, { type: 'resume' })
    r = tickTo(r, r.tick + 50)
    const r2 = reduce(r, { type: 'resume' })
    expect(r2.cursor).toBe(r.cursor)
    expect(r2.lives).toBe(r.lives)
    expect(T(r2, 3)).toBe(r2.tick + COUNT_IN * 66)
  })

  it('a forfeit that costs the last life ends the run', () => {
    let s = started()
    s = { ...s, lives: 1 }
    s = tickTo(runPerfect(s, 2), T(s, 2) - 30)
    const r = reduce(s, { type: 'resume' })
    expect(r.status).toBe('over')
    expect(r.events.over).toBe(true)
  })
})
