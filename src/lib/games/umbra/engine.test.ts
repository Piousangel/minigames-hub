import { describe, expect, it } from 'vitest'
import {
  COMBO_CAP,
  COMBO_UNIT,
  FIRST_SPAWN_DELAY,
  GOOD_BASE,
  GOOD_TICKS,
  HITS_PER_LEVEL,
  LANES,
  LIVES,
  MAX_LEVEL,
  PERFECT_BASE,
  PERFECT_TICKS,
  REVEAL_FLOOR,
  REVEAL_START,
  SPAWN_MAX,
  SPAWN_MIN,
  SPEED_POINT,
  SPEED_POOLS,
  TRACK,
  gradeFor,
  isVisible,
  levelForHits,
  maxConcurrentForLevel,
  mulberry32,
  newGame,
  pointsFor,
  positionAt,
  revealForLevel,
  soleLane,
  speedPoolForLevel,
  start,
  step,
  tap,
  visibleFrames,
  type Marble,
  type Rng,
  type UmbraState,
} from './engine'

// -- helpers ----------------------------------------------------------------

/** Cycles through `values` forever. */
function scripted(...values: number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]
}

/** Wraps an Rng and counts calls. */
function counting(rng: Rng): { rng: Rng; calls: () => number } {
  let n = 0
  return {
    rng: () => {
      n++
      return rng()
    },
    calls: () => n,
  }
}

/** Step until state.tick === tick. */
function runTo(s: UmbraState, tick: number, rng: Rng): UmbraState {
  let cur = s
  while (cur.tick < tick) cur = step(cur, rng)
  return cur
}

const ALL_SPEEDS = [...new Set([...SPEED_POOLS.low, ...SPEED_POOLS.mid, ...SPEED_POOLS.high])]

function marble(over: Partial<Marble> = {}): Marble {
  const vx = over.vx ?? 10
  const spawnTick = over.spawnTick ?? 0
  return {
    id: 0,
    lane: 0,
    vx,
    spawnTick,
    exitTick: spawnTick + TRACK / vx,
    revealX: REVEAL_START,
    ...over,
  }
}

/** A running state with hand-placed marbles at a chosen tick. */
function stateWith(marbles: Marble[], over: Partial<UmbraState> = {}): UmbraState {
  return { ...newGame(), phase: 'running', marbles, ...over }
}

/** Never called — proves a path consumes no rng. */
const forbidden: Rng = () => {
  throw new Error('rng must not be consumed on this path')
}

// -- 1. basics / invariants -------------------------------------------------

describe('basics and invariants', () => {
  it('newGame() is a clean ready state', () => {
    const s = newGame()
    expect(s.phase).toBe('ready')
    expect(s.tick).toBe(0)
    expect(s.score).toBe(0)
    expect(s.lives).toBe(LIVES)
    expect(s.level).toBe(1)
    expect(s.marbles).toEqual([])
    expect(s.lastJudgement).toBeNull()
  })

  it('start() runs the game; start() on running/over is harmless', () => {
    const s = start(newGame())
    expect(s.phase).toBe('running')
    expect(s.nextSpawnTick).toBe(FIRST_SPAWN_DELAY)
    expect(start(s)).toBe(s)
    const over: UmbraState = { ...s, phase: 'over' }
    expect(start(over)).toBe(over)
  })

  it("step() is a no-op while phase is 'ready' (tick frozen, rng untouched)", () => {
    const s = newGame()
    const next = step(s, forbidden)
    expect(next.tick).toBe(0)
    expect(next.phase).toBe('ready')
    expect(next.marbles).toEqual([])
  })

  it('every speed in every pool divides TRACK exactly', () => {
    for (const [name, pool] of Object.entries(SPEED_POOLS)) {
      for (const vx of pool) {
        expect(TRACK % vx, `${name} pool vx=${vx}`).toBe(0)
      }
    }
  })

  it('positionAt is exact at spawn and at exit', () => {
    for (const vx of ALL_SPEEDS) {
      const m = marble({ vx, spawnTick: 17 })
      expect(positionAt(m, m.spawnTick)).toBe(0)
      expect(positionAt(m, m.exitTick)).toBe(TRACK)
      expect(Number.isInteger(m.exitTick)).toBe(true)
    }
  })

  it('visibleFrames >= 2 for every (level, pool speed) pair', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const revealX = revealForLevel(level)
      for (const vx of speedPoolForLevel(level)) {
        expect(visibleFrames(marble({ vx, revealX })), `L${level} vx=${vx}`).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

// -- 2. spawning and randomness ---------------------------------------------

describe('spawning and randomness', () => {
  it('spawns exactly one marble at nextSpawnTick, with id 0', () => {
    const rng = scripted(0, 0, 0)
    let s = start(newGame())
    s = runTo(s, FIRST_SPAWN_DELAY - 1, rng)
    expect(s.marbles).toHaveLength(0)
    s = step(s, rng)
    expect(s.tick).toBe(FIRST_SPAWN_DELAY)
    expect(s.marbles).toHaveLength(1)
    expect(s.marbles[0].id).toBe(0)
    expect(s.marbles[0].spawnTick).toBe(FIRST_SPAWN_DELAY)
    expect(s.events.spawned).toEqual([0])
  })

  it('a spawn consumes exactly 3 rng draws in lane -> speed -> gap order', () => {
    // level 1: maxConcurrent 1, free lanes [0,1,2], pool = low [8,9,10,12].
    // lane draw .7 -> floor(.7*3)=2 ; speed draw .5 -> floor(.5*4)=2 -> 10
    // gap draw .25 -> 30 + floor(.25*46)=30+11=41
    const c = counting(scripted(0.7, 0.5, 0.25))
    let s = start(newGame())
    s = runTo(s, FIRST_SPAWN_DELAY, c.rng)
    expect(c.calls()).toBe(3)
    const m = s.marbles[0]
    expect(m.lane).toBe(2)
    expect(m.vx).toBe(10)
    expect(m.revealX).toBe(REVEAL_START)
    expect(m.exitTick).toBe(FIRST_SPAWN_DELAY + TRACK / 10)
    expect(s.nextSpawnTick).toBe(FIRST_SPAWN_DELAY + 41)
  })

  it('a blocked spawn consumes 0 rng, keeps nextSpawnTick, and fires the tick the lane frees', () => {
    // Level 1 -> maxConcurrent 1. One marble already in flight blocks the spawn.
    const m = marble({ vx: 10, spawnTick: 0 }) // exitTick 72
    let s = stateWith([m], { tick: 70, nextSpawnTick: 71, nextId: 1 })

    const c = counting(scripted(0, 0, 0))
    s = step(s, c.rng) // tick 71: blocked
    expect(c.calls()).toBe(0)
    expect(s.nextSpawnTick).toBe(71)
    expect(s.marbles).toHaveLength(1)

    // Tick 79 = exitTick + GOOD_TICKS + 1 -> miss resolves, then spawn fires.
    s = runTo(s, 78, c.rng)
    expect(c.calls()).toBe(0)
    s = step(s, c.rng)
    expect(s.tick).toBe(79)
    expect(c.calls()).toBe(3)
    expect(s.events.judged.map((j) => j.grade)).toEqual(['missed'])
    expect(s.events.spawned).toEqual([1])
    expect(s.marbles).toHaveLength(1)
    expect(s.marbles[0].spawnTick).toBe(79)
  })

  it('the spawn gap stays inside [SPAWN_MIN, SPAWN_MAX] at both rng extremes', () => {
    const lo = runTo(start(newGame()), FIRST_SPAWN_DELAY, scripted(0, 0, 0))
    expect(lo.nextSpawnTick).toBe(FIRST_SPAWN_DELAY + SPAWN_MIN)
    const hi = runTo(start(newGame()), FIRST_SPAWN_DELAY, scripted(0.999999, 0, 0.999999))
    expect(hi.nextSpawnTick).toBe(FIRST_SPAWN_DELAY + SPAWN_MAX)
  })
})

// -- 3. visibility — the game's promise --------------------------------------

describe('visibility', () => {
  it('lit at the spawn tick, dark from the first tick where x >= revealX', () => {
    const m = marble({ vx: 10, spawnTick: 0, revealX: 100 }) // dark from tick 10
    expect(isVisible(m, 0)).toBe(true)
    expect(isVisible(m, 9)).toBe(true) // x = 90
    expect(isVisible(m, 10)).toBe(false) // x = 100 === revealX
    expect(isVisible(m, 11)).toBe(false)
    expect(isVisible(m, -1)).toBe(false)
  })

  it('NEVER visible in the tunnel, at exitTick, or after — for every speed and level', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const revealX = revealForLevel(level)
      for (const vx of speedPoolForLevel(level)) {
        const m = marble({ vx, spawnTick: 0, revealX })
        const darkFrom = Math.ceil(revealX / vx)
        for (let t = darkFrom; t <= m.exitTick + GOOD_TICKS + 5; t++) {
          expect(isVisible(m, t), `L${level} vx=${vx} t=${t}`).toBe(false)
        }
        // and specifically at the marker
        expect(isVisible(m, m.exitTick)).toBe(false)
      }
    }
  })
})

// -- 4. judgement boundaries -------------------------------------------------

describe('judgement boundaries', () => {
  it('gradeFor table', () => {
    for (const d of [0, 1, 2, -1, -2]) expect(gradeFor(d), `d=${d}`).toBe('perfect')
    for (const d of [3, 4, 5, 6, -3, -4, -5, -6]) expect(gradeFor(d), `d=${d}`).toBe('good')
    for (const d of [7, -7, 50, -50]) expect(gradeFor(d), `d=${d}`).toBe('blown')
    expect(PERFECT_TICKS).toBe(2)
    expect(GOOD_TICKS).toBe(6)
  })

  it('tapping exactly at exitTick is perfect with deltaTicks 0', () => {
    const m = marble({ vx: 10 }) // exitTick 72
    const s = tap(stateWith([m], { tick: m.exitTick }), 0)
    const j = s.events.judged[0]
    expect(j.grade).toBe('perfect')
    expect(j.deltaTicks).toBe(0)
    expect(s.marbles).toHaveLength(0)
    expect(s.lives).toBe(LIVES)
  })

  it('late edge: +GOOD_TICKS is good, +GOOD_TICKS+1 is blown', () => {
    const m = marble({ vx: 10 })
    const good = tap(stateWith([m], { tick: m.exitTick + GOOD_TICKS }), 0)
    expect(good.events.judged[0].grade).toBe('good')
    expect(good.events.judged[0].deltaTicks).toBe(GOOD_TICKS)
    const blown = tap(stateWith([m], { tick: m.exitTick + GOOD_TICKS + 1 }), 0)
    expect(blown.events.judged[0].grade).toBe('blown')
  })

  it('early edge: -GOOD_TICKS is good, -GOOD_TICKS-1 is blown', () => {
    const m = marble({ vx: 10 })
    const good = tap(stateWith([m], { tick: m.exitTick - GOOD_TICKS }), 0)
    expect(good.events.judged[0].grade).toBe('good')
    expect(good.events.judged[0].deltaTicks).toBe(-GOOD_TICKS)
    const blown = tap(stateWith([m], { tick: m.exitTick - GOOD_TICKS - 1 }), 0)
    expect(blown.events.judged[0].grade).toBe('blown')
  })

  it('tapping an empty lane is completely harmless', () => {
    const m = marble({ lane: 0, vx: 10 })
    const before = stateWith([m], { tick: 30, score: 500 })
    const after = tap(before, 2)
    expect(after.events.judged).toEqual([])
    expect(after.lives).toBe(before.lives)
    expect(after.score).toBe(before.score)
    expect(after.tick).toBe(before.tick)
    expect(after.marbles).toEqual(before.marbles)
    expect(after.lastJudgement).toBeNull()
  })

  it('tap never advances the tick', () => {
    const m = marble({ vx: 10 })
    const s = stateWith([m], { tick: m.exitTick })
    expect(tap(s, 0).tick).toBe(m.exitTick)
    expect(tap(s, 1).tick).toBe(m.exitTick)
  })

  it('an untapped marble misses at exitTick + GOOD_TICKS + 1', () => {
    const m = marble({ vx: 10 }) // exitTick 72
    let s = stateWith([m], { tick: m.exitTick, nextSpawnTick: 99999, nextId: 1 })
    s = runTo(s, m.exitTick + GOOD_TICKS, forbidden)
    expect(s.marbles).toHaveLength(1) // still alive at the good edge
    expect(s.lives).toBe(LIVES)
    s = step(s, forbidden)
    expect(s.tick).toBe(m.exitTick + GOOD_TICKS + 1)
    expect(s.events.judged[0].grade).toBe('missed')
    expect(s.events.judged[0].points).toBe(0)
    expect(s.events.judged[0].deltaTicks).toBe(0)
    expect(s.marbles).toHaveLength(0)
    expect(s.lives).toBe(LIVES - 1)
  })

  it('at exactly exitTick + GOOD_TICKS the marble is still tappable as good', () => {
    const m = marble({ vx: 10 })
    let s = stateWith([m], { tick: m.exitTick, nextSpawnTick: 99999, nextId: 1 })
    s = runTo(s, m.exitTick + GOOD_TICKS, forbidden)
    const judged = tap(s, 0)
    expect(judged.events.judged[0].grade).toBe('good')
    expect(judged.lives).toBe(LIVES)
  })

  it('a blown tap costs a life and removes the marble', () => {
    const m = marble({ vx: 10 })
    const s = tap(stateWith([m], { tick: m.exitTick + 20 }), 0)
    expect(s.events.judged[0].grade).toBe('blown')
    expect(s.events.judged[0].points).toBe(0)
    expect(s.lives).toBe(LIVES - 1)
    expect(s.marbles).toHaveLength(0)
  })

  it('soleLane routes Space only when exactly one marble is in flight', () => {
    expect(soleLane(stateWith([]))).toBeNull()
    expect(soleLane(stateWith([marble({ lane: 2 })]))).toBe(2)
    expect(soleLane(stateWith([marble({ id: 0, lane: 0 }), marble({ id: 1, lane: 1 })]))).toBeNull()
  })
})

// -- 5. scoring, combo, level ------------------------------------------------

describe('scoring, combo and level', () => {
  it('perfectStreak grows on perfect and resets on good/blown/missed; bestStreak tracks the max', () => {
    const at = (t: number, m: Marble, s: UmbraState) => ({ ...s, tick: t, marbles: [m] })
    let s = stateWith([])

    const m1 = marble({ id: 0, vx: 10 })
    s = tap(at(m1.exitTick, m1, s), 0)
    expect(s.perfectStreak).toBe(1)
    const m2 = marble({ id: 1, vx: 10 })
    s = tap(at(m2.exitTick + 1, m2, s), 0)
    expect(s.perfectStreak).toBe(2)
    expect(s.bestStreak).toBe(2)

    const m3 = marble({ id: 2, vx: 10 })
    s = tap(at(m3.exitTick + GOOD_TICKS, m3, s), 0) // good breaks the chain
    expect(s.perfectStreak).toBe(0)
    expect(s.bestStreak).toBe(2)

    const m4 = marble({ id: 3, vx: 10 })
    s = tap(at(m4.exitTick, m4, s), 0)
    expect(s.perfectStreak).toBe(1)

    const m5 = marble({ id: 4, vx: 10 })
    s = tap(at(m5.exitTick + 40, m5, s), 0) // blown breaks the chain
    expect(s.perfectStreak).toBe(0)
    expect(s.bestStreak).toBe(2)

    // a miss (via step) also breaks it
    const m6 = marble({ id: 5, vx: 10 })
    s = tap(at(m6.exitTick, m6, s), 0)
    expect(s.perfectStreak).toBe(1)
    const m7 = marble({ id: 6, vx: 10, spawnTick: 0 })
    s = { ...s, tick: m7.exitTick + GOOD_TICKS, marbles: [m7], nextSpawnTick: 99999 }
    s = step(s, forbidden)
    expect(s.events.judged[0].grade).toBe('missed')
    expect(s.perfectStreak).toBe(0)
  })

  it('pointsFor: base + speed + combo, capped, and zero for blown/missed', () => {
    expect(pointsFor('perfect', 10, 1, 1)).toBe(150) // 100 + 50 + 0
    expect(pointsFor('perfect', 10, 2, 1)).toBe(PERFECT_BASE + 10 * SPEED_POINT + COMBO_UNIT)
    expect(pointsFor('good', 10, 5, 1)).toBe(GOOD_BASE + 50) // good never combos
    expect(pointsFor('blown', 20, 9, 3)).toBe(0)
    expect(pointsFor('missed', 20, 9, 3)).toBe(0)
    // combo saturates at COMBO_CAP
    const capped = pointsFor('perfect', 10, COMBO_CAP + 1, 1)
    expect(capped).toBe(PERFECT_BASE + 50 + COMBO_UNIT * COMBO_CAP)
    expect(pointsFor('perfect', 10, COMBO_CAP + 50, 1)).toBe(capped)
    // documented single-tap maximum
    expect(pointsFor('perfect', 20, COMBO_CAP + 1, LANES)).toBe(1350)
  })

  it('simul multiplies: judging with 3 in flight is 3x', () => {
    const a = marble({ id: 0, lane: 0, vx: 10 })
    const solo = tap(stateWith([a], { tick: a.exitTick }), 0)
    const trio = tap(
      stateWith([a, marble({ id: 1, lane: 1, vx: 10 }), marble({ id: 2, lane: 2, vx: 10 })], {
        tick: a.exitTick,
      }),
      0,
    )
    expect(trio.events.judged[0].simul).toBe(3)
    expect(trio.score).toBe(solo.score * 3)
  })

  it('score is monotonically non-decreasing across a long scripted run', () => {
    const rng = mulberry32(99)
    let s = start(newGame())
    let prev = 0
    for (let i = 0; i < 3000; i++) {
      s = step(s, rng)
      expect(s.score).toBeGreaterThanOrEqual(prev)
      prev = s.score
      for (const m of s.marbles) {
        if (s.tick === m.exitTick) {
          s = tap(s, m.lane)
          expect(s.score).toBeGreaterThanOrEqual(prev)
          prev = s.score
        }
      }
      // deliberately blow one occasionally — still must not subtract
      if (i % 500 === 0 && s.marbles.length > 0) {
        s = tap(s, s.marbles[0].lane)
        expect(s.score).toBeGreaterThanOrEqual(prev)
        prev = s.score
      }
      if (s.phase === 'over') s = start({ ...newGame(), score: prev })
    }
    expect(prev).toBeGreaterThan(0)
  })

  it('levelForHits table, MAX_LEVEL clamp, and levelUp firing exactly once', () => {
    expect(levelForHits(0)).toBe(1)
    expect(levelForHits(HITS_PER_LEVEL - 1)).toBe(1)
    expect(levelForHits(HITS_PER_LEVEL)).toBe(2)
    expect(levelForHits(HITS_PER_LEVEL * 2)).toBe(3)
    expect(levelForHits(10_000)).toBe(MAX_LEVEL)
    for (let h = 1; h < 200; h++) expect(levelForHits(h)).toBeGreaterThanOrEqual(levelForHits(h - 1))

    // hits 4 -> 5 crosses into level 2 exactly once
    const m = marble({ vx: 10 })
    const pre = stateWith([m], { tick: m.exitTick, hits: HITS_PER_LEVEL - 1, level: 1 })
    const crossed = tap(pre, 0)
    expect(crossed.events.levelUp).toBe(true)
    expect(crossed.level).toBe(2)

    const m2 = marble({ id: 1, vx: 10 })
    const after = tap({ ...crossed, marbles: [m2], tick: m2.exitTick }, 0)
    expect(after.events.levelUp).toBe(false)
    expect(after.level).toBe(2)
  })

  it('revealForLevel is non-increasing with a floor; maxConcurrentForLevel table', () => {
    expect(revealForLevel(1)).toBe(REVEAL_START)
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(revealForLevel(l)).toBeLessThanOrEqual(revealForLevel(l - 1))
      expect(revealForLevel(l)).toBeGreaterThanOrEqual(REVEAL_FLOOR)
      expect(revealForLevel(l)).toBeLessThanOrEqual(REVEAL_START)
      expect(revealForLevel(l)).toBeLessThan(TRACK) // the exit is never lit
    }
    expect(revealForLevel(MAX_LEVEL)).toBe(REVEAL_FLOOR)

    expect(maxConcurrentForLevel(1)).toBe(1)
    expect(maxConcurrentForLevel(2)).toBe(1)
    expect(maxConcurrentForLevel(3)).toBe(2)
    expect(maxConcurrentForLevel(5)).toBe(2)
    expect(maxConcurrentForLevel(6)).toBe(3)
    expect(maxConcurrentForLevel(MAX_LEVEL)).toBe(LANES)
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(maxConcurrentForLevel(l)).toBeGreaterThanOrEqual(maxConcurrentForLevel(l - 1))
    }
    for (let l = 1; l <= MAX_LEVEL; l++) {
      expect(speedPoolForLevel(l).length).toBeGreaterThan(0)
    }
  })
})

// -- 6. fuzz invariants ------------------------------------------------------

describe('fuzz invariants', () => {
  it('a 5000-tick bot never exceeds maxConcurrentForLevel and never doubles a lane', () => {
    const rng = mulberry32(4242)
    let s = start(newGame())
    for (let i = 0; i < 5000; i++) {
      s = step(s, rng)
      expect(s.marbles.length).toBeLessThanOrEqual(maxConcurrentForLevel(s.level))
      const lanes = s.marbles.map((m) => m.lane)
      expect(new Set(lanes).size, `lanes ${JSON.stringify(lanes)} @${s.tick}`).toBe(lanes.length)
      for (const m of s.marbles) {
        if (s.tick === m.exitTick) {
          s = tap(s, m.lane)
          expect(s.marbles.length).toBeLessThanOrEqual(maxConcurrentForLevel(s.level))
        }
      }
      if (s.phase === 'over') s = start(newGame())
    }
  })

  it('lives 0 -> over, and step/tap afterwards are frozen no-ops', () => {
    const m = marble({ vx: 10 })
    let s = stateWith([m], { tick: m.exitTick + 30, lives: 1 })
    s = tap(s, 0) // blown -> last life
    expect(s.lives).toBe(0)
    expect(s.phase).toBe('over')
    expect(s.events.over).toBe(true)

    const frozen = step(s, forbidden)
    expect(frozen.tick).toBe(s.tick)
    expect(frozen.phase).toBe('over')
    const tapped = tap(s, 0)
    expect(tapped.tick).toBe(s.tick)
    expect(tapped.score).toBe(s.score)
    expect(tapped.events.judged).toEqual([])
  })

  it('missing the last life ends the run via step', () => {
    const m = marble({ vx: 10 })
    let s = stateWith([m], { tick: m.exitTick + GOOD_TICKS, lives: 1, nextSpawnTick: 99999 })
    s = step(s, forbidden)
    expect(s.events.judged[0].grade).toBe('missed')
    expect(s.lives).toBe(0)
    expect(s.phase).toBe('over')
    expect(s.events.over).toBe(true)
  })
})

// -- 7. goldens --------------------------------------------------------------

describe('goldens', () => {
  it('golden A: the perfect bot over 1800 ticks with seed 12345', () => {
    const rng = mulberry32(12345)
    let s = start(newGame())
    const spawns: [number, number, number][] = []
    for (let i = 0; i < 1800; i++) {
      s = step(s, rng)
      for (const id of s.events.spawned) {
        const m = s.marbles.find((x) => x.id === id)!
        spawns.push([m.spawnTick, m.lane, m.vx])
      }
      for (const m of [...s.marbles]) {
        if (s.tick === m.exitTick) s = tap(s, m.lane)
      }
    }
    expect(s.lives).toBe(LIVES)
    expect(s.phase).toBe('running')
    expect(s.perfects).toBe(GOLDEN_A.perfects)
    expect(s.goods).toBe(0)
    expect(s.level).toBe(GOLDEN_A.level)
    expect(s.score).toBe(GOLDEN_A.score)
    expect(s.bestStreak).toBe(GOLDEN_A.perfects)
    expect(spawns).toEqual(GOLDEN_A.spawns)
  })

  it('golden B: never tapping with seed 12345 ends the run at a fixed tick', () => {
    const rng = mulberry32(12345)
    let s = start(newGame())
    const lifeLost: number[] = []
    let overTick = -1
    for (let i = 0; i < 1800 && s.phase === 'running'; i++) {
      const before = s.lives
      s = step(s, rng)
      if (s.lives < before) lifeLost.push(s.tick)
      if (s.events.over) overTick = s.tick
    }
    expect(s.phase).toBe('over')
    expect(s.lives).toBe(0)
    expect(s.score).toBe(0)
    expect(lifeLost).toEqual(GOLDEN_B.lifeLost)
    expect(overTick).toBe(GOLDEN_B.overTick)
    expect(overTick).toBe(lifeLost[2])
  })

  it('determinism: the same seed + the same action script replays identically', () => {
    const play = () => {
      const rng = mulberry32(777)
      let s = start(newGame())
      for (let i = 0; i < 900; i++) {
        s = step(s, rng)
        for (const m of [...s.marbles]) {
          if (s.tick === m.exitTick + (m.id % 9)) s = tap(s, m.lane)
        }
      }
      return s
    }
    expect(play()).toEqual(play())
  })

  it('purity: step and tap never mutate their input state', () => {
    const rng = mulberry32(5)
    let s = start(newGame())
    s = runTo(s, FIRST_SPAWN_DELAY + 2, rng)

    const beforeStep = structuredClone(s)
    step(s, mulberry32(5))
    expect(s).toEqual(beforeStep)

    const t = { ...s, tick: s.marbles[0].exitTick }
    const beforeTap = structuredClone(t)
    tap(t, t.marbles[0].lane)
    expect(t).toEqual(beforeTap)

    // the returned state must not alias the input's marble array
    const next = step(s, mulberry32(5))
    expect(next.marbles).not.toBe(s.marbles)
  })
})

// Golden literals — captured from the engine and frozen. Any change to the
// spawn logic, the rng draw order, or the scoring formula moves these.
const GOLDEN_A = {
  score: 15500,
  perfects: 29, // 30 spawned, the last is still in flight at tick 1800
  level: 6, // 1 + floor(29 / HITS_PER_LEVEL)
  spawns: [
    [45, 2, 9],
    [126, 2, 10],
    [199, 0, 12],
    [274, 2, 9],
    [355, 2, 12],
    [416, 0, 9],
    [497, 2, 12],
    [558, 2, 12],
    [619, 1, 8],
    [710, 0, 12],
    [771, 0, 6],
    [829, 2, 9],
    [892, 0, 12],
    [959, 0, 10],
    [1021, 2, 6],
    [1076, 1, 10],
    [1144, 0, 8],
    [1186, 2, 12],
    [1235, 0, 15],
    [1285, 2, 6],
    [1315, 0, 12],
    [1376, 1, 9],
    [1409, 0, 15],
    [1483, 2, 8],
    [1513, 1, 6],
    [1574, 0, 12],
    [1646, 0, 16],
    [1689, 2, 20],
    [1726, 2, 20],
    [1780, 0, 12],
  ] as [number, number, number][],
}
const GOLDEN_B = {
  // The first marble of golden A is [45, lane 2, vx 9] -> exitTick 125, so the
  // untapped run loses life #1 at 125 + GOOD_TICKS + 1 = 132. The two goldens
  // corroborate each other: same seed, same first spawn.
  lifeLost: [132, 211, 278],
  overTick: 278,
}
