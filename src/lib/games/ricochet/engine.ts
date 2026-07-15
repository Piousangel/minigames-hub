// Ricochet — pure deterministic engine. RNG is injected; NO Math.random here.

export const SIZE = 7 // 7×7
export const CELL_COUNT = SIZE * SIZE // 49
export const MIN_VALUE = 1
export const MAX_VALUE = 4
export const VISITED_CAP = 64 // refinement 7: belt-and-suspenders loop guard

export type Rng = () => number // yields [0,1); injected — NEVER Math.random here

/** Baked arrow direction. */
export type Dir = 'up' | 'down' | 'left' | 'right'

/** A live tile, or null for a cleared/empty cell. */
export interface Tile {
  value: 1 | 2 | 3 | 4
  dir: Dir
}

/** Board is a flat array of length 49, row-major: index = row*SIZE + col. */
export type Board = (Tile | null)[]

export type Mode = 'endless' | 'daily'

export interface GameState {
  board: Board
  mode: Mode
  seed: number // the seed that generated this board's rng stream
  score: number // cumulative session score
  taps: number // total ignitions fired this game
  longestChain: number // best single-chain length this game (refinement 6 ghost)
  /** Endless difficulty clock: increments each refill, drives the weighted bag. */
  refillCount: number
  /** Daily only: taps remaining (null in endless = unlimited). */
  tapsLeft: number | null
  /** True once a daily board has exhausted its taps. */
  over: boolean
}

/** One hop of a resolved chain (for animation replay). */
export interface Hop {
  /** Board index the bolt LANDS on and clears. */
  index: number
  /** The tile that was cleared here (its value drove the NEXT hop). */
  cleared: Tile
  /** 1-based position in the chain; also equals this hop's point contribution. */
  hopIndex: number
}

/** Result of igniting one tile — the whole deterministic payoff. */
export interface ChainResult {
  /** Ordered hops, first landing → last landing. Empty if the ignition was a no-op. */
  hops: Hop[]
  /** Σ hopIndex over all hops (convex). 1+2+…+n = n(n+1)/2. */
  score: number
  /** hops.length. */
  length: number
  /** Why the chain ended. */
  terminator: 'offboard' | 'empty' | 'cap'
  /** The index the bolt would have landed on when it terminated (may be off-board = -1). */
  finalTargetIndex: number
}

export function toIndex(row: number, col: number): number {
  return row * SIZE + col
}

export function toRow(index: number): number {
  return Math.floor(index / SIZE)
}

export function toCol(index: number): number {
  return index % SIZE
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE
}

/** Unit step per direction as [dRow, dCol]. */
export const STEP: Record<Dir, readonly [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
}

/** Pure seeded PRNG — Math.imul + bit ops only. NO Math.random. */
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

/** Stable 32-bit hash of a string → seed. Pure. Used for Daily seed from date/URL. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Value weights [w1,w2,w3,w4] as a function of the difficulty clock. */
export function valueWeights(refillCount: number): [number, number, number, number] {
  // t ramps 0 → 1 over ~40 refills, then saturates.
  const t = Math.min(1, refillCount / 40)
  // Start: mostly 1-2s (gentle). End: 3-4s common (monster boards).
  const w1 = 40 - 24 * t // 40 → 16
  const w2 = 34 - 6 * t // 34 → 28
  const w3 = 18 + 14 * t // 18 → 32
  const w4 = 8 + 16 * t // 8  → 24
  return [w1, w2, w3, w4]
}

/** Pick a value 1-4 from the weighted bag. Pure — rng injected. */
export function pickValue(rng: Rng, refillCount: number): 1 | 2 | 3 | 4 {
  const w = valueWeights(refillCount)
  const total = w[0] + w[1] + w[2] + w[3]
  let r = rng() * total
  for (let i = 0; i < 4; i++) {
    if (r < w[i]) return (i + 1) as 1 | 2 | 3 | 4
    r -= w[i]
  }
  return 4
}

const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right']

/** Uniform random direction. Pure — rng injected. */
export function pickDir(rng: Rng): Dir {
  return DIRS[Math.floor(rng() * 4)]
}

/** A fresh random tile at the current difficulty. Pure. */
export function makeTile(rng: Rng, refillCount: number): Tile {
  return { value: pickValue(rng, refillCount), dir: pickDir(rng) }
}

/** A full 7×7 board seeded at difficulty `refillCount`. Pure — rng injected. */
export function makeBoard(rng: Rng, refillCount: number): Board {
  const board: Board = new Array(CELL_COUNT)
  for (let i = 0; i < CELL_COUNT; i++) board[i] = makeTile(rng, refillCount)
  return board
}

/**
 * THE resolver. Pure — reads the board as an executable routing program and
 * does NOT mutate `board`. Returns the whole deterministic payoff.
 */
export function resolveChain(board: Board, startIndex: number): ChainResult {
  const startTile = board[startIndex]
  if (!startTile) {
    return { hops: [], score: 0, length: 0, terminator: 'empty', finalTargetIndex: startIndex }
  }
  const work = board.slice()
  let cur = startIndex
  // The currently-driving tile. The tapped tile is the first engine; each landed
  // tile becomes the next engine. We carry it explicitly because a landed cell is
  // cleared (scored) yet its instruction still drives the following hop.
  let curTile: Tile = startTile
  const hops: Hop[] = []
  let terminator: ChainResult['terminator'] = 'empty'
  let finalTargetIndex = startIndex

  while (true) {
    const [dr, dc] = STEP[curTile.dir]
    const r = toRow(cur) + dr * curTile.value
    const c = toCol(cur) + dc * curTile.value
    if (!inBounds(r, c)) {
      terminator = 'offboard'
      finalTargetIndex = -1
      break
    }

    const dest = toIndex(r, c)
    const landed = work[dest]
    if (!landed) {
      // Landing on an already-cleared/empty cell ends the chain (natural
      // revisit terminator — cells clear on landing, so any revisit is null).
      terminator = 'empty'
      finalTargetIndex = dest
      break
    }

    hops.push({ index: dest, cleared: landed, hopIndex: hops.length + 1 })
    work[dest] = null // consume the landed tile (scored + cleared)
    cur = dest
    curTile = landed // the landed tile drives the next hop

    if (hops.length >= VISITED_CAP) {
      terminator = 'cap'
      finalTargetIndex = cur
      break
    }
  }

  const length = hops.length
  return { hops, score: (length * (length + 1)) / 2, length, terminator, finalTargetIndex }
}

/** Apply a resolved chain: null out every cleared cell. Pure — new board. */
export function applyChain(board: Board, result: ChainResult): Board {
  const next = board.slice()
  for (const hop of result.hops) next[hop.index] = null
  return next
}

/**
 * Column-wise gravity + top refill. Pure w.r.t. `board` (returns a new board),
 * but ADVANCES the injected rng (the intended deterministic side channel).
 * Order: columns left→right, survivors settle to the bottom preserving vertical
 * order, then fresh tiles drop in above them.
 */
export function collapse(board: Board, rng: Rng, refillCount: number): Board {
  const next: Board = new Array(CELL_COUNT).fill(null)
  for (let col = 0; col < SIZE; col++) {
    const survivors: Tile[] = []
    for (let row = 0; row < SIZE; row++) {
      const t = board[toIndex(row, col)]
      if (t) survivors.push(t)
    }
    // Place survivors at the bottom, preserving vertical order.
    let write = SIZE - 1
    for (let k = survivors.length - 1; k >= 0; k--) {
      next[toIndex(write, col)] = survivors[k]
      write--
    }
    // Fill the remaining top cells with fresh tiles.
    for (let row = write; row >= 0; row--) {
      next[toIndex(row, col)] = makeTile(rng, refillCount)
    }
  }
  return next
}

export interface IgniteOutcome {
  state: GameState
  result: ChainResult // for the component to animate
}

/** Create a new game. Pure — rng injected (caller owns the closure). */
export function newGame(opts: {
  mode: Mode
  seed: number
  rng: Rng
  /** Daily par/limit: number of taps allowed (null = endless/unlimited). */
  tapLimit?: number | null
}): GameState {
  const refillCount = 0
  return {
    board: makeBoard(opts.rng, refillCount),
    mode: opts.mode,
    seed: opts.seed,
    score: 0,
    taps: 0,
    longestChain: 0,
    refillCount,
    tapsLeft: opts.mode === 'daily' ? (opts.tapLimit ?? 0) : null,
    over: false,
  }
}

function emptyResult(i: number): ChainResult {
  return { hops: [], score: 0, length: 0, terminator: 'empty', finalTargetIndex: i }
}

/**
 * Fire the bolt at `startIndex`, then gravity+refill.
 * Pure — the SAME rng closure must be reused across the session for determinism.
 * A no-op ignition (empty cell, or daily already over) returns state unchanged
 * with an empty result and does NOT consume a tap.
 */
export function ignite(state: GameState, startIndex: number, rng: Rng): IgniteOutcome {
  if (state.over) return { state, result: emptyResult(startIndex) }

  const result = resolveChain(state.board, startIndex)
  if (result.length === 0) {
    // Tapping empty / dud: no tap consumed, no refill, no rng advance.
    return { state, result }
  }

  const cleared = applyChain(state.board, result)
  const nextRefill = state.refillCount + 1
  const board = collapse(cleared, rng, nextRefill)

  const tapsLeft = state.tapsLeft === null ? null : state.tapsLeft - 1
  const over = tapsLeft !== null && tapsLeft <= 0

  return {
    state: {
      ...state,
      board,
      score: state.score + result.score,
      taps: state.taps + 1,
      longestChain: Math.max(state.longestChain, result.length),
      refillCount: nextRefill,
      tapsLeft,
      over,
    },
    result,
  }
}

/**
 * Faint preview: the FIRST `maxHops` landing indices only (default 2).
 * Never returns the full trail — preserves the "read but can't fully see it"
 * tension. Read-only.
 */
export function previewHops(board: Board, startIndex: number, maxHops = 2): number[] {
  const full = resolveChain(board, startIndex)
  return full.hops.slice(0, maxHops).map((h) => h.index)
}

/** Deterministic seed for a given calendar day. Pure. */
export function dailySeed(isoDate: string): number {
  return hashSeed(`ricochet:${isoDate}`)
}

/** Par trail length for the daily — derived deterministically from the seed. */
export function dailyPar(seed: number): number {
  // Small, human-scale target: 8–14.
  return 8 + (seed % 7)
}

export const DAILY_TAPS = 5 // fixed N taps for daily mode (refinement 4)
