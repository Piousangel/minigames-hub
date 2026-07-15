// Standard American checkers (8x8 draughts) — pure, deterministic engine.
//
// Rules implemented:
// - 8x8 board, dark squares only, 12 pieces per side.
// - Men move/capture diagonally forward only; kings move/capture both ways.
// - Captures are jumps over an adjacent opponent piece onto the empty square
//   beyond. Multi-jumps (chained captures) are REQUIRED: a jump move continues
//   until the moving piece can jump no further, and `legalMoves` returns only
//   maximal chains.
// - CAPTURES ARE MANDATORY: if any capture exists for the side to move, every
//   non-capturing move is illegal (authentic American-checkers rule).
// - Promotion to king happens on reaching the far row. Per American rules, if a
//   man reaches the king row during a jump, it promotes and the turn ends (it
//   may not continue jumping as a king in the same move).
// - A side with no pieces, or with no legal move on its turn, loses.
//
// No Math.random here — the AI takes an injected `rng`.

export const SIZE = 8

export type Color = 'r' | 'b'
export type Difficulty = 'easy' | 'hard'
export type Rng = () => number

export interface Piece {
  color: Color
  king: boolean
}

export type Cell = Piece | null
/** Board is [row][col]; row 0 is the top, row SIZE-1 is the bottom. */
export type Board = Cell[][]

export interface GameState {
  board: Board
  /** Whose move it is. Player is 'r' (bottom) and moves first. */
  turn: Color
}

export type Coord = [number, number]

export interface Move {
  from: Coord
  /** Landing squares after each hop, in order; the last entry is the destination. */
  path: Coord[]
  /** Squares of the pieces captured, in order. Empty for a simple (non-jump) move. */
  captures: Coord[]
}

const KING_DIRS: readonly Coord[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]
// Men move "forward": red (bottom) moves up (row decreases), black moves down.
const MAN_DIRS: Record<Color, readonly Coord[]> = {
  r: [
    [-1, -1],
    [-1, 1],
  ],
  b: [
    [1, -1],
    [1, 1],
  ],
}

export const opponent = (c: Color): Color => (c === 'r' ? 'b' : 'r')

/** Dark (playable) squares. a1 (bottom-left) is dark, so parity is (r+c) odd. */
export const isDark = (r: number, c: number): boolean => (r + c) % 2 === 1

const inBounds = (r: number, c: number): boolean => r >= 0 && r < SIZE && c >= 0 && c < SIZE

const cloneBoard = (b: Board): Board => b.map((row) => row.map((cell) => (cell ? { ...cell } : null)))

/** Row a man of the given color promotes on. */
const promoRow = (c: Color): number => (c === 'r' ? 0 : SIZE - 1)

const isPromotion = (color: Color, king: boolean, row: number): boolean => !king && row === promoRow(color)

export function newGame(): GameState {
  const board: Board = Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null))
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isDark(r, c)) continue
      if (r <= 2) board[r][c] = { color: 'b', king: false }
      else if (r >= SIZE - 3) board[r][c] = { color: 'r', king: false }
    }
  }
  return { board, turn: 'r' }
}

export function countPieces(board: Board, color: Color): number {
  let n = 0
  for (const row of board) for (const cell of row) if (cell && cell.color === color) n++
  return n
}

export interface Counts {
  r: number
  b: number
  rKings: number
  bKings: number
}

export function counts(board: Board): Counts {
  const out: Counts = { r: 0, b: 0, rKings: 0, bKings: 0 }
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue
      if (cell.color === 'r') {
        out.r++
        if (cell.king) out.rKings++
      } else {
        out.b++
        if (cell.king) out.bKings++
      }
    }
  }
  return out
}

interface Chain {
  path: Coord[]
  captures: Coord[]
}

const inCaptured = (captured: Coord[], r: number, c: number): boolean =>
  captured.some(([cr, cc]) => cr === r && cc === c)

/**
 * Enumerate all maximal jump chains for a piece already lifted off `board` at
 * (r,c). Captured pieces remain on the working board (they still block landing
 * squares and cannot be jumped twice) and are removed only when the move is
 * applied. A man that reaches its promotion row stops (turn ends).
 */
function jumpChains(board: Board, r: number, c: number, color: Color, king: boolean, captured: Coord[]): Chain[] {
  const dirs = king ? KING_DIRS : MAN_DIRS[color]
  const results: Chain[] = []
  for (const [dr, dc] of dirs) {
    const mr = r + dr
    const mc = c + dc
    const lr = r + 2 * dr
    const lc = c + 2 * dc
    if (!inBounds(lr, lc)) continue
    const mid = board[mr][mc]
    if (!mid || mid.color === color) continue
    if (inCaptured(captured, mr, mc)) continue
    if (board[lr][lc] !== null) continue // landing must be empty
    const nextCaptured: Coord[] = [...captured, [mr, mc]]
    const step: Chain = { path: [[lr, lc]], captures: [[mr, mc]] }
    if (isPromotion(color, king, lr)) {
      // Promotes mid-jump — the turn ends here, no further jumps.
      results.push(step)
      continue
    }
    const further = jumpChains(board, lr, lc, color, king, nextCaptured)
    if (further.length === 0) {
      results.push(step)
    } else {
      for (const f of further) {
        results.push({ path: [[lr, lc], ...f.path], captures: [[mr, mc], ...f.captures] })
      }
    }
  }
  return results
}

/**
 * All legal moves for the side to move. If any capture exists, only captures are
 * returned (mandatory capture). Each jump move is a complete, maximal chain.
 */
export function legalMoves(state: GameState): Move[] {
  const { board, turn } = state
  const jumps: Move[] = []
  const simples: Move[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = board[r][c]
      if (!piece || piece.color !== turn) continue
      // Lift the piece so it can't block its own landing squares.
      const work = cloneBoard(board)
      work[r][c] = null
      const chains = jumpChains(work, r, c, turn, piece.king, [])
      for (const chain of chains) {
        jumps.push({ from: [r, c], path: chain.path, captures: chain.captures })
      }
      const dirs = piece.king ? KING_DIRS : MAN_DIRS[turn]
      for (const [dr, dc] of dirs) {
        const nr = r + dr
        const nc = c + dc
        if (inBounds(nr, nc) && board[nr][nc] === null) {
          simples.push({ from: [r, c], path: [[nr, nc]], captures: [] })
        }
      }
    }
  }
  return jumps.length > 0 ? jumps : simples
}

/** True when this side must capture (a jump is available). */
export function hasCapture(state: GameState): boolean {
  return legalMoves(state).some((m) => m.captures.length > 0)
}

/**
 * Apply a full move (including any multi-jump chain and promotion) and flip the
 * turn. Returns the SAME state (referentially) if `move` is malformed.
 */
export function applyMove(state: GameState, move: Move): GameState {
  const [fr, fc] = move.from
  const piece = state.board[fr][fc]
  if (!piece || piece.color !== state.turn || move.path.length === 0) return state
  const board = cloneBoard(state.board)
  board[fr][fc] = null
  for (const [cr, cc] of move.captures) board[cr][cc] = null
  const [tr, tc] = move.path[move.path.length - 1]
  const king = piece.king || isPromotion(piece.color, piece.king, tr)
  board[tr][tc] = { color: piece.color, king }
  return { board, turn: opponent(state.turn) }
}

/**
 * The winning color, or null if the game is not over. A side loses when it has
 * no pieces or, on its turn, no legal move.
 */
export function winner(state: GameState): Color | null {
  const r = countPieces(state.board, 'r')
  const b = countPieces(state.board, 'b')
  if (r === 0) return 'b'
  if (b === 0) return 'r'
  if (legalMoves(state).length === 0) return opponent(state.turn)
  return null
}

// ── AI ───────────────────────────────────────────────────────────────────────

const MAN_VALUE = 100
const KING_VALUE = 175
const WIN_SCORE = 1_000_000
const HARD_DEPTH = 4

/** Material + light positional score from `me`'s perspective. */
function evaluate(board: Board, me: Color): number {
  let score = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c]
      if (!cell) continue
      let v = cell.king ? KING_VALUE : MAN_VALUE
      // Nudge men toward promotion and reward central control slightly.
      if (!cell.king) {
        const advance = cell.color === 'r' ? SIZE - 1 - r : r
        v += advance * 2
      }
      const centerBonus = c === 0 || c === SIZE - 1 ? 0 : 2
      v += centerBonus
      score += cell.color === me ? v : -v
    }
  }
  return score
}

function search(state: GameState, depth: number, alpha: number, beta: number, me: Color): number {
  const r = countPieces(state.board, 'r')
  const b = countPieces(state.board, 'b')
  if (r === 0) return me === 'b' ? WIN_SCORE + depth : -(WIN_SCORE + depth)
  if (b === 0) return me === 'r' ? WIN_SCORE + depth : -(WIN_SCORE + depth)
  const moves = legalMoves(state)
  if (moves.length === 0) {
    // Side to move is stalemated and loses.
    return state.turn === me ? -(WIN_SCORE + depth) : WIN_SCORE + depth
  }
  if (depth === 0) return evaluate(state.board, me)

  if (state.turn === me) {
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

function pick(moves: Move[], rng: Rng): Move {
  return moves[Math.floor(rng() * moves.length)]
}

function easyMove(state: GameState, rng: Rng): Move | null {
  const moves = legalMoves(state)
  return moves.length ? pick(moves, rng) : null
}

function hardMove(state: GameState, rng: Rng): Move | null {
  const me = state.turn
  const moves = legalMoves(state)
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]
  let bestScore = -Infinity
  let best: Move[] = []
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
 * Choose a move for the computer. `easy` picks a random legal move; `hard` runs
 * a shallow alpha-beta minimax (material + king value). Returns null only if the
 * side to move has no legal move. `rng` is injected — no Math.random here.
 */
export function aiMove(state: GameState, difficulty: Difficulty, rng: Rng): Move | null {
  return difficulty === 'hard' ? hardMove(state, rng) : easyMove(state, rng)
}
