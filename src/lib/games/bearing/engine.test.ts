import { describe, expect, it } from 'vitest'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  PAR_BONUS_MAX,
  STAGE_SIZES,
  WIN_BONUS,
  type BearingConfig,
  type BearingState,
  type Direction,
  type Pos,
  type Region,
  type Rng,
  bearingOf,
  clampCoord,
  createGame,
  dailySeed,
  dig,
  emptyDigGrid,
  inBounds,
  mulberry32,
  narrowRegion,
  optimalPar,
  placeTarget,
  reduce,
  scoreOnWin,
  stageConfig,
} from './engine'

const CFG: BearingConfig = { size: 9, digBudget: 10 }

/** Hand-build a state for dig/reducer tests (bypasses generation/rng). */
function stateWith(cfg: BearingConfig, target: Pos, overrides: Partial<BearingState> = {}): BearingState {
  const mid = Math.floor((cfg.size - 1) / 2)
  return {
    config: cfg,
    seed: 1,
    size: cfg.size,
    target,
    digs: [],
    digGrid: emptyDigGrid(cfg.size),
    region: { xMin: 0, xMax: cfg.size - 1, yMin: 0, yMax: cfg.size - 1 },
    cursor: { x: mid, y: mid },
    digsUsed: 0,
    digBudget: cfg.digBudget,
    par: optimalPar(cfg.size),
    score: 0,
    status: 'playing',
    lastEvent: 'none',
    lastDig: null,
    ...overrides,
  }
}

/** Queued-array Rng with call-count tracking, like the template's deterministic tests. */
function countingRng(values: number[]): { rng: Rng; calls: () => number } {
  let i = 0
  return {
    rng: () => values[i++ % values.length],
    calls: () => i,
  }
}

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('bearingOf', () => {
  it('table test: all 9 sign combinations, unit magnitude', () => {
    expect(bearingOf(0, 0)).toBe('found')
    expect(bearingOf(0, -1)).toBe('N')
    expect(bearingOf(0, 1)).toBe('S')
    expect(bearingOf(1, 0)).toBe('E')
    expect(bearingOf(-1, 0)).toBe('W')
    expect(bearingOf(1, -1)).toBe('NE')
    expect(bearingOf(1, 1)).toBe('SE')
    expect(bearingOf(-1, -1)).toBe('NW')
    expect(bearingOf(-1, 1)).toBe('SW')
  })

  it('is sign-only, not angle/magnitude-based', () => {
    expect(bearingOf(5, -1)).toBe('NE')
    expect(bearingOf(1, -5)).toBe('NE')
    expect(bearingOf(100, 100)).toBe('SE')
    expect(bearingOf(-7, 2)).toBe('SW')
    expect(bearingOf(0, -50)).toBe('N')
    expect(bearingOf(50, 0)).toBe('E')
  })
})

describe('narrowRegion', () => {
  const full: Region = { xMin: 0, xMax: 8, yMin: 0, yMax: 8 }
  const at: Pos = { x: 4, y: 4 }

  it('each of the 8 directions from center produces the exact expected shrunk box', () => {
    const cases: [Direction, Region][] = [
      ['N', { xMin: 4, xMax: 4, yMin: 0, yMax: 3 }],
      ['S', { xMin: 4, xMax: 4, yMin: 5, yMax: 8 }],
      ['E', { xMin: 5, xMax: 8, yMin: 4, yMax: 4 }],
      ['W', { xMin: 0, xMax: 3, yMin: 4, yMax: 4 }],
      ['NE', { xMin: 5, xMax: 8, yMin: 0, yMax: 3 }],
      ['SE', { xMin: 5, xMax: 8, yMin: 5, yMax: 8 }],
      ['NW', { xMin: 0, xMax: 3, yMin: 0, yMax: 3 }],
      ['SW', { xMin: 0, xMax: 3, yMin: 5, yMax: 8 }],
    ]
    for (const [result, expected] of cases) {
      expect(narrowRegion(full, at, result)).toEqual(expected)
    }
  })

  it('sequential calls only shrink, never grow', () => {
    const r1 = narrowRegion(full, { x: 4, y: 4 }, 'SE')
    const r2 = narrowRegion(r1, { x: 6, y: 6 }, 'NW')
    // r2 must be a subset of r1
    expect(r2.xMin).toBeGreaterThanOrEqual(r1.xMin)
    expect(r2.xMax).toBeLessThanOrEqual(r1.xMax)
    expect(r2.yMin).toBeGreaterThanOrEqual(r1.yMin)
    expect(r2.yMax).toBeLessThanOrEqual(r1.yMax)
  })

  it('an axis result collapses x to a single column, leaving y bounded (not collapsed)', () => {
    const r = narrowRegion(full, at, 'N')
    expect(r.xMin).toBe(r.xMax)
    expect(r.xMin).toBe(4)
    expect(r.yMax - r.yMin).toBeGreaterThan(0)
  })
})

describe('placeTarget', () => {
  it('uses a scripted rng: exact {x,y}, exactly two draws', () => {
    const { rng, calls } = countingRng([0.5, 0.25])
    const p = placeTarget(9, rng)
    expect(p).toEqual({ x: 4, y: 2 })
    expect(calls()).toBe(2)
  })
})

describe('createGame', () => {
  it('pins an exact target for a fixed (cfg, seed) — regression golden', () => {
    const s = createGame({ size: 9, digBudget: 10 }, 42)
    expect(s.target).toEqual({ x: 5, y: 4 })
  })

  it('cursor equals grid center for each odd size in DIFFICULTIES/STAGE_SIZES', () => {
    const sizes = [
      ...Object.values(DIFFICULTIES).map((c) => c.size),
      ...STAGE_SIZES,
    ]
    for (const size of sizes) {
      const s = createGame({ size, digBudget: 20 }, 1)
      const mid = Math.floor((size - 1) / 2)
      expect(s.cursor).toEqual({ x: mid, y: mid })
    }
  })

  it('region starts full-board, digs empty, digGrid all-null, playing, score 0', () => {
    const s = createGame(CFG, 5)
    expect(s.region).toEqual({ xMin: 0, xMax: 8, yMin: 0, yMax: 8 })
    expect(s.digs).toEqual([])
    expect(s.digGrid.every((row) => row.every((c) => c === null))).toBe(true)
    expect(s.status).toBe('playing')
    expect(s.score).toBe(0)
  })
})

describe('dig', () => {
  it('hitting the exact target on the first dig wins with the golden score', () => {
    const target: Pos = { x: 4, y: 4 }
    const s0 = stateWith(CFG, target)
    const s1 = dig(s0, target)
    expect(s1.status).toBe('won')
    expect(s1.lastEvent).toBe('found')
    expect(s1.digsUsed).toBe(1)
    expect(s1.score).toBe(scoreOnWin(s0.par, 1, CFG.digBudget))
    expect(s1.score).toBe(2900) // hand-computed: par=5, 1000 + 1000 + 900
  })

  it('golden multi-dig scenario: 3 digs converging to found', () => {
    const target: Pos = { x: 6, y: 2 }
    let s = stateWith(CFG, target)
    s = dig(s, { x: 4, y: 4 }) // dx=2,dy=-2 -> NE
    expect(s.lastDig?.result).toBe('NE')
    s = dig(s, { x: 6, y: 4 }) // dx=0,dy=-2 -> N
    expect(s.lastDig?.result).toBe('N')
    s = dig(s, { x: 6, y: 2 }) // found
    expect(s.status).toBe('won')
    expect(s.digsUsed).toBe(3)
    expect(s.region).toEqual({ xMin: 6, xMax: 6, yMin: 2, yMax: 2 })
    expect(s.score).toBe(scoreOnWin(s.par, 3, CFG.digBudget))
    expect(s.score).toBe(2700) // hand-computed: par=5, 1000 + 1000 + 700
  })

  it('re-digging an already-dug cell is free: dig-repeat, no state change', () => {
    const target: Pos = { x: 0, y: 0 }
    const s0 = stateWith(CFG, target)
    const s1 = dig(s0, { x: 4, y: 4 })
    const s2 = dig(s1, { x: 4, y: 4 })
    expect(s2.lastEvent).toBe('dig-repeat')
    expect(s2.digsUsed).toBe(s1.digsUsed)
    expect(s2.digs).toEqual(s1.digs)
    expect(s2.region).toEqual(s1.region)
    expect(s2.score).toBe(s1.score)
  })

  it('out-of-bounds coordinates return illegal, state otherwise unchanged', () => {
    const target: Pos = { x: 4, y: 4 }
    const s0 = stateWith(CFG, target)
    const sNeg = dig(s0, { x: -1, y: 3 })
    expect(sNeg.lastEvent).toBe('illegal')
    expect(sNeg.digsUsed).toBe(0)
    expect(sNeg.digs).toEqual([])
    const sOver = dig(s0, { x: 9, y: 3 })
    expect(sOver.lastEvent).toBe('illegal')
    expect(sOver.digsUsed).toBe(0)
  })

  it('digging again after status===won returns illegal, no mutation', () => {
    const target: Pos = { x: 4, y: 4 }
    const s0 = stateWith(CFG, target)
    const won = dig(s0, target)
    expect(won.status).toBe('won')
    const again = dig(won, { x: 0, y: 0 })
    expect(again.lastEvent).toBe('illegal')
    expect(again.digs).toEqual(won.digs)
    expect(again.score).toBe(won.score)
  })

  it('digging again after status===lost returns illegal', () => {
    const target: Pos = { x: 8, y: 8 }
    const s0 = stateWith({ size: 9, digBudget: 1 }, target)
    const lost = dig(s0, { x: 0, y: 0 })
    expect(lost.status).toBe('lost')
    const again = dig(lost, { x: 1, y: 1 })
    expect(again.lastEvent).toBe('illegal')
  })

  it('golden loss scenario: exactly digBudget non-finding digs -> lost, score 0', () => {
    const target: Pos = { x: 8, y: 8 }
    const cfg: BearingConfig = { size: 9, digBudget: 3 }
    let s = stateWith(cfg, target)
    s = dig(s, { x: 0, y: 0 }) // SE, not found
    expect(s.status).toBe('playing')
    s = dig(s, { x: 1, y: 0 }) // SE, not found
    expect(s.status).toBe('playing')
    s = dig(s, { x: 2, y: 0 }) // SE, not found — 3rd dig hits budget
    expect(s.status).toBe('lost')
    expect(s.lastEvent).toBe('lose')
    expect(s.score).toBe(0)
    expect(s.digsUsed).toBe(3)
  })

  it('the dig landing exactly on digsUsed === digBudget without finding flips to lost', () => {
    const target: Pos = { x: 4, y: 4 }
    const s0 = stateWith({ size: 9, digBudget: 1 }, target)
    const s1 = dig(s0, { x: 0, y: 0 }) // not the target, digsUsed becomes 1 === budget
    expect(s1.digsUsed).toBe(1)
    expect(s1.status).toBe('lost')
    expect(s1.lastEvent).toBe('lose')
  })

  it('digGrid entries match independently recomputed bearingOf, across seeds', () => {
    for (const seed of [1, 2, 3, 99]) {
      const s0 = createGame(CFG, seed)
      const cellsToTry: Pos[] = [
        { x: 0, y: 0 },
        { x: 8, y: 8 },
        { x: 4, y: 4 },
        { x: 0, y: 8 },
        { x: 8, y: 0 },
      ]
      let s = s0
      for (const at of cellsToTry) {
        if (s.status !== 'playing') break
        s = dig(s, at)
      }
      for (let y = 0; y < s.size; y++) {
        for (let x = 0; x < s.size; x++) {
          const cell = s.digGrid[y][x]
          if (cell === null) continue
          const expected = bearingOf(s0.target.x - x, s0.target.y - y)
          expect(cell).toBe(expected)
        }
      }
    }
  })
})

describe('scoreOnWin', () => {
  it('monotonic decrease: fewer digs scores higher for fixed par/budget', () => {
    const par = 5
    const budget = 20
    expect(scoreOnWin(par, par, budget)).toBeGreaterThan(scoreOnWin(par, par + 3, budget))
  })

  it('clamps at the top: digsUsed=1 with a large par yields parBonus === PAR_BONUS_MAX exactly', () => {
    const score = scoreOnWin(100, 1, 50)
    const shovelBonus = (50 - 1) * 100
    expect(score).toBe(WIN_BONUS + PAR_BONUS_MAX + shovelBonus)
  })
})

describe('optimalPar', () => {
  it('table test for odd sizes', () => {
    expect(optimalPar(5)).toBe(Math.ceil(Math.log2(5)) + 1)
    expect(optimalPar(7)).toBe(Math.ceil(Math.log2(7)) + 1)
    expect(optimalPar(9)).toBe(Math.ceil(Math.log2(9)) + 1)
    expect(optimalPar(11)).toBe(Math.ceil(Math.log2(11)) + 1)
    expect(optimalPar(13)).toBe(Math.ceil(Math.log2(13)) + 1)
    expect(optimalPar(17)).toBe(Math.ceil(Math.log2(17)) + 1)
    expect(optimalPar(21)).toBe(Math.ceil(Math.log2(21)) + 1)
  })
})

describe('reduce', () => {
  it('move: cursor clamps at all four edges, non-edge moves apply raw delta', () => {
    const target: Pos = { x: 4, y: 4 }
    const s0 = stateWith(CFG, target, { cursor: { x: 0, y: 0 } })
    const left = reduce(s0, { type: 'move', dx: -1, dy: 0 })
    expect(left.cursor).toEqual({ x: 0, y: 0 })
    const up = reduce(s0, { type: 'move', dx: 0, dy: -1 })
    expect(up.cursor).toEqual({ x: 0, y: 0 })

    const s1 = stateWith(CFG, target, { cursor: { x: 8, y: 8 } })
    const right = reduce(s1, { type: 'move', dx: 1, dy: 0 })
    expect(right.cursor).toEqual({ x: 8, y: 8 })
    const down = reduce(s1, { type: 'move', dx: 0, dy: 1 })
    expect(down.cursor).toEqual({ x: 8, y: 8 })

    const s2 = stateWith(CFG, target, { cursor: { x: 4, y: 4 } })
    const moved = reduce(s2, { type: 'move', dx: 1, dy: -1 })
    expect(moved.cursor).toEqual({ x: 5, y: 3 })
  })

  it('cursor: absolute set clamps out-of-range values into bounds', () => {
    const target: Pos = { x: 4, y: 4 }
    const s0 = stateWith(CFG, target)
    const s1 = reduce(s0, { type: 'cursor', at: { x: -5, y: 99 } })
    expect(s1.cursor).toEqual({ x: 0, y: 8 })
  })

  it('reset: reproduces byte-identical target/region/digGrid to original createGame, clears digs/score', () => {
    const seed = 77
    const original = createGame(CFG, seed)
    let s = original
    s = dig(s, { x: 1, y: 1 })
    s = dig(s, { x: 2, y: 2 })
    const resetState = reduce(s, { type: 'reset' })
    expect(resetState.target).toEqual(original.target)
    expect(resetState.region).toEqual(original.region)
    expect(resetState.digGrid).toEqual(original.digGrid)
    expect(resetState.digs).toEqual([])
    expect(resetState.score).toBe(0)
  })

  it('new: different seed resets digs, status, and region to full-board', () => {
    const s0 = createGame(CFG, 1)
    let s = dig(s0, { x: 1, y: 1 })
    s = reduce(s, { type: 'new', seed: 2 })
    expect(s.digs).toEqual([])
    expect(s.status).toBe('playing')
    expect(s.region).toEqual({ xMin: 0, xMax: 8, yMin: 0, yMax: 8 })
  })
})

describe('stageConfig', () => {
  it('sizes for stage 1..length are all odd and strictly increasing', () => {
    let prev = -1
    for (let stage = 1; stage <= STAGE_SIZES.length; stage++) {
      const cfg = stageConfig(stage)
      expect(cfg.size % 2).toBe(1)
      expect(cfg.size).toBeGreaterThan(prev)
      prev = cfg.size
    }
  })

  it('stage beyond the ladder length clamps to the last entry', () => {
    const last = stageConfig(STAGE_SIZES.length)
    const beyond = stageConfig(STAGE_SIZES.length + 5)
    expect(beyond).toEqual(last)
    const zero = stageConfig(0)
    expect(zero).toEqual(stageConfig(1))
  })
})

describe('DIFFICULTIES / DAILY_CONFIG', () => {
  it('every preset has an odd size', () => {
    for (const cfg of Object.values(DIFFICULTIES)) {
      expect(cfg.size % 2).toBe(1)
    }
    expect(DAILY_CONFIG.size % 2).toBe(1)
  })
})

describe('inBounds / clampCoord', () => {
  it('inBounds is true only within [0,size)', () => {
    expect(inBounds(9, { x: 0, y: 0 })).toBe(true)
    expect(inBounds(9, { x: 8, y: 8 })).toBe(true)
    expect(inBounds(9, { x: -1, y: 0 })).toBe(false)
    expect(inBounds(9, { x: 0, y: 9 })).toBe(false)
  })

  it('clampCoord clamps to [0,size-1]', () => {
    expect(clampCoord(-3, 9)).toBe(0)
    expect(clampCoord(20, 9)).toBe(8)
    expect(clampCoord(4, 9)).toBe(4)
  })
})

describe('dailySeed', () => {
  it('is deterministic for the same date string', () => {
    expect(dailySeed('2026-08-10')).toBe(dailySeed('2026-08-10'))
  })

  it('differs across dates', () => {
    expect(dailySeed('2026-08-10')).not.toBe(dailySeed('2026-08-11'))
  })
})
