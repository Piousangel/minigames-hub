// Standard Reversi / Othello (8x8) — pure, deterministic engine.
//
// Rules implemented:
// - 8x8 board. The four centre squares start filled: light on (3,3) & (4,4),
//   dark on (3,4) & (4,3). Dark ('D') moves first.
// - A move places a disc on an empty square that flanks one or more of the
//   opponent's discs in a straight line (any of the 8 directions) bounded by one
//   of the mover's own discs. Every flanked disc in every flanked direction is
//   flipped. A move that flips nothing is illegal.
// - Pass handling: if the side to move has no legal move, its turn passes to the
//   opponent (no disc placed). If NEITHER side can move, the game ends.
// - Result: whoever has more discs wins; equal counts is a tie.
//
// No Math.random here — the AI takes an injected `rng`.

export const SIZE = 8

export type Color = 'D' | 'L'
export type Difficulty = 'easy' | 'hard'
export type Rng = () => number

/** A single square: a disc colour, or null when empty. */
export type Cell = Color | null
/** Board is [row][col]; row 0 is the top. */
export type Board = Cell[][]

export type Coord = [number, number]

export interface GameState {
  board: Board
  /** Whose move it is. Player is 'D' (dark) and moves first. */
  turn: Color
}

export type Winner = Color | 'tie' | null

/** All 8 directions: orthogonal + diagonal. */
const DIRS: readonly Coord[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]

export const opponent = (c: Color): Color => (c === 'D' ? 'L' : 'D')

const inBounds = (r: number, c: number): boolean => r >= 0 && r < SIZE && c >= 0 && c < SIZE

const cloneBoard = (b: Board): Board => b.map((row) => [...row])

const emptyBoard = (): Board => Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null))

export function newGame(): GameState {
  const board = emptyBoard()
  board[3][3] = 'L'
  board[4][4] = 'L'
  board[3][4] = 'D'
  board[4][3] = 'D'
  return { board, turn: 'D' }
}

/**
 * Discs that would be flipped if `color` played at (r,c). Empty when the square
 * is occupied or the move flanks nothing (i.e. the move is illegal).
 */
export function flipsFor(board: Board, color: Color, cell: Coord): Coord[] {
  const [r, c] = cell
  if (!inBounds(r, c) || board[r][c] !== null) return []
  const foe = opponent(color)
  const flipped: Coord[] = []
  for (const [dr, dc] of DIRS) {
    const line: Coord[] = []
    let nr = r + dr
    let nc = c + dc
    while (inBounds(nr, nc) && board[nr][nc] === foe) {
      line.push([nr, nc])
      nr += dr
      nc += dc
    }
    // The line is captured only if it is non-empty and bounded by our own disc.
    if (line.length > 0 && inBounds(nr, nc) && board[nr][nc] === color) {
      for (const p of line) flipped.push(p)
    }
  }
  return flipped
}

/** All legal moves (cells) for `color` on `board`. */
export function legalMovesFor(board: Board, color: Color): Coord[] {
  const moves: Coord[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== null) continue
      if (flipsFor(board, color, [r, c]).length > 0) moves.push([r, c])
    }
  }
  return moves
}

/** Legal moves for the side to move. */
export function legalMoves(state: GameState): Coord[] {
  return legalMovesFor(state.board, state.turn)
}

export const hasAnyMove = (board: Board, color: Color): boolean =>
  legalMovesFor(board, color).length > 0

/**
 * Place a disc for the side to move and flip every flanked line, switching the
 * turn to the opponent. Returns the SAME state (referentially) when the move is
 * illegal (no disc flipped). Pass handling is separate — see `pass` / `winner`.
 */
export function applyMove(state: GameState, cell: Coord): GameState {
  const flips = flipsFor(state.board, state.turn, cell)
  if (flips.length === 0) return state
  const board = cloneBoard(state.board)
  board[cell[0]][cell[1]] = state.turn
  for (const [fr, fc] of flips) board[fr][fc] = state.turn
  return { board, turn: opponent(state.turn) }
}

/** Pass the turn without placing a disc (used when the side to move is stuck). */
export const pass = (state: GameState): GameState => ({ board: state.board, turn: opponent(state.turn) })

export interface Counts {
  D: number
  L: number
}

export function counts(board: Board): Counts {
  const out: Counts = { D: 0, L: 0 }
  for (const row of board) {
    for (const cell of row) {
      if (cell === 'D') out.D++
      else if (cell === 'L') out.L++
    }
  }
  return out
}

/** True when neither side has a legal move. */
export const isGameOver = (board: Board): boolean => !hasAnyMove(board, 'D') && !hasAnyMove(board, 'L')

/**
 * The winner, or null while the game is still going. The game ends only when
 * neither side can move; the majority of discs wins, equal counts is a tie.
 */
export function winner(state: GameState): Winner {
  if (!isGameOver(state.board)) return null
  const { D, L } = counts(state.board)
  if (D > L) return 'D'
  if (L > D) return 'L'
  return 'tie'
}

// ── AI ───────────────────────────────────────────────────────────────────────

// Classic Othello positional weights: corners are gold, the squares next to them
// (C/X squares) are traps that hand the opponent a corner.
const WEIGHTS: readonly number[][] = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120],
]

const HARD_DEPTH = 3
const WIN_SCORE = 1_000_000

/** Static evaluation from `me`'s perspective: positional weights + mobility. */
function evaluate(board: Board, me: Color): number {
  const foe = opponent(me)
  let positional = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c]
      if (cell === me) positional += WEIGHTS[r][c]
      else if (cell === foe) positional -= WEIGHTS[r][c]
    }
  }
  const myMoves = legalMovesFor(board, me).length
  const foeMoves = legalMovesFor(board, foe).length
  const mobility = myMoves + foeMoves === 0 ? 0 : (10 * (myMoves - foeMoves)) / (myMoves + foeMoves + 1)
  return positional + mobility
}

/** Terminal score (game already over) from `me`'s perspective. */
function terminalScore(board: Board, me: Color): number {
  const { D, L } = counts(board)
  const mine = me === 'D' ? D : L
  const theirs = me === 'D' ? L : D
  if (mine > theirs) return WIN_SCORE + (mine - theirs)
  if (theirs > mine) return -(WIN_SCORE + (theirs - mine))
  return 0
}

function search(state: GameState, depth: number, alpha: number, beta: number, me: Color): number {
  if (isGameOver(state.board)) return terminalScore(state.board, me)
  if (depth === 0) return evaluate(state.board, me)

  const moves = legalMoves(state)
  if (moves.length === 0) {
    // Side to move is stuck but the game isn't over → pass (no depth cost; the
    // opponent is guaranteed a move so this can't recurse forever).
    return search(pass(state), depth, alpha, beta, me)
  }

  const maximizing = state.turn === me
  if (maximizing) {
    let value = -Infinity
    for (const m of moves) {
      value = Math.max(value, search(applyMove(state, m), depth - 1, alpha, beta, me))
      alpha = Math.max(alpha, value)
      if (alpha >= beta) break
    }
    return value
  }
  let value = Infinity
  for (const m of moves) {
    value = Math.min(value, search(applyMove(state, m), depth - 1, alpha, beta, me))
    beta = Math.min(beta, value)
    if (beta <= alpha) break
  }
  return value
}

function pick(moves: Coord[], rng: Rng): Coord {
  return moves[Math.floor(rng() * moves.length)]
}

function easyMove(state: GameState, rng: Rng): Coord | null {
  const moves = legalMoves(state)
  return moves.length ? pick(moves, rng) : null
}

function hardMove(state: GameState, rng: Rng): Coord | null {
  const me = state.turn
  const moves = legalMoves(state)
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]
  let bestScore = -Infinity
  let best: Coord[] = []
  for (const m of moves) {
    const v = search(applyMove(state, m), HARD_DEPTH - 1, -Infinity, Infinity, me)
    if (v > bestScore) {
      bestScore = v
      best = [m]
    } else if (v === bestScore) {
      best.push(m)
    }
  }
  return pick(best, rng)
}

/**
 * Choose a move (cell) for the computer. `easy` picks a random legal move;
 * `hard` runs a shallow corner-weighted alpha-beta minimax. Returns null only
 * when the side to move has no legal move. `rng` is injected — no Math.random.
 */
export function aiMove(state: GameState, difficulty: Difficulty, rng: Rng): Coord | null {
  return difficulty === 'hard' ? hardMove(state, rng) : easyMove(state, rng)
}
