/**
 * Turntile — pure engine.
 *
 * A board of `rows x cols` two-faced tiles. A "block" is an overlapping 2x2
 * sliding window anchored at (i,j), 0 <= i <= rows-2, 0 <= j <= cols-2 —
 * NOT a non-overlapping partition. Overlap matters: flipping a block is a
 * point-symmetric swap (TL<->BR, TR<->BL) combined with a side-flip of the
 * four touched cells, and it is always an involution (flip twice on the same
 * anchor restores the exact prior state — positions swap back and sides flip
 * back). If blocks didn't overlap, each block's state would only ever have 2
 * possible values (a coin flip) and neighboring flips could never interact.
 * Because blocks DO overlap, one flip can simultaneously affect several
 * neighboring blocks' match status, which is what gives the puzzle depth and
 * what makes "combo" (multiple blocks locking from one flip) possible.
 *
 * Win condition: the entire board shows one single value. This is provable
 * equivalent to "every block matched" on a connected grid (rows,cols >= 2):
 * adjacent overlapping blocks share cells, so if two neighboring blocks are
 * both monochrome, the shared cell forces their colors to agree, and this
 * propagates transitively across the whole connected grid.
 *
 * Generation starts from an all-faceA (value 0) solved board and applies
 * `scramble` random flips. Since flipBlock is its own inverse, replaying the
 * exact same anchor sequence in reverse order always solves the board in
 * exactly `scramble` forward flips — so `par` is always achievable and there
 * is no losing/deadlock state: every anchor is always a legal flip target.
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters only through an injected `Rng`, used
 * solely in board generation. `computeFlip` and `reduce` consume no rng, so
 * every lock / combo / win / score outcome is golden-testable from a fixed
 * script.
 */

export type Rng = () => number // returns a float in [0,1)
export type Face = number // 0..symbols-1, pattern id

export interface Cell {
  faceA: Face
  faceB: Face
  currentSide: 0 | 1 // 0 = show faceA, 1 = show faceB
}

export type Board = Cell[] // length rows*cols, row-major: pos = r*cols + c

export interface TurntileConfig {
  rows: number
  cols: number
  symbols: number // S, 2..~6
  scramble: number // reverse-flip count applied at generation == par
}

export interface Anchor {
  i: number // 0..rows-2
  j: number // 0..cols-2
}

export type TurntileEvent = 'none' | 'flip' | 'lock' | 'combo' | 'win' | 'illegal'

export interface FlipOutcome {
  board: Board
  anchor: Anchor
  newlyLocked: Anchor[] // matched immediately after flip but not immediately before
  newlyUnlocked: Anchor[] // matched immediately before flip but not immediately after (info only, no penalty)
  totalLocked: number // # blocks matched after the flip
  totalBlocks: number // (rows-1)*(cols-1)
  won: boolean
  bonus: number // reducer is the source of truth for the final value; 0 at computeFlip stage
}

export interface TurntileState {
  config: TurntileConfig
  seed: number
  board: Board
  flips: number
  par: number
  score: number
  totalLocked: number // # blocks matched on the current board (render cache, kept in sync by reduce)
  bestCombo: number // largest newlyLocked.length seen from a single flip this game
  won: boolean
  lastEvent: TurntileEvent
  lastFlip: FlipOutcome | null
}

export type TurntileAction =
  | { type: 'flip'; i: number; j: number }
  | { type: 'reset' } // regenerate with the same seed
  | { type: 'new'; seed: number }

export const MAX_ANCHOR_RETRY = 10 // cap on re-rolling the anchor during scramble to avoid immediately undoing the previous flip
export const MAX_GEN_ATTEMPTS = 30 // cap on seed retries if a scramble accidentally lands already-solved
export const LOCK_BASE = 20 // base score unit per newly-locked block
export const WIN_BONUS = 1000
export const PAR_BONUS_MAX = 1000

export const DIFFICULTIES = {
  easy: { rows: 4, cols: 4, symbols: 3, scramble: 10 },
  normal: { rows: 5, cols: 5, symbols: 4, scramble: 18 },
  hard: { rows: 6, cols: 6, symbols: 5, scramble: 28 },
} satisfies Record<'easy' | 'normal' | 'hard', TurntileConfig>

export const DAILY_CONFIG: TurntileConfig = DIFFICULTIES.normal

/** Identical impl to the template's mulberry32. Duplicated deliberately — engines never import each other. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// -- Pure primitives --------------------------------------------------------

export function displayValue(cell: Cell): Face {
  return cell.currentSide === 0 ? cell.faceA : cell.faceB
}

/** (rows-1)*(cols-1) anchors, i outer loop, j inner loop, row-major order. */
export function blockAnchors(rows: number, cols: number): Anchor[] {
  const out: Anchor[] = []
  for (let i = 0; i <= rows - 2; i++) {
    for (let j = 0; j <= cols - 2; j++) {
      out.push({ i, j })
    }
  }
  return out
}

export function blockPositions(
  i: number,
  j: number,
  cols: number,
): [tl: number, tr: number, bl: number, br: number] {
  const tl = i * cols + j
  const tr = tl + 1
  const bl = (i + 1) * cols + j
  const br = bl + 1
  return [tl, tr, bl, br]
}

export function isBlockMatched(board: Board, i: number, j: number, cols: number): boolean {
  const [tl, tr, bl, br] = blockPositions(i, j, cols)
  const v = displayValue(board[tl])
  return (
    displayValue(board[tr]) === v && displayValue(board[bl]) === v && displayValue(board[br]) === v
  )
}

export function matchedBlocks(board: Board, rows: number, cols: number): Anchor[] {
  return blockAnchors(rows, cols).filter((a) => isBlockMatched(board, a.i, a.j, cols))
}

export function isSolved(board: Board): boolean {
  if (board.length === 0) return true
  const v = displayValue(board[0])
  for (let k = 1; k < board.length; k++) if (displayValue(board[k]) !== v) return false
  return true
}

/**
 * The engine's heart. Pure, immutable: returns a new array, never mutates
 * `board`. Cells outside the block keep their original object identity.
 * Point-symmetric swap: TL<->BR, TR<->BL, each swapped cell also gets its
 * `currentSide` flipped. This composition is always an involution.
 * No bounds checking — caller's responsibility.
 */
export function flipBlock(board: Board, i: number, j: number, cols: number): Board {
  const [tl, tr, bl, br] = blockPositions(i, j, cols)
  const newBoard = board.slice()
  const cellTL = board[tl]
  const cellTR = board[tr]
  const cellBL = board[bl]
  const cellBR = board[br]
  newBoard[tl] = { ...cellBR, currentSide: cellBR.currentSide === 0 ? 1 : 0 }
  newBoard[tr] = { ...cellBL, currentSide: cellBL.currentSide === 0 ? 1 : 0 }
  newBoard[bl] = { ...cellTR, currentSide: cellTR.currentSide === 0 ? 1 : 0 }
  newBoard[br] = { ...cellTL, currentSide: cellTL.currentSide === 0 ? 1 : 0 }
  return newBoard
}

/**
 * Full outcome of flipping block (i,j). Returns null when out of range.
 * Never mutates the input board. Consumes no rng.
 */
export function computeFlip(
  board: Board,
  i: number,
  j: number,
  rows: number,
  cols: number,
): FlipOutcome | null {
  if (i < 0 || i > rows - 2 || j < 0 || j > cols - 2) return null

  const before = matchedBlocks(board, rows, cols)
  const beforeSet = new Set(before.map((a) => `${a.i},${a.j}`))
  const newBoard = flipBlock(board, i, j, cols)
  const after = matchedBlocks(newBoard, rows, cols)
  const afterSet = new Set(after.map((a) => `${a.i},${a.j}`))

  const newlyLocked = after.filter((a) => !beforeSet.has(`${a.i},${a.j}`))
  const newlyUnlocked = before.filter((a) => !afterSet.has(`${a.i},${a.j}`))
  const totalBlocks = (rows - 1) * (cols - 1)

  return {
    board: newBoard,
    anchor: { i, j },
    newlyLocked,
    newlyUnlocked,
    totalLocked: after.length,
    totalBlocks,
    won: isSolved(newBoard),
    bonus: 0,
  }
}

// -- Board generation via reverse (self-inverse) flips ----------------------

export function generateBoard(cfg: TurntileConfig, rng: Rng): { board: Board; par: number } {
  const { rows, cols, symbols, scramble } = cfg
  const board: Board = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const faceB = Math.floor(rng() * symbols)
      board.push({ faceA: 0, faceB, currentSide: 0 })
    }
  }

  let current = board
  let lastAnchor: Anchor | null = null
  for (let step = 0; step < scramble; step++) {
    let i = Math.floor(rng() * (rows - 1))
    let j = Math.floor(rng() * (cols - 1))
    let retries = 0
    while (lastAnchor && i === lastAnchor.i && j === lastAnchor.j && retries < MAX_ANCHOR_RETRY) {
      i = Math.floor(rng() * (rows - 1))
      j = Math.floor(rng() * (cols - 1))
      retries++
    }
    current = flipBlock(current, i, j, cols)
    lastAnchor = { i, j }
  }

  return { board: current, par: scramble }
}

export function createGame(cfg: TurntileConfig, seed: number): TurntileState {
  let useSeed = seed
  let result = generateBoard(cfg, mulberry32(useSeed))
  let attempts = 0
  while (isSolved(result.board) && attempts < MAX_GEN_ATTEMPTS) {
    useSeed = (useSeed + 1) >>> 0
    result = generateBoard(cfg, mulberry32(useSeed))
    attempts++
  }
  return {
    config: cfg,
    seed,
    board: result.board,
    flips: 0,
    par: result.par,
    score: 0,
    totalLocked: matchedBlocks(result.board, cfg.rows, cfg.cols).length,
    bestCombo: 0,
    // MAX_GEN_ATTEMPTS 재시도를 다 써도 여전히 solved면(사실상 도달 불가) won도 정직하게 반영한다.
    won: isSolved(result.board),
    lastEvent: 'none',
    lastFlip: null,
  }
}

// -- Reducer ----------------------------------------------------------------

export function reduce(state: TurntileState, action: TurntileAction): TurntileState {
  switch (action.type) {
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    case 'flip': {
      if (state.won) return { ...state, lastEvent: 'none' }
      const { rows, cols } = state.config
      const outcome = computeFlip(state.board, action.i, action.j, rows, cols)
      if (outcome === null) {
        return { ...state, lastEvent: 'illegal', lastFlip: null }
      }

      const n = outcome.newlyLocked.length
      const bonus = LOCK_BASE * n * n
      let score = state.score + bonus
      const flips = state.flips + 1
      const won = outcome.won
      let event: TurntileEvent = n === 0 ? 'flip' : n === 1 ? 'lock' : 'combo'

      if (won) {
        const parBonus = Math.round(PAR_BONUS_MAX * Math.min(1, state.par / Math.max(1, flips)))
        score += WIN_BONUS + parBonus
        event = 'win'
      }

      const bestCombo = Math.max(state.bestCombo, n)

      return {
        ...state,
        board: outcome.board,
        flips,
        score,
        totalLocked: outcome.totalLocked,
        bestCombo,
        won,
        lastEvent: event,
        lastFlip: { ...outcome, bonus },
      }
    }
    default:
      return state
  }
}
