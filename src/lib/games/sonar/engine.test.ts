import { describe, it, expect } from 'vitest'
import {
  mulberry32,
  manhattan,
  inBounds,
  nearestDistance,
  placeTargets,
  emptyGrid,
  createGame,
  ping,
  claim,
  reduce,
  isWon,
  isLost,
  dailySeed,
  DIFFICULTIES,
  CAPTURE_POINTS,
  DEDUCE_BONUS,
  WIN_BONUS,
  PAR_BONUS_MAX,
  LIFE_BONUS,
  PINGS_PER_TARGET,
  type SonarState,
  type Pos,
} from './engine'

// A 5×5 game with a single target hand-placed at `t`, empty grid.
function singleTargetGame(t: Pos, size = 5): SonarState {
  const base = createGame({ size, targets: 1, lives: 3, minSep: 1 }, 1)
  return { ...base, targets: [{ ...t }], grid: emptyGrid(size) }
}

describe('mulberry32', () => {
  it('is deterministic: same seed => same first 5 outputs', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
  })
})

describe('manhattan', () => {
  it('is symmetric, zero on equal, positive otherwise', () => {
    const p = { row: 2, col: 3 }
    const q = { row: 5, col: 1 }
    expect(manhattan(p, p)).toBe(0)
    expect(manhattan(p, q)).toBe(manhattan(q, p))
    expect(manhattan(p, q)).toBe(5)
    expect(manhattan({ row: 0, col: 0 }, { row: 3, col: 4 })).toBe(7)
  })
})

describe('inBounds', () => {
  it('respects [0,size)', () => {
    expect(inBounds(5, { row: 0, col: 0 })).toBe(true)
    expect(inBounds(5, { row: 4, col: 4 })).toBe(true)
    expect(inBounds(5, { row: -1, col: 0 })).toBe(false)
    expect(inBounds(5, { row: 0, col: 5 })).toBe(false)
  })
})

describe('nearestDistance', () => {
  it('returns min over multiple targets, 0 on a target cell', () => {
    const targets = [
      { row: 1, col: 1 },
      { row: 4, col: 4 },
    ]
    expect(nearestDistance(targets, { row: 2, col: 2 })).toBe(2)
    expect(nearestDistance(targets, { row: 4, col: 4 })).toBe(0)
    expect(nearestDistance(targets, { row: 0, col: 0 })).toBe(2)
  })
})

describe('placeTargets', () => {
  it('produces exactly count distinct in-bounds positions', () => {
    const size = 8
    const t = placeTargets(size, 3, mulberry32(99), 2)
    expect(t).toHaveLength(3)
    const seen = new Set(t.map((p) => `${p.row},${p.col}`))
    expect(seen.size).toBe(3)
    for (const p of t) expect(inBounds(size, p)).toBe(true)
  })

  it('respects minSep with room to spare', () => {
    const t = placeTargets(10, 3, mulberry32(5), 3)
    for (let i = 0; i < t.length; i++) {
      for (let j = i + 1; j < t.length; j++) {
        expect(manhattan(t[i], t[j])).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('is deterministic (golden): same seed => same coordinates', () => {
    const a = placeTargets(6, 2, mulberry32(42), 2)
    const b = placeTargets(6, 2, mulberry32(42), 2)
    expect(a).toEqual(b)
    // golden coordinates for easy seed 42
    expect(a).toEqual([
      { row: 3, col: 2 },
      { row: 5, col: 4 },
    ])
  })
})

describe('emptyGrid', () => {
  it('is all-unknown', () => {
    const g = emptyGrid(4)
    expect(g).toHaveLength(4)
    for (const row of g) {
      expect(row).toHaveLength(4)
      for (const cell of row) {
        expect(cell).toEqual({ ping: null, cleared: false, captured: false, miss: false })
      }
    }
  })
})

describe('createGame', () => {
  it('initializes status/lives/score/par/targets/grid all unknown', () => {
    const s = createGame(DIFFICULTIES.normal, 7)
    expect(s.status).toBe('playing')
    expect(s.lives).toBe(3)
    expect(s.score).toBe(0)
    expect(s.pingCount).toBe(0)
    expect(s.par).toBe(DIFFICULTIES.normal.targets * PINGS_PER_TARGET)
    expect(s.targets).toHaveLength(DIFFICULTIES.normal.targets)
    expect(s.captured).toEqual([])
    expect(s.cursor).toEqual({ row: 3, col: 3 }) // floor((8-1)/2) = 3
    for (const row of s.grid) for (const cell of row) expect(cell.ping).toBeNull()
  })

  it('is deterministic: same seed => deep-equal grid & targets', () => {
    const a = createGame(DIFFICULTIES.hard, 2024)
    const b = createGame(DIFFICULTIES.hard, 2024)
    expect(a.targets).toEqual(b.targets)
    expect(a.grid).toEqual(b.grid)
  })
})

describe('ping — empty cell', () => {
  it('records distance, sets grid.ping, clears the disk, no capture', () => {
    const s = singleTargetGame({ row: 2, col: 2 })
    const after = ping(s, { row: 2, col: 0 })
    expect(after.lastEvent).toBe('ping')
    expect(after.grid[2][0].ping).toBe(2)
    expect(after.grid[2][0].captured).toBe(false)
    expect(after.pingCount).toBe(1)
    expect(after.lastPing).toEqual({
      at: { row: 2, col: 0 },
      distance: 2,
      targetsLeft: 1,
      seq: 1,
    })
    // input unchanged (purity)
    expect(s.grid[2][0].ping).toBeNull()
  })

  it('golden cleared set: 5×5 target (2,2), ping (2,0) d=2 clears exactly {(2,0),(1,0),(3,0),(2,1)}', () => {
    const s = singleTargetGame({ row: 2, col: 2 })
    const after = ping(s, { row: 2, col: 0 })
    const expected = new Set(['2,0', '1,0', '3,0', '2,1'])
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        expect(after.grid[r][c].cleared).toBe(expected.has(`${r},${c}`))
      }
    }
    // the target itself is not cleared
    expect(after.grid[2][2].cleared).toBe(false)
  })
})

describe('ping — direct hit', () => {
  it('captures, shrinks targets, appends captured, +CAPTURE_POINTS, event capture', () => {
    const s = singleTargetGame({ row: 2, col: 2 }, 6)
    // two targets so the game does not end
    const s2: SonarState = { ...s, targets: [{ row: 2, col: 2 }, { row: 5, col: 5 }] }
    const after = ping(s2, { row: 2, col: 2 })
    expect(after.lastEvent).toBe('capture')
    expect(after.grid[2][2].captured).toBe(true)
    expect(after.targets).toEqual([{ row: 5, col: 5 }])
    expect(after.captured).toEqual([{ row: 2, col: 2 }])
    expect(after.score).toBe(CAPTURE_POINTS)
    expect(after.status).toBe('playing')
  })
})

describe('ping counting & repeats', () => {
  it('increments pingCount per information ping', () => {
    let s = singleTargetGame({ row: 4, col: 4 })
    s = ping(s, { row: 0, col: 0 })
    s = ping(s, { row: 0, col: 4 })
    expect(s.pingCount).toBe(2)
    expect(s.pings).toHaveLength(2)
  })

  it('re-ping of a pinged cell => ping-repeat, no change, pingCount unchanged', () => {
    let s = singleTargetGame({ row: 4, col: 4 })
    s = ping(s, { row: 0, col: 0 })
    const before = s
    const after = ping(s, { row: 0, col: 0 })
    expect(after.lastEvent).toBe('ping-repeat')
    expect(after.pingCount).toBe(before.pingCount)
    expect(after.pings).toBe(before.pings)
    expect(after.score).toBe(before.score)
  })
})

describe('ping — illegal', () => {
  it('out of bounds => illegal, no change to board', () => {
    const s = singleTargetGame({ row: 2, col: 2 })
    const after = ping(s, { row: -1, col: 0 })
    expect(after.lastEvent).toBe('illegal')
    expect(after.pingCount).toBe(0)
  })

  it('pinging a captured cell => illegal', () => {
    const s = singleTargetGame({ row: 2, col: 2 }, 6)
    const s2: SonarState = { ...s, targets: [{ row: 2, col: 2 }, { row: 5, col: 5 }] }
    const cap = ping(s2, { row: 2, col: 2 })
    const again = ping(cap, { row: 2, col: 2 })
    expect(again.lastEvent).toBe('illegal')
  })

  it('pinging after game over => illegal', () => {
    let s = singleTargetGame({ row: 0, col: 0 })
    s = ping(s, { row: 0, col: 0 }) // captures the only target => won
    expect(s.status).toBe('won')
    const after = ping(s, { row: 3, col: 3 })
    expect(after.lastEvent).toBe('illegal')
    expect(after.pingCount).toBe(1)
  })
})

describe('Voronoi movement (golden)', () => {
  it('nearest reading shifts to the surviving target after a capture', () => {
    const base = singleTargetGame({ row: 1, col: 1 }, 6)
    const s: SonarState = { ...base, targets: [{ row: 1, col: 1 }, { row: 4, col: 4 }] }
    // capture the near target directly
    const s1 = ping(s, { row: 1, col: 1 })
    expect(s1.lastEvent).toBe('capture')
    expect(s1.targets).toEqual([{ row: 4, col: 4 }])
    // a different cell now reads against the surviving target only
    const s2 = ping(s1, { row: 2, col: 2 })
    expect(s2.lastPing?.distance).toBe(4) // manhattan((4,4),(2,2))
  })
})

describe('claim', () => {
  it('correct mark on an un-pinged target: capture + CAPTURE + DEDUCE, event deduce', () => {
    const s = singleTargetGame({ row: 2, col: 2 }, 6)
    const s2: SonarState = { ...s, targets: [{ row: 2, col: 2 }, { row: 5, col: 5 }] }
    const after = claim(s2, { row: 2, col: 2 })
    expect(after.lastEvent).toBe('deduce')
    expect(after.grid[2][2].captured).toBe(true)
    expect(after.score).toBe(CAPTURE_POINTS + DEDUCE_BONUS)
    expect(after.targets).toEqual([{ row: 5, col: 5 }])
    expect(after.claims).toEqual([{ at: { row: 2, col: 2 }, hit: true, seq: 1 }])
  })

  it('wrong mark: miss + cleared, lives-1, event miss, score unchanged', () => {
    const s = singleTargetGame({ row: 2, col: 2 })
    const after = claim(s, { row: 0, col: 0 })
    expect(after.lastEvent).toBe('miss')
    expect(after.grid[0][0].miss).toBe(true)
    expect(after.grid[0][0].cleared).toBe(true)
    expect(after.lives).toBe(2)
    expect(after.score).toBe(0)
    expect(after.status).toBe('playing')
  })

  it('running out of lives => status lost, event lose', () => {
    let s = singleTargetGame({ row: 2, col: 2 })
    s = { ...s, lives: 1 }
    const after = claim(s, { row: 0, col: 0 })
    expect(after.lives).toBe(0)
    expect(after.status).toBe('lost')
    expect(after.lastEvent).toBe('lose')
  })

  it('claim on cleared / pinged-empty cell => illegal, lives unchanged', () => {
    let s = singleTargetGame({ row: 2, col: 2 })
    s = ping(s, { row: 2, col: 0 }) // clears (2,0),(1,0),(3,0),(2,1) and pings (2,0) with d=2
    const onCleared = claim(s, { row: 1, col: 0 })
    expect(onCleared.lastEvent).toBe('illegal')
    expect(onCleared.lives).toBe(3)
    const onPinged = claim(s, { row: 2, col: 0 })
    expect(onPinged.lastEvent).toBe('illegal')
    expect(onPinged.lives).toBe(3)
  })

  it('claim on a captured cell => illegal', () => {
    const s = singleTargetGame({ row: 2, col: 2 }, 6)
    const s2: SonarState = { ...s, targets: [{ row: 2, col: 2 }, { row: 5, col: 5 }] }
    const cap = claim(s2, { row: 2, col: 2 })
    const again = claim(cap, { row: 2, col: 2 })
    expect(again.lastEvent).toBe('illegal')
  })
})

describe('win settlement', () => {
  it('final mark => won, event win, exact WIN_BONUS + parBonus + lives*LIFE_BONUS', () => {
    // single target, no pings => par = 3, pingCount = 0 => parBonus full 1000
    const s = singleTargetGame({ row: 2, col: 2 })
    const withPar: SonarState = { ...s, par: 3 }
    const after = claim(withPar, { row: 2, col: 2 })
    expect(after.status).toBe('won')
    expect(after.lastEvent).toBe('win')
    // 200 + 200 (deduce) + 1000 win + 1000 parBonus(0 pings) + 3*250 lives
    expect(after.score).toBe(CAPTURE_POINTS + DEDUCE_BONUS + WIN_BONUS + PAR_BONUS_MAX + 3 * LIFE_BONUS)
  })

  it('final direct-hit ping => won with the same bonus structure', () => {
    const s = singleTargetGame({ row: 0, col: 0 })
    const after = ping(s, { row: 0, col: 0 })
    expect(after.status).toBe('won')
    expect(after.lastEvent).toBe('win')
    // capture 200 + win 1000 + parBonus(par=3, pings=1 => min(1,3)=1 => 1000) + 3*250
    expect(after.score).toBe(CAPTURE_POINTS + WIN_BONUS + PAR_BONUS_MAX + 3 * LIFE_BONUS)
  })
})

describe('parBonus scaling', () => {
  it('full 1000 when pingCount <= par, scaled when over (par 9, pings 12 => 750)', () => {
    // Build a normal game, drive it to a win with a controlled ping count.
    // Easier: verify the formula-implied score deltas via a crafted state.
    // par 9, pingCount 12 -> round(1000 * 9/12) = 750
    const s = singleTargetGame({ row: 0, col: 0 })
    const crafted: SonarState = { ...s, par: 9, pingCount: 11 } // this ping makes 12
    const after = ping(crafted, { row: 0, col: 0 })
    expect(after.pingCount).toBe(12)
    // capture 200 + win 1000 + 750 parBonus + 3*250 lives
    expect(after.score).toBe(CAPTURE_POINTS + WIN_BONUS + 750 + 3 * LIFE_BONUS)
  })
})

describe('score monotonicity', () => {
  it('never decreases across a scripted sequence', () => {
    let s = createGame(DIFFICULTIES.easy, 42) // targets [{3,2},{5,4}]
    const actions: Pos[] = [
      { row: 0, col: 0 },
      { row: 5, col: 5 },
      { row: 1, col: 1 },
    ]
    let prev = s.score
    for (const at of actions) {
      s = ping(s, at)
      expect(s.score).toBeGreaterThanOrEqual(prev)
      prev = s.score
    }
    // a wrong mark keeps score flat
    const beforeMiss = s.score
    s = claim(s, { row: 0, col: 5 })
    expect(s.score).toBe(beforeMiss)
  })
})

describe('full-play golden', () => {
  it('fixed seed + fixed actions => exact final state', () => {
    let s = createGame(DIFFICULTIES.easy, 42) // targets [{3,2},{5,4}], par 6
    s = ping(s, { row: 0, col: 0 }) // ping, d=5
    s = claim(s, { row: 3, col: 2 }) // deduce, +400
    s = ping(s, { row: 5, col: 4 }) // direct hit last target => win
    expect(s.status).toBe('won')
    expect(s.pingCount).toBe(2)
    expect(s.lives).toBe(3)
    expect(s.score).toBe(3350)
    expect(s.captured).toEqual([
      { row: 3, col: 2 },
      { row: 5, col: 4 },
    ])
  })
})

describe('cursor movement', () => {
  it('move clamps at edges (no wrap)', () => {
    let s = createGame(DIFFICULTIES.easy, 1) // size 6, cursor center (2,2)
    s = reduce(s, { type: 'cursor', at: { row: 0, col: 0 } })
    expect(s.cursor).toEqual({ row: 0, col: 0 })
    s = reduce(s, { type: 'move', dRow: -1, dCol: -1 })
    expect(s.cursor).toEqual({ row: 0, col: 0 }) // clamped, no wrap
    s = reduce(s, { type: 'move', dRow: 99, dCol: 99 })
    expect(s.cursor).toEqual({ row: 5, col: 5 }) // clamped to size-1
  })
})

describe('reduce reset / new', () => {
  it('reset rebuilds the same seed; new applies a new seed', () => {
    let s = createGame(DIFFICULTIES.easy, 42)
    s = ping(s, { row: 0, col: 0 })
    const reset = reduce(s, { type: 'reset' })
    expect(reset.pingCount).toBe(0)
    expect(reset.targets).toEqual(createGame(DIFFICULTIES.easy, 42).targets)
    const fresh = reduce(s, { type: 'new', seed: 7 })
    expect(fresh.seed).toBe(7)
    expect(fresh.targets).toEqual(createGame(DIFFICULTIES.easy, 7).targets)
  })
})

describe('isWon / isLost / dailySeed', () => {
  it('isWon iff no targets remain', () => {
    const s = singleTargetGame({ row: 0, col: 0 })
    expect(isWon(s)).toBe(false)
    const won = ping(s, { row: 0, col: 0 })
    expect(isWon(won)).toBe(true)
  })

  it('isLost iff status lost', () => {
    let s = singleTargetGame({ row: 2, col: 2 })
    s = { ...s, lives: 1 }
    const lost = claim(s, { row: 0, col: 0 })
    expect(isLost(lost)).toBe(true)
  })

  it('dailySeed is deterministic and integer', () => {
    const a = dailySeed('2026-07-16')
    const b = dailySeed('2026-07-16')
    expect(a).toBe(b)
    expect(Number.isInteger(a)).toBe(true)
    expect(a).not.toBe(dailySeed('2026-07-17'))
  })
})
