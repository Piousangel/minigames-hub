import { describe, expect, it } from 'vitest'
import {
  BONUS_PER_UNUSED_SHOT,
  DIFFICULTIES,
  FRICTION,
  HOG_LINE_Y,
  HOUSE_CENTER,
  HOUSE_R1,
  HOUSE_R2,
  HOUSE_R3,
  MAX_ANGLE_DEG,
  MAX_TICKS_PER_THROW,
  SHEET_LENGTH,
  STONE_MASS_GUARD,
  STONE_MASS_NORMAL,
  STONE_RADIUS,
  applyRemoval,
  computeHouseScore,
  computeTarget,
  createGame,
  generateObstacles,
  isSettled,
  mulberry32,
  reduce,
  resolveThrow,
  ringValue,
  simulateThrow,
  stepTick,
  vecLen,
  vecNorm,
  vecSub,
  type HoglineConfig,
  type HoglineState,
  type Stone,
} from './engine'

const NORMAL: HoglineConfig = DIFFICULTIES.normal

function mkStone(overrides: Partial<Stone> & { id: number }): Stone {
  return {
    color: 'yellow',
    mass: STONE_MASS_NORMAL,
    radius: STONE_RADIUS,
    pos: { x: 50, y: 50 },
    vel: { x: 0, y: 0 },
    guard: false,
    ...overrides,
  }
}

/** Hand-build a state for reducer tests (bypasses generation). */
function stateWith(overrides: Partial<HoglineState> = {}): HoglineState {
  return {
    config: NORMAL,
    seed: 1,
    target: 40,
    stones: [],
    nextId: 0,
    power: 0.5,
    angle: 0,
    shotsLeft: NORMAL.shotsAllowed,
    shotsUsed: 0,
    score: 0,
    houseScore: 0,
    finished: false,
    won: false,
    lastThrow: null,
    lastEvent: 'none',
    ...overrides,
  }
}

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('vector primitives', () => {
  // 1. vecNorm total function.
  it('vecNorm({0,0}) returns {0,0}, not NaN', () => {
    const n = vecNorm({ x: 0, y: 0 })
    expect(n).toEqual({ x: 0, y: 0 })
    expect(Number.isNaN(n.x)).toBe(false)
    expect(Number.isNaN(n.y)).toBe(false)
  })

  it('vecNorm produces a unit vector for a non-zero input', () => {
    const n = vecNorm({ x: 3, y: 4 })
    expect(vecLen(n)).toBeCloseTo(1, 10)
  })
})

describe('ringValue', () => {
  // 2. Boundaries.
  it('is monotonic non-increasing and inclusive on the inner comparison', () => {
    expect(ringValue(0)).toBe(3)
    expect(ringValue(HOUSE_R3)).toBe(3)
    expect(ringValue(HOUSE_R3 + 0.01)).toBe(2)
    expect(ringValue(HOUSE_R2)).toBe(2)
    expect(ringValue(HOUSE_R2 + 0.01)).toBe(1)
    expect(ringValue(HOUSE_R1)).toBe(1)
    expect(ringValue(HOUSE_R1 + 0.01)).toBe(0)
  })
})

describe('stepTick', () => {
  // 3. Straight-line motion, no obstacles.
  it('integrates position by pre-tick velocity and decays velocity by friction', () => {
    const stone = mkStone({ id: 0, pos: { x: 50, y: 50 }, vel: { x: 0, y: 2 } })
    const { stones } = stepTick([stone])
    expect(stones[0].pos.y).toBeCloseTo(52, 10)
    expect(stones[0].vel.y).toBeCloseTo(2 * (1 - FRICTION), 10)
  })

  // 4. Epsilon snap.
  it('snaps velocity to exactly {0,0} once post-friction speed drops below STOP_EPS', () => {
    const stone = mkStone({ id: 0, pos: { x: 50, y: 50 }, vel: { x: 0.03, y: 0 } })
    const { stones } = stepTick([stone])
    expect(stones[0].vel).toEqual({ x: 0, y: 0 })
  })

  // 5. Wall bounce.
  it('reflects a stone approaching the x=0 wall and clamps position to the radius', () => {
    const stone = mkStone({ id: 0, pos: { x: 3.0, y: 50 }, vel: { x: -1.0, y: 0 } })
    const { stones } = stepTick([stone])
    expect(stones[0].pos.x).toBeCloseTo(STONE_RADIUS, 10)
    expect(stones[0].vel.x).toBeGreaterThan(0) // sign flipped
    expect(stones[0].vel.x).toBeCloseTo(1.0 * (1 - FRICTION), 10)
  })

  // 6. Golden — equal-mass head-on collision: full velocity swap.
  it('golden: equal-mass head-on collision swaps velocities', () => {
    const a = mkStone({ id: 0, pos: { x: 10, y: 50 }, vel: { x: 1, y: 0 } })
    const b = mkStone({ id: 1, pos: { x: 14, y: 50 }, vel: { x: 0, y: 0 } })
    const { stones, collisions } = stepTick([a, b])
    expect(collisions).toBe(1)
    expect(stones[0].vel).toEqual({ x: 0, y: 0 }) // A stops dead
    expect(stones[1].vel.x).toBeCloseTo(1 * (1 - FRICTION), 10) // B takes over A's speed
    expect(stones[1].vel.y).toBeCloseTo(0, 10)
  })

  // 7. Golden — unequal-mass collision + momentum conservation.
  it('golden: unequal-mass collision matches closed-form impulse and conserves momentum', () => {
    const mA = STONE_MASS_NORMAL // 1
    const mB = STONE_MASS_GUARD // 1.8
    const a = mkStone({ id: 0, mass: mA, pos: { x: 10, y: 50 }, vel: { x: 2, y: 0 } })
    const b = mkStone({ id: 1, mass: mB, pos: { x: 16, y: 50 }, vel: { x: 0, y: 0 } })
    const { stones, collisions } = stepTick([a, b])
    expect(collisions).toBe(1)

    const expectedVelA = (-4 / 7) * (1 - FRICTION)
    const expectedVelB = (10 / 7) * (1 - FRICTION)
    expect(stones[0].vel.x).toBeCloseTo(expectedVelA, 5)
    expect(stones[1].vel.x).toBeCloseTo(expectedVelB, 5)

    // Momentum before friction: mA*2 + mB*0 = 2. Friction scales both
    // velocities uniformly, so post-tick momentum should be 2*(1-FRICTION).
    const momentumAfter = mA * stones[0].vel.x + mB * stones[1].vel.x
    expect(momentumAfter).toBeCloseTo(2 * (1 - FRICTION), 5)
  })

  // 8. Overlapping stones actually get separated (no residual tunneling).
  it('separates overlapping stones so post-tick distance >= radius sum', () => {
    const a = mkStone({ id: 0, pos: { x: 20, y: 10 }, vel: { x: 0, y: 0 } })
    const b = mkStone({ id: 1, pos: { x: 21, y: 10 }, vel: { x: 0, y: 0 } })
    const { stones } = stepTick([a, b])
    const dist = vecLen(vecSub(stones[1].pos, stones[0].pos))
    expect(dist).toBeGreaterThanOrEqual(2 * STONE_RADIUS - 1e-9)
  })

  // 9. Degenerate zero-distance pair: no NaN, uses the {1,0} fallback normal.
  it('handles a zero-distance pair without producing NaN', () => {
    const a = mkStone({ id: 0, pos: { x: 50, y: 50 }, vel: { x: 0, y: 0 } })
    const b = mkStone({ id: 1, pos: { x: 50, y: 50 }, vel: { x: 0, y: 0 } })
    const { stones } = stepTick([a, b])
    for (const s of stones) {
      expect(Number.isFinite(s.pos.x)).toBe(true)
      expect(Number.isFinite(s.pos.y)).toBe(true)
      expect(Number.isFinite(s.vel.x)).toBe(true)
      expect(Number.isFinite(s.vel.y)).toBe(true)
    }
    // Pushed apart along the fallback normal (1,0).
    expect(stones[1].pos.x).toBeGreaterThan(stones[0].pos.x)
    expect(stones[0].pos.y).toBeCloseTo(50, 10)
  })

  it('never increases speed in the friction sub-step alone', () => {
    const stone = mkStone({ id: 0, pos: { x: 50, y: 50 }, vel: { x: 0, y: 3 } })
    const before = vecLen(stone.vel)
    const { stones } = stepTick([stone])
    expect(vecLen(stones[0].vel)).toBeLessThanOrEqual(before)
  })
})

describe('isSettled', () => {
  it('true iff every stone has zero velocity', () => {
    expect(isSettled([mkStone({ id: 0, vel: { x: 0, y: 0 } })])).toBe(true)
    expect(isSettled([mkStone({ id: 0, vel: { x: 0.1, y: 0 } })])).toBe(false)
    expect(isSettled([])).toBe(true)
  })
})

describe('simulateThrow', () => {
  // 10. Solo stone settles; frame 0 matches the release position exactly.
  it('solo stone on an empty board settles within the tick cap', () => {
    const released = mkStone({ id: 0, pos: { x: 50, y: 3.4 }, vel: { x: 0, y: 1 } })
    const { frames, finalStones, ticksUsed } = simulateThrow([], released)
    expect(isSettled(finalStones)).toBe(true)
    expect(ticksUsed).toBeLessThan(MAX_TICKS_PER_THROW)
    expect(frames[0].stones).toEqual([{ id: 0, pos: { x: 50, y: 3.4 } }])
  })

  // 11. Determinism.
  it('is deterministic for identical inputs', () => {
    const stones = [mkStone({ id: 0, pos: { x: 30, y: 60 } })]
    const released1 = mkStone({ id: 1, pos: { x: 50, y: 3.4 }, vel: { x: 0.3, y: 2 } })
    const released2 = mkStone({ id: 1, pos: { x: 50, y: 3.4 }, vel: { x: 0.3, y: 2 } })
    const r1 = simulateThrow(stones.map((s) => ({ ...s, pos: { ...s.pos }, vel: { ...s.vel } })), released1)
    const r2 = simulateThrow(stones.map((s) => ({ ...s, pos: { ...s.pos }, vel: { ...s.vel } })), released2)
    expect(r1.frames).toEqual(r2.frames)
  })

  // 12. frames.length === ticksUsed + 1 always.
  it('always records exactly ticksUsed + 1 frames', () => {
    const released = mkStone({ id: 0, pos: { x: 50, y: 3.4 }, vel: { x: 0, y: 3 } })
    const { frames, ticksUsed } = simulateThrow([], released)
    expect(frames.length).toBe(ticksUsed + 1)
  })
})

describe('applyRemoval', () => {
  // 13. Hogged.
  it('removes a stone resting below the hog line', () => {
    const s = mkStone({ id: 0, pos: { x: 50, y: 10 } })
    const { kept, removed } = applyRemoval([s])
    expect(removed).toEqual([s])
    expect(kept).toEqual([])
  })

  // 14. Thrown through the back.
  it('removes a stone resting past the back line', () => {
    const s = mkStone({ id: 0, pos: { x: 50, y: 225 } })
    const { kept, removed } = applyRemoval([s])
    expect(removed).toEqual([s])
    expect(kept).toEqual([])
  })

  // 15. In-bounds unchanged.
  it('keeps a legal in-bounds stone unchanged', () => {
    const s = mkStone({ id: 0, pos: { x: 50, y: 100 } })
    const { kept, removed } = applyRemoval([s])
    expect(kept).toEqual([s])
    expect(removed).toEqual([])
  })

  it('kept.length + removed.length === input length, order preserved', () => {
    const a = mkStone({ id: 0, pos: { x: 50, y: 10 } }) // removed
    const b = mkStone({ id: 1, pos: { x: 50, y: 100 } }) // kept
    const c = mkStone({ id: 2, pos: { x: 50, y: 225 } }) // removed
    const { kept, removed } = applyRemoval([a, b, c])
    expect(kept.length + removed.length).toBe(3)
    expect(kept).toEqual([b])
  })
})

describe('computeHouseScore', () => {
  // 16. Empty.
  it('empty stone list scores nothing', () => {
    expect(computeHouseScore([])).toEqual({ houseScore: 0, controlling: null, counted: [] })
  })

  // 17. Golden — single yellow at the button.
  it('golden: single yellow at dead center scores the button value', () => {
    const s = mkStone({ id: 0, color: 'yellow', pos: { ...HOUSE_CENTER } })
    const result = computeHouseScore([s])
    expect(result).toEqual({ houseScore: 3, controlling: 'yellow', counted: [0] })
  })

  // 18. Golden — red controls, yellow scores nothing.
  it('golden: a closer red controls the house even though a yellow is also in', () => {
    const yellow = mkStone({ id: 0, color: 'yellow', pos: { x: HOUSE_CENTER.x + 2, y: HOUSE_CENTER.y } })
    const red = mkStone({ id: 1, color: 'red', pos: { x: HOUSE_CENTER.x + 1, y: HOUSE_CENTER.y } })
    const result = computeHouseScore([yellow, red])
    expect(result.controlling).toBe('red')
    expect(result.houseScore).toBe(0)
    expect(result.counted).toEqual([])
  })

  // 19. Golden — two yellows both closer than the nearest red.
  it('golden: sums every yellow closer than the nearest red', () => {
    const y1 = mkStone({ id: 0, color: 'yellow', pos: { x: HOUSE_CENTER.x + 1, y: HOUSE_CENTER.y } }) // dist 1 -> 3
    const y2 = mkStone({ id: 1, color: 'yellow', pos: { x: HOUSE_CENTER.x + 3, y: HOUSE_CENTER.y } }) // dist 3 -> 3
    const red = mkStone({ id: 2, color: 'red', pos: { x: HOUSE_CENTER.x + 10, y: HOUSE_CENTER.y } }) // dist 10
    const result = computeHouseScore([y1, y2, red])
    expect(result.controlling).toBe('yellow')
    expect(result.houseScore).toBe(6)
    expect(result.counted.sort()).toEqual([0, 1])
  })

  it('counts every yellow in-house stone when no red is present at all', () => {
    const y1 = mkStone({ id: 0, color: 'yellow', pos: { x: HOUSE_CENTER.x + 1, y: HOUSE_CENTER.y } })
    const y2 = mkStone({ id: 1, color: 'yellow', pos: { x: HOUSE_CENTER.x + 6, y: HOUSE_CENTER.y } })
    const result = computeHouseScore([y1, y2])
    expect(result.houseScore).toBe(ringValue(1) + ringValue(6))
    expect(result.counted.sort()).toEqual([0, 1])
  })

  it('houseScore > 0 implies controlling === yellow (invariant)', () => {
    const y1 = mkStone({ id: 0, color: 'yellow', pos: { x: HOUSE_CENTER.x, y: HOUSE_CENTER.y } })
    const result = computeHouseScore([y1])
    if (result.houseScore > 0) expect(result.controlling).toBe('yellow')
  })
})

describe('computeTarget', () => {
  // 20. Exact formula.
  it('matches the closed-form formula', () => {
    const cfg: HoglineConfig = { obstacleMin: 3, obstacleMax: 5, shotsAllowed: 6 }
    const obstacles = [mkStone({ id: 0 }), mkStone({ id: 1 }), mkStone({ id: 2 })] // length 3
    expect(computeTarget(cfg, obstacles)).toBe(40 + (5 - 3) * 4)
  })
})

describe('generateObstacles', () => {
  // 21. Determinism.
  it('is deterministic for a fixed seed', () => {
    const a = generateObstacles(NORMAL, mulberry32(777))
    const b = generateObstacles(NORMAL, mulberry32(777))
    expect(a).toEqual(b)
  })

  // 22. Adjacent seeds diverge.
  it('adjacent seeds produce different layouts', () => {
    const a = generateObstacles(NORMAL, mulberry32(20260810))
    const b = generateObstacles(NORMAL, mulberry32(20260811))
    expect(a).not.toEqual(b)
  })

  // 23 + 24. Property tests over many seeds.
  it('property: obstacle count always within [obstacleMin, obstacleMax], never overlapping', () => {
    for (const cfg of [DIFFICULTIES.easy, DIFFICULTIES.normal, DIFFICULTIES.hard]) {
      for (let seed = 0; seed < 50; seed++) {
        const obstacles = generateObstacles(cfg, mulberry32(seed))
        expect(obstacles.length).toBeGreaterThanOrEqual(cfg.obstacleMin)
        expect(obstacles.length).toBeLessThanOrEqual(cfg.obstacleMax)
        for (let i = 0; i < obstacles.length; i++) {
          for (let j = i + 1; j < obstacles.length; j++) {
            const dist = vecLen(vecSub(obstacles[i].pos, obstacles[j].pos))
            expect(dist).toBeGreaterThanOrEqual(STONE_RADIUS * 2 - 1e-9)
          }
        }
      }
    }
  })
})

describe('createGame', () => {
  // 25.
  it('produces the expected initial invariants', () => {
    const g = createGame(NORMAL, 42)
    expect(g.shotsLeft).toBe(NORMAL.shotsAllowed)
    expect(g.score).toBe(0)
    expect(g.finished).toBe(false)
    expect(g.won).toBe(false)
    expect(g.stones).toEqual(generateObstacles(NORMAL, mulberry32(42)))
  })
})

describe('reduce — release (golden integrations)', () => {
  // 26. Straight up the middle on an obstacle-free board lands in the house.
  it('golden: obstacle-free board, default aim, straight shot lands in the house', () => {
    const cfg: HoglineConfig = { obstacleMin: 0, obstacleMax: 0, shotsAllowed: 6 }
    const state = createGame(cfg, 1) // stones: [] (0 obstacles requested)
    expect(state.stones).toEqual([])
    const next = reduce(state, { type: 'release' }) // default aim: power 0.5, angle 0
    expect(next.houseScore).toBeGreaterThan(0)
    expect(next.score).toBe(next.houseScore * 10)
    const released = next.stones.find((s) => s.color === 'yellow')
    expect(released).toBeDefined()
    if (released) {
      const dist = vecLen(vecSub(released.pos, HOUSE_CENTER))
      expect(dist).toBeLessThanOrEqual(HOUSE_R1)
    }
  })

  // 27. Auto-finish after exactly shotsAllowed releases, no explicit bank.
  it('decrements shotsLeft by 1 per release and auto-finishes at exactly 0', () => {
    const cfg: HoglineConfig = { obstacleMin: 0, obstacleMax: 0, shotsAllowed: 3 }
    let state = createGame(cfg, 5)
    expect(state.shotsLeft).toBe(3)
    state = reduce(state, { type: 'release' })
    expect(state.shotsLeft).toBe(2)
    expect(state.finished).toBe(false)
    state = reduce(state, { type: 'release' })
    expect(state.shotsLeft).toBe(1)
    expect(state.finished).toBe(false)
    state = reduce(state, { type: 'release' })
    expect(state.shotsLeft).toBe(0)
    expect(state.finished).toBe(true)
  })

  // 31. Golden — knock-out via a discrete-tick overtake collision.
  it('golden: a knock-out throw removes the obstacle and it leaves state.stones', () => {
    const obstacle = mkStone({ id: 0, color: 'red', pos: { x: 50, y: 40.15 }, vel: { x: 0, y: 0 } })
    const state = stateWith({ stones: [obstacle], nextId: 1, power: 1, angle: 0 })
    const out = resolveThrow(state, 1, 0)
    expect(out.removed.some((s) => s.id === 0 && s.color === 'red')).toBe(true)
    expect(out.stones.some((s) => s.id === 0)).toBe(false)

    const next = reduce(state, { type: 'release' })
    expect(next.lastThrow?.removed.some((s) => s.id === 0)).toBe(true)
    expect(next.stones.some((s) => s.id === 0)).toBe(false)
  })
})

describe('reduce — bank', () => {
  // 28.
  it('finalizes immediately with the unused-shot bonus, then no-ops', () => {
    const state = stateWith({ shotsLeft: 2, score: 50, houseScore: 5, target: 999 })
    const next = reduce(state, { type: 'bank' })
    expect(next.finished).toBe(true)
    expect(next.shotsLeft).toBe(0)
    expect(next.score).toBe(50 + 2 * BONUS_PER_UNUSED_SHOT)
    expect(next.won).toBe(false) // target 999, unreachable

    const afterRelease = reduce(next, { type: 'release' })
    expect(afterRelease).toEqual({ ...next, lastEvent: 'none' })
    const afterBank = reduce(next, { type: 'bank' })
    expect(afterBank).toEqual({ ...next, lastEvent: 'none' })
  })

  // Audit 2026-10-10 [bug/S]: banking on shot 0 used to add 6×15 = 90 ≥ target and win outright.
  it('banking before any throw never wins (bonus does not count toward the target)', () => {
    for (const diff of ['easy', 'normal', 'hard'] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        const next = reduce(createGame(DIFFICULTIES[diff], seed), { type: 'bank' })
        expect(next.finished).toBe(true)
        expect(next.won).toBe(false)
        expect(next.lastEvent).toBe('finish')
      }
    }
  })

  it('banking wins only when the house score already meets the target, and still adds the bonus', () => {
    const below = reduce(stateWith({ shotsLeft: 3, score: 40, houseScore: 4, target: 44 }), { type: 'bank' })
    expect(below.won).toBe(false)
    expect(below.score).toBe(40 + 3 * BONUS_PER_UNUSED_SHOT) // 85 ≥ 44, but the bonus is not house score

    const atTarget = reduce(stateWith({ shotsLeft: 3, score: 50, houseScore: 5, target: 44 }), { type: 'bank' })
    expect(atTarget.won).toBe(true)
    expect(atTarget.lastEvent).toBe('win')
    expect(atTarget.score).toBe(50 + 3 * BONUS_PER_UNUSED_SHOT)
  })

  it('bank with shotsLeft=0 is a no-op', () => {
    const state = stateWith({ shotsLeft: 0 })
    const next = reduce(state, { type: 'bank' })
    expect(next).toEqual({ ...state, lastEvent: 'none' })
  })
})

describe('reduce — aim actions clamp', () => {
  // 29.
  it('setPower / setAngle / nudgePower / nudgeAngle clamp to their legal ranges', () => {
    const state = stateWith()
    expect(reduce(state, { type: 'setPower', power: 2 }).power).toBe(1)
    expect(reduce(state, { type: 'setPower', power: -1 }).power).toBe(0)
    expect(reduce(state, { type: 'setAngle', angle: 100 }).angle).toBe(MAX_ANGLE_DEG)
    expect(reduce(state, { type: 'setAngle', angle: -100 }).angle).toBe(-MAX_ANGLE_DEG)
    expect(reduce(state, { type: 'nudgePower', delta: 10 }).power).toBe(1)
    expect(reduce(state, { type: 'nudgePower', delta: -10 }).power).toBe(0)
    expect(reduce(state, { type: 'nudgeAngle', delta: 100 }).angle).toBe(MAX_ANGLE_DEG)
    expect(reduce(state, { type: 'nudgeAngle', delta: -100 }).angle).toBe(-MAX_ANGLE_DEG)
  })

  it('aimReset returns to power 0.5 / angle 0', () => {
    const state = stateWith({ power: 0.9, angle: 15 })
    const next = reduce(state, { type: 'aimReset' })
    expect(next.power).toBe(0.5)
    expect(next.angle).toBe(0)
  })
})

describe('reduce — reset / new', () => {
  it('reset replays the same seed', () => {
    const state = createGame(NORMAL, 9)
    const mutated = reduce(state, { type: 'setPower', power: 0.9 })
    const next = reduce(mutated, { type: 'reset' })
    expect(next).toEqual(createGame(NORMAL, 9))
  })

  // 30.
  it('new reseeds to the given seed', () => {
    const state = createGame(NORMAL, 9)
    const next = reduce(state, { type: 'new', seed: 123 })
    expect(next).toEqual(createGame(NORMAL, 123))
  })
})

describe('win gating', () => {
  // 32. won only ever set at the finish transition, never mid-run.
  it('score meeting target mid-run does not set won until shots are exhausted', () => {
    const cfg: HoglineConfig = { obstacleMin: 0, obstacleMax: 0, shotsAllowed: 2 }
    let state = { ...createGame(cfg, 1), target: 1 } // trivial target, easily met by shot 1

    state = reduce(state, { type: 'release' })
    expect(state.shotsLeft).toBe(1)
    expect(state.score).toBeGreaterThanOrEqual(state.target)
    expect(state.finished).toBe(false)
    expect(state.won).toBe(false) // NOT won yet — still mid-run

    state = reduce(state, { type: 'release' })
    expect(state.shotsLeft).toBe(0)
    expect(state.finished).toBe(true)
    expect(state.won).toBe(state.score >= state.target)
    expect(state.won).toBe(true)
  })

  it('falling short of target still finishes cleanly with won=false', () => {
    const state = stateWith({ shotsLeft: 1, target: 10_000 })
    const next = reduce(state, { type: 'bank' })
    expect(next.finished).toBe(true)
    expect(next.won).toBe(false)
  })
})

describe('SHEET_LENGTH / HOG_LINE_Y sanity', () => {
  it('constants form a sensible playable band', () => {
    expect(HOG_LINE_Y).toBeLessThan(HOUSE_CENTER.y)
    expect(HOUSE_CENTER.y).toBeLessThan(SHEET_LENGTH)
  })
})
