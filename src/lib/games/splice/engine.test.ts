import { describe, expect, it } from 'vitest'
import {
  aliveCount,
  components,
  CUT_SLACK,
  cut,
  dailySeed,
  FRAGMENT_PENALTY,
  generateBoard,
  isCleared,
  legalEdges,
  MAX_NODES,
  MIN_NODES,
  monochromeComponents,
  mulberry32,
  newGame,
  nextLevel,
  previewCut,
  UNDO_POOL,
  undo,
  WIN_BONUS_UNIT,
  type Board,
  type Edge,
  type GameState,
} from './engine'

// ---------------------------------------------------------------------------
// Test helpers — build a tiny hand-authored board directly (no rng).
// ---------------------------------------------------------------------------

function mkBoard(colors: number[], edges: Edge[], numColors = 5): Board {
  return {
    n: colors.length,
    colors,
    numColors,
    edges,
    layout: colors.map((_, i) => ({ x: i / colors.length, y: 0 })),
  }
}

function mkState(board: Board, par: number, over: Partial<GameState> = {}): GameState {
  return {
    board,
    alive: new Array<boolean>(board.n).fill(true),
    cutEdges: new Array<boolean>(board.edges.length).fill(false),
    score: 0,
    cutsUsed: 0,
    par,
    cutBudget: par + CUT_SLACK,
    undosLeft: UNDO_POOL,
    seed: 1,
    mode: 'puzzle',
    level: 1,
    solution: [],
    history: [],
    won: false,
    lost: false,
    ...over,
  }
}

describe('components — union-find labelling', () => {
  it('labels connected components in ascending lowest-node order; dead nodes are -1', () => {
    // 0-1  2   3-4  (node 2 isolated)  with node 5 dead
    const edges: Edge[] = [
      { a: 0, b: 1 },
      { a: 3, b: 4 },
    ]
    const alive = [true, true, true, true, true, false]
    const comp = components(alive, edges, [false, false])
    expect(comp[0]).toBe(0)
    expect(comp[1]).toBe(0)
    expect(comp[2]).toBe(1)
    expect(comp[3]).toBe(2)
    expect(comp[4]).toBe(2)
    expect(comp[5]).toBe(-1)
  })

  it('a cut edge severs the component', () => {
    const edges: Edge[] = [{ a: 0, b: 1 }]
    const joined = components([true, true], edges, [false])
    expect(joined[0]).toBe(joined[1])
    const severed = components([true, true], edges, [true])
    expect(severed[0]).not.toBe(severed[1])
  })
})

describe('monochromeComponents', () => {
  it('a size-1 component counts as monochrome', () => {
    const comp = [0, 1] // two singletons
    const monos = monochromeComponents(comp, [3, 7])
    expect(monos.map((m) => m.nodes)).toEqual([[0], [1]])
  })

  it('a mixed-color component is excluded; a uniform one is included', () => {
    // nodes 0,1,2 one component; 0,1 red(=2), 2 blue(=4) -> mixed, excluded
    const comp = [0, 0, 0, 1, 1]
    const colors = [2, 2, 4, 5, 5]
    const monos = monochromeComponents(comp, colors)
    expect(monos.map((m) => m.label)).toEqual([1]) // only the {3,4} blue pair
    expect(monos[0].nodes).toEqual([3, 4])
    expect(monos[0].color).toBe(5)
  })
})

describe('previewCut — resolution, scoring, cascades', () => {
  it('a cut that does not disconnect its component collapses nothing', () => {
    // triangle 0-1-2 all distinct colors; remove one edge -> still connected, not mono
    const board = mkBoard(
      [0, 1, 2],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
        { a: 0, b: 2 },
      ],
    )
    const state = mkState(board, 3)
    const r = previewCut(state, 0) // cut 0-1; still connected via 0-2-1
    expect(r.legal).toBe(true)
    expect(r.disconnected).toBe(false)
    expect(r.sideB).toEqual([])
    expect(r.collapsed).toEqual([])
    expect(r.scoreDelta).toBe(0)
    expect(r.cascadeDepth).toBe(0)
  })

  it('one cut can isolate two monochrome groups in a single wave; scoreDelta = sum of squares', () => {
    // path 0(R)-1(R)-2(B)-3(B), cut the middle R-B edge -> {0,1} and {2,3} both mono
    const board = mkBoard(
      [0, 0, 1, 1],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
        { a: 2, b: 3 },
      ],
    )
    const state = mkState(board, 3)
    const r = previewCut(state, 1) // cut edge 1-2
    expect(r.disconnected).toBe(true)
    expect(r.collapsed.length).toBe(2)
    // ordered by lowest node id
    expect(r.collapsed[0].nodes).toEqual([0, 1])
    expect(r.collapsed[1].nodes).toEqual([2, 3])
    expect(r.cascadeDepth).toBe(1)
    expect(r.scoreDelta).toBe(2 * 2 + 2 * 2) // 4 + 4 = 8
    expect(isCleared(r.aliveAfter)).toBe(true)
  })

  it('sizes {2,3} score 4+9 = 13', () => {
    // 0(R)1(R) | 2(B)3(B)4(B) — one bridge between the reds and blues
    const board = mkBoard(
      [0, 0, 1, 1, 1],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 }, // bridge R-B
        { a: 2, b: 3 },
        { a: 3, b: 4 },
      ],
    )
    const state = mkState(board, 1)
    const r = previewCut(state, 1)
    expect(r.scoreDelta).toBe(4 + 9)
    expect(r.collapsed.map((c) => c.size).sort()).toEqual([2, 3])
  })

  it('an illegal cut (already-cut edge) is legal:false and a no-op result', () => {
    const board = mkBoard([0, 1], [{ a: 0, b: 1 }])
    const state = mkState(board, 1, { cutEdges: [true] })
    const r = previewCut(state, 0)
    expect(r.legal).toBe(false)
    expect(r.collapsed).toEqual([])
  })

  it('does not mutate the input state arrays', () => {
    const board = mkBoard(
      [0, 0, 1, 1],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
        { a: 2, b: 3 },
      ],
    )
    const alive = new Array<boolean>(4).fill(true)
    const cutEdges = [false, false, false]
    const state = mkState(board, 3, { alive, cutEdges })
    previewCut(state, 1)
    expect(alive).toEqual([true, true, true, true])
    expect(cutEdges).toEqual([false, false, false])
  })

  it('snapshots the full CutResult for a fixed hand-authored board', () => {
    const board = mkBoard(
      [0, 0, 1, 1, 2],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
        { a: 2, b: 3 },
        { a: 3, b: 4 },
      ],
    )
    const state = mkState(board, 3)
    const r = previewCut(state, 1)
    expect({
      disconnected: r.disconnected,
      sideA: r.sideA,
      sideB: r.sideB,
      collapsed: r.collapsed,
      scoreDelta: r.scoreDelta,
      cascadeDepth: r.cascadeDepth,
      aliveAfter: r.aliveAfter,
    }).toMatchSnapshot()
  })
})

describe('cut — bookkeeping, win, lose, undo', () => {
  it('increments cutsUsed, pushes a bounded snapshot, and adds score', () => {
    const board = mkBoard(
      [0, 0, 1, 1],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
        { a: 2, b: 3 },
      ],
    )
    const state = mkState(board, 3)
    const { state: next, result } = cut(state, 1)
    expect(result.legal).toBe(true)
    expect(next.cutsUsed).toBe(1)
    expect(next.history.length).toBe(1)
    // both pairs collapse (+8); the board clears so the par win bonus is added too
    expect(result.scoreDelta).toBe(8)
    expect(next.won).toBe(true)
    expect(next.score).toBe(8 + WIN_BONUS_UNIT * (3 - 1 + 1))
  })

  it('awards a par win bonus when clearing at or under par', () => {
    const board = mkBoard(
      [0, 0, 1, 1],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
        { a: 2, b: 3 },
      ],
    )
    const state = mkState(board, 3)
    const { state: next } = cut(state, 1)
    expect(next.won).toBe(true)
    // scoreDelta 8 + WIN_BONUS_UNIT * (par - cutsUsed + 1) = 8 + 100*(3-1+1) = 308
    expect(next.score).toBe(8 + WIN_BONUS_UNIT * 3)
  })

  it('loses at the cut budget with nodes still alive, applying the fragment penalty (floored at 0)', () => {
    // A 3-node path of distinct colors that never fully collapses in one cut.
    const board = mkBoard(
      [0, 1, 2],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
      ],
    )
    // Budget 1: this single cut hits the budget while nodes remain -> lose.
    const state = mkState(board, 0, { cutBudget: 1, score: 10 })
    const { state: next } = cut(state, 0) // cut 0-1 -> {0} collapses (+1), {1,2} remains
    expect(next.cutsUsed).toBe(1)
    expect(aliveCount(next.alive)).toBeGreaterThan(0)
    expect(next.lost).toBe(true)
    // score = 10 + 1 (node0) - FRAGMENT_PENALTY*aliveCount
    const expected = Math.max(0, 10 + 1 - FRAGMENT_PENALTY * aliveCount(next.alive))
    expect(next.score).toBe(expected)
    expect(next.score).toBeGreaterThanOrEqual(0)
  })

  it('illegal and finished cuts are no-ops that return the same state reference', () => {
    const board = mkBoard([0, 1], [{ a: 0, b: 1 }])
    const already = mkState(board, 1, { cutEdges: [true] })
    const r1 = cut(already, 0)
    expect(r1.state).toBe(already)
    expect(r1.result.legal).toBe(false)

    const finished = mkState(board, 1, { won: true })
    const r2 = cut(finished, 0)
    expect(r2.state).toBe(finished)
  })

  it('bounds the history stack to cutBudget', () => {
    // A long path of alternating colors so early cuts collapse only singletons.
    const colors = [0, 1, 2, 3, 0, 1, 2, 3]
    const edges: Edge[] = []
    for (let i = 1; i < colors.length; i++) edges.push({ a: i - 1, b: i })
    const board = mkBoard(colors, edges)
    let state = mkState(board, 2, { cutBudget: 2 })
    // Perform two cuts (budget 2); history should never exceed 2.
    const legal = legalEdges(state)
    const r1 = cut(state, legal[0])
    state = r1.state
    if (!state.won && !state.lost) {
      const r2 = cut(state, legalEdges(state)[0])
      state = r2.state
    }
    expect(state.history.length).toBeLessThanOrEqual(2)
  })
})

describe('undo — branch-undo pool', () => {
  it('restores alive/cutEdges/score/cutsUsed and decrements the pool', () => {
    const board = mkBoard(
      [0, 0, 1, 1],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
        { a: 2, b: 3 },
      ],
    )
    const state = mkState(board, 3)
    const { state: afterCut } = cut(state, 1)
    const restored = undo(afterCut)
    expect(restored.alive).toEqual([true, true, true, true])
    expect(restored.cutEdges).toEqual([false, false, false])
    expect(restored.score).toBe(0)
    expect(restored.cutsUsed).toBe(0)
    expect(restored.undosLeft).toBe(UNDO_POOL - 1)
    expect(restored.won).toBe(false)
  })

  it('is a no-op at 0 undos, with empty history, and in endless mode', () => {
    const board = mkBoard([0, 1], [{ a: 0, b: 1 }])
    const base = mkState(board, 1)
    const drained = { ...base, undosLeft: 0, history: [{ alive: [true, true], cutEdges: [false], score: 0, cutsUsed: 0 }] }
    expect(undo(drained)).toBe(drained)
    const noHistory = { ...base, history: [] }
    expect(undo(noHistory)).toBe(noHistory)
    const endless = { ...base, mode: 'endless' as const, undosLeft: 3, history: [{ alive: [true, true], cutEdges: [false], score: 0, cutsUsed: 0 }] }
    expect(undo(endless)).toBe(endless)
  })
})

describe('legalEdges', () => {
  it('excludes cut edges and edges touching dead nodes', () => {
    const board = mkBoard(
      [0, 1, 2],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
      ],
    )
    const state = mkState(board, 2, { cutEdges: [true, false], alive: [true, true, false] })
    // edge 0 is cut; edge 1 touches dead node 2 -> no legal edges
    expect(legalEdges(state)).toEqual([])
  })
})

describe('generateBoard — provably solvable (the crown jewel)', () => {
  it('never exceeds MAX_NODES, starts connected, and replaying solution clears in exactly par', () => {
    for (let seed = 0; seed < 120; seed++) {
      for (let level = 1; level <= 8; level++) {
        const gen = generateBoard(mulberry32(seed), level)
        expect(gen.board.n).toBeGreaterThanOrEqual(MIN_NODES)
        expect(gen.board.n).toBeLessThanOrEqual(MAX_NODES)
        expect([4, 5]).toContain(gen.board.numColors)
        // connected at start: one component over all-alive, no-cut
        const comp = components(
          new Array<boolean>(gen.board.n).fill(true),
          gen.board.edges,
          new Array<boolean>(gen.board.edges.length).fill(false),
        )
        const labels = new Set(comp)
        expect(labels.size).toBe(1)
        // solution length matches par
        expect(gen.solution.length).toBe(gen.par)
        expect(gen.par).toBeGreaterThanOrEqual(1)
        // replay wins in exactly par cuts, clearing everything
        let state = newGameFromGen(gen)
        for (const eid of gen.solution) {
          const r = cut(state, eid)
          expect(r.result.legal).toBe(true)
          state = r.state
        }
        expect(state.won).toBe(true)
        expect(isCleared(state.alive)).toBe(true)
        expect(state.cutsUsed).toBe(gen.par)
      }
    }
  })

  function newGameFromGen(gen: ReturnType<typeof generateBoard>): GameState {
    return mkState(gen.board, gen.par, { solution: gen.solution, mode: 'endless', undosLeft: 0 })
  }
})

describe('newGame / nextLevel / determinism', () => {
  it('newGame wires par, budget, pool, and a fresh solvable board', () => {
    const s = newGame(mulberry32(42), 'puzzle', 42, 1)
    expect(s.cutBudget).toBe(s.par + CUT_SLACK)
    expect(s.undosLeft).toBe(UNDO_POOL)
    expect(s.cutsUsed).toBe(0)
    expect(s.score).toBe(0)
    expect(s.alive.every((a) => a)).toBe(true)
    expect(s.solution.length).toBe(s.par)
  })

  it('endless mode has zero undos', () => {
    const s = newGame(mulberry32(7), 'endless', 7, 1)
    expect(s.undosLeft).toBe(0)
  })

  it('nextLevel raises the level, carries score, and resets the board/pool', () => {
    const s = newGame(mulberry32(1), 'endless', 1, 1)
    const scored: GameState = { ...s, score: 555, cutsUsed: 2 }
    const n = nextLevel(scored, mulberry32(2), 2)
    expect(n.level).toBe(2)
    expect(n.score).toBe(555)
    expect(n.cutsUsed).toBe(0)
    expect(n.history).toEqual([])
    expect(n.cutBudget).toBe(n.par + CUT_SLACK)
  })

  it('newGame is fully reproducible for a fixed seed', () => {
    const a = newGame(mulberry32(2024), 'puzzle', 2024, 3)
    const b = newGame(mulberry32(2024), 'puzzle', 2024, 3)
    expect({ colors: a.board.colors, edges: a.board.edges, par: a.par, solution: a.solution }).toEqual({
      colors: b.board.colors,
      edges: b.board.edges,
      par: b.par,
      solution: b.solution,
    })
  })

  it('dailySeed is stable per date string and differs across dates', () => {
    expect(dailySeed('2026-07-14')).toBe(dailySeed('2026-07-14'))
    expect(dailySeed('2026-07-14')).not.toBe(dailySeed('2026-07-15'))
    expect(dailySeed('2026-07-14')).toBeGreaterThanOrEqual(0)
  })
})

describe('generateBoard — structural snapshot for fixed seeds', () => {
  it('is stable (integers only; layout floats excluded)', () => {
    const shape = (seed: number, level: number) => {
      const g = generateBoard(mulberry32(seed), level)
      return { n: g.board.n, numColors: g.board.numColors, colors: g.board.colors, edges: g.board.edges, par: g.par, solution: g.solution }
    }
    expect(shape(1, 1)).toMatchSnapshot()
    expect(shape(5, 4)).toMatchSnapshot()
    expect(shape(9, 8)).toMatchSnapshot()
  })
})
