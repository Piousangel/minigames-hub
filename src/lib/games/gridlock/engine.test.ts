import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  LANES,
  createGame,
  isUrgent,
  laneOffset,
  mulberry32,
  nextRandom,
  pickSpeed,
  reduce,
  spawnGap,
  stepTick,
  vehicleCoord,
  type GridlockConfig,
  type GridlockState,
  type Lane,
  type Vehicle,
} from './engine'

const CFG: GridlockConfig = DEFAULT_CONFIG

/** Hand-build a state for stepTick/reduce tests (bypasses generation). */
function stateWith(overrides: Partial<GridlockState> = {}): GridlockState {
  return {
    config: CFG,
    seed: 1,
    rngState: 1 >>> 0,
    tick: 0,
    activeLane: 'N',
    vehicles: { N: null, S: null, E: null, W: null },
    nextSpawnTick: { N: 9999, S: 9999, E: 9999, W: 9999 }, // far future: no incidental spawns
    nextVehicleId: 0,
    occupant: null,
    score: 0,
    gameOver: false,
    failCause: null,
    failLane: null,
    lastEvent: 'none',
    ...overrides,
  }
}

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return { id: 1, lane: 'N', distance: 3, speed: 2, cooldown: 2, waitTicks: 0, ...overrides }
}

// --- 1. mulberry32 determinism -----------------------------------------

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(99)
    const b = mulberry32(99)
    const seqA = [a(), a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

// --- nextRandom mirrors mulberry32's per-call sequence ------------------

describe('nextRandom', () => {
  it('reproduces the exact sequence mulberry32(seed) would produce', () => {
    const seed = 4242
    const rng = mulberry32(seed)
    let state = seed >>> 0
    for (let i = 0; i < 8; i++) {
      const expected = rng()
      const r = nextRandom(state)
      state = r.state
      expect(r.value).toBe(expected)
    }
  })
})

// --- 2/3/4. createGame determinism + divergence + invariants -----------

describe('createGame', () => {
  it('is structurally deterministic for a fixed (cfg, seed)', () => {
    const a = createGame(CFG, 1)
    const b = createGame(CFG, 1)
    expect(a).toEqual(b)
  })

  it('diverges across different seeds', () => {
    const a = createGame(CFG, 1)
    const b = createGame(CFG, 2)
    expect(a).not.toEqual(b)
  })

  it('satisfies base invariants', () => {
    const g = createGame(CFG, 7)
    expect(g.tick).toBe(0)
    expect(g.score).toBe(0)
    expect(g.occupant).toBeNull()
    expect(g.gameOver).toBe(false)
    for (const lane of LANES) expect(g.vehicles[lane]).toBeNull()
    expect(LANES).toContain(g.activeLane)
    for (const lane of LANES) {
      expect(g.nextSpawnTick[lane]).toBeGreaterThanOrEqual(0)
      expect(g.nextSpawnTick[lane]).toBeLessThan(CFG.baseSpawnGap)
    }
  })
})

// --- 5. pickSpeed boundaries ---------------------------------------------

describe('pickSpeed', () => {
  it('r=0 yields minSpeed, r near 1 never exceeds maxSpeed', () => {
    expect(pickSpeed(CFG, 0)).toBe(CFG.minSpeed)
    expect(pickSpeed(CFG, 0.9999999)).toBe(CFG.maxSpeed)
    expect(pickSpeed(CFG, 0.9999999)).toBeLessThanOrEqual(CFG.maxSpeed)
  })
})

// --- 6/7. spawnGap ramp + jitter bounds -----------------------------------

describe('spawnGap', () => {
  it('base equals baseSpawnGap at score 0 and clamps to minSpawnGap at high score', () => {
    expect(spawnGap(CFG, 0, 0)).toBe(CFG.baseSpawnGap)
    const highScore = CFG.spawnRampDivisor * 20
    expect(spawnGap(CFG, highScore, 0)).toBe(CFG.minSpawnGap)
  })

  it('r=0 returns base; r near 1 never exceeds base+jitter', () => {
    const base = Math.max(
      CFG.minSpawnGap,
      CFG.baseSpawnGap - Math.floor(0 / CFG.spawnRampDivisor),
    )
    expect(spawnGap(CFG, 0, 0)).toBe(base)
    expect(spawnGap(CFG, 0, 0.9999999)).toBeLessThanOrEqual(base + CFG.spawnGapJitter)
  })
})

// --- 8. laneOffset / vehicleCoord -----------------------------------------

describe('laneOffset / vehicleCoord', () => {
  it('maps each lane to a unit vector and preserves distance on the correct axis', () => {
    for (const lane of LANES) {
      const { dx, dy } = laneOffset(lane)
      expect(Math.abs(dx) + Math.abs(dy)).toBe(1)
      const { x, y } = vehicleCoord(vehicle({ lane, distance: 3 }))
      expect(Math.abs(x) + Math.abs(y)).toBe(3)
      if (dx === 0) expect(x).toBe(0)
      if (dy === 0) expect(y).toBe(0)
    }
  })
})

// --- 9. isUrgent boundary --------------------------------------------------

describe('isUrgent', () => {
  it('flips exactly at floor(maxWaitTicks*0.7)', () => {
    const threshold = Math.floor(CFG.maxWaitTicks * 0.7)
    const justBelow = vehicle({ distance: 1, waitTicks: threshold - 1 })
    const atThreshold = vehicle({ distance: 1, waitTicks: threshold })
    expect(isUrgent(justBelow, CFG)).toBe(false)
    expect(isUrgent(atThreshold, CFG)).toBe(true)
  })
})

// --- 10. golden: first spawn timing (RNG consumption order) --------------

describe('createGame golden: rng consumption order', () => {
  it('nextSpawnTick offsets match hand-rolled mulberry32(seed) draws', () => {
    const seed = 42
    const rng = mulberry32(seed)
    const activeIdx = Math.floor(rng() * 4)
    const expectedActive: Lane = LANES[activeIdx]
    const expectedN = Math.floor(rng() * CFG.baseSpawnGap)
    const expectedS = Math.floor(rng() * CFG.baseSpawnGap)
    const expectedE = Math.floor(rng() * CFG.baseSpawnGap)
    const expectedW = Math.floor(rng() * CFG.baseSpawnGap)

    const g = createGame(CFG, seed)
    expect(g.activeLane).toBe(expectedActive)
    expect(g.nextSpawnTick.N).toBe(expectedN)
    expect(g.nextSpawnTick.S).toBe(expectedS)
    expect(g.nextSpawnTick.E).toBe(expectedE)
    expect(g.nextSpawnTick.W).toBe(expectedW)

    // Pin the exact numbers too, so a refactor that breaks ordering fails loudly.
    expect(g.activeLane).toBe('E')
    expect(g.nextSpawnTick).toEqual({ N: 7, S: 13, E: 10, W: 2 })
  })
})

// --- 11. stepTick: cooldown countdown then move ---------------------------

describe('stepTick: approach movement', () => {
  it('a vehicle with distance>1 and cooldown=speed sits still for `speed` ticks, then moves on tick speed+1', () => {
    const speed = 3
    let s = stateWith({
      activeLane: 'S', // not N, irrelevant while distance>1
      vehicles: { N: vehicle({ lane: 'N', distance: 4, speed, cooldown: speed }), S: null, E: null, W: null },
    })
    // ticks 1..speed: cooldown counts down to 0, distance unchanged each time
    for (let i = 0; i < speed; i++) {
      s = stepTick(s)
      expect(s.vehicles.N?.distance).toBe(4)
    }
    expect(s.vehicles.N?.cooldown).toBe(0)
    // next tick (cooldown was already 0): moves, distance-1, cooldown reset to speed
    s = stepTick(s)
    expect(s.vehicles.N?.distance).toBe(3)
    expect(s.vehicles.N?.cooldown).toBe(speed)
  })
})

// --- 12. stepTick: red light waiting ---------------------------------------

describe('stepTick: red light waiting', () => {
  it('distance stays at 1 while waitTicks increments each tick', () => {
    let s = stateWith({
      activeLane: 'E', // N is red
      vehicles: { N: vehicle({ lane: 'N', distance: 1, speed: 2, cooldown: 0, waitTicks: 0 }), S: null, E: null, W: null },
    })
    for (let i = 1; i <= 5; i++) {
      s = stepTick(s)
      expect(s.vehicles.N?.distance).toBe(1)
      expect(s.vehicles.N?.waitTicks).toBe(i)
    }
  })
})

// --- 13. stepTick: green light entry, empty intersection -------------------

describe('stepTick: green light entry', () => {
  it('vehicle enters, score +1, occupant set, when intersection is free', () => {
    const s = stateWith({
      tick: 10,
      activeLane: 'N',
      vehicles: { N: vehicle({ lane: 'N', distance: 1, speed: 2, cooldown: 0 }), S: null, E: null, W: null },
      occupant: null,
      score: 0,
    })
    const next = stepTick(s)
    expect(next.vehicles.N).toBeNull()
    expect(next.score).toBe(1)
    expect(next.occupant).not.toBeNull()
    expect(next.occupant?.lane).toBe('N')
    expect(next.occupant?.clearTick).toBe(next.tick + CFG.crossTicks)
    expect(next.lastEvent).toBe('cross')
  })
})

// --- 14. golden: full uncontested crossing tick count ----------------------

describe('stepTick golden: full crossing without contention', () => {
  it('a lone N vehicle (distance=4, speed=3) crosses in exactly 16 ticks', () => {
    const distance = 4
    const speed = 3
    let s = stateWith({
      activeLane: 'N',
      vehicles: { N: vehicle({ lane: 'N', distance, speed, cooldown: speed }), S: null, E: null, W: null },
      occupant: null,
    })
    let ticks = 0
    while (s.vehicles.N !== null) {
      s = stepTick(s)
      ticks++
      if (ticks > 1000) throw new Error('runaway loop')
    }
    // Every cell-advance (3 of them, distance 4->3->2->1) and the final
    // stop-line entry each cost a full cooldown cycle of `speed`+1 ticks
    // (speed ticks of countdown, then the tick that actually acts) —
    // hand-verified against the reference implementation: 16 ticks.
    expect(ticks).toBe(16)
    expect(s.score).toBe(1)
    expect(s.occupant?.lane).toBe('N')
    expect(s.occupant?.clearTick).toBe(19)
  })
})

// --- 15. golden: collision reproduction -------------------------------------

describe('stepTick golden: crash', () => {
  it('entering a lane while a different lane occupies the intersection crashes', () => {
    const s = stateWith({
      tick: 5,
      activeLane: 'E',
      occupant: { lane: 'N', clearTick: 5 + 2 }, // still occupied at tick 6
      vehicles: { N: null, S: null, E: vehicle({ lane: 'E', distance: 1, speed: 2, cooldown: 0 }), W: null },
    })
    const next = stepTick(s)
    expect(next.gameOver).toBe(true)
    expect(next.failCause).toBe('crash')
    expect(next.failLane).toBe('E')
    expect(next.occupant?.lane).toBe('N')
    expect(next.lastEvent).toBe('crash')
  })
})

// --- 16. boundary: no crash when occupancy has just expired -----------------

describe('stepTick boundary: occupancy expires just in time', () => {
  it('an occupant clearing exactly this tick frees the intersection, no crash', () => {
    const s = stateWith({
      tick: 5,
      activeLane: 'E',
      occupant: { lane: 'N', clearTick: 6 }, // clears at tick 6 == next tick
      vehicles: { N: null, S: null, E: vehicle({ lane: 'E', distance: 1, speed: 2, cooldown: 0 }), W: null },
      score: 2,
    })
    const next = stepTick(s)
    expect(next.gameOver).toBe(false)
    expect(next.occupant?.lane).toBe('E')
    expect(next.score).toBe(3)
  })
})

// --- 17. golden: timeout reproduction ---------------------------------------

describe('stepTick golden: timeout', () => {
  it('exceeding maxWaitTicks while waiting is a gameover', () => {
    const s = stateWith({
      activeLane: 'N', // S is red
      vehicles: {
        N: null,
        S: vehicle({ lane: 'S', distance: 1, speed: 2, cooldown: 0, waitTicks: CFG.maxWaitTicks }),
        E: null,
        W: null,
      },
    })
    const next = stepTick(s)
    expect(next.gameOver).toBe(true)
    expect(next.failCause).toBe('timeout')
    expect(next.failLane).toBe('S')
  })
})

// --- 18. boundary: no timeout one tick early --------------------------------

describe('stepTick boundary: one tick before timeout', () => {
  it('waitTicks === maxWaitTicks-1 does not end the game, and increments', () => {
    const s = stateWith({
      activeLane: 'N',
      vehicles: {
        N: null,
        S: vehicle({ lane: 'S', distance: 1, speed: 2, cooldown: 0, waitTicks: CFG.maxWaitTicks - 1 }),
        E: null,
        W: null,
      },
    })
    const next = stepTick(s)
    expect(next.gameOver).toBe(false)
    expect(next.vehicles.S?.waitTicks).toBe(CFG.maxWaitTicks)
  })
})

// --- 19. stepTick idempotence after gameOver --------------------------------

describe('stepTick: frozen after gameOver', () => {
  it('returns the identical state once gameOver is true', () => {
    const s = stateWith({
      gameOver: true,
      failCause: 'crash',
      failLane: 'N',
      occupant: { lane: 'S', clearTick: 9 },
    })
    const next = stepTick(s)
    expect(next).toEqual(s)
    const next2 = stepTick(next)
    expect(next2).toEqual(s)
  })
})

// --- 20/21. reduce: setLane -------------------------------------------------

describe('reduce: setLane', () => {
  it('no-ops (lastEvent none) when target === current activeLane', () => {
    const s = stateWith({ activeLane: 'N' })
    const next = reduce(s, { type: 'setLane', lane: 'N' })
    expect(next.lastEvent).toBe('none')
    expect(next).toEqual({ ...s, lastEvent: 'none' })
  })

  it('switches activeLane and leaves other fields untouched otherwise', () => {
    const s = stateWith({ activeLane: 'N', score: 5, tick: 12 })
    const next = reduce(s, { type: 'setLane', lane: 'E' })
    expect(next.activeLane).toBe('E')
    expect(next.lastEvent).toBe('switch')
    expect(next.score).toBe(5)
    expect(next.tick).toBe(12)
    expect(next.vehicles).toEqual(s.vehicles)
  })

  it('is a no-op once gameOver is true', () => {
    const s = stateWith({ activeLane: 'N', gameOver: true })
    const next = reduce(s, { type: 'setLane', lane: 'E' })
    expect(next.activeLane).toBe('N')
    expect(next.lastEvent).toBe('none')
  })
})

// --- 22/23. reduce: reset / new ---------------------------------------------

describe('reduce: reset / new', () => {
  it('reset reproduces createGame(config, seed) exactly', () => {
    let s = createGame(CFG, 3)
    s = { ...s, score: 40, tick: 200 }
    const next = reduce(s, { type: 'reset' })
    expect(next).toEqual(createGame(CFG, 3))
  })

  it('new starts fresh from the given seed regardless of prior progress', () => {
    let s = createGame(CFG, 3)
    s = { ...s, score: 999, tick: 500, gameOver: true }
    const next = reduce(s, { type: 'new', seed: 99 })
    expect(next).toEqual(createGame(CFG, 99))
    expect(next.score).toBe(0)
    expect(next.gameOver).toBe(false)
  })
})

// --- 24. golden: full play scenarios ----------------------------------------

describe('golden play scenarios', () => {
  it('(a) disciplined rotation survives and racks up score', () => {
    let s = createGame(CFG, 777)
    const order: Lane[] = ['N', 'E', 'S', 'W']
    let oi = 0
    for (let i = 0; i < 400; i++) {
      if (i % 12 === 0) {
        s = reduce(s, { type: 'setLane', lane: order[oi % order.length] })
        oi++
      }
      s = reduce(s, { type: 'tick' })
      if (s.gameOver) break
    }
    expect(s.gameOver).toBe(false)
    expect(s.score).toBe(33)
  })

  it('(b) switching every single tick induces a crash', () => {
    let s = createGame(CFG, 555)
    const order: Lane[] = ['N', 'S', 'E', 'W']
    let oi = 0
    for (let i = 0; i < 200; i++) {
      s = reduce(s, { type: 'setLane', lane: order[oi % order.length] })
      oi++
      s = reduce(s, { type: 'tick' })
      if (s.gameOver) break
    }
    expect(s.gameOver).toBe(true)
    expect(s.failCause).toBe('crash')
    expect(s.failLane).toBe('S')
    expect(s.tick).toBe(34)
    expect(s.score).toBe(3)
  })
})

// --- 25. spawn ramp non-increasing ------------------------------------------

describe('spawn ramp', () => {
  it('the spawn gap lower bound narrows (or stays equal) as score rises', () => {
    const r = 0
    const gapAtZero = spawnGap(CFG, 0, r)
    const gapAtMid = spawnGap(CFG, CFG.spawnRampDivisor * 3, r)
    const gapAtHigh = spawnGap(CFG, CFG.spawnRampDivisor * 20, r)
    expect(gapAtMid).toBeLessThanOrEqual(gapAtZero)
    expect(gapAtHigh).toBeLessThanOrEqual(gapAtMid)
    expect(gapAtHigh).toBe(CFG.minSpawnGap)
  })

  it('a crash-triggered spawn schedules a tighter gap at high score than at score 0, same rng draw', () => {
    // Two states identical except score and rngState position — an entering
    // vehicle on lane N consumes the same rng draw either way, isolating the
    // effect of `score` on the resulting nextSpawnTick gap.
    const low = stateWith({
      tick: 10,
      score: 0,
      activeLane: 'N',
      occupant: null,
      vehicles: { N: vehicle({ lane: 'N', distance: 1, speed: 2, cooldown: 0 }), S: null, E: null, W: null },
    })
    const high = stateWith({
      ...low,
      score: CFG.spawnRampDivisor * 20,
      vehicles: { N: vehicle({ lane: 'N', distance: 1, speed: 2, cooldown: 0 }), S: null, E: null, W: null },
    })
    const lowNext = stepTick(low)
    const highNext = stepTick(high)
    const lowGap = lowNext.nextSpawnTick.N - lowNext.tick
    const highGap = highNext.nextSpawnTick.N - highNext.tick
    expect(highGap).toBeLessThanOrEqual(lowGap)
    expect(highGap).toBe(CFG.minSpawnGap + (lowGap - CFG.baseSpawnGap))
  })
})
