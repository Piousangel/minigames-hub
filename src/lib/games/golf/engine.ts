/**
 * Golf Solitaire — pure engine.
 *
 * The evergreen "Golf" patience. 7 tableau columns of 5 face-up cards each
 * (35 cards). The remaining 17 cards: 1 seeds the waste/foundation and 16 form
 * a face-down stock dealt one at a time. You clear the tableau by playing the
 * EXPOSED card of any column (the bottom-most, non-overlapped one) onto the
 * waste top when its rank is exactly one above or one below. Classic Golf does
 * NOT wrap (Ace is low; a King is not adjacent to an Ace). An optional
 * "around-the-corner" variant (`wrap`) lets A↔K play on each other. When stuck,
 * deal the next stock card. Win = clear ALL tableau cards.
 *
 * PURITY: every function here is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through the injected `Rng`, consumed
 * ONLY in `deal`. All move functions are (state) -> state and REJECT illegal
 * moves by returning the SAME state reference (so callers/tests can assert a
 * no-op with `===`). This makes the whole game golden-testable from a fixed
 * seed + a scripted sequence of moves.
 */

export type Rng = () => number // float in [0,1)

export type Suit = 'S' | 'H' | 'D' | 'C'

export interface Card {
  rank: number // 1 (Ace, low) .. 13 (King)
  suit: Suit
}

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']
export const TABLEAU_COLS = 7
export const TABLEAU_ROWS = 5
export const TABLEAU_SIZE = TABLEAU_COLS * TABLEAU_ROWS // 35
export const STOCK_SIZE = 16

export function isRed(suit: Suit): boolean {
  return suit === 'H' || suit === 'D'
}

// -- PRNG (byte-identical to the clusters/solitaire mulberry32) --------------

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

/** Full 52-card deck in canonical order. */
export function makeDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit })
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

// -- State -------------------------------------------------------------------

export type Status = 'playing' | 'won' | 'lost'

export interface State {
  tableau: Card[][] // 7 columns, 5 each at deal; exposed card = END of array
  waste: Card[] // active pile; top = END of array
  stock: Card[] // face-down; dealt from the END of array
  status: Status
  moves: number
  wrap: boolean
}

// -- Clone helpers -----------------------------------------------------------

function cloneCard(c: Card): Card {
  return { rank: c.rank, suit: c.suit }
}

function cloneCol(col: Card[]): Card[] {
  return col.map(cloneCard)
}

// -- Deal --------------------------------------------------------------------

/**
 * Build a fresh Golf deal. Consumes rng ONLY here (via `shuffle`).
 * 35 cards → 7 columns of 5 (column-major: col 0 = cards[0..4], its exposed
 * card is cards[4]); 1 card → waste (the initial foundation); the remaining 16
 * → stock. 35 + 1 + 16 = 52.
 */
export function deal(rng: Rng, wrap = false): State {
  const deck = shuffle(makeDeck(), rng)
  const tableau: Card[][] = Array.from({ length: TABLEAU_COLS }, () => [])
  let idx = 0
  for (let col = 0; col < TABLEAU_COLS; col++) {
    for (let row = 0; row < TABLEAU_ROWS; row++) {
      tableau[col].push(deck[idx++])
    }
  }
  const waste = [deck[idx++]] // 1 card seeds the foundation
  const stock = deck.slice(idx) // remaining 16
  return {
    tableau,
    waste,
    stock,
    status: 'playing',
    moves: 0,
    wrap,
  }
}

export function createGame(seed: number, wrap = false): State {
  return deal(mulberry32(seed), wrap)
}

// -- Small pure utilities ----------------------------------------------------

function top<T>(arr: T[]): T | undefined {
  return arr.length ? arr[arr.length - 1] : undefined
}

/** The playable (bottom-most, non-overlapped) card of a column, if any. */
export function exposed(column: Card[]): Card | undefined {
  return top(column)
}

/**
 * Rank adjacency. Classic Golf: strictly |a-b| === 1 (Ace low, no wrapping).
 * Around-the-corner (`wrap`): additionally A(1)↔K(13) count as adjacent.
 */
export function rankAdjacent(a: number, b: number, wrap: boolean): boolean {
  return wrap
    ? ((a - b) % 13 + 13) % 13 === 1 || ((b - a) % 13 + 13) % 13 === 1
    : Math.abs(a - b) === 1
}

/** Columns whose exposed card is adjacent to the current waste top. */
export function playableColumns(state: State): number[] {
  const wasteTop = top(state.waste)
  if (!wasteTop) return []
  const out: number[] = []
  for (let col = 0; col < state.tableau.length; col++) {
    const ex = top(state.tableau[col])
    if (ex && rankAdjacent(ex.rank, wasteTop.rank, state.wrap)) out.push(col)
  }
  return out
}

/** Any move remains: a playable column OR a stock card left to deal. */
export function hasMove(state: State): boolean {
  return state.stock.length > 0 || playableColumns(state).length > 0
}

/** Total cards still sitting in the tableau. */
export function tableauRemaining(state: State): number {
  return state.tableau.reduce((n, col) => n + col.length, 0)
}

/** Derive the terminal status from the board (after a move). */
function computeStatus(state: State): Status {
  if (tableauRemaining(state) === 0) return 'won'
  if (!hasMove(state)) return 'lost'
  return 'playing'
}

function withStatus(state: State): State {
  const status = computeStatus(state)
  return status === state.status ? state : { ...state, status }
}

// -- Moves (each pure; illegal → same reference) -----------------------------

/**
 * Play the exposed card of `col` onto the waste when it is rank-adjacent to the
 * waste top. Illegal (out of range / empty column / not adjacent / game over)
 * → same reference.
 */
export function playColumn(state: State, col: number): State {
  if (state.status !== 'playing') return state
  if (col < 0 || col >= state.tableau.length) return state
  const card = top(state.tableau[col])
  if (!card) return state
  const wasteTop = top(state.waste)
  if (!wasteTop || !rankAdjacent(card.rank, wasteTop.rank, state.wrap)) return state
  const tableau = state.tableau.map((c, i) => (i === col ? cloneCol(c) : c))
  const moved = tableau[col].pop() as Card
  const waste = cloneCol(state.waste)
  waste.push(moved)
  return withStatus({ ...state, tableau, waste, moves: state.moves + 1 })
}

/**
 * Deal the top stock card onto the waste (becoming the new active top).
 * No-op (same reference) when the stock is empty or the game is over.
 */
export function dealStock(state: State): State {
  if (state.status !== 'playing') return state
  if (state.stock.length === 0) return state
  const stock = cloneCol(state.stock)
  const moved = stock.pop() as Card
  const waste = cloneCol(state.waste)
  waste.push(moved)
  return withStatus({ ...state, stock, waste, moves: state.moves + 1 })
}

// -- Scoring -----------------------------------------------------------------

/**
 * Higher = better, always a positive-or-zero integer, monotonic as tableau
 * cards are cleared. 100 per cleared card, plus a completion bonus on a win.
 */
export function score(state: State): number {
  const cleared = TABLEAU_SIZE - tableauRemaining(state)
  const base = cleared * 100
  return state.status === 'won' ? base + 1000 : base
}
