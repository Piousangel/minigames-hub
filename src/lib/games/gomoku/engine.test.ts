import { describe, it, expect } from 'vitest'
import {
  aiMove,
  candidateCells,
  CELLS,
  CENTER,
  checkWin,
  idx,
  mulberry32,
  newGame,
  place,
  SIZE,
  type State,
} from './engine'

const seeded = () => mulberry32(12345)

/** Build a State from a board, inferring moves; game assumed still playing. */
function stateFrom(board: number[], turn: 1 | 2): State {
  const moves = board.filter((v) => v !== 0).length
  return { board, turn, status: 'playing', winner: null, winLine: null, moves, last: null }
}

/** Apply a scripted list of indices, alternating from the start turn. */
function playAll(indices: number[]): State {
  let s = newGame()
  for (const i of indices) s = place(s, i)
  return s
}

describe('newGame', () => {
  it('is an empty 225-cell board, Black to move', () => {
    const s = newGame()
    expect(s.board).toHaveLength(CELLS)
    expect(s.board.every((v) => v === 0)).toBe(true)
    expect(s.turn).toBe(1)
    expect(s.status).toBe('playing')
    expect(s.winner).toBeNull()
    expect(s.winLine).toBeNull()
    expect(s.moves).toBe(0)
    expect(s.last).toBeNull()
  })
  it('CENTER is the middle intersection (7,7)', () => {
    expect(CENTER).toBe(idx(7, 7))
    expect(SIZE).toBe(15)
  })
})

describe('place — basics', () => {
  it('places the mover’s stone and advances the turn', () => {
    const s = place(newGame(), idx(7, 7))
    expect(s.board[idx(7, 7)]).toBe(1)
    expect(s.turn).toBe(2)
    expect(s.moves).toBe(1)
    expect(s.last).toBe(idx(7, 7))
  })
  it('alternates Black → White → Black', () => {
    const s = playAll([idx(7, 7), idx(7, 8), idx(8, 8)])
    expect(s.board[idx(7, 7)]).toBe(1)
    expect(s.board[idx(7, 8)]).toBe(2)
    expect(s.board[idx(8, 8)]).toBe(1)
    expect(s.turn).toBe(2)
    expect(s.moves).toBe(3)
  })
  it('does not mutate the source state', () => {
    const a = newGame()
    const b = place(a, idx(0, 0))
    expect(a.board[idx(0, 0)]).toBe(0)
    expect(a.moves).toBe(0)
    expect(b).not.toBe(a)
    expect(b.board).not.toBe(a.board)
  })
})

describe('place — rejection is a `===` no-op', () => {
  it('rejects an occupied cell', () => {
    const s = place(newGame(), idx(3, 3))
    expect(place(s, idx(3, 3))).toBe(s)
  })
  it('rejects a negative index', () => {
    const s = newGame()
    expect(place(s, -1)).toBe(s)
  })
  it('rejects an index >= 225', () => {
    const s = newGame()
    expect(place(s, CELLS)).toBe(s)
    expect(place(s, 999)).toBe(s)
  })
  it('rejects a non-integer index', () => {
    const s = newGame()
    expect(place(s, 3.5)).toBe(s)
    expect(place(s, NaN)).toBe(s)
  })
  it('rejects any move once the game is over', () => {
    // Black wins on row 0.
    const s = playAll([
      idx(0, 0), idx(1, 0),
      idx(0, 1), idx(1, 1),
      idx(0, 2), idx(1, 2),
      idx(0, 3), idx(1, 3),
      idx(0, 4), // Black's 5th → win
    ])
    expect(s.status).toBe('won')
    expect(place(s, idx(5, 5))).toBe(s)
  })
})

describe('checkWin — exact detection', () => {
  const line = (cells: [number, number][], player: number) => {
    const board = new Array<number>(CELLS).fill(0)
    for (const [r, c] of cells) board[idx(r, c)] = player
    return board
  }

  it('detects a horizontal five', () => {
    const cells: [number, number][] = [[5, 3], [5, 4], [5, 5], [5, 6], [5, 7]]
    const board = line(cells, 1)
    const win = checkWin(board, idx(5, 5), 1)
    expect(win).not.toBeNull()
    expect(win).toEqual(cells.map(([r, c]) => idx(r, c)).sort((a, b) => a - b))
  })
  it('detects a vertical five', () => {
    const cells: [number, number][] = [[2, 6], [3, 6], [4, 6], [5, 6], [6, 6]]
    const board = line(cells, 2)
    const win = checkWin(board, idx(4, 6), 2)
    expect(win).toEqual(cells.map(([r, c]) => idx(r, c)))
  })
  it('detects a diagonal ↘ five', () => {
    const cells: [number, number][] = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]
    const board = line(cells, 1)
    const win = checkWin(board, idx(3, 3), 1)
    expect(win).toEqual(cells.map(([r, c]) => idx(r, c)).sort((a, b) => a - b))
  })
  it('detects an anti-diagonal ↙ five', () => {
    const cells: [number, number][] = [[1, 9], [2, 8], [3, 7], [4, 6], [5, 5]]
    const board = line(cells, 2)
    const win = checkWin(board, idx(3, 7), 2)
    expect(win).not.toBeNull()
    expect(new Set(win!)).toEqual(new Set(cells.map(([r, c]) => idx(r, c))))
  })
  it('detects a five whose placed cell is in the MIDDLE (not the end)', () => {
    const cells: [number, number][] = [[8, 2], [8, 3], [8, 4], [8, 5], [8, 6]]
    const board = line(cells, 1)
    const win = checkWin(board, idx(8, 4), 1) // middle cell
    expect(win).toEqual(cells.map(([r, c]) => idx(r, c)))
  })
  it('does NOT count a run of four', () => {
    const cells: [number, number][] = [[5, 3], [5, 4], [5, 5], [5, 6]]
    const board = line(cells, 1)
    expect(checkWin(board, idx(5, 5), 1)).toBeNull()
  })
  it('counts an overline of six (freestyle) as a win', () => {
    const cells: [number, number][] = [[7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7]]
    const board = line(cells, 1)
    const win = checkWin(board, idx(7, 5), 1)
    expect(win).not.toBeNull()
    expect(win!.length).toBeGreaterThanOrEqual(5)
  })
  it('does NOT wrap around the row edge', () => {
    // Cols 13,14 of row 4 and cols 0,1,2 of row 5 — contiguous in flat index
    // but NOT a real line.
    const board = new Array<number>(CELLS).fill(0)
    for (const i of [idx(4, 13), idx(4, 14), idx(5, 0), idx(5, 1), idx(5, 2)]) board[i] = 1
    expect(checkWin(board, idx(4, 14), 1)).toBeNull()
    expect(checkWin(board, idx(5, 0), 1)).toBeNull()
  })
})

describe('place — win / draw resolution', () => {
  it('sets status/winner/winLine on a Black win and keeps the turn on the winner', () => {
    const s = playAll([
      idx(7, 3), idx(8, 3),
      idx(7, 4), idx(8, 4),
      idx(7, 5), idx(8, 5),
      idx(7, 6), idx(8, 6),
      idx(7, 7), // Black completes the horizontal five
    ])
    expect(s.status).toBe('won')
    expect(s.winner).toBe(1)
    expect(s.turn).toBe(1) // not advanced past the winner
    expect(s.winLine).toEqual([idx(7, 3), idx(7, 4), idx(7, 5), idx(7, 6), idx(7, 7)])
  })
  it('a scripted diagonal game ends with the right winLine', () => {
    const s = playAll([
      idx(2, 2), idx(0, 5),
      idx(3, 3), idx(0, 6),
      idx(4, 4), idx(0, 7),
      idx(5, 5), idx(0, 8),
      idx(6, 6), // Black five on the ↘ diagonal
    ])
    expect(s.winner).toBe(1)
    expect(s.winLine).toEqual([idx(2, 2), idx(3, 3), idx(4, 4), idx(5, 5), idx(6, 6)])
  })
  it('detects a White win too', () => {
    const s = playAll([
      idx(0, 0), idx(9, 0),
      idx(0, 1), idx(9, 1),
      idx(0, 2), idx(9, 2),
      idx(0, 3), idx(9, 3),
      idx(1, 0), idx(9, 4), // White completes five on row 9
    ])
    expect(s.status).toBe('won')
    expect(s.winner).toBe(2)
  })
  it('declares a draw when the board fills with no five', () => {
    // A deterministic 2-colouring proven five-free in every direction:
    // color = ((2r + c) mod 7) < 3. Fill it, then re-play the final cell through
    // `place` to hit the draw branch.
    const board = new Array<number>(CELLS).fill(0)
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        board[idx(r, c)] = (2 * r + c) % 7 < 3 ? 1 : 2
      }
    }
    // Sanity: the assembled board truly has no five anywhere.
    for (let i = 0; i < CELLS; i++) expect(checkWin(board, i, board[i])).toBeNull()

    const lastColor = board[CELLS - 1] as 1 | 2
    const pre = board.slice()
    pre[CELLS - 1] = 0
    const s: State = {
      board: pre,
      turn: lastColor,
      status: 'playing',
      winner: null,
      winLine: null,
      moves: CELLS - 1,
      last: CELLS - 2,
    }
    const done = place(s, CELLS - 1)
    expect(done.status).toBe('draw')
    expect(done.winner).toBeNull()
    expect(done.moves).toBe(CELLS)
  })
})

describe('candidateCells', () => {
  it('is empty on an empty board', () => {
    expect(candidateCells(new Array<number>(CELLS).fill(0))).toEqual([])
  })
  it('returns only empty cells within distance 2 of a stone, ascending', () => {
    const board = new Array<number>(CELLS).fill(0)
    board[idx(7, 7)] = 1
    const cands = candidateCells(board)
    expect(cands.length).toBeGreaterThan(0)
    expect(cands).not.toContain(idx(7, 7)) // occupied excluded
    expect(cands).toContain(idx(7, 8))
    expect(cands).toContain(idx(5, 5)) // distance-2 corner
    expect(cands).not.toContain(idx(0, 0)) // far away
    const sorted = [...cands].sort((a, b) => a - b)
    expect(cands).toEqual(sorted)
    for (const c of cands) expect(board[c]).toBe(0)
  })
})

describe('aiMove', () => {
  it('opens in the center on an empty board', () => {
    expect(aiMove(newGame(), 1, 'medium', seeded())).toBe(CENTER)
  })

  it('always returns a legal empty cell', () => {
    const board = new Array<number>(CELLS).fill(0)
    board[idx(7, 7)] = 1
    board[idx(7, 8)] = 2
    const s = stateFrom(board, 1)
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const m = aiMove(s, 1, d, seeded())
      expect(m).toBeGreaterThanOrEqual(0)
      expect(m).toBeLessThan(CELLS)
      expect(board[m]).toBe(0)
    }
  })

  it('takes an immediate win when one is available', () => {
    // Black (AI) has four in a row on row 7, open on the right at (7,7).
    const board = new Array<number>(CELLS).fill(0)
    for (const c of [3, 4, 5, 6]) board[idx(7, c)] = 1
    board[idx(0, 0)] = 2 // a lone White stone somewhere
    const s = stateFrom(board, 1)
    for (const d of ['easy', 'medium', 'hard'] as const) {
      expect(aiMove(s, 1, d, seeded())).toBe(idx(7, 7))
    }
  })

  it('blocks the opponent’s four-in-a-row (all difficulties)', () => {
    // White (opponent) has four on row 7: cols 3-6, blocked left, open right.
    // The only winning cell for White is (7,7) — AI (Black) must take it.
    const board = new Array<number>(CELLS).fill(0)
    for (const c of [3, 4, 5, 6]) board[idx(7, c)] = 2
    board[idx(7, 2)] = 1 // block the left side so (7,7) is the sole threat
    board[idx(0, 0)] = 1
    const s = stateFrom(board, 1)
    for (const d of ['easy', 'medium', 'hard'] as const) {
      expect(aiMove(s, 1, d, seeded())).toBe(idx(7, 7))
    }
  })

  it('blocks a four with two open ends by playing one of the two winning cells', () => {
    const board = new Array<number>(CELLS).fill(0)
    for (const c of [4, 5, 6, 7]) board[idx(8, c)] = 2 // open four, ends (8,3)/(8,8)
    board[idx(0, 0)] = 1
    const s = stateFrom(board, 1)
    const m = aiMove(s, 1, 'hard', seeded())
    expect([idx(8, 3), idx(8, 8)]).toContain(m)
  })

  it('prefers its own win over blocking the opponent', () => {
    // Both sides threaten five: Black completing (7,7) wins immediately; White
    // threatens (9,7). The AI must take its own win.
    const board = new Array<number>(CELLS).fill(0)
    for (const c of [3, 4, 5, 6]) board[idx(7, c)] = 1 // Black four → win at (7,7)
    for (const c of [3, 4, 5, 6]) board[idx(9, c)] = 2 // White four → win at (9,7)
    const s = stateFrom(board, 1)
    expect(aiMove(s, 1, 'hard', seeded())).toBe(idx(7, 7))
  })

  it('is deterministic given a fixed rng', () => {
    const board = new Array<number>(CELLS).fill(0)
    board[idx(7, 7)] = 1
    board[idx(6, 8)] = 2
    board[idx(8, 6)] = 1
    const s = stateFrom(board, 2)
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const a = aiMove(s, 2, d, mulberry32(999))
      const b = aiMove(s, 2, d, mulberry32(999))
      expect(a).toBe(b)
    }
  })

  it('a full AI-vs-AI game terminates in a win or draw', () => {
    let s = newGame()
    let guard = 0
    while (s.status === 'playing' && guard < CELLS + 5) {
      const m = aiMove(s, s.turn, 'medium', mulberry32(7 + guard))
      const next = place(s, m)
      expect(next).not.toBe(s) // AI always returns a legal move
      s = next
      guard++
    }
    expect(s.status === 'won' || s.status === 'draw').toBe(true)
  })
})

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('produces floats in [0,1)', () => {
    const r = mulberry32(1)
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
