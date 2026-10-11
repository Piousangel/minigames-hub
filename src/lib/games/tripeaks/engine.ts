/**
 * Tri Peaks Solitaire — pure, deterministic engine.
 *
 * Three overlapping peaks of cards (28 in the classic layout: three peak tips,
 * then rows of 6 and 9, sharing a single bottom row of 10 face-up cards). A
 * tableau card is "free" when both cards overlapping it from below have been
 * removed. You clear a free card when its rank is exactly one above OR one below
 * the current waste top, with wrap (Ace ↔ King and Ace ↔ 2). Each cleared card
 * becomes the new waste top, so clears chain. When stuck, draw from the stock to
 * the waste. Win = clear all 28 tableau cards.
 *
 * PURITY: every function is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through the injected `Rng`, consumed
 * ONLY in `deal`. All move functions are (state) -> state and REJECT illegal
 * moves by returning the SAME state reference (so callers/tests assert a no-op
 * with `===`). The whole game is golden-testable from a fixed seed + a scripted
 * sequence of moves.
 */

export type Rng = () => number // float in [0,1)

export type Suit = 'S' | 'H' | 'D' | 'C'
export type Color = 'red' | 'black'

export interface Card {
  rank: number // 1 (Ace) .. 13 (King)
  suit: Suit
  faceUp: boolean
  id: number // stable 0..51 identity (survives shuffle) — for React keys
}

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']
export const RANK_KING = 13
export const RANK_ACE = 1
export const TABLEAU_SIZE = 28
export const STOCK_SIZE = 23

export function isRed(suit: Suit): boolean {
  return suit === 'H' || suit === 'D'
}

export function color(suit: Suit): Color {
  return isRed(suit) ? 'red' : 'black'
}

export function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit)
}

// -- PRNG (byte-identical to the solitaire/clusters mulberry32) ---------------

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

// -- Deck --------------------------------------------------------------------

/** Full 52-card deck in canonical order (all face-down). id = suit*13+rank-1. */
export function makeDeck(): Card[] {
  const deck: Card[] = []
  for (let si = 0; si < SUITS.length; si++) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit: SUITS[si], faceUp: false, id: si * 13 + (rank - 1) })
    }
  }
  return deck
}

/** Deterministic Fisher–Yates. Returns a new shuffled array; input untouched. */
export function shuffle(deck: Card[], rng: Rng): Card[] {
  const out = deck.map(cloneCard)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// -- Tri-peaks layout / cover table ------------------------------------------

/**
 * 28 fixed slots. Row 0 = three peak tips (0,1,2); row 1 = 6 (3..8); row 2 = 9
 * (9..17); row 3 = the shared bottom row of 10 (18..27, face-up at deal).
 *
 * COVER[i] lists the (up to two) LOWER slots that overlap slot i from below. A
 * slot is free/revealed when both of its coverers are removed. Bottom-row slots
 * have no coverers, so they are always free while present.
 */
export const COVER: readonly (readonly number[])[] = [
  // row 0 — peak tips
  [3, 4], // 0  (left peak)
  [5, 6], // 1  (middle peak)
  [7, 8], // 2  (right peak)
  // row 1
  [9, 10], // 3
  [10, 11], // 4
  [12, 13], // 5
  [13, 14], // 6
  [15, 16], // 7
  [16, 17], // 8
  // row 2
  [18, 19], // 9
  [19, 20], // 10
  [20, 21], // 11
  [21, 22], // 12
  [22, 23], // 13
  [23, 24], // 14
  [24, 25], // 15
  [25, 26], // 16
  [26, 27], // 17
  // row 3 — bottom, no coverers
  [], // 18
  [], // 19
  [], // 20
  [], // 21
  [], // 22
  [], // 23
  [], // 24
  [], // 25
  [], // 26
  [], // 27
]

/** Inverse of COVER: for slot i, the upper slots that i helps cover. */
export const COVERS: readonly (readonly number[])[] = (() => {
  const inv: number[][] = Array.from({ length: TABLEAU_SIZE }, () => [])
  for (let upper = 0; upper < COVER.length; upper++) {
    for (const lower of COVER[upper]) inv[lower].push(upper)
  }
  return inv
})()

/** Row (0..3) of each slot — layout helper for the renderer. */
export function rowOf(slot: number): number {
  if (slot < 3) return 0
  if (slot < 9) return 1
  if (slot < 18) return 2
  return 3
}

// -- Clone helpers -----------------------------------------------------------

function cloneCard(c: Card): Card {
  return { rank: c.rank, suit: c.suit, faceUp: c.faceUp, id: c.id }
}

// -- State -------------------------------------------------------------------

export type Status = 'playing' | 'won' | 'lost'

export interface State {
  tableau: (Card | null)[] // 28 fixed slots; null once removed
  stock: Card[] // face-down; top (next draw) = END of array
  waste: Card[] // face-up; active top = END of array
  status: Status
  moves: number
  chain: number // consecutive clears since the last draw (0 after a draw)
  chainBonus: number // banked chain points (never decreases; see `score`)
}

/**
 * Chain bonus per clear: the k-th card of a chain (k = 1, 2, …) banks
 * CHAIN_STEP × (k − 1), so a chain of n is worth CHAIN_STEP × n(n−1)/2 on top of
 * the flat 100/card — "longer chains score much higher" (registry tips/FAQ).
 */
export const CHAIN_STEP = 20

// -- Deal --------------------------------------------------------------------

/**
 * Build a fresh Tri Peaks deal. Consumes rng ONLY here (via `shuffle`).
 * 28 cards → tableau slots 0..27 (bottom row 18..27 face-up, the rest
 * face-down); 1 card → the initial waste top (face-up); the remaining 23 →
 * the face-down stock.
 */
export function deal(rng: Rng): State {
  const deck = shuffle(makeDeck(), rng)
  const tableau: (Card | null)[] = []
  for (let i = 0; i < TABLEAU_SIZE; i++) {
    const card = deck[i]
    card.faceUp = i >= 18 // bottom row is dealt face-up
    tableau.push(card)
  }
  const waste = [deck[TABLEAU_SIZE]]
  waste[0].faceUp = true
  const stock = deck.slice(TABLEAU_SIZE + 1)
  for (const c of stock) c.faceUp = false
  return { tableau, stock, waste, status: 'playing', moves: 0, chain: 0, chainBonus: 0 }
}

export function createGame(seed: number): State {
  return deal(mulberry32(seed))
}

// -- Queries -----------------------------------------------------------------

function top<T>(arr: T[]): T | undefined {
  return arr.length ? arr[arr.length - 1] : undefined
}

/** The active waste card (what a play must be rank-adjacent to). */
export function wasteTop(state: State): Card | undefined {
  return top(state.waste)
}

/** Slot i is present AND both of its coverers have been removed. */
export function isFree(state: State, i: number): boolean {
  if (i < 0 || i >= TABLEAU_SIZE) return false
  if (state.tableau[i] == null) return false
  for (const lower of COVER[i]) {
    if (state.tableau[lower] != null) return false
  }
  return true
}

/**
 * True if `a` is exactly one rank above OR below `b`, wrapping so Ace(1) is
 * adjacent to both 2 and King(13), and King is adjacent to both Queen and Ace.
 */
export function rankAdjacent(a: number, b: number): boolean {
  const d = (((a - b) % 13) + 13) % 13
  return d === 1 || d === 12
}

/** Count of cleared (removed) tableau slots. */
export function clearedCount(state: State): number {
  let n = 0
  for (const c of state.tableau) if (c == null) n++
  return n
}

export function isWon(state: State): boolean {
  return state.tableau.every((c) => c == null)
}

/** Free slots whose card is rank-adjacent to the waste top (i.e. playable now). */
export function freePlayable(state: State): number[] {
  const wt = wasteTop(state)
  if (!wt) return []
  const out: number[] = []
  for (let i = 0; i < TABLEAU_SIZE; i++) {
    if (isFree(state, i) && rankAdjacent(state.tableau[i]!.rank, wt.rank)) out.push(i)
  }
  return out
}

/** Any progress possible: a playable free card, or stock left to draw. */
export function hasMove(state: State): boolean {
  return state.stock.length > 0 || freePlayable(state).length > 0
}

/** Derive terminal status from the board (won > lost > playing). */
function settledStatus(state: State): Status {
  if (isWon(state)) return 'won'
  if (state.stock.length === 0 && freePlayable(state).length === 0) return 'lost'
  return 'playing'
}

// -- Moves (each pure; illegal → same reference) -----------------------------

/**
 * Play free slot `i` onto the waste. Requires slot i free AND rank-adjacent to
 * the waste top. Removes it, makes it the new waste top, reveals any card whose
 * last coverer just left, and extends the chain. Illegal → same reference.
 */
export function playCard(state: State, i: number): State {
  if (state.status !== 'playing') return state
  if (!isFree(state, i)) return state
  const wt = wasteTop(state)
  if (!wt) return state
  const moving = state.tableau[i]!
  if (!rankAdjacent(moving.rank, wt.rank)) return state

  const tableau = state.tableau.map((c) => (c ? cloneCard(c) : null))
  const moved = cloneCard(moving)
  moved.faceUp = true
  tableau[i] = null
  // Reveal any upper slot whose coverers are now all gone.
  for (const upper of COVERS[i]) {
    if (tableau[upper] && COVER[upper].every((lower) => tableau[lower] == null)) {
      tableau[upper]!.faceUp = true
    }
  }
  const waste = state.waste.map(cloneCard)
  waste.push(moved)
  const next: State = {
    ...state,
    tableau,
    waste,
    moves: state.moves + 1,
    chain: state.chain + 1,
    chainBonus: state.chainBonus + CHAIN_STEP * state.chain,
  }
  return { ...next, status: settledStatus(next) }
}

/**
 * Draw the top stock card to the waste (face-up) and reset the chain. No-op
 * (same reference) when the stock is empty.
 */
export function drawStock(state: State): State {
  if (state.status !== 'playing') return state
  if (state.stock.length === 0) return state
  const stock = state.stock.map(cloneCard)
  const drawn = stock.pop() as Card
  drawn.faceUp = true
  const waste = state.waste.map(cloneCard)
  waste.push(drawn)
  const next: State = { ...state, stock, waste, moves: state.moves + 1, chain: 0 }
  return { ...next, status: settledStatus(next) }
}

// -- Scoring -----------------------------------------------------------------

/**
 * Higher = better, always a non-negative integer, monotonic over a run:
 * 100 per cleared card + the banked chain bonus (`chainBonus`, which only ever
 * grows — a draw resets the live `chain` but never claws points back) + a
 * completion bonus on a win.
 */
export function score(state: State): number {
  const base = clearedCount(state) * 100 + (state.chainBonus ?? 0)
  return state.status === 'won' ? base + 500 : base
}
