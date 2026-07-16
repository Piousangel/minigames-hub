/**
 * Overdub — pure engine.
 *
 * A 16-step loop with a playhead orbiting it. Every tap stamps a note at the
 * step the head is currently on, permanently. Landing beside an existing note
 * doubles the placement (x2 one side, x4 sandwiched); landing ON one ends the
 * run. Filling all 16 steps CLEARS the loop: bonus, fresh (denser) ghost
 * layout, and a permanently faster playhead.
 *
 * Determinism: no `Date`, no `performance`, no `Math.random`. Randomness enters
 * only through an injected `Rng`, and only in ghost placement — `tick`, a
 * normal `tap` and a fatal `tap` consume ZERO rng. A whole run is therefore
 * reproducible from `(seed, tapTicks[])`.
 *
 * The head is an INTEGER `headMicro` (micro-units), advanced by an integer
 * `speed` each fixed tick. No floats in the simulation => no drift, and golden
 * snapshots never churn on float formatting.
 *
 * Anti-farming rail: the run ends only by the player's own tap, so there is no
 * passive income anywhere — `tick`, `wrap` and `out` award nothing. A player
 * who never taps never scores.
 */

export type Rng = () => number // returns a float in [0,1)

export const STEPS = 16
export const STEP_MICRO = 960
export const LOOP_MICRO = STEPS * STEP_MICRO // 15360
export const TICK_SECONDS = 1 / 60

export const BASE_SPEED = 96 // 10 ticks/step -> 2.67 s loop when empty
export const SPEED_PER_NOTE = 6 // the player's own greed accelerates the loop
export const SPEED_PER_LAP = 12
export const MAX_SPEED = 320 // safety rail: 3 ticks/step

export const NOTE_BASE = 10
export const CHAIN_BONUS = 25
export const CLEAR_BONUS = 500

export const GHOST_BASE = 2
export const GHOST_MAX = 6

/** Salt for per-lap ghost layouts, derived from the run seed (golden ratio). */
const CLEAR_SALT = 0x9e3779b1

export type OverdubEvent =
  | 'none'
  | 'place' // note placed, no adjacency (mult 1)
  | 'bonus' // note placed adjacent to >=1 note (mult 2 or 4)
  | 'clear' // that placement filled all 16 steps
  | 'wrap' // playhead crossed the loop boundary this tick
  | 'out' // tapped an occupied step; run over

export interface OverdubState {
  seed: number // the run's seed; per-lap ghosts derive from it
  notes: boolean[] // length 16; true = occupied (ghost or player)
  ghosts: boolean[] // ghosts[i] implies notes[i]. Render-only distinction.
  headMicro: number // 0 .. LOOP_MICRO-1
  tick: number // fixed ticks elapsed this run (monotonic)
  lap: number // completed loop-CLEARS this run (0-based difficulty level)
  wraps: number // playhead revolutions this run (stat only, never scored)
  score: number // monotonically non-decreasing integer
  chain: number // consecutive mult>1 placements
  bestChain: number
  placed: number // player-placed notes this run (stat)
  lastGain: number // points from the last placement (0 otherwise)
  lastStep: number | null // step of last tap (placed OR fatal) — drives FX
  lastMult: number // 1 | 2 | 4 from last placement
  over: boolean
  event: OverdubEvent // single-valued; out > clear > bonus > place > wrap
}

export type OverdubAction =
  | { type: 'tick' }
  | { type: 'tap' }
  | { type: 'reset' } // same seed
  | { type: 'new'; seed: number }

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

/** How many steps are occupied. 0..16. */
export function noteCount(notes: boolean[]): number {
  let n = 0
  for (const b of notes) if (b) n++
  return n
}

/**
 * The step the head is on — the cell the UI lights and the cell a tap resolves
 * against. WYSIWYG is load-bearing here: collision is judged on the lit cell.
 */
export function headStep(state: OverdubState): number {
  return Math.floor(state.headMicro / STEP_MICRO)
}

/** Density and lap both speed the loop up, capped. Integer, non-decreasing. */
export function speedFor(count: number, lap: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER_NOTE * count + SPEED_PER_LAP * lap)
}

/** Occupied neighbours of `step`, wrapping the loop modularly. 0 | 1 | 2. */
export function adjacency(notes: boolean[], step: number): number {
  const left = notes[(step + STEPS - 1) % STEPS] ? 1 : 0
  const right = notes[(step + 1) % STEPS] ? 1 : 0
  return left + right
}

/** One side = the literal x2 of the pitch; sandwiched = x4. */
export function multFor(adj: number): number {
  return [1, 2, 4][adj]
}

/** Ghosts seeded into the loop at a given lap, clamped. */
export function ghostsFor(lap: number): number {
  return Math.min(GHOST_BASE + lap, GHOST_MAX)
}

/**
 * Seed `ghostsFor(lap)` distinct steps. Consumes exactly that many rng calls,
 * one per ghost, each an index into the shrinking `free` list.
 */
export function placeGhosts(lap: number, rng: Rng): { notes: boolean[]; ghosts: boolean[] } {
  const notes = Array<boolean>(STEPS).fill(false)
  const ghosts = Array<boolean>(STEPS).fill(false)
  const free: number[] = []
  for (let i = 0; i < STEPS; i++) free.push(i)

  const n = ghostsFor(lap)
  for (let g = 0; g < n; g++) {
    const i = Math.floor(rng() * free.length)
    const s = free.splice(i, 1)[0]
    notes[s] = true
    ghosts[s] = true
  }
  return { notes, ghosts }
}

/** The rng a given lap's ghost layout comes from — derived, never stored. */
function clearRng(seed: number, lap: number): Rng {
  return mulberry32((seed + lap * CLEAR_SALT) >>> 0)
}

export function createGame(seed: number): OverdubState {
  const { notes, ghosts } = placeGhosts(0, mulberry32(seed))
  return {
    seed,
    notes,
    ghosts,
    headMicro: 0,
    tick: 0,
    lap: 0,
    wraps: 0,
    score: 0,
    chain: 0,
    bestChain: 0,
    placed: 0,
    lastGain: 0,
    lastStep: null,
    lastMult: 1,
    over: false,
    event: 'none',
  }
}

// -- Reducer ----------------------------------------------------------------

export function reduce(state: OverdubState, action: OverdubAction): OverdubState {
  switch (action.type) {
    case 'reset':
      return createGame(state.seed)
    case 'new':
      return createGame(action.seed)

    case 'tick': {
      if (state.over) return { ...state, event: 'none' }
      const speed = speedFor(noteCount(state.notes), state.lap)
      const next = state.headMicro + speed
      const wrapped = next >= LOOP_MICRO
      return {
        ...state,
        headMicro: next % LOOP_MICRO,
        tick: state.tick + 1,
        wraps: state.wraps + (wrapped ? 1 : 0),
        // Ticking never scores. This is the anti-farming rail.
        event: wrapped ? 'wrap' : 'none',
      }
    }

    case 'tap': {
      if (state.over) return { ...state, event: 'none' }
      const s = headStep(state)

      // Stamped on your own note.
      if (state.notes[s]) {
        return { ...state, over: true, event: 'out', lastStep: s, lastGain: 0 }
      }

      const notes = state.notes.slice()
      notes[s] = true

      const adj = adjacency(state.notes, s) // pre-placement: never its own neighbour
      const mult = multFor(adj)
      const count = noteCount(notes) // post-placement: density IS score
      const chain = mult > 1 ? state.chain + 1 : 0
      const gain = NOTE_BASE * count * mult + CHAIN_BONUS * chain

      const placedState: OverdubState = {
        ...state,
        notes,
        score: state.score + gain,
        placed: state.placed + 1,
        chain,
        bestChain: Math.max(state.bestChain, chain),
        lastGain: gain,
        lastStep: s,
        lastMult: mult,
        event: mult > 1 ? 'bonus' : 'place',
      }

      if (count < STEPS) return placedState

      // The placement filled the loop: clear in the same reduce call, so a
      // returned state is never all-true.
      const lap = state.lap + 1
      const fresh = placeGhosts(lap, clearRng(state.seed, lap))
      return {
        ...placedState,
        notes: fresh.notes,
        ghosts: fresh.ghosts,
        lap,
        score: placedState.score + CLEAR_BONUS * lap,
        event: 'clear',
      }
    }

    default:
      return state
  }
}
