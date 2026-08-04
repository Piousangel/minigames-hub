/**
 * Flow — "Flow Free" style connect-the-dots pipe puzzle (pure engine).
 *
 * A square grid holds pairs of coloured endpoint dots. The player draws a pipe
 * connecting each colour's two dots. Pipes may not cross or overlap. You WIN
 * when every pair is connected end-to-end AND every cell of the grid is filled
 * (100% coverage).
 *
 * PURITY: every function here is pure and total. NO timers, NO `Date`, NO
 * `Math.random`. Levels are hand-authored/verified static data (no runtime
 * generation). All mutating ops are (state, …) -> state and REJECT illegal
 * moves by returning the SAME state reference (so callers/tests assert a no-op
 * with `===`). `paths` is the single source of truth; `owner` is a derived
 * cache rebuilt on every op — bulletproof, and cheap at ≤7×7.
 *
 * `solve(level)` is a backtracking full-cover solver used ONLY by tests to
 * prove each bank level is genuinely solvable. It is not used at runtime.
 */

export type Cell = [number, number] // [row, col]

export interface Pair {
  color: string // a neon palette name: cyan | magenta | lime | amber | purple | blue | red | green
  a: Cell
  b: Cell
}

export interface Level {
  size: number
  pairs: Pair[]
}

export type Status = 'playing' | 'won'

export interface FlowState {
  levelIndex: number
  size: number
  pairs: Pair[]
  /** color -> ordered path (cells), always starting at one endpoint. May be empty. */
  paths: Record<string, Cell[]>
  /** derived: cell index (r*size+c) -> owning color, or null. */
  owner: (string | null)[]
  status: Status
  moves: number
}

// -- small cell utilities ----------------------------------------------------

export function eq(a: Cell, b: Cell): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

export function adjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1
}

function oi(size: number, r: number, c: number): number {
  return r * size + c
}

function inBounds(size: number, cell: Cell): boolean {
  return cell[0] >= 0 && cell[0] < size && cell[1] >= 0 && cell[1] < size
}

// -- level bank --------------------------------------------------------------
//
// 26 hand-verified levels (10× 5×5, 8× 6×6, 8× 7×7), progressive difficulty.
// Every level was generated as a FULL-COVERAGE path partition of its grid, so a
// 100%-solution provably exists; `engine.test.ts` re-proves each one with
// `solve()`. Endpoints are given as [row, col].

export const LEVELS: Level[] = [
  { size: 5, pairs: [
    { color: 'cyan', a: [3, 0], b: [1, 1] },
    { color: 'magenta', a: [4, 4], b: [0, 4] },
    { color: 'lime', a: [3, 2], b: [2, 3] },
    { color: 'amber', a: [3, 1], b: [4, 0] },
  ] },
  { size: 5, pairs: [
    { color: 'cyan', a: [2, 4], b: [3, 3] },
    { color: 'magenta', a: [1, 1], b: [4, 0] },
    { color: 'lime', a: [0, 4], b: [1, 0] },
    { color: 'amber', a: [1, 4], b: [1, 2] },
  ] },
  { size: 5, pairs: [
    { color: 'cyan', a: [2, 2], b: [4, 4] },
    { color: 'magenta', a: [0, 1], b: [0, 2] },
    { color: 'lime', a: [2, 1], b: [3, 1] },
    { color: 'amber', a: [2, 3], b: [0, 4] },
  ] },
  { size: 5, pairs: [
    { color: 'cyan', a: [0, 2], b: [0, 1] },
    { color: 'magenta', a: [2, 4], b: [0, 4] },
    { color: 'lime', a: [2, 3], b: [3, 4] },
    { color: 'amber', a: [4, 0], b: [2, 2] },
  ] },
  { size: 5, pairs: [
    { color: 'cyan', a: [1, 1], b: [0, 4] },
    { color: 'magenta', a: [2, 1], b: [2, 0] },
    { color: 'lime', a: [3, 2], b: [4, 0] },
    { color: 'amber', a: [4, 3], b: [4, 4] },
  ] },
  { size: 5, pairs: [
    { color: 'cyan', a: [3, 2], b: [4, 0] },
    { color: 'magenta', a: [2, 4], b: [4, 4] },
    { color: 'lime', a: [1, 2], b: [2, 0] },
    { color: 'amber', a: [0, 3], b: [0, 0] },
    { color: 'purple', a: [0, 4], b: [2, 3] },
  ] },
  { size: 5, pairs: [
    { color: 'cyan', a: [3, 1], b: [0, 0] },
    { color: 'magenta', a: [3, 2], b: [2, 1] },
    { color: 'lime', a: [0, 4], b: [1, 2] },
    { color: 'amber', a: [2, 3], b: [4, 0] },
    { color: 'purple', a: [2, 4], b: [4, 4] },
  ] },
  { size: 5, pairs: [
    { color: 'cyan', a: [0, 1], b: [0, 0] },
    { color: 'magenta', a: [2, 4], b: [0, 4] },
    { color: 'lime', a: [4, 1], b: [4, 0] },
    { color: 'amber', a: [4, 4], b: [3, 4] },
    { color: 'purple', a: [2, 3], b: [2, 0] },
  ] },
  { size: 5, pairs: [
    { color: 'cyan', a: [0, 0], b: [0, 1] },
    { color: 'magenta', a: [3, 2], b: [2, 2] },
    { color: 'lime', a: [2, 4], b: [4, 4] },
    { color: 'amber', a: [4, 0], b: [3, 0] },
    { color: 'purple', a: [0, 3], b: [1, 3] },
  ] },
  { size: 6, pairs: [
    { color: 'cyan', a: [0, 1], b: [1, 4] },
    { color: 'magenta', a: [0, 0], b: [1, 1] },
    { color: 'lime', a: [3, 3], b: [5, 5] },
    { color: 'amber', a: [4, 3], b: [3, 2] },
    { color: 'purple', a: [5, 0], b: [5, 3] },
  ] },
  { size: 6, pairs: [
    { color: 'cyan', a: [5, 4], b: [5, 5] },
    { color: 'magenta', a: [1, 3], b: [0, 5] },
    { color: 'lime', a: [3, 1], b: [2, 3] },
    { color: 'amber', a: [1, 1], b: [1, 0] },
    { color: 'purple', a: [5, 1], b: [5, 0] },
  ] },
  { size: 6, pairs: [
    { color: 'cyan', a: [4, 0], b: [3, 0] },
    { color: 'magenta', a: [3, 2], b: [5, 2] },
    { color: 'lime', a: [1, 5], b: [3, 3] },
    { color: 'amber', a: [1, 4], b: [0, 5] },
    { color: 'purple', a: [2, 2], b: [1, 3] },
    { color: 'blue', a: [4, 4], b: [5, 4] },
  ] },
  { size: 6, pairs: [
    { color: 'cyan', a: [5, 1], b: [1, 5] },
    { color: 'magenta', a: [2, 2], b: [0, 3] },
    { color: 'lime', a: [3, 2], b: [3, 3] },
    { color: 'amber', a: [0, 0], b: [0, 1] },
    { color: 'purple', a: [4, 1], b: [5, 0] },
    { color: 'blue', a: [2, 1], b: [2, 0] },
  ] },
  { size: 6, pairs: [
    { color: 'cyan', a: [1, 4], b: [0, 0] },
    { color: 'magenta', a: [2, 4], b: [5, 5] },
    { color: 'lime', a: [1, 2], b: [1, 3] },
    { color: 'amber', a: [2, 1], b: [2, 0] },
    { color: 'purple', a: [4, 1], b: [3, 2] },
  ] },
  { size: 6, pairs: [
    { color: 'cyan', a: [1, 2], b: [4, 0] },
    { color: 'magenta', a: [1, 3], b: [1, 4] },
    { color: 'lime', a: [0, 0], b: [0, 2] },
    { color: 'amber', a: [3, 5], b: [2, 3] },
    { color: 'purple', a: [4, 4], b: [4, 5] },
    { color: 'blue', a: [3, 2], b: [5, 2] },
  ] },
  { size: 6, pairs: [
    { color: 'cyan', a: [4, 4], b: [5, 0] },
    { color: 'magenta', a: [2, 2], b: [0, 0] },
    { color: 'lime', a: [2, 0], b: [2, 1] },
    { color: 'amber', a: [2, 4], b: [3, 2] },
    { color: 'purple', a: [3, 5], b: [0, 5] },
    { color: 'blue', a: [0, 3], b: [2, 3] },
  ] },
  { size: 6, pairs: [
    { color: 'cyan', a: [0, 5], b: [3, 5] },
    { color: 'magenta', a: [0, 0], b: [2, 0] },
    { color: 'lime', a: [2, 2], b: [0, 1] },
    { color: 'amber', a: [4, 3], b: [5, 5] },
    { color: 'purple', a: [3, 2], b: [5, 2] },
    { color: 'blue', a: [0, 3], b: [3, 3] },
  ] },
  { size: 6, pairs: [
    { color: 'cyan', a: [1, 0], b: [0, 0] },
    { color: 'magenta', a: [5, 4], b: [5, 5] },
    { color: 'lime', a: [2, 5], b: [1, 5] },
    { color: 'amber', a: [0, 3], b: [1, 3] },
    { color: 'purple', a: [4, 2], b: [3, 3] },
    { color: 'blue', a: [5, 0], b: [5, 2] },
    { color: 'red', a: [3, 0], b: [4, 0] },
  ] },
  { size: 7, pairs: [
    { color: 'cyan', a: [6, 0], b: [5, 0] },
    { color: 'magenta', a: [0, 4], b: [3, 2] },
    { color: 'lime', a: [2, 6], b: [1, 6] },
    { color: 'amber', a: [4, 5], b: [1, 3] },
    { color: 'purple', a: [1, 0], b: [1, 1] },
    { color: 'blue', a: [5, 3], b: [6, 6] },
  ] },
  { size: 7, pairs: [
    { color: 'cyan', a: [4, 2], b: [6, 0] },
    { color: 'magenta', a: [4, 6], b: [1, 5] },
    { color: 'lime', a: [5, 6], b: [6, 6] },
    { color: 'amber', a: [1, 2], b: [3, 0] },
    { color: 'purple', a: [4, 5], b: [6, 4] },
    { color: 'blue', a: [2, 4], b: [4, 3] },
  ] },
  { size: 7, pairs: [
    { color: 'cyan', a: [4, 1], b: [1, 0] },
    { color: 'magenta', a: [0, 5], b: [0, 2] },
    { color: 'lime', a: [5, 0], b: [6, 0] },
    { color: 'amber', a: [4, 4], b: [0, 6] },
    { color: 'purple', a: [4, 6], b: [2, 4] },
    { color: 'blue', a: [5, 3], b: [6, 3] },
  ] },
  { size: 7, pairs: [
    { color: 'cyan', a: [1, 1], b: [6, 0] },
    { color: 'magenta', a: [0, 6], b: [6, 2] },
    { color: 'lime', a: [0, 5], b: [1, 5] },
    { color: 'amber', a: [0, 0], b: [2, 1] },
    { color: 'purple', a: [5, 4], b: [0, 3] },
    { color: 'blue', a: [4, 1], b: [3, 3] },
  ] },
  { size: 7, pairs: [
    { color: 'cyan', a: [5, 5], b: [6, 6] },
    { color: 'magenta', a: [0, 5], b: [1, 5] },
    { color: 'lime', a: [3, 1], b: [6, 0] },
    { color: 'amber', a: [1, 2], b: [0, 0] },
    { color: 'purple', a: [3, 2], b: [3, 4] },
    { color: 'blue', a: [2, 3], b: [0, 4] },
    { color: 'red', a: [2, 2], b: [3, 0] },
  ] },
  { size: 7, pairs: [
    { color: 'cyan', a: [1, 2], b: [1, 1] },
    { color: 'magenta', a: [4, 0], b: [6, 0] },
    { color: 'lime', a: [5, 3], b: [0, 3] },
    { color: 'amber', a: [3, 0], b: [2, 2] },
    { color: 'purple', a: [3, 4], b: [0, 6] },
    { color: 'blue', a: [6, 2], b: [4, 1] },
    { color: 'red', a: [6, 6], b: [4, 5] },
  ] },
  { size: 7, pairs: [
    { color: 'cyan', a: [5, 0], b: [6, 6] },
    { color: 'magenta', a: [2, 0], b: [4, 2] },
    { color: 'lime', a: [2, 5], b: [0, 6] },
    { color: 'amber', a: [2, 4], b: [3, 6] },
    { color: 'purple', a: [1, 2], b: [0, 4] },
    { color: 'blue', a: [2, 1], b: [3, 3] },
    { color: 'red', a: [1, 1], b: [0, 1] },
  ] },
  { size: 7, pairs: [
    { color: 'cyan', a: [3, 0], b: [5, 0] },
    { color: 'magenta', a: [0, 0], b: [2, 0] },
    { color: 'lime', a: [0, 6], b: [5, 6] },
    { color: 'amber', a: [1, 4], b: [3, 1] },
    { color: 'purple', a: [2, 4], b: [0, 1] },
    { color: 'blue', a: [1, 3], b: [0, 5] },
    { color: 'red', a: [6, 2], b: [4, 2] },
  ] },
]

export const LEVEL_COUNT = LEVELS.length

/** Human difficulty label from grid size. */
export function difficultyOf(level: Level): string {
  return level.size <= 5 ? 'Easy' : level.size === 6 ? 'Medium' : 'Hard'
}

// -- derivation helpers ------------------------------------------------------

function computeOwner(size: number, pairs: Pair[], paths: Record<string, Cell[]>): (string | null)[] {
  const owner: (string | null)[] = new Array(size * size).fill(null)
  for (const p of pairs) {
    const path = paths[p.color]
    if (!path) continue
    for (const cell of path) owner[oi(size, cell[0], cell[1])] = p.color
  }
  return owner
}

/** Is `cell` the endpoint of some colour? Returns that colour, else null. */
export function endpointColorAt(state: FlowState, cell: Cell): string | null {
  for (const p of state.pairs) {
    if (eq(p.a, cell) || eq(p.b, cell)) return p.color
  }
  return null
}

function endpointsOf(state: FlowState, color: string): [Cell, Cell] | null {
  const p = state.pairs.find((x) => x.color === color)
  return p ? [p.a, p.b] : null
}

function isEndpointOfColor(state: FlowState, cell: Cell, color: string): boolean {
  const ep = endpointsOf(state, color)
  return ep ? eq(ep[0], cell) || eq(ep[1], cell) : false
}

export function ownerAt(state: FlowState, cell: Cell): string | null {
  if (!inBounds(state.size, cell)) return null
  return state.owner[oi(state.size, cell[0], cell[1])]
}

/** A colour's path connects its two endpoints end-to-end. */
export function isConnected(state: FlowState, color: string): boolean {
  const path = state.paths[color]
  const ep = endpointsOf(state, color)
  if (!path || !ep || path.length < 2) return false
  const first = path[0]
  const last = path[path.length - 1]
  return (
    (eq(first, ep[0]) && eq(last, ep[1])) || (eq(first, ep[1]) && eq(last, ep[0]))
  )
}

export function connectedCount(state: FlowState): number {
  return state.pairs.reduce((n, p) => n + (isConnected(state, p.color) ? 1 : 0), 0)
}

export function filledCount(state: FlowState): number {
  let n = 0
  for (const o of state.owner) if (o !== null) n++
  return n
}

export function totalCells(state: FlowState): number {
  return state.size * state.size
}

/** WIN: every pair connected AND every cell owned (100% coverage). */
export function isSolved(state: FlowState): boolean {
  if (filledCount(state) !== totalCells(state)) return false
  return state.pairs.every((p) => isConnected(state, p.color))
}

// -- state construction ------------------------------------------------------

/** Build a fresh state from a bank level index (empty paths). */
export function createLevel(levelIndex: number): FlowState {
  const idx = ((levelIndex % LEVEL_COUNT) + LEVEL_COUNT) % LEVEL_COUNT
  const level = LEVELS[idx]
  const paths: Record<string, Cell[]> = {}
  for (const p of level.pairs) paths[p.color] = []
  const owner = computeOwner(level.size, level.pairs, paths)
  return {
    levelIndex: idx,
    size: level.size,
    pairs: level.pairs,
    paths,
    owner,
    status: 'playing',
    moves: 0,
  }
}

/** Re-derive owner + win status for a fresh `paths`; returns a new state. */
function finalize(base: FlowState, paths: Record<string, Cell[]>, moves: number): FlowState {
  const owner = computeOwner(base.size, base.pairs, paths)
  const next: FlowState = {
    ...base,
    paths,
    owner,
    moves,
    status: 'playing',
  }
  if (isSolved(next)) next.status = 'won'
  return next
}

function clonePaths(paths: Record<string, Cell[]>): Record<string, Cell[]> {
  const out: Record<string, Cell[]> = {}
  for (const k in paths) out[k] = paths[k]
  return out
}

// -- pure ops (illegal → same reference) -------------------------------------

/**
 * Begin (or grab) a path for `color` at `cell`.
 *  - If `cell` is already part of colour's path, TRUNCATE the path to end at it
 *    (lets you grab any point of your own pipe and redraw from there).
 *  - Else if `cell` is an endpoint of `color`, start a FRESH path from it
 *    (clearing the colour's old path — pressing a dot restarts its line).
 *  - Otherwise illegal → same reference.
 */
export function startPath(state: FlowState, color: string, cell: Cell): FlowState {
  if (state.status === 'won') return state
  if (!endpointsOf(state, color)) return state
  if (!inBounds(state.size, cell)) return state
  const path = state.paths[color] ?? []
  const idx = path.findIndex((c) => eq(c, cell))

  if (idx >= 0) {
    if (idx === path.length - 1) return state // grabbing the head — no change
    const paths = clonePaths(state.paths)
    paths[color] = path.slice(0, idx + 1)
    return finalize(state, paths, state.moves)
  }

  if (isEndpointOfColor(state, cell, color)) {
    if (path.length === 1 && eq(path[0], cell)) return state
    const paths = clonePaths(state.paths)
    paths[color] = [cell]
    return finalize(state, paths, state.moves)
  }

  return state
}

/**
 * Extend `color`'s path toward `cell` (must be orthogonally adjacent to the
 * head). Handles:
 *  - RETRACT: dragging back onto the previous cell pops the head.
 *  - EXTEND: onto an empty cell (or the colour's far endpoint) appends it.
 *  - CUT: onto a cell owned by ANOTHER colour clears that colour's path from
 *    the cut point onward, then claims the cell.
 * Illegal (self-cross, non-adjacent, over another colour's endpoint, or past a
 * completed endpoint) → same reference.
 */
export function extendPath(state: FlowState, color: string, cell: Cell): FlowState {
  if (state.status === 'won') return state
  if (!inBounds(state.size, cell)) return state
  const path = state.paths[color]
  if (!path || path.length === 0) return state
  const head = path[path.length - 1]
  if (eq(cell, head)) return state

  // RETRACT — dragging back over the second-to-last cell.
  if (path.length >= 2 && eq(cell, path[path.length - 2])) {
    const paths = clonePaths(state.paths)
    paths[color] = path.slice(0, path.length - 1)
    return finalize(state, paths, state.moves + 1)
  }

  if (!adjacent(cell, head)) return state

  // If the head is already the far endpoint, the line is complete — no growing
  // past it (only retract, handled above).
  const headIsFarEnd = isEndpointOfColor(state, head, color) && !eq(head, path[0])
  if (path.length > 1 && headIsFarEnd) return state

  const occ = ownerAt(state, cell)
  if (occ === color) return state // would loop / self-cross

  // Never overwrite another colour's endpoint dot.
  const cellEndpointColor = endpointColorAt(state, cell)
  if (cellEndpointColor && cellEndpointColor !== color) return state

  const paths = clonePaths(state.paths)

  if (occ && occ !== color) {
    // CUT the other colour at this cell (remove cell..end).
    const other = paths[occ]
    const cutIdx = other.findIndex((c) => eq(c, cell))
    if (cutIdx >= 0) paths[occ] = other.slice(0, cutIdx)
  }

  paths[color] = [...path, cell]
  return finalize(state, paths, state.moves + 1)
}

/** Clear a colour's entire path. Empty already → same reference. */
export function clearPath(state: FlowState, color: string): FlowState {
  if (state.status === 'won') return state
  const path = state.paths[color]
  if (!path || path.length === 0) return state
  const paths = clonePaths(state.paths)
  paths[color] = []
  return finalize(state, paths, state.moves + 1)
}

/** Reset every path on the current level (keep the same level). */
export function clearAll(state: FlowState): FlowState {
  const empty = state.pairs.some((p) => (state.paths[p.color] ?? []).length > 0)
  if (!empty && state.status !== 'won') return state
  const paths: Record<string, Cell[]> = {}
  for (const p of state.pairs) paths[p.color] = []
  return finalize(state, paths, 0)
}

// -- solver (TESTS ONLY) -----------------------------------------------------

/**
 * Backtracking full-cover solver. Returns true iff the level has a solution
 * that connects every pair AND covers every cell. Used only to prove the bank
 * is solvable; not fast for huge grids, but the bank is ≤7×7.
 */
export function solve(level: Level): boolean {
  const N = level.size
  const owner = new Array<number>(N * N).fill(-1)
  const idx = (r: number, c: number) => r * N + c
  const inB = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N
  const colors = level.pairs.map((p, k) => ({
    k,
    a: idx(p.a[0], p.a[1]),
    b: idx(p.b[0], p.b[1]),
  }))
  for (const c of colors) {
    owner[c.a] = c.k
    owner[c.b] = c.k
  }
  const DIRS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  let steps = 0
  const CAP = 20_000_000

  function extend(cur: number, k: number, bk: number, nextK: number): boolean {
    if (++steps > CAP) return false
    const r = Math.floor(cur / N)
    const c = cur % N
    for (const [dr, dc] of DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (!inB(nr, nc)) continue
      const ni = idx(nr, nc)
      if (ni === bk) {
        if (dfs(nextK)) return true
      } else if (owner[ni] === -1) {
        owner[ni] = k
        if (extend(ni, k, bk, nextK)) return true
        owner[ni] = -1
      }
    }
    return false
  }

  function dfs(k: number): boolean {
    if (k === colors.length) {
      for (let i = 0; i < N * N; i++) if (owner[i] === -1) return false
      return true
    }
    return extend(colors[k].a, colors[k].k, colors[k].b, k + 1)
  }

  return dfs(0)
}
