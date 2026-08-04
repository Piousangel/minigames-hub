import { describe, it, expect } from 'vitest'
import {
  type Cell,
  type FlowState,
  LEVELS,
  LEVEL_COUNT,
  adjacent,
  clearAll,
  clearPath,
  connectedCount,
  createLevel,
  difficultyOf,
  endpointColorAt,
  eq,
  extendPath,
  filledCount,
  isConnected,
  isSolved,
  ownerAt,
  solve,
  startPath,
  totalCells,
} from './engine'

// -- helpers -----------------------------------------------------------------

/** Draw a colour along an ordered list of cells (start dot first). */
function draw(state: FlowState, color: string, cells: Cell[]): FlowState {
  let s = startPath(state, color, cells[0])
  for (let i = 1; i < cells.length; i++) s = extendPath(s, color, cells[i])
  return s
}

// Index of the first 5×5 bank level — used as a roomy fixture for drag/route tests.
const MINI = LEVELS.findIndex((l) => l.size === 5)

// -- bank integrity ----------------------------------------------------------

describe('level bank', () => {
  it('has at least 24 levels', () => {
    expect(LEVEL_COUNT).toBeGreaterThanOrEqual(24)
    expect(LEVELS.length).toBe(LEVEL_COUNT)
  })

  it('covers sizes 5, 6 and 7', () => {
    const sizes = new Set(LEVELS.map((l) => l.size))
    expect(sizes.has(5)).toBe(true)
    expect(sizes.has(6)).toBe(true)
    expect(sizes.has(7)).toBe(true)
  })

  it('every level is internally well-formed (distinct in-bounds endpoints, unique colours)', () => {
    for (const [i, lv] of LEVELS.entries()) {
      const N = lv.size
      const colors = new Set<string>()
      const occupied = new Set<string>()
      for (const p of lv.pairs) {
        expect(colors.has(p.color), `level ${i} dup colour ${p.color}`).toBe(false)
        colors.add(p.color)
        for (const c of [p.a, p.b]) {
          expect(c[0]).toBeGreaterThanOrEqual(0)
          expect(c[1]).toBeGreaterThanOrEqual(0)
          expect(c[0]).toBeLessThan(N)
          expect(c[1]).toBeLessThan(N)
          const key = `${c[0]},${c[1]}`
          expect(occupied.has(key), `level ${i} overlapping endpoint ${key}`).toBe(false)
          occupied.add(key)
        }
        expect(eq(p.a, p.b), `level ${i} zero-length pair`).toBe(false)
      }
      expect(lv.pairs.length).toBeGreaterThanOrEqual(4)
    }
  })

  // The headline guarantee: EVERY bank level admits a full-coverage solution.
  it('every bank level is solvable (full coverage)', () => {
    for (const [i, lv] of LEVELS.entries()) {
      expect(solve(lv), `level ${i} (${lv.size}×${lv.size}) is NOT solvable`).toBe(true)
    }
  })

  it('difficulty labels track grid size', () => {
    expect(difficultyOf({ size: 5, pairs: [] })).toBe('Easy')
    expect(difficultyOf({ size: 6, pairs: [] })).toBe('Medium')
    expect(difficultyOf({ size: 7, pairs: [] })).toBe('Hard')
  })
})

// -- solver sanity -----------------------------------------------------------

describe('solve()', () => {
  it('accepts a trivially solvable 2×2', () => {
    // Two colours, each a straight 2-cell line, tiling the 2×2.
    expect(
      solve({
        size: 2,
        pairs: [
          { color: 'cyan', a: [0, 0], b: [0, 1] },
          { color: 'magenta', a: [1, 0], b: [1, 1] },
        ],
      }),
    ).toBe(true)
  })

  it('rejects an unsolvable layout (a cell can never be covered)', () => {
    // 3×3 with a single colour whose endpoints are adjacent corners; there is
    // no single path that also covers the far cells → no full cover.
    expect(
      solve({
        size: 3,
        pairs: [{ color: 'cyan', a: [0, 0], b: [0, 1] }],
      }),
    ).toBe(false)
  })
})

// -- geometry helpers --------------------------------------------------------

describe('cell helpers', () => {
  it('eq compares by value', () => {
    expect(eq([1, 2], [1, 2])).toBe(true)
    expect(eq([1, 2], [2, 1])).toBe(false)
  })
  it('adjacent is orthogonal-only', () => {
    expect(adjacent([0, 0], [0, 1])).toBe(true)
    expect(adjacent([0, 0], [1, 0])).toBe(true)
    expect(adjacent([0, 0], [1, 1])).toBe(false)
    expect(adjacent([0, 0], [0, 2])).toBe(false)
    expect(adjacent([2, 2], [2, 2])).toBe(false)
  })
})

// -- createLevel -------------------------------------------------------------

describe('createLevel', () => {
  it('starts empty, playing, no coverage', () => {
    const s = createLevel(0)
    expect(s.status).toBe('playing')
    expect(s.moves).toBe(0)
    expect(filledCount(s)).toBe(0)
    expect(connectedCount(s)).toBe(0)
    expect(s.owner.every((o) => o === null)).toBe(true)
  })
  it('wraps out-of-range indices', () => {
    expect(createLevel(LEVEL_COUNT).levelIndex).toBe(0)
    expect(createLevel(-1).levelIndex).toBe(LEVEL_COUNT - 1)
  })
  it('exposes endpoints via endpointColorAt', () => {
    const s = createLevel(MINI)
    const p = LEVELS[MINI].pairs[0]
    expect(endpointColorAt(s, p.a)).toBe(p.color)
    expect(endpointColorAt(s, p.b)).toBe(p.color)
    // a non-endpoint interior cell — find one that isn't any endpoint
    const eps = new Set(LEVELS[MINI].pairs.flatMap((x) => [`${x.a}`, `${x.b}`]))
    let empty: Cell | null = null
    for (let r = 0; r < s.size && !empty; r++)
      for (let c = 0; c < s.size && !empty; c++)
        if (!eps.has(`${[r, c]}`)) empty = [r, c]
    expect(empty).not.toBeNull()
    expect(endpointColorAt(s, empty as Cell)).toBeNull()
  })
})

// -- startPath ---------------------------------------------------------------

describe('startPath', () => {
  it('starts a path at an endpoint', () => {
    const s0 = createLevel(0)
    const color = s0.pairs[0].color
    const s1 = startPath(s0, color, s0.pairs[0].a)
    expect(s1).not.toBe(s0)
    expect(s1.paths[color]).toEqual([s0.pairs[0].a])
    expect(ownerAt(s1, s0.pairs[0].a)).toBe(color)
  })

  it('is a no-op when starting on a non-endpoint empty cell', () => {
    const s0 = createLevel(0)
    const color = s0.pairs[0].color
    // find an empty non-endpoint cell
    const eps = new Set(s0.pairs.flatMap((p) => [`${p.a}`, `${p.b}`]))
    let cell: Cell = [0, 0]
    outer: for (let r = 0; r < s0.size; r++)
      for (let c = 0; c < s0.size; c++)
        if (!eps.has(`${[r, c]}`)) {
          cell = [r, c]
          break outer
        }
    expect(startPath(s0, color, cell)).toBe(s0)
  })

  it('is a no-op for an unknown colour', () => {
    const s0 = createLevel(0)
    expect(startPath(s0, 'not-a-colour', s0.pairs[0].a)).toBe(s0)
  })

  it('grabbing the current head is a no-op (same ref)', () => {
    const s0 = createLevel(0)
    const color = s0.pairs[0].color
    const s1 = startPath(s0, color, s0.pairs[0].a)
    expect(startPath(s1, color, s0.pairs[0].a)).toBe(s1)
  })

  it('pressing the start dot again restarts the line from that dot', () => {
    // build a short path, then grab the start endpoint → truncates to just it
    const s0 = createLevel(0)
    const p = s0.pairs[0]
    const start = p.a
    const nb = firstEmptyNeighbor(s0, start, p.color) as Cell
    let s = startPath(s0, p.color, start)
    s = extendPath(s, p.color, nb)
    expect(s.paths[p.color].length).toBe(2)
    const s2 = startPath(s, p.color, start)
    expect(s2.paths[p.color]).toEqual([start])
  })

  it('grabbing a middle cell truncates the path to that point', () => {
    // Use a straight horizontal drilled path on a level with room.
    const s0 = createLevel(MINI)
    const p = s0.pairs[0]
    // craft a manual path of length 3 along an empty row region
    // find a start endpoint and two adjacent empties
    const start = p.a
    const c1: Cell = [start[0], start[1] + 1]
    const c2: Cell = [start[0], start[1] + 2]
    if (
      c1[1] < s0.size &&
      c2[1] < s0.size &&
      endpointColorAt(s0, c1) === null &&
      endpointColorAt(s0, c2) === null
    ) {
      const s = draw(s0, p.color, [start, c1, c2])
      expect(s.paths[p.color].length).toBe(3)
      const s2 = startPath(s, p.color, c1) // grab the middle
      expect(s2.paths[p.color]).toEqual([start, c1])
      expect(ownerAt(s2, c2)).toBeNull()
    }
  })
})

// -- extendPath --------------------------------------------------------------

describe('extendPath', () => {
  it('extends onto an empty adjacent cell', () => {
    const s0 = createLevel(0)
    const p = s0.pairs[0]
    const start = p.a
    const nb: Cell | null = firstEmptyNeighbor(s0, start, p.color)
    expect(nb).not.toBeNull()
    const s1 = startPath(s0, p.color, start)
    const s2 = extendPath(s1, p.color, nb as Cell)
    expect(s2).not.toBe(s1)
    expect(s2.paths[p.color]).toEqual([start, nb])
    expect(ownerAt(s2, nb as Cell)).toBe(p.color)
    expect(s2.moves).toBe(1)
  })

  it('rejects a non-adjacent extension (same ref)', () => {
    const s0 = createLevel(0)
    const p = s0.pairs[0]
    const s1 = startPath(s0, p.color, p.a)
    const far: Cell = [(p.a[0] + 2) % s0.size, p.a[1]]
    expect(extendPath(s1, p.color, far)).toBe(s1)
  })

  it('rejects a diagonal extension (same ref)', () => {
    const s0 = createLevel(0)
    const p = s0.pairs[0]
    const s1 = startPath(s0, p.color, p.a)
    const diag: Cell = [p.a[0] + 1, p.a[1] + 1]
    if (diag[0] < s0.size && diag[1] < s0.size) {
      expect(extendPath(s1, p.color, diag)).toBe(s1)
    }
  })

  it('rejects extending before a path exists (same ref)', () => {
    const s0 = createLevel(0)
    const p = s0.pairs[0]
    const nb = firstEmptyNeighbor(s0, p.a, p.color)
    expect(extendPath(s0, p.color, nb as Cell)).toBe(s0)
  })

  it('retracts when dragging back over the previous cell', () => {
    const s0 = createLevel(0)
    const p = s0.pairs[0]
    const nb = firstEmptyNeighbor(s0, p.a, p.color) as Cell
    let s = startPath(s0, p.color, p.a)
    s = extendPath(s, p.color, nb)
    expect(s.paths[p.color].length).toBe(2)
    const back = extendPath(s, p.color, p.a) // drag back onto the start
    expect(back.paths[p.color]).toEqual([p.a])
    expect(ownerAt(back, nb)).toBeNull()
  })

  it('cannot cross its own path (loop) — same ref', () => {
    // start -> right -> down -> left -> up would revisit start; test the
    // self-cross onto a non-previous own cell.
    const s0 = createLevel(MINI)
    const p = s0.pairs[0]
    const a = p.a
    const r: Cell = [a[0], a[1] + 1]
    const d: Cell = [a[0] + 1, a[1] + 1]
    const l: Cell = [a[0] + 1, a[1]]
    // ensure all are empty & in-bounds
    if (
      [r, d, l].every(
        (c) => c[0] < s0.size && c[1] < s0.size && endpointColorAt(s0, c) === null,
      )
    ) {
      const s = draw(s0, p.color, [a, r, d, l])
      // now head is l=[a0+1,a0c]; its neighbor up is a=[a0,ac] which is own path[0]
      // extending onto a would be a loop (not the previous cell) → rejected
      expect(extendPath(s, p.color, a)).toBe(s)
    }
  })

  it('cutting: entering another colour’s pipe truncates it', () => {
    // Manufacture two colours where one crosses into the other's drawn body.
    // Use level MINI; draw colour A along a couple cells, then colour B eats one.
    const s0 = createLevel(MINI)
    const [pa, pb] = s0.pairs
    // A: from its endpoint into two empties forming an L
    const aStart = pa.a
    const a1 = firstEmptyNeighbor(s0, aStart, pa.color)
    if (!a1) return
    const s = draw(s0, pa.color, [aStart, a1])
    // B starts at its endpoint; if B can reach a1 (owned by A) via adjacency, cut it
    const bStart = pb.a
    // find a path B endpoint adjacent to a1? Only test if adjacency holds.
    if (adjacent(bStart, a1 as Cell)) {
      const beforeLen = s.paths[pa.color].length
      let sb = startPath(s, pb.color, bStart)
      sb = extendPath(sb, pb.color, a1 as Cell)
      // A must have lost the cut cell
      expect(sb.paths[pa.color].length).toBeLessThan(beforeLen)
      expect(ownerAt(sb, a1 as Cell)).toBe(pb.color)
    }
  })

  it('never overwrites another colour’s endpoint dot', () => {
    const s0 = createLevel(0)
    const [pa, pb] = s0.pairs
    // if pb.a is adjacent to pa.a, try to extend A onto B's endpoint → rejected
    if (adjacent(pa.a, pb.a)) {
      const s1 = startPath(s0, pa.color, pa.a)
      expect(extendPath(s1, pa.color, pb.a)).toBe(s1)
    }
  })

  it('is a no-op after the level is won', () => {
    const { solved } = scriptedSolve()
    expect(solved.status).toBe('won')
    const p = solved.pairs[0]
    expect(extendPath(solved, p.color, p.a)).toBe(solved)
    expect(startPath(solved, p.color, p.a)).toBe(solved)
    expect(clearPath(solved, p.color)).toBe(solved)
  })
})

// -- clearPath / clearAll ----------------------------------------------------

describe('clear', () => {
  it('clearPath removes a colour and its ownership', () => {
    const s0 = createLevel(0)
    const p = s0.pairs[0]
    const nb = firstEmptyNeighbor(s0, p.a, p.color) as Cell
    let s = startPath(s0, p.color, p.a)
    s = extendPath(s, p.color, nb)
    const cleared = clearPath(s, p.color)
    expect(cleared.paths[p.color]).toEqual([])
    expect(ownerAt(cleared, nb)).toBeNull()
  })
  it('clearPath on an empty colour is a no-op', () => {
    const s0 = createLevel(0)
    expect(clearPath(s0, s0.pairs[0].color)).toBe(s0)
  })
  it('clearAll resets every path and moves', () => {
    const s0 = createLevel(0)
    const p = s0.pairs[0]
    const nb = firstEmptyNeighbor(s0, p.a, p.color) as Cell
    const s = draw(s0, p.color, [p.a, nb])
    const reset = clearAll(s)
    expect(filledCount(reset)).toBe(0)
    expect(reset.moves).toBe(0)
  })
  it('clearAll on a pristine level is a no-op', () => {
    const s0 = createLevel(0)
    expect(clearAll(s0)).toBe(s0)
  })
})

// -- connection / win --------------------------------------------------------

describe('connection + win', () => {
  it('a pair is disconnected until its head reaches the far endpoint', () => {
    const s0 = createLevel(0)
    const p = s0.pairs[0]
    expect(isConnected(s0, p.color)).toBe(false)
    const nb = firstEmptyNeighbor(s0, p.a, p.color) as Cell
    const partial = draw(s0, p.color, [p.a, nb])
    expect(isConnected(partial, p.color)).toBe(false) // started but not joined
  })

  it('extending onto the far endpoint connects the pair', () => {
    // 3×3, one colour whose endpoints are two apart on the top row.
    // Build via ops on a hand FlowState so we exercise the real connect path.
    const st = handState(3, [{ color: 'cyan', a: [0, 0], b: [0, 2] }], {})
    let s = startPath(st, 'cyan', [0, 0])
    expect(isConnected(s, 'cyan')).toBe(false)
    s = extendPath(s, 'cyan', [0, 1])
    s = extendPath(s, 'cyan', [0, 2]) // reach far endpoint
    expect(isConnected(s, 'cyan')).toBe(true)
    expect(connectedCount(s)).toBe(1)
  })

  it('all pairs connected but coverage incomplete is NOT solved', () => {
    // cyan connected across the top row of a 3×3, 6 cells still empty.
    const st = handState(
      3,
      [{ color: 'cyan', a: [0, 0], b: [0, 2] }],
      { cyan: [[0, 0], [0, 1], [0, 2]] },
    )
    expect(isConnected(st, 'cyan')).toBe(true)
    expect(filledCount(st)).toBe(3)
    expect(totalCells(st)).toBe(9)
    expect(isSolved(st)).toBe(false) // must cover EVERY cell
  })

  it('a scripted full solve reaches isSolved / status won and records coverage', () => {
    const { solved, level } = scriptedSolve()
    expect(isSolved(solved)).toBe(true)
    expect(solved.status).toBe('won')
    expect(connectedCount(solved)).toBe(level.pairs.length)
    expect(filledCount(solved)).toBe(totalCells(solved))
  })
})

// ----------------------------------------------------------------------------
// shared fixtures
// ----------------------------------------------------------------------------

/** Build a FlowState directly (bypassing ops) for isSolved/isConnected unit tests. */
function handState(
  size: number,
  pairs: { color: string; a: Cell; b: Cell }[],
  paths: Record<string, Cell[]>,
): FlowState {
  const owner: (string | null)[] = new Array(size * size).fill(null)
  const full: Record<string, Cell[]> = {}
  for (const p of pairs) {
    const path = paths[p.color] ?? []
    full[p.color] = path
    for (const c of path) owner[c[0] * size + c[1]] = p.color
  }
  return {
    levelIndex: 0,
    size,
    pairs,
    paths: full,
    owner,
    status: 'playing',
    moves: 0,
  }
}

function firstEmptyNeighbor(s: FlowState, cell: Cell, color: string): Cell | null {
  const dirs: Cell[] = [
    [cell[0] - 1, cell[1]],
    [cell[0] + 1, cell[1]],
    [cell[0], cell[1] - 1],
    [cell[0], cell[1] + 1],
  ]
  for (const d of dirs) {
    if (d[0] < 0 || d[1] < 0 || d[0] >= s.size || d[1] >= s.size) continue
    if (ownerAt(s, d) === null && endpointColorAt(s, d) !== color) {
      // allow the colour's own far endpoint too, but prefer plain empty
      if (endpointColorAt(s, d) === null) return d
    }
  }
  // fall back: any in-bounds empty (incl. own far endpoint)
  for (const d of dirs) {
    if (d[0] < 0 || d[1] < 0 || d[0] >= s.size || d[1] >= s.size) continue
    if (ownerAt(s, d) === null) return d
  }
  return null
}

/**
 * Build an explicit full-cover solution for a chosen bank level by reading the
 * solver's route, then replay it through the PUBLIC ops so we exercise
 * startPath/extendPath end-to-end into a real `won` state.
 */
function scriptedSolve(): { solved: FlowState; level: FlowState } {
  const idx = LEVELS.findIndex((l) => l.size === 5)
  const base = createLevel(idx)
  const routes = solveRoutes(base)
  expect(routes).not.toBeNull()
  let s = base
  for (const p of base.pairs) {
    const route = (routes as Record<string, Cell[]>)[p.color]
    s = draw(s, p.color, route)
  }
  return { solved: s, level: base }
}

/**
 * A route-returning variant of the backtracking solver (test-local): returns,
 * for each colour, an ordered endpoint-to-endpoint cell list that together
 * fully cover the grid — or null.
 */
function solveRoutes(state: FlowState): Record<string, Cell[]> | null {
  const N = state.size
  const owner = new Array<number>(N * N).fill(-1)
  const oi = (r: number, c: number) => r * N + c
  const inB = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N
  const colors = state.pairs.map((p, k) => ({
    k,
    color: p.color,
    a: p.a,
    b: p.b,
  }))
  for (const c of colors) {
    owner[oi(c.a[0], c.a[1])] = c.k
    owner[oi(c.b[0], c.b[1])] = c.k
  }
  const routes: Record<string, Cell[]> = {}
  const DIRS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  function extend(cur: Cell, k: number, target: Cell, path: Cell[], nextK: number): boolean {
    for (const [dr, dc] of DIRS) {
      const nr = cur[0] + dr
      const nc = cur[1] + dc
      if (!inB(nr, nc)) continue
      const ni = oi(nr, nc)
      const next: Cell = [nr, nc]
      if (eq(next, target)) {
        path.push(next)
        if (dfs(nextK)) return true
        path.pop()
      } else if (owner[ni] === -1) {
        owner[ni] = k
        path.push(next)
        if (extend(next, k, target, path, nextK)) return true
        path.pop()
        owner[ni] = -1
      }
    }
    return false
  }
  function dfs(k: number): boolean {
    if (k === colors.length) {
      for (let i = 0; i < N * N; i++) if (owner[i] === -1) return false
      return true
    }
    const col = colors[k]
    const path: Cell[] = [col.a]
    if (extend(col.a, col.k, col.b, path, k + 1)) {
      routes[col.color] = path
      return true
    }
    return false
  }
  return dfs(0) ? routes : null
}
