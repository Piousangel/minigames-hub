import { describe, expect, it } from 'vitest'
import {
  DIFFICULTIES,
  START_SIZE,
  comboBonus,
  type HandfulConfig,
  type HandfulState,
  type Item,
  type Rng,
  clampSize,
  cleanOdds,
  computeGrab,
  createGame,
  generateOrder,
  handValue,
  isOver,
  maxGrabNow,
  mulberry32,
  reduce,
} from './engine'

const CFG: HandfulConfig = DIFFICULTIES.normal

/** A counting Rng wrapper: tracks how many times it was consumed. */
function counting(source: () => number): Rng & { count: () => number } {
  let n = 0
  const fn = (() => {
    n++
    return source()
  }) as Rng & { count: () => number }
  fn.count = () => n
  return fn
}

/** Hand-build a state from a fixed order (bypasses generation). */
function stateWith(order: Item[], overrides: Partial<HandfulState> = {}): HandfulState {
  const cursor = overrides.cursor ?? 0
  const tail = order.slice(cursor)
  const ripeLeft = tail.filter((x) => x === 1).length
  const rottenLeft = tail.length - ripeLeft
  const base: HandfulState = {
    config: { ripe: order.filter((x) => x === 1).length, rotten: order.filter((x) => x === 0).length, maxGrab: 8 },
    seed: 1,
    order: order.slice(),
    cursor,
    ripeLeft,
    rottenLeft,
    size: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    grabs: 0,
    cleanGrabs: 0,
    spoiledGrabs: 0,
    biggestClean: 0,
    over: ripeLeft + rottenLeft === 0,
    lastGrab: null,
    lastEvent: 'none',
    ...overrides,
  }
  if (overrides.size === undefined) base.size = clampSize(base, base.config.maxGrab)
  return base
}

describe('mulberry32', () => {
  it('is deterministic for a fixed seed, all values in [0,1)', () => {
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

describe('handValue', () => {
  it('matches triangular numbers', () => {
    expect(handValue(0)).toBe(0)
    expect(handValue(1)).toBe(1)
    expect(handValue(2)).toBe(4)
    expect(handValue(3)).toBe(9)
    expect(handValue(4)).toBe(16)
  })

  it('is strictly increasing and integral over 1..8', () => {
    for (let g = 1; g <= 8; g++) {
      expect(Number.isInteger(handValue(g))).toBe(true)
      expect(handValue(g)).toBeGreaterThan(handValue(g - 1))
      expect(handValue(g)).toBeGreaterThanOrEqual(g)
    }
  })
})

describe('cleanOdds', () => {
  it('is 1 when there are no rotten items', () => {
    expect(cleanOdds(10, 0, 5)).toBe(1)
    expect(cleanOdds(3, 0, 3)).toBe(1)
  })

  it('is 0 when the handful exceeds the ripe count', () => {
    expect(cleanOdds(3, 2, 4)).toBe(0)
  })

  it('is 1 for g === 0', () => {
    expect(cleanOdds(5, 5, 0)).toBe(1)
  })

  it('matches a known value: ripe=3 rotten=1 g=2 -> 0.5', () => {
    expect(cleanOdds(3, 1, 2)).toBeCloseTo(0.5, 9)
  })

  it('decreases monotonically as g grows (rotten>0)', () => {
    let prev = 1.0001
    for (let g = 1; g <= 6; g++) {
      const p = cleanOdds(6, 4, g)
      expect(p).toBeLessThan(prev)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
      prev = p
    }
  })
})

describe('generateOrder', () => {
  it('preserves the multiset: length, ripe count, rotten count', () => {
    const order = generateOrder(CFG, mulberry32(42))
    expect(order.length).toBe(CFG.ripe + CFG.rotten)
    expect(order.filter((x) => x === 1).length).toBe(CFG.ripe)
    expect(order.filter((x) => x === 0).length).toBe(CFG.rotten)
  })

  it('consumes exactly length-1 rng draws', () => {
    const rng = counting(mulberry32(7))
    const order = generateOrder(CFG, rng)
    expect(rng.count()).toBe(order.length - 1)
  })

  it('is deterministic per seed; usually differs across seeds', () => {
    expect(generateOrder(CFG, mulberry32(999))).toEqual(generateOrder(CFG, mulberry32(999)))
    expect(generateOrder(CFG, mulberry32(1))).not.toEqual(generateOrder(CFG, mulberry32(2)))
  })
})

describe('createGame', () => {
  it('initializes every field', () => {
    const s = createGame(CFG, 123)
    expect(s.cursor).toBe(0)
    expect(s.score).toBe(0)
    expect(s.combo).toBe(0)
    expect(s.bestCombo).toBe(0)
    expect(s.grabs).toBe(0)
    expect(s.cleanGrabs).toBe(0)
    expect(s.spoiledGrabs).toBe(0)
    expect(s.biggestClean).toBe(0)
    expect(s.over).toBe(false)
    expect(s.lastGrab).toBeNull()
    expect(s.lastEvent).toBe('none')
    expect(s.ripeLeft).toBe(CFG.ripe)
    expect(s.rottenLeft).toBe(CFG.rotten)
    // Starts small (not maxGrab): mashing GRAB from the default is no longer
    // the worst possible strategy.
    expect(s.size).toBe(START_SIZE)
    expect(START_SIZE).toBeGreaterThanOrEqual(2)
    expect(START_SIZE).toBeLessThanOrEqual(3)
  })
})

describe('clampSize / maxGrabNow', () => {
  it('setSize clamps to [1, maxGrabNow]', () => {
    let s = stateWith([1, 1, 1, 1, 1], { config: { ripe: 5, rotten: 0, maxGrab: 8 } })
    s = reduce(s, { type: 'setSize', size: 100 })
    expect(s.size).toBe(maxGrabNow(s)) // == 5 (items left)
    s = reduce(s, { type: 'setSize', size: 0 })
    expect(s.size).toBe(1)
    s = reduce(s, { type: 'setSize', size: 3 })
    expect(s.size).toBe(3)
  })

  it('incSize clamps at both bounds without wrapping', () => {
    let s = stateWith([1, 1, 1, 1, 1, 1, 1, 1], { size: 1 })
    s = reduce(s, { type: 'incSize', delta: -1 })
    expect(s.size).toBe(1) // floor
    s = reduce(s, { type: 'incSize', delta: 100 })
    expect(s.size).toBe(maxGrabNow(s)) // ceiling
  })
})

describe('computeGrab', () => {
  it('does not mutate order and tallies correctly', () => {
    const order: Item[] = [1, 1, 0, 1]
    const snapshot = order.slice()
    const r = computeGrab(order, 1, 2)
    expect(order).toEqual(snapshot)
    expect(r.drawn).toEqual([1, 0])
    expect(r.ripe).toBe(1)
    expect(r.rotten).toBe(1)
    expect(r.clean).toBe(false)
  })

  it('may return a shorter slice at the tail', () => {
    const r = computeGrab([1, 1, 1], 2, 5)
    expect(r.drawn).toEqual([1])
    expect(r.ripe).toBe(1)
    expect(r.rotten).toBe(0)
  })
})

describe('reduce — grab clean', () => {
  it('all-ripe handful scores handValue and increments combo', () => {
    let s = stateWith([1, 1, 1, 1, 1, 1], { size: 3 })
    s = reduce(s, { type: 'grab' })
    expect(s.lastGrab?.clean).toBe(true)
    expect(s.lastGrab?.gained).toBe(9) // handValue(3)
    expect(s.score).toBe(9)
    expect(s.combo).toBe(1)
    expect(s.cursor).toBe(3)
    expect(s.ripeLeft).toBe(3)
    expect(s.lastEvent).toBe('clean')
  })
})

describe('reduce — grab spoiled', () => {
  it('a rotten item zeroes the handful and resets combo', () => {
    let s = stateWith([1, 0, 1, 1, 1, 1], { size: 2, combo: 3 })
    s = reduce(s, { type: 'grab' })
    expect(s.lastGrab?.rotten).toBe(1)
    expect(s.lastGrab?.clean).toBe(false)
    expect(s.lastGrab?.gained).toBe(0)
    expect(s.score).toBe(0)
    expect(s.combo).toBe(0)
    expect(s.cursor).toBe(2)
    expect(s.ripeLeft).toBe(4)
    expect(s.rottenLeft).toBe(0)
    expect(s.lastEvent).toBe('spoiled')
  })
})

describe('reduce — combo bonus', () => {
  it('combo bonus scales with the handful (+25% of its value per streak step)', () => {
    expect(comboBonus(4, 1)).toBe(0)
    expect(comboBonus(4, 2)).toBe(4) // 16 * 1/4
    expect(comboBonus(4, 3)).toBe(8)
    expect(comboBonus(1, 2)).toBe(0) // floor(1/4): singles barely build combo value
    expect(comboBonus(1, 5)).toBe(1)
    let s = stateWith([1, 1, 1, 1, 1, 1, 1, 1], { size: 4 })
    s = reduce(s, { type: 'grab' }) // combo 1, gained handValue(4)=16
    expect(s.combo).toBe(1)
    expect(s.lastGrab?.comboBonus).toBe(0)
    expect(s.lastGrab?.gained).toBe(16)
    s = reduce(s, { type: 'setSize', size: 4 })
    s = reduce(s, { type: 'grab' }) // combo 2, bonus 4
    expect(s.combo).toBe(2)
    expect(s.lastGrab?.comboBonus).toBe(4)
    expect(s.lastGrab?.gained).toBe(handValueLocal(4) + 4)
  })

  it('resets and re-accumulates after a spoiled grab', () => {
    // order: [1,1] clean, [1,0] spoiled, [1,1] clean
    let s = stateWith([1, 1, 1, 0, 1, 1], { size: 2 })
    s = reduce(s, { type: 'grab' }) // combo 1
    expect(s.combo).toBe(1)
    s = reduce(s, { type: 'setSize', size: 2 })
    s = reduce(s, { type: 'grab' }) // [1,0] spoiled -> combo 0
    expect(s.combo).toBe(0)
    s = reduce(s, { type: 'setSize', size: 2 })
    s = reduce(s, { type: 'grab' }) // [1,1] clean -> combo 1
    expect(s.combo).toBe(1)
  })
})

function handValueLocal(g: number): number {
  return g * g
}

describe('reduce — bestCombo / biggestClean tracking', () => {
  it('tracks bestCombo and only clean grabs update biggestClean', () => {
    // [1,1,1] clean size3, then [0,1] spoiled size2, then [1,1] clean size2
    let s = stateWith([1, 1, 1, 0, 1, 1, 1], { size: 3 })
    s = reduce(s, { type: 'grab' }) // clean 3, combo1, biggestClean 3
    expect(s.biggestClean).toBe(3)
    expect(s.bestCombo).toBe(1)
    s = reduce(s, { type: 'setSize', size: 2 })
    s = reduce(s, { type: 'grab' }) // [0,1] spoiled, combo 0, biggestClean stays 3
    expect(s.biggestClean).toBe(3)
    s = reduce(s, { type: 'setSize', size: 2 })
    s = reduce(s, { type: 'grab' }) // [1,1] clean size2, combo1, biggestClean still 3
    expect(s.biggestClean).toBe(3)
    expect(s.bestCombo).toBe(1)
  })
})

describe('score monotonicity', () => {
  it('never decreases across a full playthrough', () => {
    let s = createGame(CFG, 2024)
    let prev = s.score
    let guard = 0
    while (!s.over && guard++ < 200) {
      s = reduce(s, { type: 'setSize', size: 3 })
      s = reduce(s, { type: 'grab' })
      expect(s.score).toBeGreaterThanOrEqual(prev)
      prev = s.score
    }
    expect(s.over).toBe(true)
  })
})

describe('GOLDEN — fixed order + scripted grabs', () => {
  it('reproduces exact score/cursor/combo/clean/over per step', () => {
    const order: Item[] = [1, 1, 0, 1, 1, 1, 0, 1] // ripe6, rotten2
    let s = stateWith(order)

    // grab2 -> [1,1] clean, +4, combo1, cursor2
    s = reduce(s, { type: 'setSize', size: 2 })
    s = reduce(s, { type: 'grab' })
    expect(s.score).toBe(4)
    expect(s.cursor).toBe(2)
    expect(s.combo).toBe(1)
    expect(s.lastGrab?.clean).toBe(true)
    expect(s.over).toBe(false)

    // grab2 -> [0,1] spoiled, +0, combo0, cursor4
    s = reduce(s, { type: 'setSize', size: 2 })
    s = reduce(s, { type: 'grab' })
    expect(s.score).toBe(4)
    expect(s.cursor).toBe(4)
    expect(s.combo).toBe(0)
    expect(s.lastGrab?.clean).toBe(false)
    expect(s.over).toBe(false)

    // grab3 -> [1,1,0] spoiled, +0, combo0, cursor7
    s = reduce(s, { type: 'setSize', size: 3 })
    s = reduce(s, { type: 'grab' })
    expect(s.score).toBe(4)
    expect(s.cursor).toBe(7)
    expect(s.combo).toBe(0)
    expect(s.lastGrab?.clean).toBe(false)
    expect(s.over).toBe(false)

    // grab1 -> [1] clean, +1, combo1, cursor8, over
    s = reduce(s, { type: 'setSize', size: 1 })
    s = reduce(s, { type: 'grab' })
    expect(s.score).toBe(5)
    expect(s.cursor).toBe(8)
    expect(s.combo).toBe(1)
    expect(s.lastGrab?.clean).toBe(true)
    expect(s.over).toBe(true)
    expect(s.lastEvent).toBe('over')
  })
})

describe('reduce — over is a no-op sink', () => {
  it('grab / setSize do nothing once over', () => {
    let s = stateWith([1, 1], { size: 2 })
    s = reduce(s, { type: 'grab' })
    expect(s.over).toBe(true)
    const frozen = s
    const afterGrab = reduce(frozen, { type: 'grab' })
    expect(afterGrab.lastEvent).toBe('none')
    expect(afterGrab.cursor).toBe(frozen.cursor)
    expect(afterGrab.score).toBe(frozen.score)
    const afterSize = reduce(frozen, { type: 'setSize', size: 1 })
    expect(afterSize.lastEvent).toBe('none')
    expect(afterSize.size).toBe(frozen.size)
  })
})

describe('reset / new', () => {
  it('reset regenerates the same order and clears progress', () => {
    let s = createGame(CFG, 555)
    const order0 = s.order.slice()
    s = reduce(s, { type: 'setSize', size: 3 })
    s = reduce(s, { type: 'grab' })
    const r = reduce(s, { type: 'reset' })
    expect(r.order).toEqual(order0)
    expect(r.cursor).toBe(0)
    expect(r.score).toBe(0)
    expect(r.grabs).toBe(0)
  })

  it('new uses the given seed with cleared progress', () => {
    const s = createGame(CFG, 1)
    const r = reduce(s, { type: 'new', seed: 424242 })
    expect(r.order).toEqual(createGame(CFG, 424242).order)
    expect(r.cursor).toBe(0)
    expect(r.score).toBe(0)
  })
})

describe('maxGrabNow shrinks; size auto-clamps at the tail', () => {
  it('reduces the drawable ceiling as the basket empties', () => {
    // 5 items, maxGrab 8. Grab 4, leaving 1; size must clamp to 1.
    let s = stateWith([1, 1, 1, 1, 1], { config: { ripe: 5, rotten: 0, maxGrab: 8 }, size: 4 })
    expect(maxGrabNow(s)).toBe(5)
    s = reduce(s, { type: 'grab' })
    expect(s.ripeLeft + s.rottenLeft).toBe(1)
    expect(maxGrabNow(s)).toBe(1)
    expect(s.size).toBe(1)
  })
})

describe('grabbing the whole basket at once', () => {
  it('is always spoiled when rotten>0', () => {
    let s = stateWith([1, 0, 1, 1], { config: { ripe: 3, rotten: 1, maxGrab: 8 }, size: 4 })
    s = reduce(s, { type: 'grab' })
    expect(s.lastGrab?.size).toBe(4)
    expect(s.lastGrab?.clean).toBe(false)
    expect(s.lastGrab?.gained).toBe(0)
    expect(s.over).toBe(true)
  })
})

describe('sum invariants', () => {
  it('cursor+ripeLeft+rottenLeft === length and ripeLeft matches the tail throughout', () => {
    let s = createGame(DIFFICULTIES.hard, 31337)
    const total = s.order.length
    let guard = 0
    while (!s.over && guard++ < 300) {
      expect(s.cursor + s.ripeLeft + s.rottenLeft).toBe(total)
      const tail = s.order.slice(s.cursor)
      expect(s.ripeLeft).toBe(tail.filter((x) => x === 1).length)
      expect(s.rottenLeft).toBe(tail.length - tail.filter((x) => x === 1).length)
      s = reduce(s, { type: 'setSize', size: 2 })
      s = reduce(s, { type: 'grab' })
    }
    expect(isOver(s)).toBe(true)
  })
})

describe('determinism end-to-end', () => {
  it('two games replayed with the same script reach an identical final state', () => {
    const script: number[] = [4, 2, 5, 3, 1, 6, 2, 4, 3, 2, 5, 1, 4, 2, 3, 6, 2, 1, 4, 3]
    function play(): HandfulState {
      let s = createGame(CFG, 90210)
      let i = 0
      let guard = 0
      while (!s.over && guard++ < 300) {
        s = reduce(s, { type: 'setSize', size: script[i++ % script.length] })
        s = reduce(s, { type: 'grab' })
      }
      return s
    }
    const a = play()
    const b = play()
    expect(a.score).toBe(b.score)
    expect(a.cursor).toBe(b.cursor)
    expect(a.combo).toBe(b.combo)
    expect(a.bestCombo).toBe(b.bestCombo)
    expect(a.biggestClean).toBe(b.biggestClean)
  })
})

/** Play a whole basket with a sizing policy; returns the final score. */
function playPolicy(cfg: HandfulConfig, seed: number, policy: (s: HandfulState) => number): number {
  let s = createGame(cfg, seed)
  let guard = 0
  while (!s.over && guard++ < 200) {
    s = reduce(s, { type: 'setSize', size: policy(s) })
    s = reduce(s, { type: 'grab' })
  }
  return s.score
}

function meanScore(cfg: HandfulConfig, policy: (s: HandfulState) => number, n = 2000): number {
  let total = 0
  for (let seed = 1; seed <= n; seed++) total += playPolicy(cfg, seed, policy)
  return total / n
}

/** Odds-aware player: maximise expected points per item at the current odds. */
const oddsAware = (s: HandfulState) => {
  let bestG = 1
  let bestRate = -1
  for (let g = 1; g <= maxGrabNow(s); g++) {
    const v = cleanOdds(s.ripeLeft, s.rottenLeft, g) * (handValue(g) + comboBonus(g, s.combo + 1))
    if (v / g > bestRate) {
      bestRate = v / g
      bestG = g
    }
  }
  return bestG
}

describe('balance — no fixed-size dominant strategy (audit: always-1 averaged 368 vs 8-at-once 18.6)', () => {
  for (const key of ['easy', 'normal', 'hard'] as const) {
    it(`${key}: always-1 is not optimal, the best fixed size is mid-sized, and reading the odds beats every fixed size`, () => {
      const cfg = DIFFICULTIES[key]
      const fixed: number[] = []
      for (let g = 1; g <= cfg.maxGrab; g++) fixed.push(meanScore(cfg, () => g))
      const bestFixed = Math.max(...fixed)
      const argBest = fixed.indexOf(bestFixed) + 1
      // Singles must lose clearly to the best fixed size.
      expect(fixed[0]).toBeLessThan(bestFixed * 0.9)
      // Greedy max-size is also bad.
      expect(fixed[cfg.maxGrab - 1]).toBeLessThan(bestFixed * 0.9)
      expect(argBest).toBeGreaterThanOrEqual(2)
      expect(argBest).toBeLessThanOrEqual(5)
      // Skill (tracking the public composition) beats any blind fixed size.
      expect(meanScore(cfg, oddsAware)).toBeGreaterThan(bestFixed)
    })
  }
})
