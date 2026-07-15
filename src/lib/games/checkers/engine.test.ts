import { describe, expect, it } from 'vitest'
import {
  aiMove,
  applyMove,
  counts,
  countPieces,
  hasCapture,
  legalMoves,
  newGame,
  opponent,
  SIZE,
  winner,
  type Board,
  type Cell,
  type Color,
  type GameState,
  type Move,
} from './engine'

// Build an 8x8 board from 8 rows of 8 chars:
//   '.' empty  'r' red man  'b' black man  'R' red king  'B' black king
function parse(rows: string[]): Board {
  return rows.map((line) =>
    [...line].map<Cell>((ch) => {
      if (ch === 'r') return { color: 'r', king: false }
      if (ch === 'R') return { color: 'r', king: true }
      if (ch === 'b') return { color: 'b', king: false }
      if (ch === 'B') return { color: 'b', king: true }
      return null
    }),
  )
}
const st = (rows: string[], turn: Color = 'r'): GameState => ({ board: parse(rows), turn })

const EMPTY = Array<string>(SIZE).fill('........')

// Find the single legal move landing on `to`. Fails the test if absent/ambiguous.
function moveTo(state: GameState, to: [number, number]): Move {
  const found = legalMoves(state).filter((m) => {
    const [tr, tc] = m.path[m.path.length - 1]
    return tr === to[0] && tc === to[1]
  })
  expect(found).toHaveLength(1)
  return found[0]
}

describe('newGame — standard opening setup', () => {
  it('places 12 men per side on dark squares, red to move', () => {
    const s = newGame()
    expect(countPieces(s.board, 'r')).toBe(12)
    expect(countPieces(s.board, 'b')).toBe(12)
    expect(s.turn).toBe('r')
    // No kings at the start.
    const c = counts(s.board)
    expect(c.rKings).toBe(0)
    expect(c.bKings).toBe(0)
  })

  it('only ever occupies dark squares', () => {
    const s = newGame()
    for (let r = 0; r < SIZE; r++)
      for (let col = 0; col < SIZE; col++) if (s.board[r][col]) expect((r + col) % 2).toBe(1)
  })
})

describe('men — forward-only diagonal movement', () => {
  it('a red man moves diagonally forward (up) but not backward or straight', () => {
    const rows = [...EMPTY]
    rows[4] = '...r....' // red man at (4,3)
    const moves = legalMoves(st(rows))
    const dests = moves.map((m) => m.path[m.path.length - 1].join(','))
    expect(dests.sort()).toEqual(['3,2', '3,4']) // only the two forward diagonals
    // Never moves to a row below its origin.
    for (const m of moves) expect(m.path[m.path.length - 1][0]).toBe(3)
  })

  it('a black man moves diagonally forward (down)', () => {
    const rows = [...EMPTY]
    rows[3] = '...b....'
    const dests = legalMoves(st(rows, 'b'))
      .map((m) => m.path[m.path.length - 1].join(','))
      .sort()
    expect(dests).toEqual(['4,2', '4,4'])
  })
})

describe('simple capture', () => {
  it('jumping an opponent removes the jumped piece and lands beyond', () => {
    const rows = [...EMPTY]
    rows[4] = '...r....' // red at (4,3)
    rows[3] = '....b...' // black at (3,4)
    const s = st(rows)
    const jump = moveTo(s, [2, 5])
    expect(jump.captures).toEqual([[3, 4]])
    const next = applyMove(s, jump)
    expect(next.board[3][4]).toBeNull() // captured piece gone
    expect(next.board[2][5]?.color).toBe('r') // landed
    expect(next.board[4][3]).toBeNull() // vacated origin
    expect(countPieces(next.board, 'b')).toBe(0)
  })
})

describe('multi-jump chains', () => {
  it('captures two pieces in a single chained move', () => {
    const rows = [...EMPTY]
    rows[5] = '..r.....' // red at (5,2)
    rows[4] = '...b....' // black at (4,3)
    rows[2] = '...b....' // black at (2,3)
    const s = st(rows)
    // Only legal option is the double jump (5,2)->(3,4)->(1,2).
    const moves = legalMoves(s)
    expect(moves).toHaveLength(1)
    const chain = moves[0]
    expect(chain.captures).toEqual([
      [4, 3],
      [2, 3],
    ])
    expect(chain.path[chain.path.length - 1]).toEqual([1, 2])
    const next = applyMove(s, chain)
    expect(countPieces(next.board, 'b')).toBe(0)
    expect(next.board[1][2]?.color).toBe('r')
  })
})

describe('promotion to king', () => {
  it('a red man reaching the back row (row 0) becomes a king', () => {
    const rows = [...EMPTY]
    rows[1] = '..r.....' // red at (1,2), one step from promotion
    const s = st(rows)
    const mv = moveTo(s, [0, 1])
    const next = applyMove(s, mv)
    expect(next.board[0][1]).toEqual({ color: 'r', king: true })
  })

  it('a man that reaches the king row during a jump promotes and stops', () => {
    const rows = [...EMPTY]
    rows[2] = '..r.....' // red at (2,2)
    rows[1] = '...b....' // black at (1,3); jump lands on row 0 (promotion row)
    const s = st(rows)
    const mv = moveTo(s, [0, 4])
    expect(mv.captures).toEqual([[1, 3]])
    const next = applyMove(s, mv)
    expect(next.board[0][4]).toEqual({ color: 'r', king: true })
    // Turn passed to black — no continued jump as a fresh king.
    expect(next.turn).toBe('b')
  })
})

describe('kings — move and capture in both directions', () => {
  it('a king moves diagonally backward as well as forward', () => {
    const rows = [...EMPTY]
    rows[4] = '...R....' // red KING at (4,3)
    const dests = legalMoves(st(rows))
      .map((m) => m.path[m.path.length - 1].join(','))
      .sort()
    expect(dests).toEqual(['3,2', '3,4', '5,2', '5,4']) // all four diagonals
  })

  it('a red king captures backward (downward)', () => {
    const rows = [...EMPTY]
    rows[3] = '...R....' // red KING at (3,3)
    rows[4] = '....b...' // black at (4,4), behind the king
    const s = st(rows)
    const jump = moveTo(s, [5, 5])
    expect(jump.captures).toEqual([[4, 4]])
    const next = applyMove(s, jump)
    expect(countPieces(next.board, 'b')).toBe(0)
    expect(next.board[5][5]?.king).toBe(true)
  })
})

describe('mandatory capture', () => {
  it('when a capture exists, non-capturing moves are illegal', () => {
    const rows = [...EMPTY]
    rows[4] = '...r....' // red at (4,3)
    rows[3] = '....b...' // black at (3,4) — capturable
    const s = st(rows)
    expect(hasCapture(s)).toBe(true)
    const moves = legalMoves(s)
    // Every returned move must be a capture; the quiet (4,3)->(3,2) slide is gone.
    expect(moves.every((m) => m.captures.length > 0)).toBe(true)
    expect(moves.map((m) => m.path[m.path.length - 1].join(','))).not.toContain('3,2')
  })
})

describe('winner detection', () => {
  it('a side with no pieces loses', () => {
    const rows = [...EMPTY]
    rows[5] = '..r.....'
    expect(winner(st(rows))).toBe('r')
  })

  it('a side with no legal move on its turn loses', () => {
    // Black man at (7,7) is a man on the last row: its only directions (down)
    // run off the board, so it is stuck. A distant red man keeps red on board.
    const rows = [...EMPTY]
    rows[7] = '.......b' // black at (7,7): forward is down, off-board -> stuck
    rows[0] = '.r......' // red man at (0,1), unrelated
    const s = st(rows, 'b')
    expect(countPieces(s.board, 'r')).toBeGreaterThan(0)
    expect(legalMoves(s)).toHaveLength(0)
    expect(winner(s)).toBe('r')
  })

  it('returns null while both sides can still move', () => {
    expect(winner(newGame())).toBeNull()
  })
})

describe('AI', () => {
  it('easy returns a legal move chosen by the injected rng', () => {
    const s = newGame()
    const first = aiMove(s, 'easy', () => 0)
    const legal = legalMoves(s)
    expect(legal).toContainEqual(first)
    // rng near 1 selects the last legal move.
    const last = aiMove(s, 'easy', () => 0.999)
    expect(last).toEqual(legal[legal.length - 1])
  })

  it('easy takes the available capture (captures are the only legal moves)', () => {
    const rows = [...EMPTY]
    rows[4] = '...r....'
    rows[3] = '....b...'
    const mv = aiMove(st(rows), 'easy', () => 0)
    expect(mv?.captures).toEqual([[3, 4]])
  })

  it('hard (minimax) prefers a capturing line that wins material', () => {
    // Red to move can capture; the minimax move must be the capture.
    const rows = [...EMPTY]
    rows[5] = '..r.....'
    rows[4] = '...b....'
    const mv = aiMove(st(rows), 'hard', () => 0)
    expect(mv).not.toBeNull()
    expect(mv?.captures.length).toBeGreaterThan(0)
  })

  it('hard picks a genuinely winning capture over a quiet move on a real board', () => {
    // A free capture is available; hard must take it (material gain).
    const rows = [...EMPTY]
    rows[6] = '.r......' // red man at (6,1)
    rows[5] = '..b.....' // black man at (5,2) — capturable to (4,3)
    rows[1] = '......b.' // a distant black man so the game isn't already over
    const s = st(rows)
    const mv = aiMove(s, 'hard', () => 0)
    expect(mv?.captures).toEqual([[5, 2]])
  })

  it('returns null when the side to move has no move', () => {
    const rows = [...EMPTY]
    rows[7] = '.......b'
    expect(aiMove(st(rows, 'b'), 'hard', () => 0)).toBeNull()
  })
})

describe('no illegal moves are generated', () => {
  it('every generated move stays on the board, on dark squares, and matches piece rules', () => {
    const rows = [
      '.b.b.b.b',
      'b.b.b.b.',
      '.b.b.b.b',
      '..r.....',
      '...b....',
      'r.r.r.r.',
      '.r.r.r.r',
      'r.r.r.r.',
    ]
    for (const turn of ['r', 'b'] as const) {
      const s = st(rows, turn)
      for (const m of legalMoves(s)) {
        const from = m.from
        expect(s.board[from[0]][from[1]]?.color).toBe(turn)
        for (const [r, c] of m.path) {
          expect(r).toBeGreaterThanOrEqual(0)
          expect(r).toBeLessThan(SIZE)
          expect(c).toBeGreaterThanOrEqual(0)
          expect(c).toBeLessThan(SIZE)
          expect((r + c) % 2).toBe(1) // dark square
        }
        // Applying it never leaves the moving side's piece behind at origin.
        const next = applyMove(s, m)
        expect(next.board[from[0]][from[1]]).toBeNull()
        expect(next.turn).toBe(opponent(turn))
      }
    }
  })

  it('a blocked man produces no simple move but stays capturable-consistent', () => {
    const rows = [...EMPTY]
    rows[5] = '..r.....' // red at (5,2)
    rows[4] = '.r.r....' // reds at (4,1) and (4,3) block both forward diagonals
    const s = st(rows)
    // (5,2) has no forward square free; only the two upper reds can move.
    const froms = legalMoves(s).map((m) => m.from.join(','))
    expect(froms).not.toContain('5,2')
  })
})
