/**
 * Prismbox — pure engine.
 *
 * A hidden-atom deduction puzzle. Fire a beam of light from an edge port into
 * a `size x size` grid; it travels straight until it would step onto (or
 * diagonally past) a hidden atom, at which point it either stops (hit),
 * bounces back out the way it came (reflect), or bends 90 degrees around the
 * atom (refract) and keeps going until it exits the grid (through/refract) or
 * is absorbed (hit). The player never sees the grid directly — only the
 * entry/exit ports and, for refract/through shots, the traced path — and
 * must triangulate every atom's coordinates from those outcomes.
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters only through an injected `Rng`, used
 * solely in atom placement. `simulateShot` and `reduce` consume no rng, so
 * every shot outcome and score is golden-testable from a fixed script.
 */

export type Rng = () => number // returns a float in [0,1)

export type Edge = 'N' | 'S' | 'E' | 'W'
export interface Port {
  edge: Edge
  lane: number
}
export interface Coord {
  r: number
  c: number
}
export type ShotEvent = 'hit' | 'reflect' | 'through' | 'refract' | 'trapped'

export interface ShotResult {
  entry: Port
  event: ShotEvent
  exit: Port | null // hit/trapped: null. reflect: entry itself. through/refract: real exit port.
  path: Coord[] // through/refract only, [] otherwise.
  turns: Coord[] // refract only (cells where direction changed), [] otherwise.
  hitAtom: Coord | null // hit only.
}

export interface PrismboxConfig {
  size: number // N, interior grid side length
  atoms: number // A, hidden atom count
  parPerAtom: number // par = round(atoms * parPerAtom)
}

export interface ShotRecord extends ShotResult {
  seq: number // 1-based, firing order
}

export type PrismboxEvent =
  | 'none'
  | 'fire-hit'
  | 'fire-reflect'
  | 'fire-through'
  | 'fire-refract'
  | 'already-found'
  | 'win'

export interface PrismboxState {
  config: PrismboxConfig
  seed: number
  atoms: Coord[] // hidden answer. length === config.atoms
  found: boolean[] // parallel to atoms. true once that atom has been hit
  shots: ShotRecord[] // full firing history, append-only
  score: number
  par: number
  won: boolean
  lastEvent: PrismboxEvent
  lastShot: ShotRecord | null
}

export type PrismboxAction =
  | { type: 'fire'; entry: Port }
  | { type: 'reset' }
  | { type: 'new'; seed: number }

/** Identical impl to the template's mulberry32. Each engine file is self-contained. */
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

export const DIFFICULTIES = {
  easy: { size: 7, atoms: 3, parPerAtom: 4 },
  normal: { size: 8, atoms: 4, parPerAtom: 4 },
  hard: { size: 9, atoms: 5, parPerAtom: 4 },
} satisfies Record<'easy' | 'normal' | 'hard', PrismboxConfig>

export const DAILY_CONFIG: PrismboxConfig = DIFFICULTIES.normal
export const HIT_BONUS = 100
export const WIN_BONUS = 500
export const PAR_BONUS_MAX = 500
export const MAX_STEPS_MULT = 4 // MAX_STEPS = MAX_STEPS_MULT * size * size
export const MAX_PLACEMENT_ATTEMPTS = 500

// -- Geometry primitives ------------------------------------------------------

/** `${r},${c}` — bijective on integer pairs. */
export function key(r: number, c: number): string {
  return `${r},${c}`
}

/** Rotate a cardinal unit vector 90deg counter-clockwise (screen coords: r=down+, c=right+). */
export function turnLeft(dr: number, dc: number): { dr: number; dc: number } {
  return { dr: -dc, dc: dr }
}

/** Rotate a cardinal unit vector 90deg clockwise. Inverse of turnLeft. */
export function turnRight(dr: number, dc: number): { dr: number; dc: number } {
  return { dr: dc, dc: -dr }
}

export function inBounds(r: number, c: number, size: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size
}

/** Never throws: out-of-range coordinates are simply "no atom there". */
export function hasAtomAt(atomKeys: Set<string>, r: number, c: number, size: number): boolean {
  if (!inBounds(r, c, size)) return false
  return atomKeys.has(key(r, c))
}

/** Start cell (always in-bounds) + inward-pointing cardinal direction for a port. */
export function portToStart(port: Port, size: number): { r: number; c: number; dr: number; dc: number } {
  switch (port.edge) {
    case 'N':
      return { r: 0, c: port.lane, dr: 1, dc: 0 }
    case 'S':
      return { r: size - 1, c: port.lane, dr: -1, dc: 0 }
    case 'W':
      return { r: port.lane, c: 0, dr: 0, dc: 1 }
    case 'E':
      return { r: port.lane, c: size - 1, dr: 0, dc: -1 }
  }
}

/**
 * Precondition: (r,c) is the position immediately after advancing one step in
 * (dr,dc), just off the grid. Determines which edge/lane the beam crossed.
 */
export function cellToExitPort(r: number, c: number, dr: number, dc: number, size: number): Port {
  void size
  if (dr === 1) return { edge: 'S', lane: c }
  if (dr === -1) return { edge: 'N', lane: c }
  if (dc === 1) return { edge: 'E', lane: r }
  return { edge: 'W', lane: r } // dc === -1
}

// -- The shot -----------------------------------------------------------------

/**
 * Pure, total simulation of a single shot. Never throws even on hand-built
 * `atoms` arrays that violate the placement invariants (used by golden tests
 * to construct refract/reflect/trapped scenarios directly).
 */
export function simulateShot(atoms: Coord[], entry: Port, size: number): ShotResult {
  const atomKeys = new Set(atoms.map((a) => key(a.r, a.c)))
  let { r, c, dr, dc } = portToStart(entry, size)
  const path: Coord[] = []
  const turns: Coord[] = []
  const MAX_STEPS = MAX_STEPS_MULT * size * size

  for (let step = 0; step < MAX_STEPS; step++) {
    const fr = r + dr
    const fc = c + dc
    if (hasAtomAt(atomKeys, fr, fc, size)) {
      return { entry, event: 'hit', exit: null, path: [], turns: [], hitAtom: { r: fr, c: fc } }
    }

    const left = turnLeft(dr, dc)
    const right = turnRight(dr, dc)
    const hasLeft = hasAtomAt(atomKeys, r + left.dr, c + left.dc, size)
    const hasRight = hasAtomAt(atomKeys, r + right.dr, c + right.dc, size)

    if (hasLeft && hasRight) {
      return { entry, event: 'reflect', exit: entry, path: [], turns: [], hitAtom: null }
    }
    if (hasLeft) {
      dr = right.dr
      dc = right.dc
      turns.push({ r, c })
      continue
    }
    if (hasRight) {
      dr = left.dr
      dc = left.dc
      turns.push({ r, c })
      continue
    }

    path.push({ r, c })
    r = fr
    c = fc
    if (!inBounds(r, c, size)) {
      const exit = cellToExitPort(r, c, dr, dc, size)
      const event: ShotEvent = turns.length === 0 ? 'through' : 'refract'
      return { entry, event, exit, path, turns, hitAtom: null }
    }
  }

  return { entry, event: 'trapped', exit: null, path: [], turns: [], hitAtom: null }
}

export function isWon(found: boolean[]): boolean {
  return found.every(Boolean)
}

/**
 * The only rng consumer. Every attempt: r-roll, c-roll (in that order), and
 * on a chebyshev-distance-<2 collision the attempt is discarded (no further
 * rng consumption). MAX_PLACEMENT_ATTEMPTS bounds the loop; on exhaustion the
 * (short) array-so-far is returned rather than throwing.
 */
export function placeAtoms(cfg: PrismboxConfig, rng: Rng): Coord[] {
  const placed: Coord[] = []
  let attempts = 0
  while (placed.length < cfg.atoms && attempts < MAX_PLACEMENT_ATTEMPTS) {
    attempts++
    const r = 1 + Math.floor(rng() * (cfg.size - 2))
    const c = 1 + Math.floor(rng() * (cfg.size - 2))
    if (placed.some((p) => Math.max(Math.abs(p.r - r), Math.abs(p.c - c)) < 2)) continue
    placed.push({ r, c })
  }
  return placed
}

/** Every edge port of a size×size box (4·size of them). */
export function allPorts(size: number): Port[] {
  const ports: Port[] = []
  for (const edge of ['N', 'S', 'W', 'E'] as const) {
    for (let lane = 0; lane < size; lane++) ports.push({ edge, lane })
  }
  return ports
}

/** True when each atom is struck directly by at least one port's beam (the only way to find it). */
export function allAtomsHittable(atoms: Coord[], size: number): boolean {
  const hit = new Set<string>()
  for (const port of allPorts(size)) {
    const shot = simulateShot(atoms, port, size)
    if (shot.hitAtom) hit.add(key(shot.hitAtom.r, shot.hitAtom.c))
  }
  return atoms.every((a) => hit.has(key(a.r, a.c)))
}

/** Re-draws allowed when a layout hides an atom no beam can reach. */
export const MAX_LAYOUT_RETRIES = 50

export function createGame(cfg: PrismboxConfig, seed: number): PrismboxState {
  // ~1% of hard layouts used to hide an atom that no port could hit, making the board
  // unwinnable. Re-draw deterministically from the same seed until every atom is
  // reachable — boards that were already fine (retry 0) are unchanged, so daily seeds
  // keep their layout.
  const playable = (a: Coord[]) => a.length === cfg.atoms && allAtomsHittable(a, cfg.size)
  let atoms = placeAtoms(cfg, mulberry32(seed))
  for (let retry = 1; retry <= MAX_LAYOUT_RETRIES && !playable(atoms); retry++) {
    atoms = placeAtoms(cfg, mulberry32((seed ^ Math.imul(retry, 0x9e3779b9)) >>> 0))
  }
  return {
    config: cfg,
    seed,
    atoms,
    found: Array(cfg.atoms).fill(false),
    shots: [],
    score: 0,
    par: Math.max(1, Math.round(cfg.atoms * cfg.parPerAtom)),
    won: false,
    lastEvent: 'none',
    lastShot: null,
  }
}

// -- Reducer --------------------------------------------------------------

export function reduce(state: PrismboxState, action: PrismboxAction): PrismboxState {
  switch (action.type) {
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    case 'fire': {
      if (state.won) return { ...state, lastEvent: 'none' }
      const { entry } = action
      if (entry.lane < 0 || entry.lane >= state.config.size) {
        return { ...state, lastEvent: 'none' }
      }

      const result = simulateShot(state.atoms, entry, state.config.size)
      const record: ShotRecord = { ...result, seq: state.shots.length + 1 }

      let found = state.found
      let score = state.score
      let event: PrismboxEvent

      if (result.event === 'hit' && result.hitAtom) {
        const hitAtom = result.hitAtom
        const idx = state.atoms.findIndex((a) => a.r === hitAtom.r && a.c === hitAtom.c)
        if (idx >= 0 && !state.found[idx]) {
          found = state.found.slice()
          found[idx] = true
          score += HIT_BONUS
          event = 'fire-hit'
        } else {
          event = 'already-found'
        }
      } else if (result.event === 'reflect') {
        event = 'fire-reflect'
      } else if (result.event === 'through') {
        event = 'fire-through'
      } else {
        // 'refract' and, defensively, 'trapped'
        event = 'fire-refract'
      }

      const shots = [...state.shots, record]
      let won: boolean = state.won
      if (!won && isWon(found)) {
        won = true
        const parBonus = Math.round(PAR_BONUS_MAX * Math.min(1, state.par / shots.length))
        score += WIN_BONUS + parBonus
        event = 'win'
      }

      return { ...state, found, shots, score, won, lastEvent: event, lastShot: record }
    }
    default:
      return state
  }
}
