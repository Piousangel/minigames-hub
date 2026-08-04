import { describe, expect, it } from 'vitest'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  LOCK_BASE,
  PAR_BONUS_MAX,
  WIN_BONUS,
  type Board,
  type TurntileState,
  blockAnchors,
  computeFlip,
  createGame,
  flipBlock,
  generateBoard,
  isBlockMatched,
  isSolved,
  matchedBlocks,
  mulberry32,
  reduce,
} from './engine'

function sortAnchors(anchors: { i: number; j: number }[]): string[] {
  return anchors.map((a) => `${a.i},${a.j}`).sort()
}

describe('mulberry32', () => {
  it('1. same seed produces identical first-5 sequences', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('2. different seeds diverge', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('3. all outputs fall within [0,1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const x = rng()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('flipBlock', () => {
  function goldenBoard(): Board {
    return [
      { faceA: 1, faceB: 9, currentSide: 0 }, // pos0 TL
      { faceA: 2, faceB: 8, currentSide: 0 }, // pos1 TR
      { faceA: 3, faceB: 7, currentSide: 0 }, // pos2 BL
      { faceA: 4, faceB: 6, currentSide: 0 }, // pos3 BR
    ]
  }

  it('4. is an involution: flipping the same anchor twice restores the original', () => {
    const board = goldenBoard()
    const twice = flipBlock(flipBlock(board, 0, 0, 2), 0, 0, 2)
    expect(twice).toEqual(board)
  })

  it('5. produces the exact golden output', () => {
    const board = goldenBoard()
    const result = flipBlock(board, 0, 0, 2)
    expect(result).toEqual([
      { faceA: 4, faceB: 6, currentSide: 1 },
      { faceA: 3, faceB: 7, currentSide: 1 },
      { faceA: 2, faceB: 8, currentSide: 1 },
      { faceA: 1, faceB: 9, currentSide: 1 },
    ])
  })

  it('6. leaves cells outside the block untouched', () => {
    const rows = 4
    const cols = 4
    const board: Board = []
    for (let k = 0; k < rows * cols; k++) {
      board.push({ faceA: k, faceB: k + 100, currentSide: 0 })
    }
    const result = flipBlock(board, 0, 0, cols)
    // position (3,3) => index 15, well outside anchor (0,0)'s block
    expect(result[15]).toEqual(board[15])
  })

  it('7. preserves the multiset of {faceA,faceB} pairs within the block', () => {
    const board = goldenBoard()
    const result = flipBlock(board, 0, 0, 2)
    const pairsBefore = board.map((c) => `${c.faceA},${c.faceB}`).sort()
    const pairsAfter = result.map((c) => `${c.faceA},${c.faceB}`).sort()
    expect(pairsAfter).toEqual(pairsBefore)
  })
})

describe('isBlockMatched', () => {
  it('8. true when all four display values agree', () => {
    const board: Board = [
      { faceA: 5, faceB: 0, currentSide: 0 },
      { faceA: 5, faceB: 0, currentSide: 0 },
      { faceA: 5, faceB: 0, currentSide: 0 },
      { faceA: 5, faceB: 0, currentSide: 0 },
    ]
    expect(isBlockMatched(board, 0, 0, 2)).toBe(true)
  })

  it('9. false when any display value differs', () => {
    const board: Board = [
      { faceA: 5, faceB: 0, currentSide: 0 },
      { faceA: 5, faceB: 0, currentSide: 0 },
      { faceA: 5, faceB: 0, currentSide: 0 },
      { faceA: 9, faceB: 0, currentSide: 0 },
    ]
    expect(isBlockMatched(board, 0, 0, 2)).toBe(false)
  })

  it('10. looks at display value, not faceA', () => {
    // Same faceA everywhere, but one cell shows faceB due to currentSide=1, and faceB differs.
    const board: Board = [
      { faceA: 5, faceB: 5, currentSide: 0 },
      { faceA: 5, faceB: 5, currentSide: 0 },
      { faceA: 5, faceB: 5, currentSide: 0 },
      { faceA: 5, faceB: 1, currentSide: 1 }, // display = 1, not 5
    ]
    expect(isBlockMatched(board, 0, 0, 2)).toBe(false)
  })
})

describe('matchedBlocks', () => {
  it('11. returns exactly the matched anchors on a hand-built 3x3 board', () => {
    // rows=3,cols=3 -> anchors: (0,0)(0,1)(1,0)(1,1)
    // pos: 0 1 2
    //      3 4 5
    //      6 7 8
    // Make block(0,0) [0,1,3,4] all display 7, everything else distinct.
    const board: Board = [
      { faceA: 7, faceB: 0, currentSide: 0 }, // 0
      { faceA: 7, faceB: 0, currentSide: 0 }, // 1
      { faceA: 2, faceB: 0, currentSide: 0 }, // 2
      { faceA: 7, faceB: 0, currentSide: 0 }, // 3
      { faceA: 7, faceB: 0, currentSide: 0 }, // 4
      { faceA: 3, faceB: 0, currentSide: 0 }, // 5
      { faceA: 4, faceB: 0, currentSide: 0 }, // 6
      { faceA: 5, faceB: 0, currentSide: 0 }, // 7
      { faceA: 6, faceB: 0, currentSide: 0 }, // 8
    ]
    expect(sortAnchors(matchedBlocks(board, 3, 3))).toEqual(sortAnchors([{ i: 0, j: 0 }]))
  })
})

describe('isSolved', () => {
  it('12. false when any display value differs', () => {
    const board: Board = [
      { faceA: 1, faceB: 0, currentSide: 0 },
      { faceA: 1, faceB: 0, currentSide: 0 },
      { faceA: 2, faceB: 0, currentSide: 0 },
      { faceA: 1, faceB: 0, currentSide: 0 },
    ]
    expect(isSolved(board)).toBe(false)
  })

  it('13. true when display values agree despite varied side/face combos', () => {
    const board: Board = [
      { faceA: 9, faceB: 1, currentSide: 1 }, // display 1
      { faceA: 1, faceB: 5, currentSide: 0 }, // display 1
      { faceA: 3, faceB: 1, currentSide: 1 }, // display 1
      { faceA: 1, faceB: 8, currentSide: 0 }, // display 1
    ]
    expect(isSolved(board)).toBe(true)
  })
})

describe('computeFlip out-of-range', () => {
  const board: Board = [
    { faceA: 0, faceB: 1, currentSide: 0 },
    { faceA: 0, faceB: 1, currentSide: 0 },
    { faceA: 0, faceB: 1, currentSide: 0 },
    { faceA: 0, faceB: 1, currentSide: 0 },
  ]

  it('14. i = rows-1 is out of range -> null', () => {
    expect(computeFlip(board, 1, 0, 2, 2)).toBeNull()
  })

  it('15. j = cols-1 is out of range -> null', () => {
    expect(computeFlip(board, 0, 1, 2, 2)).toBeNull()
  })

  it('16. negative i -> null', () => {
    expect(computeFlip(board, -1, 0, 2, 2)).toBeNull()
  })
})

// -- Combo + win golden trace -------------------------------------------
// rows=2, cols=3. pos: 0=r0c0 1=r0c1 2=r0c2 / 3=r1c0 4=r1c1 5=r1c2
// Anchors: (0,0) uses [0,1,3,4]; (0,1) uses [1,2,4,5]; they share pos1,pos4.
function comboGoldenBoard(): Board {
  return [
    { faceA: 1, faceB: 9, currentSide: 0 }, // 0
    { faceA: 2, faceB: 9, currentSide: 0 }, // 1
    { faceA: 9, faceB: 9, currentSide: 0 }, // 2 (fixed 9)
    { faceA: 3, faceB: 9, currentSide: 0 }, // 3
    { faceA: 4, faceB: 9, currentSide: 0 }, // 4
    { faceA: 9, faceB: 9, currentSide: 0 }, // 5 (fixed 9)
  ]
}

describe('computeFlip combo+win golden trace', () => {
  it('17. flipping (0,0) locks both blocks at once and wins', () => {
    const board = comboGoldenBoard()
    const outcome = computeFlip(board, 0, 0, 2, 3)
    expect(outcome).not.toBeNull()
    expect(sortAnchors(outcome!.newlyLocked)).toEqual(
      sortAnchors([
        { i: 0, j: 0 },
        { i: 0, j: 1 },
      ]),
    )
    expect(outcome!.totalLocked).toBe(2)
    expect(outcome!.totalBlocks).toBe(2)
    expect(outcome!.won).toBe(true)
  })

  it('18. flipping a matched block that becomes unmatched reports newlyUnlocked', () => {
    // block(0,0) matched before (all faceA=5, side0), mismatched faceB so flip breaks it.
    const board: Board = [
      { faceA: 5, faceB: 1, currentSide: 0 }, // 0 TL
      { faceA: 5, faceB: 2, currentSide: 0 }, // 1 TR
      { faceA: 5, faceB: 3, currentSide: 0 }, // 2 BL
      { faceA: 5, faceB: 4, currentSide: 0 }, // 3 BR
    ]
    const outcome = computeFlip(board, 0, 0, 2, 2)
    expect(outcome).not.toBeNull()
    expect(sortAnchors(outcome!.newlyUnlocked)).toEqual(sortAnchors([{ i: 0, j: 0 }]))
    expect(outcome!.newlyLocked).toEqual([])
  })
})

describe('reduce', () => {
  function comboState(): TurntileState {
    return {
      config: { rows: 2, cols: 3, symbols: 2, scramble: 1 },
      seed: 1,
      board: comboGoldenBoard(),
      flips: 0,
      par: 1,
      score: 0,
      totalLocked: 0,
      bestCombo: 0,
      won: false,
      lastEvent: 'none',
      lastFlip: null,
    }
  }

  it('19. combo+win golden trace yields exact final score', () => {
    const state = comboState()
    const next = reduce(state, { type: 'flip', i: 0, j: 0 })
    // bonus = LOCK_BASE * 2^2 = 80; parBonus = round(1000 * min(1, 1/1)) = 1000
    // score = 80 + 1000 (WIN_BONUS) + 1000 (parBonus) = 2080
    expect(next.score).toBe(LOCK_BASE * 2 * 2 + WIN_BONUS + PAR_BONUS_MAX)
    expect(next.score).toBe(2080)
    expect(next.won).toBe(true)
    expect(next.lastEvent).toBe('win')
  })

  it('20. out-of-range flip is illegal and changes nothing material', () => {
    const state = comboState()
    const next = reduce(state, { type: 'flip', i: 5, j: 5 })
    expect(next.lastEvent).toBe('illegal')
    expect(next.board).toEqual(state.board)
    expect(next.flips).toBe(state.flips)
    expect(next.score).toBe(state.score)
  })

  it('21. flip after already won is a frozen no-op', () => {
    const state = comboState()
    const won = reduce(state, { type: 'flip', i: 0, j: 0 })
    expect(won.won).toBe(true)
    const after = reduce(won, { type: 'flip', i: 0, j: 0 })
    expect(after.lastEvent).toBe('none')
    expect(after.board).toEqual(won.board)
    expect(after.score).toBe(won.score)
    expect(after.flips).toBe(won.flips)
    expect(after.won).toBe(true)
  })
})

describe('generateBoard', () => {
  it('22. is deterministic for a fixed seed', () => {
    const cfg = DIFFICULTIES.easy
    const a = generateBoard(cfg, mulberry32(5))
    const b = generateBoard(cfg, mulberry32(5))
    expect(a.board).toEqual(b.board)
    expect(a.par).toBe(b.par)
  })

  it('23. par always equals cfg.scramble', () => {
    const cfg = DIFFICULTIES.easy
    const result = generateBoard(cfg, mulberry32(1))
    expect(result.par).toBe(cfg.scramble)
    expect(result.par).toBe(10)
  })
})

describe('createGame', () => {
  it('24. produces a fresh, unsolved, well-formed initial state', () => {
    const state = createGame(DAILY_CONFIG, 12345)
    expect(state.flips).toBe(0)
    expect(state.score).toBe(0)
    expect(state.won).toBe(false)
    expect(state.board.length).toBe(DAILY_CONFIG.rows * DAILY_CONFIG.cols)
    expect(state.par).toBeGreaterThan(0)
  })

  it('26. regression: scramble=0 always yields an already-solved board with won=true (retry-exhaustion honesty)', () => {
    // scramble=0 means zero flips applied — generateBoard always returns an
    // already-solved board, so createGame's MAX_GEN_ATTEMPTS retry loop is
    // guaranteed to exhaust without ever finding an unsolved board. won must
    // reflect that truthfully instead of the old hardcoded `false`.
    const cfg = { rows: 4, cols: 4, symbols: 3, scramble: 0 }
    const state = createGame(cfg, 777)
    expect(isSolved(state.board)).toBe(true)
    expect(state.won).toBe(true)
  })
})

describe('score monotonicity', () => {
  it('25. score never decreases across a sequence of flips', () => {
    const cfg = DIFFICULTIES.easy
    let state = createGame(cfg, 999)
    const anchors = blockAnchors(cfg.rows, cfg.cols)
    let prevScore = state.score
    for (let k = 0; k < 5; k++) {
      const anchor = anchors[k % anchors.length]
      state = reduce(state, { type: 'flip', i: anchor.i, j: anchor.j })
      expect(state.score).toBeGreaterThanOrEqual(prevScore)
      prevScore = state.score
    }
  })
})
