// Splice — a turn-based graph-partition puzzle.
//
// A small seeded connected graph of colored nodes joined by edges. Each turn you
// CUT exactly one edge. Union-find recomputes connected components; any component
// that is now MONOCHROMATIC collapses for size-squared points and vanishes, which
// can chain further monochrome collapses in the SAME turn. Clear the whole network
// in as few cuts as possible; fragments left at the cut-limit cost points.
//
// Pure, deterministic engine. NO Math.random / Date / performance / DOM anywhere in
// this file. The ONLY randomness source is the injected `Rng`, and it appears ONLY
// inside generateBoard / newGame / nextLevel. Every board is generated as a set of
// monochrome blobs joined by inter-blob bridges, and the recorded bridge-cut
// solution is validated by replay so par is always a known, achievable target.

// ---------------------------------------------------------------------------
// 1.2 Constants
// ---------------------------------------------------------------------------

export const MAX_NODES = 16 // planar force-embedded layout stays unambiguous
export const MIN_NODES = 7
export const NUM_COLORS_MIN = 4
export const NUM_COLORS_MAX = 5
export const CUT_SLACK = 3 // cutBudget = par + CUT_SLACK
export const UNDO_POOL = 5 // branch-undos per board (puzzle/daily only)
export const FRAGMENT_PENALTY = 25 // points lost PER node still connected at cut-limit
export const EMPTY_COLLAPSE = 0 // (reserved; collapse score is size*size, never 0 here)
export const WIN_BONUS_UNIT = 100 // per-cut-under-par win bonus unit

// ---------------------------------------------------------------------------
// 1.3 Types
// ---------------------------------------------------------------------------

export type Rng = () => number // returns [0,1)
export type Mode = 'puzzle' | 'endless' // puzzle = daily/branch-undo hunt; endless = no-undo score
export type NodeId = number // 0..N-1
export type EdgeId = number // index into edges[], stable for the board's lifetime

/** An undirected edge between two distinct node ids. */
export interface Edge {
  a: NodeId
  b: NodeId
}

/** Immutable board topology + fixed layout. Colors never change after generation. */
export interface Board {
  n: number // node count, MIN_NODES..MAX_NODES
  colors: number[] // length n; color id 0..(numColors-1)
  numColors: number // 4 or 5
  edges: Edge[] // the ORIGINAL full edge set (indices are EdgeId)
  layout: { x: number; y: number }[] // length n; deterministic force embedding in [0,1]^2
}

export interface CollapseEvent {
  wave: number // 0-based cascade wave index within this turn
  color: number // the monochrome color that collapsed
  nodes: NodeId[] // ascending node ids that vanished together
  size: number // nodes.length
  points: number // size * size
}

/** What one cut does, fully resolved (drives both preview and apply). Pure, rng-free. */
export interface CutResult {
  legal: boolean
  edgeId: EdgeId
  /** Component id per node AFTER the cut but BEFORE collapses (for the bridge preview). */
  bridgeComponents: number[] // length n; -1 for already-removed nodes
  /** Nodes on a's side after the cut, pre-collapse (excludes removed). */
  sideA: NodeId[]
  /** Nodes on b's side (empty if the cut did not disconnect them). */
  sideB: NodeId[]
  disconnected: boolean // true iff the cut split one component into two
  collapsed: CollapseEvent[] // collapse events in resolution order
  scoreDelta: number // sum of size*size over all collapses this turn
  cascadeDepth: number // number of collapse WAVES; 0 if nothing collapsed
  aliveAfter: boolean[] // length n; final node-alive mask after all collapses settle
  componentsAfter: number[] // length n; -1 for removed nodes, else 0-based component label
}

export interface Snapshot {
  alive: boolean[]
  cutEdges: boolean[]
  score: number
  cutsUsed: number
}

/** Full mutable game state. Plain data only. */
export interface GameState {
  board: Board
  alive: boolean[] // length n; false once a node has collapsed
  cutEdges: boolean[] // length edges.length; true once an edge is cut OR removed with a node
  score: number
  cutsUsed: number
  par: number // generator-guaranteed achievable minimum cuts to fully clear
  cutBudget: number // par + CUT_SLACK
  undosLeft: number // UNDO_POOL in puzzle mode; 0 in endless
  seed: number
  mode: Mode
  level: number // 1-based (endless progression); always 1 for a daily puzzle
  solution: EdgeId[] // recorded par line (FORWARD cut order) for the ghost + hint
  history: Snapshot[] // bounded branch-undo stack (<= cutBudget deep)
  won: boolean // whole network cleared
  lost: boolean // cutBudget exhausted with nodes still alive
}

// ---------------------------------------------------------------------------
// 1.4 Deterministic PRNG
// ---------------------------------------------------------------------------

/** Pure seeded PRNG. Uses Math.imul + bit ops only — NO Math.random. */
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

/** Pure FNV-1a hash of a "YYYY-MM-DD" string -> 32-bit seed. Date is passed IN, never read here. */
export function dailySeed(dateISO: string): number {
  let h = 2166136261 >>> 0 // FNV-1a offset basis
  for (let i = 0; i < dateISO.length; i++) {
    h ^= dateISO.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ---------------------------------------------------------------------------
// 1.5 Pure graph core (rng-free, total)
// ---------------------------------------------------------------------------

/**
 * Union-find / BFS labelling over ALIVE nodes using un-cut edges. Returns comp[]
 * length n: -1 for dead nodes, else a stable 0-based label assigned in ascending
 * lowest-node order for determinism.
 */
export function components(alive: boolean[], edges: Edge[], cutEdges: boolean[]): number[] {
  const n = alive.length
  const comp = new Array<number>(n).fill(-1)
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < edges.length; i++) {
    if (cutEdges[i]) continue
    const { a, b } = edges[i]
    if (!alive[a] || !alive[b]) continue
    adj[a].push(b)
    adj[b].push(a)
  }
  let label = 0
  for (let s = 0; s < n; s++) {
    if (!alive[s] || comp[s] !== -1) continue
    comp[s] = label
    const stack = [s]
    while (stack.length > 0) {
      const u = stack.pop() as number
      for (const v of adj[u]) {
        if (comp[v] === -1) {
          comp[v] = label
          stack.push(v)
        }
      }
    }
    label++
  }
  return comp
}

/** Adjacency restricted to alive nodes and un-cut edges. */
export function liveAdjacency(state: GameState): NodeId[][] {
  const { alive, board, cutEdges } = state
  const adj: NodeId[][] = Array.from({ length: board.n }, () => [])
  for (let i = 0; i < board.edges.length; i++) {
    if (cutEdges[i]) continue
    const { a, b } = board.edges[i]
    if (!alive[a] || !alive[b]) continue
    adj[a].push(b)
    adj[b].push(a)
  }
  return adj
}

/** A component is monochromatic iff all its alive nodes share one color. Size-1 counts as mono. */
export function monochromeComponents(
  comp: number[],
  colors: number[],
): { label: number; color: number; nodes: NodeId[] }[] {
  const groups = new Map<number, NodeId[]>()
  for (let i = 0; i < comp.length; i++) {
    if (comp[i] === -1) continue
    const arr = groups.get(comp[i])
    if (arr) arr.push(i)
    else groups.set(comp[i], [i])
  }
  const out: { label: number; color: number; nodes: NodeId[] }[] = []
  for (const [label, nodes] of groups) {
    const c0 = colors[nodes[0]]
    let mono = true
    for (const nd of nodes) {
      if (colors[nd] !== c0) {
        mono = false
        break
      }
    }
    if (mono) out.push({ label, color: c0, nodes })
  }
  out.sort((x, y) => x.nodes[0] - y.nodes[0])
  return out
}

export function aliveCount(alive: boolean[]): number {
  let n = 0
  for (const a of alive) if (a) n++
  return n
}

export function isCleared(alive: boolean[]): boolean {
  return aliveCount(alive) === 0
}

/** Legal edges to cut right now: index i where !cutEdges[i] AND both endpoints alive. Ascending. */
export function legalEdges(state: GameState): EdgeId[] {
  const out: EdgeId[] = []
  const { board, cutEdges, alive } = state
  for (let i = 0; i < board.edges.length; i++) {
    if (cutEdges[i]) continue
    const { a, b } = board.edges[i]
    if (alive[a] && alive[b]) out.push(i)
  }
  return out
}

// ---------------------------------------------------------------------------
// 1.6 The reducer — previewCut, cut, undo
// ---------------------------------------------------------------------------

function illegalResult(state: GameState, edgeId: EdgeId): CutResult {
  const comp = components(state.alive, state.board.edges, state.cutEdges)
  return {
    legal: false,
    edgeId,
    bridgeComponents: comp,
    sideA: [],
    sideB: [],
    disconnected: false,
    collapsed: [],
    scoreDelta: 0,
    cascadeDepth: 0,
    aliveAfter: state.alive.slice(),
    componentsAfter: comp,
  }
}

/**
 * Pure, rng-free. Resolves the ENTIRE turn (cut + all cascade waves) without
 * touching game bookkeeping. Drives hover preview AND cut(). Never mutates input.
 */
export function previewCut(state: GameState, edgeId: EdgeId): CutResult {
  const { board } = state
  const edges = board.edges
  const legal =
    Number.isInteger(edgeId) &&
    edgeId >= 0 &&
    edgeId < edges.length &&
    !state.cutEdges[edgeId] &&
    state.alive[edges[edgeId].a] &&
    state.alive[edges[edgeId].b]
  if (!legal) return illegalResult(state, edgeId)

  const e = edges[edgeId]
  const alive = state.alive.slice()
  const cutEdges = state.cutEdges.slice()
  cutEdges[edgeId] = true

  // Component labels after the cut but before any collapse (bridge preview).
  const bridgeComponents = components(alive, edges, cutEdges)
  const compA = bridgeComponents[e.a]
  const compB = bridgeComponents[e.b]
  const disconnected = compA !== compB
  const sideA: NodeId[] = []
  const sideB: NodeId[] = []
  for (let i = 0; i < board.n; i++) {
    if (!alive[i]) continue
    if (bridgeComponents[i] === compA) sideA.push(i)
    else if (disconnected && bridgeComponents[i] === compB) sideB.push(i)
  }

  // Resolve monochrome collapses in cascade waves until a fixed point.
  const collapsed: CollapseEvent[] = []
  let scoreDelta = 0
  let wave = 0
  for (;;) {
    const comp = components(alive, edges, cutEdges)
    const monos = monochromeComponents(comp, board.colors)
    if (monos.length === 0) break
    for (const m of monos) {
      const size = m.nodes.length
      const points = size * size
      collapsed.push({ wave, color: m.color, nodes: m.nodes.slice(), size, points })
      scoreDelta += points
      for (const nd of m.nodes) alive[nd] = false
    }
    // Every edge incident to a vanished node becomes removed.
    for (let i = 0; i < edges.length; i++) {
      if (!cutEdges[i] && (!alive[edges[i].a] || !alive[edges[i].b])) cutEdges[i] = true
    }
    wave++
  }

  const componentsAfter = components(alive, edges, cutEdges)
  return {
    legal: true,
    edgeId,
    bridgeComponents,
    sideA,
    sideB,
    disconnected,
    collapsed,
    scoreDelta,
    cascadeDepth: wave,
    aliveAfter: alive,
    componentsAfter,
  }
}

/**
 * Applies one cut to game state. rng-free, never mutates input. Illegal /
 * already-finished cuts are no-ops returning the same state + an illegal CutResult.
 */
export function cut(state: GameState, edgeId: EdgeId): { state: GameState; result: CutResult } {
  if (state.won || state.lost) {
    return { state, result: illegalResult(state, edgeId) }
  }
  const result = previewCut(state, edgeId)
  if (!result.legal) return { state, result }

  const history = state.history.concat({
    alive: state.alive.slice(),
    cutEdges: state.cutEdges.slice(),
    score: state.score,
    cutsUsed: state.cutsUsed,
  })
  while (history.length > state.cutBudget) history.shift()

  const alive = result.aliveAfter.slice()
  const edges = state.board.edges
  const cutEdges = state.cutEdges.slice()
  cutEdges[edgeId] = true
  for (let i = 0; i < edges.length; i++) {
    if (!cutEdges[i] && (!alive[edges[i].a] || !alive[edges[i].b])) cutEdges[i] = true
  }

  const cutsUsed = state.cutsUsed + 1
  let score = state.score + result.scoreDelta
  let won = false
  let lost = false

  if (isCleared(alive)) {
    won = true
    score += WIN_BONUS_UNIT * Math.max(0, state.par - cutsUsed + 1)
  } else if (cutsUsed >= state.cutBudget) {
    lost = true
    score -= FRAGMENT_PENALTY * aliveCount(alive)
    if (score < 0) score = 0
  }

  return {
    state: { ...state, alive, cutEdges, score, cutsUsed, history, won, lost },
    result,
  }
}

/** Pops the newest Snapshot (branch-undo). No-op if undosLeft<=0, history empty, or endless mode. */
export function undo(state: GameState): GameState {
  if (state.mode === 'endless' || state.undosLeft <= 0 || state.history.length === 0) {
    return state
  }
  const history = state.history.slice()
  const snap = history.pop() as Snapshot
  return {
    ...state,
    alive: snap.alive.slice(),
    cutEdges: snap.cutEdges.slice(),
    score: snap.score,
    cutsUsed: snap.cutsUsed,
    undosLeft: state.undosLeft - 1,
    won: false,
    lost: false,
    history,
  }
}

// ---------------------------------------------------------------------------
// 1.7 Generation (rng-only entry points; provably solvable, yields par)
// ---------------------------------------------------------------------------

/** Deterministic spring/force embedding into [0,1]^2. Seeded ONLY by the injected rng. */
function forceLayout(rng: Rng, n: number, edges: Edge[]): { x: number; y: number }[] {
  const pos = new Array<{ x: number; y: number }>(n)
  for (let i = 0; i < n; i++) pos[i] = { x: rng(), y: rng() }
  const iters = 80
  const k = Math.sqrt(1 / n) // ideal edge length
  for (let it = 0; it < iters; it++) {
    const disp = Array.from({ length: n }, () => ({ x: 0, y: 0 }))
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x
        let dy = pos[i].y - pos[j].y
        let d2 = dx * dx + dy * dy
        if (d2 < 1e-9) {
          dx = 1e-4
          dy = 1e-4
          d2 = 2e-8
        }
        const d = Math.sqrt(d2)
        const rep = ((k * k) / d) / 25
        disp[i].x += (dx / d) * rep
        disp[i].y += (dy / d) * rep
        disp[j].x -= (dx / d) * rep
        disp[j].y -= (dy / d) * rep
      }
    }
    for (const e of edges) {
      const dx = pos[e.a].x - pos[e.b].x
      const dy = pos[e.a].y - pos[e.b].y
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-4
      const att = ((d * d) / k) / 25
      disp[e.a].x -= (dx / d) * att
      disp[e.a].y -= (dy / d) * att
      disp[e.b].x += (dx / d) * att
      disp[e.b].y += (dy / d) * att
    }
    for (let i = 0; i < n; i++) {
      pos[i].x += disp[i].x
      pos[i].y += disp[i].y
    }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pos) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const w = maxX - minX || 1
  const h = maxY - minY || 1
  return pos.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h }))
}

function makeState(
  board: Board,
  par: number,
  solution: EdgeId[],
  mode: Mode,
  seed: number,
  level: number,
): GameState {
  return {
    board,
    alive: new Array<boolean>(board.n).fill(true),
    cutEdges: new Array<boolean>(board.edges.length).fill(false),
    score: 0,
    cutsUsed: 0,
    par,
    cutBudget: par + CUT_SLACK,
    undosLeft: mode === 'puzzle' ? UNDO_POOL : 0,
    seed,
    mode,
    level,
    solution,
    history: [],
    won: false,
    lost: false,
  }
}

/** Replay the recorded bridge-cut solution and assert it clears the board in exactly par cuts. */
function validateSolution(board: Board, par: number, solution: EdgeId[]): boolean {
  let state = makeState(board, par, solution, 'endless', 0, 1)
  for (const eid of solution) {
    const r = cut(state, eid)
    if (!r.result.legal) return false
    state = r.state
  }
  return state.won && isCleared(state.alive) && state.cutsUsed === par
}

/** Build one candidate colored graph; returns null if greedy coloring or replay fails. */
function tryGenerate(
  rng: Rng,
  level: number,
): { board: Board; par: number; solution: EdgeId[] } | null {
  const numColors = rng() < 0.5 ? NUM_COLORS_MIN : NUM_COLORS_MAX
  const maxN = Math.min(MAX_NODES, 6 + level)
  const n = MIN_NODES + Math.floor(rng() * (maxN - MIN_NODES + 1))

  const maxBlobs = Math.min(n, 6)
  let blobCount = 3 + Math.floor(rng() * Math.max(1, maxBlobs - 2))
  blobCount = Math.max(3, Math.min(maxBlobs, blobCount))

  // Distribute n nodes into blobCount monochrome blobs, each >= 1 node.
  const sizes = new Array<number>(blobCount).fill(1)
  let rem = n - blobCount
  while (rem > 0) {
    sizes[Math.floor(rng() * blobCount)]++
    rem--
  }

  const blobOf = new Array<number>(n)
  const blobNodes: number[][] = Array.from({ length: blobCount }, () => [])
  let idx = 0
  for (let b = 0; b < blobCount; b++) {
    for (let k = 0; k < sizes[b]; k++) {
      blobOf[idx] = b
      blobNodes[b].push(idx)
      idx++
    }
  }

  const edges: Edge[] = []

  // Intra-blob edges: wire each blob into a connected random tree (same color).
  for (let b = 0; b < blobCount; b++) {
    const nodes = blobNodes[b]
    for (let k = 1; k < nodes.length; k++) {
      const parent = nodes[Math.floor(rng() * k)]
      edges.push({ a: parent, b: nodes[k] })
    }
  }

  // Inter-blob bridges: a spanning tree over blobs (numBlobs-1 bridges).
  const bridgeEdgeIds: EdgeId[] = []
  const blobAdj: Set<number>[] = Array.from({ length: blobCount }, () => new Set<number>())
  for (let b = 1; b < blobCount; b++) {
    const pb = Math.floor(rng() * b)
    const u = blobNodes[b][Math.floor(rng() * blobNodes[b].length)]
    const v = blobNodes[pb][Math.floor(rng() * blobNodes[pb].length)]
    edges.push({ a: v, b: u })
    bridgeEdgeIds.push(edges.length - 1)
    blobAdj[b].add(pb)
    blobAdj[pb].add(b)
  }

  // A few extra bridges between not-yet-adjacent blobs (adds cascade combos).
  const extra = Math.floor(rng() * 3)
  for (let e = 0; e < extra; e++) {
    const b1 = Math.floor(rng() * blobCount)
    const b2 = Math.floor(rng() * blobCount)
    if (b1 === b2 || blobAdj[b1].has(b2)) continue
    const u = blobNodes[b1][Math.floor(rng() * blobNodes[b1].length)]
    const v = blobNodes[b2][Math.floor(rng() * blobNodes[b2].length)]
    edges.push({ a: u, b: v })
    bridgeEdgeIds.push(edges.length - 1)
    blobAdj[b1].add(b2)
    blobAdj[b2].add(b1)
  }

  // Greedy-color the blob graph so every bridged pair differs (keeps bridges non-mono).
  const blobColor = new Array<number>(blobCount).fill(-1)
  for (let b = 0; b < blobCount; b++) {
    const used = new Set<number>()
    for (const nb of blobAdj[b]) if (blobColor[nb] >= 0) used.add(blobColor[nb])
    let chosen = -1
    for (let c = 0; c < numColors; c++) {
      if (!used.has(c)) {
        chosen = c
        break
      }
    }
    if (chosen < 0) return null
    blobColor[b] = chosen
  }

  const colors = new Array<number>(n)
  for (let i = 0; i < n; i++) colors[i] = blobColor[blobOf[i]]

  const layout = forceLayout(rng, n, edges)
  const board: Board = { n, colors, numColors, edges, layout }
  const par = bridgeEdgeIds.length
  const solution = bridgeEdgeIds.slice()

  if (par < 1) return null
  if (!validateSolution(board, par, solution)) return null
  return { board, par, solution }
}

/** A trivial, always-solvable fallback: a colored path where every edge is a bridge. */
function fallbackBoard(rng: Rng): { board: Board; par: number; solution: EdgeId[] } {
  const numColors = NUM_COLORS_MIN
  const n = MIN_NODES
  const colors = new Array<number>(n)
  for (let i = 0; i < n; i++) colors[i] = i % numColors
  const edges: Edge[] = []
  const solution: EdgeId[] = []
  for (let i = 1; i < n; i++) {
    edges.push({ a: i - 1, b: i })
    solution.push(i - 1)
  }
  const layout = forceLayout(rng, n, edges)
  const board: Board = { n, colors, numColors, edges, layout }
  return { board, par: solution.length, solution }
}

/**
 * Build a connected colored graph with a KNOWN achievable par. Strategy: grow K
 * monochrome blobs, join them with inter-blob bridges (a spanning tree + a few
 * extras), color blobs so bridged pairs differ, and record the bridge-cut order as
 * `solution`. Because a bridge's two blobs are differently colored, neither can
 * collapse while the bridge is uncut, so replaying `solution` forward always clears
 * in exactly par = (#bridges) cuts. Validated by replay; falls back to a trivial
 * path on the rare failure.
 */
export function generateBoard(
  rng: Rng,
  level: number,
): { board: Board; par: number; solution: EdgeId[] } {
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = tryGenerate(rng, level)
    if (candidate) return candidate
  }
  return fallbackBoard(rng)
}

export function newGame(rng: Rng, mode: Mode, seed: number, level: number): GameState {
  const { board, par, solution } = generateBoard(rng, level)
  return makeState(board, par, solution, mode, seed, level)
}

export function nextLevel(state: GameState, rng: Rng, seed: number): GameState {
  const level = state.level + 1
  const { board, par, solution } = generateBoard(rng, level)
  const fresh = makeState(board, par, solution, state.mode, seed, level)
  return { ...fresh, score: state.score } // carry score across the endless run
}
