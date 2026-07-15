/**
 * Dots and Boxes — pure, deterministic engine.
 *
 * A grid of `dots` × `dots` dots forms `(dots-1)` × `(dots-1)` boxes. Players
 * draw the edges (line segments) between orthogonally adjacent dots. Completing
 * the fourth side of a box claims it, scores a point, and grants another turn.
 * The player owning the most boxes once every edge is drawn wins.
 *
 * The module is side-effect free: no `Math.random`, no timers, no DOM. Any
 * randomness is injected via an `Rng` so play is fully reproducible in tests.
 * Illegal moves return the SAME state reference (cheap "did nothing" check),
 * mirroring the connectfour engine's convention.
 */

export type Rng = () => number
export type Difficulty = 'easy' | 'hard'

/** 0 = the first player (the human in the UI), 1 = the second player (CPU). */
export type Player = 0 | 1

export type EdgeType = 'h' | 'v'

/**
 * An edge between two dots.
 * - Horizontal `h` at (r, c): the segment from dot (r, c) to dot (r, c+1).
 *   Valid for r ∈ [0, dots-1], c ∈ [0, dots-2].
 * - Vertical `v` at (r, c): the segment from dot (r, c) to dot (r+1, c).
 *   Valid for r ∈ [0, dots-2], c ∈ [0, dots-1].
 */
export interface Edge {
  type: EdgeType
  r: number
  c: number
}

export interface GameState {
  /** Number of dots per side (grid is dots × dots). */
  dots: number
  /** Drawn horizontal edges: h[r][c], r ∈ [0, dots-1], c ∈ [0, dots-2]. */
  h: boolean[][]
  /** Drawn vertical edges: v[r][c], r ∈ [0, dots-2], c ∈ [0, dots-1]. */
  v: boolean[][]
  /** Box ownership: owner[r][c] ∈ {0,1} or null. r,c ∈ [0, dots-2]. */
  owner: (Player | null)[][]
  /** Whose turn it is. */
  current: Player
  /** [player0 boxes, player1 boxes]. */
  scores: [number, number]
}

export interface Winner {
  /** 0 or 1 for a majority winner, or `null` for a tie. */
  player: Player | null
  scores: [number, number]
}

export const DEFAULT_DOTS = 5

export const edgeKey = (e: Edge): string => `${e.type}${e.r}-${e.c}`

const otherPlayer = (p: Player): Player => (p === 0 ? 1 : 0)

function grid<T>(rows: number, cols: number, fill: T): T[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill))
}

export function newGame(dots: number = DEFAULT_DOTS): GameState {
  const d = Math.max(2, Math.floor(dots))
  return {
    dots: d,
    h: grid(d, d - 1, false),
    v: grid(d - 1, d, false),
    owner: grid(d - 1, d - 1, null as Player | null),
    current: 0,
    scores: [0, 0],
  }
}

export const totalBoxes = (dots: number): number => (dots - 1) * (dots - 1)
export const totalEdges = (dots: number): number => 2 * dots * (dots - 1)

/** True when the edge indices are within the board. */
export function inBounds(state: GameState, edge: Edge): boolean {
  const { dots } = state
  if (edge.type === 'h') {
    return edge.r >= 0 && edge.r < dots && edge.c >= 0 && edge.c < dots - 1
  }
  return edge.r >= 0 && edge.r < dots - 1 && edge.c >= 0 && edge.c < dots
}

export function isDrawn(state: GameState, edge: Edge): boolean {
  if (!inBounds(state, edge)) return false
  return edge.type === 'h' ? state.h[edge.r][edge.c] : state.v[edge.r][edge.c]
}

/** True when a move on `edge` is legal (in bounds, undrawn, game not over). */
export function isLegal(state: GameState, edge: Edge): boolean {
  if (isOver(state)) return false
  return inBounds(state, edge) && !isDrawn(state, edge)
}

/** Every undrawn edge, row-major (horizontals then verticals). */
export function legalEdges(state: GameState): Edge[] {
  if (isOver(state)) return []
  const out: Edge[] = []
  for (let r = 0; r < state.h.length; r++) {
    for (let c = 0; c < state.h[r].length; c++) {
      if (!state.h[r][c]) out.push({ type: 'h', r, c })
    }
  }
  for (let r = 0; r < state.v.length; r++) {
    for (let c = 0; c < state.v[r].length; c++) {
      if (!state.v[r][c]) out.push({ type: 'v', r, c })
    }
  }
  return out
}

/** The 4 edges bordering box (br, bc). */
export function boxEdges(br: number, bc: number): [Edge, Edge, Edge, Edge] {
  return [
    { type: 'h', r: br, c: bc }, // top
    { type: 'h', r: br + 1, c: bc }, // bottom
    { type: 'v', r: br, c: bc }, // left
    { type: 'v', r: br, c: bc + 1 }, // right
  ]
}

/** Number of drawn sides (0–4) of box (br, bc). */
export function boxSides(state: GameState, br: number, bc: number): number {
  let n = 0
  for (const e of boxEdges(br, bc)) if (isDrawn(state, e)) n++
  return n
}

/** The boxes (0, 1, or 2) that an edge borders, as [br, bc] pairs. */
export function adjacentBoxes(state: GameState, edge: Edge): Array<[number, number]> {
  const { dots } = state
  const boxes: Array<[number, number]> = []
  if (edge.type === 'h') {
    if (edge.r - 1 >= 0) boxes.push([edge.r - 1, edge.c]) // box above
    if (edge.r < dots - 1) boxes.push([edge.r, edge.c]) // box below
  } else {
    if (edge.c - 1 >= 0) boxes.push([edge.r, edge.c - 1]) // box left
    if (edge.c < dots - 1) boxes.push([edge.r, edge.c]) // box right
  }
  return boxes
}

function cloneState(state: GameState): GameState {
  return {
    dots: state.dots,
    h: state.h.map((row) => [...row]),
    v: state.v.map((row) => [...row]),
    owner: state.owner.map((row) => [...row]),
    current: state.current,
    scores: [state.scores[0], state.scores[1]],
  }
}

/**
 * Draw `edge` for the current player. Returns a NEW state, or the SAME state
 * reference when the move is illegal (out of bounds, already drawn, game over).
 *
 * Standard rules: completing one or two boxes scores that many points and the
 * current player moves again; otherwise the turn passes to the opponent.
 */
export function drawEdge(state: GameState, edge: Edge): GameState {
  if (!isLegal(state, edge)) return state

  const next = cloneState(state)
  if (edge.type === 'h') next.h[edge.r][edge.c] = true
  else next.v[edge.r][edge.c] = true

  const me = next.current
  let completed = 0
  for (const [br, bc] of adjacentBoxes(next, edge)) {
    if (next.owner[br][bc] === null && boxSides(next, br, bc) === 4) {
      next.owner[br][bc] = me
      next.scores[me]++
      completed++
    }
  }

  // Completing at least one box grants another turn; otherwise pass.
  if (completed === 0) next.current = otherPlayer(me)
  return next
}

/** True once every box is claimed (equivalently, every edge is drawn). */
export function isOver(state: GameState): boolean {
  return state.scores[0] + state.scores[1] >= totalBoxes(state.dots)
}

/** Winner once the game is over, else `null`. `player: null` means a tie. */
export function winner(state: GameState): Winner | null {
  if (!isOver(state)) return null
  const [a, b] = state.scores
  const player: Player | null = a > b ? 0 : b > a ? 1 : null
  return { player, scores: [a, b] }
}

// ── AI ───────────────────────────────────────────────────────────────────────

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length) % items.length]
}

/** Would drawing `edge` immediately complete at least one box? */
function completesBox(state: GameState, edge: Edge): boolean {
  for (const [br, bc] of adjacentBoxes(state, edge)) {
    // 3 sides already drawn → this edge is the 4th.
    if (state.owner[br][bc] === null && boxSides(state, br, bc) === 3) return true
  }
  return false
}

/**
 * Would drawing `edge` bring some adjacent box to exactly 3 sides — i.e. hand
 * the opponent a free capture on their next move?
 */
function givesAwayBox(state: GameState, edge: Edge): boolean {
  for (const [br, bc] of adjacentBoxes(state, edge)) {
    if (state.owner[br][bc] === null && boxSides(state, br, bc) === 2) return true
  }
  return false
}

/**
 * Choose an edge for the computer.
 * - `easy`: a uniformly random legal edge.
 * - `hard`: take any box-completing move; otherwise prefer a "safe" edge that
 *   does not create the 3rd side of a box (which would give the opponent a free
 *   box); if no safe move exists, fall back to a random legal edge.
 *
 * Returns `null` only when there are no legal edges. `rng` is injected.
 */
export function aiMove(state: GameState, difficulty: Difficulty, rng: Rng): Edge | null {
  const edges = legalEdges(state)
  if (edges.length === 0) return null

  if (difficulty === 'easy') return pick(edges, rng)

  const capturing = edges.filter((e) => completesBox(state, e))
  if (capturing.length > 0) return pick(capturing, rng)

  const safe = edges.filter((e) => !givesAwayBox(state, e))
  if (safe.length > 0) return pick(safe, rng)

  return pick(edges, rng)
}
