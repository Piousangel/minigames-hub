import { describe, expect, it } from 'vitest'
import {
  CLEAR_BASE,
  DIFFICULTIES,
  JACKPOT_MIN,
  type Cell,
  type DeepdiveAction,
  type DeepdiveConfig,
  type DeepdiveState,
  type Dir,
  type Rng,
  affordableNeighbors,
  costBase,
  createGame,
  emptyProb,
  generateShaft,
  initialState,
  isStranded,
  mulberry32,
  neighbor,
  reachableTreasure,
  reduce,
  score,
} from './engine'

const CFG: DeepdiveConfig = DIFFICULTIES.normal

/** A queued-array Rng like the template's deterministic tests use. */
function queued(values: number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]
}

/** Shorthand cell. */
function c(cost: number, treasure = 0): Cell {
  return { cost, treasure }
}

/** Surface row of `cols` zero-cost cells. */
function surf(cols: number): Cell[] {
  return Array.from({ length: cols }, () => c(0, 0))
}

/**
 * Hand-build a state from a full grid (row 0 must be the surface). Bypasses
 * generation via `initialState`, so the reducer runs on a known board.
 */
function handState(
  grid: Cell[][],
  cfg: DeepdiveConfig,
  startCol = 0,
  overrides: Partial<DeepdiveState> = {},
): DeepdiveState {
  let totalTreasure = 0
  let treasureCount = 0
  for (let r = 1; r < grid.length; r++) {
    for (const cell of grid[r]) {
      if (cell.treasure > 0) {
        totalTreasure += cell.treasure
        treasureCount++
      }
    }
  }
  const base = initialState(cfg, 1, { grid, startCol, totalTreasure, treasureCount })
  return { ...base, ...overrides }
}

function play(state: DeepdiveState, actions: DeepdiveAction[]): DeepdiveState {
  let s = state
  for (const a of actions) s = reduce(s, a)
  return s
}

const D = (dir: Dir): DeepdiveAction => ({ type: 'move', dir })

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('pure helpers', () => {
  it('costBase is monotone non-decreasing per §', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(costBase)).toEqual([1, 1, 2, 2, 3, 3, 4])
    for (let d = 1; d < 20; d++) expect(costBase(d + 1)).toBeGreaterThanOrEqual(costBase(d))
  })

  it('emptyProb decreases with depth, clamped to [0.12, 0.50]', () => {
    expect(emptyProb(0)).toBeCloseTo(0.5)
    expect(emptyProb(1)).toBeCloseTo(0.45)
    expect(emptyProb(100)).toBe(0.12)
    for (let d = 1; d < 30; d++) expect(emptyProb(d + 1)).toBeLessThanOrEqual(emptyProb(d))
  })

  it('neighbor maps directions', () => {
    expect(neighbor({ row: 2, col: 2 }, 'up')).toEqual({ row: 1, col: 2 })
    expect(neighbor({ row: 2, col: 2 }, 'down')).toEqual({ row: 3, col: 2 })
    expect(neighbor({ row: 2, col: 2 }, 'left')).toEqual({ row: 2, col: 1 })
    expect(neighbor({ row: 2, col: 2 }, 'right')).toEqual({ row: 2, col: 3 })
  })
})

describe('createGame determinism', () => {
  it('1. same seed => identical grid/pos/air', () => {
    const a = createGame(CFG, 4242)
    const b = createGame(CFG, 4242)
    expect(a.grid).toEqual(b.grid)
    expect(a.pos).toEqual(b.pos)
    expect(a.air).toBe(b.air)
  })

  it('2. different seeds diverge', () => {
    expect(createGame(CFG, 1).grid).not.toEqual(createGame(CFG, 2).grid)
  })
})

describe('generateShaft', () => {
  it('3. golden: consumes rng in the fixed order (startCol, then cost/treasure per cell)', () => {
    const cfg: DeepdiveConfig = { cols: 2, rows: 2, capacity: 20 }
    // startCol, then d=1 c=0 (cost,treasure), d=1 c=1 (cost,treasure)
    const rng = queued([0.9, 0.3, 0.7, 0.6, 0.2])
    const g = generateShaft(cfg, rng)
    expect(g.startCol).toBe(1) // floor(0.9*2)
    expect(g.grid[0]).toEqual([c(0, 0), c(0, 0)]) // surface, no rng
    // ep(1)=0.45. c0: cost 0.3<0.5 -> 1; tRoll 0.7 -> r=0.4545, treasure=4+round(3.636)=8
    expect(g.grid[1][0]).toEqual(c(1, 8))
    // c1: cost 0.6>=0.5 -> 2; tRoll 0.2<0.45 -> empty
    expect(g.grid[1][1]).toEqual(c(2, 0))
    expect(g.totalTreasure).toBe(8)
    expect(g.treasureCount).toBe(1)
  })

  it('4. surface row is all {cost:0, treasure:0}', () => {
    const g = generateShaft(CFG, mulberry32(999))
    for (const cell of g.grid[0]) expect(cell).toEqual(c(0, 0))
  })

  it('5. every depth cell has costBase(d) <= cost <= costBase(d)+1', () => {
    const g = generateShaft(CFG, mulberry32(555))
    for (let d = 1; d < CFG.rows; d++) {
      for (const cell of g.grid[d]) {
        expect(cell.cost).toBeGreaterThanOrEqual(costBase(d))
        expect(cell.cost).toBeLessThanOrEqual(costBase(d) + 1)
      }
    }
  })

  it('6. totalTreasure and treasureCount match the grid', () => {
    const g = generateShaft(CFG, mulberry32(31337))
    let sum = 0
    let count = 0
    for (let d = 1; d < CFG.rows; d++)
      for (const cell of g.grid[d]) {
        sum += cell.treasure
        if (cell.treasure > 0) count++
      }
    expect(g.totalTreasure).toBe(sum)
    expect(g.treasureCount).toBe(count)
  })
})

describe('reduce — movement basics', () => {
  const cfg: DeepdiveConfig = { cols: 1, rows: 3, capacity: 20 }
  const grid = () => [surf(1), [c(2, 0)], [c(3, 40)]]

  it('7. descent spends air and updates pos/deepest', () => {
    const s = reduce(handState(grid(), cfg), D('down'))
    expect(s.air).toBe(18)
    expect(s.pos).toEqual({ row: 1, col: 0 })
    expect(s.deepest).toBe(1)
    expect(s.lastEvent).toBe('move')
  })

  it('8. entering a treasure cell collects it', () => {
    const s = play(handState(grid(), cfg), [D('down'), D('down')])
    expect(s.haul).toBe(40)
    expect(s.grid[2][0].treasure).toBe(0)
    expect(s.collectedCount).toBe(1)
    expect(s.lastGain).toBe(40)
    expect(s.lastEvent).toBe('collect')
  })

  it('9. re-entering an emptied cell does not re-collect', () => {
    const s = play(handState(grid(), cfg), [D('down'), D('down'), D('up'), D('down')])
    expect(s.haul).toBe(40)
    expect(s.collectedCount).toBe(1)
    expect(s.lastGain).toBe(0)
  })

  it('10. reaching the surface banks the haul; air does not refill', () => {
    // A second, uncollected treasure (col 1) keeps the run from auto-clearing.
    const cfg2: DeepdiveConfig = { cols: 2, rows: 3, capacity: 20 }
    const g2 = [surf(2), [c(2, 0), c(2, 50)], [c(3, 40), c(3, 0)]]
    const s = play(handState(g2, cfg2), [D('down'), D('down'), D('up'), D('up')])
    // air: 20 -2 -3 -2 -0 = 13
    expect(s.banked).toBe(40)
    expect(s.haul).toBe(0)
    expect(s.air).toBe(13)
    expect(s.won).toBe(false)
    expect(s.lastEvent).toBe('bank')
  })

  it('11. an out-of-bounds move is illegal and leaves state unchanged', () => {
    const s0 = handState(grid(), cfg)
    const s = reduce(s0, D('up')) // already at surface
    expect(s.lastEvent).toBe('illegal')
    expect(s.pos).toEqual(s0.pos)
    expect(s.air).toBe(s0.air)
  })

  it('12. an unaffordable move is illegal and does not move', () => {
    const s0 = handState(grid(), cfg, 0, { air: 1 })
    const s = reduce(s0, D('down')) // cost 2 > air 1
    expect(s.lastEvent).toBe('illegal')
    expect(s.pos).toEqual({ row: 0, col: 0 })
    expect(s.air).toBe(1)
  })

  it('15. horizontal surface moves cost no air', () => {
    const g = [surf(3), [c(2, 10), c(2, 10), c(2, 10)]] // treasure keeps it from auto-clearing
    const cfg3: DeepdiveConfig = { cols: 3, rows: 2, capacity: 10 }
    const s = play(handState(g, cfg3), [D('right'), D('right')])
    expect(s.pos).toEqual({ row: 0, col: 2 })
    expect(s.air).toBe(10)
  })
})

describe('reduce — drown & clear', () => {
  it('13. golden: trapped below with all neighbors unaffordable drowns, loses haul, keeps banked', () => {
    const cfg: DeepdiveConfig = { cols: 1, rows: 3, capacity: 4 }
    const grid = [surf(1), [c(2, 0)], [c(2, 50)]]
    const s = play(handState(grid, cfg, 0, { banked: 100 }), [D('down'), D('down')])
    expect(s.air).toBe(0)
    expect(s.drowned).toBe(true)
    expect(s.over).toBe(true)
    expect(s.won).toBe(false)
    expect(s.haul).toBe(0)
    expect(s.drownedHaul).toBe(50)
    expect(s.banked).toBe(100) // preserved
    expect(s.lastEvent).toBe('drown')
  })

  it('14. depth 1 can never drown (surface neighbor is free)', () => {
    const cfg: DeepdiveConfig = { cols: 1, rows: 2, capacity: 2 }
    const grid = [surf(1), [c(2, 30)]]
    const s = reduce(handState(grid, cfg), D('down'))
    expect(s.air).toBe(0)
    expect(s.drowned).toBe(false)
    expect(affordableNeighbors(s).some((n) => n.row === 0)).toBe(true)
  })

  it('16. golden: full collect + bank clears the shaft with the clear bonus', () => {
    const cfg: DeepdiveConfig = { cols: 1, rows: 2, capacity: 10 }
    const grid = [surf(1), [c(2, 30)]]
    const s = play(handState(grid, cfg), [D('down'), D('up')])
    expect(s.won).toBe(true)
    expect(s.over).toBe(true)
    expect(s.lastEvent).toBe('clear')
    // banked = totalTreasure(30) + CLEAR_BASE(500) + air(8)
    expect(s.banked).toBe(30 + CLEAR_BASE + 8)
    expect(s.banked).toBe(s.totalTreasure + CLEAR_BASE + s.air)
  })

  it('17. collecting everything then drowning before banking is not a win', () => {
    const cfg: DeepdiveConfig = { cols: 1, rows: 3, capacity: 4 }
    const grid = [surf(1), [c(2, 0)], [c(2, 50)]]
    const s = play(handState(grid, cfg), [D('down'), D('down')])
    expect(s.collectedCount).toBe(s.treasureCount)
    expect(s.won).toBe(false)
    expect(s.drowned).toBe(true)
  })
})

describe('reduce — invariants across a run', () => {
  it('18. banked is monotone non-decreasing and air monotone non-increasing', () => {
    const cfg: DeepdiveConfig = { cols: 2, rows: 3, capacity: 30 }
    const grid = [surf(2), [c(2, 20), c(2, 0)], [c(3, 40), c(3, 0)]]
    let s = handState(grid, cfg)
    const script: Dir[] = ['down', 'down', 'up', 'up', 'right']
    for (const dir of script) {
      const before = s
      s = reduce(s, D(dir))
      expect(s.banked).toBeGreaterThanOrEqual(before.banked)
      expect(s.air).toBeLessThanOrEqual(before.air)
    }
  })

  it('19. banked from a prior dive survives a later drown', () => {
    const cfg: DeepdiveConfig = { cols: 1, rows: 3, capacity: 8 }
    // dive1: collect row1 (cost2, tr20), bank. dive2: sink to row2 and drown.
    const grid = [surf(1), [c(2, 20)], [c(4, 50)]]
    let s = play(handState(grid, cfg), [D('down'), D('up')])
    expect(s.banked).toBe(20)
    // air now 6. dive: row1 (cost2 -> air4), row2 (cost4 -> air0); up needs 2 > 0 -> drown
    s = play(s, [D('down'), D('down')])
    expect(s.drowned).toBe(true)
    expect(s.banked).toBe(20) // preserved
  })

  it('23. banked never exceeds totalTreasure + CLEAR_BASE + capacity', () => {
    const cfg: DeepdiveConfig = { cols: 1, rows: 2, capacity: 10 }
    const grid = [surf(1), [c(2, 30)]]
    let s = handState(grid, cfg)
    const cap = () => s.totalTreasure + CLEAR_BASE + cfg.capacity
    expect(s.banked).toBeLessThanOrEqual(cap())
    s = play(s, [D('down'), D('up')])
    expect(s.banked).toBeLessThanOrEqual(cap())
  })
})

describe('reduce — collect events & retire', () => {
  it('24. a big haul emits jackpot, a small one emits collect', () => {
    const cfg: DeepdiveConfig = { cols: 1, rows: 2, capacity: 20 }
    const big = reduce(handState([surf(1), [c(1, JACKPOT_MIN)]], cfg), D('down'))
    expect(big.lastEvent).toBe('jackpot')
    const small = reduce(handState([surf(1), [c(1, JACKPOT_MIN - 1)]], cfg), D('down'))
    expect(small.lastEvent).toBe('collect')
  })

  it('20. retire ends the run only from the surface', () => {
    const cfg: DeepdiveConfig = { cols: 1, rows: 2, capacity: 20 }
    const grid = [surf(1), [c(2, 0)]]
    // below surface -> illegal, no termination
    const below = reduce(handState(grid, cfg, 0, { pos: { row: 1, col: 0 } }), { type: 'retire' })
    expect(below.lastEvent).toBe('illegal')
    expect(below.over).toBe(false)
    // at surface -> over
    const top = reduce(handState(grid, cfg), { type: 'retire' })
    expect(top.over).toBe(true)
    expect(top.lastEvent).toBe('retire')
  })
})

describe('reset / new / reachability', () => {
  it('21. reset reproduces createGame(config, seed)', () => {
    const g = createGame(CFG, 4242)
    let s = play(g, [D('down'), D('down')])
    s = reduce(s, { type: 'reset' })
    expect(s.grid).toEqual(g.grid)
    expect(s.pos).toEqual(g.pos)
    expect(s.air).toBe(g.air)
  })

  it('22. new(seed) builds that seed board', () => {
    const s = reduce(createGame(CFG, 1), { type: 'new', seed: 9999 })
    expect(s.grid).toEqual(createGame(CFG, 9999).grid)
  })

  it('25. createGame returns a board with reachable treasure', () => {
    for (const seed of [1, 2, 3, 100, 12345, 88888]) {
      const g = createGame(CFG, seed)
      expect(g.totalTreasure).toBeGreaterThan(0)
      expect(reachableTreasure(g.grid, g.config)).toBeGreaterThan(0)
    }
  })
})

describe('isStranded', () => {
  it('26. surface with every descending neighbor unaffordable is stranded', () => {
    const cfg: DeepdiveConfig = { cols: 2, rows: 2, capacity: 3 }
    const grid = [surf(2), [c(5, 10), c(5, 10)]]
    const s = handState(grid, cfg)
    expect(isStranded(s)).toBe(true)
    // with air to spare, not stranded
    expect(isStranded({ ...s, air: 5 })).toBe(false)
  })
})

describe('full determinism & clutch', () => {
  it('27. golden: same seed + same action list => identical final state', () => {
    const script: DeepdiveAction[] = [
      D('down'),
      D('down'),
      D('right'),
      D('up'),
      D('up'),
      D('left'),
      D('down'),
    ]
    const a = play(createGame(CFG, 20240716), script)
    const b = play(createGame(CFG, 20240716), script)
    expect(a).toEqual(b)
    expect(a.banked).toBe(b.banked)
    expect(score(a)).toBe(score(b))
  })

  it('28. golden clutch: air hits exactly 0 on the return; banks instead of drowning', () => {
    const cfg: DeepdiveConfig = { cols: 2, rows: 3, capacity: 7 }
    // col0: dive down (2) + down (3) collect 40, then up (2), up surface (0) => air 0.
    // col1 keeps an uncollected treasure so the run does not auto-clear.
    const grid = [surf(2), [c(2, 0), c(2, 99)], [c(3, 40), c(9, 0)]]
    const s = play(handState(grid, cfg), [D('down'), D('down'), D('up'), D('up')])
    expect(s.air).toBe(0)
    expect(s.drowned).toBe(false)
    expect(s.won).toBe(false) // col1 treasure still uncollected
    expect(s.banked).toBe(40)
    expect(s.haul).toBe(0)
    expect(s.lastEvent).toBe('bank')
  })
})
