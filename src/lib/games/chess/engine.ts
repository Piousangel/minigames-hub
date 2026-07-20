/**
 * Chess — full standard-rules pure engine (0x88 board representation).
 *
 * CORRECTNESS IS PARAMOUNT. Move generation is validated by perft tests
 * (see engine.test.ts): startpos d1..d4 = 20/400/8902/197281 and the Kiwipete
 * position d1/d2 = 48/2039. If those numbers are off by even one, the generator
 * is wrong.
 *
 * PURITY: every function here is pure and total. No `Math.random`, no `Date`,
 * no timers. Randomness enters ONLY through an injected `Rng` (consumed by the
 * AI tie-breaking). `applyMove` is (state) -> new state; the input is untouched.
 * This is what makes perft + deterministic AI testing possible.
 *
 * Board: a length-128 array using the classic 0x88 layout. A square index is
 * `rank * 16 + file` (rank 0 = white's home rank "1", rank 7 = black's "8").
 * `index & 0x88` is non-zero exactly for off-board indices, which makes ray and
 * leaper move generation branch-free at the edges. Pieces are signed integers:
 * white positive, black negative; magnitude is the type (see constants).
 */

// -- Piece codes -------------------------------------------------------------

export const EMPTY = 0
export const PAWN = 1
export const KNIGHT = 2
export const BISHOP = 3
export const ROOK = 4
export const QUEEN = 5
export const KING = 6

export type Color = 'w' | 'b'
export type Rng = () => number // float in [0,1)
export type Difficulty = 'easy' | 'medium' | 'hard'

// Castling-right bit flags.
export const CR_WK = 1 // white  king-side  (h1 rook)
export const CR_WQ = 2 // white queen-side  (a1 rook)
export const CR_BK = 4 // black  king-side  (h8 rook)
export const CR_BQ = 8 // black queen-side  (a8 rook)

export interface Move {
  from: number // 0x88 square
  to: number // 0x88 square
  piece: number // signed moving piece
  captured: number // signed captured piece (0 = none); for en passant, the enemy pawn
  promotion: number // promoted-to type (KNIGHT..QUEEN) or 0
  flag: 'n' | 'ep' | 'castle' | 'double' // normal, en-passant, castling, double pawn push
  rookFrom?: number // castling only
  rookTo?: number // castling only
}

export interface State {
  board: number[] // length 128, 0x88
  turn: Color
  castling: number // bitmask of CR_*
  ep: number // en-passant TARGET square (the empty square behind a double push), or -1
  half: number // halfmove clock (for 50-move rule)
  full: number // fullmove number
  history: string[] // repetition keys of every position reached (incl. the current one)
}

// -- 0x88 helpers ------------------------------------------------------------

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function sq(rank: number, file: number): number {
  return rank * 16 + file
}
export function rankOf(s: number): number {
  return s >> 4
}
export function fileOf(s: number): number {
  return s & 7
}
export function onBoard(s: number): boolean {
  return (s & 0x88) === 0
}
export function squareName(s: number): string {
  return 'abcdefgh'[fileOf(s)] + (rankOf(s) + 1)
}
export function parseSquare(name: string): number {
  return sq(name.charCodeAt(1) - 49, name.charCodeAt(0) - 97)
}

const KNIGHT_DELTAS = [33, 31, 18, 14, -14, -18, -31, -33]
const KING_DELTAS = [16, 17, 15, 1, -1, -16, -15, -17]
const BISHOP_DELTAS = [17, 15, -15, -17]
const ROOK_DELTAS = [16, 1, -1, -16]

function typeOf(code: number): number {
  return code < 0 ? -code : code
}
function colorSign(turn: Color): number {
  return turn === 'w' ? 1 : -1
}
function isOwn(code: number, us: number): boolean {
  return code * us > 0
}
function isEnemy(code: number, us: number): boolean {
  return code * us < 0
}

// -- Piece <-> FEN char ------------------------------------------------------

const TYPE_TO_CHAR = ['', 'p', 'n', 'b', 'r', 'q', 'k']

export function pieceToChar(code: number): string {
  if (code === 0) return '.'
  const ch = TYPE_TO_CHAR[typeOf(code)]
  return code > 0 ? ch.toUpperCase() : ch
}

function charToPiece(ch: string): number {
  const lower = ch.toLowerCase()
  const type = TYPE_TO_CHAR.indexOf(lower)
  if (type <= 0) return 0
  return ch === lower ? -type : type
}

// -- FEN import / export -----------------------------------------------------

export function parseFEN(fen: string): State {
  const parts = fen.trim().split(/\s+/)
  const [placement, active, castle, ep, half, full] = parts
  const board = new Array<number>(128).fill(0)
  const ranks = placement.split('/')
  // FEN lists rank 8 first; board rank index 7 is rank 8.
  for (let i = 0; i < 8; i++) {
    const row = ranks[i]
    const rank = 7 - i
    let file = 0
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        file += ch.charCodeAt(0) - 48
      } else {
        board[sq(rank, file)] = charToPiece(ch)
        file++
      }
    }
  }
  let castling = 0
  if (castle && castle !== '-') {
    if (castle.includes('K')) castling |= CR_WK
    if (castle.includes('Q')) castling |= CR_WQ
    if (castle.includes('k')) castling |= CR_BK
    if (castle.includes('q')) castling |= CR_BQ
  }
  const state: State = {
    board,
    turn: active === 'b' ? 'b' : 'w',
    castling,
    ep: ep && ep !== '-' ? parseSquare(ep) : -1,
    half: half ? parseInt(half, 10) : 0,
    full: full ? parseInt(full, 10) : 1,
    history: [],
  }
  state.history = [positionKey(state)]
  return state
}

export function exportFEN(state: State): string {
  let placement = ''
  for (let rank = 7; rank >= 0; rank--) {
    let empty = 0
    for (let file = 0; file < 8; file++) {
      const code = state.board[sq(rank, file)]
      if (code === 0) {
        empty++
      } else {
        if (empty) {
          placement += empty
          empty = 0
        }
        placement += pieceToChar(code)
      }
    }
    if (empty) placement += empty
    if (rank > 0) placement += '/'
  }
  let castle = ''
  if (state.castling & CR_WK) castle += 'K'
  if (state.castling & CR_WQ) castle += 'Q'
  if (state.castling & CR_BK) castle += 'k'
  if (state.castling & CR_BQ) castle += 'q'
  if (!castle) castle = '-'
  const ep = state.ep >= 0 ? squareName(state.ep) : '-'
  return `${placement} ${state.turn} ${castle} ${ep} ${state.half} ${state.full}`
}

/** Compact, side-to-move-aware position key for threefold repetition. */
export function positionKey(state: State): string {
  let s = ''
  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      s += pieceToChar(state.board[sq(rank, file)])
    }
  }
  return `${s} ${state.turn} ${state.castling} ${state.ep}`
}

export function createGame(): State {
  return parseFEN(START_FEN)
}

// -- Attack detection --------------------------------------------------------

/** Is `target` attacked by any piece of color `by` on `board`? */
export function isSquareAttacked(board: number[], target: number, by: Color): boolean {
  const bySign = colorSign(by)
  // Pawns: a white pawn on t-15 / t-17 attacks t; a black pawn on t+15 / t+17.
  const pawn = PAWN * bySign
  if (by === 'w') {
    if (onBoard(target - 15) && board[target - 15] === pawn) return true
    if (onBoard(target - 17) && board[target - 17] === pawn) return true
  } else {
    if (onBoard(target + 15) && board[target + 15] === pawn) return true
    if (onBoard(target + 17) && board[target + 17] === pawn) return true
  }
  // Knights.
  const knight = KNIGHT * bySign
  for (const d of KNIGHT_DELTAS) {
    const s = target + d
    if (onBoard(s) && board[s] === knight) return true
  }
  // King.
  const king = KING * bySign
  for (const d of KING_DELTAS) {
    const s = target + d
    if (onBoard(s) && board[s] === king) return true
  }
  // Bishops / queens (diagonal rays).
  for (const d of BISHOP_DELTAS) {
    let s = target + d
    while (onBoard(s)) {
      const code = board[s]
      if (code !== 0) {
        if (code * bySign > 0) {
          const t = typeOf(code)
          if (t === BISHOP || t === QUEEN) return true
        }
        break
      }
      s += d
    }
  }
  // Rooks / queens (orthogonal rays).
  for (const d of ROOK_DELTAS) {
    let s = target + d
    while (onBoard(s)) {
      const code = board[s]
      if (code !== 0) {
        if (code * bySign > 0) {
          const t = typeOf(code)
          if (t === ROOK || t === QUEEN) return true
        }
        break
      }
      s += d
    }
  }
  return false
}

function findKing(board: number[], turn: Color): number {
  const king = KING * colorSign(turn)
  for (let s = 0; s < 128; s++) {
    if (onBoard(s) && board[s] === king) return s
  }
  return -1
}

export function isInCheck(state: State, side: Color): boolean {
  const king = findKing(state.board, side)
  if (king < 0) return false
  return isSquareAttacked(state.board, king, side === 'w' ? 'b' : 'w')
}

// -- Pseudo-legal move generation --------------------------------------------

const PROMO_TYPES = [QUEEN, ROOK, BISHOP, KNIGHT]

function pushPawnMove(moves: Move[], from: number, to: number, piece: number, captured: number, flag: Move['flag']): void {
  const promoRank = piece > 0 ? 7 : 0
  if (rankOf(to) === promoRank) {
    for (const promo of PROMO_TYPES) {
      moves.push({ from, to, piece, captured, promotion: promo, flag })
    }
  } else {
    moves.push({ from, to, piece, captured, promotion: 0, flag })
  }
}

/** All pseudo-legal moves (may leave own king in check — `legalMoves` filters). */
export function pseudoLegalMoves(state: State): Move[] {
  const { board, turn } = state
  const us = colorSign(turn)
  const moves: Move[] = []

  for (let from = 0; from < 128; from++) {
    if (!onBoard(from)) continue
    const piece = board[from]
    if (piece === 0 || !isOwn(piece, us)) continue
    const type = typeOf(piece)

    if (type === PAWN) {
      const forward = us > 0 ? 16 : -16
      const startRank = us > 0 ? 1 : 6
      const one = from + forward
      if (onBoard(one) && board[one] === 0) {
        pushPawnMove(moves, from, one, piece, 0, 'n')
        // Double push from the start rank (both squares empty).
        if (rankOf(from) === startRank) {
          const two = from + forward * 2
          if (board[two] === 0) {
            moves.push({ from, to: two, piece, captured: 0, promotion: 0, flag: 'double' })
          }
        }
      }
      // Captures (including en passant).
      const capDeltas = us > 0 ? [15, 17] : [-15, -17]
      for (const d of capDeltas) {
        const to = from + d
        if (!onBoard(to)) continue
        const targ = board[to]
        if (targ !== 0 && isEnemy(targ, us)) {
          pushPawnMove(moves, from, to, piece, targ, 'n')
        } else if (to === state.ep) {
          // en passant: the captured pawn sits on the square behind the target.
          const capSq = to - forward
          pushPawnMove(moves, from, to, piece, board[capSq], 'ep')
        }
      }
      continue
    }

    if (type === KNIGHT || type === KING) {
      const deltas = type === KNIGHT ? KNIGHT_DELTAS : KING_DELTAS
      for (const d of deltas) {
        const to = from + d
        if (!onBoard(to)) continue
        const targ = board[to]
        if (targ === 0 || isEnemy(targ, us)) {
          moves.push({ from, to, piece, captured: targ, promotion: 0, flag: 'n' })
        }
      }
      continue
    }

    // Sliding pieces.
    let deltas: number[]
    if (type === BISHOP) deltas = BISHOP_DELTAS
    else if (type === ROOK) deltas = ROOK_DELTAS
    else deltas = KING_DELTAS // queen
    for (const d of deltas) {
      let to = from + d
      while (onBoard(to)) {
        const targ = board[to]
        if (targ === 0) {
          moves.push({ from, to, piece, captured: 0, promotion: 0, flag: 'n' })
        } else {
          if (isEnemy(targ, us)) {
            moves.push({ from, to, piece, captured: targ, promotion: 0, flag: 'n' })
          }
          break
        }
        to += d
      }
    }
  }

  // Castling.
  addCastling(state, moves)
  return moves
}

function addCastling(state: State, moves: Move[]): void {
  const { board, turn, castling } = state
  const them: Color = turn === 'w' ? 'b' : 'w'
  if (turn === 'w') {
    const e1 = sq(0, 4)
    if (board[e1] !== KING) return
    if (isSquareAttacked(board, e1, them)) return
    if (
      castling & CR_WK &&
      board[sq(0, 5)] === 0 &&
      board[sq(0, 6)] === 0 &&
      board[sq(0, 7)] === ROOK &&
      !isSquareAttacked(board, sq(0, 5), them) &&
      !isSquareAttacked(board, sq(0, 6), them)
    ) {
      moves.push({ from: e1, to: sq(0, 6), piece: KING, captured: 0, promotion: 0, flag: 'castle', rookFrom: sq(0, 7), rookTo: sq(0, 5) })
    }
    if (
      castling & CR_WQ &&
      board[sq(0, 3)] === 0 &&
      board[sq(0, 2)] === 0 &&
      board[sq(0, 1)] === 0 &&
      board[sq(0, 0)] === ROOK &&
      !isSquareAttacked(board, sq(0, 3), them) &&
      !isSquareAttacked(board, sq(0, 2), them)
    ) {
      moves.push({ from: e1, to: sq(0, 2), piece: KING, captured: 0, promotion: 0, flag: 'castle', rookFrom: sq(0, 0), rookTo: sq(0, 3) })
    }
  } else {
    const e8 = sq(7, 4)
    if (board[e8] !== -KING) return
    if (isSquareAttacked(board, e8, them)) return
    if (
      castling & CR_BK &&
      board[sq(7, 5)] === 0 &&
      board[sq(7, 6)] === 0 &&
      board[sq(7, 7)] === -ROOK &&
      !isSquareAttacked(board, sq(7, 5), them) &&
      !isSquareAttacked(board, sq(7, 6), them)
    ) {
      moves.push({ from: e8, to: sq(7, 6), piece: -KING, captured: 0, promotion: 0, flag: 'castle', rookFrom: sq(7, 7), rookTo: sq(7, 5) })
    }
    if (
      castling & CR_BQ &&
      board[sq(7, 3)] === 0 &&
      board[sq(7, 2)] === 0 &&
      board[sq(7, 1)] === 0 &&
      board[sq(7, 0)] === -ROOK &&
      !isSquareAttacked(board, sq(7, 3), them) &&
      !isSquareAttacked(board, sq(7, 2), them)
    ) {
      moves.push({ from: e8, to: sq(7, 2), piece: -KING, captured: 0, promotion: 0, flag: 'castle', rookFrom: sq(7, 0), rookTo: sq(7, 3) })
    }
  }
}

// -- Legal move generation ---------------------------------------------------

/**
 * Simulate a move on a cloned board (board-only, no state bookkeeping) and test
 * whether the mover's own king is left in check. Used to filter pseudo-legal
 * moves without paying for full state cloning in the hot path.
 */
function leavesOwnKingInCheck(board: number[], move: Move, turn: Color): boolean {
  const b = board.slice()
  b[move.from] = 0
  const placed = move.promotion ? move.promotion * colorSign(turn) : move.piece
  b[move.to] = placed
  if (move.flag === 'ep') {
    const forward = turn === 'w' ? 16 : -16
    b[move.to - forward] = 0
  } else if (move.flag === 'castle') {
    b[move.rookTo!] = b[move.rookFrom!]
    b[move.rookFrom!] = 0
  }
  const king = typeOf(move.piece) === KING ? move.to : findKing(b, turn)
  return isSquareAttacked(b, king, turn === 'w' ? 'b' : 'w')
}

export function legalMoves(state: State): Move[] {
  const pseudo = pseudoLegalMoves(state)
  const legal: Move[] = []
  for (const m of pseudo) {
    if (!leavesOwnKingInCheck(state.board, m, state.turn)) legal.push(m)
  }
  return legal
}

// -- Apply move (pure) -------------------------------------------------------

function clearRookRight(castling: number, square: number): number {
  if (square === sq(0, 0)) return castling & ~CR_WQ
  if (square === sq(0, 7)) return castling & ~CR_WK
  if (square === sq(7, 0)) return castling & ~CR_BQ
  if (square === sq(7, 7)) return castling & ~CR_BK
  return castling
}

export function applyMove(state: State, move: Move): State {
  const board = state.board.slice()
  const us = colorSign(state.turn)
  const type = typeOf(move.piece)

  board[move.from] = 0
  board[move.to] = move.promotion ? move.promotion * us : move.piece

  if (move.flag === 'ep') {
    const forward = us > 0 ? 16 : -16
    board[move.to - forward] = 0
  } else if (move.flag === 'castle') {
    board[move.rookTo!] = board[move.rookFrom!]
    board[move.rookFrom!] = 0
  }

  // Castling rights.
  let castling = state.castling
  if (type === KING) {
    castling &= state.turn === 'w' ? ~(CR_WK | CR_WQ) : ~(CR_BK | CR_BQ)
  }
  castling = clearRookRight(castling, move.from) // a rook (or king) left home
  castling = clearRookRight(castling, move.to) // a rook was captured on its home

  // En-passant target: set only on a double pawn push.
  const ep = move.flag === 'double' ? (move.from + move.to) / 2 : -1

  // Halfmove clock: reset on a pawn move or any capture.
  const half = type === PAWN || move.captured !== 0 ? 0 : state.half + 1

  const full = state.turn === 'b' ? state.full + 1 : state.full
  const turn: Color = state.turn === 'w' ? 'b' : 'w'

  const next: State = { board, turn, castling, ep, half, full, history: state.history }
  next.history = state.history.concat(positionKey(next))
  return next
}

// -- Terminal states & draws -------------------------------------------------

export function isCheckmate(state: State): boolean {
  return isInCheck(state, state.turn) && legalMoves(state).length === 0
}

export function isStalemate(state: State): boolean {
  return !isInCheck(state, state.turn) && legalMoves(state).length === 0
}

export function isFiftyMoveDraw(state: State): boolean {
  return state.half >= 100
}

export function isThreefoldRepetition(state: State): boolean {
  const key = state.history[state.history.length - 1]
  let count = 0
  for (const k of state.history) if (k === key) count++
  return count >= 3
}

export function isInsufficientMaterial(state: State): boolean {
  const minors: { color: number; type: number; light: boolean }[] = []
  for (let s = 0; s < 128; s++) {
    if (!onBoard(s)) continue
    const code = state.board[s]
    if (code === 0) continue
    const t = typeOf(code)
    if (t === KING) continue
    if (t === PAWN || t === ROOK || t === QUEEN) return false // enough material somewhere
    minors.push({ color: code > 0 ? 1 : -1, type: t, light: (rankOf(s) + fileOf(s)) % 2 === 1 })
  }
  if (minors.length === 0) return true // K vs K
  if (minors.length === 1) return true // K + single minor vs K
  if (minors.length === 2) {
    const [a, b] = minors
    // K+B vs K+B with bishops on the same colour squares.
    if (a.type === BISHOP && b.type === BISHOP && a.color !== b.color && a.light === b.light) return true
  }
  return false
}

/** Any drawing condition (50-move, threefold, insufficient material, stalemate). */
export function isDraw(state: State): boolean {
  return (
    isStalemate(state) ||
    isFiftyMoveDraw(state) ||
    isThreefoldRepetition(state) ||
    isInsufficientMaterial(state)
  )
}

export type Outcome = 'checkmate' | 'stalemate' | 'draw' | null

/** The game result, from the perspective of the position (whose turn it is). */
export function outcome(state: State): Outcome {
  if (legalMoves(state).length === 0) {
    return isInCheck(state, state.turn) ? 'checkmate' : 'stalemate'
  }
  if (isFiftyMoveDraw(state) || isThreefoldRepetition(state) || isInsufficientMaterial(state)) {
    return 'draw'
  }
  return null
}

// -- Perft (move-gen acceptance gate) ---------------------------------------

export function perft(state: State, depth: number): number {
  if (depth === 0) return 1
  const moves = legalMoves(state)
  if (depth === 1) return moves.length
  let nodes = 0
  for (const m of moves) {
    nodes += perft(applyMove(state, m), depth - 1)
  }
  return nodes
}

// -- AI: minimax with alpha-beta ---------------------------------------------

const PIECE_VALUE = [0, 100, 320, 330, 500, 900, 0] // index by type; king handled by mate

// Piece-square tables (white perspective, index = rank*8 + file, rank 0 = "1").
// prettier-ignore
const PST_PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10,-20,-20, 10, 10,  5,
   5, -5,-10,  0,  0,-10, -5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5,  5, 10, 25, 25, 10,  5,  5,
  10, 10, 20, 30, 30, 20, 10, 10,
  50, 50, 50, 50, 50, 50, 50, 50,
   0,  0,  0,  0,  0,  0,  0,  0,
]
// prettier-ignore
const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
]
// prettier-ignore
const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
]
// prettier-ignore
const PST_ROOK = [
   0,  0,  0,  5,  5,  0,  0,  0,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   5, 10, 10, 10, 10, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
]
// prettier-ignore
const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -10,  5,  5,  5,  5,  5,  0,-10,
    0,  0,  5,  5,  5,  5,  0, -5,
   -5,  0,  5,  5,  5,  5,  0, -5,
  -10,  0,  5,  5,  5,  5,  0,-10,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
]
// prettier-ignore
const PST_KING = [
   20, 30, 10,  0,  0, 10, 30, 20,
   20, 20,  0,  0,  0,  0, 20, 20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
]

const PST_BY_TYPE = [null, PST_PAWN, PST_KNIGHT, PST_BISHOP, PST_ROOK, PST_QUEEN, PST_KING]

const MATE = 1_000_000

/** Static evaluation, white-positive (material + piece-square tables). */
export function evaluateWhite(board: number[]): number {
  let score = 0
  for (let s = 0; s < 128; s++) {
    if (!onBoard(s)) continue
    const code = board[s]
    if (code === 0) continue
    const type = typeOf(code)
    const white = code > 0
    const idx8 = white ? rankOf(s) * 8 + fileOf(s) : (7 - rankOf(s)) * 8 + fileOf(s)
    const val = PIECE_VALUE[type] + (PST_BY_TYPE[type]?.[idx8] ?? 0)
    score += white ? val : -val
  }
  return score
}

/** Evaluation from the side-to-move's perspective (for negamax). */
function evaluateRelative(state: State): number {
  const white = evaluateWhite(state.board)
  return state.turn === 'w' ? white : -white
}

/** Order moves so captures (high victim value first) are searched first. */
function orderMoves(moves: Move[]): Move[] {
  return moves
    .map((m) => ({
      m,
      s: m.captured !== 0 ? 1000 + PIECE_VALUE[typeOf(m.captured)] - PIECE_VALUE[typeOf(m.piece)] : m.promotion ? 900 : 0,
    }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m)
}

function negamax(state: State, depth: number, alpha: number, beta: number, ply: number): number {
  const moves = legalMoves(state)
  if (moves.length === 0) {
    // Checkmate (bad) or stalemate (draw). Prefer faster mates via `ply`.
    return isInCheck(state, state.turn) ? -(MATE - ply) : 0
  }
  if (depth === 0) return evaluateRelative(state)

  const ordered = orderMoves(moves)
  let best = -Infinity
  for (const m of ordered) {
    const val = -negamax(applyMove(state, m), depth - 1, -beta, -alpha, ply + 1)
    if (val > best) best = val
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

const DEPTH_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }
// Easy blunders a little: it picks uniformly among moves within this margin of best.
const EASY_MARGIN = 60

/**
 * Choose a move for the computer. Minimax + alpha-beta; deterministic given
 * `rng` (used only to break ties). Returns null only for a terminal position.
 */
export function bestMove(state: State, difficulty: Difficulty, rng: Rng): Move | null {
  const moves = orderMoves(legalMoves(state))
  if (moves.length === 0) return null
  const depth = DEPTH_BY_DIFFICULTY[difficulty]

  const scored: { m: Move; v: number }[] = []
  for (const m of moves) {
    // Full window per root move so tie collection is exact (each subtree still
    // prunes internally). Root has few moves so this is cheap.
    const v = -negamax(applyMove(state, m), depth - 1, -Infinity, Infinity, 1)
    scored.push({ m, v })
  }
  let bestScore = -Infinity
  for (const s of scored) if (s.v > bestScore) bestScore = s.v
  const margin = difficulty === 'easy' ? EASY_MARGIN : 0
  const pool = scored.filter((s) => s.v >= bestScore - margin).map((s) => s.m)
  return pool[Math.floor(rng() * pool.length)]
}

// -- Small display helpers (used by the component) ---------------------------

export function moveToString(m: Move): string {
  const promo = m.promotion ? TYPE_TO_CHAR[m.promotion] : ''
  return squareName(m.from) + squareName(m.to) + promo
}

/** Material balance (white minus black) in centipawns, for the status bar. */
export function materialBalance(board: number[]): number {
  let score = 0
  for (let s = 0; s < 128; s++) {
    if (!onBoard(s)) continue
    const code = board[s]
    if (code === 0) continue
    const v = PIECE_VALUE[typeOf(code)]
    score += code > 0 ? v : -v
  }
  return score
}

/** Captured-piece tally for each side (what the opponent has taken off). */
export function capturedPieces(board: number[]): { white: number[]; black: number[] } {
  const start: Record<number, number> = { [PAWN]: 8, [KNIGHT]: 2, [BISHOP]: 2, [ROOK]: 2, [QUEEN]: 1, [KING]: 1 }
  const whiteOnBoard: Record<number, number> = {}
  const blackOnBoard: Record<number, number> = {}
  for (let s = 0; s < 128; s++) {
    if (!onBoard(s)) continue
    const code = board[s]
    if (code === 0) continue
    const t = typeOf(code)
    if (code > 0) whiteOnBoard[t] = (whiteOnBoard[t] ?? 0) + 1
    else blackOnBoard[t] = (blackOnBoard[t] ?? 0) + 1
  }
  // "captured" = missing from the starting complement. black[] = black pieces the
  // WHITE player captured; white[] = white pieces the BLACK player captured.
  const black: number[] = []
  const white: number[] = []
  for (const t of [QUEEN, ROOK, BISHOP, KNIGHT, PAWN]) {
    for (let i = 0; i < start[t] - (blackOnBoard[t] ?? 0); i++) black.push(t)
    for (let i = 0; i < start[t] - (whiteOnBoard[t] ?? 0); i++) white.push(t)
  }
  return { white, black }
}
