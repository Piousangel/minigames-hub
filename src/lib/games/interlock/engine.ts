/**
 * Interlock — pure engine.
 *
 * Two bead rings (Hungarian-Rings topology) share exactly two crossing slots.
 * Rotating one ring one step cycles its ten slots; because two of those slots
 * are shared with the other ring, a bead can hop from ring to ring across a
 * crossing. The board is scrambled by reverse rotations from the solved state,
 * so it is always solvable in `par` (= scramble) moves or fewer.
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters only through an injected `Rng`, consumed
 * solely by board generation (exactly `scramble` calls). Rotation, undo, and
 * scoring consume no rng, so every outcome is golden-testable from a fixed
 * seed / script.
 */

export type Rng = () => number // returns a float in [0,1)
export type Color = number // 1..K
export type RingId = 'A' | 'B'
export type Dir = 1 | -1 // +1 / -1 cyclic shift

export type InterlockEvent = 'none' | 'rotate' | 'undo' | 'win'

// -- Fixed geometry (engine constants) --------------------------------------

export const N = 18
export const K = 5

/** The two crossing (shared) global indices. */
export const SHARED: readonly number[] = [0, 1]

/**
 * Each ring is a cyclic ordering of global indices (length 10). Slot 0 and slot
 * 5 are the two shared crossings; slots 1..4 / 6..9 are the ring's own arcs.
 */
export const RING_A: readonly number[] = [0, 2, 3, 4, 5, 1, 6, 7, 8, 9]
export const RING_B: readonly number[] = [0, 10, 11, 12, 13, 1, 14, 15, 16, 17]

/** Home-arc target (solved). */
export const SOLVED: readonly Color[] = [
  5, 5, // pos 0,1  : shared hub beads
  1, 1, 1, 1, // pos 2..5 : arcA1
  2, 2, 2, 2, // pos 6..9 : arcA2
  3, 3, 3, 3, // pos 10..13: arcB1
  4, 4, 4, 4, // pos 14..17: arcB2
]

export const WIN_BONUS = 1000
export const PAR_BONUS_MAX = 1000 // efficiency bonus cap (asymptotic)
export const DEPTH_UNIT = 20 // depth bonus per scramble step
export const UNDO_POOL = 5
export const MAX_GEN_ATTEMPTS = 30

/**
 * Scramble depths. 12/20/30 turned out to be an effectively full Hungarian-rings
 * shuffle — far beyond what a person can plan through, so `par` was only a loose
 * upper bound. Measured with a BFS over seeds (see engine.test.ts "difficulty
 * curve"): 4 reverse rotations need exactly 4 moves to undo, 10 need 8–10 in
 * ~90% of boards. Hard stays deep for experts.
 */
export const DIFFICULTIES = {
  easy: { scramble: 4 },
  normal: { scramble: 10 },
  hard: { scramble: 16 },
} satisfies Record<'easy' | 'normal' | 'hard', { scramble: number }>

export const DAILY_SCRAMBLE = 10 // = normal

export interface RotateOutcome {
  cells: Color[] // full array after rotation (input untouched)
  ring: RingId
  dir: Dir
  crossed: Color[] // colors newly landed in a shared slot (0..2, for juice)
}

export interface UndoEntry {
  cells: Color[]
  moves: number
}

export interface InterlockState {
  seed: number
  scramble: number // reverse-scramble count = par
  cells: Color[] // length N
  moves: number // user rotations
  won: boolean
  score: number // filled only on win (0 before)
  undoStack: UndoEntry[] // newest at head
  undosLeft: number
  lastEvent: InterlockEvent
  lastRotate: RotateOutcome | null
}

export type InterlockAction =
  | { type: 'rotate'; ring: RingId; dir: Dir }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'new'; seed: number; scramble: number }

/** Identical impl to the template's mulberry32. */
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

// -- Pure primitives --------------------------------------------------------

function ringIndices(ring: RingId): readonly number[] {
  return ring === 'A' ? RING_A : RING_B
}

/**
 * Cyclically shift `ring`'s beads by one step in `dir`, returning a NEW array.
 * dir=+1: each slot receives the value from the previous slot.
 */
export function rotateCells(cells: Color[], ring: RingId, dir: Dir): Color[] {
  const R = ringIndices(ring)
  const L = R.length
  const out = cells.slice()
  for (let i = 0; i < L; i++) {
    out[R[i]] = cells[R[(i - dir + L) % L]]
  }
  return out
}

/** rotateCells + the `crossed` colors (new arrivals in a shared slot). */
export function computeRotate(cells: Color[], ring: RingId, dir: Dir): RotateOutcome {
  const next = rotateCells(cells, ring, dir)
  const crossed: Color[] = []
  for (const p of SHARED) if (next[p] !== cells[p]) crossed.push(next[p])
  return { cells: next, ring, dir, crossed }
}

/** Won when every position matches the home-arc target exactly. */
export function isSolved(cells: Color[]): boolean {
  for (let i = 0; i < N; i++) if (cells[i] !== SOLVED[i]) return false
  return true
}

/**
 * Higher-is-better integer score. Strictly decreasing in `moves` (one fewer
 * move always scores more — never saturates), increasing in `scramble`.
 */
export function scoreFor(scramble: number, moves: number): number {
  const efficiency = Math.round((PAR_BONUS_MAX * scramble) / (scramble + moves))
  const depth = scramble * DEPTH_UNIT
  return WIN_BONUS + depth + efficiency
}

// -- Board generation via reverse rotations ---------------------------------

interface Move {
  ring: RingId
  dir: Dir
}

const ALL_MOVES: readonly Move[] = [
  { ring: 'A', dir: 1 },
  { ring: 'A', dir: -1 },
  { ring: 'B', dir: 1 },
  { ring: 'B', dir: -1 },
]

/**
 * Scramble from solved by reverse rotations. Consumes rng EXACTLY `scramble`
 * times (one per step). Because every rotation is invertible, replaying the
 * inverse rotations in reverse order returns SOLVED — so the board is always
 * solvable in `scramble` moves or fewer. The immediate inverse of the previous
 * move is forbidden to avoid A→A⁻¹ churn (keeps par honest).
 */
export function generateCells(scramble: number, rng: Rng): Color[] {
  let cells = SOLVED.slice()
  let last: Move | null = null
  for (let step = 0; step < scramble; step++) {
    const cand = ALL_MOVES.filter(
      (m) => !(last && m.ring === last.ring && m.dir === -last.dir),
    )
    const pick = cand[Math.floor(rng() * cand.length)]
    cells = rotateCells(cells, pick.ring, pick.dir)
    last = pick
  }
  return cells
}

export function createGame(seed: number, scramble: number): InterlockState {
  let useSeed = seed >>> 0
  let cells = generateCells(scramble, mulberry32(useSeed))
  let attempts = 0
  while (isSolved(cells) && attempts < MAX_GEN_ATTEMPTS) {
    useSeed = (useSeed + 1) >>> 0
    cells = generateCells(scramble, mulberry32(useSeed))
    attempts++
  }
  return {
    seed,
    scramble,
    cells,
    moves: 0,
    won: false,
    score: 0,
    undoStack: [],
    undosLeft: UNDO_POOL,
    lastEvent: 'none',
    lastRotate: null,
  }
}

// -- Reducer ----------------------------------------------------------------

export function reduce(state: InterlockState, action: InterlockAction): InterlockState {
  switch (action.type) {
    case 'reset':
      return createGame(state.seed, state.scramble)
    case 'new':
      return createGame(action.seed, action.scramble)
    case 'undo': {
      if (state.won || state.undosLeft <= 0 || state.undoStack.length === 0) {
        return { ...state, lastEvent: 'none' }
      }
      const [head, ...rest] = state.undoStack
      return {
        ...state,
        cells: head.cells.slice(),
        moves: head.moves,
        undoStack: rest,
        undosLeft: state.undosLeft - 1,
        lastRotate: null,
        lastEvent: 'undo',
      }
    }
    case 'rotate': {
      if (state.won) return { ...state, lastEvent: 'none' }
      const out = computeRotate(state.cells, action.ring, action.dir)
      const moves = state.moves + 1
      const undoStack = [
        { cells: state.cells.slice(), moves: state.moves },
        ...state.undoStack,
      ].slice(0, UNDO_POOL)

      if (isSolved(out.cells)) {
        return {
          ...state,
          cells: out.cells,
          moves,
          undoStack,
          won: true,
          score: scoreFor(state.scramble, moves),
          lastRotate: out,
          lastEvent: 'win',
        }
      }
      return {
        ...state,
        cells: out.cells,
        moves,
        undoStack,
        won: false,
        score: 0,
        lastRotate: out,
        lastEvent: 'rotate',
      }
    }
    default:
      return state
  }
}
