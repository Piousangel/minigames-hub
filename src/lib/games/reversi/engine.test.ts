import { describe, expect, it } from 'vitest'
import {
  aiMove,
  applyMove,
  counts,
  flipsFor,
  hasAnyMove,
  isGameOver,
  legalMoves,
  legalMovesFor,
  newGame,
  pass,
  SIZE,
  winner,
  type Board,
  type Cell,
  type Color,
  type Coord,
  type GameState,
} from './engine'

// Build an 8x8 board from 8 rows of 8 chars:
//   '.' empty   'D' dark disc   'L' light disc
function parse(rows: string[]): Board {
  return rows.map((line) =>
    [...line].map<Cell>((ch) => (ch === 'D' ? 'D' : ch === 'L' ? 'L' : null)),
  )
}
const st = (rows: string[], turn: Color = 'D'): GameState => ({ board: parse(rows), turn })

const EMPTY = Array<string>(SIZE).fill('........')
const key = ([r, c]: Coord): string => `${r},${c}`
const keys = (cs: Coord[]): string[] => cs.map(key).sort()

describe('newGame — standard opening', () => {
  it('starts with the four centre discs and dark to move', () => {
    const s = newGame()
    expect(s.turn).toBe('D')
    expect(s.board[3][3]).toBe('L')
    expect(s.board[4][4]).toBe('L')
    expect(s.board[3][4]).toBe('D')
    expect(s.board[4][3]).toBe('D')
    const c = counts(s.board)
    expect(c.D).toBe(2)
    expect(c.L).toBe(2)
    // Exactly four discs on the board, all others empty.
    expect(s.board.flat().filter((x) => x !== null)).toHaveLength(4)
  })

  it('offers dark exactly four opening moves', () => {
    const moves = legalMoves(newGame())
    expect(keys(moves)).toEqual(['2,3', '3,2', '4,5', '5,4'])
  })
})

describe('flipping', () => {
  it('a legal move flips the flanked line', () => {
    // Dark plays (2,3): flanks the light on (3,3) against dark on (4,3).
    const s = newGame()
    const flips = flipsFor(s.board, 'D', [2, 3])
    expect(keys(flips)).toEqual(['3,3'])
    const next = applyMove(s, [2, 3])
    expect(next.board[2][3]).toBe('D') // placed
    expect(next.board[3][3]).toBe('D') // flipped
    expect(next.turn).toBe('L')
  })

  it('flips in multiple directions from a single move', () => {
    // Row 4: D at (4,2), L at (4,3), empty (4,4), L at (4,5), D at (4,6).
    // Column 4: D at (2,4), L at (3,4) above the drop square.
    const rows = [...EMPTY]
    rows[2] = '....D...'
    rows[3] = '....L...'
    rows[4] = '..DL.LD.'
    const s = st(rows, 'D')
    const flips = flipsFor(s.board, 'D', [4, 4])
    // Left line (4,3), right line (4,5), up line (3,4) all captured.
    expect(keys(flips)).toEqual(['3,4', '4,3', '4,5'])
    const next = applyMove(s, [4, 4])
    for (const p of flips) expect(next.board[p[0]][p[1]]).toBe('D')
    // 3 original dark + 1 placed + 3 flipped = 7 dark, 0 light.
    const c = counts(next.board)
    expect(c.D).toBe(7)
    expect(c.L).toBe(0)
  })

  it('does not flip a line that runs off the board unbounded', () => {
    const rows = [...EMPTY]
    rows[4] = '...LL...' // lights at (4,3),(4,4); no dark bounding the line
    const s = st(rows, 'D')
    // Playing (4,5): walking left crosses (4,4)L,(4,3)L then empty (4,2) → unbounded.
    const flips = flipsFor(s.board, 'D', [4, 5])
    expect(flips).toHaveLength(0)
  })
})

describe('illegal moves', () => {
  it('rejects a move that flanks nothing (returns the same state)', () => {
    const s = newGame()
    // (0,0) is far from any disc — flips nothing.
    expect(flipsFor(s.board, 'D', [0, 0])).toHaveLength(0)
    expect(applyMove(s, [0, 0])).toBe(s)
  })

  it('rejects a move onto an occupied square', () => {
    const s = newGame()
    expect(flipsFor(s.board, 'D', [3, 3])).toHaveLength(0)
    expect(applyMove(s, [3, 3])).toBe(s)
  })

  it('never generates a move that flips zero discs', () => {
    const s = newGame()
    // Run a handful of applied moves and re-check invariants each ply.
    let cur = s
    for (let i = 0; i < 8; i++) {
      const moves = legalMoves(cur)
      if (moves.length === 0) {
        cur = pass(cur)
        continue
      }
      for (const m of moves) {
        expect(cur.board[m[0]][m[1]]).toBeNull() // empty target
        expect(flipsFor(cur.board, cur.turn, m).length).toBeGreaterThan(0)
      }
      cur = applyMove(cur, moves[0])
    }
  })
})

describe('passing', () => {
  it('a side with no legal move passes (other side keeps playing)', () => {
    // Light's lone disc (0,5) only touches dark toward the right edge, which is
    // blocked — so light has no move; dark can play (0,4).
    const rows = [...EMPTY]
    rows[0] = '.....LDD' // light (0,5), dark (0,6)(0,7)
    const s = st(rows, 'L')
    expect(legalMoves(s)).toHaveLength(0) // light is stuck
    expect(hasAnyMove(s.board, 'D')).toBe(true) // dark can still move
    expect(isGameOver(s.board)).toBe(false) // not over — it's a pass
    const passed = pass(s)
    expect(passed.turn).toBe('D')
    expect(passed.board).toBe(s.board) // no disc placed
  })

  it('applyMove can leave the opponent with no move (a forced pass situation)', () => {
    // Tiny corner position: after dark plays (0,0) light has no reply.
    const rows = [...EMPTY]
    rows[0] = '.LD.....' // light (0,1), dark (0,2)
    const s = st(rows, 'D')
    const next = applyMove(s, [0, 0]) // flips (0,1)
    expect(next.board[0][0]).toBe('D')
    expect(next.board[0][1]).toBe('D')
    expect(next.turn).toBe('L')
    expect(hasAnyMove(next.board, 'L')).toBe(false) // light must pass
  })
})

describe('game end + winner', () => {
  it('ends only when neither side can move', () => {
    expect(winner(newGame())).toBeNull()
    // A board fully owned by dark: neither side has an empty flanking square.
    const full = st(Array<string>(SIZE).fill('DDDDDDDD'))
    expect(isGameOver(full.board)).toBe(true)
    expect(winner(full)).toBe('D')
  })

  it('declares the majority the winner', () => {
    const rows = Array<string>(SIZE).fill('DDDDDDDD')
    rows[0] = 'LLLDDDDD' // 3 light, rest dark — dark majority, board full
    const s = st(rows, 'L')
    expect(isGameOver(s.board)).toBe(true)
    const c = counts(s.board)
    expect(c.D).toBe(61)
    expect(c.L).toBe(3)
    expect(winner(s)).toBe('D')
  })

  it('detects a tie on equal counts', () => {
    const rows = Array<string>(SIZE).fill('DDDDLLLL')
    const s = st(rows, 'D')
    expect(isGameOver(s.board)).toBe(true)
    const c = counts(s.board)
    expect(c.D).toBe(32)
    expect(c.L).toBe(32)
    expect(winner(s)).toBe('tie')
  })
})

describe('disc counts', () => {
  it('a capture increases the mover and decreases the opponent', () => {
    const s = newGame()
    expect(counts(s.board)).toEqual({ D: 2, L: 2 })
    const next = applyMove(s, [2, 3]) // dark flips one light
    expect(counts(next.board)).toEqual({ D: 4, L: 1 })
  })
})

describe('AI', () => {
  it('easy returns a legal move chosen by the injected rng', () => {
    const s = newGame()
    const legal = legalMoves(s)
    const first = aiMove(s, 'easy', () => 0)
    expect(first).toEqual(legal[0])
    const last = aiMove(s, 'easy', () => 0.999)
    expect(last).toEqual(legal[legal.length - 1])
  })

  it('every AI move (easy and hard) is legal', () => {
    const s = newGame()
    const legalKeys = new Set(legalMovesFor(s.board, s.turn).map(key))
    for (const diff of ['easy', 'hard'] as const) {
      const mv = aiMove(s, diff, () => 0.5)
      expect(mv).not.toBeNull()
      expect(legalKeys.has(key(mv as Coord))).toBe(true)
    }
  })

  it('hard grabs an available corner over an X-square trap', () => {
    // Dark can play the corner (0,0) or the dangerous X-squares (1,1)/(2,2). The
    // corner is unambiguously best under the positional weights.
    const rows = [...EMPTY]
    rows[0] = '.LD.....' // corner move (0,0) flips (0,1)
    rows[1] = '..LD....' // X-square move (1,1) flips (1,2)
    const s = st(rows, 'D')
    const legalKeys = new Set(legalMovesFor(s.board, 'D').map(key))
    expect(legalKeys.has('0,0')).toBe(true) // corner is an option
    expect(legalKeys.has('1,1')).toBe(true) // a non-corner (X-square) option too
    const mv = aiMove(s, 'hard', () => 0)
    expect(mv).toEqual([0, 0])
  })

  it('returns null when the side to move is stuck', () => {
    const rows = [...EMPTY]
    rows[0] = '.....LDD' // light (0,5) is stuck (see the passing test)
    expect(aiMove(st(rows, 'L'), 'hard', () => 0)).toBeNull()
    expect(aiMove(st(rows, 'L'), 'easy', () => 0)).toBeNull()
  })
})
