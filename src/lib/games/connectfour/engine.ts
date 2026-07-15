export const COLS = 7
export const ROWS = 6

export type Player = 'R' | 'Y'
export type Cell = Player | null
export type Rng = () => number
export type Difficulty = 'easy' | 'hard'

/** Board is [row][col]; row 0 is the top, row ROWS-1 is the bottom (gravity down). */
export type Board = Cell[][]

export interface GameState {
  board: Board
  /** Whose disc drops next. Player is always 'R' and moves first. */
  current: Player
}

export interface WinInfo {
  player: Player
  /** The four [row, col] cells that form the line, for highlighting. */
  cells: Array<[number, number]>
}

/** Columns searched center-out — better play and better alpha-beta pruning. */
const CENTER_ORDER = [3, 2, 4, 1, 5, 0, 6]
const DIRS: Array<[number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal ↘
  [1, -1], // diagonal ↙
]

export const opponent = (p: Player): Player => (p === 'R' ? 'Y' : 'R')

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null))
}

const cloneBoard = (b: Board): Board => b.map((r) => [...r])

export function newGame(): GameState {
  return { board: emptyBoard(), current: 'R' }
}

/** Lowest empty row in a column (discs stack from the bottom), or -1 if full. */
export function lowestEmptyRow(board: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (board[r][col] === null) return r
  return -1
}

export function validCols(board: Board): number[] {
  const out: number[] = []
  for (let c = 0; c < COLS; c++) if (board[0][c] === null) out.push(c)
  return out
}

export const isFull = (board: Board): boolean => board[0].every((c) => c !== null)

/** Returns the winning line for the first 4-in-a-row found, else null. */
export function winner(state: GameState): WinInfo | null {
  const b = state.board
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c]
      if (!p) continue
      for (const [dr, dc] of DIRS) {
        const cells: Array<[number, number]> = [[r, c]]
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k
          const nc = c + dc * k
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[nr][nc] !== p) break
          cells.push([nr, nc])
        }
        if (cells.length === 4) return { player: p, cells }
      }
    }
  }
  return null
}

export const isDraw = (state: GameState): boolean => !winner(state) && isFull(state.board)

/**
 * Drop the current player's disc into `col`. Returns a new state, or the SAME
 * state (referentially) when the move is illegal — column full or game over.
 */
export function dropDisc(state: GameState, col: number): GameState {
  if (winner(state) || isFull(state.board)) return state
  const row = lowestEmptyRow(state.board, col)
  if (row === -1) return state
  const board = cloneBoard(state.board)
  board[row][col] = state.current
  return { board, current: opponent(state.current) }
}

/** Place a disc for `player` in `col` on a fresh board copy (assumes col has room). */
function place(board: Board, col: number, player: Player): Board {
  const row = lowestEmptyRow(board, col)
  const next = cloneBoard(board)
  next[row][col] = player
  return next
}

/** True if dropping `player` into `col` completes a 4-in-a-row immediately. */
function winsWith(board: Board, col: number, player: Player): boolean {
  if (lowestEmptyRow(board, col) === -1) return false
  return winner({ board: place(board, col, player), current: player })?.player === player
}

// ── Heuristic evaluation (from `me`'s perspective) ───────────────────────────

function scoreWindow(cells: Cell[], me: Player): number {
  const opp = opponent(me)
  let mine = 0
  let theirs = 0
  for (const c of cells) {
    if (c === me) mine++
    else if (c === opp) theirs++
  }
  if (mine > 0 && theirs > 0) return 0 // mixed window — dead for both
  if (mine === 4) return 100000
  if (mine === 3) return 100
  if (mine === 2) return 10
  if (theirs === 4) return -100000
  if (theirs === 3) return -120 // weight blocking slightly above building
  if (theirs === 2) return -10
  return 0
}

function evaluate(board: Board, me: Player): number {
  let score = 0
  const center = Math.floor(COLS / 2)
  for (let r = 0; r < ROWS; r++) {
    if (board[r][center] === me) score += 6
    else if (board[r][center] === opponent(me)) score -= 6
  }
  const windows: Cell[][] = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++) windows.push([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]])
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++) windows.push([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]])
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      windows.push([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]])
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      windows.push([board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]])
  for (const w of windows) score += scoreWindow(w, me)
  return score
}

/** Negamax-style minimax with alpha-beta, scored from `me`'s perspective. */
function minimax(board: Board, depth: number, alpha: number, beta: number, me: Player, toMove: Player): number {
  const win = winner({ board, current: toMove })
  if (win) return win.player === me ? 100000 + depth : -(100000 + depth)
  if (isFull(board)) return 0
  if (depth === 0) return evaluate(board, me)

  const cols = CENTER_ORDER.filter((c) => board[0][c] === null)
  if (toMove === me) {
    let value = -Infinity
    for (const c of cols) {
      value = Math.max(value, minimax(place(board, c, toMove), depth - 1, alpha, beta, me, opponent(toMove)))
      alpha = Math.max(alpha, value)
      if (alpha >= beta) break
    }
    return value
  }
  let value = Infinity
  for (const c of cols) {
    value = Math.min(value, minimax(place(board, c, toMove), depth - 1, alpha, beta, me, opponent(toMove)))
    beta = Math.min(beta, value)
    if (beta <= alpha) break
  }
  return value
}

const HARD_DEPTH = 5

function easyMove(board: Board, rng: Rng): number {
  const valid = validCols(board)
  if (valid.length === 0) return -1
  return valid[Math.floor(rng() * valid.length)]
}

function hardMove(state: GameState, rng: Rng): number {
  const { board, current: me } = state
  const opp = opponent(me)
  const valid = validCols(board)
  if (valid.length === 0) return -1

  // 1. Take an immediate win.
  for (const c of CENTER_ORDER) if (valid.includes(c) && winsWith(board, c, me)) return c
  // 2. Block the opponent's immediate win.
  for (const c of CENTER_ORDER) if (valid.includes(c) && winsWith(board, c, opp)) return c

  // 3. Otherwise, shallow minimax (center-preferring, no obvious blunders).
  let bestScore = -Infinity
  let best: number[] = []
  for (const c of CENTER_ORDER) {
    if (!valid.includes(c)) continue
    const score = minimax(place(board, c, me), HARD_DEPTH - 1, -Infinity, Infinity, me, opp)
    if (score > bestScore) {
      bestScore = score
      best = [c]
    } else if (score === bestScore) {
      best.push(c)
    }
  }
  return best[Math.floor(rng() * best.length)]
}

/**
 * Choose a column for the computer. Returns the chosen column index (or -1 when
 * the board is full). `easy` picks a random valid column; `hard` takes any
 * immediate win, blocks the opponent's immediate win, else prefers the center
 * via a shallow minimax. `rng` is injected — no Math.random in this module.
 */
export function aiMove(state: GameState, difficulty: Difficulty, rng: Rng): number {
  return difficulty === 'hard' ? hardMove(state, rng) : easyMove(state.board, rng)
}
