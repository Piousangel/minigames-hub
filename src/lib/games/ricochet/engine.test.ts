import { describe, expect, it } from 'vitest'
import {
  applyChain,
  CELL_COUNT,
  collapse,
  DAILY_TAPS,
  dailySeed,
  hashSeed,
  ignite,
  inBounds,
  makeBoard,
  mulberry32,
  newGame,
  pickValue,
  previewHops,
  resolveChain,
  SIZE,
  toCol,
  toIndex,
  toRow,
  valueWeights,
  VISITED_CAP,
  type Board,
  type Dir,
  type Rng,
  type Tile,
} from './engine'

const tile = (value: 1 | 2 | 3 | 4, dir: Dir): Tile => ({ value, dir })

/** An all-null board; caller fills the cells it cares about. */
const emptyBoard = (): Board => new Array(CELL_COUNT).fill(null)

/** RNG returning a fixed queued sequence, repeating the last value when drained. */
const seqRng = (values: number[]): Rng => {
  let i = 0
  return () => {
    const v = values[Math.min(i, values.length - 1)]
    i++
    return v
  }
}

describe('PRNG & determinism', () => {
  it('mulberry32(42) yields identical first-5 numbers on two calls', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const aa = [a(), a(), a(), a(), a()]
    const bb = [b(), b(), b(), b(), b()]
    expect(aa).toEqual(bb)
  })

  it('makeBoard twice with the same seed → deep-equal boards', () => {
    const one = makeBoard(mulberry32(1), 0)
    const two = makeBoard(mulberry32(1), 0)
    expect(one).toEqual(two)
    expect(one).toHaveLength(CELL_COUNT)
  })

  it('hashSeed and dailySeed are stable', () => {
    expect(hashSeed('x')).toBe(hashSeed('x'))
    expect(dailySeed('2026-07-14')).toBe(dailySeed('2026-07-14'))
    expect(dailySeed('2026-07-14')).not.toBe(dailySeed('2026-07-15'))
  })
})

describe('coordinates', () => {
  it('toIndex/toRow/toCol round-trip for all 49 indices', () => {
    for (let i = 0; i < CELL_COUNT; i++) {
      expect(toIndex(toRow(i), toCol(i))).toBe(i)
    }
  })

  it('inBounds rejects out-of-range rows/cols', () => {
    expect(inBounds(-1, 0)).toBe(false)
    expect(inBounds(SIZE, 0)).toBe(false)
    expect(inBounds(0, SIZE)).toBe(false)
    expect(inBounds(0, -1)).toBe(false)
    expect(inBounds(3, 3)).toBe(true)
  })
})

describe('resolveChain core', () => {
  it('single hop that lands then stops (offboard next)', () => {
    const b = emptyBoard()
    b[toIndex(0, 0)] = tile(2, 'right') // (0,0) -> (0,2)
    b[toIndex(0, 2)] = tile(3, 'up') // then flies off the top
    const res = resolveChain(b, toIndex(0, 0))
    expect(res.length).toBe(1)
    expect(res.score).toBe(1)
    expect(res.terminator).toBe('offboard')
    expect(res.hops[0].index).toBe(toIndex(0, 2))
  })

  it('immediate off-board on hop 1 → empty hops, offboard, index -1', () => {
    const b = emptyBoard()
    b[toIndex(0, 0)] = tile(3, 'up')
    const res = resolveChain(b, toIndex(0, 0))
    expect(res.hops).toEqual([])
    expect(res.length).toBe(0)
    expect(res.score).toBe(0)
    expect(res.terminator).toBe('offboard')
    expect(res.finalTargetIndex).toBe(-1)
  })

  it('tapping an empty cell is a no-op', () => {
    const b = emptyBoard()
    const res = resolveChain(b, toIndex(3, 3))
    expect(res.length).toBe(0)
    expect(res.terminator).toBe('empty')
    expect(res.finalTargetIndex).toBe(toIndex(3, 3))
  })

  it('multi-hop snake: the tapped tile launches, its 3 destinations score 1+2+3=6', () => {
    const b = emptyBoard()
    // tap (0,0) right1 -> (0,1) down1 -> (1,1) left1 -> (1,0) down1 -> (2,0) empty stop.
    // The tapped tile is the launcher; the 3 landed tiles are the scored hops.
    b[toIndex(0, 0)] = tile(1, 'right')
    b[toIndex(0, 1)] = tile(1, 'down')
    b[toIndex(1, 1)] = tile(1, 'left')
    b[toIndex(1, 0)] = tile(1, 'down')
    const res = resolveChain(b, toIndex(0, 0))
    expect(res.length).toBe(3)
    expect(res.hops.map((h) => h.index)).toEqual([toIndex(0, 1), toIndex(1, 1), toIndex(1, 0)])
    expect(res.score).toBe(6)
    expect(res.terminator).toBe('empty')
    expect(res.finalTargetIndex).toBe(toIndex(2, 0))
  })

  it('convexity: one 9-chain (45) dwarfs three 3-chains (18)', () => {
    // Build a 9-hop straight snake down column 0 via down-1 tiles.
    const b = emptyBoard()
    for (let r = 0; r < 6; r++) b[toIndex(r, 0)] = tile(1, 'down') // 6 hops down col 0 to (6,0)
    // continue: (6,0) right1 -> col walk
    b[toIndex(6, 0)] = tile(1, 'right') // hop to (6,1)
    b[toIndex(6, 1)] = tile(1, 'up') // hop to (5,1)
    b[toIndex(5, 1)] = tile(1, 'up') // hop to (4,1)
    b[toIndex(4, 1)] = tile(1, 'up') // hop to (3,1) empty stop
    const nine = resolveChain(b, toIndex(0, 0))
    expect(nine.length).toBe(9)
    expect(nine.score).toBe(45)
    const threeChainScore = 6 // 1+2+3
    expect(nine.score).toBeGreaterThan(threeChainScore * 3)
  })

  it('does not mutate the input board', () => {
    const b = emptyBoard()
    b[toIndex(0, 0)] = tile(1, 'right')
    b[toIndex(0, 1)] = tile(1, 'down')
    const snapshot = JSON.parse(JSON.stringify(b))
    resolveChain(b, toIndex(0, 0))
    expect(b).toEqual(snapshot)
  })

  it('self-crossing 2-cycle terminates quickly under the cap', () => {
    const b = emptyBoard()
    b[toIndex(3, 3)] = tile(1, 'right') // A -> B
    b[toIndex(3, 4)] = tile(1, 'left') // B -> A (now empty) stop
    const res = resolveChain(b, toIndex(3, 3))
    expect(res.length).toBeLessThanOrEqual(2)
    expect(res.terminator).toBe('empty')
    expect(res.hops.length).toBeLessThan(VISITED_CAP)
  })

  it('full-board worst case terminates without hitting the cap', () => {
    const rng = mulberry32(0)
    const b: Board = new Array(CELL_COUNT)
    for (let i = 0; i < CELL_COUNT; i++) b[i] = tile(1, 'right')
    void rng
    const res = resolveChain(b, toIndex(0, 0))
    expect(res.length).toBeLessThanOrEqual(CELL_COUNT)
    expect(res.terminator).not.toBe('cap')
  })

  it('scoring formula n*(n+1)/2 for hand-built chains of length n', () => {
    for (let n = 0; n <= 6; n++) {
      const b = emptyBoard()
      // A straight down-snake of n+1 tiles yields n scored hops (tapped tile is
      // the launcher, then n landed tiles, then it stops on the next cell).
      for (let r = 0; r <= n; r++) b[toIndex(r, 0)] = tile(1, 'down')
      const res = resolveChain(b, toIndex(0, 0))
      expect(res.length).toBe(n)
      expect(res.score).toBe((n * (n + 1)) / 2)
    }
  })
})

describe('applyChain & collapse', () => {
  it('applyChain nulls exactly the hop indices and does not mutate input', () => {
    const b = emptyBoard()
    b[toIndex(0, 0)] = tile(1, 'right')
    b[toIndex(0, 1)] = tile(1, 'down')
    b[toIndex(5, 5)] = tile(1, 'up') // untouched
    const res = resolveChain(b, toIndex(0, 0))
    const snapshot = JSON.parse(JSON.stringify(b))
    const next = applyChain(b, res)
    expect(b).toEqual(snapshot) // input unchanged
    for (const h of res.hops) expect(next[h.index]).toBeNull()
    expect(next[toIndex(5, 5)]).not.toBeNull()
  })

  it('collapse sinks survivors to the bottom in order and refills the top', () => {
    const b = emptyBoard()
    // Column 2: survivor at rows 1 and 4, holes elsewhere.
    b[toIndex(1, 2)] = tile(2, 'up')
    b[toIndex(4, 2)] = tile(3, 'down')
    const rng = mulberry32(7)
    const out = collapse(b, rng, 0)
    // The two survivors settle at the two bottom rows, order preserved.
    expect(out[toIndex(SIZE - 2, 2)]).toEqual(tile(2, 'up'))
    expect(out[toIndex(SIZE - 1, 2)]).toEqual(tile(3, 'down'))
    // Every cell is non-null after refill.
    for (let i = 0; i < CELL_COUNT; i++) expect(out[i]).not.toBeNull()
  })

  it('collapse is deterministic with the same seed', () => {
    const b = emptyBoard()
    b[toIndex(0, 0)] = tile(1, 'right')
    const one = collapse(b, mulberry32(9), 3)
    const two = collapse(b, mulberry32(9), 3)
    expect(one).toEqual(two)
  })
})

describe('weighted value bag', () => {
  it('valueWeights: gentle early, monster late', () => {
    const w0 = valueWeights(0)
    expect(w0[0] + w0[1] + w0[2] + w0[3]).toBeGreaterThan(0)
    expect(w0[0]).toBeGreaterThan(w0[3]) // w1 > w4 early
    const w40 = valueWeights(40)
    expect(w40[2] + w40[3]).toBeGreaterThan(w40[0] + w40[1]) // high-value denser late
  })

  it('pickValue maps stubbed rng into expected buckets', () => {
    // At refillCount 0 weights are [40,34,18,8], total 100.
    expect(pickValue(seqRng([0.0]), 0)).toBe(1) // r=0 -> bucket 1
    expect(pickValue(seqRng([0.5]), 0)).toBe(2) // r=50 -> after 40, into 34 bucket
    expect(pickValue(seqRng([0.99]), 0)).toBe(4) // r=99 -> last bucket
  })
})

describe('state transitions', () => {
  it('newGame daily sets tapsLeft and not over', () => {
    const s = newGame({ mode: 'daily', seed: 1, rng: mulberry32(1), tapLimit: DAILY_TAPS })
    expect(s.tapsLeft).toBe(DAILY_TAPS)
    expect(s.over).toBe(false)
    expect(s.board.every((c) => c !== null)).toBe(true)
  })

  it('ignite on empty cell leaves state unchanged and consumes no tap', () => {
    const rng = mulberry32(2)
    const s = newGame({ mode: 'daily', seed: 2, rng, tapLimit: DAILY_TAPS })
    // Force a known empty cell.
    s.board[0] = null
    const out = ignite(s, 0, rng)
    expect(out.result.length).toBe(0)
    expect(out.state).toBe(s)
    expect(out.state.taps).toBe(0)
    expect(out.state.tapsLeft).toBe(DAILY_TAPS)
  })

  it('ignite of a valid chain updates score/taps/refill and keeps board full', () => {
    const rng = mulberry32(123)
    const s = newGame({ mode: 'endless', seed: 123, rng, tapLimit: null })
    // Find any index that produces a chain.
    let idx = -1
    for (let i = 0; i < CELL_COUNT; i++) {
      if (resolveChain(s.board, i).length > 0) {
        idx = i
        break
      }
    }
    expect(idx).toBeGreaterThanOrEqual(0)
    const expected = resolveChain(s.board, idx)
    const out = ignite(s, idx, rng)
    expect(out.state.score).toBe(s.score + expected.score)
    expect(out.state.taps).toBe(1)
    expect(out.state.refillCount).toBe(1)
    expect(out.state.longestChain).toBe(expected.length)
    expect(out.state.board.every((c) => c !== null)).toBe(true)
  })

  it('daily: 5 valid ignitions end the game and a 6th is a no-op', () => {
    const rng = mulberry32(555)
    let s = newGame({ mode: 'daily', seed: 555, rng, tapLimit: DAILY_TAPS })
    let taps = 0
    let guard = 0
    while (!s.over && guard < 500) {
      guard++
      let idx = -1
      for (let i = 0; i < CELL_COUNT; i++) {
        if (resolveChain(s.board, i).length > 0) {
          idx = i
          break
        }
      }
      const out = ignite(s, idx, rng)
      if (out.result.length > 0) taps++
      s = out.state
    }
    expect(s.over).toBe(true)
    expect(s.tapsLeft).toBe(0)
    expect(taps).toBe(DAILY_TAPS)
    // A 6th ignite is a no-op.
    const after = ignite(s, 0, rng)
    expect(after.state).toBe(s)
    expect(after.result.length).toBe(0)
  })

  it('session determinism: same seed + same tap sequence → identical board & score', () => {
    const SEED = 4242
    const run = () => {
      const rng = mulberry32(SEED)
      let s = newGame({ mode: 'endless', seed: SEED, rng, tapLimit: null })
      for (const idx of [0, 10, 24, 48, 12]) {
        s = ignite(s, idx, rng).state
      }
      return s
    }
    const a = run()
    const b = run()
    expect(a.board).toEqual(b.board)
    expect(a.score).toBe(b.score)
  })
})

describe('previewHops', () => {
  it('returns at most maxHops indices equal to the resolveChain prefix', () => {
    const b = emptyBoard()
    b[toIndex(0, 0)] = tile(1, 'right')
    b[toIndex(0, 1)] = tile(1, 'down')
    b[toIndex(1, 1)] = tile(1, 'left')
    b[toIndex(1, 0)] = tile(1, 'down')
    const full = resolveChain(b, toIndex(0, 0))
    const preview = previewHops(b, toIndex(0, 0), 2)
    expect(preview.length).toBeLessThanOrEqual(2)
    expect(preview).toEqual(full.hops.slice(0, 2).map((h) => h.index))
  })
})
