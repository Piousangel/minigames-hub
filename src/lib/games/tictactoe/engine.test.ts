import { describe, expect, it } from 'vitest'
import {
  aiMove,
  applyMove,
  bestMove,
  newGame,
  outcome,
  winner,
  winningLine,
  type Board,
  type GameState,
  type Mark,
} from './engine'

// Build a state from a compact board where '.' is empty. `turn` is whose move
// is next (defaults to 'X').
function stateOf(cells: string, turn: Mark = 'X'): GameState {
  const board: Board = cells.split('').map((c) => (c === 'X' || c === 'O' ? c : null))
  const line = winningLine(board)
  const result = outcome(board)
  return { board, turn, over: result !== null, winner: result, line }
}

// Play out a game where each side uses minimax, X starting.
function minimaxSelfPlay(): GameState {
  let s = newGame()
  while (!s.over) {
    const move = bestMove(s)
    s = applyMove(s, move)
  }
  return s
}

describe('winner / winningLine', () => {
  it('detects a row win', () => {
    const s = stateOf('XXX' + '.O.' + 'O..')
    expect(winner(s)).toBe('X')
    expect(s.line).toEqual([0, 1, 2])
  })

  it('detects a column win', () => {
    const s = stateOf('O.X' + 'O.X' + '..X')
    expect(winner(s)).toBe('X')
    expect(s.line).toEqual([2, 5, 8])
  })

  it('detects a diagonal win (top-left to bottom-right)', () => {
    const s = stateOf('O.O' + '.O.' + 'X.O', 'X')
    expect(winner(s)).toBe('O')
    expect(s.line).toEqual([0, 4, 8])
  })

  it('detects the anti-diagonal win', () => {
    const s = stateOf('X.O' + '.O.' + 'O.X')
    expect(winner(s)).toBe('O')
    expect(s.line).toEqual([2, 4, 6])
  })

  it('reports a draw on a full board with no line', () => {
    const s = stateOf('XOX' + 'XXO' + 'OXO')
    expect(winner(s)).toBe('draw')
    expect(s.line).toBeNull()
  })

  it('returns null for an ongoing game', () => {
    expect(winner(newGame())).toBeNull()
  })
})

describe('applyMove', () => {
  it('places the current mark and passes the turn', () => {
    const s = applyMove(newGame(), 4)
    expect(s.board[4]).toBe('X')
    expect(s.turn).toBe('O')
    expect(s.over).toBe(false)
  })

  it('rejects a move on an occupied cell (returns same reference)', () => {
    const s = applyMove(newGame(), 0)
    expect(applyMove(s, 0)).toBe(s)
  })

  it('rejects out-of-range indices', () => {
    const s = newGame()
    expect(applyMove(s, -1)).toBe(s)
    expect(applyMove(s, 9)).toBe(s)
  })

  it('rejects moves after the game is over', () => {
    const won = stateOf('XXX' + 'OO.' + '...', 'O')
    expect(won.over).toBe(true)
    expect(applyMove(won, 5)).toBe(won)
  })

  it('marks the game over and keeps the turn on a winning move', () => {
    // X to move with two in the top row; completing it wins.
    const s = applyMove(stateOf('XX.' + 'OO.' + '...', 'X'), 2)
    expect(s.winner).toBe('X')
    expect(s.over).toBe(true)
    expect(s.turn).toBe('X') // turn does not advance once finished
  })
})

describe('minimax (bestMove)', () => {
  it('takes an immediate winning move', () => {
    // X can win by playing index 2 (top row).
    const s = stateOf('XX.' + 'OO.' + '...', 'X')
    expect(bestMove(s)).toBe(2)
  })

  it('blocks the opponent’s immediate win', () => {
    // O threatens the top row (0,1); X must block at 2 rather than build its own.
    const s = stateOf('OO.' + 'X..' + 'X..', 'X')
    expect(bestMove(s)).toBe(2)
  })

  it('takes its own win instead of blocking when it can win now', () => {
    // X can win at 2; O also threatens the bottom row — winning still wins.
    const s = stateOf('XX.' + '...' + 'OO.', 'X')
    expect(bestMove(s)).toBe(2)
  })

  it('plays the center as the optimal reply to a corner opening', () => {
    const s = stateOf('X..' + '...' + '...', 'O')
    expect(bestMove(s)).toBe(4)
  })

  it('minimax vs minimax always ends in a draw', () => {
    const end = minimaxSelfPlay()
    expect(end.over).toBe(true)
    expect(end.winner).toBe('draw')
  })

  it('never loses: minimax as O survives every X opening', () => {
    // For each first move X can make, O playing minimax must never lose.
    for (let first = 0; first < 9; first++) {
      let s = applyMove(newGame(), first) // X plays `first`, now O to move
      while (!s.over) {
        s = applyMove(s, bestMove(s))
      }
      expect(s.winner === 'O' || s.winner === 'draw').toBe(true)
    }
  })
})

describe('aiMove', () => {
  it('easy picks a legal move using the injected rng', () => {
    // rng returns 0 → first empty cell (index 1) on this board.
    const s = stateOf('X.O' + '.X.' + 'O..', 'O')
    const move = aiMove(s, 'easy', () => 0)
    expect(s.board[move]).toBeNull()
    expect(move).toBe(1)
  })

  it('hard delegates to minimax (blocks a win)', () => {
    const s = stateOf('OO.' + 'X..' + 'X..', 'X')
    expect(aiMove(s, 'hard', () => 0)).toBe(2)
  })
})
