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

// -- Artwork (deterministic, RECOGNIZABLE neon scenes) -----------------------
//
// A jigsaw is only satisfying if the picture READS as a picture — so instead of
// scattering random blobs, each variant renders a deliberate, recognizable
// neon SCENE (sunset, mountains, orbit, city, bokeh, starburst). The seed adds
// subtle variation (positions/counts) but the composition stays legible, so a
// player can tell where a piece belongs from its slice of the image.

/** On-brand neon accents (mirror the site's --neon-* CSS variables). */
export const NEON_PALETTE: readonly string[] = [
  '#22d3ee', // cyan
  '#ff3d9a', // magenta
  '#a3e635', // lime
  '#fbbf24', // amber
  '#b06bff', // purple
  '#4d7cff', // blue
  '#34e39b', // green
]

const NEON = {
  cyan: '#22d3ee',
  magenta: '#ff3d9a',
  lime: '#a3e635',
  amber: '#fbbf24',
  purple: '#b06bff',
  blue: '#4d7cff',
  green: '#34e39b',
} as const

/** A drawable primitive; all coordinates/sizes are fractions of the picture (0..1). */
export type ArtShape =
  | { kind: 'circle'; cx: number; cy: number; r: number; color: string; opacity: number }
  | { kind: 'ring'; cx: number; cy: number; r: number; sw: number; color: string; opacity: number }
  | { kind: 'triangle'; cx: number; cy: number; r: number; color: string; opacity: number }
  | {
      kind: 'rect'
      x: number
      y: number
      w: number
      h: number
      color: string
      opacity: number
      rot?: number
      round?: number
    }

export interface Artwork {
  /** Scene name (also handy for tests/debugging). */
  scene: string
  /** Vertical gradient stops, top → bottom (any hex). */
  bg: string[]
  /** Back-to-front draw order. */
  shapes: ArtShape[]
}

const rflt = (rng: Rng, lo: number, hi: number): number => lo + rng() * (hi - lo)
const rint = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1))

function sunset(rng: Rng): Artwork {
  const shapes: ArtShape[] = []
  const sx = rflt(rng, 0.42, 0.58)
  const sy = rflt(rng, 0.6, 0.68)
  const sr = rflt(rng, 0.17, 0.22)
  shapes.push({ kind: 'circle', cx: sx, cy: sy, r: sr * 1.55, color: NEON.amber, opacity: 0.16 }) // halo
  shapes.push({ kind: 'circle', cx: sx, cy: sy, r: sr, color: NEON.amber, opacity: 0.95 })
  // horizon + shimmering reflections below it
  shapes.push({ kind: 'rect', x: 0, y: 0.72, w: 1, h: 0.006, color: NEON.magenta, opacity: 0.6 })
  for (let i = 0; i < 4; i++) {
    const k = 1.1 - i * 0.16
    shapes.push({
      kind: 'rect',
      x: sx - sr * k,
      y: 0.75 + i * 0.05,
      w: sr * 2 * k,
      h: 0.018,
      round: 0.009,
      color: NEON.amber,
      opacity: 0.5 - i * 0.1,
    })
  }
  // distant clouds
  shapes.push({ kind: 'rect', x: 0.04, y: 0.42, w: 0.4, h: 0.03, round: 0.02, color: NEON.magenta, opacity: 0.22 })
  shapes.push({ kind: 'rect', x: 0.56, y: 0.3, w: 0.35, h: 0.028, round: 0.02, color: NEON.purple, opacity: 0.22 })
  for (let i = 0; i < 5; i++) {
    shapes.push({ kind: 'circle', cx: rflt(rng, 0.05, 0.95), cy: rflt(rng, 0.05, 0.38), r: rflt(rng, 0.004, 0.01), color: '#ffffff', opacity: rflt(rng, 0.5, 0.9) })
  }
  return { scene: 'sunset', bg: ['#1a0f3d', '#7a2a6b', '#e8894b'], shapes }
}

function mountains(rng: Rng): Artwork {
  const shapes: ArtShape[] = []
  const mx = rflt(rng, 0.68, 0.82)
  const my = rflt(rng, 0.16, 0.26)
  shapes.push({ kind: 'circle', cx: mx, cy: my, r: 0.12, color: NEON.amber, opacity: 0.14 }) // moon glow
  shapes.push({ kind: 'circle', cx: mx, cy: my, r: 0.08, color: '#fdf3c0', opacity: 0.95 })
  for (let i = 0; i < 6; i++) {
    shapes.push({ kind: 'circle', cx: rflt(rng, 0.05, 0.6), cy: rflt(rng, 0.05, 0.42), r: rflt(rng, 0.004, 0.009), color: '#ffffff', opacity: rflt(rng, 0.5, 0.9) })
  }
  const back = [NEON.purple, NEON.blue]
  for (let i = 0; i < 3; i++) {
    shapes.push({ kind: 'triangle', cx: 0.2 + i * 0.3 + rflt(rng, -0.05, 0.05), cy: 1.02, r: rflt(rng, 0.32, 0.42), color: back[i % 2], opacity: 0.5 })
  }
  const front = [NEON.cyan, NEON.green]
  for (let i = 0; i < 3; i++) {
    shapes.push({ kind: 'triangle', cx: 0.05 + i * 0.4 + rflt(rng, -0.05, 0.05), cy: 1.06, r: rflt(rng, 0.26, 0.34), color: front[i % 2], opacity: 0.85 })
  }
  return { scene: 'mountains', bg: ['#071427', '#0e3a54', '#166b5e'], shapes }
}

function orbit(rng: Rng): Artwork {
  const shapes: ArtShape[] = []
  const cx = 0.5
  const cy = 0.48
  shapes.push({ kind: 'ring', cx, cy, r: 0.42, sw: 0.006, color: NEON.cyan, opacity: 0.4 })
  shapes.push({ kind: 'ring', cx, cy, r: 0.3, sw: 0.006, color: NEON.magenta, opacity: 0.45 })
  shapes.push({ kind: 'circle', cx, cy, r: 0.2, color: NEON.purple, opacity: 0.2 }) // planet glow
  shapes.push({ kind: 'circle', cx, cy, r: 0.15, color: NEON.purple, opacity: 0.9 })
  shapes.push({ kind: 'circle', cx: cx - 0.05, cy: cy - 0.05, r: 0.055, color: NEON.magenta, opacity: 0.5 }) // highlight
  const a1 = rflt(rng, 0, Math.PI * 2)
  shapes.push({ kind: 'circle', cx: cx + 0.3 * Math.cos(a1), cy: cy + 0.3 * Math.sin(a1), r: 0.03, color: NEON.amber, opacity: 0.95 })
  const a2 = rflt(rng, 0, Math.PI * 2)
  shapes.push({ kind: 'circle', cx: cx + 0.42 * Math.cos(a2), cy: cy + 0.42 * Math.sin(a2), r: 0.024, color: NEON.cyan, opacity: 0.95 })
  for (let i = 0; i < 8; i++) {
    shapes.push({ kind: 'circle', cx: rflt(rng, 0, 1), cy: rflt(rng, 0, 1), r: rflt(rng, 0.003, 0.008), color: '#ffffff', opacity: rflt(rng, 0.4, 0.9) })
  }
  return { scene: 'orbit', bg: ['#05040f', '#140a2e', '#050410'], shapes }
}

function city(rng: Rng): Artwork {
  const shapes: ArtShape[] = []
  shapes.push({ kind: 'circle', cx: 0.8, cy: 0.2, r: 0.11, color: NEON.cyan, opacity: 0.14 }) // moon glow
  shapes.push({ kind: 'circle', cx: 0.8, cy: 0.2, r: 0.07, color: '#dff8ff', opacity: 0.9 })
  const n = rint(rng, 6, 8)
  const bw = 1 / n
  const cols = [NEON.blue, NEON.cyan, NEON.purple, NEON.magenta]
  for (let i = 0; i < n; i++) {
    const h = rflt(rng, 0.28, 0.6)
    const x = i * bw + bw * 0.08
    const w = bw * 0.84
    const y = 1 - h
    const col = cols[i % cols.length]
    shapes.push({ kind: 'rect', x, y, w, h, color: col, opacity: 0.32 })
    shapes.push({ kind: 'rect', x, y, w, h: 0.006, color: col, opacity: 0.9 }) // lit roofline
    const rows = Math.floor(h / 0.09)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 2; c++) {
        if (rng() < 0.5) continue
        shapes.push({ kind: 'rect', x: x + w * (0.24 + c * 0.4), y: y + 0.05 + r * 0.09, w: w * 0.2, h: 0.02, color: NEON.amber, opacity: 0.8 })
      }
    }
  }
  return { scene: 'city', bg: ['#1a0a34', '#3a1160', '#12061f'], shapes }
}

function bokeh(rng: Rng): Artwork {
  const shapes: ArtShape[] = []
  const cols = [NEON.cyan, NEON.magenta, NEON.lime, NEON.amber, NEON.purple, NEON.blue, NEON.green]
  const n = rint(rng, 7, 10)
  for (let i = 0; i < n; i++) {
    shapes.push({ kind: 'circle', cx: rflt(rng, 0.05, 0.95), cy: rflt(rng, 0.05, 0.95), r: rflt(rng, 0.1, 0.28), color: cols[Math.floor(rng() * cols.length)], opacity: rflt(rng, 0.16, 0.34) })
  }
  for (let i = 0; i < 4; i++) {
    shapes.push({ kind: 'circle', cx: rflt(rng, 0.1, 0.9), cy: rflt(rng, 0.1, 0.9), r: rflt(rng, 0.02, 0.05), color: cols[Math.floor(rng() * cols.length)], opacity: 0.9 })
  }
  return { scene: 'bokeh', bg: ['#04212e', '#0a5566', '#052a33'], shapes }
}

function burst(rng: Rng): Artwork {
  const shapes: ArtShape[] = []
  const cols = [NEON.cyan, NEON.magenta, NEON.lime, NEON.amber, NEON.purple, NEON.blue]
  const n = rint(rng, 9, 12)
  for (let i = 0; i < n; i++) {
    const rot = (180 / n) * i + rflt(rng, -4, 4)
    shapes.push({ kind: 'rect', x: 0.05, y: 0.492, w: 0.9, h: 0.016, round: 0.008, color: cols[i % cols.length], opacity: 0.55, rot })
  }
  shapes.push({ kind: 'circle', cx: 0.5, cy: 0.5, r: 0.14, color: '#ffffff', opacity: 0.12 })
  shapes.push({ kind: 'circle', cx: 0.5, cy: 0.5, r: 0.07, color: NEON.amber, opacity: 0.95 })
  return { scene: 'burst', bg: ['#0a0620', '#241046', '#0a0418'], shapes }
}

const SCENES: readonly ((rng: Rng) => Artwork)[] = [sunset, mountains, orbit, city, bokeh, burst]

/**
 * Build a deterministic, recognizable neon SCENE from (seed, variant). Pure — no
 * random, no external assets — so every puzzle's picture is reproducible and the
 * cut is always solvable by construction. `variant` selects the scene template;
 * the seed varies positions/counts within it.
 */
export function artworkFor(seed: number, variant: number): Artwork {
  const rng = mulberry32((seed ^ ((variant + 1) * 0x9e3779b1)) >>> 0)
  return SCENES[((variant % SCENES.length) + SCENES.length) % SCENES.length](rng)
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
