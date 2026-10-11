import { describe, expect, it } from 'vitest'
import {
  ARC_FLOOR,
  ARC_NARROW,
  ARC_START,
  arcHalf,
  center,
  FLUTTER_MIN_GAP,
  FLUTTER_SPACING,
  GOOD_FRAC,
  gradeOffset,
  hueForRpm,
  inWindow,
  LIVES,
  MAX_DT,
  MIN_RPM,
  MISTIME_RPM_DELTA,
  NORMAL_SPACING,
  PERFECT_FRAC,
  newGame,
  offsetTurns,
  omega,
  mulberry32,
  START_RPM,
  step,
  tap,
  type FlywheelState,
  type Rng,
} from './engine'

const neverFlutter: Rng = () => 0.99
const alwaysFlutter: Rng = () => 0

/** Place the marker exactly at `off` turns from the current beat center. */
function atOffset(s: FlywheelState, off: number): FlywheelState {
  return { ...s, phase: center(s) + off }
}

describe('newGame', () => {
  it('returns start values', () => {
    const s = newGame()
    expect(s.rpm).toBe(START_RPM)
    expect(s.peakRpm).toBe(START_RPM)
    expect(s.lives).toBe(LIVES)
    expect(s.arcWidth).toBe(ARC_START)
    expect(s.status).toBe('pending')
    expect(s.over).toBe(false)
    expect(s.phase).toBe(0)
    expect(s.beatSpacing).toBe(NORMAL_SPACING)
    expect(center(s)).toBe(1)
  })
})

describe('pure helpers', () => {
  it('omega = rpm/60', () => {
    expect(omega(60)).toBeCloseTo(1)
    expect(omega(120)).toBeCloseTo(2)
  })
  it('center / offsetTurns / arcHalf / inWindow', () => {
    const s = newGame()
    expect(center(s)).toBe(1)
    expect(arcHalf(s)).toBeCloseTo(ARC_START / 2)
    const on = atOffset(s, 0)
    expect(offsetTurns(on)).toBeCloseTo(0)
    expect(inWindow(on)).toBe(true)
    const outside = atOffset(s, ARC_START) // beyond half
    expect(inWindow(outside)).toBe(false)
  })
})

describe('gradeOffset', () => {
  const arc = 0.2
  it('grades perfect / good / mistime bands at boundaries', () => {
    expect(gradeOffset(0, arc)).toBe('perfect')
    expect(gradeOffset(PERFECT_FRAC * arc, arc)).toBe('perfect') // exactly ±PERFECT_FRAC
    expect(gradeOffset(PERFECT_FRAC * arc + 1e-9, arc)).toBe('good')
    expect(gradeOffset(GOOD_FRAC * arc, arc)).toBe('good') // exactly ±GOOD_FRAC
    expect(gradeOffset(GOOD_FRAC * arc + 1e-9, arc)).toBe('late')
    expect(gradeOffset(0.45 * arc, arc)).toBe('late')
  })
  it('sign selects early vs late and is symmetric in band', () => {
    expect(gradeOffset(-0.45 * arc, arc)).toBe('early')
    expect(gradeOffset(0.45 * arc, arc)).toBe('late')
    const mid = ((PERFECT_FRAC + GOOD_FRAC) / 2) * arc
    expect(gradeOffset(-mid, arc)).toBe(gradeOffset(mid, arc))
  })
})

describe('tap grading', () => {
  it('perfect → +2 rpm, peak/newPeak, status hit, hits/perfects++', () => {
    const s = atOffset(newGame(), 0)
    const r = tap(s)
    expect(r.rpm).toBe(START_RPM + 2)
    expect(r.peakRpm).toBe(START_RPM + 2)
    expect(r.events.newPeak).toBe(true)
    expect(r.events.grade).toBe('perfect')
    expect(r.status).toBe('hit')
    expect(r.hits).toBe(1)
    expect(r.perfects).toBe(1)
  })

  it('good → rpm unchanged, status hit, perfects unchanged', () => {
    const s = atOffset(newGame(), ((PERFECT_FRAC + GOOD_FRAC) / 2) * ARC_START) // inside good band
    const r = tap(s)
    expect(r.events.grade).toBe('good')
    expect(r.rpm).toBe(START_RPM)
    expect(r.status).toBe('hit')
    expect(r.perfects).toBe(0)
  })

  it('early/late in-window → MISTIME_RPM_DELTA, floored at MIN_RPM', () => {
    const late = tap(atOffset(newGame(), 0.45 * ARC_START))
    expect(late.events.grade).toBe('late')
    expect(late.rpm).toBe(START_RPM + MISTIME_RPM_DELTA)
    const base = { ...newGame(), rpm: MIN_RPM }
    const s = atOffset(base, 0.45 * ARC_START) // mistime (late)
    const r = tap(s)
    expect(r.events.grade).toBe('late')
    expect(r.rpm).toBe(MIN_RPM) // clamped to floor
    // A second mistime from a floor state never dips below the floor.
    const s2 = atOffset({ ...r, status: 'pending' }, -0.45 * ARC_START)
    const r2 = tap(s2)
    expect(r2.events.grade).toBe('early')
    expect(r2.rpm).toBe(MIN_RPM)
  })

  it('early whiff (before window) → whiff event, whiffed status, no rpm/life change', () => {
    const s = atOffset(newGame(), -arcHalf(newGame()) - 0.05)
    const r = tap(s)
    expect(r.events.whiff).toBe(true)
    expect(r.status).toBe('whiffed')
    expect(r.rpm).toBe(START_RPM)
    expect(r.lives).toBe(LIVES)
    // A subsequent step past the exit resolves it as a miss (life lost).
    const exited = step({ ...r, phase: center(r) + arcHalf(r) + 0.01 }, MAX_DT, neverFlutter)
    expect(exited.events.missed).toBe(true)
    expect(exited.lives).toBe(LIVES - 1)
  })

  it('ignored when status !== pending (double tap) and when over', () => {
    const first = tap(atOffset(newGame(), 0))
    expect(first.status).toBe('hit')
    const second = tap(atOffset(first, 0)) // still status hit
    expect(second.rpm).toBe(first.rpm)
    expect(second.hits).toBe(first.hits)
    const dead = { ...newGame(), over: true }
    const t = tap(atOffset(dead, 0))
    expect(t.rpm).toBe(dead.rpm)
    expect(t.events.grade).toBe(null)
  })
})

describe('arc narrowing', () => {
  it('narrows every HITS_PER_NARROW hits and never below ARC_FLOOR', () => {
    let s = newGame()
    // Simulate 8 perfect hits by re-arming status each time.
    for (let i = 0; i < 8; i++) {
      s = tap(atOffset({ ...s, status: 'pending' }, 0))
    }
    expect(s.arcWidth).toBeCloseTo(ARC_START * ARC_NARROW)
    for (let i = 0; i < 8; i++) {
      s = tap(atOffset({ ...s, status: 'pending' }, 0))
    }
    expect(s.arcWidth).toBeCloseTo(ARC_START * ARC_NARROW * ARC_NARROW)
    // Hammer many more hits — arc clamps at the floor.
    for (let i = 0; i < 400; i++) {
      s = tap(atOffset({ ...s, status: 'pending' }, 0))
    }
    expect(s.arcWidth).toBe(ARC_FLOOR)
  })
})

describe('step advancement & resolution', () => {
  it('advances phase by omega*dt and does not resolve below exit', () => {
    const s = newGame()
    const r = step(s, 0.02, neverFlutter)
    expect(r.phase).toBeCloseTo(omega(START_RPM) * 0.02)
    expect(r.status).toBe('pending')
    expect(r.beatStartPhase).toBe(0)
    expect(r.lives).toBe(LIVES)
  })

  it('miss path: pending beat exits → life lost, beatStartPhase advances, phase monotonic', () => {
    const s = { ...newGame(), phase: center(newGame()) + arcHalf(newGame()) }
    const oldCenter = center(s)
    const r = step(s, MAX_DT, neverFlutter)
    expect(r.events.missed).toBe(true)
    expect(r.lives).toBe(LIVES - 1)
    expect(r.beatStartPhase).toBeCloseTo(oldCenter)
    expect(r.status).toBe('pending')
    expect(r.phase).toBeGreaterThan(s.phase) // monotonic
  })

  it('hit beat exits → no life lost, cadence advances', () => {
    const hit = tap(atOffset(newGame(), 0))
    const s = { ...hit, phase: center(hit) + arcHalf(hit) }
    const oldCenter = center(s)
    const r = step(s, MAX_DT, neverFlutter)
    expect(r.events.missed).toBe(false)
    expect(r.lives).toBe(LIVES)
    expect(r.beatStartPhase).toBeCloseTo(oldCenter)
    expect(r.status).toBe('pending')
  })

  it('lives to 0 → over + event, subsequent step/tap are no-ops', () => {
    let s: FlywheelState = { ...newGame(), lives: 1 }
    s = { ...s, phase: center(s) + arcHalf(s) + 0.001 }
    const r = step(s, MAX_DT, neverFlutter)
    expect(r.over).toBe(true)
    expect(r.events.over).toBe(true)
    expect(r.lives).toBe(0)
    const again = step(r, MAX_DT, neverFlutter)
    expect(again).toBe(r) // exact same reference: no-op
    const t = tap(atOffset(r, 0))
    expect(t.rpm).toBe(r.rpm)
  })
})

describe('dt clamping', () => {
  it('dt=10 behaves as dt=MAX_DT for phase advance', () => {
    const s = newGame()
    const big = step(s, 10, neverFlutter)
    const expectedPhase = omega(START_RPM) * MAX_DT
    // With MAX_DT the beat (center 1.0) is not reached; phase == omega*MAX_DT.
    expect(big.phase).toBeCloseTo(expectedPhase)
  })
  it('dt<=0 is a no-op with cleared events', () => {
    const s = { ...newGame(), phase: 0.5 }
    const r = step(s, 0, neverFlutter)
    expect(r.phase).toBe(0.5)
    expect(r.events.missed).toBe(false)
  })
})

describe('flutter scheduling', () => {
  it('fires only after FLUTTER_MIN_GAP beats and resets the counter', () => {
    // Drive many normal beats; count flutters and where the first appears.
    let s = newGame()
    const dt = 1 / 60
    let beats = 0
    let firstFlutterBeat = -1
    // Each beat is ~1 turn at 40rpm; step in small dt and resolve as hits.
    for (let frame = 0; frame < 200000 && beats < FLUTTER_MIN_GAP + 2; frame++) {
      // keep tapping perfect whenever in-window & pending
      if (s.status === 'pending' && inWindow(s)) s = tap(s)
      const before = s.beatStartPhase
      s = step(s, dt, alwaysFlutter)
      if (s.beatStartPhase !== before) {
        beats += 1
        if (s.isFlutter && firstFlutterBeat < 0) firstFlutterBeat = beats
      }
      if (s.over) break
    }
    // With alwaysFlutter, the first flutter must land exactly at beat FLUTTER_MIN_GAP.
    expect(firstFlutterBeat).toBe(FLUTTER_MIN_GAP)
  })

  it('flutter sets spacing/isFlutter/flutterStarted and resets beatsSinceFlutter', () => {
    // Hand-craft a state one frame from resolving with the counter primed.
    const g = newGame()
    const primed: FlywheelState = {
      ...g,
      beatsSinceFlutter: FLUTTER_MIN_GAP - 1,
      status: 'hit',
      phase: center(g) + arcHalf(g),
    }
    const r = step(primed, MAX_DT, alwaysFlutter)
    expect(r.isFlutter).toBe(true)
    expect(r.beatSpacing).toBe(FLUTTER_SPACING)
    expect(r.events.flutterStarted).toBe(true)
    expect(r.beatsSinceFlutter).toBe(0)
  })

  it('never flutters with rng=0.99 even past the gap', () => {
    const primed: FlywheelState = {
      ...newGame(),
      beatsSinceFlutter: FLUTTER_MIN_GAP + 5,
      status: 'hit',
      phase: center(newGame()) + arcHalf(newGame()),
    }
    const r = step(primed, MAX_DT, neverFlutter)
    expect(r.isFlutter).toBe(false)
    expect(r.beatSpacing).toBe(NORMAL_SPACING)
    expect(r.events.flutterStarted).toBe(false)
  })
})

describe('determinism', () => {
  it('two runs with same seed + identical dt/tap script produce identical state', () => {
    const script = (rng: Rng): FlywheelState => {
      let s = newGame()
      const dt = 1 / 60
      for (let i = 0; i < 5000; i++) {
        // Deterministic tap policy: perfect-tap whenever pending & in-window.
        if (s.status === 'pending' && inWindow(s)) s = tap(s)
        s = step(s, dt, rng)
        if (s.over) break
      }
      return s
    }
    const a = script(mulberry32(12345))
    const b = script(mulberry32(12345))
    expect(a).toEqual(b)
  })
})

describe('hueForRpm', () => {
  it('clamps both ends and is monotonic decreasing', () => {
    expect(hueForRpm(0)).toBeCloseTo(210) // below range clamps to blue
    expect(hueForRpm(40)).toBeCloseTo(210)
    expect(hueForRpm(220)).toBeCloseTo(20)
    expect(hueForRpm(999)).toBeCloseTo(20) // above range clamps to orange
    expect(hueForRpm(130)).toBeGreaterThan(hueForRpm(200))
    expect(hueForRpm(60)).toBeGreaterThan(hueForRpm(130))
  })
})

/**
 * Simulated human: taps every beat with a Gaussian timing error of `sigmaMs`
 * around the zone center. Returns the run's final and peak rpm after `beats`
 * beats (or earlier game over). Pure: drives only tap()/step().
 */
function simulateRun(seed: number, sigmaMs: number, beats: number): { rpm: number; peak: number; over: boolean } {
  const rand = mulberry32(seed)
  const gauss = () => {
    const u = Math.max(1e-12, rand())
    const v = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const flutterRng = mulberry32(seed ^ 0x9e3779b9)
  let s = newGame()
  for (let b = 0; b < beats && !s.over; b++) {
    const errTurns = (gauss() * sigmaMs * omega(s.rpm)) / 1000
    s = tap(atOffset(s, errTurns))
    // Jump past this beat's exit; the next step resolves it.
    s = step({ ...s, phase: center(s) + arcHalf(s) + 1e-6 }, 1e-6, flutterRng)
  }
  return { rpm: s.rpm, peak: s.peakRpm, over: s.over }
}

describe('timing windows are humane (audit: ±18ms perfect made rpm decay to MIN_RPM)', () => {
  it('a decent player (σ=45ms) speeds the wheel up instead of sinking to MIN_RPM', () => {
    const N = 300
    let finalSum = 0
    let peakSum = 0
    for (let seed = 1; seed <= N; seed++) {
      const r = simulateRun(seed, 45, 60)
      finalSum += r.rpm
      peakSum += r.peak
    }
    const meanFinal = finalSum / N
    const meanPeak = peakSum / N
    expect(meanFinal).toBeGreaterThan(START_RPM + 10)
    expect(meanPeak).toBeGreaterThan(START_RPM + 15)
  })

  it('a sloppy player (σ=110ms) does not run away — skill still matters', () => {
    const N = 300
    let finalSum = 0
    for (let seed = 1; seed <= N; seed++) finalSum += simulateRun(seed, 110, 60).rpm
    const sloppy = finalSum / N
    let goodSum = 0
    for (let seed = 1; seed <= N; seed++) goodSum += simulateRun(seed, 30, 60).rpm
    const sharp = goodSum / N
    expect(sharp).toBeGreaterThan(sloppy + 15)
  })

  it('at 40rpm the perfect window is at least ±45ms and good at least ±100ms', () => {
    const msPerTurn = 1000 / omega(START_RPM)
    expect(PERFECT_FRAC * ARC_START * msPerTurn).toBeGreaterThanOrEqual(45)
    expect(GOOD_FRAC * ARC_START * msPerTurn).toBeGreaterThanOrEqual(100)
  })
})
