/**
 * Pinwheel — pure engine.
 *
 * The board is an odd square lattice. `N` anchors (hollow rings) never move.
 * `N` motes (dots) start scattered and form ONE rigid constellation. A move is:
 * plant a pin on any cell, spin the whole constellation 90° about it. After the
 * rotation, every mote sitting on an unclaimed anchor is pinned there forever
 * and drops out of the constellation (and becomes a wall). If any mote lands
 * off-board or on a pinned mote, the constellation shatters — instant loss.
 * Win when all `N` motes are pinned.
 *
 * There are no individual moves. The only channel to a solution is shedding.
 *
 * Every function here is pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters only through an injected `Rng`, used solely
 * in board generation — the reducer consumes zero rng, so every spin / shed /
 * score outcome is golden-testable from a fixed script.
 */

export type Rng = () => number // returns a float in [0,1)

export interface Point {
  x: number
  y: number
}

/** `id` is stable for the whole run: the index of the anchor it solves onto. */
export interface Mote extends Point {
  id: number
}

export type Dir = 'cw' | 'ccw'

export interface PinwheelConfig {
  width: number // must equal height, must be odd
  height: number
  motes: number // N
  scramble: number // M reverse steps == generated par; must be >= motes
}

export type PinwheelEvent =
  | 'none'
  | 'spin'
  | 'lock'
  | 'multilock'
  | 'crash'
  | 'undo'
  | 'win'
  | 'illegal'

export interface SpinOutcome {
  /** Raw rotated positions of EVERY input mote, input order, ids kept. */
  landed: Mote[]
  crashed: boolean
  /** Indices into `landed` that are OOB or hit a pinned mote (ascending). */
  crashIdx: number[]
  /** Survivors still free after shedding. When crashed: === landed. */
  motes: Mote[]
  /** Motes that pinned THIS spin, at their anchor cells. When crashed: []. */
  shed: Mote[]
  /** Full pinned list after this spin. When crashed: state.locked unchanged. */
  locked: Mote[]
  won: boolean
}

export interface UndoEntry {
  motes: Mote[]
  locked: Mote[]
  moves: number
  score: number
  bestShed: number
}

export interface PinwheelState {
  config: PinwheelConfig
  seed: number
  /** N distinct in-bounds cells; immutable for the run. */
  anchors: Point[]
  /** Unlocked — the rigid constellation. */
  motes: Mote[]
  /** Pinned; each sits exactly on an anchor cell. */
  locked: Mote[]
  moves: number
  /** Proven upper bound (generation script length). */
  par: number
  score: number
  /** Largest shed count in a single spin this run. */
  bestShed: number
  undoStack: UndoEntry[]
  undosLeft: number
  won: boolean
  dead: boolean
  lastEvent: PinwheelEvent
  lastSpin: SpinOutcome | null
  lastPivot: Point | null
}

export type PinwheelAction =
  | { type: 'spin'; pivot: Point; dir: Dir }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'new'; seed: number }

export const UNDO_POOL = 3
export const LOCK_BASE = 100
export const MULTI_BASE = 150
export const WIN_BONUS = 1000
export const PAR_BONUS_MAX = 1000
export const UNLOCK_P = 0.6
export const MAX_GEN_ATTEMPTS = 30

export const DIFFICULTIES = {
  easy: { width: 5, height: 5, motes: 3, scramble: 4 },
  normal: { width: 7, height: 7, motes: 4, scramble: 6 },
  hard: { width: 7, height: 7, motes: 5, scramble: 8 },
} satisfies Record<'easy' | 'normal' | 'hard', PinwheelConfig>

export const DEFAULT_CONFIG: PinwheelConfig = DIFFICULTIES.normal

// -- Primitives -------------------------------------------------------------

/** Identical impl to decant's mulberry32. */
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

/**
 * Integer-exact 90° lattice rotation about `pivot`.
 *
 * Screen coords are y-down, so `ccw` (right → up) reads counter-clockwise on
 * screen. `cw` is its exact inverse. The visual direction is load-bearing.
 */
export function rotate(p: Point, pivot: Point, dir: Dir): Point {
  const dx = p.x - pivot.x
  const dy = p.y - pivot.y
  return dir === 'ccw'
    ? { x: pivot.x + dy, y: pivot.y - dx }
    : { x: pivot.x - dy, y: pivot.y + dx }
}

export function inv(dir: Dir): Dir {
  return dir === 'cw' ? 'ccw' : 'cw'
}

export function rotateMote(m: Mote, pivot: Point, dir: Dir): Mote {
  const p = rotate(m, pivot, dir)
  return { id: m.id, x: p.x, y: p.y }
}

export function keyOf(p: Point): string {
  return `${p.x},${p.y}`
}

export function inBounds(p: Point, cfg: PinwheelConfig): boolean {
  return p.x >= 0 && p.x < cfg.width && p.y >= 0 && p.y < cfg.height
}

/** Canonical order: by y, then x. Non-mutating. */
export function sortPoints<T extends Point>(a: T[]): T[] {
  return a.slice().sort((p, q) => (p.y - q.y) || (p.x - q.x))
}

/**
 * Identifies a configuration exactly. The constellation is rigid, so the
 * sorted cell set determines it.
 */
export function stateKey(motes: Point[], locked: Point[]): string {
  return (
    sortPoints(motes).map(keyOf).join(';') + '|' + sortPoints(locked).map(keyOf).join(';')
  )
}

/** Anchors with no pinned mote on them; preserves anchors' order. */
export function freeAnchors(anchors: Point[], locked: Point[]): Point[] {
  const taken = new Set(locked.map(keyOf))
  return anchors.filter((a) => !taken.has(keyOf(a)))
}

// -- The spin ---------------------------------------------------------------

/**
 * Total: never null, never mutates. Order of operations is
 * rotate → validate ALL → shed.
 */
export function computeSpin(state: PinwheelState, pivot: Point, dir: Dir): SpinOutcome {
  const cfg = state.config
  const landed = state.motes.map((m) => rotateMote(m, pivot, dir))

  const wall = new Set(state.locked.map(keyOf))
  const crashIdx: number[] = []
  for (let i = 0; i < landed.length; i++) {
    const q = landed[i]
    if (!inBounds(q, cfg) || wall.has(keyOf(q))) crashIdx.push(i)
  }
  if (crashIdx.length > 0) {
    return {
      landed,
      crashed: true,
      crashIdx,
      motes: landed,
      shed: [],
      locked: state.locked,
      won: false,
    }
  }

  const free = new Set(freeAnchors(state.anchors, state.locked).map(keyOf))
  const motes: Mote[] = []
  const shed: Mote[] = []
  for (const q of landed) {
    if (free.has(keyOf(q))) shed.push(q)
    else motes.push(q)
  }

  return {
    landed,
    crashed: false,
    crashIdx,
    motes,
    shed,
    locked: [...state.locked, ...shed],
    won: motes.length === 0,
  }
}

/** UI-facing; must not mutate. null iff won/dead/pivot off-board. */
export function preview(state: PinwheelState, pivot: Point, dir: Dir): SpinOutcome | null {
  if (state.won || state.dead) return null
  if (!inBounds(pivot, state.config)) return null
  return computeSpin(state, pivot, dir)
}

/** false if won/dead; else true iff some (pivot, dir) yields a non-crashing spin. */
export function hasLegalMove(state: PinwheelState): boolean {
  if (state.won || state.dead) return false
  const cfg = state.config
  for (let py = 0; py < cfg.height; py++) {
    for (let px = 0; px < cfg.width; px++) {
      for (const dir of ['cw', 'ccw'] as Dir[]) {
        if (!computeSpin(state, { x: px, y: py }, dir).crashed) return true
      }
    }
  }
  return false
}

// -- Generation via inverse spins -------------------------------------------

export interface GeneratedBoard {
  anchors: Point[]
  motes: Mote[]
  /** === script.length */
  par: number
  /** Forward solution; test-only, never in state. */
  script: { pivot: Point; dir: Dir }[]
}

/**
 * Walk backwards from the solved state (every mote pinned on its anchor).
 *
 * A reverse step un-pins a chosen set `S` (0 or 1 motes), then applies the
 * inverse rotation to the whole unlocked set. It maintains invariant
 *
 *   (I) no unlocked mote ever sits on a free anchor
 *
 * which is what makes `par` honest: with (I), replaying the script forward pins
 * EXACTLY `S` at each step — no early or extra pinning — so `par === script.length`
 * needs no replay search to prove. Forward and reverse being exact inverses over
 * the same sets also means a generated script can never crash on replay.
 *
 * Rng consumption is exact and unconditional: an accepted run consumes exactly
 * `N + 3M` values, `N` for the anchor shuffle then `[d1, d2, d3]` at the top of
 * every reverse step (some ignored — drawn anyway so the stream never branches).
 */
export function generateBoard(cfg: PinwheelConfig, rng: Rng): GeneratedBoard | null {
  const W = cfg.width
  const H = cfg.height
  const N = cfg.motes
  const M = cfg.scramble

  // 1. Anchors — exactly N draws (partial Fisher–Yates; NOT rejection sampling,
  //    which would make the draw count seed-dependent and undocumentable).
  const cells: number[] = []
  for (let i = 0; i < W * H; i++) cells.push(i)
  for (let i = 0; i < N; i++) {
    const j = i + Math.floor(rng() * (cells.length - i))
    const t = cells[i]
    cells[i] = cells[j]
    cells[j] = t
  }
  const anchors: Point[] = cells.slice(0, N).map((i) => ({ x: i % W, y: Math.floor(i / W) }))

  let motes: Mote[] = []
  let locked: Mote[] = anchors.map((a, id) => ({ id, x: a.x, y: a.y }))

  const visited = new Set<string>([stateKey(motes, locked)])
  const reverseSteps: { pivot: Point; dir: Dir }[] = []

  const finish = (): GeneratedBoard | null => {
    // A board is only usable when the whole constellation is free: the state
    // shape guarantees |motes| === |anchors| with nothing pre-pinned.
    if (locked.length > 0) return null
    if (reverseSteps.length < 1) return null
    const script = reverseSteps.slice().reverse()
    return { anchors, motes, par: script.length, script }
  }

  for (let k = 1; k <= M; k++) {
    // 2. Exactly 3 draws at the top of the step, unconditionally, in order.
    const d1 = rng()
    const d2 = rng()
    const d3 = rng()

    const remaining = locked.length
    const stepsLeft = M - k + 1

    // d1 — un-pin decision. The forcing rule keeps `remaining <= stepsLeft`
    // (true at k=1 since N <= M), so all N motes are un-pinned by step M and
    // the initial board always has every mote free.
    let unpin: boolean
    if (k === 1) unpin = true // the last forward move must pin something
    else if (remaining === 0) unpin = false
    else if (remaining === stepsLeft) unpin = true
    else unpin = d1 < UNLOCK_P

    // d2 — which mote. The canonical sort is mandatory: an unsorted array makes
    // the pick order-dependent and non-reproducible.
    let S: Mote[] = []
    if (unpin && remaining > 0) {
      const pick = sortPoints(locked)[Math.floor(d2 * remaining)]
      S = [pick]
    }

    const U: Mote[] = [...motes, ...S]
    const sIds = new Set(S.map((m) => m.id))
    const L2 = locked.filter((m) => !sIds.has(m.id))
    const wall = new Set(L2.map(keyOf))
    const free = new Set(freeAnchors(anchors, L2).map(keyOf))

    // d3 — which move. Fixed enumeration order so the pick is reproducible.
    const candidates: { pivot: Point; dir: Dir; next: Mote[] }[] = []
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        for (const dir of ['cw', 'ccw'] as Dir[]) {
          const pivot = { x: px, y: py }
          const U2 = U.map((m) => rotateMote(m, pivot, inv(dir)))
          let ok = true
          for (const q of U2) {
            // (a) in bounds  (b) not on a pinned mote  (c) not on a free anchor === (I)
            if (!inBounds(q, cfg) || wall.has(keyOf(q)) || free.has(keyOf(q))) {
              ok = false
              break
            }
          }
          if (!ok) continue
          // (d) unvisited — kills 2-cycles and inflated par
          if (visited.has(stateKey(U2, L2))) continue
          candidates.push({ pivot, dir, next: U2 })
        }
      }
    }

    if (candidates.length === 0) {
      // Abort this attempt; the remaining stream is discarded.
      return finish()
    }

    const pick = candidates[Math.floor(d3 * candidates.length)]
    motes = pick.next
    locked = L2
    visited.add(stateKey(motes, locked))
    reverseSteps.push({ pivot: pick.pivot, dir: pick.dir })
  }

  // 3. Reverse step 1 is the LAST forward move.
  return finish()
}

/**
 * Unreachable in practice, but provably valid and never a throw. Every config
 * is an odd square, so a rotation about the board centre maps the board exactly
 * onto itself — always in-bounds, always winnable in one spin.
 */
export function fallbackBoard(cfg: PinwheelConfig): GeneratedBoard {
  const W = cfg.width
  const centre: Point = { x: (W - 1) / 2, y: (cfg.height - 1) / 2 }
  const anchors: Point[] = []
  for (let i = 0; i < cfg.motes; i++) anchors.push({ x: i % W, y: Math.floor(i / W) })
  const motes: Mote[] = anchors.map((a, id) => {
    const p = rotate(a, centre, 'cw')
    return { id, x: p.x, y: p.y }
  })
  return { anchors, motes, par: 1, script: [{ pivot: centre, dir: 'ccw' }] }
}

/** Fresh run state. Does NOT carry `script` — that would be a devtools cheat. */
export function stateFromBoard(
  cfg: PinwheelConfig,
  seed: number,
  b: GeneratedBoard,
): PinwheelState {
  return {
    config: cfg,
    seed,
    anchors: b.anchors.map((a) => ({ x: a.x, y: a.y })),
    motes: b.motes.map((m) => ({ ...m })),
    locked: [],
    moves: 0,
    par: b.par,
    score: 0,
    bestShed: 0,
    undoStack: [],
    undosLeft: UNDO_POOL,
    won: false,
    dead: false,
    lastEvent: 'none',
    lastSpin: null,
    lastPivot: null,
  }
}

export function createGame(cfg: PinwheelConfig, seed: number): PinwheelState {
  for (let a = 0; a < MAX_GEN_ATTEMPTS; a++) {
    const b = generateBoard(cfg, mulberry32((seed + a) >>> 0))
    // state.seed stays the CALLER's seed so `reset` reproduces the board.
    if (b) return stateFromBoard(cfg, seed, b)
  }
  return stateFromBoard(cfg, seed, fallbackBoard(cfg))
}

// -- Reducer ----------------------------------------------------------------

function snapshot(state: PinwheelState): UndoEntry {
  return {
    motes: state.motes.map((m) => ({ ...m })),
    locked: state.locked.map((m) => ({ ...m })),
    moves: state.moves,
    score: state.score,
    bestShed: state.bestShed,
  }
}

export function reduce(state: PinwheelState, action: PinwheelAction): PinwheelState {
  switch (action.type) {
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    case 'undo': {
      if (state.won || state.dead || state.undosLeft <= 0 || state.undoStack.length === 0) {
        return { ...state, lastEvent: 'none' }
      }
      const [head, ...rest] = state.undoStack
      return {
        ...state,
        motes: head.motes.map((m) => ({ ...m })),
        locked: head.locked.map((m) => ({ ...m })),
        moves: head.moves,
        score: head.score,
        bestShed: head.bestShed,
        undoStack: rest,
        undosLeft: state.undosLeft - 1,
        lastSpin: null,
        lastPivot: null,
        lastEvent: 'undo',
      }
    }
    case 'spin': {
      if (state.won || state.dead) return { ...state, lastEvent: 'none' }
      // You cannot plant a pin off the board. A pin ON a mote / pinned mote /
      // anchor is legal — pivot cells have no occupancy rule.
      if (!inBounds(action.pivot, state.config)) return { ...state, lastEvent: 'illegal' }

      const out = computeSpin(state, action.pivot, action.dir)

      if (out.crashed) {
        // state.motes do NOT move: the UI reads lastSpin.landed for the
        // shatter frame. No undo entry (undo is disabled when dead).
        return {
          ...state,
          moves: state.moves + 1,
          dead: true,
          lastSpin: out,
          lastPivot: action.pivot,
          lastEvent: 'crash',
        }
      }

      const undoStack = [snapshot(state), ...state.undoStack].slice(0, UNDO_POOL)
      const k = out.shed.length
      let score = state.score + (k > 0 ? LOCK_BASE * k + MULTI_BASE * ((k * (k - 1)) / 2) : 0)
      const moves = state.moves + 1
      const bestShed = Math.max(state.bestShed, k)
      if (out.won) {
        score += WIN_BONUS + Math.round((PAR_BONUS_MAX * state.par) / Math.max(1, moves))
      }
      const event: PinwheelEvent = out.won
        ? 'win'
        : k >= 2
          ? 'multilock'
          : k === 1
            ? 'lock'
            : 'spin'

      return {
        ...state,
        motes: out.motes,
        locked: out.locked,
        moves,
        score,
        bestShed,
        undoStack,
        won: out.won,
        lastSpin: out,
        lastPivot: action.pivot,
        lastEvent: event,
      }
    }
    default:
      return state
  }
}
