import { describe, expect, it } from 'vitest'
import {
  ANGLE_MAX,
  ANGLE_MIN,
  DIFFICULTIES,
  GRAZE_BONUS,
  GRAZE_MULT,
  MAX_TICKS_PER_ATTEMPT,
  PAR_BONUS_MAX,
  POWER_MAX,
  POWER_MIN,
  SCALE,
  VELOCITY_PER_POWER,
  WIN_BONUS,
  clampAngle,
  clampPower,
  computeAcceleration,
  computeParBonus,
  createGame,
  distance2,
  generateBoard,
  isCollided,
  isGrazing,
  isInsideRing,
  isOutOfBounds,
  launchVelocity,
  massToRadius,
  mulberry32,
  reduce,
  resolveTick,
  simulatePreview,
  stepProbe,
  type GravwellConfig,
  type GravwellState,
  type Planet,
  type ProbeState,
  type Rng,
  type TargetRing,
} from './engine'

const CFG: GravwellConfig = DIFFICULTIES.normal

/**
 * Golden values below (tick counts, distances, final scores) are derived from
 * the constants in this file: SCALE=1000, VELOCITY_PER_POWER=20,
 * G_easy/normal/hard=1.0e7/1.6e7/2.2e7, GRAZE_MULT=1.6,
 * MAX_TICKS_PER_ATTEMPT=900, WIN_BONUS=1000, PAR_BONUS_MAX=1000,
 * GRAZE_BONUS=20. If any of those change, re-derive (see the exploration
 * queries used to author this file — run generateBoard/resolveTick by hand
 * with the new constants and update the hardcoded numbers).
 */

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return { id: 0, x: 50000, y: 30000, mass: 100, radius: 5000, ...overrides }
}

function makeProbe(overrides: Partial<ProbeState> = {}): ProbeState {
  return { x: 0, y: 0, vx: 0, vy: 0, tick: 0, ...overrides }
}

/** Hand-build a state for physics/reducer tests (bypasses generation). */
function stateWith(overrides: Partial<GravwellState> = {}): GravwellState {
  const cfg: GravwellConfig = { ...CFG, g: 0, planetCount: 0 }
  const target: TargetRing = { x: -1_000_000, y: -1_000_000, innerRadius: 100, outerRadius: 200 }
  return {
    config: cfg,
    seed: 1,
    planets: [],
    pad: { x: 0, y: 0 },
    target,
    phase: 'aiming',
    angle: 0,
    power: 50,
    probe: null,
    path: [],
    grazedPlanetIds: [],
    previousPaths: [],
    attemptsUsed: 0,
    score: 0,
    lastEvent: 'none',
    ...overrides,
  }
}

describe('mulberry32', () => {
  it('is deterministic for a fixed seed and stays in [0,1)', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('generateBoard', () => {
  it('always produces exactly planetCount planets', () => {
    for (const cfg of Object.values(DIFFICULTIES)) {
      for (const seed of [1, 2, 3, 42, 999]) {
        const { planets } = generateBoard(cfg, mulberry32(seed))
        expect(planets.length).toBe(cfg.planetCount)
      }
    }
  })

  it('places pad/target/planets within world bounds', () => {
    for (const cfg of Object.values(DIFFICULTIES)) {
      const { planets, pad, target } = generateBoard(cfg, mulberry32(7))
      const maxX = cfg.worldW * SCALE
      const maxY = cfg.worldH * SCALE
      expect(pad.x).toBeGreaterThanOrEqual(0)
      expect(pad.x).toBeLessThanOrEqual(maxX)
      expect(pad.y).toBeGreaterThanOrEqual(0)
      expect(pad.y).toBeLessThanOrEqual(maxY)
      expect(target.x).toBeGreaterThanOrEqual(0)
      expect(target.x).toBeLessThanOrEqual(maxX)
      expect(target.y).toBeGreaterThanOrEqual(0)
      expect(target.y).toBeLessThanOrEqual(maxY)
      for (const p of planets) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThanOrEqual(maxX)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeLessThanOrEqual(maxY)
      }
    }
  })

  it('never overlaps two planets (radius sum + separation) across many seeds', () => {
    for (const cfg of Object.values(DIFFICULTIES)) {
      for (let seed = 1; seed <= 100; seed++) {
        const { planets } = generateBoard(cfg, mulberry32(seed))
        for (let i = 0; i < planets.length; i++) {
          for (let j = i + 1; j < planets.length; j++) {
            const a = planets[i]
            const b = planets[j]
            const minD = a.radius + b.radius + 2500
            expect(distance2(a, b)).toBeGreaterThanOrEqual(minD * minD)
          }
        }
      }
    }
  })

  it('never overlaps a planet with the pad or target circle', () => {
    for (const cfg of Object.values(DIFFICULTIES)) {
      for (let seed = 1; seed <= 100; seed++) {
        const { planets, pad, target } = generateBoard(cfg, mulberry32(seed))
        for (const p of planets) {
          const padClear = p.radius + 6000
          expect(distance2(p, pad)).toBeGreaterThanOrEqual(padClear * padClear)
          const targetClear = p.radius + target.outerRadius + 2500
          expect(distance2(p, { x: target.x, y: target.y })).toBeGreaterThanOrEqual(
            targetClear * targetClear,
          )
        }
      }
    }
  })

  it('is deterministic for a fixed (cfg, seed)', () => {
    const a = generateBoard(CFG, mulberry32(555))
    const b = generateBoard(CFG, mulberry32(555))
    expect(a).toEqual(b)
  })

  it('produces different boards for different seeds', () => {
    const a = generateBoard(CFG, mulberry32(1))
    const b = generateBoard(CFG, mulberry32(2))
    expect(a).not.toEqual(b)
  })
})

describe('createGame', () => {
  it('starts in aiming phase with a clean slate', () => {
    const g = createGame(CFG, 42)
    expect(g.phase).toBe('aiming')
    expect(g.probe).toBeNull()
    expect(g.score).toBe(0)
    expect(g.attemptsUsed).toBe(0)
    expect(g.path).toEqual([])
    expect(g.planets.length).toBe(CFG.planetCount)
  })
})

describe('massToRadius', () => {
  it('is monotonic non-decreasing and stays within radiusRange', () => {
    const cfg = CFG
    const [m0, m1] = cfg.massRange
    const mid = Math.round((m0 + m1) / 2)
    const rMin = massToRadius(m0, cfg)
    const rMid = massToRadius(mid, cfg)
    const rMax = massToRadius(m1, cfg)
    expect(rMin).toBeGreaterThanOrEqual(cfg.radiusRange[0])
    expect(rMax).toBeLessThanOrEqual(cfg.radiusRange[1])
    expect(rMid).toBeGreaterThanOrEqual(rMin)
    expect(rMax).toBeGreaterThanOrEqual(rMid)
  })
})

describe('clampAngle / clampPower', () => {
  it('clamps out-of-range values and passes through in-range values', () => {
    expect(clampAngle(ANGLE_MIN - 50)).toBe(ANGLE_MIN)
    expect(clampAngle(ANGLE_MAX + 50)).toBe(ANGLE_MAX)
    expect(clampAngle(10)).toBe(10)
    expect(clampPower(POWER_MIN - 20)).toBe(POWER_MIN)
    expect(clampPower(POWER_MAX + 20)).toBe(POWER_MAX)
    expect(clampPower(30)).toBe(30)
  })
})

describe('launchVelocity', () => {
  it('angle=0 fires straight along +x with vy=0', () => {
    const { vx, vy } = launchVelocity(0, 50)
    expect(vy).toBe(0)
    expect(vx).toBeGreaterThan(0)
  })

  it('power=0 yields zero velocity regardless of angle', () => {
    expect(launchVelocity(37, 0)).toEqual({ vx: 0, vy: 0 })
    expect(launchVelocity(-60, 0)).toEqual({ vx: 0, vy: 0 })
  })

  it('increasing power at a fixed angle never decreases speed^2', () => {
    const a = launchVelocity(25, 20)
    const b = launchVelocity(25, 80)
    const speed2 = (v: { vx: number; vy: number }) => v.vx * v.vx + v.vy * v.vy
    expect(speed2(b)).toBeGreaterThanOrEqual(speed2(a))
  })
})

describe('computeAcceleration', () => {
  it('pulls straight toward a planet directly on the +x axis', () => {
    const planet = makePlanet({ x: 20000, y: 0, radius: 2000 })
    const { ax, ay } = computeAcceleration({ x: 0, y: 0 }, [planet], 1.6e7)
    expect(ax).toBeGreaterThan(0)
    expect(ay).toBe(0)
  })

  it('stays finite even at/inside the planet radius (softening)', () => {
    const planet = makePlanet({ x: 0, y: 0, radius: 2000 })
    const { ax, ay } = computeAcceleration({ x: 0, y: 0 }, [planet], 1.6e7)
    expect(Number.isFinite(ax)).toBe(true)
    expect(Number.isFinite(ay)).toBe(true)
  })

  it('returns zero acceleration with no planets', () => {
    expect(computeAcceleration({ x: 0, y: 0 }, [], 1.6e7)).toEqual({ ax: 0, ay: 0 })
  })

  it('acceleration magnitude does not increase as distance grows (outside radius)', () => {
    const planet = makePlanet({ x: 0, y: 0, radius: 2000 })
    const near = computeAcceleration({ x: 5000, y: 0 }, [planet], 1.6e7)
    const far = computeAcceleration({ x: 20000, y: 0 }, [planet], 1.6e7)
    expect(Math.abs(far.ax)).toBeLessThanOrEqual(Math.abs(near.ax))
  })
})

describe('stepProbe', () => {
  it('moves in a straight line with no acceleration when there are no planets', () => {
    const probe = makeProbe({ x: 100, y: 200, vx: 30, vy: -10, tick: 5 })
    const next = stepProbe(probe, [], 1.6e7)
    expect(next).toEqual({ x: 130, y: 190, vx: 30, vy: -10, tick: 6 })
  })

  it('is pure: same inputs -> deep-equal output, inputs left untouched', () => {
    const probe = makeProbe({ x: 10, y: 20, vx: 1, vy: 1, tick: 0 })
    const planets = [makePlanet()]
    const probeCopy = { ...probe }
    const planetsCopy = planets.map((p) => ({ ...p }))
    const out1 = stepProbe(probe, planets, 1.6e7)
    const out2 = stepProbe(probe, planets, 1.6e7)
    expect(out1).toEqual(out2)
    expect(probe).toEqual(probeCopy)
    expect(planets).toEqual(planetsCopy)
  })
})

describe('isInsideRing', () => {
  const ring: TargetRing = { x: 0, y: 0, innerRadius: 100, outerRadius: 300 }
  it('excludes the center, includes both boundaries, excludes past the outer edge', () => {
    expect(isInsideRing({ x: 0, y: 0 }, ring)).toBe(false)
    expect(isInsideRing({ x: 100, y: 0 }, ring)).toBe(true)
    expect(isInsideRing({ x: 300, y: 0 }, ring)).toBe(true)
    expect(isInsideRing({ x: 301, y: 0 }, ring)).toBe(false)
  })
})

describe('isCollided', () => {
  it('includes the boundary, excludes just past it', () => {
    const planet = makePlanet({ x: 0, y: 0, radius: 500 })
    expect(isCollided({ x: 500, y: 0 }, planet)).toBe(true)
    expect(isCollided({ x: 501, y: 0 }, planet)).toBe(false)
  })
})

describe('isGrazing', () => {
  const planet = makePlanet({ x: 0, y: 0, radius: 500 })
  it('is true just outside the collision radius, false at the boundary, false past graze range', () => {
    expect(isGrazing({ x: 501, y: 0 }, planet)).toBe(true)
    expect(isGrazing({ x: 500, y: 0 }, planet)).toBe(false) // collision boundary, not graze
    const grazeR = 500 * GRAZE_MULT
    expect(isGrazing({ x: Math.round(grazeR) + 1, y: 0 }, planet)).toBe(false)
  })

  it('is mutually exclusive with isCollided at any sampled distance', () => {
    for (const d of [0, 100, 499, 500, 501, 600, 800, 801, 2000]) {
      const p = { x: d, y: 0 }
      expect(isCollided(p, planet) && isGrazing(p, planet)).toBe(false)
    }
  })
})

describe('isOutOfBounds', () => {
  it('flags negative coords and past the world extent; keeps boundary in-bounds', () => {
    expect(isOutOfBounds({ x: -1, y: 0 }, CFG)).toBe(true)
    expect(isOutOfBounds({ x: 0, y: 0 }, CFG)).toBe(false)
    expect(isOutOfBounds({ x: CFG.worldW * SCALE, y: 0 }, CFG)).toBe(false)
    expect(isOutOfBounds({ x: CFG.worldW * SCALE + 1, y: 0 }, CFG)).toBe(true)
  })
})

describe('computeParBonus', () => {
  it('is exactly PAR_BONUS_MAX when shots used is within par', () => {
    expect(computeParBonus(3, 1)).toBe(PAR_BONUS_MAX)
    expect(computeParBonus(3, 3)).toBe(PAR_BONUS_MAX)
  })

  it('decreases monotonically as shots used grows past par, never negative', () => {
    const par = 3
    const atPar = computeParBonus(par, par)
    const double = computeParBonus(par, par * 2)
    const huge = computeParBonus(par, 10_000)
    expect(double).toBeLessThanOrEqual(atPar)
    expect(double).toBe(Math.round(PAR_BONUS_MAX * (par / (par * 2))))
    expect(huge).toBeGreaterThanOrEqual(0)
  })
})

// -- Golden scenarios -------------------------------------------------------
// All handcrafted with g=0 and explicit planets/targets so the trajectory is
// pure integer straight-line motion -- no float drift, fully hand-verifiable.

describe('golden A -- crash', () => {
  it('collides exactly one tick after launch and ends the attempt', () => {
    const planet = makePlanet({ id: 0, x: 50000, y: 30000, mass: 100, radius: 5000 })
    const probe = makeProbe({ x: 40000, y: 30000, vx: 10000, vy: 0, tick: 0 })
    const s = stateWith({
      phase: 'flying',
      planets: [planet],
      probe,
      path: [{ x: probe.x, y: probe.y }],
      config: { ...CFG, g: 0, planetCount: 1, maxAttempts: 5 },
    })
    const out = resolveTick(s)
    expect(out.lastEvent).toBe('crash')
    expect(out.attemptsUsed).toBe(1)
    expect(out.previousPaths.length).toBe(1)
    expect(out.phase).toBe('aiming')
    expect(out.probe).toBeNull()
  })
})

describe('golden B -- win', () => {
  it('reaches the ring on tick 9 and awards WIN_BONUS + full par bonus', () => {
    const target: TargetRing = { x: 50000, y: 30000, innerRadius: 2000, outerRadius: 5000 }
    const probe = makeProbe({ x: 10000, y: 30000, vx: 4000, vy: 0, tick: 0 })
    let s = stateWith({
      phase: 'flying',
      planets: [],
      probe,
      path: [{ x: probe.x, y: probe.y }],
      target,
      config: { ...CFG, g: 0, planetCount: 0, par: 2, maxAttempts: 5 },
    })
    let ticks = 0
    while (s.phase === 'flying' && ticks < 20) {
      s = resolveTick(s)
      ticks++
    }
    expect(ticks).toBe(9)
    expect(s.phase).toBe('won')
    expect(s.lastEvent).toBe('win')
    expect(s.probe).toEqual({ x: 46000, y: 30000, vx: 4000, vy: 0, tick: 9 })
    expect(s.score).toBe(WIN_BONUS + PAR_BONUS_MAX)
  })
})

describe('golden C -- out of bounds', () => {
  it('leaves the world before MAX_TICKS_PER_ATTEMPT, not a timeout', () => {
    const target: TargetRing = { x: 90000, y: 30000, innerRadius: 2000, outerRadius: 5000 }
    const probe = makeProbe({ x: 5000, y: 30000, vx: -4000, vy: 0, tick: 0 })
    let s = stateWith({
      phase: 'flying',
      planets: [],
      probe,
      path: [{ x: probe.x, y: probe.y }],
      target,
      config: { ...CFG, g: 0, planetCount: 0, maxAttempts: 5 },
    })
    let ticks = 0
    while (s.phase === 'flying' && ticks < 20) {
      s = resolveTick(s)
      ticks++
    }
    expect(ticks).toBe(2)
    expect(s.lastEvent).toBe('oob')
    expect(s.phase).toBe('aiming')
  })
})

describe('timeout hard-caps a stuck attempt (infinite-loop guard)', () => {
  it('always exits flying by MAX_TICKS_PER_ATTEMPT, with lastEvent timeout', () => {
    const target: TargetRing = { x: -9_000_000, y: -9_000_000, innerRadius: 1, outerRadius: 2 }
    const probe = makeProbe({ x: 50000, y: 30000, vx: 1, vy: 0, tick: 0 })
    let s = stateWith({
      phase: 'flying',
      planets: [],
      probe,
      path: [{ x: probe.x, y: probe.y }],
      target,
      config: { ...CFG, g: 0, planetCount: 0, maxAttempts: 5 },
    })
    let ticks = 0
    while (s.phase === 'flying' && ticks < MAX_TICKS_PER_ATTEMPT + 5) {
      s = resolveTick(s)
      ticks++
    }
    expect(ticks).toBe(MAX_TICKS_PER_ATTEMPT)
    expect(s.phase).not.toBe('flying')
    expect(s.lastEvent).toBe('timeout')
  })
})

describe('graze scoring', () => {
  it('awards GRAZE_BONUS exactly once even across many consecutive in-band ticks', () => {
    const planet = makePlanet({ id: 0, x: 50000, y: 30000, mass: 100, radius: 5000 })
    const target: TargetRing = { x: -9_000_000, y: -9_000_000, innerRadius: 1, outerRadius: 2 }
    const probe = makeProbe({ x: 40000, y: 36000, vx: 500, vy: 0, tick: 0 })
    let s = stateWith({
      phase: 'flying',
      planets: [planet],
      probe,
      path: [{ x: probe.x, y: probe.y }],
      target,
      config: { ...CFG, g: 0, planetCount: 1, maxAttempts: 5 },
    })
    let sawGraze = 0
    for (let i = 0; i < 40 && s.phase === 'flying'; i++) {
      s = resolveTick(s)
      if (s.lastEvent === 'graze') sawGraze++
    }
    // Only the tick that first enters the band emits 'graze' / adds score --
    // later ticks that are still inside the band are ordinary 'tick's, even
    // though the probe visibly lingers there for many consecutive ticks.
    expect(sawGraze).toBe(1)
    expect(s.phase).toBe('flying') // never crashes/oob/wins in this window
    expect(s.score).toBe(GRAZE_BONUS) // but only charged once
    expect(s.grazedPlanetIds).toEqual([0])
  })
})

describe('loss condition', () => {
  it('ends the run in "lost" immediately when maxAttempts=1 and the first shot crashes', () => {
    const planet = makePlanet({ id: 0, x: 50000, y: 30000, mass: 100, radius: 5000 })
    const probe = makeProbe({ x: 40000, y: 30000, vx: 10000, vy: 0, tick: 0 })
    const s = stateWith({
      phase: 'flying',
      planets: [planet],
      probe,
      path: [{ x: probe.x, y: probe.y }],
      config: { ...CFG, g: 0, planetCount: 1, maxAttempts: 1 },
    })
    const out = resolveTick(s)
    expect(out.phase).toBe('lost')
    expect(out.lastEvent).toBe('lose')
  })
})

describe('reduce -- aim / nudgeAngle / nudgePower', () => {
  it('clamps aim values and is a no-op mid-flight', () => {
    let s = stateWith()
    s = reduce(s, { type: 'aim', angle: 999, power: -50 })
    expect(s.angle).toBe(ANGLE_MAX)
    expect(s.power).toBe(POWER_MIN)

    const flying = stateWith({ phase: 'flying', probe: makeProbe() })
    const out = reduce(flying, { type: 'aim', angle: 5, power: 5 })
    expect(out).toEqual({ ...flying, lastEvent: 'none' })
  })

  it('nudges clamp at the boundary and no-op outside aiming', () => {
    let s = stateWith({ angle: ANGLE_MAX - 2 })
    s = reduce(s, { type: 'nudgeAngle', delta: 10 })
    expect(s.angle).toBe(ANGLE_MAX)

    let p = stateWith({ power: 2 })
    p = reduce(p, { type: 'nudgePower', delta: -10 })
    expect(p.power).toBe(POWER_MIN)

    const flying = stateWith({ phase: 'flying', probe: makeProbe(), angle: 0 })
    const out = reduce(flying, { type: 'nudgeAngle', delta: 5 })
    expect(out.angle).toBe(0)
    expect(out.lastEvent).toBe('none')
  })
})

describe('reduce -- launch', () => {
  it('transitions aiming -> flying with the expected initial probe', () => {
    const s = stateWith({ pad: { x: 1000, y: 2000 }, angle: 0, power: 50 })
    const out = reduce(s, { type: 'launch' })
    expect(out.phase).toBe('flying')
    expect(out.lastEvent).toBe('launch')
    expect(out.probe).toEqual({ x: 1000, y: 2000, vx: 50 * VELOCITY_PER_POWER, vy: 0, tick: 0 })
    expect(out.path).toEqual([{ x: 1000, y: 2000 }])
  })

  it('is a no-op while already flying', () => {
    const flying = stateWith({ phase: 'flying', probe: makeProbe({ vx: 7 }) })
    const out = reduce(flying, { type: 'launch' })
    expect(out).toEqual({ ...flying, lastEvent: 'none' })
  })
})

describe('reduce -- reset / new', () => {
  it('reset keeps the same board (seed) and zeroes score/attempts', () => {
    const g = createGame(CFG, 4242)
    let s = reduce(g, { type: 'aim', angle: 20, power: 80 })
    s = reduce(s, { type: 'launch' })
    s = reduce(s, { type: 'tick' })
    s = reduce(s, { type: 'reset' })
    expect(s.planets).toEqual(g.planets)
    expect(s.pad).toEqual(g.pad)
    expect(s.target).toEqual(g.target)
    expect(s.score).toBe(0)
    expect(s.attemptsUsed).toBe(0)
    expect(s.phase).toBe('aiming')
  })

  it('new produces the requested seed and a different board', () => {
    const g = createGame(CFG, 1)
    const out = reduce(g, { type: 'new', seed: 2 })
    expect(out.seed).toBe(2)
    expect(out).not.toEqual(g)
  })
})

describe('simulatePreview', () => {
  it('does not mutate state and is deterministic', () => {
    const s = createGame(CFG, 88)
    const before = JSON.parse(JSON.stringify(s))
    const p1 = simulatePreview(s, 50)
    const p2 = simulatePreview(s, 50)
    expect(s).toEqual(before)
    expect(p1).toEqual(p2)
  })
})

describe('band-width vs. max-speed+max-acceleration invariant (hard, tunneling guard)', () => {
  it('holds for every difficulty', () => {
    for (const [name, cfg] of Object.entries(DIFFICULTIES)) {
      const bandWU = (cfg.worldH * 0.11 - cfg.worldH * 0.11 * 0.4)
      const maxSpeedWU = (POWER_MAX * VELOCITY_PER_POWER) / SCALE
      const maxAccelMu = Math.floor((cfg.g * cfg.massRange[1]) / (cfg.radiusRange[0] * cfg.radiusRange[0]))
      const maxAccelWU = maxAccelMu / SCALE
      expect(bandWU, `${name}: band must exceed max-speed + max-accel`).toBeGreaterThan(
        maxSpeedWU + maxAccelWU,
      )
    }
  })
})

describe('golden full session', () => {
  it('locks the whole pipeline (board gen + physics + scoring) to one fixed score', () => {
    const cfg: GravwellConfig = { ...DIFFICULTIES.easy, planetCount: 0, par: 2, maxAttempts: 5 }
    let s = createGame(cfg, 777)
    expect(s.pad).toEqual({ x: 8000, y: 34473 })
    expect(s.target).toEqual({ x: 90000, y: 13240, outerRadius: 6600, innerRadius: 2640 })

    s = reduce(s, { type: 'aim', angle: 15, power: 100 })
    s = reduce(s, { type: 'launch' })
    expect(s.probe).toEqual({ x: 8000, y: 34473, vx: 1932, vy: -518, tick: 0 })

    let ticks = 0
    while (s.phase === 'flying' && ticks < 2000) {
      s = reduce(s, { type: 'tick' })
      ticks++
    }
    expect(ticks).toBe(40)
    expect(s.phase).toBe('won')
    expect(s.attemptsUsed).toBe(1)
    expect(s.score).toBe(WIN_BONUS + PAR_BONUS_MAX)
  })
})

// A minimal queued Rng, kept for parity with the template's testing style even
// though generateBoard's own determinism tests above use mulberry32 directly.
function queued(values: number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]
}

it('queued rng helper produces a well-formed board (sanity)', () => {
  const { planets } = generateBoard(DIFFICULTIES.easy, queued([0.1, 0.4, 0.6, 0.9, 0.2, 0.5]))
  expect(planets.length).toBe(DIFFICULTIES.easy.planetCount)
})
