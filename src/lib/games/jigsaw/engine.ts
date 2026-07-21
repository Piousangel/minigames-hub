/**
 * Jigsaw — a procedurally-generated neon picture cut into an N×N grid of
 * interlocking jigsaw pieces, shuffled into a tray, and reassembled on a board.
 *
 * PURITY: every function here is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through the injected `Rng`, consumed
 * ONLY in `deal` (tray shuffle + artwork variant + an edge-seed). Edge shapes
 * and the artwork are DERIVED deterministically from the stored seed so the
 * component can redraw them without any extra randomness, and a given deal is
 * fully reproducible. All move functions are (state) -> state and REJECT
 * illegal moves by returning the SAME state reference (so callers/tests can
 * assert a no-op with `===`).
 *
 * PLACEMENT MODEL — strict-correct-only. A tray piece can be placed ONLY on its
 * own correct cell (tap piece → its target cell highlights → tap to place). A
 * correct placement snaps and LOCKS, so every placed piece is by construction
 * correct and "solved" is simply "all pieces placed". An attempted wrong cell
 * is a gentle no-op (same reference). Because placements lock, `removePiece` is
 * disabled and always no-ops — there is no wrong-placement frustration and no
 * swap complexity.
 */

export type Rng = () => number // float in [0,1)

/** An edge shape: -1 blank (notch in), 0 flat (grid border), +1 tab (bump out). */
export type Edge = -1 | 0 | 1

export interface Edges {
  top: Edge
  right: Edge
  bottom: Edge
  left: Edge
}

export interface Piece {
  /** Stable identity = row * n + col. */
  id: number
  /** Correct grid position (its identity as a slice of the picture). */
  row: number
  col: number
  /** Where it currently sits on the board, or null when still in the tray. */
  placedAt: { row: number; col: number } | null
}

export type Status = 'playing' | 'won'

export interface State {
  n: number // grid size (n×n pieces)
  variant: number // artwork variant chosen at deal
  seed: number // edge/artwork seed (derived from rng at deal)
  pieces: Piece[] // length n*n, indexed by id
  board: (number | null)[][] // n×n of pieceId | null
  tray: number[] // unplaced pieceIds, in shuffled order
  status: Status
  placedCount: number
  moves: number
}

/** Selectable difficulties: piece count = n*n (9, 16, 36). */
export const DIFFICULTIES: readonly number[] = [3, 4, 6]
export const ARTWORK_VARIANTS = 6

// -- PRNG (byte-identical to the solitaire engine's mulberry32) ---------------

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

/** Deterministic Fisher–Yates. Returns a new shuffled array; input untouched. */
export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// -- Edge geometry -----------------------------------------------------------

/**
 * Deterministic ±1 sign for an interior grid boundary. `axis` 0 = the vertical
 * boundary to the RIGHT of (r,c); axis 1 = the horizontal boundary BELOW (r,c).
 * Pure hash of (seed, r, c, axis) — never consumes the rng.
 */
function edgeSign(seed: number, r: number, c: number, axis: 0 | 1): 1 | -1 {
  let h = seed >>> 0
  h = Math.imul(h ^ (r + 0x1000), 0x9e3779b1)
  h = Math.imul(h ^ (c + 0x2000), 0x85ebca77)
  h = Math.imul(h ^ (axis + 0x3000), 0xc2b2ae3d)
  h ^= h >>> 15
  return (h & 1) === 0 ? 1 : -1
}

/**
 * The 4 edge shapes of piece (row,col) for an n×n cut with the given seed.
 * Rule enforced by construction: the RIGHT edge of (r,c) is the negation of the
 * LEFT edge of (r,c+1) (a tab always meets a blank), and the BOTTOM edge of
 * (r,c) is the negation of the TOP edge of (r+1,c). Border edges are flat (0).
 */
export function edgesFor(row: number, col: number, seed: number, n: number): Edges {
  const hEdge = (r: number, c: number): Edge => edgeSign(seed, r, c, 0) // right-of-(r,c)
  const vEdge = (r: number, c: number): Edge => edgeSign(seed, r, c, 1) // below-(r,c)
  const neg = (e: Edge): Edge => -e as Edge
  return {
    top: row === 0 ? 0 : neg(vEdge(row - 1, col)),
    right: col === n - 1 ? 0 : hEdge(row, col),
    bottom: row === n - 1 ? 0 : vEdge(row, col),
    left: col === 0 ? 0 : neg(hEdge(row, col - 1)),
  }
}

// -- Artwork (deterministic, on-brand neon) ----------------------------------

/** On-brand neon palette (mirrors the site's --neon-* CSS variables). */
export const NEON_PALETTE: readonly string[] = [
  '#22d3ee', // cyan
  '#ff3d9a', // magenta
  '#a3e635', // lime
  '#fbbf24', // amber
  '#b06bff', // purple
  '#4d7cff', // blue
  '#34e39b', // green
]

export interface ArtShape {
  kind: 'circle' | 'triangle' | 'bar' | 'ring'
  /** Position + size as fractions of the picture (0..1). */
  cx: number
  cy: number
  r: number
  rot: number // degrees
  color: string
  opacity: number
}

export interface Artwork {
  /** Two background gradient stop colours + an accent. */
  bg: [string, string]
  accent: string
  shapes: ArtShape[]
}

/**
 * Build a deterministic neon composition from (seed, variant). Layered radial
 * gradient background + a handful of geometric neon shapes. Pure — no random,
 * no external assets — so every puzzle's picture is reproducible and always
 * solvable by construction.
 */
export function artworkFor(seed: number, variant: number): Artwork {
  const rng = mulberry32((seed ^ ((variant + 1) * 0x9e3779b1)) >>> 0)
  const pick = () => NEON_PALETTE[Math.floor(rng() * NEON_PALETTE.length)]
  const bg: [string, string] = [pick(), pick()]
  const accent = pick()
  const kinds: ArtShape['kind'][] = ['circle', 'triangle', 'bar', 'ring']
  const count = 5 + Math.floor(rng() * 4) // 5..8 shapes
  const shapes: ArtShape[] = []
  for (let i = 0; i < count; i++) {
    shapes.push({
      kind: kinds[Math.floor(rng() * kinds.length)],
      cx: rng(),
      cy: rng(),
      r: 0.12 + rng() * 0.28,
      rot: Math.floor(rng() * 360),
      color: pick(),
      opacity: 0.35 + rng() * 0.45,
    })
  }
  return { bg, accent, shapes }
}

// -- Deal --------------------------------------------------------------------

function range(n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(i)
  return out
}

function emptyBoard(n: number): (number | null)[][] {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => null as number | null))
}

/**
 * Build a fresh deal: n*n pieces, all in a shuffled tray, board empty.
 * Consumes rng ONLY here — tray shuffle, then artwork variant, then edge-seed —
 * in a fixed order, so a given (seed, n) is byte-for-byte reproducible.
 */
export function deal(rng: Rng, n: number): State {
  const count = n * n
  const pieces: Piece[] = []
  for (let id = 0; id < count; id++) {
    pieces.push({ id, row: Math.floor(id / n), col: id % n, placedAt: null })
  }
  const tray = shuffle(range(count), rng)
  const variant = Math.floor(rng() * ARTWORK_VARIANTS)
  const seed = Math.floor(rng() * 4294967296) >>> 0
  return {
    n,
    variant,
    seed,
    pieces,
    board: emptyBoard(n),
    tray,
    status: 'playing',
    placedCount: 0,
    moves: 0,
  }
}

export function createGame(seed: number, n: number): State {
  return deal(mulberry32(seed), n)
}

// -- Helpers -----------------------------------------------------------------

/** The correct cell a piece belongs to (its identity). */
export function correctCellFor(state: State, pieceId: number): { row: number; col: number } | null {
  const p = state.pieces[pieceId]
  return p ? { row: p.row, col: p.col } : null
}

/** How many pieces are still in the tray (unplaced). */
export function remaining(state: State): number {
  return state.n * state.n - state.placedCount
}

/**
 * Strict solve check: every cell holds the piece whose correct cell it is, and
 * all n*n are placed. (With the strict placement model this is equivalent to
 * `placedCount === n*n`, but we verify board integrity to be safe.)
 */
export function isSolved(state: State): boolean {
  const { n, board } = state
  if (state.placedCount !== n * n) return false
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const id = board[r][c]
      if (id == null) return false
      const p = state.pieces[id]
      if (!p || p.row !== r || p.col !== c) return false
    }
  }
  return true
}

// -- Moves (pure; illegal → same reference) ----------------------------------

/**
 * Place a tray piece onto (row,col). STRICT model: the move is accepted only
 * when (row,col) is the piece's own correct cell AND that cell is empty AND the
 * piece is currently in the tray. Anything else → same reference (no-op). A
 * successful placement snaps + locks and may finish the puzzle.
 */
export function placePiece(state: State, pieceId: number, row: number, col: number): State {
  if (state.status !== 'playing') return state
  const piece = state.pieces[pieceId]
  if (!piece) return state
  if (piece.placedAt !== null) return state // already on the board (locked)
  const { n } = state
  if (row < 0 || row >= n || col < 0 || col >= n) return state
  if (row !== piece.row || col !== piece.col) return state // wrong cell → gentle no-op
  if (state.board[row][col] !== null) return state // occupied

  const tray = state.tray.filter((id) => id !== pieceId)
  if (tray.length === state.tray.length) return state // wasn't in the tray

  const board = state.board.map((r, ri) =>
    ri === row ? r.map((cell, ci) => (ci === col ? pieceId : cell)) : r,
  )
  const pieces = state.pieces.map((p) =>
    p.id === pieceId ? { ...p, placedAt: { row, col } } : p,
  )
  const placedCount = state.placedCount + 1
  const status: Status = placedCount === n * n ? 'won' : 'playing'
  return { ...state, board, pieces, tray, placedCount, moves: state.moves + 1, status }
}

/**
 * Return a placed piece to the tray. DISABLED in the strict-lock model (every
 * placed piece is correct and locked), so this always no-ops (same reference).
 * Kept for API completeness / future free-placement variants.
 */
export function removePiece(state: State, row: number, col: number): State {
  void row
  void col
  return state
}

// -- Scoring -----------------------------------------------------------------

/**
 * Higher = better; monotonic as pieces are placed. 100 per placed piece, plus a
 * completion bonus that scales with the puzzle size (bigger cut = bigger prize).
 */
export function score(state: State): number {
  const base = state.placedCount * 100
  const bonus = state.status === 'won' ? state.n * state.n * 50 : 0
  return base + bonus
}
