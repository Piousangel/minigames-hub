import { describe, expect, it } from 'vitest'
import {
  ARTWORK_VARIANTS,
  DIFFICULTIES,
  NEON_PALETTE,
  type State,
  artworkFor,
  correctCellFor,
  createGame,
  deal,
  edgesFor,
  isSolved,
  mulberry32,
  placePiece,
  remaining,
  removePiece,
  score,
  shuffle,
} from './engine'

/** Play a full, correct solve of a deal by placing every piece on its cell. */
function solve(start: State): State {
  let s = start
  // Iterate over a snapshot of tray ids (placement mutates tray).
  for (const id of start.tray.slice()) {
    const cell = correctCellFor(s, id)!
    s = placePiece(s, id, cell.row, cell.col)
  }
  return s
}

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('returns floats in [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 200; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('shuffle', () => {
  it('is a permutation and leaves the input untouched', () => {
    const src = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffle(src, mulberry32(1))
    expect(out.slice().sort((a, b) => a - b)).toEqual(src)
    expect(src).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]) // untouched
  })

  it('is deterministic for a fixed seed', () => {
    expect(shuffle([0, 1, 2, 3, 4], mulberry32(9))).toEqual(shuffle([0, 1, 2, 3, 4], mulberry32(9)))
  })
})

describe('deal', () => {
  it('creates n*n pieces for each difficulty, all in the tray, board empty', () => {
    for (const n of DIFFICULTIES) {
      const s = createGame(1, n)
      expect(s.pieces).toHaveLength(n * n)
      expect(s.tray).toHaveLength(n * n)
      expect(s.placedCount).toBe(0)
      expect(s.status).toBe('playing')
      expect(s.moves).toBe(0)
      // board is n×n of nulls
      expect(s.board).toHaveLength(n)
      expect(s.board.every((row) => row.length === n && row.every((c) => c === null))).toBe(true)
    }
  })

  it('gives each piece its identity cell (id = row*n+col) and null placement', () => {
    const n = 4
    const s = createGame(3, n)
    s.pieces.forEach((p, i) => {
      expect(p.id).toBe(i)
      expect(p.row).toBe(Math.floor(i / n))
      expect(p.col).toBe(i % n)
      expect(p.placedAt).toBeNull()
    })
  })

  it('tray is a permutation of all piece ids', () => {
    const n = 6
    const s = createGame(77, n)
    expect(s.tray.slice().sort((a, b) => a - b)).toEqual(
      Array.from({ length: n * n }, (_, i) => i),
    )
  })

  it('selects an artwork variant within range', () => {
    for (let seed = 0; seed < 40; seed++) {
      const s = createGame(seed, 3)
      expect(s.variant).toBeGreaterThanOrEqual(0)
      expect(s.variant).toBeLessThan(ARTWORK_VARIANTS)
    }
  })

  it('is deterministic for a fixed seed + n (golden tray)', () => {
    const s = createGame(12345, 3)
    expect(s.tray).toEqual([5, 6, 0, 1, 7, 4, 3, 2, 8])
    expect(s.variant).toBe(5)
    expect(s.seed).toBe(3543444592)
  })

  it('deep-equals a re-deal of the same seed + n', () => {
    expect(createGame(2024, 4)).toEqual(createGame(2024, 4))
  })

  it('different seeds give different tray orders', () => {
    const a = createGame(12345, 3).tray
    const b = createGame(999, 3).tray
    expect(b).toEqual([3, 1, 0, 7, 6, 4, 2, 5, 8])
    expect(a).not.toEqual(b)
  })

  it('deal(rng, n) matches createGame(seed, n)', () => {
    expect(deal(mulberry32(55), 4)).toEqual(createGame(55, 4))
  })
})

describe('edgesFor — interlock geometry', () => {
  it('makes every outer border edge flat (0)', () => {
    const n = 5
    const seed = createGame(4, n).seed
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const e = edgesFor(r, c, seed, n)
        if (r === 0) expect(e.top).toBe(0)
        if (r === n - 1) expect(e.bottom).toBe(0)
        if (c === 0) expect(e.left).toBe(0)
        if (c === n - 1) expect(e.right).toBe(0)
      }
    }
  })

  it('interior edges are never flat (always a tab or blank)', () => {
    const n = 4
    const seed = createGame(8, n).seed
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const e = edgesFor(r, c, seed, n)
        if (r > 0) expect(e.top).not.toBe(0)
        if (r < n - 1) expect(e.bottom).not.toBe(0)
        if (c > 0) expect(e.left).not.toBe(0)
        if (c < n - 1) expect(e.right).not.toBe(0)
      }
    }
  })

  it('right edge of (r,c) is the negation of the left edge of (r,c+1)', () => {
    const n = 6
    const seed = createGame(11, n).seed
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n - 1; c++) {
        const right = edgesFor(r, c, seed, n).right
        const leftOfNeighbour = edgesFor(r, c + 1, seed, n).left
        expect(right).toBe(-leftOfNeighbour)
      }
    }
  })

  it('bottom edge of (r,c) is the negation of the top edge of (r+1,c)', () => {
    const n = 6
    const seed = createGame(13, n).seed
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n; c++) {
        const bottom = edgesFor(r, c, seed, n).bottom
        const topOfNeighbour = edgesFor(r + 1, c, seed, n).top
        expect(bottom).toBe(-topOfNeighbour)
      }
    }
  })

  it('is deterministic for a fixed seed (golden edges)', () => {
    const seed = createGame(12345, 3).seed
    expect(edgesFor(0, 0, seed, 3)).toEqual({ top: 0, right: -1, bottom: -1, left: 0 })
    expect(edgesFor(1, 1, seed, 3)).toEqual({ top: -1, right: 1, bottom: -1, left: -1 })
  })
})

describe('placePiece — strict correct-only model', () => {
  it('places a tray piece on its correct cell, locks it, and increments counters', () => {
    const s0 = createGame(1, 3)
    const id = s0.tray[0]
    const cell = correctCellFor(s0, id)!
    const s1 = placePiece(s0, id, cell.row, cell.col)
    expect(s1).not.toBe(s0)
    expect(s1.board[cell.row][cell.col]).toBe(id)
    expect(s1.pieces[id].placedAt).toEqual(cell)
    expect(s1.placedCount).toBe(1)
    expect(s1.moves).toBe(1)
    expect(s1.tray).not.toContain(id)
    expect(s1.tray).toHaveLength(s0.tray.length - 1)
  })

  it('rejects a wrong cell as a === no-op', () => {
    const s0 = createGame(1, 3)
    const id = s0.tray[0]
    const cell = correctCellFor(s0, id)!
    // pick any cell that is NOT the correct one
    const wrong = { row: (cell.row + 1) % 3, col: (cell.col + 1) % 3 }
    const s1 = placePiece(s0, id, wrong.row, wrong.col)
    expect(s1).toBe(s0)
  })

  it('rejects an out-of-range cell as a === no-op', () => {
    const s0 = createGame(1, 3)
    expect(placePiece(s0, s0.tray[0], -1, 0)).toBe(s0)
    expect(placePiece(s0, s0.tray[0], 0, 3)).toBe(s0)
  })

  it('rejects an unknown piece id as a === no-op', () => {
    const s0 = createGame(1, 3)
    expect(placePiece(s0, 999, 0, 0)).toBe(s0)
  })

  it('rejects placing onto an occupied cell as a === no-op', () => {
    const s0 = createGame(1, 3)
    const id = s0.tray[0]
    const cell = correctCellFor(s0, id)!
    const s1 = placePiece(s0, id, cell.row, cell.col)
    // A different piece can never target that cell (strict), but re-placing the
    // same already-placed piece must no-op too.
    expect(placePiece(s1, id, cell.row, cell.col)).toBe(s1)
  })

  it('does not mutate the previous state (immutability)', () => {
    const s0 = createGame(2, 3)
    const boardBefore = JSON.stringify(s0.board)
    const trayBefore = s0.tray.slice()
    const id = s0.tray[0]
    const cell = correctCellFor(s0, id)!
    placePiece(s0, id, cell.row, cell.col)
    expect(JSON.stringify(s0.board)).toBe(boardBefore)
    expect(s0.tray).toEqual(trayBefore)
    expect(s0.placedCount).toBe(0)
  })
})

describe('removePiece — disabled in the lock model', () => {
  it('always no-ops (same reference)', () => {
    const s0 = createGame(1, 3)
    const id = s0.tray[0]
    const cell = correctCellFor(s0, id)!
    const s1 = placePiece(s0, id, cell.row, cell.col)
    expect(removePiece(s1, cell.row, cell.col)).toBe(s1)
    expect(removePiece(s0, 0, 0)).toBe(s0)
  })
})

describe('correctCellFor / remaining', () => {
  it('returns the piece identity cell, or null for unknown ids', () => {
    const s = createGame(1, 4)
    expect(correctCellFor(s, 0)).toEqual({ row: 0, col: 0 })
    expect(correctCellFor(s, 5)).toEqual({ row: 1, col: 1 })
    expect(correctCellFor(s, 999)).toBeNull()
  })

  it('remaining counts unplaced pieces and drops as pieces are placed', () => {
    const s0 = createGame(1, 3)
    expect(remaining(s0)).toBe(9)
    const id = s0.tray[0]
    const cell = correctCellFor(s0, id)!
    const s1 = placePiece(s0, id, cell.row, cell.col)
    expect(remaining(s1)).toBe(8)
  })
})

describe('isSolved / win', () => {
  it('is false on a fresh deal and stays false until the last piece', () => {
    let s = createGame(3, 3)
    expect(isSolved(s)).toBe(false)
    const ids = s.tray.slice()
    for (let i = 0; i < ids.length - 1; i++) {
      const cell = correctCellFor(s, ids[i])!
      s = placePiece(s, ids[i], cell.row, cell.col)
      expect(isSolved(s)).toBe(false)
      expect(s.status).toBe('playing')
    }
    const last = ids[ids.length - 1]
    const cell = correctCellFor(s, last)!
    s = placePiece(s, last, cell.row, cell.col)
    expect(isSolved(s)).toBe(true)
    expect(s.status).toBe('won')
  })

  it('a scripted full solve reaches status "won" for every difficulty', () => {
    for (const n of DIFFICULTIES) {
      const solved = solve(createGame(7, n))
      expect(solved.status).toBe('won')
      expect(isSolved(solved)).toBe(true)
      expect(solved.placedCount).toBe(n * n)
      expect(solved.tray).toHaveLength(0)
    }
  })

  it('placing after the win no-ops (game over)', () => {
    const solved = solve(createGame(7, 3))
    expect(placePiece(solved, 0, 0, 0)).toBe(solved)
  })
})

describe('score', () => {
  it('is 0 on a fresh deal', () => {
    expect(score(createGame(1, 3))).toBe(0)
  })

  it('is monotonic non-decreasing across a full solve', () => {
    let s = createGame(5, 4)
    let prev = score(s)
    for (const id of s.tray.slice()) {
      const cell = correctCellFor(s, id)!
      s = placePiece(s, id, cell.row, cell.col)
      const cur = score(s)
      expect(cur).toBeGreaterThan(prev)
      prev = cur
    }
    expect(s.status).toBe('won')
  })

  it('adds a completion bonus that scales with puzzle size', () => {
    const s3 = solve(createGame(7, 3))
    const s6 = solve(createGame(7, 6))
    // base = placedCount*100, bonus = n*n*50
    expect(score(s3)).toBe(9 * 100 + 9 * 50)
    expect(score(s6)).toBe(36 * 100 + 36 * 50)
    expect(score(s6)).toBeGreaterThan(score(s3))
  })
})

describe('artworkFor', () => {
  it('is deterministic for a fixed (seed, variant)', () => {
    expect(artworkFor(12345, 0)).toEqual(artworkFor(12345, 0))
  })

  it('only uses on-brand neon palette colours', () => {
    const art = artworkFor(42, 3)
    expect(NEON_PALETTE).toContain(art.bg[0])
    expect(NEON_PALETTE).toContain(art.bg[1])
    expect(NEON_PALETTE).toContain(art.accent)
    for (const sh of art.shapes) {
      expect(NEON_PALETTE).toContain(sh.color)
      expect(sh.cx).toBeGreaterThanOrEqual(0)
      expect(sh.cx).toBeLessThanOrEqual(1)
      expect(sh.opacity).toBeGreaterThan(0)
      expect(sh.opacity).toBeLessThanOrEqual(1)
    }
  })

  it('produces a handful of shapes and differs across variants', () => {
    const a = artworkFor(100, 0)
    const b = artworkFor(100, 1)
    expect(a.shapes.length).toBeGreaterThanOrEqual(5)
    expect(a.shapes.length).toBeLessThanOrEqual(8)
    expect(a).not.toEqual(b)
  })
})
