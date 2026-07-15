import { describe, expect, it } from 'vitest'
import {
  aiMove,
  dropDisc,
  isDraw,
  lowestEmptyRow,
  newGame,
  opponent,
  winner,
  type Board,
  type GameState,
  type Player,
} from './engine'

// Parse a board from 6 rows of 7 chars: '.' empty, 'R' red (player), 'Y' yellow (cpu).
function parse(rows: string[]): Board {
  return rows.map((line) =>
    [...line].map((ch) => (ch === 'R' ? 'R' : ch === 'Y' ? 'Y' : null)) as Board[number],
  )
}
const st = (rows: string[], current: Player = 'R'): GameState => ({ board: parse(rows), current })

const EMPTY = ['.......', '.......', '.......', '.......', '.......', '.......']

describe('dropDisc — stacking & gravity', () => {
  it('drops a disc into the lowest empty row of a column', () => {
    const s = dropDisc(st(EMPTY), 3)
    expect(s.board[5][3]).toBe('R') // bottom row
    expect(s.board[4][3]).toBeNull()
  })

  it('stacks the next disc directly on top of the previous one', () => {
    let s = st(EMPTY)
    s = dropDisc(s, 3) // R at row 5
    s = dropDisc(s, 3) // Y at row 4
    expect(s.board[5][3]).toBe('R')
    expect(s.board[4][3]).toBe('Y')
  })

  it('alternates the current player after each drop', () => {
    const s0 = newGame()
    expect(s0.current).toBe('R')
    const s1 = dropDisc(s0, 0)
    expect(s1.current).toBe('Y')
    expect(dropDisc(s1, 1).current).toBe('R')
  })

  it('rejects a drop into a full column (returns the same state)', () => {
    const full = st(['...R...', '...Y...', '...R...', '...Y...', '...R...', '...Y...'])
    expect(lowestEmptyRow(full.board, 3)).toBe(-1)
    expect(dropDisc(full, 3)).toBe(full)
  })

  it('ignores drops once the game is already won', () => {
    const won = st(['.......', '.......', '.......', '.......', '.......', 'RRRR...'], 'Y')
    expect(dropDisc(won, 6)).toBe(won)
  })
})

describe('winner — line detection', () => {
  it('detects a horizontal four-in-a-row', () => {
    const w = winner(st(['.......', '.......', '.......', '.......', '.......', '.RRRR..']))
    expect(w?.player).toBe('R')
    expect(w?.cells).toHaveLength(4)
  })

  it('detects a vertical four-in-a-row', () => {
    const w = winner(st(['.......', '.......', '..Y....', '..Y....', '..Y....', '..Y....']))
    expect(w?.player).toBe('Y')
  })

  it('detects a ↘ diagonal four-in-a-row', () => {
    const w = winner(
      st(['.......', '.......', 'R......', 'YR.....', 'YYR....', 'YYYR...']),
    )
    expect(w?.player).toBe('R')
    expect(w?.cells).toEqual([
      [2, 0],
      [3, 1],
      [4, 2],
      [5, 3],
    ])
  })

  it('detects a ↙ (anti) diagonal four-in-a-row', () => {
    const w = winner(
      st(['.......', '.......', '...R...', '..RY...', '.RYY...', 'RYYY...']),
    )
    expect(w?.player).toBe('R')
  })

  it('returns null when there is no line', () => {
    expect(winner(st(['.......', '.......', '.......', '.......', '.......', 'RRYR...']))).toBeNull()
  })
})

describe('draw detection', () => {
  it('reports a draw when the board is full with no line', () => {
    const drawBoard = st([
      'RYRYRYR',
      'RYRYRYR',
      'YRYRYRY',
      'YRYRYRY',
      'RYRYRYR',
      'RYRYRYR',
    ])
    expect(winner(drawBoard)).toBeNull()
    expect(isDraw(drawBoard)).toBe(true)
  })

  it('is not a draw while empty cells remain', () => {
    expect(isDraw(st(EMPTY))).toBe(false)
  })
})

describe('aiMove — easy', () => {
  it('returns a valid column chosen via the injected rng', () => {
    const s = newGame()
    expect(aiMove(s, 'easy', () => 0)).toBe(0) // validCols[0]
    expect(aiMove(s, 'easy', () => 0.99)).toBe(6) // validCols[last]
  })

  it('never picks a full column', () => {
    const s = st(['YYYY.YY', 'RRRR.RR', 'YYYY.YY', 'RRRR.RR', 'YYYY.YY', 'RRRR.RR'], 'Y')
    // Only column 4 has room.
    expect(aiMove(s, 'easy', () => 0)).toBe(4)
    expect(aiMove(s, 'easy', () => 0.99)).toBe(4)
  })
})

describe('aiMove — hard', () => {
  it('takes an immediate win when one is available', () => {
    // Yellow (to move) has three in a row on the bottom; col 3 completes it.
    const s = st(['.......', '.......', '.......', '.......', '.......', 'YYY....'], 'Y')
    expect(aiMove(s, 'hard', () => 0)).toBe(3)
  })

  it("blocks the opponent's immediate win", () => {
    // Red threatens to win at col 3; Yellow (to move) must block there.
    const s = st(['.......', '.......', '.......', '.......', '.......', 'RRR....'], 'Y')
    expect(aiMove(s, 'hard', () => 0)).toBe(3)
  })

  it('prefers the center on an empty board', () => {
    expect(aiMove(newGame(), 'hard', () => 0)).toBe(Math.floor(7 / 2))
  })

  it('prefers winning immediately over merely blocking', () => {
    // Yellow can complete its bottom row at col 3; Red separately threatens a
    // vertical win at col 5. A winning move must beat a blocking one.
    const s = st(['.......', '.......', '.....R.', '.....R.', '.....R.', 'YYY....'], 'Y')
    expect(aiMove(s, 'hard', () => 0)).toBe(3)
  })
})

describe('opponent', () => {
  it('flips the player', () => {
    expect(opponent('R')).toBe('Y')
    expect(opponent('Y')).toBe('R')
  })
})
