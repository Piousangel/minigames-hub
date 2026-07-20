/**
 * Pyramid Solitaire — pure engine.
 *
 * 28 cards form a 7-row pyramid (row r has r+1 cards, r=0..6). Cards overlap so
 * each card is covered by the TWO cards below it; a card is "free" (playable)
 * only once both of its coverers are gone (the bottom row is always free).
 * Remove cards in PAIRS whose ranks sum to 13 (A=1 … K=13); a King (13) is
 * removed alone. A face-down stock deals one card at a time to a face-up waste;
 * the waste top pairs with any free pyramid card. Up to 3 passes through the
 * stock (recycle the waste back into the stock, 2 redeals). Win = clear the
 * entire pyramid.
 *
 * PURITY: every function is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through the injected `Rng`, consumed
 * ONLY in `deal`. Every move is (state, …) -> state and REJECTS an illegal move
 * by returning the SAME state reference (so callers/tests assert a no-op with
 * `===`). The whole game is golden-testable from a fixed seed + scripted moves.
 */

export type Rng = () => number // float in [0,1)

export type Suit = 'S' | 'H' | 'D' | 'C'
export type Color = 'red' | 'black'

export interface Card {
  rank: number // 1 (Ace) .. 13 (King)
  suit: Suit
  id: number // stable identity for React keys; survives shuffle
}

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']
export const ROWS = 7
export const PYRAMID_SIZE = 28 // 1+2+…+7
export const RANK_KING = 13
export const PAIR_SUM = 13
export const DEFAULT_PASSES = 3

export function isRed(suit: Suit): boolean {
  return suit === 'H' || suit === 'D'
}

export function color(suit: Suit): Color {
  return isRed(suit) ? 'red' : 'black'
}

/** Playing value of a card: A=1 … 10=10, J=11, Q=12, K=13. */
export function value(card: Card): number {
  return card.rank
}

// -- PRNG (byte-identical to the solitaire/clusters template's mulberry32) ----

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

/** Full 52-card deck in canonical order, each with a stable id 0..51. */
export function makeDeck(): Card[] {
  const deck: Card[] = []
  let id = 0
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit, id: id++ })
    }
  }
  return deck
}

function cloneCard(c: Card): Card {
  return { rank: c.rank, suit: c.suit, id: c.id }
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

/** A move target: a pyramid slot, or the top of the waste. */
export type Target =
  | { kind: 'pyramid'; row: number; col: number }
  | { kind: 'waste' }

export interface State {
  /** 7 rows; row r has r+1 slots. `null` = that card has been removed. */
  pyramid: (Card | null)[][]
  stock: Card[] // face-down; top = END of array (we draw from the end)
  waste: Card[] // face-up; top = END of array
  passesLeft: number // stock passes still available (redeals = passesLeft-1)
  status: Status
  moves: number
}

// -- Deal --------------------------------------------------------------------

/**
 * Build a fresh Pyramid deal. Consumes rng ONLY here (via `shuffle`).
 * First 28 shuffled cards fill the pyramid rows top→bottom, left→right; the
 * remaining 24 form the face-down stock. Waste empty, passesLeft = 3.
 */
export function deal(rng: Rng, passes: number = DEFAULT_PASSES): State {
  const deck = shuffle(makeDeck(), rng)
  const pyramid: (Card | null)[][] = []
  let idx = 0
  for (let r = 0; r < ROWS; r++) {
    const row: (Card | null)[] = []
    for (let col = 0; col <= r; col++) row.push(deck[idx++])
    pyramid.push(row)
  }
  const stock = deck.slice(idx) // remaining 24
  return {
    pyramid,
    stock,
    waste: [],
    passesLeft: passes,
    status: 'playing',
    moves: 0,
  }
}

export function createGame(seed: number, passes: number = DEFAULT_PASSES): State {
  return deal(mulberry32(seed), passes)
}

// -- Free-card logic ---------------------------------------------------------

/**
 * Is the pyramid slot (row,col) FREE — i.e. are both cards covering it gone?
 * The bottom row is always free. A slot is covered by (row+1,col) and
 * (row+1,col+1); free iff both of those are `null`. (Geometry only — does not
 * check whether a card still sits in (row,col); see `isAvailable`.)
 */
export function isFree(state: State, row: number, col: number): boolean {
  if (row < 0 || row >= ROWS) return false
  if (col < 0 || col > row) return false
  if (row === ROWS - 1) return true
  const below = state.pyramid[row + 1]
  return below[col] === null && below[col + 1] === null
}

function cardAt(state: State, t: Target): Card | null {
  if (t.kind === 'waste') {
    return state.waste.length ? state.waste[state.waste.length - 1] : null
  }
  const row = state.pyramid[t.row]
  if (!row) return null
  return row[t.col] ?? null
}

/** Is `t` a currently-playable target (a card that exists AND is reachable)? */
export function isAvailable(state: State, t: Target): boolean {
  if (t.kind === 'waste') return state.waste.length > 0
  if (!cardAt(state, t)) return false
  return isFree(state, t.row, t.col)
}

function sameTarget(a: Target, b: Target): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'waste' || b.kind === 'waste') return a.kind === b.kind
  return a.row === b.row && a.col === b.col
}

/** Every currently-playable target: each free pyramid card + the waste top. */
export function freeCards(state: State): Target[] {
  const out: Target[] = []
  for (let r = 0; r < ROWS; r++) {
    const row = state.pyramid[r]
    for (let col = 0; col < row.length; col++) {
      if (row[col] && isFree(state, r, col)) out.push({ kind: 'pyramid', row: r, col })
    }
  }
  if (state.waste.length > 0) out.push({ kind: 'waste' })
  return out
}

/** Do these two cards form a legal pair (ranks sum to 13)? Kings never pair. */
export function canPair(a: Card, b: Card): boolean {
  return value(a) + value(b) === PAIR_SUM
}

// -- Progress helpers --------------------------------------------------------

function pyramidRemaining(state: State): number {
  let n = 0
  for (const row of state.pyramid) for (const cell of row) if (cell) n++
  return n
}

function pyramidCleared(state: State): boolean {
  return pyramidRemaining(state) === 0
}

/** Cards removed from play entirely (paired / king-removed). Monotonic. */
function removedCount(state: State): number {
  const inPlay = pyramidRemaining(state) + state.stock.length + state.waste.length
  return 52 - inPlay
}

/**
 * Is any legal move available? A King is removable, some free pair sums to 13,
 * the stock can be drawn, or the waste can still be recycled.
 */
export function hasAnyMove(state: State): boolean {
  const frees = freeCards(state)
  const cards = frees.map((t) => cardAt(state, t) as Card)
  for (const c of cards) if (c.rank === RANK_KING) return true
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (canPair(cards[i], cards[j])) return true
    }
  }
  if (state.stock.length > 0) return true
  if (state.stock.length === 0 && state.passesLeft > 1 && state.waste.length > 0) return true
  return false
}

/** Resolve terminal status after a move: cleared pyramid → won; stuck → lost. */
function settle(state: State): State {
  if (pyramidCleared(state)) return state.status === 'won' ? state : { ...state, status: 'won' }
  if (!hasAnyMove(state)) return state.status === 'lost' ? state : { ...state, status: 'lost' }
  return state
}

// -- Removal helper ----------------------------------------------------------

function withPyramidNull(pyramid: (Card | null)[][], row: number, col: number): (Card | null)[][] {
  return pyramid.map((r, i) => (i === row ? r.map((cell, j) => (j === col ? null : cell)) : r))
}

// -- Moves (each pure; illegal → same reference) -----------------------------

/**
 * Remove a single King (rank 13) that is a free pyramid card or the waste top.
 * Illegal (not a King, covered, or absent) → same reference.
 */
export function removeKing(state: State, target: Target): State {
  if (state.status !== 'playing') return state
  const card = cardAt(state, target)
  if (!card || card.rank !== RANK_KING) return state
  if (!isAvailable(state, target)) return state

  let pyramid = state.pyramid
  let waste = state.waste
  if (target.kind === 'waste') waste = waste.slice(0, -1)
  else pyramid = withPyramidNull(pyramid, target.row, target.col)

  return settle({ ...state, pyramid, waste, moves: state.moves + 1 })
}

/**
 * Remove a pair of cards (each a free pyramid card or the waste top) whose
 * ranks sum to 13. Both must be distinct, available, and free in the CURRENT
 * state. Illegal → same reference.
 */
export function pair(state: State, a: Target, b: Target): State {
  if (state.status !== 'playing') return state
  if (sameTarget(a, b)) return state
  const ca = cardAt(state, a)
  const cb = cardAt(state, b)
  if (!ca || !cb) return state
  if (!isAvailable(state, a) || !isAvailable(state, b)) return state
  if (!canPair(ca, cb)) return state

  let pyramid = state.pyramid
  let waste = state.waste
  for (const t of [a, b]) {
    if (t.kind === 'waste') waste = waste.slice(0, -1)
    else pyramid = withPyramidNull(pyramid, t.row, t.col)
  }
  return settle({ ...state, pyramid, waste, moves: state.moves + 1 })
}

/**
 * Draw one card stock→waste (face-up). When the stock is empty, recycle the
 * waste back into the stock IF a pass remains (passesLeft>1): the waste empties
 * and passesLeft decrements. When no pass remains (or nothing to recycle) →
 * same reference (no-op).
 */
export function drawStock(state: State): State {
  if (state.status !== 'playing') return state
  if (state.stock.length > 0) {
    const stock = state.stock.slice(0, -1)
    const drawn = state.stock[state.stock.length - 1]
    const waste = [...state.waste, drawn]
    return settle({ ...state, stock, waste, moves: state.moves + 1 })
  }
  // Stock empty → recycle the waste if a redeal remains.
  if (state.passesLeft > 1 && state.waste.length > 0) {
    const stock = [...state.waste].reverse()
    return settle({
      ...state,
      stock,
      waste: [],
      passesLeft: state.passesLeft - 1,
      moves: state.moves + 1,
    })
  }
  return state
}

// -- Scoring -----------------------------------------------------------------

/**
 * Higher = better, always a non-negative integer, monotonic as cards leave the
 * board. 100 per card removed from play, plus a completion bonus on a win.
 */
export function score(state: State): number {
  const base = removedCount(state) * 100
  return state.status === 'won' ? base + 2000 : base
}
