import { describe, expect, it } from 'vitest'
import {
  CELL,
  DWELL,
  FLAT_AFTER,
  FLAT_BEFORE,
  applySpill,
  createGame,
  generateTrack,
  idiv,
  isGlassCalm,
  liveDistance,
  mulberry32,
  reduce,
  scoreBreakdown,
  simulate,
  stepCart,
  stepLiquid,
  type SloshState,
  type Throttle,
} from './engine'

function unrle(runs: [number, number][]): Throttle[] {
  const out: Throttle[] = []
  for (const [th, n] of runs) for (let i = 0; i < n; i++) out.push(th as Throttle)
  return out
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o as object)) deepFreeze(v)
    Object.freeze(o)
  }
  return o
}

function withState(seed: number, patch: Partial<SloshState>): SloshState {
  return { ...createGame(seed), ...patch }
}

const tick = (s: SloshState) => reduce(s, { type: 'tick' })

const SEED1_RUN: [number, number][] = [
  [1, 99], [-1, 6], [1, 1], [-1, 25], [1, 204], [-1, 11], [1, 1], [-1, 19], [1, 1], [-1, 1],
  [1, 158], [-1, 17], [1, 1], [-1, 14], [1, 185], [-1, 5], [1, 1], [-1, 26],
]
const SEED42_RUN: [number, number][] = [
  [1, 126], [-1, 1], [1, 1], [-1, 29], [1, 1], [-1, 1], [1, 184], [-1, 11], [1, 1], [-1, 19], [1, 1],
  [-1, 1], [1, 173], [-1, 16], [1, 1], [-1, 14], [1, 1], [-1, 1], [1, 180], [-1, 20], [1, 1], [-1, 11],
]

describe('determinism & generation', () => {
  it('same seed → equal games', () => {
    expect(createGame(777)).toEqual(createGame(777))
  })

  it('mulberry32 is deterministic and seed-sensitive', () => {
    const a = mulberry32(1)
    const b = mulberry32(1)
    const c = mulberry32(2)
    const va = Array.from({ length: 5 }, a)
    expect(Array.from({ length: 5 }, b)).toEqual(va)
    expect(Array.from({ length: 5 }, c)).not.toEqual(va)
  })

  it('golden track seed 1', () => {
    const t = createGame(1).track
    expect(t.stations.map((s) => [s.target, s.kind])).toEqual([
      [40000, 'stop'],
      [112000, 'refill'],
      [161000, 'stop'],
      [224000, 'terminal'],
    ])
    expect(t.trackEnd).toBe(240000)
    expect(t.timeLimit).toBe(1600)
    expect(t.grades.join(',')).toBe('0,1,1,0,0,0,0,1,0,0,-1,0,0,0,0,1,-1,0,0,0,0,0,0,1,1,-1,0,0,0,0')
  })

  it('golden track seed 42', () => {
    const t = createGame(42).track
    expect(t.stations.map((s) => s.target)).toEqual([54000, 116000, 173000, 233000])
    expect(t.stations.map((s) => s.kind)).toEqual(['stop', 'refill', 'refill', 'terminal'])
    expect(t.trackEnd).toBe(249000)
    expect(t.timeLimit).toBe(1645)
    expect(t.grades.join(',')).toBe('0,0,-1,-1,0,0,0,0,1,0,1,-1,0,0,0,0,0,0,-1,1,0,0,0,1,-1,0,0,0,0,0,0,0')
  })

  it('golden track seed 12345', () => {
    const t = createGame(12345).track
    expect(t.stations.map((s) => s.target)).toEqual([50000, 116000, 167000, 232000])
    expect(t.stations.map((s) => s.kind)).toEqual(['refill', 'stop', 'refill', 'terminal'])
    expect(t.timeLimit).toBe(1640)
    expect(t.grades.join(',')).toBe('0,1,-1,-1,0,0,0,0,0,-1,-1,1,-1,0,0,0,0,0,0,0,0,0,0,1,-1,0,0,0,0,0,0')
  })

  it('generation invariants hold for seeds 0..199', () => {
    for (let seed = 0; seed < 200; seed++) {
      const t = createGame(seed).track
      const S = t.stations.length
      expect(S === 3 || S === 4).toBe(true)
      t.stations.forEach((st, i) => {
        expect(st.kind === 'terminal').toBe(i === S - 1)
        expect(st.legLen).toBeGreaterThanOrEqual(40000)
        expect(st.legLen).toBeLessThanOrEqual(72000)
        expect(st.legLen % 1000).toBe(0)
        if (i > 0) expect(st.target).toBeGreaterThan(t.stations[i - 1].target)
      })
      expect(t.stations.slice(0, -1).some((st) => st.kind === 'refill')).toBe(true)
      expect(t.grades[0]).toBe(0)
      expect(t.grades.length).toBe(Math.ceil(t.trackEnd / CELL))
      t.grades.forEach((g, c) => {
        for (const st of t.stations) {
          if (c * CELL < st.target + FLAT_AFTER && (c + 1) * CELL > st.target - FLAT_BEFORE) expect(g).toBe(0)
        }
      })
    }
  })

  it('consumes exactly 1 + 2S + n rng draws', () => {
    for (const seed of [1, 42, 12345, 9]) {
      let calls = 0
      const base = mulberry32(seed)
      const t = generateTrack(seed, () => {
        calls++
        return base()
      })
      expect(calls).toBe(1 + 2 * t.stations.length + t.grades.length)
    }
  })
})

describe('physics units', () => {
  it('accelerating pushes water back (negative)', () => {
    let th = 0
    let om = 0
    const seen: number[][] = []
    for (let i = 0; i < 5; i++) {
      ;({ theta: th, omega: om } = stepLiquid(th, om, 8))
      seen.push([th, om])
    }
    expect(seen).toEqual([
      [-48, -48],
      [-143, -95],
      [-284, -141],
      [-469, -185],
      [-695, -226],
    ])
  })

  it('braking pushes water forward', () => {
    let r = { theta: 0, omega: 0 }
    for (let i = 0; i < 5; i++) r = stepLiquid(r.theta, r.omega, -16)
    expect(r).toEqual({ theta: 1385, omega: 450 })
  })

  it('free oscillation swings to the other side with light damping', () => {
    let r = { theta: 8000, omega: 0 }
    for (let i = 0; i < 30; i++) r = stepLiquid(r.theta, r.omega, 0)
    expect(r).toEqual({ theta: -6823, omega: -2 })
  })

  it('steady acceleration settles at equilibrium', () => {
    let r = { theta: 0, omega: 0 }
    for (let i = 0; i < 3000; i++) r = stepLiquid(r.theta, r.omega, 8)
    expect(r.theta).toBe(-4460)
    expect(r.omega).toBe(0)
  })

  it('stepCart handles hills and clamps', () => {
    expect(stepCart(100, 0, 1)).toEqual({ v: 96, a: -4 })
    expect(stepCart(100, 0, -1).v).toBe(104)
    expect(stepCart(478, 1, 0)).toEqual({ v: 480, a: 2 })
    expect(stepCart(4, -1, 0)).toEqual({ v: 0, a: -4 })
  })

  it('applySpill clamps and drains', () => {
    expect(applySpill(8397, 407, 5)).toEqual({ theta: 8000, omega: 0, water: 0, spilled: 5 })
    const r = applySpill(-8100, -30, 10000)
    expect(r.theta).toBe(-8000)
    expect(r.water).toBe(9900)
    expect(applySpill(7999, 12, 50)).toEqual({ theta: 7999, omega: 12, water: 50, spilled: 0 })
  })

  it('idiv truncates toward zero and calm check', () => {
    expect(idiv(-7, 2)).toBe(-3)
    expect(idiv(7, 2)).toBe(3)
    expect(Object.is(idiv(-1, 2), 0)).toBe(true)
    expect(isGlassCalm(1500, 0)).toBe(true)
    expect(isGlassCalm(0, 151)).toBe(false)
  })
})

describe('reduce transitions', () => {
  it('ready ignores non-gas input and ticks', () => {
    let s = createGame(1)
    s = reduce(s, { type: 'input', throttle: 0 })
    s = reduce(s, { type: 'input', throttle: -1 })
    s = tick(s)
    expect(s.status).toBe('ready')
    expect(s.ticks).toBe(0)
    expect(s.x).toBe(0)
    expect(simulate(1, [0, -1, 0]).ticks).toBe(0)
  })

  it('gas starts the run', () => {
    const s = reduce(createGame(1), { type: 'input', throttle: 1 })
    expect(s.status).toBe('running')
    expect(s.lastEvent).toBe('start')
  })

  it('docks calmly at a stop', () => {
    const s = tick(withState(1, { status: 'running', x: 39996, v: 4, throttle: -1 }))
    expect(s.lastEvent).toBe('calm')
    expect(s.x).toBe(39996)
    expect(s.v).toBe(0)
    expect(s.theta).toBe(24)
    expect(s.omega).toBe(24)
    expect(s.results[0]).toMatchObject({ docked: true, offset: -4, accuracyPts: 499, calm: true, calmPts: 400 })
    expect(s.stationScore).toBe(899)
    expect(s.dwell).toBe(DWELL)
    expect(s.nextStation).toBe(1)
    expect(s.score).toBe(899)
    expect(liveDistance(s)).toBe(112000 - 39996)
  })

  it('dwell holds the cart, then it rolls again', () => {
    let s = tick(withState(1, { status: 'running', x: 39996, v: 4, throttle: -1 }))
    s = reduce(s, { type: 'input', throttle: 1 })
    for (let i = 0; i < 40; i++) {
      s = tick(s)
      expect(s.x).toBe(39996)
      expect(s.v).toBe(0)
    }
    expect(s.ticks).toBe(41)
    s = tick(s)
    expect(s.x).toBe(40004)
    expect(s.v).toBe(8)
  })

  it('refill station tops up water', () => {
    const s = tick(withState(1, { status: 'running', x: 112000, v: 8, throttle: -1, water: 9000, nextStation: 1 }))
    expect(s.water).toBe(10000)
    expect(s.results[0].refilled).toBe(1000)
    expect(s.results[0].accuracyPts).toBe(500)
    expect(s.results[0].calm).toBe(true)
  })

  it('overshooting a stop marks it missed', () => {
    const s = tick(withState(1, { status: 'running', x: 43990, v: 20, throttle: 0 }))
    expect(s.lastEvent).toBe('missed')
    expect(s.nextStation).toBe(1)
    expect(s.results[0]).toMatchObject({ docked: false, offset: 4010, accuracyPts: 0 })
    expect(s.status).toBe('running')
  })

  it('running dry ends the run', () => {
    const s = tick(withState(1, { status: 'running', water: 5, theta: 7990, omega: 500 }))
    expect(s.status).toBe('over')
    expect(s.loseReason).toBe('dry')
    expect(s.water).toBe(0)
    expect(s.ticks).toBe(1)
    expect(s.won).toBe(false)
    expect(s.score).toBe(0)
  })

  it('terminal dock wins with full breakdown', () => {
    const s = tick(
      withState(1, {
        status: 'running',
        x: 224000,
        v: 16,
        throttle: -1,
        nextStation: 3,
        ticks: 1000,
        results: [],
        stationScore: 0,
      }),
    )
    expect(s.won).toBe(true)
    expect(s.lastEvent).toBe('win')
    expect(s.ticks).toBe(1001)
    expect(scoreBreakdown(s)).toEqual({ accuracy: 500, calm: 400, water: 4000, time: 299, perfect: 0, total: 5199 })
    expect(s.score).toBe(5199)
  })

  it('over state is frozen', () => {
    const s = tick(withState(1, { status: 'running', water: 5, theta: 7990, omega: 500 }))
    expect(reduce(s, { type: 'input', throttle: 1 })).toEqual(s)
    expect(tick(s)).toEqual(s)
  })

  it('reduce is pure on deeply frozen state', () => {
    const base = withState(1, { status: 'running', x: 39996, v: 4, throttle: -1 })
    const snapshot = JSON.parse(JSON.stringify(base))
    const frozen = deepFreeze(base)
    expect(() => {
      reduce(frozen, { type: 'input', throttle: 1 })
      tick(frozen)
    }).not.toThrow()
    expect(JSON.parse(JSON.stringify(frozen))).toEqual(snapshot)
  })
})

describe('golden scenarios', () => {
  it('seed 1 full delivery', () => {
    const s = simulate(1, unrle(SEED1_RUN))
    expect(s.won).toBe(true)
    expect(s.x).toBe(224004)
    expect(s.v).toBe(0)
    expect(s.water).toBe(8662)
    expect(s.ticks).toBe(775)
    expect(s.stationScore).toBe(1996)
    expect(s.results.map((r) => r.offset)).toEqual([4, 4, -4, 4])
    expect(s.results.every((r) => !r.calm)).toBe(true)
    expect(s.score).toBe(5872)
  })

  it('seed 42 full delivery', () => {
    const s = simulate(42, unrle(SEED42_RUN))
    expect(s.won).toBe(true)
    expect(s.x).toBe(232996)
    expect(s.water).toBe(9196)
    expect(s.ticks).toBe(794)
    expect(s.stationScore).toBe(1997)
    expect(s.score).toBe(6100)
  })

  it('full throttle overruns the terminal', () => {
    const s = simulate(1, Array<Throttle>(5000).fill(1))
    expect(s.loseReason).toBe('overrun')
    expect(s.ticks).toBe(507)
    expect(s.x).toBe(228300)
    expect(s.v).toBe(480)
    expect(s.water).toBe(9932)
    expect(s.results).toHaveLength(3)
    expect(s.results.every((r) => !r.docked)).toBe(true)
    expect(s.score).toBe(0)
  })

  it('stalling times out', () => {
    const s = simulate(42, [...Array<Throttle>(5).fill(1), ...Array<Throttle>(3000).fill(-1)])
    expect(s.loseReason).toBe('timeout')
    expect(s.ticks).toBe(1645)
    expect(s.x).toBe(152)
    expect(s.water).toBe(10000)
    expect(s.score).toBe(0)
  })

  it('replays are reproducible and input-sensitive', () => {
    const inputs = unrle(SEED1_RUN)
    expect(simulate(1, inputs)).toEqual(simulate(1, inputs))
    const altered = unrle([[1, 98], ...SEED1_RUN.slice(1)])
    expect(simulate(1, altered)).not.toEqual(simulate(1, inputs))
  })
})
