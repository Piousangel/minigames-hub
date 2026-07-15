import { describe, expect, it } from 'vitest'
import {
  BASE_POP,
  BUOY_R,
  BUOY_SWELLS,
  COMBO_WINDOW,
  FIELD_W,
  INITIAL_BUOYS,
  MAX_DROWN,
  MAX_RINGS,
  PERFECT_SWEEP_BONUS,
  PERFECT_SWEEP_N,
  RING_MAX_R,
  RING_SPEED,
  SWELL_PERIOD_BASE,
  buoysPerSwell,
  comboMult,
  dist,
  levelFor,
  mulberry32,
  newGame,
  previewSweep,
  spawnBuoy,
  step,
  swellPeriodFor,
  type Buoy,
  type RippleState,
} from './engine'

const emptyEvents = () => ({
  droppedRing: false,
  pops: [],
  perfectSweeps: 0,
  swell: false,
  drowns: 0,
  over: false,
})

const B = (partial: Partial<Buoy> = {}): Buoy => ({
  id: 0,
  x: 200,
  y: 200,
  vx: 0,
  vy: 0,
  colorIndex: 0,
  swellsLeft: BUOY_SWELLS,
  ...partial,
})

const S = (partial: Partial<RippleState> = {}): RippleState => ({
  rings: [],
  buoys: [],
  score: 0,
  popped: 0,
  drowned: 0,
  chain: 0,
  comboMeter: 0,
  swellTimer: SWELL_PERIOD_BASE,
  level: 0,
  nextRingId: 0,
  nextBuoyId: 0,
  over: false,
  events: emptyEvents(),
  ...partial,
})

const rng = () => 0.5
const noDrop = { dt: 1, drop: null }

describe('newGame', () => {
  it('starts with INITIAL_BUOYS buoys and zeroed counters', () => {
    const s = newGame(rng)
    expect(s.buoys).toHaveLength(INITIAL_BUOYS)
    expect(s.score).toBe(0)
    expect(s.popped).toBe(0)
    expect(s.drowned).toBe(0)
    expect(s.swellTimer).toBe(SWELL_PERIOD_BASE)
    expect(s.over).toBe(false)
    expect(s.nextBuoyId).toBe(INITIAL_BUOYS)
  })
})

describe('mulberry32', () => {
  it('is deterministic for a seed and differs across seeds', () => {
    const a = mulberry32(123)
    const b = mulberry32(123)
    const c = mulberry32(999)
    const da = [a(), a(), a()]
    const db = [b(), b(), b()]
    expect(da).toEqual(db)
    expect([c(), c(), c()]).not.toEqual(da)
  })
})

describe('pure helpers', () => {
  it('comboMult tiers 1..4', () => {
    expect(comboMult(0)).toBe(1)
    expect(comboMult(3)).toBe(1)
    expect(comboMult(4)).toBe(2)
    expect(comboMult(8)).toBe(3)
    expect(comboMult(12)).toBe(4)
    expect(comboMult(100)).toBe(4) // capped
  })

  it('swellPeriodFor shrinks with level and floors at the minimum', () => {
    expect(swellPeriodFor(0)).toBe(SWELL_PERIOD_BASE)
    expect(swellPeriodFor(1)).toBeLessThan(SWELL_PERIOD_BASE)
    expect(swellPeriodFor(100)).toBe(150)
  })

  it('buoysPerSwell rises toward the cap', () => {
    expect(buoysPerSwell(0)).toBe(1)
    expect(buoysPerSwell(2)).toBe(2)
    expect(buoysPerSwell(100)).toBe(4)
  })

  it('levelFor / dist', () => {
    expect(levelFor(0)).toBe(0)
    expect(levelFor(6)).toBe(1)
    expect(dist(0, 0, 3, 4)).toBe(5)
  })
})

describe('ring growth', () => {
  it('grows radius by RING_SPEED*dt each step', () => {
    const s = step(S({ rings: [{ id: 0, ox: 0, oy: 0, radius: 10, popCount: 0 }] }), noDrop, rng)
    expect(s.rings[0].radius).toBe(10 + RING_SPEED)
    const s2 = step(s, { dt: 2, drop: null }, rng)
    expect(s2.rings[0].radius).toBeCloseTo(10 + RING_SPEED + RING_SPEED * 2)
  })
})

describe('drop cap', () => {
  it('ignores a drop when MAX_RINGS rings already exist', () => {
    const rings = Array.from({ length: MAX_RINGS }, (_, i) => ({
      id: i,
      ox: 0,
      oy: 0,
      radius: 5,
      popCount: 0,
    }))
    const s = step(S({ rings }), { dt: 1, drop: { x: 100, y: 100 } }, rng)
    expect(s.rings).toHaveLength(MAX_RINGS)
    expect(s.events.droppedRing).toBe(false)
  })

  it('adds a ring when under the cap', () => {
    const s = step(S(), { dt: 1, drop: { x: 100, y: 100 } }, rng)
    expect(s.rings).toHaveLength(1)
    expect(s.events.droppedRing).toBe(true)
  })
})

describe('swept collision', () => {
  it('pops a buoy when prevR < d <= newR', () => {
    // buoy at d=100 from origin (200,200); radius 98, dt makes newR=100.4
    const buoy = B({ id: 1, x: 300, y: 200 })
    const s = step(
      S({ rings: [{ id: 0, ox: 200, oy: 200, radius: 98, popCount: 0 }], buoys: [buoy] }),
      { dt: 1, drop: null },
      rng,
    )
    expect(s.events.pops).toHaveLength(1)
    expect(s.buoys).toHaveLength(0)
  })

  it('does not pop when the crest has not reached the buoy', () => {
    const buoy = B({ id: 1, x: 300, y: 200 })
    const s = step(
      S({ rings: [{ id: 0, ox: 200, oy: 200, radius: 96, popCount: 0 }], buoys: [buoy] }),
      { dt: 1, drop: null }, // newR = 98.4 < 100
      rng,
    )
    expect(s.events.pops).toHaveLength(0)
    expect(s.buoys).toHaveLength(1)
  })

  it('never skips a buoy across a huge dt', () => {
    const buoy = B({ id: 1, x: 380, y: 200 }) // d=180 from origin
    const s = step(
      S({ rings: [{ id: 0, ox: 200, oy: 200, radius: 10, popCount: 0 }], buoys: [buoy] }),
      { dt: 1000, drop: null }, // newR huge, sweeps right past the buoy
      rng,
    )
    expect(s.events.pops).toHaveLength(1)
    expect(s.events.pops[0].interferenceMult).toBe(1) // one ring only
  })
})

describe('interference', () => {
  it('two co-crossing rings => one pop, interferenceMult 2', () => {
    const buoy = B({ id: 1, x: 200, y: 200 })
    const s = step(
      S({
        rings: [
          { id: 0, ox: 100, oy: 200, radius: 98, popCount: 0 }, // d=100
          { id: 1, ox: 300, oy: 200, radius: 98, popCount: 0 }, // d=100
        ],
        buoys: [buoy],
      }),
      { dt: 1, drop: null },
      rng,
    )
    expect(s.events.pops).toHaveLength(1)
    expect(s.events.pops[0].interferenceMult).toBe(2)
  })

  it('three co-crossing rings => interferenceMult 3', () => {
    const buoy = B({ id: 1, x: 200, y: 200 })
    const s = step(
      S({
        rings: [
          { id: 0, ox: 100, oy: 200, radius: 98, popCount: 0 }, // d=100
          { id: 1, ox: 300, oy: 200, radius: 98, popCount: 0 }, // d=100
          { id: 2, ox: 200, oy: 100, radius: 98, popCount: 0 }, // d=100
        ],
        buoys: [buoy],
      }),
      { dt: 1, drop: null },
      rng,
    )
    expect(s.events.pops).toHaveLength(1)
    expect(s.events.pops[0].interferenceMult).toBe(3)
  })
})

describe('combo', () => {
  it('raises chain on consecutive pops and multiplies at chain 4', () => {
    // Four buoys all at d=100 from a ring at (200,200) => chain 1..4 in one tick.
    const buoys = [
      B({ id: 0, x: 300, y: 200 }),
      B({ id: 1, x: 100, y: 200 }),
      B({ id: 2, x: 200, y: 300 }),
      B({ id: 3, x: 200, y: 100 }),
    ]
    const s = step(
      S({ rings: [{ id: 0, ox: 200, oy: 200, radius: 98, popCount: 0 }], buoys }),
      { dt: 1, drop: null },
      rng,
    )
    expect(s.events.pops).toHaveLength(4)
    expect(s.events.pops[3].chain).toBe(4)
    // 4th pop is at chain 4 => comboMult 2
    expect(s.events.pops[3].points).toBe(BASE_POP * 1 * 2)
    expect(s.chain).toBe(4)
  })

  it('resets chain to 0 after COMBO_WINDOW idle frames', () => {
    const s = step(S({ chain: 3, comboMeter: 1 }), { dt: COMBO_WINDOW, drop: null }, rng)
    expect(s.comboMeter).toBe(0)
    expect(s.chain).toBe(0)
  })
})

describe('perfect sweep', () => {
  it('awards the bonus when a dying ring cleared >= PERFECT_SWEEP_N buoys', () => {
    const s = step(
      S({
        rings: [{ id: 0, ox: 0, oy: 0, radius: RING_MAX_R - 1, popCount: PERFECT_SWEEP_N }],
      }),
      { dt: 1, drop: null }, // newR > RING_MAX_R => ring dies
      rng,
    )
    expect(s.rings).toHaveLength(0)
    expect(s.events.perfectSweeps).toBe(1)
    expect(s.score).toBe(PERFECT_SWEEP_BONUS)
  })

  it('no bonus when the dying ring cleared too few buoys', () => {
    const s = step(
      S({ rings: [{ id: 0, ox: 0, oy: 0, radius: RING_MAX_R - 1, popCount: 1 }] }),
      { dt: 1, drop: null },
      rng,
    )
    expect(s.events.perfectSweeps).toBe(0)
    expect(s.score).toBe(0)
  })
})

describe('scoring', () => {
  it('a single non-interference pop at chain 1 scores BASE_POP', () => {
    const s = step(
      S({ rings: [{ id: 0, ox: 200, oy: 200, radius: 98, popCount: 0 }], buoys: [B({ id: 1, x: 300, y: 200 })] }),
      { dt: 1, drop: null },
      rng,
    )
    expect(s.score).toBe(BASE_POP)
  })

  it('a 3x interference pop at chain 1 scores 3*BASE_POP', () => {
    const buoy = B({ id: 1, x: 200, y: 200 })
    const s = step(
      S({
        rings: [
          { id: 0, ox: 100, oy: 200, radius: 98, popCount: 0 },
          { id: 1, ox: 300, oy: 200, radius: 98, popCount: 0 },
          { id: 2, ox: 200, oy: 100, radius: 98, popCount: 0 },
        ],
        buoys: [buoy],
      }),
      { dt: 1, drop: null },
      rng,
    )
    expect(s.score).toBe(3 * BASE_POP)
  })
})

describe('swell', () => {
  it('drowns a buoy at swellsLeft 1, fires the event, and spawns new buoys', () => {
    const s = step(
      S({ swellTimer: 1, buoys: [B({ id: 1, swellsLeft: 1 }), B({ id: 2, swellsLeft: 2 })], nextBuoyId: 3 }),
      { dt: 1, drop: null },
      rng,
    )
    expect(s.events.swell).toBe(true)
    expect(s.events.drowns).toBe(1)
    expect(s.drowned).toBe(1)
    // buoy 2 survived (now swellsLeft 1) + at least 1 spawned
    expect(s.buoys.length).toBeGreaterThanOrEqual(2)
    expect(s.buoys.some((b) => b.id === 2)).toBe(true)
    expect(s.swellTimer).toBe(swellPeriodFor(s.level))
  })

  it('a fresh buoy survives its first swell (swellsLeft 2 -> 1)', () => {
    const s = step(
      S({ swellTimer: 1, buoys: [B({ id: 1, swellsLeft: BUOY_SWELLS })], nextBuoyId: 2 }),
      { dt: 1, drop: null },
      rng,
    )
    expect(s.events.drowns).toBe(0)
    expect(s.buoys.find((b) => b.id === 1)?.swellsLeft).toBe(BUOY_SWELLS - 1)
  })
})

describe('game over', () => {
  it('ends the run at MAX_DROWN and is idempotent afterward', () => {
    const s = step(
      S({ swellTimer: 1, drowned: MAX_DROWN - 1, buoys: [B({ id: 1, swellsLeft: 1 })], nextBuoyId: 2 }),
      { dt: 1, drop: null },
      rng,
    )
    expect(s.over).toBe(true)
    expect(s.events.over).toBe(true)
    const again = step(s, { dt: 1, drop: { x: 10, y: 10 } }, rng)
    expect(again).toBe(s) // same reference
  })
})

describe('spawnBuoy bounds', () => {
  it('keeps buoys inside [BUOY_R+24, FIELD-BUOY_R-24] for extreme rng', () => {
    const lo = BUOY_R + 24
    const hi = FIELD_W - BUOY_R - 24
    const b0 = spawnBuoy(0, () => 0)
    const b1 = spawnBuoy(1, () => 0.999999)
    for (const b of [b0, b1]) {
      expect(b.x).toBeGreaterThanOrEqual(lo)
      expect(b.x).toBeLessThanOrEqual(hi)
      expect(b.y).toBeGreaterThanOrEqual(lo)
      expect(b.y).toBeLessThanOrEqual(hi)
    }
  })
})

describe('previewSweep', () => {
  it('returns only reachable buoys, sorted ascending by distance', () => {
    const buoys = [
      B({ id: 1, x: 300, y: 0 }), // d=300
      B({ id: 2, x: 100, y: 0 }), // d=100
      B({ id: 3, x: 200, y: 0 }), // d=200
    ]
    const seq = previewSweep({ x: 0, y: 0 }, buoys)
    expect(seq.map((p) => p.id)).toEqual([2, 3, 1])
  })

  it('excludes buoys beyond RING_MAX_R', () => {
    const far = B({ id: 9, x: RING_MAX_R + 100, y: 0 })
    const seq = previewSweep({ x: 0, y: 0 }, [far])
    expect(seq).toHaveLength(0)
  })
})
