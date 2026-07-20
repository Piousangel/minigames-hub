/**
 * Dominoes — Draw Dominoes (double-six), 2 players. Pure, deterministic engine.
 *
 * Rules implemented:
 * - Standard double-six set: 28 unique unordered tiles, [0,0] .. [6,6].
 * - Each player draws 7 tiles; the remaining 14 form the boneyard.
 * - Players alternate. On your turn you place a tile so one of its pips matches
 *   an OPEN END of the line (the layout has two open ends: leftEnd / rightEnd).
 * - If you cannot play you DRAW from the boneyard until you can, or PASS when the
 *   boneyard is empty and you still have no play.
 * - First to empty their hand wins ("domino"). If the game is BLOCKED (both
 *   players pass consecutively with an empty boneyard) the player with the lower
 *   total pip count in hand wins; equal pips => draw (winner = null).
 *
 * OPENING RULE (judgment call, simplest per spec): player 0 opens by placing ANY
 * tile (no forced highest-double). The tile sets both open ends.
 *
 * BLOCKED-TIE RULE (judgment call): equal pip counts => draw, status 'blocked',
 * winner = null.
 *
 * PURITY: every function is pure and total. No timers, no Date, no Math.random.
 * Randomness enters ONLY through the injected `Rng`, consumed ONLY at `deal`
 * (shuffle) and in `aiMove` (tie-breaking equal-value plays). Every move function
 * is (state) -> state and REJECTS illegal moves by returning the SAME state
 * reference, so callers/tests can assert a no-op with `===`.
 */

export type Rng = () => number // float in [0,1)

/** A domino tile: two pip values, each 0..6. Stored oriented in the line so the
 * `[a, b]` reads left-to-right (a is the left face, b is the right face). */
export type Tile = [number, number]

export type Side = 'left' | 'right'
export type Status = 'playing' | 'won' | 'blocked'

export interface State {
  /** Two hands (index 0 and 1). */
  hands: Tile[][]
  /** Placed tiles, left -> right, each oriented so adjacent faces match:
   * line[i][1] === line[i+1][0]. */
  line: Tile[]
  /** Open pip value at the left end of the line (-1 when the line is empty). */
  leftEnd: number
  /** Open pip value at the right end of the line (-1 when the line is empty). */
  rightEnd: number
  boneyard: Tile[]
  turn: 0 | 1
  status: Status
  winner: 0 | 1 | null
  /** Consecutive passes; two in a row (empty boneyard) => blocked. */
  passes: number
}

/** A move the AI wants applied. The component drives draw-loops itself. */
export type AiAction =
  | { type: 'play'; tileIndex: number; side: Side }
  | { type: 'draw' }
  | { type: 'pass' }

export const HAND_SIZE = 7
export const MAX_PIP = 6

// -- PRNG (byte-identical to solitaire/engine.ts mulberry32) -----------------

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

// -- Tile set ----------------------------------------------------------------

export function pips(tile: Tile): number {
  return tile[0] + tile[1]
}

export function isDouble(tile: Tile): boolean {
  return tile[0] === tile[1]
}

/** The full double-six set: 28 unique unordered tiles in canonical order. */
export function makeSet(): Tile[] {
  const set: Tile[] = []
  for (let a = 0; a <= MAX_PIP; a++) {
    for (let b = a; b <= MAX_PIP; b++) {
      set.push([a, b])
    }
  }
  return set
}

/** Deterministic Fisher-Yates. Returns a new shuffled array; input untouched. */
export function shuffle(tiles: Tile[], rng: Rng): Tile[] {
  const out = tiles.map((t): Tile => [t[0], t[1]])
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// -- Dealing -----------------------------------------------------------------

/** Shuffle the 28 tiles, deal 7 to each hand, 14 to the boneyard, turn 0. */
export function deal(rng: Rng): State {
  const deck = shuffle(makeSet(), rng)
  return {
    hands: [deck.slice(0, HAND_SIZE), deck.slice(HAND_SIZE, HAND_SIZE * 2)],
    line: [],
    leftEnd: -1,
    rightEnd: -1,
    boneyard: deck.slice(HAND_SIZE * 2),
    turn: 0,
    status: 'playing',
    winner: null,
    passes: 0,
  }
}

// -- Queries -----------------------------------------------------------------

export function handPips(hand: Tile[]): number {
  let sum = 0
  for (const t of hand) sum += pips(t)
  return sum
}

/** A tile is playable if either pip matches an open end (empty line => any). */
export function canPlay(tile: Tile, leftEnd: number, rightEnd: number): boolean {
  if (leftEnd < 0) return true // empty line: anything opens
  return (
    tile[0] === leftEnd ||
    tile[1] === leftEnd ||
    tile[0] === rightEnd ||
    tile[1] === rightEnd
  )
}

export interface Playable {
  tileIndex: number
  sides: Side[]
}

/** Every playable tile in a player's hand with the side(s) it may attach to.
 * On an empty line each tile has a single placement (reported as ['right']; the
 * opening ignores side and sets both ends). */
export function playableTiles(state: State, playerIndex: number): Playable[] {
  const hand = state.hands[playerIndex]
  const out: Playable[] = []
  if (!hand) return out
  const empty = state.leftEnd < 0
  for (let i = 0; i < hand.length; i++) {
    const t = hand[i]
    if (empty) {
      out.push({ tileIndex: i, sides: ['right'] })
      continue
    }
    const sides: Side[] = []
    if (t[0] === state.leftEnd || t[1] === state.leftEnd) sides.push('left')
    if (t[0] === state.rightEnd || t[1] === state.rightEnd) sides.push('right')
    if (sides.length > 0) out.push({ tileIndex: i, sides })
  }
  return out
}

export function hasPlay(state: State, playerIndex: number): boolean {
  return playableTiles(state, playerIndex).length > 0
}

// -- Moves (pure; illegal => same state ref) ---------------------------------

/** Place `tileIndex` from `playerIndex`'s hand on `side`. Illegal => same ref. */
export function play(
  state: State,
  playerIndex: number,
  tileIndex: number,
  side: Side,
): State {
  if (state.status !== 'playing') return state
  if (playerIndex !== state.turn) return state
  const hand = state.hands[playerIndex]
  if (!hand || tileIndex < 0 || tileIndex >= hand.length) return state
  const tile = hand[tileIndex]

  let line: Tile[]
  let leftEnd: number
  let rightEnd: number

  if (state.leftEnd < 0) {
    // Opening move: place as-is, ignore side, set both ends.
    line = [[tile[0], tile[1]]]
    leftEnd = tile[0]
    rightEnd = tile[1]
  } else if (side === 'left') {
    const end = state.leftEnd
    if (tile[0] !== end && tile[1] !== end) return state // illegal side
    // Oriented so oriented[1] === leftEnd; new open end is oriented[0].
    const oriented: Tile = tile[1] === end ? [tile[0], tile[1]] : [tile[1], tile[0]]
    line = [oriented, ...state.line]
    leftEnd = oriented[0]
    rightEnd = state.rightEnd
  } else {
    const end = state.rightEnd
    if (tile[0] !== end && tile[1] !== end) return state // illegal side
    // Oriented so oriented[0] === rightEnd; new open end is oriented[1].
    const oriented: Tile = tile[0] === end ? [tile[0], tile[1]] : [tile[1], tile[0]]
    line = [...state.line, oriented]
    leftEnd = state.leftEnd
    rightEnd = oriented[1]
  }

  const nextHand = hand.slice(0, tileIndex).concat(hand.slice(tileIndex + 1))
  const hands: Tile[][] = playerIndex === 0 ? [nextHand, state.hands[1]] : [state.hands[0], nextHand]

  if (nextHand.length === 0) {
    return {
      ...state,
      hands,
      line,
      leftEnd,
      rightEnd,
      status: 'won',
      winner: playerIndex as 0 | 1,
      passes: 0,
    }
  }

  return {
    ...state,
    hands,
    line,
    leftEnd,
    rightEnd,
    turn: (playerIndex === 0 ? 1 : 0) as 0 | 1,
    passes: 0,
  }
}

/** Draw one tile from the boneyard into the player's hand. No-op if empty or
 * not their turn / not playing. Turn does NOT advance. */
export function draw(state: State, playerIndex: number): State {
  if (state.status !== 'playing') return state
  if (playerIndex !== state.turn) return state
  if (state.boneyard.length === 0) return state
  const boneyard = state.boneyard.slice()
  const tile = boneyard.pop() as Tile
  const hand = state.hands[playerIndex].concat([tile])
  const hands: Tile[][] = playerIndex === 0 ? [hand, state.hands[1]] : [state.hands[0], hand]
  return { ...state, hands, boneyard }
}

/** Pass. Legal ONLY when the player has no play AND the boneyard is empty.
 * Advances the turn; two passes in a row => blocked. Illegal => same ref. */
export function pass(state: State, playerIndex: number): State {
  if (state.status !== 'playing') return state
  if (playerIndex !== state.turn) return state
  if (state.boneyard.length > 0) return state // must draw first
  if (hasPlay(state, playerIndex)) return state // has a play; can't pass
  const passes = state.passes + 1
  if (passes >= 2) {
    // Blocked: lower total pip count wins; tie => draw.
    const p0 = handPips(state.hands[0])
    const p1 = handPips(state.hands[1])
    const winner: 0 | 1 | null = p0 < p1 ? 0 : p1 < p0 ? 1 : null
    return { ...state, status: 'blocked', winner, passes }
  }
  return { ...state, turn: (playerIndex === 0 ? 1 : 0) as 0 | 1, passes }
}

// -- AI ----------------------------------------------------------------------

/**
 * Pick a single legal action for `aiIndex`. Heuristic: play the highest-pip
 * playable tile (dump heavy tiles first); ties broken by `rng` (consumed once).
 * If no play: draw when the boneyard has tiles, else pass. Deterministic.
 */
export function aiMove(state: State, aiIndex: number, rng: Rng): AiAction {
  const options = playableTiles(state, aiIndex)
  if (options.length > 0) {
    const hand = state.hands[aiIndex]
    // Best by pip weight; keep all ties for a deterministic rng tie-break.
    let best = -1
    for (const o of options) best = Math.max(best, pips(hand[o.tileIndex]))
    const top = options.filter((o) => pips(hand[o.tileIndex]) === best)
    const chosen = top[Math.floor(rng() * top.length)] ?? top[0]
    return { type: 'play', tileIndex: chosen.tileIndex, side: chosen.sides[0] }
  }
  if (state.boneyard.length > 0) return { type: 'draw' }
  return { type: 'pass' }
}
