import { describe, it, expect } from 'vitest'
import {
  GRID,
  EXIT_ROW,
  EXIT_COL,
  LEVELS,
  type Block,
  type State,
  blockCells,
  canSlide,
  fromLevel,
  getLevel,
  isSolved,
  isSolvedBlocks,
  LEVEL_PAR,
  levelCount,
  maxSlide,
  parseGrid,
  slide,
  slideTo,
  solveBFS,
  targetBlock,
} from './engine'

// -- fixture helpers ---------------------------------------------------------

/** Build a bare playing State from a block list. */
function mk(blocks: Block[]): State {
  return { blocks, status: 'playing', moves: 0, levelIndex: 0 }
}

/** The classic-recorded minimum moves for each bank level, in play order.
 *  Sourced from the engine's baked LEVEL_PAR; the BFS suite re-derives and pins
 *  every value, so the two can never silently drift apart. */
const KNOWN_MIN: readonly number[] = LEVEL_PAR

// -- level bank integrity ----------------------------------------------------

describe('level bank', () => {
  it('ships at least 24 levels', () => {
    expect(levelCount()).toBeGreaterThanOrEqual(24)
    expect(LEVELS.length).toBe(KNOWN_MIN.length)
  })

  it('every level is well-formed (in-bounds, no overlaps, valid target)', () => {
    for (const lvl of LEVELS) {
      const occ = new Set<number>()
      for (const b of lvl.blocks) {
        expect(b.len === 2 || b.len === 3).toBe(true)
        for (const c of blockCells(b)) {
          const r = Math.floor(c / GRID)
          const cc = c % GRID
          expect(r).toBeGreaterThanOrEqual(0)
          expect(r).toBeLessThan(GRID)
          expect(cc).toBeGreaterThanOrEqual(0)
          expect(cc).toBeLessThan(GRID)
          expect(occ.has(c)).toBe(false) // no two blocks share a cell
          occ.add(c)
        }
      }
      const t = targetBlock(lvl.blocks)
      expect(t).toBeDefined()
      expect(t?.dir).toBe('h')
      expect(t?.len).toBe(2)
      expect(t?.row).toBe(EXIT_ROW)
      // Only the target may be horizontal on the exit row (else the lane is
      // permanently blocked and the puzzle is unsolvable).
      for (const b of lvl.blocks) {
        if (b.target) continue
        if (b.dir === 'h') expect(b.row).not.toBe(EXIT_ROW)
      }
    }
  })

  it('no level starts already solved', () => {
    for (const lvl of LEVELS) expect(isSolvedBlocks(lvl.blocks)).toBe(false)
  })

  it('difficulty increases monotonically (min-moves non-decreasing)', () => {
    for (let i = 1; i < KNOWN_MIN.length; i++) {
      expect(KNOWN_MIN[i]).toBeGreaterThanOrEqual(KNOWN_MIN[i - 1])
    }
  })
})

// -- THE core guarantee: every level is solvable, min-moves recorded ---------

describe('every bank level is solvable via BFS with a recorded min-move count', () => {
  LEVELS.forEach((lvl, i) => {
    it(`level ${i} "${lvl.name}" solvable in exactly ${KNOWN_MIN[i]} moves`, () => {
      const n = solveBFS(lvl)
      expect(n).not.toBeNull() // SOLVABLE
      expect(n).toBe(KNOWN_MIN[i]) // matches the recorded minimum
      expect(n as number).toBeGreaterThanOrEqual(2) // never trivial
    })
  })

  it('a hand-played optimal solution exists for level 0 (sanity of the model)', () => {
    // First Steps: slide blocker A down out of the lane, then X out the right.
    let s = fromLevel(0)
    expect(s.moves).toBe(0)
    s = slide(s, 'A', 2) // A: vertical, down 2 → leaves the exit row
    expect(s.moves).toBe(1)
    s = slide(s, 'X', 4) // X: right to the exit column
    expect(s.status).toBe('won')
    expect(s.moves).toBe(2)
    expect(s.moves).toBe(KNOWN_MIN[0])
  })
})

// -- slide: walls, neighbours, axis lock, no-ops -----------------------------

describe('slide mechanics', () => {
  const X: Block = { id: 'X', row: 2, col: 0, len: 2, dir: 'h', target: true }

  it('slides into empty space and returns a NEW state', () => {
    const s = mk([{ ...X }])
    const n = slide(s, 'X', 3)
    expect(n).not.toBe(s)
    expect(n.blocks.find((b) => b.id === 'X')?.col).toBe(3)
    expect(n.moves).toBe(1)
  })

  it('is blocked by a wall — cannot leave the grid (same-ref no-op)', () => {
    const s = mk([{ ...X, col: 4 }]) // occupies cols 4,5 — already at the wall
    expect(slide(s, 'X', 1)).toBe(s) // right into the wall → no-op
    expect(canSlide(s, 'X', 1)).toBe(false)
  })

  it('is blocked by a neighbouring block (cannot pass through)', () => {
    const wall: Block = { id: 'A', row: 2, col: 3, len: 2, dir: 'v' } // (2,3),(3,3)
    const s = mk([{ ...X }, wall])
    // X at cols 0,1 wants to move right; col 3 is occupied → can reach col 2 only.
    expect(maxSlide(s, 'X', 1)).toBe(1)
    expect(slide(s, 'X', 2)).toBe(s) // would overlap A → no-op
    expect(slide(s, 'X', 3)).toBe(s) // would jump through A → no-op
    const n = slide(s, 'X', 1) // legal single step
    expect(n).not.toBe(s)
    expect(n.blocks.find((b) => b.id === 'X')?.col).toBe(1)
  })

  it('stops flush against a neighbour (maxSlide is exact)', () => {
    const wall: Block = { id: 'A', row: 2, col: 4, len: 2, dir: 'v' }
    const s = mk([{ ...X }, wall]) // X cols 0,1; A at col 4 → X may reach cols 2,3
    expect(maxSlide(s, 'X', 1)).toBe(2)
    const n = slide(s, 'X', 2)
    expect(n.blocks.find((b) => b.id === 'X')?.col).toBe(2)
  })

  it('a vertical block moves only up/down, clamped by walls', () => {
    const v: Block = { id: 'A', row: 2, col: 3, len: 2, dir: 'v' } // rows 2,3
    const s = mk([v])
    expect(maxSlide(s, 'A', 1)).toBe(2) // down to rows 4,5
    expect(maxSlide(s, 'A', -1)).toBe(2) // up to rows 0,1
    expect(slide(s, 'A', 3)).toBe(s) // past the floor → no-op
    const down = slide(s, 'A', 2)
    expect(down.blocks[0].row).toBe(4)
    const up = slide(s, 'A', -2)
    expect(up.blocks[0].row).toBe(0)
  })

  it('AXIS LOCK: slideTo along the cross-axis is a no-op', () => {
    // Horizontal block: changing its row is impossible; only col deltas apply.
    const s = mk([{ ...X }])
    expect(slideTo(s, 'X', 5, 0)).toBe(s) // asks for row 5 but block is horizontal → col delta 0 → no-op
    // Vertical block: changing its col is impossible.
    const v: Block = { id: 'A', row: 1, col: 3, len: 2, dir: 'v' }
    const sv = mk([v])
    expect(slideTo(sv, 'A', 1, 5)).toBe(sv) // row unchanged (1→1) → no-op
    // But moving along its own axis works.
    const moved = slideTo(sv, 'A', 3, 99)
    expect(moved.blocks[0].row).toBe(3)
  })

  it('delta 0 and unknown ids are no-ops', () => {
    const s = mk([{ ...X }])
    expect(slide(s, 'X', 0)).toBe(s)
    expect(slide(s, 'ZZZ', 2)).toBe(s)
    expect(canSlide(s, 'X', 0)).toBe(false)
    expect(canSlide(s, 'ZZZ', 2)).toBe(false)
    expect(maxSlide(s, 'ZZZ', 1)).toBe(0)
  })

  it('does not mutate the input state or its blocks', () => {
    const s = mk([{ ...X }])
    const before = JSON.stringify(s)
    slide(s, 'X', 3)
    expect(JSON.stringify(s)).toBe(before)
  })
})

// -- winning: target escapes the right edge ----------------------------------

describe('target escape / win', () => {
  it('isSolved only when the target reaches the exit column', () => {
    const s0 = mk([{ id: 'X', row: 2, col: 0, len: 2, dir: 'h', target: true }])
    expect(isSolved(s0)).toBe(false)
    const s1 = mk([{ id: 'X', row: 2, col: 4, len: 2, dir: 'h', target: true }])
    expect(isSolved(s1)).toBe(true)
    expect(EXIT_COL).toBe(GRID - 1)
  })

  it('sliding the target to the wall wins the game', () => {
    const X: Block = { id: 'X', row: 2, col: 0, len: 2, dir: 'h', target: true }
    const s = mk([X])
    const n = slide(s, 'X', 4) // cols 0,1 → 4,5
    expect(n.status).toBe('won')
    expect(isSolved(n)).toBe(true)
  })

  it('a non-target block reaching the right wall does NOT win', () => {
    const X: Block = { id: 'X', row: 2, col: 0, len: 2, dir: 'h', target: true }
    const other: Block = { id: 'A', row: 0, col: 0, len: 2, dir: 'h' }
    const s = mk([X, other])
    const n = slide(s, 'A', 4) // A reaches the wall on row 0
    expect(n.status).toBe('playing')
    expect(isSolved(n)).toBe(false)
  })

  it('no moves are accepted after the game is won', () => {
    const X: Block = { id: 'X', row: 2, col: 4, len: 2, dir: 'h', target: true }
    const won: State = { blocks: [X], status: 'won', moves: 1, levelIndex: 0 }
    expect(slide(won, 'X', -1)).toBe(won)
  })
})

// -- parser & bank access ----------------------------------------------------

describe('parseGrid + bank access', () => {
  it('infers orientation, length and the target from ASCII', () => {
    const lvl = parseGrid(99, 'T', ['...A..', '...A..', 'XX.A..', '......', '.BB...', '......'])
    const t = lvl.blocks.find((b) => b.target)
    expect(t).toMatchObject({ id: 'X', row: 2, col: 0, len: 2, dir: 'h' })
    const a = lvl.blocks.find((b) => b.id === 'A')
    expect(a).toMatchObject({ row: 0, col: 3, len: 3, dir: 'v' })
    const b = lvl.blocks.find((b) => b.id === 'B')
    expect(b).toMatchObject({ row: 4, col: 1, len: 2, dir: 'h' })
  })

  it('rejects malformed grids', () => {
    expect(() => parseGrid(0, '', ['XX....'])).toThrow() // too few rows
    expect(() => parseGrid(0, '', ['XX....', '.....', '......', '......', '......', '......'])).toThrow() // short row
    // no target
    expect(() =>
      parseGrid(0, '', ['......', '......', 'AA....', '......', '......', '......']),
    ).toThrow()
    // L-shaped (non-linear) block
    expect(() =>
      parseGrid(0, '', ['AA....', 'A.....', 'XX....', '......', '......', '......']),
    ).toThrow()
    // target not on the exit row
    expect(() =>
      parseGrid(0, '', ['XX....', '......', '......', '......', '......', '......']),
    ).toThrow()
  })

  it('getLevel wraps out-of-range indices; fromLevel deep-clones', () => {
    expect(getLevel(0)).toBe(LEVELS[0])
    expect(getLevel(LEVELS.length)).toBe(LEVELS[0])
    expect(getLevel(-1)).toBe(LEVELS[LEVELS.length - 1])
    const s = fromLevel(3)
    expect(s.levelIndex).toBe(3)
    s.blocks[0].col = 99 // mutate the copy
    expect(LEVELS[3].blocks[0].col).not.toBe(99) // bank untouched
  })
})
