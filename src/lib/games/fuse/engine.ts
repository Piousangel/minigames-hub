/**
 * Fuse — pure engine.
 *
 * Several wicks burn at once. You have exactly one hand, and moving it costs
 * real ticks, so the order you visit the wicks in IS the game. Every deadline
 * is visible from the moment it spawns; nothing is hidden and nothing is a
 * reaction test.
 *
 * Determinism spine: randomness is drawn ONCE, up front, in `generateSchedule`
 * (the MarketTape pattern from `ticker/engine.ts`). `reduce()` consumes the rng
 * ZERO times in every branch. A spawn cell must dodge live wicks and the hand,
 * which depends on play and therefore cannot be precomputed — so each schedule
 * entry stores a raw `cellPick` in [0,1) that the reducer resolves against the
 * deterministically ordered free-cell list at spawn time. Occupancy-aware, yet
 * still a pure function of (seed, action script).
 *
 * No `Math.random`, no `Date`, no `performance.now` anywhere in this file.
 */

export type Rng = () => number // [0,1); the ONLY randomness source

export interface Cell {
  x: number // 0..COLS-1
  y: number // 0..ROWS-1
}

export type Phase = 'idle' | 'playing' | 'over'
export type Reach = 'safe' | 'tight' | 'doomed'

export interface Wick {
  id: number
  cell: Cell
  remaining: number // ticks until it blows; always >= 1 while live
  total: number // length at spawn — the fuse bar renders remaining/total
  spawnTick: number
}

/** One pre-drawn spawn. `cellPick` is resolved against live occupancy at spawn. */
export interface SpawnEntry {
  tick: number // strictly increasing across entries
  cellPick: number // [0,1) — raw draw, resolved in reduce()
  length: number // fuse length in ticks
}

export interface Schedule {
  seed: number
  entries: SpawnEntry[]
}

export interface Hand {
  at: Cell // the cell currently occupied (always integral)
  path: Cell[] // remaining cells to step onto; last === destination; [] = parked
  stepTicks: number // 0..TICKS_PER_CELL-1 — ticks already spent on the current step
}

/** Everything the component needs to fire juice for the tick that just resolved. */
export interface FuseEvents {
  defusedId: number | null // wick snuffed this tick
  award: number // points added this tick (0 if none)
  exploded: number // wicks that blew this tick (0..n)
  spawned: number // wicks that spawned this tick
  arrived: boolean // hand finished its path this tick
  chainTierUp: boolean // award crossed into a higher chain tier
  over: boolean // lives hit 0 on this tick
}

export interface FuseState {
  phase: Phase
  schedule: Schedule
  spawnCursor: number // next schedule index to consider
  tick: number // ticks elapsed
  hand: Hand
  wicks: Wick[] // live wicks, ALWAYS ordered by id ascending (determinism)
  nextWickId: number
  lives: number
  score: number // the leaderboard number
  saved: number
  lost: number
  chain: number
  bestChain: number
  events: FuseEvents
}

export type FuseAction =
  | { type: 'start' }
  | { type: 'target'; cell: Cell }
  | { type: 'tick' }
  | { type: 'new'; seed: number }

// -- Constants --------------------------------------------------------------

export const COLS = 5
export const ROWS = 5
export const TICKS_PER_CELL = 3
export const TICK_MS = 90 // component only; the engine never reads a clock
export const LIVES = 3
export const CHAIN_STEP = 5
export const MAX_CHAIN_BONUS = 3
export const TIGHT_MARGIN = 6 // 2 cells of slack => 'tight'
export const SCHEDULE_LEN = 600
export const FIRST_SPAWN_TICK = 6
export const GAP_START = 14
export const GAP_MIN = 7
export const GAP_RAMP = 10
export const GAP_JITTER = 5
export const LEN_START_MIN = 24
export const LEN_START_MAX = 40
export const LEN_FLOOR_MIN = 12
export const LEN_FLOOR_MAX = 20
export const LEN_RAMP = 25

/**
 * Tuning note (do not casually change): the max Manhattan distance on a 5x5 is
 * 8, i.e. 24 ticks to cross the board. The late-game floor LEN_FLOOR_MIN = 12
 * is deliberately LESS than a full traverse — that is exactly what makes a
 * far-and-urgent wick genuinely unsalvageable and forces a sacrifice decision.
 * Opening lengths (24..40) are all reachable, so the game teaches before it
 * punishes.
 *
 * Spawn pacing: GAP_START must sit well BELOW the opening fuse length (~32), or
 * every wick is defused before the next appears and the routing decision —
 * the whole point — never shows up (the old 26-tick gap kept ~1.1 wicks live
 * for minutes and a greedy bot cruised past 3 min). 14 -> 7 over 70 spawns
 * keeps ~1.7-2 wicks scheduled live from the opening seconds; the pacing tests
 * pin both "survivable first 30 s" and "no infinite cruise".
 */

// -- Rng --------------------------------------------------------------------

/** Identical impl to decant/engine.ts's mulberry32. */
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

// -- Geometry ---------------------------------------------------------------

export function cellIndex(c: Cell): number {
  return c.y * COLS + c.x
}

export function cellFromIndex(i: number): Cell {
  return { x: i % COLS, y: Math.floor(i / COLS) }
}

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/**
 * Canonical X-first-then-Y walk. Excludes `from`, includes `to`.
 * The path SHAPE is cosmetic: cost is distance-based, so the canonical shape
 * never changes timing.
 */
export function pathBetween(from: Cell, to: Cell): Cell[] {
  const out: Cell[] = []
  let x = from.x
  const y = from.y
  const stepX = to.x > x ? 1 : -1
  while (x !== to.x) {
    x += stepX
    out.push({ x, y })
  }
  let cy = y
  const stepY = to.y > cy ? 1 : -1
  while (cy !== to.y) {
    cy += stepY
    out.push({ x: to.x, y: cy })
  }
  return out
}

// -- Hand / ETA / reach -----------------------------------------------------

/**
 * The load-bearing commitment rule: the hand cannot reverse mid-cell. Whatever
 * step it is currently inside must be finished first.
 */
export function anchorOf(hand: Hand): { cell: Cell; commitTicks: number } {
  if (hand.path.length === 0) return { cell: hand.at, commitTicks: 0 }
  if (hand.stepTicks === 0) return { cell: hand.at, commitTicks: 0 }
  return { cell: hand.path[0], commitTicks: TICKS_PER_CELL - hand.stepTicks }
}

/**
 * Exact number of ticks until the hand stands on `cell`. Not an estimate — it
 * matches the simulation tick-for-tick, which is why `reachOf` can be shown to
 * the player as fact.
 */
export function etaTicks(hand: Hand, cell: Cell): number {
  const a = anchorOf(hand)
  return a.commitTicks + manhattan(a.cell, cell) * TICKS_PER_CELL
}

/**
 * `eta === remaining` is 'tight', NEVER 'doomed' — the tick order defuses
 * before it burns, so arriving on the exact tick a wick would hit zero saves
 * it. See the arrival-beats-the-burn invariant in `reduce`.
 */
export function reachOf(hand: Hand, wick: Wick): Reach {
  const eta = etaTicks(hand, wick.cell)
  if (eta > wick.remaining) return 'doomed'
  if (eta + TIGHT_MARGIN > wick.remaining) return 'tight'
  return 'safe'
}

/**
 * Cells holding no live wick AND not equal to hand.at, ascending by cellIndex.
 * The deterministic order is mandatory — `cellPick` indexes into this list.
 */
export function freeCells(state: FuseState): Cell[] {
  const taken = new Set<number>()
  for (const w of state.wicks) taken.add(cellIndex(w.cell))
  taken.add(cellIndex(state.hand.at))
  const out: Cell[] = []
  for (let i = 0; i < COLS * ROWS; i++) {
    if (!taken.has(i)) out.push(cellFromIndex(i))
  }
  return out
}

// -- Schedule ---------------------------------------------------------------

/**
 * The sole consumer of the rng. EXACTLY 3 draws per entry, in this fixed order:
 * gapPick, cellPick, lenPick. Difficulty ramps on the spawn INDEX only — never
 * on wall-clock or player state — so the whole schedule is a pure function of
 * the seed.
 */
export function generateSchedule(seed: number, count = SCHEDULE_LEN): Schedule {
  const rng = mulberry32(seed)
  const entries: SpawnEntry[] = []
  let prevTick = 0
  for (let i = 0; i < count; i++) {
    const base = Math.max(GAP_MIN, GAP_START - Math.floor(i / GAP_RAMP))
    if (i === 0) prevTick = FIRST_SPAWN_TICK - base
    const gapPick = rng()
    const gap = base + Math.floor(gapPick * GAP_JITTER)
    const tick = prevTick + gap
    prevTick = tick

    const cellPick = rng()

    const lenPick = rng()
    const lo = Math.max(LEN_FLOOR_MIN, LEN_START_MIN - Math.floor(i / LEN_RAMP))
    const hi = Math.max(LEN_FLOOR_MAX, LEN_START_MAX - Math.floor(i / LEN_RAMP))
    const length = lo + Math.floor(lenPick * (hi - lo + 1))

    entries.push({ tick, cellPick, length })
  }
  return { seed, entries }
}

function emptyEvents(): FuseEvents {
  return {
    defusedId: null,
    award: 0,
    exploded: 0,
    spawned: 0,
    arrived: false,
    chainTierUp: false,
    over: false,
  }
}

export function createGame(seed: number): FuseState {
  return {
    phase: 'idle',
    schedule: generateSchedule(seed),
    spawnCursor: 0,
    tick: 0,
    hand: { at: { x: 2, y: 2 }, path: [], stepTicks: 0 },
    wicks: [],
    nextWickId: 1,
    lives: LIVES,
    score: 0,
    saved: 0,
    lost: 0,
    chain: 0,
    bestChain: 0,
    events: emptyEvents(),
  }
}

/** Chain tier: 0..MAX_CHAIN_BONUS. award === 1 + tier. */
function chainTier(chain: number): number {
  return Math.min(MAX_CHAIN_BONUS, Math.floor(chain / CHAIN_STEP))
}

// -- Reducer ----------------------------------------------------------------

/**
 * Total, pure, never mutates its input, and NEVER calls the rng.
 *
 * Tick order is normative and exists to create two invariants:
 *
 * 1. ARRIVAL BEATS THE BURN (defuse precedes burn). Arriving on the exact tick
 *    a wick would hit zero SAVES it. This is what makes reachOf's
 *    `eta === remaining -> 'tight'` boundary true, and what makes every loss
 *    read as an honest "1틱 차이로 못 갔다" instead of an off-by-one betrayal.
 *
 * 2. A wick spawned at tick t with length L explodes at the END of tick t+L if
 *    untouched, and the last tick on which it can be saved is exactly t+L.
 *    Spawning after the burn is what gives the player a travel budget of
 *    precisely L ticks, keeping `eta <= remaining` consistent with the
 *    simulation at every tick.
 */
export function reduce(state: FuseState, action: FuseAction): FuseState {
  switch (action.type) {
    case 'new':
      return createGame(action.seed)

    case 'start': {
      if (state.phase !== 'idle') return state
      return { ...state, phase: 'playing', events: emptyEvents() }
    }

    case 'target': {
      if (state.phase !== 'playing') return state
      const { cell: anchor, commitTicks } = anchorOf(state.hand)
      const hand: Hand =
        commitTicks > 0
          ? {
              at: state.hand.at,
              path: [anchor, ...pathBetween(anchor, action.cell)],
              stepTicks: state.hand.stepTicks, // preserved — the step is committed
            }
          : {
              at: state.hand.at,
              path: pathBetween(state.hand.at, action.cell),
              stepTicks: 0,
            }
      return { ...state, hand, events: emptyEvents() }
    }

    case 'tick': {
      if (state.phase !== 'playing') return state
      const t = state.tick + 1
      const events = emptyEvents()

      // 1. MOVE
      let at = state.hand.at
      let path = state.hand.path
      let stepTicks = state.hand.stepTicks
      if (path.length > 0) {
        stepTicks += 1
        if (stepTicks >= TICKS_PER_CELL) {
          at = path[0]
          path = path.slice(1)
          stepTicks = 0
          events.arrived = path.length === 0
        }
      }

      let wicks = state.wicks
      let score = state.score
      let saved = state.saved
      let lost = state.lost
      let chain = state.chain
      let bestChain = state.bestChain
      let lives = state.lives

      // 2. DEFUSE (before the burn — this is invariant #1)
      const hit = wicks.find((w) => w.cell.x === at.x && w.cell.y === at.y)
      if (hit) {
        wicks = wicks.filter((w) => w.id !== hit.id)
        const tierBefore = chainTier(chain)
        chain += 1
        const tierAfter = chainTier(chain)
        const award = 1 + tierAfter
        score += award
        saved += 1
        if (chain > bestChain) bestChain = chain
        events.defusedId = hit.id
        events.award = award
        events.chainTierUp = tierAfter > tierBefore
      }

      // 3. BURN
      wicks = wicks.map((w) => ({ ...w, remaining: w.remaining - 1 }))

      // 4. EXPLODE
      const survivors = wicks.filter((w) => w.remaining > 0)
      const blown = wicks.length - survivors.length
      if (blown > 0) {
        wicks = survivors
        lives -= blown
        lost += blown
        chain = 0
        events.exploded = blown
      }

      // 5. SPAWN (after the burn — this is invariant #2)
      let spawnCursor = state.spawnCursor
      let nextWickId = state.nextWickId
      const entries = state.schedule.entries
      while (spawnCursor < entries.length && entries[spawnCursor].tick <= t) {
        const entry = entries[spawnCursor]
        spawnCursor += 1 // advance either way — a spawn with no free cell is DROPPED, never deferred
        const free = freeCells({ ...state, wicks, hand: { at, path, stepTicks } })
        if (free.length === 0) continue
        const cell = free[Math.floor(entry.cellPick * free.length)]
        wicks = [
          ...wicks,
          {
            id: nextWickId,
            cell,
            remaining: entry.length,
            total: entry.length,
            spawnTick: t,
          },
        ]
        nextWickId += 1
        events.spawned += 1
      }

      // 6 & 7.
      let phase: Phase = state.phase
      if (lives <= 0) {
        lives = 0
        phase = 'over'
        events.over = true
      }

      return {
        ...state,
        phase,
        spawnCursor,
        tick: t,
        hand: { at, path, stepTicks },
        wicks,
        nextWickId,
        lives,
        score,
        saved,
        lost,
        chain,
        bestChain,
        events,
      }
    }

    default:
      return state
  }
}
