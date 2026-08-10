import { describe, expect, it } from 'vitest'
import {
  ABS_MIN_GAP,
  FIRST_ELIGIBLE_CYCLE,
  LIVES,
  MIN_GAP,
  ONBEAT_TOL,
  PERFECT_FRACTION,
  PUSH_TICKS,
  SCHEDULE_HORIZON,
  START_GAP,
  SYNCOPATION_COOLDOWN,
  WINDOW_MAX,
  WINDOW_MIN,
  classifyTap,
  gapEffective,
  gapNominal,
  generatePushSchedule,
  halfWindow,
  mulberry32,
  newGame,
  offbeatTick,
  pulseTick,
  step,
  tap,
  type Rng,
} from './engine'

const NO_PUSH: boolean[] = new Array(200).fill(false)

// ---------------------------------------------------------------------------
// A. Determinism / schedule generation
// ---------------------------------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic: same seed -> same sequence', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).toEqual(seqB)
  })
})

describe('generatePushSchedule', () => {
  it('consumes rng exactly `horizon` times', () => {
    let calls = 0
    const rng: Rng = () => {
      calls++
      return 0.99 // never triggers a push, isolates the call-count invariant
    }
    generatePushSchedule(rng, 123)
    expect(calls).toBe(123)
  })

  it('never pushes before FIRST_ELIGIBLE_CYCLE', () => {
    const schedule = generatePushSchedule(mulberry32(7), 100)
    for (let i = 0; i < FIRST_ELIGIBLE_CYCLE; i++) expect(schedule[i]).toBe(false)
  })

  it('keeps push indices more than SYNCOPATION_COOLDOWN apart, across seeds', () => {
    for (let seed = 0; seed < 10; seed++) {
      const schedule = generatePushSchedule(mulberry32(seed * 999 + 1), 300)
      let last = -Infinity
      for (let i = 0; i < schedule.length; i++) {
        if (!schedule[i]) continue
        expect(i - last).toBeGreaterThan(SYNCOPATION_COOLDOWN)
        last = i
      }
    }
  })

  it('matches a hardcoded golden schedule for a fixed seed', () => {
    const schedule = generatePushSchedule(mulberry32(424242), 40)
    const goldenTrueIndices = [6, 12, 22, 27, 38]
    const expected = new Array(40).fill(false)
    for (const i of goldenTrueIndices) expected[i] = true
    expect(schedule).toEqual(expected)
  })
})

// ---------------------------------------------------------------------------
// B. gap / pulseTick / offbeatTick / window
// ---------------------------------------------------------------------------

describe('gapNominal', () => {
  it('starts at START_GAP for cycle 0', () => {
    expect(gapNominal(0)).toBe(START_GAP)
  })

  it('floors at MIN_GAP for large cycles', () => {
    expect(gapNominal(1000)).toBe(MIN_GAP)
    expect(gapNominal(34)).toBe(MIN_GAP) // 48 - 34 = 14 = MIN_GAP exactly
    expect(gapNominal(35)).toBe(MIN_GAP) // would go below without the floor
  })
})

describe('gapEffective', () => {
  it('equals gapNominal when the cycle is not pushed', () => {
    for (const c of [0, 5, 20, 40]) {
      expect(gapEffective(c, NO_PUSH)).toBe(gapNominal(c))
    }
  })

  it('subtracts PUSH_TICKS when pushed, floored at ABS_MIN_GAP', () => {
    const schedule = [...NO_PUSH]
    schedule[0] = true
    expect(gapEffective(0, schedule)).toBe(START_GAP - PUSH_TICKS)

    // Extreme: nominal already at MIN_GAP, push would go below ABS_MIN_GAP without the clamp.
    const cAtFloor = 34 // gapNominal(34) === MIN_GAP === 14
    expect(gapNominal(cAtFloor)).toBe(MIN_GAP)
    const pushedSchedule = [...NO_PUSH]
    pushedSchedule[cAtFloor] = true
    expect(gapEffective(cAtFloor, pushedSchedule)).toBe(ABS_MIN_GAP) // 14-4=10 === ABS_MIN_GAP
  })
})

describe('pulseTick', () => {
  it('is 0 at cycle 0 and accumulates gapEffective for later cycles', () => {
    expect(pulseTick(0, NO_PUSH)).toBe(0)
    const expected3 = gapEffective(0, NO_PUSH) + gapEffective(1, NO_PUSH) + gapEffective(2, NO_PUSH)
    expect(pulseTick(3, NO_PUSH)).toBe(expected3)
  })

  it('advances by exactly gapEffective(c) from cycle c to c+1', () => {
    const schedule = generatePushSchedule(mulberry32(9), 50)
    for (let c = 0; c < 40; c++) {
      expect(pulseTick(c + 1, schedule)).toBe(pulseTick(c, schedule) + gapEffective(c, schedule))
    }
  })
})

describe('offbeatTick', () => {
  it('is always an integer strictly between pulseTick(c) and pulseTick(c+1)', () => {
    const schedule = generatePushSchedule(mulberry32(42), 60)
    for (let c = 0; c < 50; c++) {
      const p0 = pulseTick(c, schedule)
      const p1 = pulseTick(c + 1, schedule)
      const mid = offbeatTick(c, schedule)
      expect(Number.isInteger(mid)).toBe(true)
      expect(mid).toBeGreaterThan(p0)
      expect(mid).toBeLessThan(p1)
    }
  })
})

describe('halfWindow', () => {
  it('clamps into [WINDOW_MIN, WINDOW_MAX] at both gap extremes', () => {
    expect(halfWindow(ABS_MIN_GAP)).toBe(2) // floor(10*0.22)=2, within range
    expect(halfWindow(START_GAP)).toBe(WINDOW_MAX) // floor(48*0.22)=10, clamped to 8
    expect(halfWindow(ABS_MIN_GAP)).toBeGreaterThanOrEqual(WINDOW_MIN)
    expect(halfWindow(ABS_MIN_GAP)).toBeLessThanOrEqual(WINDOW_MAX)
  })

  it('regression: the good-zone never touches the onbeat-zone across cycles 0..50', () => {
    const schedule = generatePushSchedule(mulberry32(3), 60)
    for (let c = 0; c <= 50; c++) {
      const gap = gapEffective(c, schedule)
      const half = halfWindow(gap)
      expect(half).toBeLessThan(Math.floor(gap / 2) - ONBEAT_TOL)
    }
  })
})

// ---------------------------------------------------------------------------
// C. classifyTap
// ---------------------------------------------------------------------------

describe('classifyTap', () => {
  // cycle 0, no push: pStart=0, gap=48, pEnd=48, mid=24, half=8, perfectHalf=floor(8*0.4)=3
  const schedule = NO_PUSH
  const mid = offbeatTick(0, schedule)
  const half = halfWindow(gapEffective(0, schedule))
  const perfectHalf = Math.floor(half * PERFECT_FRACTION)

  it('classifies the exact midpoint as perfect', () => {
    expect(classifyTap(mid, 0, schedule)).toBe('perfect')
  })

  it('perfect at the +-perfectHalf boundary, good one tick beyond', () => {
    expect(classifyTap(mid + perfectHalf, 0, schedule)).toBe('perfect')
    expect(classifyTap(mid - perfectHalf, 0, schedule)).toBe('perfect')
    expect(classifyTap(mid + perfectHalf + 1, 0, schedule)).toBe('good')
    expect(classifyTap(mid - perfectHalf - 1, 0, schedule)).toBe('good')
  })

  it('good at the +-half boundary, early/late one tick beyond', () => {
    expect(classifyTap(mid + half, 0, schedule)).toBe('good')
    expect(classifyTap(mid - half, 0, schedule)).toBe('good')
    expect(classifyTap(mid + half + 1, 0, schedule)).toBe('late')
    expect(classifyTap(mid - half - 1, 0, schedule)).toBe('early')
  })

  it('classifies at/near the start pulse as onbeat', () => {
    const pStart = pulseTick(0, schedule)
    expect(classifyTap(pStart, 0, schedule)).toBe('onbeat')
    expect(classifyTap(pStart + ONBEAT_TOL, 0, schedule)).toBe('onbeat')
  })

  it('classifies at/near the end pulse as onbeat', () => {
    const pEnd = pulseTick(1, schedule)
    expect(classifyTap(pEnd, 0, schedule)).toBe('onbeat')
    expect(classifyTap(pEnd - ONBEAT_TOL, 0, schedule)).toBe('onbeat')
  })

  it('property: every integer tick in [pStart, pEnd] falls into exactly one category, no gaps', () => {
    const testSchedule = generatePushSchedule(mulberry32(55), 30)
    for (const c of [0, 5, 10, 15, 20]) {
      const pStart = pulseTick(c, testSchedule)
      const pEnd = pulseTick(c + 1, testSchedule)
      const seen = new Set(['perfect', 'good', 'early', 'late', 'onbeat'])
      for (let t = pStart; t <= pEnd; t++) {
        const outcome = classifyTap(t, c, testSchedule)
        expect(seen.has(outcome)).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// D. newGame / step / tap reducer behavior
// ---------------------------------------------------------------------------

describe('newGame', () => {
  it('has the expected initial shape', () => {
    const s = newGame(1)
    expect(s.tick).toBe(0)
    expect(s.cycle).toBe(0)
    expect(s.lives).toBe(LIVES)
    expect(s.score).toBe(0)
    expect(s.schedule.length).toBe(SCHEDULE_HORIZON)
    expect(s.over).toBe(false)
    expect(s.resolved).toBe(false)
    expect(s.combo).toBe(0)
    expect(s.bestCombo).toBe(0)
    expect(s.hits).toBe(0)
    expect(s.perfects).toBe(0)
  })

  it('same seed -> deep-equal schedule (golden reproducibility)', () => {
    const a = newGame(999)
    const b = newGame(999)
    expect(a.schedule).toEqual(b.schedule)
  })
})

describe('step', () => {
  it('before the boundary: cycle stays put, tick increments by 1 each call', () => {
    let s = newGame(2)
    const boundary = pulseTick(1, s.schedule)
    for (let i = 0; i < boundary - 1; i++) {
      s = step(s)
      expect(s.cycle).toBe(0)
      expect(s.tick).toBe(i + 1)
    }
  })

  it('with no tap(), reaching the boundary registers a miss exactly once', () => {
    let s = newGame(3)
    const boundary = pulseTick(1, s.schedule)
    for (let i = 0; i < boundary - 1; i++) s = step(s)
    expect(s.events.outcome).toBeNull()

    s = step(s) // this call crosses the boundary
    expect(s.events.outcome).toBe('miss')
    expect(s.lives).toBe(LIVES - 1)
    expect(s.combo).toBe(0)
    expect(s.events.cycleAdvanced).toBe(true)
    expect(s.cycle).toBe(1)

    // the very next call carries no leftover event
    s = step(s)
    expect(s.events.outcome).toBeNull()
    expect(s.events.cycleAdvanced).toBe(false)
  })

  it('never advances cycle by more than 1 per call', () => {
    let s = newGame(4)
    let prevCycle = s.cycle
    for (let i = 0; i < 500; i++) {
      s = step(s)
      expect(s.cycle - prevCycle).toBeLessThanOrEqual(1)
      prevCycle = s.cycle
    }
  })
})

describe('tap', () => {
  it('a perfect tap at mid: score matches hitScore math, combo/hits/perfects=1', () => {
    let s = newGame(5)
    const mid = offbeatTick(0, s.schedule)
    while (s.tick < mid) s = step(s)
    s = tap(s)
    expect(s.events.outcome).toBe('perfect')
    expect(s.combo).toBe(1)
    expect(s.hits).toBe(1)
    expect(s.perfects).toBe(1)
    expect(s.bestCombo).toBe(1)
    // BASE_HIT_SCORE(10) + PERFECT_BONUS(10) + comboBonus(min(20,1*2)=2) + speedBonus(floor((48-48)/4)=0)
    expect(s.score).toBe(22)
  })

  it('a hit followed by step() to the boundary: no penalty, cycle just advances', () => {
    let s = newGame(6)
    const mid = offbeatTick(0, s.schedule)
    while (s.tick < mid) s = step(s)
    s = tap(s)
    const scoreAfterHit = s.score
    const livesAfterHit = s.lives
    const boundary = pulseTick(1, s.schedule)
    while (s.tick < boundary) s = step(s)
    expect(s.score).toBe(scoreAfterHit)
    expect(s.lives).toBe(livesAfterHit)
    expect(s.cycle).toBe(1)
  })

  it('a second tap() in the same cycle is a complete no-op', () => {
    let s = newGame(8)
    const mid = offbeatTick(0, s.schedule)
    while (s.tick < mid) s = step(s)
    s = tap(s)
    const { score: scoreBefore, lives: livesBefore, combo: comboBefore } = s
    s = tap(s)
    expect(s.events.outcome).toBeNull()
    expect(s.score).toBe(scoreBefore)
    expect(s.lives).toBe(livesBefore)
    expect(s.combo).toBe(comboBefore)
  })

  it('over freezes tick and every subsequent step()/tap() is a no-op', () => {
    // Drive misses (no taps) until lives hit 0.
    let s = newGame(11)
    let guard = 0
    while (!s.over && guard < 10000) {
      s = step(s)
      guard++
    }
    expect(s.over).toBe(true)
    expect(s.lives).toBe(0)
    const frozenTick = s.tick
    const frozenScore = s.score

    const afterStep = step(s)
    expect(afterStep.tick).toBe(frozenTick)
    expect(afterStep.events.outcome).toBeNull()
    expect(afterStep.events.over).toBe(false) // over already true before this call -> not "this call"

    const afterTap = tap(afterStep)
    expect(afterTap.tick).toBe(frozenTick)
    expect(afterTap.score).toBe(frozenScore)
    expect(afterTap.events.outcome).toBeNull()
  })

  it('over flips to true only on the exact call that drains the last life', () => {
    let s = newGame(11)
    let sawOverEvent = false
    let guard = 0
    while (!s.over && guard < 10000) {
      const prevOver = s.over
      s = step(s)
      if (s.events.over) {
        expect(prevOver).toBe(false)
        expect(s.over).toBe(true)
        sawOverEvent = true
      }
      guard++
    }
    expect(sawOverEvent).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// E. Integration golden scenarios
// ---------------------------------------------------------------------------

describe('golden integration scenario', () => {
  it('20-cycle perfect play: score/hits/perfects/combo/lives match hand-computed totals', () => {
    let s = newGame(777)
    for (let c = 0; c < 20; c++) {
      const mid = offbeatTick(c, s.schedule)
      while (s.tick < mid) s = step(s)
      s = tap(s)
      const boundary = pulseTick(c + 1, s.schedule)
      while (s.tick < boundary) s = step(s)
    }
    expect(s.score).toBe(751)
    expect(s.hits).toBe(20)
    expect(s.perfects).toBe(20)
    expect(s.combo).toBe(20)
    expect(s.bestCombo).toBe(20)
    expect(s.lives).toBe(LIVES) // never missed
    expect(s.cycle).toBe(20)
  })

  it('score is monotonically non-decreasing even with failures mixed in', () => {
    let s = newGame(2024)
    let prevScore = s.score
    for (let c = 0; c < 40 && !s.over; c++) {
      const mid = offbeatTick(c, s.schedule)
      // Alternate: even cycles tap perfectly, odd cycles miss on purpose (no tap -> timeout).
      if (c % 2 === 0) {
        while (s.tick < mid) s = step(s)
        s = tap(s)
        expect(s.score).toBeGreaterThanOrEqual(prevScore)
        prevScore = s.score
      }
      const boundary = pulseTick(c + 1, s.schedule)
      while (s.tick < boundary && !s.over) {
        s = step(s)
        expect(s.score).toBeGreaterThanOrEqual(prevScore)
        prevScore = s.score
      }
    }
  })
})
