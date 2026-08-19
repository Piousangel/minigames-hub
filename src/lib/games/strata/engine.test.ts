import { describe, expect, it } from 'vitest'
import {
  AXES,
  DIFFICULTIES,
  LOSS_PARTIAL_MAX,
  WRONG_SUBMIT_PENALTY,
  countFilled,
  createGame,
  generateVoxels,
  guessAccuracy,
  idx,
  layerKey,
  mulberry32,
  placeBoxes,
  reduce,
  sliceAt,
  voxelsEqual,
  type Axis,
  type StrataConfig,
  type StrataState,
} from './engine'

/** Fixture from spec §3: size=2, only x===0 cells are true. */
function fixtureVoxels2(): boolean[] {
  const voxels = new Array<boolean>(8).fill(false)
  voxels[idx(2, 0, 0, 0)] = true
  voxels[idx(2, 0, 1, 0)] = true
  voxels[idx(2, 0, 0, 1)] = true
  voxels[idx(2, 0, 1, 1)] = true
  return voxels
}

/** Hand-built reducer state, bypassing generation (Decant's stateWith pattern). */
function mkState(overrides: Partial<StrataState> = {}): StrataState {
  const size = 2
  const cfg: StrataConfig = { size, boxCount: 1, boxMin: 1, boxMax: 2, querySlices: 3, maxSubmits: 2 }
  return {
    config: cfg,
    seed: 1,
    size,
    voxels: fixtureVoxels2(),
    guess: new Array<boolean>(size ** 3).fill(false),
    revealed: {},
    revealedOrder: [],
    queriesLeft: cfg.querySlices,
    queriesUsed: 0,
    submitsLeft: cfg.maxSubmits,
    submitsUsed: 0,
    score: 0,
    result: 'playing',
    activeLayer: { axis: 'z', index: 0 },
    lastEvent: 'none',
    lastSlice: null,
    lastSubmit: null,
    ...overrides,
  }
}

describe('idx / inBounds bijection', () => {
  it('idx is a bijection over [0,size)^3 for size=5', () => {
    const size = 5
    const seen = new Set<number>()
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          seen.add(idx(size, x, y, z))
        }
      }
    }
    expect(seen.size).toBe(size ** 3)
    for (let i = 0; i < size ** 3; i++) expect(seen.has(i)).toBe(true)
  })
})

describe('sliceAt', () => {
  it('golden: axis z, index 0 and 1 both equal [[T,F],[T,F]]', () => {
    const voxels = fixtureVoxels2()
    const expected = [
      [true, false],
      [true, false],
    ]
    expect(sliceAt(voxels, 2, 'z', 0)).toEqual(expected)
    expect(sliceAt(voxels, 2, 'z', 1)).toEqual(expected)
  })

  it('golden: axis x, index 0 all true, index 1 all false', () => {
    const voxels = fixtureVoxels2()
    expect(sliceAt(voxels, 2, 'x', 0)).toEqual([
      [true, true],
      [true, true],
    ])
    expect(sliceAt(voxels, 2, 'x', 1)).toEqual([
      [false, false],
      [false, false],
    ])
  })

  it('golden: axis y, index 0 equals [[T,F],[T,F]]', () => {
    const voxels = fixtureVoxels2()
    expect(sliceAt(voxels, 2, 'y', 0)).toEqual([
      [true, false],
      [true, false],
    ])
  })

  it('does not mutate the input voxels', () => {
    const voxels = fixtureVoxels2()
    const before = voxels.slice()
    sliceAt(voxels, 2, 'x', 0)
    sliceAt(voxels, 2, 'y', 1)
    sliceAt(voxels, 2, 'z', 0)
    expect(voxels).toEqual(before)
  })

  it('throws RangeError for out-of-bounds index', () => {
    const voxels = fixtureVoxels2()
    expect(() => sliceAt(voxels, 2, 'z', -1)).toThrow(RangeError)
    expect(() => sliceAt(voxels, 2, 'z', 2)).toThrow(RangeError)
  })
})

describe('layerKey', () => {
  it('formats axis:index', () => {
    expect(layerKey('x', 3)).toBe('x:3')
    expect(layerKey('z', 0)).toBe('z:0')
  })
})

describe('countFilled', () => {
  it('counts true cells', () => {
    expect(countFilled(new Array(125).fill(false))).toBe(0)
    expect(countFilled(new Array(125).fill(true))).toBe(125)
  })
})

describe('guessAccuracy', () => {
  it('identical arrays: matches===total, iou===1, fp/fn===0', () => {
    const voxels = fixtureVoxels2()
    const guess = voxels.slice()
    const acc = guessAccuracy(guess, voxels)
    expect(acc.matches).toBe(acc.total)
    expect(acc.total).toBe(8)
    expect(acc.iou).toBe(1)
    expect(acc.fp).toBe(0)
    expect(acc.fn).toBe(0)
  })

  it('complete inversion: iou===0', () => {
    const voxels = [true, false, true, false]
    const guess = [false, true, false, true]
    const acc = guessAccuracy(guess, voxels)
    expect(acc.tp).toBe(0)
    expect(acc.fp).toBe(2)
    expect(acc.fn).toBe(2)
    expect(acc.iou).toBe(0)
    expect(acc.matches).toBe(0)
  })

  it('hand-computed partial overlap: tp=2,fp=1,fn=1 -> iou===0.5', () => {
    const voxels = [true, true, true, false]
    const guess = [true, true, false, true]
    const acc = guessAccuracy(guess, voxels)
    expect(acc.tp).toBe(2)
    expect(acc.fp).toBe(1)
    expect(acc.fn).toBe(1)
    expect(acc.iou).toBe(0.5)
    expect(acc.matches).toBe(2)
    expect(acc.total).toBe(4)
  })
})

describe('voxelsEqual', () => {
  it('same content, different instance -> true', () => {
    const a = [true, false, true]
    const b = [true, false, true]
    expect(a).not.toBe(b)
    expect(voxelsEqual(a, b)).toBe(true)
  })

  it('one differing element -> false', () => {
    expect(voxelsEqual([true, false], [true, true])).toBe(false)
  })

  it('different lengths -> false', () => {
    expect(voxelsEqual([true, false], [true, false, true])).toBe(false)
  })
})

describe('placeBoxes — rng golden', () => {
  it('pins the exact box for size=4,boxCount=1,boxMin=1,boxMax=2, seed=1', () => {
    const cfg: StrataConfig = { size: 4, boxCount: 1, boxMin: 1, boxMax: 2, querySlices: 1, maxSubmits: 1 }
    const voxels = placeBoxes(cfg, mulberry32(1))
    // Golden: box xLen=2,xStart=0,yLen=2,yStart=2,zLen=2,zStart=0 (pinned via mulberry32(1)).
    const expected = [
      false, false, false, false, false, false, false, false,
      true, true, false, false, true, true, false, false,
      false, false, false, false, false, false, false, false,
      true, true, false, false, true, true, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
    ]
    expect(voxels).toEqual(expected)
    expect(countFilled(voxels)).toBe(8)
  })
})

describe('generateVoxels — determinism', () => {
  const cfg: StrataConfig = { size: 4, boxCount: 2, boxMin: 1, boxMax: 2, querySlices: 4, maxSubmits: 2 }

  it('is pure: same (cfg, seed) -> byte-identical result', () => {
    const a = generateVoxels(cfg, 1)
    const b = generateVoxels(cfg, 1)
    expect(voxelsEqual(a, b)).toBe(true)
  })

  it('different seeds (pinned pair 1,2) -> different shapes', () => {
    const a = generateVoxels(cfg, 1)
    const b = generateVoxels(cfg, 2)
    expect(voxelsEqual(a, b)).toBe(false)
  })

  it('DIFFICULTIES presets never degenerate to all-empty or all-full (seeds 1..20)', () => {
    for (const preset of Object.values(DIFFICULTIES)) {
      const total = preset.size ** 3
      for (let seed = 1; seed <= 20; seed++) {
        const v = generateVoxels(preset, seed)
        const filled = countFilled(v)
        expect(filled).toBeGreaterThan(0)
        expect(filled).toBeLessThan(total)
      }
    }
  })
})

describe('createGame', () => {
  it('initial state invariants', () => {
    const g = createGame(DIFFICULTIES.easy, 7)
    expect(g.guess.every((v) => v === false)).toBe(true)
    expect(g.queriesLeft).toBe(g.config.querySlices)
    expect(g.submitsLeft).toBe(g.config.maxSubmits)
    expect(g.score).toBe(0)
    expect(g.result).toBe('playing')
    expect(g.revealedOrder.length).toBe(0)
  })
})

describe('reduce — query', () => {
  it('first query matches sliceAt directly, decrements budget, records reveal', () => {
    const s = mkState()
    const expected = sliceAt(s.voxels, s.size, 'z', 0)
    const next = reduce(s, { type: 'query', axis: 'z', index: 0 })
    expect(next.lastSlice?.grid).toEqual(expected)
    expect(next.lastSlice?.repeat).toBe(false)
    expect(next.queriesLeft).toBe(s.queriesLeft - 1)
    expect(next.revealed[layerKey('z', 0)]).toEqual(expected)
    expect(next.revealedOrder).toEqual(['z:0'])
    expect(next.lastEvent).toBe('query')
  })

  it('repeat query is free and marked repeat', () => {
    const s = mkState()
    const once = reduce(s, { type: 'query', axis: 'z', index: 0 })
    const twice = reduce(once, { type: 'query', axis: 'z', index: 0 })
    expect(twice.queriesLeft).toBe(once.queriesLeft)
    expect(twice.lastEvent).toBe('query-repeat')
    expect(twice.lastSlice?.repeat).toBe(true)
  })

  it('exhausted budget on an unrevealed slice is illegal (no-op)', () => {
    const s = mkState({ config: { size: 2, boxCount: 1, boxMin: 1, boxMax: 2, querySlices: 1, maxSubmits: 2 }, queriesLeft: 1 })
    const afterOne = reduce(s, { type: 'query', axis: 'x', index: 0 })
    expect(afterOne.queriesLeft).toBe(0)
    const afterTwo = reduce(afterOne, { type: 'query', axis: 'x', index: 1 })
    expect(afterTwo.lastEvent).toBe('illegal')
    expect(afterTwo.queriesLeft).toBe(0)
  })

  it('out-of-range index is illegal, never throws', () => {
    const s = mkState()
    expect(() => reduce(s, { type: 'query', axis: 'z', index: -1 })).not.toThrow()
    const negResult = reduce(s, { type: 'query', axis: 'z', index: -1 })
    expect(negResult.lastEvent).toBe('illegal')
    const overResult = reduce(s, { type: 'query', axis: 'z', index: 5 })
    expect(overResult.lastEvent).toBe('illegal')
  })

  it('is a no-op once result is won', () => {
    const s = mkState({ result: 'won', score: 999 })
    const next = reduce(s, { type: 'query', axis: 'x', index: 0 })
    expect(next.lastEvent).toBe('none')
    expect(next.queriesLeft).toBe(s.queriesLeft)
    expect(next.score).toBe(999)
  })
})

describe('reduce — toggleVoxel / setLayer', () => {
  it('toggles exactly the target cell', () => {
    const s = mkState()
    const on = reduce(s, { type: 'toggleVoxel', x: 0, y: 0, z: 0 })
    expect(on.guess[idx(2, 0, 0, 0)]).toBe(true)
    expect(on.guess.filter(Boolean).length).toBe(1)
    const off = reduce(on, { type: 'toggleVoxel', x: 0, y: 0, z: 0 })
    expect(off.guess[idx(2, 0, 0, 0)]).toBe(false)
    expect(off.guess.every((v) => v === false)).toBe(true)
  })

  it('out-of-range coordinates are illegal, guess unchanged', () => {
    const s = mkState()
    const next = reduce(s, { type: 'toggleVoxel', x: 2, y: 0, z: 0 })
    expect(next.lastEvent).toBe('illegal')
    expect(next.guess).toEqual(s.guess)
  })

  it('setLayer updates activeLayer when valid, no-ops (no clamp) when invalid', () => {
    const s = mkState()
    const valid = reduce(s, { type: 'setLayer', axis: 'x', index: 1 })
    expect(valid.activeLayer).toEqual({ axis: 'x', index: 1 })
    const invalid = reduce(valid, { type: 'setLayer', axis: 'y', index: 5 })
    expect(invalid.lastEvent).toBe('illegal')
    expect(invalid.activeLayer).toEqual({ axis: 'x', index: 1 })
  })
})

// -- Golden submit/win/lose scenarios ---------------------------------------

const WIN_CFG: StrataConfig = { size: 2, boxCount: 1, boxMin: 1, boxMax: 2, querySlices: 4, maxSubmits: 3 }
const WIN_SEED = 4 // pinned: generateVoxels(WIN_CFG, 4) === [F,F,F,F,T,T,F,F] (cells (0,0,1),(1,0,1))

function toggleAllTrueCells(state: StrataState, voxels: boolean[]): StrataState {
  let s = state
  for (let i = 0; i < voxels.length; i++) {
    if (!voxels[i]) continue
    const x = i % s.size
    const y = Math.floor(i / s.size) % s.size
    const z = Math.floor(i / (s.size * s.size))
    s = reduce(s, { type: 'toggleVoxel', x, y, z })
  }
  return s
}

describe('reduce — submit / win / lose (golden scoring)', () => {
  it('golden win: exact guess after spending 1 query -> literal score 1750', () => {
    let s = createGame(WIN_CFG, WIN_SEED)
    expect(countFilled(s.voxels)).toBe(2) // sanity: pinned fixture
    s = reduce(s, { type: 'query', axis: 'x', index: 0 }) // spend 1/4 budget
    expect(s.queriesLeft).toBe(3)
    s = toggleAllTrueCells(s, s.voxels)
    expect(voxelsEqual(s.guess, s.voxels)).toBe(true)
    s = reduce(s, { type: 'submit' })
    expect(s.result).toBe('won')
    expect(s.lastEvent).toBe('win')
    // WIN_BASE(1000) + round(EFFICIENCY_BONUS_MAX(1000) * 3/4) = 1000 + 750
    expect(s.score).toBe(1750)
  })

  it('wrong submit (attempts remain): score drops by exactly WRONG_SUBMIT_PENALTY', () => {
    let s = createGame(WIN_CFG, WIN_SEED)
    s = { ...s, score: 500 }
    // guess = voxels but missing one true cell (off by exactly one)
    const wrongGuess = s.voxels.slice()
    const firstTrue = wrongGuess.findIndex((v) => v)
    wrongGuess[firstTrue] = false
    s = { ...s, guess: wrongGuess }
    const next = reduce(s, { type: 'submit' })
    expect(next.result).toBe('playing')
    expect(next.submitsLeft).toBe(WIN_CFG.maxSubmits - 1)
    expect(next.score).toBe(500 - WRONG_SUBMIT_PENALTY)
    expect(next.lastSubmit?.correct).toBe(false)
    expect(next.lastSubmit?.matches).toBe(next.lastSubmit!.total - 1)
  })

  it('submit exhaustion loss: golden partial-credit score from IoU', () => {
    const cfg: StrataConfig = { ...WIN_CFG, maxSubmits: 1 }
    let s = createGame(cfg, WIN_SEED) // voxels true at index 4 and 5
    // guess: tp=1 (idx4), fp=1 (idx0), fn=1 (idx5 missed)
    const guess = new Array<boolean>(8).fill(false)
    guess[0] = true
    guess[4] = true
    s = { ...s, guess }
    const next = reduce(s, { type: 'submit' })
    expect(next.result).toBe('lost')
    expect(next.lastEvent).toBe('lose')
    expect(next.submitsLeft).toBe(0)
    // iou = 1/3, round(400 * 1/3) = 133
    expect(next.score).toBe(133)
  })

  it('giveUp with an empty guess against a non-empty answer: iou===0, score===0', () => {
    const s = createGame(WIN_CFG, WIN_SEED)
    expect(s.guess.every((v) => v === false)).toBe(true)
    const next = reduce(s, { type: 'giveUp' })
    expect(next.result).toBe('lost')
    expect(next.lastSubmit?.correct).toBe(false)
    expect(next.lastSubmit?.iou).toBe(0)
    expect(next.score).toBe(0)
  })

  it('score never drops below 0 across consecutive wrong submits', () => {
    let s = createGame(WIN_CFG, WIN_SEED) // guess stays empty/wrong throughout
    for (let i = 0; i < WIN_CFG.maxSubmits; i++) {
      s = reduce(s, { type: 'submit' })
      expect(s.score).toBeGreaterThanOrEqual(0)
    }
    expect(s.result).toBe('lost') // budget exhausted on the last attempt
  })

  it('after result !== playing, submit/toggleVoxel/giveUp are all no-ops', () => {
    const won: StrataState = { ...createGame(WIN_CFG, WIN_SEED), result: 'won', score: 1750 }

    const s1 = reduce(won, { type: 'submit' })
    expect(s1.lastEvent).toBe('none')
    expect(s1.score).toBe(1750)
    expect(s1.result).toBe('won')

    const s2 = reduce(won, { type: 'toggleVoxel', x: 0, y: 0, z: 0 })
    expect(s2.lastEvent).toBe('none')
    expect(s2.guess).toEqual(won.guess)

    const s3 = reduce(won, { type: 'giveUp' })
    expect(s3.lastEvent).toBe('none')
    expect(s3.score).toBe(1750)
    expect(s3.result).toBe('won')
  })
})

describe('reduce — reset / new', () => {
  it('reset restores the original seed board and initial counters', () => {
    const original = createGame(WIN_CFG, WIN_SEED)
    let s = reduce(original, { type: 'query', axis: 'x', index: 0 })
    s = reduce(s, { type: 'toggleVoxel', x: 0, y: 0, z: 0 })
    const reset = reduce(s, { type: 'reset' })
    expect(voxelsEqual(reset.voxels, original.voxels)).toBe(true)
    expect(reset.guess.every((v) => v === false)).toBe(true)
    expect(reset.score).toBe(0)
    expect(reset.queriesLeft).toBe(reset.config.querySlices)
    expect(reset.submitsLeft).toBe(reset.config.maxSubmits)
    expect(reset.result).toBe('playing')
  })

  it('new with a different pinned seed produces a different board; config unchanged', () => {
    const original = createGame(WIN_CFG, WIN_SEED)
    const fresh = reduce(original, { type: 'new', seed: 5 }) // pinned pair (4,5) differ
    expect(voxelsEqual(fresh.voxels, original.voxels)).toBe(false)
    expect(fresh.config).toEqual(original.config)
  })
})

describe('AXES', () => {
  it('exposes all three axes', () => {
    expect(AXES).toEqual<Axis[]>(['x', 'y', 'z'])
  })
})
