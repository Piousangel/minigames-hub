/**
 * Mahjong Solitaire (a.k.a. Shanghai / turtle) — pure, deterministic engine.
 *
 * 144 tiles stacked in a multi-layer layout. Remove FREE pairs of matching
 * tiles until the board is clear. A tile is FREE when (a) no tile lies on top
 * of it (a tile one layer up whose 2×2 footprint overlaps) AND (b) at least one
 * of its left/right long edges is open (no tile immediately adjacent at the same
 * layer with vertical overlap).
 *
 * PURITY: every function here is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through the injected `Rng`, consumed
 * ONLY in `deal` and `shuffle`. Move functions are (state) -> state and REJECT
 * illegal moves by returning the SAME state reference (so callers/tests can
 * assert a no-op with `===`). Golden-testable from a fixed seed.
 *
 * GEOMETRY: coordinates are in HALF-TILE grid cells. A tile anchored at (x, y)
 * occupies the 2×2 block of cells x..x+1, y..y+1. Two footprints overlap when
 * |dx| < 2 AND |dy| < 2. "On top" = a tile at z+1 overlapping. "Left/right
 * blocked" = a same-z tile that vertically overlaps and sits immediately to the
 * side (its x within 2 of this tile's x on that side).
 *
 * SOLVABILITY: `deal` NEVER just shuffles tiles onto the layout (that is often
 * unsolvable). It first computes a valid PEEL order of the empty layout — a
 * sequence of free-slot pairs removed two at a time until the board is empty
 * (with backtracking, so it always completes). That peel order is, by
 * construction, a legal winning line. It then assigns a matching tile-pair to
 * each peeled slot-pair. The reverse is not needed: the peel order itself is a
 * winning play, guaranteeing the deal is solvable.
 */

export type Rng = () => number // float in [0,1)

// -- Tiles -------------------------------------------------------------------

export type Kind = 'dot' | 'bam' | 'char' | 'wind' | 'dragon' | 'flower' | 'season'

export interface Tile {
  kind: Kind
  /** dot/bam/char: rank 1..9. wind: 0..3 (E,S,W,N). dragon: 0..2 (Red,Green,White).
   *  flower/season: 0..3 (distinct faces, but ALL flowers match / ALL seasons match). */
  value: number
}

/** Match rule: same kind+value, OR both flowers, OR both seasons. */
export function tilesMatch(a: Tile, b: Tile): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'flower' || a.kind === 'season') return true
  return a.value === b.value
}

/**
 * The full 144-tile multiset expressed as 72 matching PAIRS, in a fixed
 * canonical order (rng shuffles them at deal — never here).
 *  - 3 suits (dot, bam, char) × 9 ranks × 4 copies = 108 → 2 pairs each.
 *  - 4 winds × 4 + 3 dragons × 4 = 28 honors → 2 pairs each.
 *  - 4 flowers + 4 seasons = 8 bonus → 2 pairs each (paired within group).
 */
export function makeTilePairs(): [Tile, Tile][] {
  const pairs: [Tile, Tile][] = []
  const suit = (kind: Kind, values: number[]) => {
    for (const v of values) {
      // 4 copies of each type → two identical pairs.
      pairs.push([{ kind, value: v }, { kind, value: v }])
      pairs.push([{ kind, value: v }, { kind, value: v }])
    }
  }
  const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  suit('dot', ranks)
  suit('bam', ranks)
  suit('char', ranks)
  suit('wind', [0, 1, 2, 3])
  suit('dragon', [0, 1, 2])
  // Bonus: 4 flowers → two pairs (faces 0/1 and 2/3); same for seasons. Any
  // flower matches any flower, so the specific pairing is cosmetic.
  pairs.push([{ kind: 'flower', value: 0 }, { kind: 'flower', value: 1 }])
  pairs.push([{ kind: 'flower', value: 2 }, { kind: 'flower', value: 3 }])
  pairs.push([{ kind: 'season', value: 0 }, { kind: 'season', value: 1 }])
  pairs.push([{ kind: 'season', value: 2 }, { kind: 'season', value: 3 }])
  return pairs
}

// -- Layout ------------------------------------------------------------------

export interface Slot {
  x: number
  y: number
  z: number // layer, 0 = bottom
}

/**
 * "Neon Turtle" — a clean, fully-symmetric 4-layer layout of exactly 144 slots
 * (custom, not the traditional turtle; correctness/solvability over fidelity).
 * Four centered, nested rectangles on the half-tile grid (spacing 2, so anchors
 * are even and same-layer tiles never overlap). Each upper layer sits inside the
 * footprint of the one below:
 *   z0: 14×6 = 84   (x 0..26,  y 0..10)
 *   z1: 10×4 = 40   (x 4..22,  y 2..8)
 *   z2:  6×2 = 12   (x 8..18,  y 4..6)
 *   z3:  4×2 =  8   (x 10..16, y 4..6)   → total 144
 */
function buildLayout(): Slot[] {
  const rects = [
    { z: 0, x0: 0, y0: 0, cols: 14, rows: 6 },
    { z: 1, x0: 4, y0: 2, cols: 10, rows: 4 },
    { z: 2, x0: 8, y0: 4, cols: 6, rows: 2 },
    { z: 3, x0: 10, y0: 4, cols: 4, rows: 2 },
  ]
  const slots: Slot[] = []
  for (const r of rects) {
    for (let row = 0; row < r.rows; row++) {
      for (let col = 0; col < r.cols; col++) {
        slots.push({ x: r.x0 + col * 2, y: r.y0 + row * 2, z: r.z })
      }
    }
  }
  return slots
}

export const LAYOUT: readonly Slot[] = buildLayout()
export const NUM_SLOTS = LAYOUT.length // 144

// -- Freeness ----------------------------------------------------------------

/** Footprints overlap when they share grid cells in BOTH axes. */
function overlaps(a: Slot, b: Slot): boolean {
  return Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2
}

/**
 * Is slot `i` free given the `present` mask? A present tile is free when nothing
 * is stacked on it AND at least one long side (left/right) is open.
 * A removed/empty slot is never "free".
 */
export function isFreeSlot(
  slots: readonly Slot[],
  present: readonly boolean[],
  i: number,
): boolean {
  if (!present[i]) return false
  const a = slots[i]
  let onTop = false
  let leftBlocked = false
  let rightBlocked = false
  for (let j = 0; j < slots.length; j++) {
    if (j === i || !present[j]) continue
    const b = slots[j]
    if (b.z === a.z + 1 && overlaps(a, b)) onTop = true
    if (b.z === a.z && Math.abs(b.y - a.y) < 2) {
      const dx = a.x - b.x
      if (dx > 0 && dx <= 2) leftBlocked = true // b immediately to the left
      if (dx < 0 && -dx <= 2) rightBlocked = true // b immediately to the right
    }
  }
  return !onTop && (!leftBlocked || !rightBlocked)
}

function presentFrom(tiles: readonly (Tile | null)[]): boolean[] {
  return tiles.map((t) => t !== null)
}

function freeIndices(slots: readonly Slot[], present: readonly boolean[]): number[] {
  const out: number[] = []
  for (let i = 0; i < slots.length; i++) if (isFreeSlot(slots, present, i)) out.push(i)
  return out
}

// -- PRNG (byte-identical to the solitaire template's mulberry32) -------------

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

/** Deterministic Fisher–Yates over a copy; input untouched. */
function shuffleArr<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// -- Solvable generation (peel with backtracking) ----------------------------

/**
 * Compute a valid PEEL order of the full (all-present) layout: pairs of free
 * slots removed two at a time until empty. Free-slot ordering is randomized by
 * `rng` (shuffled candidate list); we fix the first free tile and try it against
 * each remaining free tile, recursing with backtracking so the peel always
 * completes. The returned order is a legal winning line.
 */
function buildSolution(slots: readonly Slot[], rng: Rng): [number, number][] {
  const n = slots.length
  const present = new Array<boolean>(n).fill(true)
  const order: [number, number][] = []
  let budget = 2_000_000

  function rec(remaining: number): boolean {
    if (remaining === 0) return true
    if (--budget < 0) return false
    const free = shuffleArr(freeIndices(slots, present), rng)
    if (free.length < 2) return false
    const i = free[0]
    for (let b = 1; b < free.length; b++) {
      const j = free[b]
      present[i] = false
      present[j] = false
      order.push([i, j])
      if (rec(remaining - 2)) return true
      order.pop()
      present[i] = true
      present[j] = true
    }
    return false
  }

  if (!rec(n)) throw new Error('layout is not peelable') // impossible for LAYOUT
  return order
}

// -- State -------------------------------------------------------------------

export type Status = 'playing' | 'won' | 'lost'

/** Maximum "no-moves" rescue shuffles allowed per deal. */
export const MAX_SHUFFLES = 3

export interface State {
  tiles: (Tile | null)[] // indexed by LAYOUT slot; null = removed
  selected: number | null
  status: Status
  moves: number // matched pairs removed
  removed: number // tiles removed (2 × moves)
  shufflesLeft: number
}

function statusOf(slots: readonly Slot[], tiles: readonly (Tile | null)[], shufflesLeft: number): Status {
  if (tiles.every((t) => t === null)) return 'won'
  const present = presentFrom(tiles)
  const free = freeIndices(slots, present)
  // Any matching free pair?
  for (let a = 0; a < free.length; a++) {
    for (let b = a + 1; b < free.length; b++) {
      const ta = tiles[free[a]]
      const tb = tiles[free[b]]
      if (ta && tb && tilesMatch(ta, tb)) return 'playing'
    }
  }
  // No move available: lost only when no rescue shuffle remains.
  return shufflesLeft > 0 ? 'playing' : 'lost'
}

/**
 * `state` with a different shuffle budget and its status recomputed — used by Undo so that
 * stepping back over a shuffle restores the tiles but never refunds the spent shuffle.
 */
export function withShufflesLeft(state: State, shufflesLeft: number): State {
  if (state.shufflesLeft === shufflesLeft) return state
  return { ...state, shufflesLeft, status: statusOf(LAYOUT, state.tiles, shufflesLeft) }
}

/**
 * Build a fresh, guaranteed-solvable deal AND the concrete winning line that
 * proves it. Consumes rng ONLY here (peel choices + tile-pair shuffle). Each
 * peeled slot-pair is assigned a matching tile-pair, so replaying `solution`
 * (each entry [i, j]) through `removePair` clears the board — a legal win.
 */
export function generate(rng: Rng): { state: State; solution: [number, number][] } {
  const solution = buildSolution(LAYOUT, rng)
  const pairs = shuffleArr(makeTilePairs(), rng)
  const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
  for (let k = 0; k < solution.length; k++) {
    const [i, j] = solution[k]
    const [ti, tj] = pairs[k]
    tiles[i] = { kind: ti.kind, value: ti.value }
    tiles[j] = { kind: tj.kind, value: tj.value }
  }
  const state: State = {
    tiles,
    selected: null,
    status: 'playing',
    moves: 0,
    removed: 0,
    shufflesLeft: MAX_SHUFFLES,
  }
  return { state, solution }
}

/** A fresh, guaranteed-solvable deal. */
export function deal(rng: Rng): State {
  return generate(rng).state
}

export function createGame(seed: number): State {
  return deal(mulberry32(seed))
}

// -- Queries -----------------------------------------------------------------

/** Indices of all currently-free tiles. */
export function freeTiles(state: State): number[] {
  return freeIndices(LAYOUT, presentFrom(state.tiles))
}

/** All matchable free pairs [i, j] (i < j). */
export function availableMatches(state: State): [number, number][] {
  const free = freeTiles(state)
  const out: [number, number][] = []
  for (let a = 0; a < free.length; a++) {
    for (let b = a + 1; b < free.length; b++) {
      const ta = state.tiles[free[a]]
      const tb = state.tiles[free[b]]
      if (ta && tb && tilesMatch(ta, tb)) out.push([free[a], free[b]])
    }
  }
  return out
}

export function hasMove(state: State): boolean {
  return availableMatches(state).length > 0
}

export function isFree(state: State, i: number): boolean {
  if (i < 0 || i >= NUM_SLOTS) return false
  return isFreeSlot(LAYOUT, presentFrom(state.tiles), i)
}

// -- Moves (each pure; illegal → same reference) -----------------------------

/**
 * Remove a matching pair of free tiles. Validates both indices in range, both
 * present, distinct, both free, and matching. Illegal → same reference.
 */
export function removePair(state: State, i: number, j: number): State {
  if (state.status !== 'playing') return state
  if (i === j) return state
  if (i < 0 || j < 0 || i >= NUM_SLOTS || j >= NUM_SLOTS) return state
  const ti = state.tiles[i]
  const tj = state.tiles[j]
  if (!ti || !tj) return state
  if (!tilesMatch(ti, tj)) return state
  const present = presentFrom(state.tiles)
  if (!isFreeSlot(LAYOUT, present, i) || !isFreeSlot(LAYOUT, present, j)) return state
  const tiles = state.tiles.slice()
  tiles[i] = null
  tiles[j] = null
  const removed = state.removed + 2
  return {
    ...state,
    tiles,
    selected: null,
    moves: state.moves + 1,
    removed,
    status: statusOf(LAYOUT, tiles, state.shufflesLeft),
  }
}

/**
 * Tap a tile to select it; tap a matching free tile to clear the pair; tap the
 * selected tile again to deselect; tap a different free tile to move selection.
 * Tapping a non-free / empty / out-of-range tile is a no-op (same reference) so
 * the component can play an error cue.
 */
export function select(state: State, i: number): State {
  if (state.status !== 'playing') return state
  if (i < 0 || i >= NUM_SLOTS) return state
  if (state.tiles[i] === null) return state
  if (!isFree(state, i)) return state
  if (state.selected === i) return { ...state, selected: null }
  if (state.selected === null) return { ...state, selected: i }
  const cur = state.tiles[state.selected]
  const next = state.tiles[i]
  if (cur && next && tilesMatch(cur, next)) return removePair(state, state.selected, i)
  return { ...state, selected: i } // non-matching second pick → move selection
}

/**
 * Reshuffle the remaining tiles among the remaining slots (a "no moves" rescue).
 * Consumes rng. Decrements `shufflesLeft`; illegal when no shuffles remain or
 * fewer than two tiles remain → same reference. Recomputes status afterwards.
 */
export function shuffle(state: State, rng: Rng): State {
  if (state.status !== 'playing') return state
  if (state.shufflesLeft <= 0) return state
  const filled: number[] = []
  const bag: Tile[] = []
  for (let i = 0; i < state.tiles.length; i++) {
    const t = state.tiles[i]
    if (t) {
      filled.push(i)
      bag.push(t)
    }
  }
  if (filled.length < 2) return state
  const shuffled = shuffleArr(bag, rng)
  const tiles = state.tiles.slice()
  for (let k = 0; k < filled.length; k++) tiles[filled[k]] = shuffled[k]
  const shufflesLeft = state.shufflesLeft - 1
  return {
    ...state,
    tiles,
    selected: null,
    shufflesLeft,
    status: statusOf(LAYOUT, tiles, shufflesLeft),
  }
}

// -- Solver (independent; used by tests to confirm solvability) --------------

/** Group key by which tiles match (flowers/seasons collapse to their group). */
function matchKey(t: Tile): string {
  return t.kind === 'flower' || t.kind === 'season' ? t.kind : `${t.kind}:${t.value}`
}

/**
 * A provably-SAFE match to force without branching: a pair whose match-group has
 * ALL of its remaining tiles currently free (so removing two of them can never
 * make a solvable board unsolvable — free tiles only become "more free"). This
 * collapses most of the search to a single line.
 */
function safePair(tiles: readonly (Tile | null)[], present: boolean[]): [number, number] | null {
  const free = freeIndices(LAYOUT, present)
  const freeByKey = new Map<string, number[]>()
  for (const i of free) {
    const key = matchKey(tiles[i]!)
    const list = freeByKey.get(key)
    if (list) list.push(i)
    else freeByKey.set(key, [i])
  }
  const remain = new Map<string, number>()
  for (let i = 0; i < present.length; i++) {
    if (present[i]) {
      const key = matchKey(tiles[i]!)
      remain.set(key, (remain.get(key) ?? 0) + 1)
    }
  }
  for (const [key, list] of freeByKey) {
    if (list.length >= 2 && list.length === remain.get(key)) return [list[0], list[1]]
  }
  return null
}

/**
 * Independent depth-first solver: returns a full sequence of matched free-pair
 * moves that clears the board, or null if none is found within the node budget.
 * Does NOT use how the deal was built — it searches from scratch. A sound
 * safe-move fast path forces guaranteed-safe pairs without branching; only
 * genuinely ambiguous positions branch (with memoization). Tests use it to
 * CONFIRM a generated deal is solvable and replay the moves through the real
 * `removePair` validator.
 */
export function findSolution(tiles: readonly (Tile | null)[]): [number, number][] | null {
  const present = presentFrom(tiles)
  const memo = new Set<string>()
  const path: [number, number][] = []
  let budget = 400_000

  const key = () => {
    let s = ''
    for (let i = 0; i < present.length; i++) s += present[i] ? '1' : '0'
    return s
  }

  function dfs(remaining: number): boolean {
    if (remaining === 0) return true
    if (--budget < 0) return false

    // Force a safe move if one exists (sound → no need to try alternatives).
    const safe = safePair(tiles, present)
    if (safe) {
      const [i, j] = safe
      present[i] = false
      present[j] = false
      path.push([i, j])
      if (dfs(remaining - 2)) return true
      path.pop()
      present[i] = true
      present[j] = true
      return false
    }

    const k = key()
    if (memo.has(k)) return false
    const free = freeIndices(LAYOUT, present)
    for (let a = 0; a < free.length; a++) {
      for (let b = a + 1; b < free.length; b++) {
        const ta = tiles[free[a]]
        const tb = tiles[free[b]]
        if (!ta || !tb || !tilesMatch(ta, tb)) continue
        present[free[a]] = false
        present[free[b]] = false
        path.push([free[a], free[b]])
        if (dfs(remaining - 2)) return true
        path.pop()
        present[free[a]] = true
        present[free[b]] = true
      }
    }
    memo.add(k)
    return false
  }

  return dfs(present.filter(Boolean).length) ? path.slice() : null
}

/** True when an independent solver can clear the board. */
export function isSolvable(tiles: readonly (Tile | null)[]): boolean {
  return findSolution(tiles) !== null
}

// -- Scoring -----------------------------------------------------------------

/**
 * Higher = better, always a non-negative integer, monotonic as pairs are
 * removed: 100 per removed tile, plus a completion bonus on a win.
 */
export function score(state: State): number {
  return state.removed * 100 + (state.status === 'won' ? 10000 : 0)
}
