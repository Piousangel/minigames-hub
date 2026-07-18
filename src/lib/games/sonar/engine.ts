// Sonar — pure, deterministic deduction engine.
//
// A dark N×N sea hides T stationary targets. A "ping" at any cell returns a
// SINGLE integer: the Manhattan distance to the nearest still-hidden target.
// Each ping erases the open Manhattan disk (a diamond) of radius `d` as
// proven-empty; the intersection of expanding distance rings triangulates the
// targets. Marking (claim) a cell you are sure of captures a target with no
// ping — the deduction reward — but a wrong mark costs a life.
//
// Manhattan metric (diamond rings) is deliberately chosen so Sonar reads and
// solves differently from Quarry's Chebyshev (square rings).
//
// Purity: NO Math.random / Date / performance.now anywhere in this file. The
// only randomness source is an injected `Rng`, consumed ONLY when placing
// targets. ping/claim/reduce/scoring consume zero rng, so every outcome is a
// pure function of a fixed script and fully golden-testable.

export type Rng = () => number // () => [0,1); the ONLY randomness source

export interface Pos {
  row: number
  col: number
}

export interface SonarConfig {
  size: number // N; board is N×N
  targets: number // T; number of hidden targets
  lives: number // wrong-mark budget (lose gauge)
  minSep: number // min Manhattan separation at generation (puzzle quality)
}

/** Render/adjudication cell. captured/miss/cleared priority: captured > miss > cleared. */
export interface Cell {
  ping: number | null // distance recorded when this cell was directly pinged (write-once); else null
  cleared: boolean // proven target-free (inside some ping disk, or a wrong mark)
  captured: boolean // a target was taken here (direct ping or correct mark)
  miss: boolean // a wrong mark landed here (=> cleared is also true)
}

export interface PingRecord {
  at: Pos
  distance: number // nearest Manhattan distance at ping time (>=0). 0 == direct hit
  targetsLeft: number // uncaptured targets at ping time (context)
  seq: number // 1-based
}

export interface ClaimRecord {
  at: Pos
  hit: boolean // captured a target?
  seq: number // 1-based
}

export type SonarEvent =
  | 'none'
  | 'ping' // empty-cell ping (information gained)
  | 'ping-repeat' // re-ping of an already pinged cell (no change / no cost)
  | 'capture' // direct-hit ping capture
  | 'deduce' // correct mark on an un-pinged cell — skill reward
  | 'miss' // wrong mark
  | 'illegal' // out of bounds / captured cell / proven-empty / game over
  | 'win'
  | 'lose'

export type SonarStatus = 'playing' | 'won' | 'lost'

export interface SonarState {
  config: SonarConfig
  seed: number
  size: number
  grid: Cell[][] // [row][col]
  targets: Pos[] // uncaptured targets (oracle). removed on capture
  captured: Pos[] // captured targets, in capture order
  pings: PingRecord[] // every ping, in order
  claims: ClaimRecord[] // every mark, in order
  cursor: Pos // keyboard focus cell (clamped)
  lives: number
  pingCount: number // === pings.length (convenience cache)
  par: number // efficiency-bonus baseline = targets * PINGS_PER_TARGET
  score: number // monotonic non-decreasing positive integer
  status: SonarStatus
  lastEvent: SonarEvent
  lastPing: PingRecord | null
  lastClaim: ClaimRecord | null
}

export type SonarAction =
  | { type: 'ping'; at: Pos }
  | { type: 'claim'; at: Pos }
  | { type: 'move'; dRow: number; dCol: number } // relative cursor move (clamped)
  | { type: 'cursor'; at: Pos } // absolute cursor move
  | { type: 'reset' } // regenerate same seed
  | { type: 'new'; seed: number } // new seed

// ---- Constants ----
export const CAPTURE_POINTS = 200 // per capture (direct ping or correct mark base)
export const DEDUCE_BONUS = 200 // extra when a correct mark takes an un-pinged cell (total 400)
export const WIN_BONUS = 1000
export const PAR_BONUS_MAX = 1000
export const LIFE_BONUS = 250 // per remaining life on win
export const PINGS_PER_TARGET = 3 // par heuristic
export const MAX_PLACE_ATTEMPTS = 400 // rejection-sampling cap for target placement

export const DIFFICULTIES = {
  easy: { size: 6, targets: 2, lives: 3, minSep: 2 },
  normal: { size: 8, targets: 3, lives: 3, minSep: 2 },
  hard: { size: 10, targets: 4, lives: 3, minSep: 3 },
} satisfies Record<'easy' | 'normal' | 'hard', SonarConfig>

export const DAILY_CONFIG: SonarConfig = DIFFICULTIES.normal

// ---- Pure primitives ----

/** mulberry32 PRNG — byte-identical to decant/quarry. */
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

/** Manhattan (taxicab) distance. */
export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
}

export function inBounds(size: number, p: Pos): boolean {
  return p.row >= 0 && p.row < size && p.col >= 0 && p.col < size
}

/** Nearest Manhattan distance from `cell` to any target. Requires targets.length >= 1. */
export function nearestDistance(targets: Pos[], cell: Pos): number {
  let best = Infinity
  for (const t of targets) {
    const d = manhattan(t, cell)
    if (d < best) best = d
  }
  return best
}

function clampCoord(v: number, size: number): number {
  return v < 0 ? 0 : v > size - 1 ? size - 1 : v
}

/**
 * Rejection-sample target positions. RNG consumption order per attempt:
 * row (draw 1) then col (draw 2). A candidate is rejected if it duplicates an
 * existing target or is within Manhattan `minSep` of one. After
 * MAX_PLACE_ATTEMPTS the fallback fills the remainder ignoring `minSep` (still
 * avoiding duplicates, still consuming rng in the same row-then-col order).
 * Deterministic for a fixed (size, count, seed, minSep).
 */
export function placeTargets(size: number, count: number, rng: Rng, minSep: number): Pos[] {
  const targets: Pos[] = []
  let attempts = 0
  while (targets.length < count && attempts < MAX_PLACE_ATTEMPTS) {
    attempts++
    const row = Math.floor(rng() * size)
    const col = Math.floor(rng() * size)
    const cand: Pos = { row, col }
    let ok = true
    for (const t of targets) {
      if (t.row === row && t.col === col) {
        ok = false
        break
      }
      if (manhattan(t, cand) < minSep) {
        ok = false
        break
      }
    }
    if (ok) targets.push(cand)
  }
  // Fallback: fill remainder, avoiding duplicates only.
  while (targets.length < count) {
    const row = Math.floor(rng() * size)
    const col = Math.floor(rng() * size)
    let dup = false
    for (const t of targets) {
      if (t.row === row && t.col === col) {
        dup = true
        break
      }
    }
    if (!dup) targets.push({ row, col })
  }
  return targets
}

export function emptyGrid(size: number): Cell[][] {
  const grid: Cell[][] = []
  for (let r = 0; r < size; r++) {
    const row: Cell[] = []
    for (let c = 0; c < size; c++) {
      row.push({ ping: null, cleared: false, captured: false, miss: false })
    }
    grid.push(row)
  }
  return grid
}

export function createGame(cfg: SonarConfig, seed: number): SonarState {
  const targets = placeTargets(cfg.size, cfg.targets, mulberry32(seed), cfg.minSep)
  const mid = Math.floor((cfg.size - 1) / 2)
  return {
    config: cfg,
    seed,
    size: cfg.size,
    grid: emptyGrid(cfg.size),
    targets,
    captured: [],
    pings: [],
    claims: [],
    cursor: { row: mid, col: mid },
    lives: cfg.lives,
    pingCount: 0,
    par: cfg.targets * PINGS_PER_TARGET,
    score: 0,
    status: 'playing',
    lastEvent: 'none',
    lastPing: null,
    lastClaim: null,
  }
}

// ---- Internal helpers ----

function cloneGrid(g: Cell[][]): Cell[][] {
  return g.map((row) => row.map((cell) => ({ ...cell })))
}

/** Set cleared=true on every cell with manhattan(at, ·) < d. Never touches captured cells. */
function markClearedInDisk(g: Cell[][], size: number, at: Pos, d: number): void {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (manhattan(at, { row: r, col: c }) < d && !g[r][c].captured) {
        g[r][c].cleared = true
      }
    }
  }
}

function parBonus(par: number, pingCount: number): number {
  return Math.round(PAR_BONUS_MAX * Math.min(1, par / Math.max(1, pingCount)))
}

/** Promote to a win once every target is captured, folding in win bonuses. */
function finalizeIfWon(next: SonarState): SonarState {
  if (next.status !== 'playing' || next.targets.length > 0) return next
  const bonus = WIN_BONUS + parBonus(next.par, next.pingCount) + next.lives * LIFE_BONUS
  return { ...next, status: 'won', score: next.score + bonus, lastEvent: 'win' }
}

function samePos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col
}

// ---- Actions ----

/** Ping a cell. Pure: returns a NEW state, never mutates input, consumes no rng. */
export function ping(state: SonarState, at: Pos): SonarState {
  if (state.status !== 'playing') return { ...state, lastEvent: 'illegal' }
  if (!inBounds(state.size, at)) return { ...state, lastEvent: 'illegal' }
  const cell = state.grid[at.row][at.col]
  if (cell.captured) return { ...state, lastEvent: 'illegal' }
  if (cell.ping !== null) return { ...state, lastEvent: 'ping-repeat' } // no change, no cost

  const d = nearestDistance(state.targets, at)
  const record: PingRecord = {
    at,
    distance: d,
    targetsLeft: state.targets.length,
    seq: state.pings.length + 1,
  }
  const grid = cloneGrid(state.grid)
  grid[at.row][at.col].ping = d

  let targets = state.targets
  let captured = state.captured
  let score = state.score
  let event: SonarEvent

  if (d === 0) {
    grid[at.row][at.col].captured = true
    targets = targets.filter((t) => !samePos(t, at))
    captured = [...captured, at]
    score += CAPTURE_POINTS
    event = 'capture'
  } else {
    markClearedInDisk(grid, state.size, at, d)
    grid[at.row][at.col].cleared = true
    event = 'ping'
  }

  const next: SonarState = {
    ...state,
    grid,
    targets,
    captured,
    pings: [...state.pings, record],
    pingCount: state.pingCount + 1,
    score,
    lastEvent: event,
    lastPing: record,
  }
  return finalizeIfWon(next)
}

/** Mark (claim) a cell. Pure: returns a NEW state, never mutates input, consumes no rng. */
export function claim(state: SonarState, at: Pos): SonarState {
  if (state.status !== 'playing') return { ...state, lastEvent: 'illegal' }
  if (!inBounds(state.size, at)) return { ...state, lastEvent: 'illegal' }
  const cell = state.grid[at.row][at.col]
  // Block self-defeating marks on proven / already-resolved cells (no life lost).
  if (cell.captured || cell.miss || cell.cleared || (cell.ping !== null && cell.ping > 0)) {
    return { ...state, lastEvent: 'illegal' }
  }

  const isTarget = state.targets.some((t) => samePos(t, at))
  const grid = cloneGrid(state.grid)
  const seq = state.claims.length + 1

  if (isTarget) {
    grid[at.row][at.col].captured = true
    const claimRec: ClaimRecord = { at, hit: true, seq }
    const next: SonarState = {
      ...state,
      grid,
      targets: state.targets.filter((t) => !samePos(t, at)),
      captured: [...state.captured, at],
      claims: [...state.claims, claimRec],
      score: state.score + CAPTURE_POINTS + DEDUCE_BONUS,
      lastClaim: claimRec,
      lastEvent: 'deduce',
    }
    return finalizeIfWon(next)
  }

  // Wrong mark: costs a life, and the cell becomes proven-empty.
  grid[at.row][at.col].miss = true
  grid[at.row][at.col].cleared = true
  const lives = state.lives - 1
  const claimRec: ClaimRecord = { at, hit: false, seq }
  const lost = lives <= 0
  return {
    ...state,
    grid,
    lives,
    claims: [...state.claims, claimRec],
    lastClaim: claimRec,
    status: lost ? 'lost' : state.status,
    lastEvent: lost ? 'lose' : 'miss',
  }
}

export function reduce(state: SonarState, action: SonarAction): SonarState {
  switch (action.type) {
    case 'ping':
      return ping(state, action.at)
    case 'claim':
      return claim(state, action.at)
    case 'move': {
      const cursor: Pos = {
        row: clampCoord(state.cursor.row + action.dRow, state.size),
        col: clampCoord(state.cursor.col + action.dCol, state.size),
      }
      return { ...state, cursor, lastEvent: 'none' }
    }
    case 'cursor': {
      const cursor: Pos = {
        row: clampCoord(action.at.row, state.size),
        col: clampCoord(action.at.col, state.size),
      }
      return { ...state, cursor, lastEvent: 'none' }
    }
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    default:
      return state
  }
}

export function isWon(state: SonarState): boolean {
  return state.targets.length === 0
}

export function isLost(state: SonarState): boolean {
  return state.status === 'lost'
}

/** FNV-1a hash of a 'YYYY-MM-DD' string. Pure. Same shape as quarry. */
export function dailySeed(dateStr: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
