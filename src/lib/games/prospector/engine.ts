// Prospector — pure deterministic engine. RNG is injected; no Math.random here.

export type Rng = () => number // must yield [0, 1); injected — never Math.random inside this file

export type TileKind = 'gem' | 'gas' | 'dynamite'

export interface Tile {
  kind: TileKind
  /** Face value of a gem (+1/+2/+3/+5). 0 for gas and dynamite. */
  value: number
}

export type Phase = 'idle' | 'descending' | 'collapsed' | 'banked'

export interface ProspectorState {
  /** The full, known deck for THIS descent, in fixed post-shuffle order. Length is public. */
  deck: Tile[]
  /** Index of the next tile to flip. Tiles [0, cursor) are face-up. */
  cursor: number
  /** Un-banked value accumulated this descent (float internally). */
  potValue: number
  /** Count of value-flips (gem OR dynamite) this descent. Indexes DEPTH_MULT. */
  safeFlips: number
  /** GAS tiles flipped this descent, 0..3. Reaching GAS_LIMIT collapses. */
  gasCount: number
  /** Cumulative banked score this session (career). Survives across descents. */
  score: number
  phase: Phase
  /** Most recently flipped tile, for the view. null at descent start. */
  lastTile: Tile | null
}

export interface TierSpec {
  key: string
  label: string
  /** Unshuffled composition. */
  tiles: { kind: TileKind; value: number; count: number }[]
}

export const GAS_LIMIT = 3 // flipping the 3rd gas collapses the shaft

/**
 * Depth multiplier applied to a gem's face value, indexed by safeFlips.
 * Index 0 = first value-flip = x1 (so the first gem is worth exactly its face value).
 * Clamped to the last entry for very deep runs. Length 25 (>= max possible safe flips of 24).
 */
export const DEPTH_MULT: number[] = [
  1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8,
  10, 12, 15, 18, 22, 27, 33, 40, 50, 60,
  75, 90, 110, 140, 170,
]

// Three tiers — pure data so tests assert exact odds/pot math. Component ships NORMAL.
export const TIER_EASY: TierSpec = {
  key: 'easy',
  label: 'Easy',
  tiles: [
    { kind: 'gem', value: 1, count: 9 },
    { kind: 'gem', value: 2, count: 6 },
    { kind: 'gem', value: 3, count: 4 },
    { kind: 'gem', value: 5, count: 3 }, // 22 gems
    { kind: 'gas', value: 0, count: 4 },
    { kind: 'dynamite', value: 0, count: 2 },
  ], // 28 tiles
}

export const TIER_NORMAL: TierSpec = {
  key: 'normal',
  label: 'Normal',
  tiles: [
    { kind: 'gem', value: 1, count: 10 },
    { kind: 'gem', value: 2, count: 6 },
    { kind: 'gem', value: 3, count: 4 },
    { kind: 'gem', value: 5, count: 2 }, // 22 gems
    { kind: 'gas', value: 0, count: 6 },
    { kind: 'dynamite', value: 0, count: 2 },
  ], // 30 tiles
}

export const TIER_HARD: TierSpec = {
  key: 'hard',
  label: 'Hard',
  tiles: [
    { kind: 'gem', value: 1, count: 8 },
    { kind: 'gem', value: 2, count: 6 },
    { kind: 'gem', value: 3, count: 5 },
    { kind: 'gem', value: 5, count: 3 }, // 22 gems
    { kind: 'gas', value: 0, count: 8 },
    { kind: 'dynamite', value: 0, count: 2 },
  ], // 32 tiles
}

/** Build the unshuffled deck from a tier's composition. */
export function makeDeck(tier: TierSpec): Tile[] {
  const deck: Tile[] = []
  for (const spec of tier.tiles) {
    for (let i = 0; i < spec.count; i++) {
      deck.push({ kind: spec.kind, value: spec.value })
    }
  }
  return deck
}

/** Fisher–Yates with injected rng. Returns a NEW array; does not mutate input. */
export function shuffle(deck: Tile[], rng: Rng): Tile[] {
  const out = deck.map((t) => ({ ...t }))
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/** Pre-first-run splash state. phase 'idle', empty deck, score preserved (pass 0 on mount). */
export function idleState(score = 0): ProspectorState {
  return {
    deck: [],
    cursor: 0,
    potValue: 0,
    safeFlips: 0,
    gasCount: 0,
    score,
    phase: 'idle',
    lastTile: null,
  }
}

/**
 * Start a fresh descent: shuffle a full deck, reset cursor/pot/safeFlips/gasCount,
 * phase 'descending', lastTile null. PRESERVES `score` from the passed state (or 0).
 */
export function newDescent(tier: TierSpec, rng: Rng, prev?: ProspectorState): ProspectorState {
  return {
    deck: shuffle(makeDeck(tier), rng),
    cursor: 0,
    potValue: 0,
    safeFlips: 0,
    gasCount: 0,
    score: prev?.score ?? 0,
    phase: 'descending',
    lastTile: null,
  }
}

/** Depth multiplier for the given number of prior safe flips (clamped to table end). */
export function depthMult(safeFlips: number): number {
  return DEPTH_MULT[Math.min(safeFlips, DEPTH_MULT.length - 1)]
}

/** Reveal deck[cursor]. Pure — no rng (deck already shuffled). */
export function flip(state: ProspectorState): ProspectorState {
  if (state.phase !== 'descending') return state
  if (state.cursor >= state.deck.length) return state // unreachable given the gas invariant
  const tile = state.deck[state.cursor]
  const base = { ...state, cursor: state.cursor + 1, lastTile: tile }

  if (tile.kind === 'gas') {
    const gasCount = state.gasCount + 1
    if (gasCount >= GAS_LIMIT) {
      // 3rd gas: shaft collapses, entire un-banked pot lost.
      return { ...base, gasCount, potValue: 0, phase: 'collapsed' }
    }
    // 1st/2nd gas: survive. No value, NO multiplier change (gas is a hazard, not a reward).
    return { ...base, gasCount }
  }

  if (tile.kind === 'dynamite') {
    // Doubles the pot AND counts as a safe flip (raises depth).
    return { ...base, potValue: state.potValue * 2, safeFlips: state.safeFlips + 1 }
  }

  // gem: add value * current depth multiplier, THEN deepen.
  const add = tile.value * depthMult(state.safeFlips)
  return { ...base, potValue: state.potValue + add, safeFlips: state.safeFlips + 1 }
}

/** Bank the pot into score and end the descent (keeps deck/cursor for the near-miss peek). */
export function bank(state: ProspectorState): ProspectorState {
  if (state.phase !== 'descending') return state
  const gained = Math.round(state.potValue)
  // score gains the rounded pot; deck/cursor/potValue kept intact so the component can peekNext().
  return { ...state, score: state.score + gained, phase: 'banked' }
}

// ---- Pure read-model helpers (zero simulation) ----

/** Tiles not yet flipped: deck.length - cursor. */
export function tilesRemaining(state: ProspectorState): number {
  return state.deck.length - state.cursor
}

/** GAS tiles still in the ground: totalGasInDeck - gasCount. */
export function gasRemaining(state: ProspectorState): number {
  let totalGas = 0
  for (const t of state.deck) if (t.kind === 'gas') totalGas++
  return totalGas - state.gasCount
}

/**
 * Probability the NEXT flip is the fatal 3rd gas.
 * = gasRemaining / tilesRemaining  when gasCount === GAS_LIMIT-1 (i.e. 2 gas already up),
 * = 0 otherwise (can't be fatal with fewer than 2 gas flipped, or when not descending).
 */
export function fatalOdds(state: ProspectorState): number {
  if (state.phase !== 'descending') return 0
  if (state.gasCount !== GAS_LIMIT - 1) return 0
  const remaining = tilesRemaining(state)
  if (remaining <= 0) return 0
  return gasRemaining(state) / remaining
}

/** The tile the player WOULD draw next (deck[cursor]), or null. Used for the post-bank reveal. */
export function peekNext(state: ProspectorState): Tile | null {
  if (state.cursor >= state.deck.length) return null
  return state.deck[state.cursor]
}

/**
 * Expected change to potValue from flipping ONE more tile (the EV engine of the game).
 * Averaged over every still-hidden tile:
 *   gem      → + value * depthMult(safeFlips)
 *   dynamite → + potValue   (doubling adds the current pot)
 *   gas      → 0 if gasCount < GAS_LIMIT-1 (survive, no value)
 *            → -potValue if gasCount === GAS_LIMIT-1 (fatal, whole pot lost)
 * Returns 0 when not descending or no tiles remain.
 */
export function nextFlipEV(state: ProspectorState): number {
  if (state.phase !== 'descending') return 0
  const remaining = tilesRemaining(state)
  if (remaining <= 0) return 0
  const mult = depthMult(state.safeFlips)
  const fatal = state.gasCount === GAS_LIMIT - 1
  let sum = 0
  for (let i = state.cursor; i < state.deck.length; i++) {
    const t = state.deck[i]
    if (t.kind === 'gem') sum += t.value * mult
    else if (t.kind === 'dynamite') sum += state.potValue
    else if (t.kind === 'gas') sum += fatal ? -state.potValue : 0
  }
  return sum / remaining
}

/** True when flipping is at-best break-even → the disciplined move is to bank. */
export function shouldBank(state: ProspectorState): boolean {
  return nextFlipEV(state) <= 0
}
