/**
 * Decant — pure engine.
 *
 * A density-sorted test-tube puzzle. A color is an integer 1..K whose numeric
 * value IS its density rank (higher = denser). Every tube is held globally
 * non-increasing bottom→top (the "sorted invariant"): tube[i] >= tube[i+1].
 * A pour lifts the entire top band (the lightest exposed color) off the source
 * and sinks it in the destination to its density layer, merging with an equal
 * band if present, and "burping" any lighter bands up.
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters only through an injected `Rng`, used solely
 * in board generation. The pour and the reducer consume no rng, so every
 * scoring / cascade / merge outcome is golden-testable from a fixed script.
 */

export const DEFAULT_CAP = 4
export const UNDO_POOL = 5 // undos granted per board
export const CASCADE_MIN = 2 // cascadeDepth >= this counts as a Cascade
export const CASCADE_BASE = 25 // cascade bonus unit
export const WIN_BONUS = 1000
export const PAR_BONUS_MAX = 1000
export const MAX_GEN_ATTEMPTS = 30 // seed retries if a scramble lands already-solved

export type Rng = () => number // returns a float in [0,1)
export type Color = number // 1..K; value === density rank
export type Tube = Color[] // bottom -> top; sorted invariant

export interface DecantConfig {
  colors: number // K, 4..6
  capacity: number // CAP units per tube (default 4)
  extraTubes: number // empty tubes beyond K (default 2)
  scramble: number // requested reverse-move count (par upper bound)
}

export type DecantEvent =
  | 'none'
  | 'select'
  | 'deselect'
  | 'move'
  | 'merge'
  | 'cascade'
  | 'illegal'
  | 'undo'
  | 'win'

export interface UndoEntry {
  tubes: Tube[]
  pours: number
  score: number
  cascadeStreak: number
  deepestCascade: number
}

export interface PourOutcome {
  tubes: Tube[] // full tubes array with src & dst replaced
  color: Color
  count: number // units moved
  landedIndex: number // resting slot in dst (0 = bottom) = below.length
  merged: boolean // an equal-color band already existed in dst
  cascadeDepth: number // # distinct colors in dst strictly lighter than `color`
  burped: boolean // landedIndex === 0 && dst was non-empty
  bonus: number // cascade bonus points (reducer is source of truth; 0 here)
}

export interface DecantState {
  config: DecantConfig
  seed: number
  tubes: Tube[]
  selection: number | null
  pours: number
  par: number
  score: number
  cascadeStreak: number
  deepestCascade: number
  undoStack: UndoEntry[]
  undosLeft: number
  won: boolean
  lastEvent: DecantEvent
  lastPour: PourOutcome | null
}

export type DecantAction =
  | { type: 'select'; tube: number }
  | { type: 'undo' }
  | { type: 'reset' }
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

export const DIFFICULTIES = {
  easy: { colors: 4, capacity: 4, extraTubes: 2, scramble: 16 },
  normal: { colors: 5, capacity: 4, extraTubes: 2, scramble: 24 },
  hard: { colors: 6, capacity: 4, extraTubes: 2, scramble: 32 },
} satisfies Record<'easy' | 'normal' | 'hard', DecantConfig>

export const DAILY_CONFIG: DecantConfig = DIFFICULTIES.normal

// -- Pure primitives --------------------------------------------------------

/** null if empty; else the trailing run of the lightest (top) color. */
export function topBand(tube: Tube): { color: Color; count: number } | null {
  if (tube.length === 0) return null
  const color = tube[tube.length - 1]
  let count = 0
  for (let i = tube.length - 1; i >= 0 && tube[i] === color; i--) count++
  return { color, count }
}

/** A tube is solved when empty OR every unit is the same color. */
export function isTubeSolved(tube: Tube): boolean {
  if (tube.length === 0) return true
  const first = tube[0]
  for (let i = 1; i < tube.length; i++) if (tube[i] !== first) return false
  return true
}

/** Won when every tube is solved (monochrome or empty). */
export function isWon(tubes: Tube[]): boolean {
  for (const t of tubes) if (!isTubeSolved(t)) return false
  return true
}

/** # of distinct colors present in `dst` with value strictly less than `c`. */
export function distinctLighter(dst: Tube, c: Color): number {
  const seen = new Set<Color>()
  for (const x of dst) if (x < c) seen.add(x)
  return seen.size
}

// -- The pour ---------------------------------------------------------------

export function canPour(state: DecantState, src: number, dst: number): boolean {
  if (state.won) return false
  if (src === dst) return false
  const T = state.tubes
  if (src < 0 || src >= T.length || dst < 0 || dst >= T.length) return false
  const band = topBand(T[src])
  if (!band) return false
  return T[dst].length + band.count <= state.config.capacity
}

/**
 * Compute the full outcome of pouring src's top band into dst. Returns null
 * when the move is illegal (source empty, same tube, out of range, overflow).
 * Never mutates the input tubes.
 */
export function computePour(
  tubes: Tube[],
  src: number,
  dst: number,
  cfg: DecantConfig,
): PourOutcome | null {
  if (src === dst) return null
  if (src < 0 || src >= tubes.length || dst < 0 || dst >= tubes.length) return null
  const band = topBand(tubes[src])
  if (!band) return null
  const { color: c, count: n } = band
  const d = tubes[dst]
  if (d.length + n > cfg.capacity) return null

  const below: Color[] = []
  const same: Color[] = []
  const above: Color[] = []
  for (const x of d) {
    if (x > c) below.push(x)
    else if (x === c) same.push(x)
    else above.push(x)
  }

  const newDst = [...below, ...same, ...Array<Color>(n).fill(c), ...above]
  const newSrc = tubes[src].slice(0, tubes[src].length - n)

  const outTubes = tubes.slice()
  outTubes[src] = newSrc
  outTubes[dst] = newDst

  const landedIndex = below.length
  return {
    tubes: outTubes,
    color: c,
    count: n,
    landedIndex,
    merged: same.length > 0,
    cascadeDepth: distinctLighter(d, c),
    burped: landedIndex === 0 && d.length > 0,
    bonus: 0,
  }
}

// -- Board generation via inverse pours -------------------------------------

interface ReverseMove {
  dst: number // tube a color band is lifted FROM (forward-pour destination)
  src: number // tube it is pushed ONTO (forward-pour source)
  maxA: number // largest amount of the top color that may move
}

/**
 * Build a board by applying inverse pours to a solved state, so the board is
 * guaranteed solvable in `par` forward pours (replay the reverse moves in
 * reverse order).
 *
 * A reverse move lifts `a` units of `dst`'s top color `c` and pushes them onto
 * `src`, where `src` is empty or its top is strictly denser than `c` (so the
 * pushed band sits cleanly on top and forward-pours as one band). Crucially
 * `a` may be a PARTIAL amount (1..count): partial moves are what let a color
 * come to rest on top of a different denser color, which is the only way to
 * actually mix an initially all-full-or-empty board.
 */
export function generateTubes(cfg: DecantConfig, rng: Rng): { tubes: Tube[]; par: number } {
  const CAP = cfg.capacity
  const tubes: Tube[] = []
  for (let k = 1; k <= cfg.colors; k++) tubes.push(Array<Color>(CAP).fill(k))
  for (let e = 0; e < cfg.extraTubes; e++) tubes.push([])

  const T = tubes.length
  let applied = 0
  let lastMove: { dst: number; src: number } | null = null
  const maxAttempts = cfg.scramble * 20
  let attempts = 0

  while (applied < cfg.scramble && attempts < maxAttempts) {
    attempts++
    const candidates: ReverseMove[] = []
    for (let dst = 0; dst < T; dst++) {
      const band = topBand(tubes[dst])
      if (!band) continue
      const { color: c, count: n } = band
      for (let src = 0; src < T; src++) {
        if (src === dst) continue
        const srcBand = topBand(tubes[src])
        // src empty OR its top strictly denser than c (keeps src sorted, no merge)
        if (srcBand && srcBand.color <= c) continue
        const room = CAP - tubes[src].length
        if (room <= 0) continue
        // avoid the exact inverse of the previous reverse move (A->B->A churn)
        if (lastMove && lastMove.dst === src && lastMove.src === dst) continue
        candidates.push({ dst, src, maxA: Math.min(n, room) })
      }
    }
    if (candidates.length === 0) break
    const pick = candidates[Math.floor(rng() * candidates.length)]
    const c = tubes[pick.dst][tubes[pick.dst].length - 1]
    const a = 1 + Math.floor(rng() * pick.maxA) // partial amount, 1..maxA
    tubes[pick.dst] = tubes[pick.dst].slice(0, tubes[pick.dst].length - a)
    for (let i = 0; i < a; i++) tubes[pick.src].push(c)
    lastMove = { dst: pick.dst, src: pick.src }
    applied++
  }

  return { tubes, par: Math.max(1, applied) }
}

export function createGame(cfg: DecantConfig, seed: number): DecantState {
  let useSeed = seed
  let result = generateTubes(cfg, mulberry32(useSeed))
  let attempts = 0
  while (isWon(result.tubes) && attempts < MAX_GEN_ATTEMPTS) {
    useSeed = (useSeed + 1) >>> 0
    result = generateTubes(cfg, mulberry32(useSeed))
    attempts++
  }
  return {
    config: cfg,
    seed,
    tubes: result.tubes,
    selection: null,
    pours: 0,
    par: result.par,
    score: 0,
    cascadeStreak: 0,
    deepestCascade: 0,
    undoStack: [],
    undosLeft: UNDO_POOL,
    won: false,
    lastEvent: 'none',
    lastPour: null,
  }
}

// -- Reducer ----------------------------------------------------------------

function snapshot(state: DecantState): UndoEntry {
  return {
    tubes: state.tubes.map((t) => t.slice()),
    pours: state.pours,
    score: state.score,
    cascadeStreak: state.cascadeStreak,
    deepestCascade: state.deepestCascade,
  }
}

export function reduce(state: DecantState, action: DecantAction): DecantState {
  switch (action.type) {
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    case 'undo': {
      if (state.won || state.undosLeft <= 0 || state.undoStack.length === 0) {
        return { ...state, lastEvent: 'none' }
      }
      const [head, ...rest] = state.undoStack
      return {
        ...state,
        tubes: head.tubes.map((t) => t.slice()),
        pours: head.pours,
        score: head.score,
        cascadeStreak: head.cascadeStreak,
        deepestCascade: head.deepestCascade,
        selection: null,
        undoStack: rest,
        undosLeft: state.undosLeft - 1,
        lastPour: null,
        lastEvent: 'undo',
      }
    }
    case 'select': {
      const tube = action.tube
      if (state.won) return { ...state, lastEvent: 'none' }
      if (tube < 0 || tube >= state.tubes.length) return { ...state, lastEvent: 'none' }

      if (state.selection === null) {
        if (state.tubes[tube].length === 0) return { ...state, lastEvent: 'none' }
        return { ...state, selection: tube, lastEvent: 'select' }
      }
      if (state.selection === tube) {
        return { ...state, selection: null, lastEvent: 'deselect' }
      }

      const src = state.selection
      const dst = tube
      const out = computePour(state.tubes, src, dst, state.config)
      if (out === null) {
        return { ...state, selection: null, lastPour: null, lastEvent: 'illegal' }
      }

      const pre = snapshot(state)
      let cascadeStreak = state.cascadeStreak
      let bonus = 0
      let event: DecantEvent
      if (out.cascadeDepth >= CASCADE_MIN) {
        cascadeStreak = state.cascadeStreak + 1
        bonus = CASCADE_BASE * (out.cascadeDepth - 1) * cascadeStreak
        event = 'cascade'
      } else {
        cascadeStreak = 0
        bonus = 0
        event = out.merged ? 'merge' : 'move'
      }

      let score = state.score + bonus
      const deepestCascade = Math.max(state.deepestCascade, out.cascadeDepth)
      const pours = state.pours + 1

      const undoStack = [pre, ...state.undoStack].slice(0, UNDO_POOL)

      let won = false
      if (isWon(out.tubes)) {
        won = true
        const parBonus = Math.round(
          PAR_BONUS_MAX * Math.min(1, state.par / Math.max(1, pours)),
        )
        score += WIN_BONUS + parBonus
        event = 'win'
      }

      return {
        ...state,
        tubes: out.tubes,
        selection: null,
        pours,
        score,
        cascadeStreak,
        deepestCascade,
        undoStack,
        won,
        lastPour: { ...out, bonus },
        lastEvent: event,
      }
    }
    default:
      return state
  }
}

// -- Optional hint helper (no lose state) -----------------------------------

/** true iff !won and no legal, state-changing pour exists (drives a hint). */
export function isDeadlocked(state: DecantState): boolean {
  if (state.won) return false
  const T = state.tubes
  for (let src = 0; src < T.length; src++) {
    if (T[src].length === 0) continue
    for (let dst = 0; dst < T.length; dst++) {
      if (src === dst) continue
      if (canPour(state, src, dst)) {
        // A pour into an identical monochrome/empty relocation still changes state.
        return false
      }
    }
  }
  return true
}
