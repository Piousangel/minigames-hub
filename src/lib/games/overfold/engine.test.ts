import { describe, expect, it } from 'vitest'
import {
  BASE_SEAL,
  creaseSides,
  dailySeed,
  EMPTY,
  fold,
  FOLD_SLACK,
  generateBoard,
  inBounds,
  isWon,
  JAM,
  legalCreases,
  mulberry32,
  newGame,
  nextLevel,
  PAR_BONUS,
  pipCount,
  previewFold,
  resolveOverlap,
  scoreForSeals,
  undo,
  UNFOLD_POOL,
  type Board,
  type Cell,
  type GameState,
} from './engine'

function board(w: number, h: number, cells: Cell[]): Board {
  expect(cells.length).toBe(w * h)
  return { w, h, cells }
}

// A minimal replay helper local to the test (the engine exposes fold/previewFold).
function replaySolution(gen: ReturnType<typeof generateBoard>): {
  won: boolean
  folds: number
  finalPips: number
} {
  let state: GameState = {
    board: gen.board,
    par: gen.par,
    foldsUsed: 0,
    foldBudget: gen.par + FOLD_SLACK,
    unfoldsLeft: UNFOLD_POOL,
    score: 0,
    seed: 0,
    mode: 'random',
    level: 1,
    solution: gen.solution,
    history: [],
    won: false,
    lost: false,
  }
  for (const move of gen.solution) {
    const res = fold(state, move)
    state = res.state
  }
  return { won: state.won, folds: state.foldsUsed, finalPips: pipCount(state.board) }
}

describe('resolveOverlap — the complete truth table', () => {
  it('EMPTY flap over anything is a no-op', () => {
    expect(resolveOverlap(EMPTY, 3)).toEqual({ val: 3, kind: 'none' })
    expect(resolveOverlap(EMPTY, EMPTY)).toEqual({ val: EMPTY, kind: 'none' })
    expect(resolveOverlap(EMPTY, JAM)).toEqual({ val: JAM, kind: 'none' })
  })
  it('JAM flap onto a non-jam forms a jam; onto a jam is none', () => {
    expect(resolveOverlap(JAM, 2)).toEqual({ val: JAM, kind: 'jam' })
    expect(resolveOverlap(JAM, EMPTY)).toEqual({ val: JAM, kind: 'jam' })
    expect(resolveOverlap(JAM, JAM)).toEqual({ val: JAM, kind: 'none' })
  })
  it('color onto EMPTY transfers', () => {
    expect(resolveOverlap(5, EMPTY)).toEqual({ val: 5, kind: 'transfer' })
  })
  it('same color seals to EMPTY', () => {
    expect(resolveOverlap(4, 4)).toEqual({ val: EMPTY, kind: 'seal' })
  })
  it('different colors jam', () => {
    expect(resolveOverlap(1, 2)).toEqual({ val: JAM, kind: 'jam' })
  })
  it('color onto JAM is blocked (pip destroyed)', () => {
    expect(resolveOverlap(7, JAM)).toEqual({ val: JAM, kind: 'blocked' })
  })
})

describe('scoreForSeals — triangular escalation', () => {
  it('matches 0,10,30,60,100 for 0..4 seals', () => {
    expect(scoreForSeals(0)).toBe(0)
    expect(scoreForSeals(1)).toBe(10)
    expect(scoreForSeals(2)).toBe(30)
    expect(scoreForSeals(3)).toBe(60)
    expect(scoreForSeals(4)).toBe(100)
    expect(BASE_SEAL).toBe(10)
  })
})

describe('creaseSides & ties', () => {
  it('forces the strictly-smaller side and ignores prefer', () => {
    const b = board(4, 1, [0, 1, 2, 3])
    // crease v index 1: low width 1 < high width 3 -> low folds regardless of prefer
    expect(creaseSides(b, 'v', 1, 'high').flapSide).toBe('low')
    expect(creaseSides(b, 'v', 1, 'low').flapSide).toBe('low')
    // crease v index 3: low width 3 > high width 1 -> high folds
    expect(creaseSides(b, 'v', 3, 'low').flapSide).toBe('high')
  })
  it('prefer decides only on a centered tie', () => {
    const b = board(4, 1, [0, 1, 2, 3])
    expect(creaseSides(b, 'v', 2, 'low').flapSide).toBe('low')
    expect(creaseSides(b, 'v', 2, 'high').flapSide).toBe('high')
  })
})

describe('previewFold — reflection geometry', () => {
  it('low flap col c lands on 2k-1-c (vertical)', () => {
    // w=4, crease k=2 (tie, prefer low folds cols [0,1] onto [2,3])
    // col 0 -> 3, col 1 -> 2
    const b = board(4, 1, [10, 11, EMPTY, EMPTY])
    const p = previewFold(b, 'v', 2, 'low')
    expect(p.legal).toBe(true)
    expect(p.flapSide).toBe('low')
    expect(p.next.w).toBe(2)
    // survivor cols [2,3]; col2 gets flap col1(=11) transferred; col3 gets flap col0(=10)
    expect(p.next.cells).toEqual([11, 10])
    const map = p.overlaps.map((o) => [o.flapIndex, o.baseIndex])
    expect(map).toContainEqual([1, 2]) // flap col1 -> base col2
    expect(map).toContainEqual([0, 3]) // flap col0 -> base col3
  })
  it('high flap col c lands on 2k-1-c (vertical)', () => {
    // w=4, crease k=2, prefer high folds cols [2,3] onto [0,1]
    const b = board(4, 1, [EMPTY, EMPTY, 20, 21])
    const p = previewFold(b, 'v', 2, 'high')
    expect(p.flapSide).toBe('high')
    expect(p.next.w).toBe(2)
    // col2 -> 1, col3 -> 0 ; survivor cols [0,1]
    expect(p.next.cells).toEqual([21, 20])
  })
  it('horizontal fold reflects rows and leaves columns', () => {
    // h=4,w=1 crease k=2 low: row0->3,row1->2 onto survivor rows [2,3]
    const b = board(1, 4, [30, 31, EMPTY, EMPTY])
    const p = previewFold(b, 'h', 2, 'low')
    expect(p.next.w).toBe(1)
    expect(p.next.h).toBe(2)
    expect(p.next.cells).toEqual([31, 30])
  })
})

describe('previewFold — each mechanic', () => {
  it('a single seal', () => {
    // w=2, both cols same color -> fold seals them
    const b = board(2, 1, [5, 5])
    const p = previewFold(b, 'v', 1, 'low')
    expect(p.seals).toBe(1)
    expect(p.jamsFormed).toBe(0)
    expect(p.scoreDelta).toBe(10)
    expect(p.next.cells).toEqual([EMPTY])
    expect(isWon(p.next)).toBe(true)
  })
  it('a triple-seal single fold (combo)', () => {
    // w=2, h=3: each row is a matched pair of a distinct color
    const b = board(2, 3, [0, 0, 1, 1, 2, 2])
    const p = previewFold(b, 'v', 1, 'low')
    expect(p.seals).toBe(3)
    expect(p.scoreDelta).toBe(60)
    expect(p.next.cells).toEqual([EMPTY, EMPTY, EMPTY])
  })
  it('a color-onto-empty transfer', () => {
    const b = board(2, 1, [7, EMPTY])
    const p = previewFold(b, 'v', 1, 'low')
    expect(p.seals).toBe(0)
    expect(p.jamsFormed).toBe(0)
    expect(p.next.cells).toEqual([7])
    expect(p.overlaps[0].kind).toBe('transfer')
  })
  it('a different-color jam', () => {
    const b = board(2, 1, [1, 2])
    const p = previewFold(b, 'v', 1, 'low')
    expect(p.seals).toBe(0)
    expect(p.jamsFormed).toBe(1)
    expect(p.next.cells).toEqual([JAM])
  })
  it('a pip folding onto a JAM is blocked (no new jam)', () => {
    const b = board(2, 1, [9, JAM])
    const p = previewFold(b, 'v', 1, 'low')
    expect(p.jamsFormed).toBe(0)
    expect(p.overlaps[0].kind).toBe('blocked')
    expect(p.next.cells).toEqual([JAM])
  })
  it('an EMPTY-flap no-op preserves the survivor', () => {
    const b = board(2, 1, [EMPTY, 8])
    const p = previewFold(b, 'v', 1, 'low')
    expect(p.seals).toBe(0)
    expect(p.jamsFormed).toBe(0)
    expect(p.next.cells).toEqual([8])
    expect(p.overlaps[0].kind).toBe('none')
  })
  it('illegal creases return legal:false and the same board', () => {
    const b = board(1, 1, [EMPTY])
    const p = previewFold(b, 'v', 1, 'low')
    expect(p.legal).toBe(false)
    expect(p.next).toBe(b)
    expect(inBounds(b, 'v', 1)).toBe(false)
  })
  it('does not mutate the input board', () => {
    const cells = [1, 1]
    const b = board(2, 1, cells)
    previewFold(b, 'v', 1, 'low')
    expect(cells).toEqual([1, 1])
  })
})

describe('legalCreases & inBounds', () => {
  it('lists vertical then horizontal creases ascending', () => {
    const b = board(3, 2, [0, 0, 0, 0, 0, 0])
    expect(legalCreases(b)).toEqual([
      { axis: 'v', index: 1 },
      { axis: 'v', index: 2 },
      { axis: 'h', index: 1 },
    ])
  })
  it('rejects out-of-range indices', () => {
    const b = board(3, 3, new Array(9).fill(EMPTY))
    expect(inBounds(b, 'v', 0)).toBe(false)
    expect(inBounds(b, 'v', 3)).toBe(false)
    expect(inBounds(b, 'v', 2)).toBe(true)
    expect(inBounds(b, 'h', 1)).toBe(true)
  })
})

describe('fold — bookkeeping, win, lose, undo', () => {
  function mk(b: Board, par: number, over: Partial<GameState> = {}): GameState {
    return {
      board: b,
      par,
      foldsUsed: 0,
      foldBudget: par + FOLD_SLACK,
      unfoldsLeft: UNFOLD_POOL,
      score: 0,
      seed: 1,
      mode: 'random',
      level: 1,
      solution: [],
      history: [],
      won: false,
      lost: false,
      ...over,
    }
  }

  it('increments foldsUsed, pushes a snapshot, adds score', () => {
    const s = mk(board(2, 1, [5, 5]), 1)
    const { state } = fold(s, { axis: 'v', index: 1, prefer: 'low' })
    expect(state.foldsUsed).toBe(1)
    expect(state.history.length).toBe(1)
    expect(state.history[0].board.cells).toEqual([5, 5])
    // sealed everything at par -> win + par bonus
    expect(state.won).toBe(true)
    expect(state.score).toBe(10 + PAR_BONUS)
  })

  it('does NOT award par bonus when over par', () => {
    const s = mk(board(2, 1, [5, 5]), 0) // par 0, so foldsUsed(1) > par
    const { state } = fold(s, { axis: 'v', index: 1, prefer: 'low' })
    expect(state.won).toBe(true)
    expect(state.score).toBe(10) // no PAR_BONUS
  })

  it('loses when pips remain and the board folds to 1×1', () => {
    // w=2 with a jam-forming fold leaves a single JAM cell but a pip elsewhere?
    // Use w=2 pips of different color: seals nothing, shrinks to 1x1 with a JAM (no pip) -> that is a win.
    // Instead: 2x2 where one fold leaves a 1x2 still holding a pip and no more folds needed to lose via budget.
    const b = board(2, 1, [1, EMPTY]) // transfer -> [1], 1x1, pip remains
    const s = mk(b, 5)
    const { state } = fold(s, { axis: 'v', index: 1, prefer: 'low' })
    expect(state.board.w).toBe(1)
    expect(pipCount(state.board)).toBe(1)
    expect(state.lost).toBe(true)
    expect(state.won).toBe(false)
  })

  it('loses when the fold budget is exhausted', () => {
    const b = board(3, 1, [1, EMPTY, EMPTY]) // fold shrinks but keeps a pip
    const s = mk(b, 0, { foldsUsed: 2, foldBudget: 3 }) // this fold makes foldsUsed 3 >= budget
    const { state } = fold(s, { axis: 'v', index: 1, prefer: 'low' })
    expect(state.foldsUsed).toBe(3)
    expect(pipCount(state.board)).toBeGreaterThan(0)
    expect(state.lost).toBe(true)
  })

  it('illegal / finished folds are no-ops', () => {
    const s = mk(board(1, 1, [EMPTY]), 3)
    const r1 = fold(s, { axis: 'v', index: 1, prefer: 'low' })
    expect(r1.state).toBe(s)
    expect(r1.preview.legal).toBe(false)

    const finished = mk(board(2, 1, [5, 5]), 1, { won: true })
    const r2 = fold(finished, { axis: 'v', index: 1, prefer: 'low' })
    expect(r2.state).toBe(finished)
  })

  it('undo restores board/score/foldsUsed and decrements the pool; no-op at 0', () => {
    const s = mk(board(2, 3, [0, 0, 1, 1, 2, 2]), 1)
    const { state: afterFold } = fold(s, { axis: 'v', index: 1, prefer: 'low' })
    const restored = undo(afterFold)
    expect(restored.board.cells).toEqual([0, 0, 1, 1, 2, 2])
    expect(restored.score).toBe(0)
    expect(restored.foldsUsed).toBe(0)
    expect(restored.unfoldsLeft).toBe(UNFOLD_POOL - 1)
    expect(restored.won).toBe(false)

    // Drain the pool then confirm no-op returns same reference.
    let drained = { ...restored, unfoldsLeft: 0 }
    expect(undo(drained)).toBe(drained)
    // Empty history no-op.
    drained = { ...restored, history: [] }
    expect(undo(drained)).toBe(drained)
  })
})

describe('generateBoard — provably solvable (the crown jewel)', () => {
  it('every color appears exactly twice, zero jams, replay wins in par', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (let level = 1; level <= 6; level++) {
        const gen = generateBoard(mulberry32(seed), level)
        // (b) zero jams
        expect(gen.board.cells.some((c) => c === JAM)).toBe(false)
        // (a) every color id appears exactly twice
        const counts = new Map<number, number>()
        for (const c of gen.board.cells) {
          if (c >= 0) counts.set(c, (counts.get(c) ?? 0) + 1)
        }
        for (const [, n] of counts) expect(n).toBe(2)
        // par matches the recorded solution length
        expect(gen.solution.length).toBe(gen.par)
        expect(gen.par).toBeGreaterThanOrEqual(3)
        // (c) replaying solution forward wins in exactly par folds
        const r = replaySolution(gen)
        expect(r.finalPips).toBe(0)
        expect(r.won).toBe(true)
        expect(r.folds).toBe(gen.par)
      }
    }
  })

  it('board dimensions never exceed MAX_DIM', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gen = generateBoard(mulberry32(seed), 6)
      expect(gen.board.w).toBeLessThanOrEqual(6)
      expect(gen.board.h).toBeLessThanOrEqual(6)
      expect(gen.board.w).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('newGame / nextLevel / session', () => {
  it('newGame wires par, budget, pool, and a fresh solvable board', () => {
    const s = newGame(mulberry32(42), 'random', 42, 1)
    expect(s.foldBudget).toBe(s.par + FOLD_SLACK)
    expect(s.unfoldsLeft).toBe(UNFOLD_POOL)
    expect(s.foldsUsed).toBe(0)
    expect(s.score).toBe(0)
    expect(s.level).toBe(1)
    expect(s.solution.length).toBe(s.par)
  })

  it('nextLevel raises level, carries score, resets budget/pool/history', () => {
    const s = newGame(mulberry32(1), 'random', 1, 1)
    const scored: GameState = { ...s, score: 555, foldsUsed: 2, unfoldsLeft: 0 }
    const n = nextLevel(scored, mulberry32(2), 2)
    expect(n.level).toBe(2)
    expect(n.score).toBe(555)
    expect(n.foldsUsed).toBe(0)
    expect(n.unfoldsLeft).toBe(UNFOLD_POOL)
    expect(n.history).toEqual([])
    expect(n.foldBudget).toBe(n.par + FOLD_SLACK)
  })
})

describe('mulberry32 & dailySeed determinism', () => {
  it('mulberry32 is reproducible for a seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
    for (const v of seqA) expect(v).toBeGreaterThanOrEqual(0)
    for (const v of seqA) expect(v).toBeLessThan(1)
  })

  it('dailySeed is stable per date string and differs across dates', () => {
    expect(dailySeed('2026-07-14')).toBe(dailySeed('2026-07-14'))
    expect(dailySeed('2026-07-14')).not.toBe(dailySeed('2026-07-15'))
    expect(dailySeed('2026-07-14')).toBeGreaterThanOrEqual(0)
  })
})

describe('generateBoard — snapshot across seeds', () => {
  it('is stable for fixed seeds', () => {
    const shape = (seed: number, level: number) => {
      const g = generateBoard(mulberry32(seed), level)
      return { w: g.board.w, h: g.board.h, par: g.par, cells: g.board.cells }
    }
    expect(shape(1, 1)).toMatchSnapshot()
    expect(shape(2, 3)).toMatchSnapshot()
    expect(shape(7, 6)).toMatchSnapshot()
  })
})
