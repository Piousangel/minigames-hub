import { describe, expect, it } from 'vitest'
import {
  crossCells,
  emptyGrid,
  isSolved,
  newGame,
  press,
  SIZE,
  toggle,
  type GameState,
  type Grid,
} from './engine'

const stateFrom = (grid: Grid): GameState => ({ grid, moves: 0, solved: isSolved(grid) })

/** Count how many lights are on. */
const litCount = (grid: Grid): number => grid.flat().filter(Boolean).length

/** Set of "r,c" strings that are on — order-independent comparison. */
const litSet = (grid: Grid): Set<string> => {
  const s = new Set<string>()
  grid.forEach((row, r) => row.forEach((on, c) => { if (on) s.add(`${r},${c}`) }))
  return s
}

/**
 * Solve Ax=b over GF(2) via Gaussian elimination, where column j is the toggle
 * pattern of pressing cell j and b is the current grid. Returns the list of
 * cells to press, or null if unsolvable. Used to prove a generated board is
 * genuinely reachable to all-off.
 */
function solve(grid: Grid): Array<[number, number]> | null {
  const n = SIZE * SIZE
  const idx = (r: number, c: number) => r * SIZE + c
  // rows[i] is a bitmask of n unknowns + 1 augmented bit (the target).
  const rows: bigint[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      let mask = 0n
      for (const [rr, cc] of crossCells(r, c)) mask |= 1n << BigInt(idx(rr, cc))
      if (grid[r][c]) mask |= 1n << BigInt(n) // augmented target bit
      rows.push(mask)
    }
  }
  // Forward elimination.
  let pivotRow = 0
  const pivotCols: number[] = []
  for (let col = 0; col < n && pivotRow < n; col++) {
    let sel = -1
    for (let i = pivotRow; i < n; i++) {
      if ((rows[i] >> BigInt(col)) & 1n) { sel = i; break }
    }
    if (sel === -1) continue
    ;[rows[pivotRow], rows[sel]] = [rows[sel], rows[pivotRow]]
    for (let i = 0; i < n; i++) {
      if (i !== pivotRow && ((rows[i] >> BigInt(col)) & 1n)) rows[i] ^= rows[pivotRow]
    }
    pivotCols.push(col)
    pivotRow++
  }
  // Consistency check: no row of form 0...0 | 1.
  for (let i = pivotRow; i < n; i++) {
    if (rows[i] === 1n << BigInt(n)) return null
  }
  // Back-read a particular solution (free vars = 0).
  const x = new Array<number>(n).fill(0)
  for (let p = 0; p < pivotCols.length; p++) {
    x[pivotCols[p]] = Number((rows[p] >> BigInt(n)) & 1n)
  }
  const presses: Array<[number, number]> = []
  for (let i = 0; i < n; i++) if (x[i]) presses.push([Math.floor(i / SIZE), i % SIZE])
  return presses
}

describe('toggle / crossCells', () => {
  it('center press toggles exactly the cell + 4 neighbours', () => {
    const g = toggle(emptyGrid(), 2, 2)
    expect(litSet(g)).toEqual(new Set(['2,2', '1,2', '3,2', '2,1', '2,3']))
    expect(litCount(g)).toBe(5)
  })

  it('corner press toggles only 3 cells (fewer neighbours)', () => {
    const g = toggle(emptyGrid(), 0, 0)
    expect(litSet(g)).toEqual(new Set(['0,0', '1,0', '0,1']))
    expect(litCount(g)).toBe(3)
  })

  it('edge press toggles 4 cells', () => {
    const g = toggle(emptyGrid(), 0, 2)
    expect(litSet(g)).toEqual(new Set(['0,2', '0,1', '0,3', '1,2']))
    expect(litCount(g)).toBe(4)
  })

  it('crossCells clamps to the board at corners/edges', () => {
    expect(new Set(crossCells(0, 0).map((p) => p.join(',')))).toEqual(
      new Set(['0,0', '1,0', '0,1']),
    )
    expect(crossCells(2, 2)).toHaveLength(5)
    expect(crossCells(4, 4)).toHaveLength(3)
    expect(crossCells(4, 2)).toHaveLength(4)
  })
})

describe('press', () => {
  it('increments the move counter and does not mutate the input', () => {
    const startGrid = toggle(emptyGrid(), 0, 0) // unsolved so presses are live
    const s0 = stateFrom(startGrid)
    const snapshot = startGrid.map((row) => [...row])
    const s1 = press(s0, 1, 1)
    expect(s1.moves).toBe(1)
    expect(s0.moves).toBe(0)
    expect(s0.grid).toEqual(snapshot) // input untouched
    const s2 = press(s1, 3, 3)
    expect(s2.moves).toBe(2)
  })

  it('pressing the same cell twice restores the original grid', () => {
    const s0 = stateFrom(toggle(emptyGrid(), 4, 0)) // some scrambled start
    const once = press(s0, 2, 2)
    const twice = press(once, 2, 2)
    expect(twice.grid).toEqual(s0.grid)
    expect(twice.moves).toBe(2) // still counts both presses
  })

  it('reaches solved when the last light goes off', () => {
    // A single lit cross (press at 2,2 from empty) is undone by pressing 2,2.
    const scrambled = stateFrom(toggle(emptyGrid(), 2, 2))
    expect(scrambled.solved).toBe(false)
    const done = press(scrambled, 2, 2)
    expect(done.solved).toBe(true)
    expect(isSolved(done.grid)).toBe(true)
  })

  it('is a no-op once solved', () => {
    const solved = stateFrom(emptyGrid())
    solved.solved = true
    expect(press(solved, 0, 0)).toBe(solved)
  })
})

describe('isSolved', () => {
  it('true only when every light is off', () => {
    expect(isSolved(emptyGrid())).toBe(true)
    expect(isSolved(toggle(emptyGrid(), 0, 0))).toBe(false)
  })
})

describe('newGame', () => {
  it('produces a board that is not already solved', () => {
    for (let seed = 0; seed < 25; seed++) {
      const rng = mulberry32(seed)
      const s = newGame(rng)
      expect(s.moves).toBe(0)
      expect(s.solved).toBe(false)
      expect(isSolved(s.grid)).toBe(false)
    }
  })

  it('produces a SOLVABLE board — pressing the solution cells clears it', () => {
    for (let seed = 0; seed < 25; seed++) {
      const rng = mulberry32(seed)
      const s = newGame(rng)
      const solution = solve(s.grid)
      expect(solution).not.toBeNull()
      let cur = s
      for (const [r, c] of solution!) cur = press(cur, r, c)
      expect(cur.solved).toBe(true)
      expect(isSolved(cur.grid)).toBe(true)
    }
  })
})

/** Deterministic PRNG so tests never touch Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
