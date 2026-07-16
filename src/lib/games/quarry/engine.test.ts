import { describe, expect, it } from 'vitest'
import {
  assertWinnable,
  budgetForLevel,
  chebyshev,
  clampCoord,
  dailySeed,
  fleeFrom,
  levelPoints,
  minProbesToCatch,
  mulberry32,
  newGame,
  newLevel,
  nextLevel,
  nextStreak,
  parForLevel,
  probe,
  scoreLevel,
  sizeForLevel,
  streakBonus,
  todayStr,
  type Pos,
  type QuarryState,
  type Rng,
} from './engine'

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)

function stubRng(...values: number[]): Rng {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('chebyshev + clampCoord', () => {
  it('is symmetric and equals max(|dr|,|dc|)', () => {
    const a = { row: 1, col: 2 }
    const b = { row: 4, col: 3 }
    expect(chebyshev(a, b)).toBe(3)
    expect(chebyshev(b, a)).toBe(3)
    expect(chebyshev({ row: 2, col: 2 }, { row: 2, col: 2 })).toBe(0)
    expect(chebyshev({ row: 0, col: 0 }, { row: 3, col: 3 })).toBe(3)
  })

  it('clamps low, high, and in-range for size 5 and 7', () => {
    expect(clampCoord(-3, 5)).toBe(0)
    expect(clampCoord(9, 5)).toBe(4)
    expect(clampCoord(2, 5)).toBe(2)
    expect(clampCoord(-1, 7)).toBe(0)
    expect(clampCoord(99, 7)).toBe(6)
    expect(clampCoord(6, 7)).toBe(6)
  })
})

describe('fleeFrom — exhaustive over every (quarry, probe) pair', () => {
  for (const size of [5, 7]) {
    it(`obeys all invariants on ${size}×${size}`, () => {
      for (let qr = 0; qr < size; qr++) {
        for (let qc = 0; qc < size; qc++) {
          for (let pr = 0; pr < size; pr++) {
            for (let pc = 0; pc < size; pc++) {
              const quarry: Pos = { row: qr, col: qc }
              const probeAt: Pos = { row: pr, col: pc }
              const res = fleeFrom(quarry, probeAt, size)

              // on-board
              expect(res.row).toBeGreaterThanOrEqual(0)
              expect(res.row).toBeLessThan(size)
              expect(res.col).toBeGreaterThanOrEqual(0)
              expect(res.col).toBeLessThan(size)

              // moves at most one cell in each axis
              expect(chebyshev(res, quarry)).toBeLessThanOrEqual(1)

              const dr = qr - pr
              const dc = qc - pc

              if (dr === 0 && dc === 0) {
                // quarry === probe -> unchanged
                expect(res).toEqual(quarry)
                continue
              }

              // never moves TOWARD the probe on either axis
              const moveR = res.row - qr
              const moveC = res.col - qc
              if (moveR !== 0) expect(sign(moveR)).toBe(sign(dr))
              if (moveC !== 0) expect(sign(moveC)).toBe(sign(dc))

              if (Math.abs(dr) >= Math.abs(dc)) {
                // vertical axis chosen (incl. tie) -> col never changes
                expect(res.col).toBe(qc)
              } else {
                // horizontal axis chosen -> row never changes
                expect(res.row).toBe(qr)
              }
            }
          }
        }
      }
    })
  }

  it('tie-break is vertical when |dr| === |dc| !== 0', () => {
    // quarry at (3,3), probe at (2,2): dr=1, dc=1 -> vertical move down.
    const res = fleeFrom({ row: 3, col: 3 }, { row: 2, col: 2 }, 7)
    expect(res).toEqual({ row: 4, col: 3 })
  })

  it('greatest-axis selection: horizontal when |dc| > |dr|', () => {
    // quarry (3,4), probe (2,1): dr=1, dc=3 -> horizontal move right.
    const res = fleeFrom({ row: 3, col: 4 }, { row: 2, col: 1 }, 7)
    expect(res).toEqual({ row: 3, col: 5 })
  })

  it('wall-pins when the away step leaves the board', () => {
    // quarry on top row, probe directly below in same column -> would flee up,
    // but clamps to stay -> pinned (no move).
    expect(fleeFrom({ row: 0, col: 2 }, { row: 3, col: 2 }, 5)).toEqual({ row: 0, col: 2 })
    // quarry on right wall, probe to its left -> would flee right, pinned.
    expect(fleeFrom({ row: 2, col: 4 }, { row: 2, col: 0 }, 5)).toEqual({ row: 2, col: 4 })
  })
})

describe('probe reducer', () => {
  const base: QuarryState = {
    size: 5,
    level: 1,
    quarry: { row: 2, col: 2 },
    probesLeft: 8,
    budget: 8,
    history: [],
    status: 'playing',
    lastProbe: null,
  }

  it('reads distance pre-move and reflects the flee in `to`', () => {
    const next = probe(base, { row: 2, col: 1 }) // adjacent left
    expect(next.lastProbe?.distance).toBe(1)
    expect(next.lastProbe?.caught).toBe(false)
    // dr=0, dc=1 -> horizontal flee right
    expect(next.quarry).toEqual({ row: 2, col: 3 })
    expect(next.lastProbe?.fled).toBe(true)
    expect(next.probesLeft).toBe(7)
    expect(next.history).toHaveLength(1)
  })

  it('catches on distance 0 and wins even on the last probe', () => {
    const last: QuarryState = { ...base, probesLeft: 1 }
    const next = probe(last, { row: 2, col: 2 })
    expect(next.status).toBe('won')
    expect(next.lastProbe?.caught).toBe(true)
    expect(next.quarry).toEqual({ row: 2, col: 2 }) // unchanged
    expect(next.probesLeft).toBe(0)
  })

  it('loses when a non-catching probe drains probesLeft to 0, still moving the quarry', () => {
    const last: QuarryState = { ...base, probesLeft: 1 }
    const next = probe(last, { row: 2, col: 1 })
    expect(next.status).toBe('lost')
    expect(next.quarry).toEqual({ row: 2, col: 3 }) // still fled
    expect(next.history).toHaveLength(1)
    expect(next.probesLeft).toBe(0)
  })

  it('does not mutate the input state (purity)', () => {
    const frozen = Object.freeze({
      ...base,
      quarry: Object.freeze({ row: 2, col: 2 }),
      history: Object.freeze([]) as never,
    })
    expect(() => probe(frozen, { row: 0, col: 0 })).not.toThrow()
    expect(frozen.probesLeft).toBe(8)
    expect(frozen.history).toHaveLength(0)
  })

  it('treats an off-board probe as a no-op (returns input reference)', () => {
    const r1 = probe(base, { row: -1, col: 0 })
    expect(r1).toBe(base)
    const r2 = probe(base, { row: 0, col: 5 })
    expect(r2).toBe(base)
  })

  it('allows re-probing the same cell; both are recorded', () => {
    const s1 = probe(base, { row: 4, col: 2 }) // quarry (2,2) -> dr=-2 -> flee up to (1,2)
    expect(s1.quarry).toEqual({ row: 1, col: 2 })
    const s2 = probe(s1, { row: 4, col: 2 }) // dr=-3 -> flee up to (0,2)
    expect(s2.quarry).toEqual({ row: 0, col: 2 })
    expect(s2.history).toHaveLength(2)
  })

  it('is a no-op when applied to a won/lost state', () => {
    const won: QuarryState = { ...base, status: 'won' }
    expect(probe(won, { row: 0, col: 0 })).toBe(won)
    const lost: QuarryState = { ...base, status: 'lost' }
    expect(probe(lost, { row: 0, col: 0 })).toBe(lost)
  })
})

describe('level + progression', () => {
  it('sizeForLevel maps 1,2->5 and 3,4,10->7', () => {
    expect(sizeForLevel(1)).toBe(5)
    expect(sizeForLevel(2)).toBe(5)
    expect(sizeForLevel(3)).toBe(7)
    expect(sizeForLevel(4)).toBe(7)
    expect(sizeForLevel(10)).toBe(7)
  })

  it('budgetForLevel and parForLevel', () => {
    expect(budgetForLevel(1)).toBe(8)
    expect(budgetForLevel(3)).toBe(10)
    expect(parForLevel(1)).toBe(5)
    expect(parForLevel(3)).toBe(7)
  })

  it('newLevel/newGame place the quarry on-board for edge rng values', () => {
    const lo = newLevel(1, stubRng(0))
    expect(lo.quarry).toEqual({ row: 0, col: 0 })
    expect(lo.probesLeft).toBe(8)
    expect(lo.history).toHaveLength(0)
    expect(lo.status).toBe('playing')

    const hi = newLevel(1, stubRng(0.999))
    expect(hi.quarry).toEqual({ row: 4, col: 4 })

    const mid = newGame(stubRng(0.5))
    expect(mid.quarry.row).toBeGreaterThanOrEqual(0)
    expect(mid.quarry.row).toBeLessThan(5)
    expect(mid.level).toBe(1)
  })

  it('nextLevel increments level and resizes at the 2->3 boundary', () => {
    const lv2: QuarryState = {
      ...newGame(stubRng(0.5)),
      level: 2,
    }
    const lv3 = nextLevel(lv2, stubRng(0.5))
    expect(lv3.level).toBe(3)
    expect(lv3.size).toBe(7)
    expect(lv3.budget).toBe(10)
  })
})

describe('scoring', () => {
  it('scoreLevel star boundaries (par 5 at level 1)', () => {
    expect(scoreLevel(1, 3).stars).toBe(3) // par-2
    expect(scoreLevel(1, 2).stars).toBe(3)
    expect(scoreLevel(1, 4).stars).toBe(2) // par-1
    expect(scoreLevel(1, 5).stars).toBe(2) // par
    expect(scoreLevel(1, 6).stars).toBe(1) // over par
    expect(scoreLevel(1, 4).underPar).toBe(true)
    expect(scoreLevel(1, 5).underPar).toBe(false)
  })

  it('nextStreak increments on under-par and resets otherwise', () => {
    expect(nextStreak(2, scoreLevel(1, 3))).toBe(3) // under par
    expect(nextStreak(2, scoreLevel(1, 5))).toBe(0) // at par (not under)
    expect(nextStreak(2, scoreLevel(1, 6))).toBe(0) // over par
    expect(nextStreak(2, null)).toBe(0) // loss
  })

  it('streakBonus and levelPoints are non-negative and monotonic', () => {
    expect(streakBonus(0)).toBe(0)
    expect(streakBonus(3)).toBe(15)
    const p3 = levelPoints(scoreLevel(1, 2), 1) // 3 stars, under par
    const p1 = levelPoints(scoreLevel(1, 6), 0) // 1 star, over par
    expect(p1).toBeGreaterThanOrEqual(0)
    expect(p3).toBeGreaterThan(p1)
    // over-par base clamps to >= 0: par 5, used 20 -> base clamped
    expect(levelPoints(scoreLevel(1, 20), 0)).toBeGreaterThanOrEqual(0)
  })
})

describe('determinism / seed', () => {
  it('mulberry32 reproduces an identical sequence across instances', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    for (let i = 0; i < 20; i++) expect(a()).toBe(b())
  })

  it('a full game replays identically from the same seed', () => {
    const script: Pos[] = [
      { row: 4, col: 4 },
      { row: 0, col: 0 },
      { row: 2, col: 3 },
      { row: 1, col: 1 },
    ]
    const run = () => {
      let s = newGame(mulberry32(999))
      for (const at of script) s = probe(s, at)
      return s
    }
    expect(run()).toEqual(run())
  })

  it('dailySeed is stable per date and differs across dates', () => {
    expect(dailySeed('2026-07-15')).toBe(dailySeed('2026-07-15'))
    expect(dailySeed('2026-07-15')).not.toBe(dailySeed('2026-07-16'))
  })

  it('todayStr formats a fixed date as YYYY-MM-DD', () => {
    expect(todayStr(new Date(2026, 6, 4))).toBe('2026-07-04')
  })
})

describe('solvability', () => {
  it('assertWinnable is true for (5,8) and (7,10)', () => {
    expect(assertWinnable(5, 8)).toBe(true)
    expect(assertWinnable(7, 10)).toBe(true)
  })

  it('minProbesToCatch is 1 for sample cells and never Infinity on any cell', () => {
    expect(minProbesToCatch({ row: 0, col: 0 }, 5)).toBe(1)
    expect(minProbesToCatch({ row: 2, col: 2 }, 5)).toBe(1)
    expect(minProbesToCatch({ row: 3, col: 6 }, 7)).toBe(1)
    for (const size of [5, 7]) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          expect(minProbesToCatch({ row: r, col: c }, size)).not.toBe(Infinity)
        }
      }
    }
  })

  it('minProbesToCatch returns Infinity for off-board / degenerate input', () => {
    expect(minProbesToCatch({ row: -1, col: 0 }, 5)).toBe(Infinity)
    expect(minProbesToCatch({ row: 0, col: 0 }, 0)).toBe(Infinity)
  })
})
