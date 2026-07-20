/**
 * Spider Solitaire — pure engine.
 *
 * Two decks (104 cards) across 10 tableau columns. Build DOWN by rank (any suit
 * may sit on any suit), but a run only MOVES as a unit when it is SAME-SUIT and
 * strictly descending. Assemble a full King→Ace same-suit run and it is swept to
 * a foundation (a "completed set"). Win = all 8 sets completed. The stock deals
 * one card to EVERY column at once, and is forbidden while ANY column is empty.
 *
 * Difficulty = number of suits in play (1 / 2 / 4). The deck is ALWAYS 104
 * cards; fewer suits just means more copies of each (1-suit → 8× each rank of
 * one suit, 2-suit → 4× each, 4-suit → 2× each).
 *
 * PURITY: every function is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through the injected `Rng`, consumed
 * ONLY in `deal`. Move functions are (state) -> state and REJECT illegal moves
 * by returning the SAME state reference (so tests can assert a no-op with `===`).
 */

export type Rng = () => number // float in [0,1)

export type Suit = 'S' | 'H' | 'D' | 'C'
export type SuitCount = 1 | 2 | 4

export interface Card {
  rank: number // 1 (Ace) .. 13 (King)
  suit: Suit
  faceUp: boolean
}

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']
export const TABLEAU_COLS = 10
export const RANK_KING = 13
export const RANK_ACE = 1
export const TOTAL_CARDS = 104
export const SETS_TO_WIN = 8

/** Column deal sizes: cols 0–3 get 6, cols 4–9 get 5 (54 total). */
export const DEAL_SIZES: readonly number[] = [6, 6, 6, 6, 5, 5, 5, 5, 5, 5]

export function isRed(suit: Suit): boolean {
  return suit === 'H' || suit === 'D'
}

// -- PRNG (byte-identical to the solitaire/clusters template's mulberry32) -----

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

/** The suits actually used for a given difficulty. */
export function suitsFor(suitCount: SuitCount): Suit[] {
  return SUITS.slice(0, suitCount)
}

/**
 * A 104-card deck for the given difficulty (all face-down, canonical order).
 * 1-suit → 8 copies of each rank of one suit; 2-suit → 4 copies across 2 suits;
 * 4-suit → 2 copies across all 4 suits. Always exactly 104 cards.
 */
export function makeDeck(suitCount: SuitCount): Card[] {
  const suits = suitsFor(suitCount)
  const copies = TOTAL_CARDS / (suits.length * 13) // 8 / 4 / 2
  const deck: Card[] = []
  for (let n = 0; n < copies; n++) {
    for (const suit of suits) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ rank, suit, faceUp: false })
      }
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

export type Status = 'playing' | 'won'

export interface State {
  tableau: Card[][] // 10 columns; only run-tops are face-up
  stock: Card[] // remaining face-down cards, dealt 10 at a time from the front
  completed: number // full sets removed to foundation (0..8)
  status: Status
  moves: number
  suitCount: SuitCount
}

// -- Clone helpers -----------------------------------------------------------

function cloneCard(c: Card): Card {
  return { rank: c.rank, suit: c.suit, faceUp: c.faceUp }
}

function cloneCol(col: Card[]): Card[] {
  return col.map(cloneCard)
}

function top<T>(arr: T[]): T | undefined {
  return arr.length ? arr[arr.length - 1] : undefined
}

/** Flip the new top of a column face-up (after a removal). Mutates the (cloned) column. */
function flipExposed(col: Card[]): void {
  const t = top(col)
  if (t && !t.faceUp) t.faceUp = true
}

// -- Deal --------------------------------------------------------------------

/**
 * Build a fresh Spider deal. Consumes rng ONLY here (via `shuffle`).
 * 54 cards go to the tableau (cols 0–3 → 6, cols 4–9 → 5); the top card of each
 * column is face-up. The remaining 50 cards form the stock (5 deals of 10).
 */
export function deal(rng: Rng, suitCount: SuitCount): State {
  const deck = shuffle(makeDeck(suitCount), rng)
  const tableau: Card[][] = Array.from({ length: TABLEAU_COLS }, () => [])
  let idx = 0
  for (let col = 0; col < TABLEAU_COLS; col++) {
    const size = DEAL_SIZES[col]
    for (let n = 0; n < size; n++) {
      const card = deck[idx++]
      card.faceUp = n === size - 1 // top (last dealt) card is face-up
      tableau[col].push(card)
    }
  }
  const stock = deck.slice(idx) // remaining 50, all face-down
  for (const cd of stock) cd.faceUp = false
  return {
    tableau,
    stock,
    completed: 0,
    status: 'playing',
    moves: 0,
    suitCount,
  }
}

export function createGame(seed: number, suitCount: SuitCount): State {
  return deal(mulberry32(seed), suitCount)
}

// -- Validators --------------------------------------------------------------

/**
 * Is `cards` a legal MOVABLE run? All face-up and strictly descending by 1 in
 * the SAME suit (the defining Spider constraint — mixed-suit runs never move).
 */
export function canMoveRun(cards: Card[]): boolean {
  if (cards.length === 0) return false
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].faceUp) return false
    if (i > 0) {
      if (cards[i].suit !== cards[i - 1].suit) return false
      if (cards[i].rank !== cards[i - 1].rank - 1) return false
    }
  }
  return true
}

/**
 * May a run whose head is `runHead` LAND on a column whose top is `destTop`?
 * Empty column accepts anything; otherwise dest top must be exactly one higher
 * (ANY suit is allowed for landing — only the moved run must be same-suit).
 */
export function canLand(runHead: Card, destTop: Card | undefined): boolean {
  if (!destTop) return true
  return destTop.rank === runHead.rank + 1
}

/**
 * Is the tail of `col` a completed King→Ace same-suit run (13 contiguous
 * face-up cards, ranks 13..1, one suit)? Returns the start index or -1.
 */
export function completedRunStart(col: Card[]): number {
  if (col.length < 13) return -1
  const start = col.length - 13
  const suit = col[start].suit
  for (let i = 0; i < 13; i++) {
    const card = col[start + i]
    if (!card.faceUp) return -1
    if (card.suit !== suit) return -1
    if (card.rank !== RANK_KING - i) return -1 // 13,12,...,1
  }
  return start
}

// -- Internal: settle completed sets in a (cloned) column --------------------

/**
 * Remove any trailing completed King→Ace same-suit run(s) from a cloned column,
 * flipping the newly-exposed card. Returns how many sets were removed.
 */
function settleColumn(col: Card[]): number {
  let removed = 0
  for (;;) {
    const start = completedRunStart(col)
    if (start < 0) break
    col.splice(start) // drop the 13-card set
    flipExposed(col)
    removed++
  }
  return removed
}

function withStatus(state: State): State {
  return state.completed >= SETS_TO_WIN ? { ...state, status: 'won' } : state
}

// -- Moves (each pure; illegal → same reference) -----------------------------

/**
 * Move the run of `fromCol` starting at `fromIndex` (through the end) onto
 * `toCol`. Validates the movable-run rule (same-suit descending, all face-up)
 * AND the landing (empty, or one rank higher — any suit). Flips the newly
 * exposed card of `fromCol`, then auto-removes any completed set at `toCol`.
 */
export function moveRun(
  state: State,
  fromCol: number,
  fromIndex: number,
  toCol: number,
): State {
  if (state.status !== 'playing') return state
  if (fromCol === toCol) return state
  if (fromCol < 0 || fromCol >= TABLEAU_COLS) return state
  if (toCol < 0 || toCol >= TABLEAU_COLS) return state
  const src = state.tableau[fromCol]
  if (fromIndex < 0 || fromIndex >= src.length) return state
  const run = src.slice(fromIndex)
  if (!canMoveRun(run)) return state
  const dest = state.tableau[toCol]
  if (!canLand(run[0], top(dest))) return state

  const tableau = state.tableau.map((col, i) =>
    i === fromCol || i === toCol ? cloneCol(col) : col,
  )
  const moving = tableau[fromCol].splice(fromIndex) // already-cloned cards
  for (const cd of moving) tableau[toCol].push(cd)
  flipExposed(tableau[fromCol])
  const removed = settleColumn(tableau[toCol])

  return withStatus({
    ...state,
    tableau,
    completed: state.completed + removed,
    moves: state.moves + 1,
  })
}

/**
 * Deal one face-up card from the stock to EVERY column at once. Rejected (same
 * reference) if the stock is empty OR any column is empty (the Spider rule). A
 * freshly-dealt Ace can complete a set, so every column is settled afterwards.
 */
export function dealFromStock(state: State): State {
  if (state.status !== 'playing') return state
  if (state.stock.length < TABLEAU_COLS) return state
  if (state.tableau.some((col) => col.length === 0)) return state

  const stock = cloneCol(state.stock)
  const drawn = stock.splice(0, TABLEAU_COLS) // first 10, in column order
  const tableau = state.tableau.map(cloneCol)
  let removed = 0
  for (let col = 0; col < TABLEAU_COLS; col++) {
    const card = drawn[col]
    card.faceUp = true
    tableau[col].push(card)
  }
  for (let col = 0; col < TABLEAU_COLS; col++) {
    removed += settleColumn(tableau[col])
  }

  return withStatus({
    ...state,
    tableau,
    stock,
    completed: state.completed + removed,
    moves: state.moves + 1,
  })
}

// -- Win / scoring -----------------------------------------------------------

export function isWon(state: State): boolean {
  return state.completed >= SETS_TO_WIN
}

/**
 * Higher = better, always a non-negative integer, monotonic as sets are
 * completed. 1000 per completed set, plus a 2000 completion bonus on a win.
 */
export function score(state: State): number {
  const base = state.completed * 1000
  return state.status === 'won' ? base + 2000 : base
}
