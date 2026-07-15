// Tic-Tac-Toe engine — pure & deterministic.
// The board is a flat array of 9 cells, indexed row-major:
//   0 1 2
//   3 4 5
//   6 7 8
// No Math.random here: the random ('easy') path takes an injected `rng`.

export type Mark = 'X' | 'O'
export type Cell = Mark | null
export type Board = Cell[] // length 9
export type Outcome = 'X' | 'O' | 'draw' | null
export type Difficulty = 'easy' | 'hard'
export type Rng = () => number

export interface GameState {
  board: Board
  turn: Mark // whose move it is next
  over: boolean
  winner: Outcome // 'X' | 'O' | 'draw' when finished, else null
  line: number[] | null // the three winning indices, when a side has won
}

// All eight three-in-a-row lines (rows, columns, diagonals).
export const LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

const other = (m: Mark): Mark => (m === 'X' ? 'O' : 'X')

/** The three indices of the winning line, or null if nobody has three-in-a-row. */
export function winningLine(board: Board): number[] | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return [a, b, c]
  }
  return null
}

/** Pure outcome of a board: a mark if won, 'draw' if full, else null (ongoing). */
export function outcome(board: Board): Outcome {
  const line = winningLine(board)
  if (line) return board[line[0]] as Mark
  return board.every((c) => c !== null) ? 'draw' : null
}

/** Contract helper: the winner of a state ('X' | 'O' | 'draw' | null). */
export function winner(state: GameState): Outcome {
  return outcome(state.board)
}

export function newGame(): GameState {
  return { board: Array<Cell>(9).fill(null), turn: 'X', over: false, winner: null, line: null }
}

export function emptyIndices(board: Board): number[] {
  const out: number[] = []
  for (let i = 0; i < board.length; i++) if (board[i] === null) out.push(i)
  return out
}

/**
 * Place the current player's mark at `index`. Illegal moves — out of range, an
 * occupied cell, or a finished game — return the same state reference unchanged.
 */
export function applyMove(state: GameState, index: number): GameState {
  if (state.over || index < 0 || index > 8 || state.board[index] !== null) return state
  const board = state.board.slice()
  board[index] = state.turn
  const line = winningLine(board)
  const result = outcome(board)
  return {
    board,
    turn: result ? state.turn : other(state.turn),
    over: result !== null,
    winner: result,
    line,
  }
}

// Negamax: score from the perspective of the player to move. A win is worth
// (10 - depth) so faster wins outrank slower ones; a loss is symmetric.
function negamax(board: Board, player: Mark, depth: number): number {
  const result = outcome(board)
  if (result === player) return 10 - depth
  if (result === other(player)) return depth - 10
  if (result === 'draw') return 0

  let best = -Infinity
  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue
    board[i] = player
    const score = -negamax(board, other(player), depth + 1)
    board[i] = null
    if (score > best) best = score
  }
  return best
}

/**
 * Optimal (unbeatable) move for the player to move, via minimax. Deterministic:
 * on ties it prefers the lowest index. Returns -1 if the board is full/finished.
 */
export function bestMove(state: GameState): number {
  if (state.over) return -1
  const board = state.board.slice()
  const player = state.turn
  let bestScore = -Infinity
  let bestIndex = -1
  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue
    board[i] = player
    const score = -negamax(board, other(player), 1)
    board[i] = null
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }
  return bestIndex
}

/** A uniformly random legal move using the injected rng. Returns -1 if none. */
export function randomMove(state: GameState, rng: Rng): number {
  const empty = emptyIndices(state.board)
  if (empty.length === 0) return -1
  return empty[Math.floor(rng() * empty.length)]
}

/**
 * Pick the computer's move for a difficulty: 'easy' plays a random legal move
 * (needs `rng`), 'hard' plays the minimax-optimal move.
 */
export function aiMove(state: GameState, difficulty: Difficulty, rng: Rng): number {
  return difficulty === 'hard' ? bestMove(state) : randomMove(state, rng)
}
