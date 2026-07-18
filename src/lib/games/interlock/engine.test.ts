import { describe, expect, it } from 'vitest'
import {
  DEPTH_UNIT,
  DIFFICULTIES,
  N,
  RING_A,
  RING_B,
  SHARED,
  SOLVED,
  UNDO_POOL,
  WIN_BONUS,
  type Color,
  type InterlockState,
  type Rng,
  type RingId,
  createGame,
  computeRotate,
  generateCells,
  isSolved,
  mulberry32,
  reduce,
  rotateCells,
  scoreFor,
} from './engine'

/** Hand-build a state for reducer tests (bypasses generation). */
function stateWith(cells: Color[], overrides: Partial<InterlockState> = {}): InterlockState {
  return {
    seed: 1,
    scramble: 1,
    cells: cells.slice(),
    moves: 0,
    won: false,
    score: 0,
    undoStack: [],
    undosLeft: UNDO_POOL,
    lastEvent: 'none',
    lastRotate: null,
    ...overrides,
  }
}

function counts(cells: readonly Color[]): Record<number, number> {
  const m: Record<number, number> = {}
  for (const c of cells) m[c] = (m[c] ?? 0) + 1
  return m
}

// -- geometry / constants ---------------------------------------------------

describe('geometry & constants', () => {
  it('SOLVED has length 18 and is solved', () => {
    expect(SOLVED.length).toBe(18)
    expect(N).toBe(18)
    expect(isSolved(SOLVED.slice())).toBe(true)
  })

  it('SOLVED color counts are {1:4,2:4,3:4,4:4,5:2}', () => {
    expect(counts(SOLVED)).toEqual({ 1: 4, 2: 4, 3: 4, 4: 4, 5: 2 })
  })

  it('rings have length 10, no dupes, intersect at [0,1], union covers 0..17', () => {
    expect(RING_A.length).toBe(10)
    expect(RING_B.length).toBe(10)
    expect(new Set(RING_A).size).toBe(10)
    expect(new Set(RING_B).size).toBe(10)
    const inter = RING_A.filter((x) => RING_B.includes(x)).sort((a, b) => a - b)
    expect(inter).toEqual([0, 1])
    expect(SHARED).toEqual([0, 1])
    const union = new Set([...RING_A, ...RING_B])
    expect(union.size).toBe(18)
    for (let i = 0; i < 18; i++) expect(union.has(i)).toBe(true)
  })
})

// -- rotation (golden) ------------------------------------------------------

describe('rotateCells', () => {
  const samples: Color[][] = [
    SOLVED.slice(),
    [2, 1, 5, 1, 1, 1, 5, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4],
    [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3],
  ]

  it('is invertible: rotate then rotate back is identity', () => {
    for (const c of samples) {
      for (const ring of ['A', 'B'] as RingId[]) {
        expect(rotateCells(rotateCells(c, ring, 1), ring, -1)).toEqual(c)
        expect(rotateCells(rotateCells(c, ring, -1), ring, 1)).toEqual(c)
      }
    }
  })

  it('has period 10 for a single ring/direction', () => {
    let a = SOLVED.slice()
    for (let i = 0; i < 10; i++) a = rotateCells(a, 'A', 1)
    expect(a).toEqual(SOLVED.slice())
    let b = SOLVED.slice()
    for (let i = 0; i < 10; i++) b = rotateCells(b, 'B', -1)
    expect(b).toEqual(SOLVED.slice())
  })

  it('is local: A leaves 10..17 fixed, B leaves 2..9 fixed', () => {
    const a = rotateCells(SOLVED.slice(), 'A', 1)
    for (let i = 10; i <= 17; i++) expect(a[i]).toBe(SOLVED[i])
    const b = rotateCells(SOLVED.slice(), 'B', -1)
    for (let i = 2; i <= 9; i++) expect(b[i]).toBe(SOLVED[i])
  })

  it('golden shift: A+1 on SOLVED', () => {
    expect(rotateCells(SOLVED.slice(), 'A', 1)).toEqual([
      2, 1, 5, 1, 1, 1, 5, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4,
    ])
  })

  it('golden coupling: A+1 then B+1 hops a shared bead into ring B', () => {
    const a = rotateCells(SOLVED.slice(), 'A', 1)
    const ab = rotateCells(a, 'B', 1)
    expect(ab).toEqual([4, 3, 5, 1, 1, 1, 5, 2, 2, 2, 2, 3, 3, 3, 1, 4, 4, 4])
    // shared slot 0 held 2 (an A bead) after A+1; B+1 pushed it into B slot (idx 10)
    expect(a[0]).toBe(2)
    expect(ab[10]).toBe(2)
  })

  it('does not mutate its input', () => {
    const c = SOLVED.slice()
    const before = c.slice()
    rotateCells(c, 'A', 1)
    expect(c).toEqual(before)
  })
})

describe('computeRotate', () => {
  it('reports crossed colors (<=2) and is pure', () => {
    const c = SOLVED.slice()
    const out = computeRotate(c, 'A', 1)
    expect(out.crossed.length).toBeLessThanOrEqual(2)
    // both shared slots changed from 5 -> new colors
    expect(out.crossed).toEqual([2, 1])
    expect(out.ring).toBe('A')
    expect(out.dir).toBe(1)
    expect(c).toEqual(SOLVED.slice()) // input untouched
  })

  it('crossed is empty when shared slots are unchanged', () => {
    // craft a board where an A rotation leaves both shared slots identical
    const uniform = Array<Color>(18).fill(3)
    const out = computeRotate(uniform, 'A', 1)
    expect(out.crossed).toEqual([])
  })
})

// -- generation / determinism -----------------------------------------------

describe('generateCells / determinism', () => {
  it('is deterministic for a fixed seed', () => {
    const a = generateCells(20, mulberry32(7))
    const b = generateCells(20, mulberry32(7))
    expect(a).toEqual(b)
  })

  it('mulberry32 matches the golden template output', () => {
    const r = mulberry32(1)
    expect([r(), r(), r()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ])
  })

  it('consumes rng exactly `scramble` times', () => {
    for (const n of [1, 12, 20]) {
      let calls = 0
      const base = mulberry32(3)
      const wrapped: Rng = () => {
        calls++
        return base()
      }
      generateCells(n, wrapped)
      expect(calls).toBe(n)
    }
  })

  it('reverse-rotation scramble is always solvable (invertibility property)', () => {
    // Build a random forward sequence, apply to SOLVED, then unwind it.
    for (const seed of [1, 42, 999, 7777]) {
      const rng = mulberry32(seed)
      const moves: { ring: RingId; dir: 1 | -1 }[] = []
      let cells = SOLVED.slice()
      for (let i = 0; i < 15; i++) {
        const ring: RingId = rng() < 0.5 ? 'A' : 'B'
        const dir = rng() < 0.5 ? 1 : -1
        moves.push({ ring, dir })
        cells = rotateCells(cells, ring, dir)
      }
      for (let i = moves.length - 1; i >= 0; i--) {
        cells = rotateCells(cells, moves[i].ring, (-moves[i].dir) as 1 | -1)
      }
      expect(cells).toEqual(SOLVED.slice())
    }
  })

  it('different seeds can produce different boards', () => {
    const boards = [0, 1, 2, 3, 4].map((s) => generateCells(20, mulberry32(s)).join(','))
    expect(new Set(boards).size).toBeGreaterThan(1)
  })

  it('conserves color counts through scrambling', () => {
    const cells = generateCells(20, mulberry32(123))
    expect(counts(cells)).toEqual({ 1: 4, 2: 4, 3: 4, 4: 4, 5: 2 })
  })
})

// -- createGame / reduce ----------------------------------------------------

describe('createGame', () => {
  it('returns a fresh, unsolved, well-formed state', () => {
    const g = createGame(123, 20)
    expect(g.moves).toBe(0)
    expect(g.score).toBe(0)
    expect(g.won).toBe(false)
    expect(g.undosLeft).toBe(UNDO_POOL)
    expect(g.scramble).toBe(20)
    expect(g.cells.length).toBe(18)
    expect(isSolved(g.cells)).toBe(false)
  })

  it('never returns an already-solved board for seeds 0..99', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(isSolved(createGame(seed, 20).cells)).toBe(false)
    }
  })

  it('is deterministic: same seed => identical board', () => {
    expect(createGame(777, 20).cells).toEqual(createGame(777, 20).cells)
  })
})

describe('scoreFor', () => {
  it('is strictly decreasing in moves (never saturates)', () => {
    expect(scoreFor(20, 10)).toBeGreaterThan(scoreFor(20, 11))
    expect(scoreFor(20, 19)).toBeGreaterThan(scoreFor(20, 20))
    expect(scoreFor(20, 100)).toBeGreaterThan(scoreFor(20, 101))
  })

  it('is increasing in scramble (depth bonus)', () => {
    expect(scoreFor(30, 20)).toBeGreaterThan(scoreFor(20, 20))
    expect(scoreFor(20, 20)).toBeGreaterThan(scoreFor(12, 20))
  })

  it('efficiency: par-clear vs par+4-clear — fewer moves scores higher', () => {
    expect(scoreFor(20, 20)).toBeGreaterThan(scoreFor(20, 24))
  })

  it('always a positive integer', () => {
    for (const [s, m] of [[12, 1], [20, 20], [30, 200]]) {
      const v = scoreFor(s, m)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThan(0)
    }
  })

  it('matches the documented normal example (par 20 clear = 1900)', () => {
    expect(scoreFor(20, 20)).toBe(WIN_BONUS + 20 * DEPTH_UNIT + 500)
    expect(scoreFor(20, 20)).toBe(1900)
  })
})

describe('reduce', () => {
  it('golden solve at scramble=1: undoing the scramble wins', () => {
    const cells = rotateCells(SOLVED.slice(), 'A', 1)
    const s0 = stateWith(cells, { scramble: 1 })
    const s = reduce(s0, { type: 'rotate', ring: 'A', dir: -1 })
    expect(s.won).toBe(true)
    expect(isSolved(s.cells)).toBe(true)
    expect(s.lastEvent).toBe('win')
    expect(s.score).toBe(scoreFor(1, 1))
  })

  it('rotate increments moves and pushes an undo snapshot', () => {
    const s0 = stateWith(generateCells(20, mulberry32(5)), { scramble: 20 })
    const before = s0.cells.slice()
    const s = reduce(s0, { type: 'rotate', ring: 'B', dir: 1 })
    expect(s.moves).toBe(1)
    expect(s.undoStack.length).toBe(1)
    expect(s.undoStack[0].cells).toEqual(before)
    expect(s.undoStack[0].moves).toBe(0)
    expect(s.lastEvent).toBe('rotate')
  })

  it('undo restores cells + moves, decrements undosLeft; empty stack is no-op', () => {
    const s0 = stateWith(generateCells(20, mulberry32(9)), { scramble: 20 })
    const before = s0.cells.slice()
    let s = reduce(s0, { type: 'rotate', ring: 'A', dir: 1 })
    s = reduce(s, { type: 'undo' })
    expect(s.cells).toEqual(before)
    expect(s.moves).toBe(0)
    expect(s.undosLeft).toBe(UNDO_POOL - 1)
    expect(s.lastEvent).toBe('undo')
    // now stack empty
    const empty = reduce({ ...s, undoStack: [] }, { type: 'undo' })
    expect(empty.lastEvent).toBe('none')
  })

  it('caps the undo stack at UNDO_POOL', () => {
    let s = stateWith(generateCells(20, mulberry32(11)), { scramble: 20 })
    for (let i = 0; i < 7; i++) s = reduce(s, { type: 'rotate', ring: 'A', dir: 1 })
    expect(s.undoStack.length).toBe(UNDO_POOL)
  })

  it('rotate and undo are no-ops after a win', () => {
    const cells = rotateCells(SOLVED.slice(), 'A', 1)
    const s = reduce(stateWith(cells, { scramble: 1 }), { type: 'rotate', ring: 'A', dir: -1 })
    expect(s.won).toBe(true)
    const wonCells = s.cells.slice()
    const r = reduce(s, { type: 'rotate', ring: 'B', dir: 1 })
    expect(r.cells).toEqual(wonCells)
    expect(r.lastEvent).toBe('none')
    const u = reduce(s, { type: 'undo' })
    expect(u.cells).toEqual(wonCells)
    expect(u.lastEvent).toBe('none')
    expect(u.undosLeft).toBe(s.undosLeft) // undo blocked after win
  })

  it('reset reproduces the seed board; new rebuilds with given seed/scramble', () => {
    const g = createGame(4242, 20)
    let s = reduce(g, { type: 'rotate', ring: 'A', dir: 1 })
    s = reduce(s, { type: 'reset' })
    expect(s.cells).toEqual(g.cells)
    expect(s.scramble).toBe(20)
    expect(s.undosLeft).toBe(UNDO_POOL)
    const n = reduce(s, { type: 'new', seed: 55, scramble: 12 })
    expect(n.scramble).toBe(12)
    expect(n.cells).toEqual(createGame(55, 12).cells)
  })

  it('does not mutate the input state or its cells', () => {
    const cells = generateCells(20, mulberry32(31))
    const s0 = stateWith(cells, { scramble: 20 })
    const cellsCopy = s0.cells.slice()
    reduce(s0, { type: 'rotate', ring: 'A', dir: 1 })
    expect(s0.cells).toEqual(cellsCopy)
    expect(s0.moves).toBe(0)
    expect(s0.undoStack).toEqual([])
  })
})

describe('isSolved strictness', () => {
  it('rejects uniform arcs with swapped home colors', () => {
    // arcA1 -> 2, arcA2 -> 1 (uniform but not home)
    const swapped: Color[] = [
      5, 5, 2, 2, 2, 2, 1, 1, 1, 1, 3, 3, 3, 3, 4, 4, 4, 4,
    ]
    expect(isSolved(swapped)).toBe(false)
  })

  it('accepts only the exact SOLVED pattern', () => {
    const near = SOLVED.slice()
    near[0] = 4 // perturb one hub bead
    expect(isSolved(near)).toBe(false)
  })
})

describe('difficulties', () => {
  it('exposes easy/normal/hard scramble depths', () => {
    expect(DIFFICULTIES.easy.scramble).toBe(12)
    expect(DIFFICULTIES.normal.scramble).toBe(20)
    expect(DIFFICULTIES.hard.scramble).toBe(30)
  })
})
