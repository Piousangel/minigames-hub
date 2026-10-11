import { describe, expect, it } from 'vitest'
import {
  BANKSHOT_DIFFICULTIES,
  BOARD_H,
  BOARD_W,
  DAILY_CONFIG,
  FP,
  LAUNCH_POINT,
  MAX_TICKS,
  PRECISION_RADIUS,
  SHOT_BONUS_MAX,
  SHOT_SLACK,
  TARGET_R,
  UNDO_POOL,
  WIN_BONUS,
  angleToVelocity,
  closestApproach,
  createGame,
  generateLevel,
  mulberry32,
  powerToSpeed,
  reduce,
  scoreOnMiss,
  scoreOnWin,
  shotLimit,
  simulateShot,
  stepAxis,
  type BankshotConfig,
  type BankshotLevel,
  type BankshotState,
  type Rng,
  type WallRect,
} from './engine'

/**
 * Golden values below (rng call counts, wall/target coordinates, simulateShot
 * rest positions/ticks/bounces, and reducer scores) were pinned by directly
 * invoking the engine's own exported functions with fixed inputs (constants:
 * FP=1000, MAX_STEP=4000, RESTITUTION_PERMILLE=970, FRICTION_PERMILLE=980,
 * STOP_SPEED=300, TARGET_R=14000, UNDO_POOL=3, WIN_BONUS=1000,
 * SHOT_BONUS_MAX=1000, PRECISION_BONUS_MAX=30, PRECISION_RADIUS=60000) and
 * reading back the deterministic output -- the same "trace the engine's own
 * arithmetic" approach used by the gravwell/strata golden suites in this
 * repo. If any of those constants change, re-derive by re-running the calls
 * documented in each test and updating the hardcoded numbers.
 */

// -- Small pure primitives ---------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic for a fixed seed and stays in [0,1)', () => {
    const a = mulberry32(777)
    const b = mulberry32(777)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(a()).not.toBe(b())
  })
})

describe('angleToVelocity', () => {
  it('0 degrees points along +x with vy=0', () => {
    expect(angleToVelocity(0, 10000)).toEqual({ vx: 10000, vy: 0 })
  })

  it('90 degrees points along +y (screen-down) with vx=0', () => {
    const { vx, vy } = angleToVelocity(90, 10000)
    expect(vx).toBe(0)
    expect(vy).toBe(10000)
  })

  it('180 degrees points along -x with vy=0', () => {
    expect(angleToVelocity(180, 10000)).toEqual({ vx: -10000, vy: 0 })
  })

  it('270 degrees points along -y with vx=0', () => {
    const { vx, vy } = angleToVelocity(270, 10000)
    // cos(270deg) is a tiny float near 0 that can round to -0; `-0 === 0` is
    // true under strict equality (unlike toBe's Object.is), so assert that way.
    expect(vx === 0).toBe(true)
    expect(vy).toBe(-10000)
  })

  it('speed=0 yields zero velocity regardless of angle', () => {
    expect(angleToVelocity(37, 0)).toEqual({ vx: 0, vy: 0 })
  })
})

describe('powerToSpeed', () => {
  it('power=0 maps to SPEED_MIN (6000), power=100 maps to SPEED_MAX (26000)', () => {
    expect(powerToSpeed(0)).toBe(6000)
    expect(powerToSpeed(100)).toBe(26000)
  })

  it('clamps out-of-range power', () => {
    expect(powerToSpeed(-40)).toBe(6000)
    expect(powerToSpeed(250)).toBe(26000)
  })

  it('is monotonic non-decreasing across the range', () => {
    let prev = -Infinity
    for (let p = 0; p <= 100; p += 10) {
      const speed = powerToSpeed(p)
      expect(speed).toBeGreaterThanOrEqual(prev)
      prev = speed
    }
  })
})

// -- stepAxis: hand-computed collision primitive -----------------------------
// lo = BALL_R = 6000; hi(x) = BOARD_W - BALL_R = 394000; hi(y) = BOARD_H - BALL_R = 234000.

describe('stepAxis', () => {
  it('vel === 0 is a pure no-op shortcut', () => {
    expect(stepAxis(12345, 0, 6789, 'x', [])).toEqual({ pos: 12345, vel: 0, bounced: false })
  })

  it('moves by the full velocity when it is under MAX_STEP (4000), no collision', () => {
    // step = min(2000, 4000) = 2000; 200000 + 2000 = 202000, well clear of any boundary.
    expect(stepAxis(200000, 2000, 100000, 'x', [])).toEqual({ pos: 202000, vel: 2000, bounced: false })
  })

  it('clamps a single substep to MAX_STEP (4000) even when velocity is larger, no collision', () => {
    // step = min(10000, 4000) = 4000; vel itself is left untouched since there was no bounce.
    expect(stepAxis(200000, 10000, 100000, 'x', [])).toEqual({ pos: 204000, vel: 10000, bounced: false })
  })

  it('bounces off the low board boundary and reflects velocity by RESTITUTION_PERMILLE (970/1000)', () => {
    // step = sign(-5000) * min(5000,4000) = -4000; 8000-4000=4000 < lo(6000) -> clamp to 6000.
    // newVel = -trunc((-5000*970)/1000) = -trunc(-4850) = 4850.
    expect(stepAxis(8000, -5000, 100000, 'x', [])).toEqual({ pos: 6000, vel: 4850, bounced: true })
  })

  it('bounces off the high board boundary on the y axis', () => {
    // hi(y) = 240000-6000 = 234000. step=min(8000,4000)=4000; 233000+4000=237000 > 234000 -> clamp.
    // newVel = -trunc((8000*970)/1000) = -trunc(7760) = -7760.
    expect(stepAxis(233000, 8000, 100000, 'y', [])).toEqual({ pos: 234000, vel: -7760, bounced: true })
  })

  it('bounces off a wall rect when both the perpendicular and along-axis overlap', () => {
    const wall: WallRect = { x0: 100000, x1: 110000, y0: 50000, y1: 150000 }
    // otherPos(y)=100000 is inside [50000,150000] (perp overlap).
    // step=min(8000,4000)=4000; 95000+4000=99000; axisOverlap since 99000+-6000 straddles [100000,110000].
    // vel>0 -> newPos = along0 - BALL_R = 100000-6000 = 94000. newVel = -trunc(8000*970/1000) = -7760.
    expect(stepAxis(95000, 8000, 100000, 'x', [wall])).toEqual({ pos: 94000, vel: -7760, bounced: true })
  })

  it('does not bounce when the perpendicular axis does not overlap the wall', () => {
    const wall: WallRect = { x0: 100000, x1: 110000, y0: 50000, y1: 150000 }
    // otherPos(y)=200000; 200000-BALL_R=194000, not < y1(150000) -> no perp overlap.
    expect(stepAxis(95000, 8000, 200000, 'x', [wall])).toEqual({ pos: 99000, vel: 8000, bounced: false })
  })
})

// -- closestApproach ----------------------------------------------------------

describe('closestApproach', () => {
  it('returns 0 for an empty path', () => {
    expect(closestApproach([], { x: 5, y: 5 })).toBe(0)
  })

  it('picks the minimum distance across the path (exact integer case)', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    // both points are exactly distance 5 from (5,0).
    expect(closestApproach(path, { x: 5, y: 0 })).toBe(5)
  })

  it('hand-computed 3-4-5 triangle distance', () => {
    expect(closestApproach([{ x: 0, y: 0 }], { x: 3, y: 4 })).toBe(5)
  })

  it('floors a non-integer distance (never Math.floor bias into negative territory since distances are >=0)', () => {
    // sqrt(2) = 1.41421356..., floored to 1.
    expect(closestApproach([{ x: 0, y: 0 }], { x: 1, y: 1 })).toBe(1)
  })
})

// -- simulateShot: golden full-shot scenarios --------------------------------

describe('simulateShot -- golden A: straight shot, open board, friction-only decay', () => {
  const level: BankshotLevel = {
    walls: [],
    target: { x: 350 * FP, y: 120 * FP },
    launch: { x: 100 * FP, y: 120 * FP },
  }

  it('comes to rest inside the target after 144 ticks with exactly 1 board-edge bounce', () => {
    const r = simulateShot(level, level.launch.x, level.launch.y, 6000, 0)
    expect(r.restX).toBe(348679)
    expect(r.restY).toBe(120000)
    expect(r.ticks).toBe(144)
    expect(r.bounces).toBe(1)
    expect(r.won).toBe(true)
    expect(r.closestApproach).toBe(75)
    expect(r.path.length).toBe(r.ticks + 1)
  })

  it('closestApproach cross-checks against the standalone closestApproach() helper', () => {
    const r = simulateShot(level, level.launch.x, level.launch.y, 6000, 0)
    expect(closestApproach(r.path, level.target)).toBe(r.closestApproach)
  })

  it('is deterministic: identical inputs produce a byte-identical result', () => {
    const a = simulateShot(level, level.launch.x, level.launch.y, 6000, 0)
    const b = simulateShot(level, level.launch.x, level.launch.y, 6000, 0)
    expect(a).toEqual(b)
  })
})

describe('simulateShot -- power=0 boundary (SPEED_MIN is nonzero, so the ball still moves)', () => {
  it('powerToSpeed(0) -> angleToVelocity(0,...) reproduces golden A exactly', () => {
    const speed = powerToSpeed(0)
    expect(speed).toBe(6000)
    const { vx, vy } = angleToVelocity(0, speed)
    expect({ vx, vy }).toEqual({ vx: 6000, vy: 0 })

    const level: BankshotLevel = {
      walls: [],
      target: { x: 350 * FP, y: 120 * FP },
      launch: { x: 100 * FP, y: 120 * FP },
    }
    const r = simulateShot(level, level.launch.x, level.launch.y, vx, vy)
    expect(r.restX).toBe(348679)
    expect(r.restY).toBe(120000)
    expect(r.won).toBe(true)
  })
})

describe('simulateShot -- golden B: board-edge bounce (no walls)', () => {
  it('bounces once off the right board edge, comes to rest short of the target', () => {
    const level: BankshotLevel = {
      walls: [],
      target: { x: 350 * FP, y: 120 * FP },
      launch: { x: 380 * FP, y: 120 * FP },
    }
    const r = simulateShot(level, level.launch.x, level.launch.y, 10000, 0)
    expect(r.restX).toBe(165691)
    expect(r.restY).toBe(120000)
    expect(r.ticks).toBe(167)
    expect(r.bounces).toBe(2)
    expect(r.won).toBe(false)
    // First bounce is off the board's right edge: hi(x) = BOARD_W - BALL_R = 394000.
    expect(r.bouncePoints[0]).toEqual({ x: 394000, y: 120000 })
  })
})

describe('simulateShot -- golden C: multi-bounce off a rectangular wall', () => {
  it('reflects off the wall multiple times before settling, missing the target', () => {
    const level: BankshotLevel = {
      walls: [{ x0: 200 * FP, y0: 50 * FP, x1: 210 * FP, y1: 200 * FP }],
      target: { x: 50 * FP, y: 120 * FP },
      launch: { x: 100 * FP, y: 120 * FP },
    }
    const r = simulateShot(level, level.launch.x, level.launch.y, 15000, 3000)
    expect(r.restX).toBe(155379)
    expect(r.restY).toBe(23554)
    expect(r.ticks).toBe(184)
    expect(r.bounces).toBe(5)
    expect(r.won).toBe(false)
    expect(r.bouncePoints.length).toBe(5)
  })
})

describe('simulateShot -- win boundary is inclusive at exactly TARGET_R', () => {
  const launch = { x: 100 * FP, y: 120 * FP }
  // Golden A's rest position (deterministic, independent of target): (348679, 120000).

  it('rest position exactly TARGET_R away from target center -> won (boundary inclusive)', () => {
    const level: BankshotLevel = { walls: [], target: { x: 348679, y: 120000 + TARGET_R }, launch }
    const r = simulateShot(level, launch.x, launch.y, 6000, 0)
    expect(r.restX).toBe(348679)
    expect(r.restY).toBe(120000)
    expect(r.won).toBe(true)
  })

  it('rest position 1 unit past TARGET_R -> not won', () => {
    const level: BankshotLevel = { walls: [], target: { x: 348679, y: 120000 + TARGET_R + 1 }, launch }
    const r = simulateShot(level, launch.x, launch.y, 6000, 0)
    expect(r.won).toBe(false)
  })
})

describe('simulateShot -- MAX_TICKS safety valve invariant', () => {
  it('always terminates within MAX_TICKS and path.length === ticks + 1, across several speeds/angles', () => {
    const level: BankshotLevel = {
      walls: [{ x0: 150 * FP, y0: 100 * FP, x1: 160 * FP, y1: 140 * FP }],
      target: { x: 380 * FP, y: 230 * FP },
      launch: { x: 30 * FP, y: 10 * FP },
    }
    const cases: [number, number][] = [
      [6000, 0],
      [26000, 26000],
      [-26000, 5000],
      [0, 26000],
      [15000, -12000],
    ]
    for (const [vx0, vy0] of cases) {
      const r = simulateShot(level, level.launch.x, level.launch.y, vx0, vy0)
      expect(r.ticks).toBeLessThanOrEqual(MAX_TICKS)
      expect(r.path.length).toBe(r.ticks + 1)
      expect(r.path[0]).toEqual({ x: level.launch.x, y: level.launch.y })
    }
  })
})

// -- Scoring -------------------------------------------------------------------

describe('scoreOnWin', () => {
  it('is exactly WIN_BONUS + SHOT_BONUS_MAX when shots taken is at or under par', () => {
    expect(scoreOnWin(3, 5)).toBe(WIN_BONUS + SHOT_BONUS_MAX)
    expect(scoreOnWin(5, 5)).toBe(WIN_BONUS + SHOT_BONUS_MAX)
  })

  it('shrinks the bonus proportionally once shots taken exceeds par', () => {
    // WIN_BONUS(1000) + round(SHOT_BONUS_MAX(1000) * min(1, 5/10)) = 1000 + 500.
    expect(scoreOnWin(10, 5)).toBe(1500)
  })
})

describe('scoreOnMiss', () => {
  it('is exactly PRECISION_BONUS_MAX at distance 0 and at exactly TARGET_R', () => {
    expect(scoreOnMiss(0)).toBe(30)
    expect(scoreOnMiss(TARGET_R)).toBe(30)
  })

  it('is exactly 0 at and past PRECISION_RADIUS', () => {
    expect(scoreOnMiss(PRECISION_RADIUS)).toBe(0)
    expect(scoreOnMiss(PRECISION_RADIUS + 1)).toBe(0)
  })

  it('interpolates linearly in between (hand-verifiable midpoint)', () => {
    // t = (60000-30000)/(60000-14000) = 0.652173913..., round(30*t) = 20.
    expect(scoreOnMiss(30 * FP)).toBe(20)
  })
})

// -- generateLevel: rng consumption order + placement-failure edge case -------

describe('generateLevel -- rng consumption order (golden, reproducible via mulberry32)', () => {
  it('pins the exact wall/target for a minimal 1-wall config at seed=5 (7 total rng calls)', () => {
    const cfg: BankshotConfig = { minWalls: 1, maxWalls: 1, wallMinLen: 50 * FP, wallMaxLen: 60 * FP, par: 3 }
    const launch = { x: 30 * FP, y: 210 * FP }
    let callCount = 0
    const counting: Rng = (() => {
      const base = mulberry32(5)
      return () => {
        callCount++
        return base()
      }
    })()

    const level = generateLevel(cfg, launch, counting)
    // 1 call for wallCount + 4 calls for the (successful, first-attempt) wall
    // + 2 calls for the (successful, first-attempt) target = 7.
    expect(callCount).toBe(7)
    expect(level.walls).toEqual([{ x0: 243039, y0: 15989, x1: 253039, y1: 68186 }])
    expect(level.target).toEqual({ x: 230598, y: 157857 })
    expect(level.launch).toEqual(launch)
  })

  it('is deterministic for a fixed (cfg, seed)', () => {
    const cfg: BankshotConfig = BANKSHOT_DIFFICULTIES.normal
    const launch = LAUNCH_POINT.normal
    const a = generateLevel(cfg, launch, mulberry32(123))
    const b = generateLevel(cfg, launch, mulberry32(123))
    expect(a).toEqual(b)
  })

  it('produces different levels for different seeds', () => {
    const cfg: BankshotConfig = BANKSHOT_DIFFICULTIES.normal
    const launch = LAUNCH_POINT.normal
    const a = generateLevel(cfg, launch, mulberry32(1))
    const b = generateLevel(cfg, launch, mulberry32(2))
    expect(a).not.toEqual(b)
  })
})

describe('generateLevel -- a wall that fails every placement attempt is simply skipped (never throws)', () => {
  it('an rng that always returns 0 always overlaps the launch safe radius -> 0 walls placed, target falls back to board center', () => {
    const cfg: BankshotConfig = { minWalls: 1, maxWalls: 1, wallMinLen: 50 * FP, wallMaxLen: 50 * FP, par: 3 }
    const launch = { x: 5 * FP, y: 5 * FP }
    let calls = 0
    const alwaysZero: Rng = () => {
      calls++
      return 0
    }
    const level = generateLevel(cfg, launch, alwaysZero)
    expect(level.walls).toEqual([])
    // Fallback target: { x: trunc(BOARD_W/2), y: trunc(BOARD_H/2) }.
    expect(level.target).toEqual({ x: Math.trunc(BOARD_W / 2), y: Math.trunc(BOARD_H / 2) })
    // 1 (wallCount) + MAX_PLACEMENT_ATTEMPTS(40)*4 (wall, all fail) + 40*2 (target, all fail) = 241.
    expect(calls).toBe(241)
  })
})

describe('generateLevel -- structural invariants across seeds and difficulties', () => {
  it('never places two walls closer than WALL_MARGIN, keeps every wall clear of the launch, and keeps the target clear of walls and far enough from launch', () => {
    for (const [name, cfg] of Object.entries(BANKSHOT_DIFFICULTIES)) {
      const launch = LAUNCH_POINT[name as keyof typeof LAUNCH_POINT]
      for (let seed = 1; seed <= 25; seed++) {
        const level = generateLevel(cfg, launch, mulberry32(seed))
        expect(level.walls.length).toBeLessThanOrEqual(cfg.maxWalls)

        for (const w of level.walls) {
          expect(w.x0).toBeGreaterThanOrEqual(0)
          expect(w.y0).toBeGreaterThanOrEqual(0)
          expect(w.x1).toBeLessThanOrEqual(BOARD_W)
          expect(w.y1).toBeLessThanOrEqual(BOARD_H)
        }

        for (let i = 0; i < level.walls.length; i++) {
          for (let j = i + 1; j < level.walls.length; j++) {
            const a = level.walls[i]
            const b = level.walls[j]
            const separated =
              a.x1 + 8000 <= b.x0 || b.x1 + 8000 <= a.x0 || a.y1 + 8000 <= b.y0 || b.y1 + 8000 <= a.y0
            expect(separated).toBe(true)
          }
        }

        const dx = level.target.x - launch.x
        const dy = level.target.y - launch.y
        expect(dx * dx + dy * dy).toBeGreaterThanOrEqual(120000 * 120000)
      }
    }
  })
})

// -- createGame ------------------------------------------------------------

describe('createGame', () => {
  it('starts with a clean slate: power=50, no shots/score, full undo pool, aim pointed at the target', () => {
    const cfg = BANKSHOT_DIFFICULTIES.easy
    const launch = LAUNCH_POINT.easy
    const g = createGame(cfg, 1, launch)
    expect(g.power).toBe(50)
    expect(g.shots).toBe(0)
    expect(g.score).toBe(0)
    expect(g.won).toBe(false)
    expect(g.lastShot).toBeNull()
    expect(g.lastEvent).toBe('none')
    expect(g.undoStack).toEqual([])
    expect(g.undosLeft).toBe(UNDO_POOL)

    const expectedAim =
      ((Math.atan2(g.level.target.y - launch.y, g.level.target.x - launch.x) * 180) / Math.PI + 360) % 360
    expect(g.aimDeg).toBeCloseTo(expectedAim, 9)
  })

  it('pins the exact aim/target for (cfg=easy-shaped no-walls, seed=42, launch=(30*FP,210*FP))', () => {
    const cfg: BankshotConfig = { minWalls: 0, maxWalls: 0, wallMinLen: 50 * FP, wallMaxLen: 60 * FP, par: 3 }
    const g = createGame(cfg, 42, { x: 30 * FP, y: 210 * FP })
    expect(g.aimDeg).toBeCloseTo(349.1198124709316, 9)
    expect(g.level.target).toEqual({ x: 182832, y: 180624 })
    expect(g.level.walls).toEqual([])
  })
})

describe('BANKSHOT_DIFFICULTIES / DAILY_CONFIG / LAUNCH_POINT', () => {
  it('every difficulty has minWalls <= maxWalls and a positive par', () => {
    for (const cfg of Object.values(BANKSHOT_DIFFICULTIES)) {
      expect(cfg.minWalls).toBeLessThanOrEqual(cfg.maxWalls)
      expect(cfg.par).toBeGreaterThan(0)
    }
  })

  it('DAILY_CONFIG is the normal difficulty', () => {
    expect(DAILY_CONFIG).toBe(BANKSHOT_DIFFICULTIES.normal)
  })

  it('the launch point is difficulty-fixed, never randomized (same for all three)', () => {
    expect(LAUNCH_POINT.easy).toEqual(LAUNCH_POINT.normal)
    expect(LAUNCH_POINT.normal).toEqual(LAUNCH_POINT.hard)
  })
})

// -- Reducer -----------------------------------------------------------------

function baseState(overrides: Partial<BankshotState> = {}): BankshotState {
  const config: BankshotConfig = { minWalls: 0, maxWalls: 0, wallMinLen: 50 * FP, wallMaxLen: 60 * FP, par: 3 }
  const level: BankshotLevel = {
    walls: [],
    target: { x: 348679, y: 120000 },
    launch: { x: 100000, y: 120000 },
  }
  return {
    config,
    seed: 1,
    level,
    aimDeg: 0,
    power: 50,
    shots: 0,
    score: 0,
    won: false,
    lost: false,
    lastShot: null,
    lastEvent: 'none',
    undoStack: [],
    undosLeft: UNDO_POOL,
    ...overrides,
  }
}

describe('reduce -- setAngle / setPower', () => {
  it('setAngle wraps negative and over-360 values into [0,360)', () => {
    expect(reduce(baseState(), { type: 'setAngle', deg: -10 }).aimDeg).toBe(350)
    expect(reduce(baseState(), { type: 'setAngle', deg: 370 }).aimDeg).toBe(10)
  })

  it('setPower clamps to [0,100] and rounds fractional input', () => {
    expect(reduce(baseState(), { type: 'setPower', power: -5 }).power).toBe(0)
    expect(reduce(baseState(), { type: 'setPower', power: 150 }).power).toBe(100)
    expect(reduce(baseState(), { type: 'setPower', power: 33.6 }).power).toBe(34)
  })

  it('both reset lastEvent to none', () => {
    const dirty = baseState({ lastEvent: 'win' })
    expect(reduce(dirty, { type: 'setAngle', deg: 5 }).lastEvent).toBe('none')
    expect(reduce(dirty, { type: 'setPower', power: 5 }).lastEvent).toBe('none')
  })
})

describe('reduce -- fire (golden miss, repeatable/deterministic)', () => {
  it('a deterministic miss sequence: identical repeated shots accrue score by the same amount each time', () => {
    const cfg: BankshotConfig = { minWalls: 0, maxWalls: 0, wallMinLen: 50 * FP, wallMaxLen: 60 * FP, par: 3 }
    let s = createGame(cfg, 42, { x: 30 * FP, y: 210 * FP })
    s = reduce(s, { type: 'setAngle', deg: 0 })
    s = reduce(s, { type: 'setPower', power: 50 })

    s = reduce(s, { type: 'fire' })
    expect(s.shots).toBe(1)
    expect(s.won).toBe(false)
    expect(s.lastEvent).toBe('miss')
    expect(s.score).toBe(20)
    expect(s.lastShot?.restX).toBe(152944)
    expect(s.lastShot?.restY).toBe(210000)
    expect(s.lastShot?.bounces).toBe(2)
    expect(s.lastShot?.closestApproach).toBe(29546)
    expect(s.undoStack.length).toBe(1)

    s = reduce(s, { type: 'fire' })
    expect(s.shots).toBe(2)
    expect(s.score).toBe(40)
    s = reduce(s, { type: 'fire' })
    expect(s.shots).toBe(3)
    expect(s.score).toBe(60)
  })
})

describe('reduce -- fire (golden win via a hand-built level)', () => {
  it('landing inside the target awards WIN_BONUS + full SHOT_BONUS_MAX on the first shot', () => {
    let s = baseState()
    s = reduce(s, { type: 'setAngle', deg: 0 })
    s = reduce(s, { type: 'setPower', power: 0 }) // power=0 -> SPEED_MIN=6000, still a valid nonzero shot
    s = reduce(s, { type: 'fire' })

    expect(s.won).toBe(true)
    expect(s.lastEvent).toBe('win')
    expect(s.shots).toBe(1)
    expect(s.score).toBe(2000) // WIN_BONUS(1000) + round(SHOT_BONUS_MAX(1000) * min(1, 3/1))
    expect(s.lastShot?.restX).toBe(348679)
    expect(s.lastShot?.restY).toBe(120000)
    expect(s.undoStack.length).toBe(1)
  })

  it('firing again after a win is illegal and leaves score/shots untouched', () => {
    let s = baseState()
    s = reduce(s, { type: 'setPower', power: 0 })
    s = reduce(s, { type: 'fire' })
    expect(s.won).toBe(true)

    const again = reduce(s, { type: 'fire' })
    expect(again.lastEvent).toBe('illegal')
    expect(again.won).toBe(true)
    expect(again.shots).toBe(1)
    expect(again.score).toBe(2000)
  })
})

describe('reduce -- undo', () => {
  it('caps the undo stack at UNDO_POOL (3) even after more than 3 shots', () => {
    const cfg: BankshotConfig = { minWalls: 0, maxWalls: 0, wallMinLen: 50 * FP, wallMaxLen: 60 * FP, par: 3 }
    let s = createGame(cfg, 42, { x: 30 * FP, y: 210 * FP })
    s = reduce(s, { type: 'setAngle', deg: 0 })
    s = reduce(s, { type: 'setPower', power: 50 })
    for (let i = 0; i < 4; i++) s = reduce(s, { type: 'fire' })
    expect(s.shots).toBe(4)
    expect(s.undoStack.length).toBe(UNDO_POOL)
  })

  it('reverts shots/score/won/lastShot to the pre-fire snapshot and decrements undosLeft, without refunding a free win', () => {
    const cfg: BankshotConfig = { minWalls: 0, maxWalls: 0, wallMinLen: 50 * FP, wallMaxLen: 60 * FP, par: 3 }
    let s = createGame(cfg, 42, { x: 30 * FP, y: 210 * FP })
    s = reduce(s, { type: 'setAngle', deg: 0 })
    s = reduce(s, { type: 'setPower', power: 50 })
    for (let i = 0; i < 4; i++) s = reduce(s, { type: 'fire' })
    expect(s.shots).toBe(4)
    expect(s.score).toBe(80)

    s = reduce(s, { type: 'undo' })
    expect(s.shots).toBe(3)
    expect(s.score).toBe(60)
    expect(s.undosLeft).toBe(UNDO_POOL - 1)
    expect(s.undoStack.length).toBe(2)
    expect(s.lastEvent).toBe('undo')
    // Undo does not touch the shot counter's forward progress in a way that
    // could be exploited: it only restores an earlier real snapshot, it never
    // grants an extra shot or resets shots to 0 while leaving score intact.
  })

  it('undoing a win restores won=false (the board unlocks again)', () => {
    let s = baseState()
    s = reduce(s, { type: 'setPower', power: 0 })
    s = reduce(s, { type: 'fire' })
    expect(s.won).toBe(true)

    s = reduce(s, { type: 'undo' })
    expect(s.won).toBe(false)
    expect(s.shots).toBe(0)
    expect(s.score).toBe(0)
    expect(s.undosLeft).toBe(UNDO_POOL - 1)
  })

  it('is a no-op when undosLeft is exhausted', () => {
    const dirty = baseState({ undosLeft: 0, undoStack: [{ shots: 0, score: 0, won: false, lost: false, lastShot: null }] })
    const out = reduce(dirty, { type: 'undo' })
    expect(out.lastEvent).toBe('none')
    expect(out.undoStack.length).toBe(1)
    expect(out.undosLeft).toBe(0)
  })

  it('is a no-op when the undo stack is empty, even with undos remaining', () => {
    const dirty = baseState({ undosLeft: 2, undoStack: [] })
    const out = reduce(dirty, { type: 'undo' })
    expect(out.lastEvent).toBe('none')
    expect(out.undosLeft).toBe(2)
  })
})

describe('reduce -- reset / new', () => {
  it('reset regenerates the identical board (same seed+launch) and clears shots/score/won/undo', () => {
    const cfg: BankshotConfig = { minWalls: 0, maxWalls: 0, wallMinLen: 50 * FP, wallMaxLen: 60 * FP, par: 3 }
    const g = createGame(cfg, 42, { x: 30 * FP, y: 210 * FP })
    let s = reduce(g, { type: 'setPower', power: 80 })
    s = reduce(s, { type: 'fire' })
    expect(s.shots).toBe(1)

    const reset = reduce(s, { type: 'reset' })
    expect(reset.level).toEqual(g.level)
    expect(reset.shots).toBe(0)
    expect(reset.score).toBe(0)
    expect(reset.won).toBe(false)
    expect(reset.undoStack).toEqual([])
    expect(reset.undosLeft).toBe(UNDO_POOL)
  })

  it('new produces the requested seed and (generally) a different board while keeping the launch point', () => {
    const cfg: BankshotConfig = { minWalls: 2, maxWalls: 3, wallMinLen: 50 * FP, wallMaxLen: 120 * FP, par: 3 }
    const launch = { x: 30 * FP, y: 210 * FP }
    const g = createGame(cfg, 1, launch)
    const out = reduce(g, { type: 'new', seed: 2 })
    expect(out.seed).toBe(2)
    expect(out.level.launch).toEqual(launch)
    expect(out.level).not.toEqual(g.level)
    expect(out.shots).toBe(0)
    expect(out.undosLeft).toBe(UNDO_POOL)
  })
})

// -- Shot limit (audit 2026-10-10: no fail state, infinite retries always won) --

describe('shot limit', () => {
  const cfg: BankshotConfig = { minWalls: 0, maxWalls: 0, wallMinLen: 50 * FP, wallMaxLen: 60 * FP, par: 3 }
  function missingRun() {
    let s = createGame(cfg, 42, { x: 30 * FP, y: 210 * FP })
    s = reduce(s, { type: 'setAngle', deg: 0 })
    return reduce(s, { type: 'setPower', power: 50 }) // known deterministic miss (see golden miss)
  }

  it('the limit is par + SHOT_SLACK (3)', () => {
    expect(SHOT_SLACK).toBe(3)
    expect(shotLimit(3)).toBe(6)
    expect(shotLimit(BANKSHOT_DIFFICULTIES.hard.par)).toBe(10)
  })

  it('missing on the last allowed shot ends the board as a loss', () => {
    let s = missingRun()
    for (let i = 0; i < shotLimit(3) - 1; i++) {
      s = reduce(s, { type: 'fire' })
      expect(s.lost).toBe(false)
    }
    s = reduce(s, { type: 'fire' })
    expect(s.shots).toBe(6)
    expect(s.lost).toBe(true)
    expect(s.won).toBe(false)
    expect(s.lastEvent).toBe('lose')
  })

  it('no more shots (and no more miss-precision score farming) after the loss; undo cannot revive it', () => {
    let s = missingRun()
    for (let i = 0; i < shotLimit(3); i++) s = reduce(s, { type: 'fire' })
    const score = s.score
    const again = reduce(s, { type: 'fire' })
    expect(again.lastEvent).toBe('illegal')
    expect(again.shots).toBe(6)
    expect(again.score).toBe(score)
    const undone = reduce(s, { type: 'undo' })
    expect(undone.lost).toBe(true)
    expect(undone.shots).toBe(6)
  })

  it('a win on the last allowed shot still counts', () => {
    let s = baseState({ shots: shotLimit(3) - 1 })
    s = reduce(s, { type: 'setPower', power: 0 })
    s = reduce(s, { type: 'fire' })
    expect(s.won).toBe(true)
    expect(s.lost).toBe(false)
  })

  it('brute-force retrying no longer always wins: a blind sweep of random shots mostly fails the daily board', () => {
    // Before: unlimited shots, so any policy eventually won (100%).
    let wins = 0
    const trials = 200
    for (let seed = 0; seed < trials; seed++) {
      const rng = mulberry32(seed + 7)
      let s = createGame(DAILY_CONFIG, 20260000 + seed, LAUNCH_POINT.normal)
      while (!s.won && !s.lost) {
        s = reduce(s, { type: 'setAngle', deg: Math.floor(rng() * 360) })
        s = reduce(s, { type: 'setPower', power: Math.floor(rng() * 101) })
        s = reduce(s, { type: 'fire' })
      }
      if (s.won) wins++
      expect(s.shots).toBeLessThanOrEqual(shotLimit(DAILY_CONFIG.par))
    }
    expect(wins / trials).toBeLessThan(0.5)
  })
})
