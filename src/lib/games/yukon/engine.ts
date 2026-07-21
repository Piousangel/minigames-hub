/**
 * Yukon Solitaire — pure, deterministic engine.
 *
 * A Klondike relative with NO stock and NO waste. All 52 cards are dealt into
 * 7 tableau columns; 4 foundations build UP by suit (A→K). The DEFINING Yukon
 * rule: you may pick up ANY face-up card together with EVERY card resting on
 * top of it — regardless of whether that pile forms an ordered sequence — as
 * long as the picked-up (bottom) card lands legally: onto a tableau card of the
 * opposite colour and exactly one rank higher, or (if it is a King) onto an
 * empty column. The newly-uncovered card of the source column flips face-up.
 * Win = all 52 cards on the foundations.
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
export type Color = 'red' | 'black'

export interface Card {
  rank: number // 1 (Ace) .. 13 (King)
  suit: Suit
  faceUp: boolean
}

/** Foundations are index-tracked by this fixed suit order. */
export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']
export const TABLEAU_COLS = 7
export const RANK_KING = 13
export const RANK_ACE = 1

/** Face-down cards dealt to column i (i = 0..6). col0 = 0 down, col i = i down. */
export const DOWN_PER_COL: readonly number[] = [0, 1, 2, 3, 4, 5, 6]
/** Face-up cards dealt to column i. col0 = 1 up, col i≥1 = 5 up. */
export const UP_PER_COL: readonly number[] = [1, 5, 5, 5, 5, 5, 5]

export function isRed(suit: Suit): boolean {
  return suit === 'H' || suit === 'D'
}

export function color(suit: Suit): Color {
  return isRed(suit) ? 'red' : 'black'
}

export function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit)
}

// -- PRNG (byte-identical to the solitaire cluster's mulberry32) --------------

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

/** Full 52-card deck in canonical order (all face-down). */
export function makeDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit, faceUp: false })
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
  tableau: Card[][] // 7 columns; the deal buries `DOWN_PER_COL[i]` cards face-down
  foundations: Card[][] // 4 piles, one per SUITS[i], built A→K
  status: Status
  moves: number
}

// -- Clone helpers -----------------------------------------------------------

function cloneCard(c: Card): Card {
  return { rank: c.rank, suit: c.suit, faceUp: c.faceUp }
}

function cloneCol(col: Card[]): Card[] {
  return col.map(cloneCard)
}

// -- Deal --------------------------------------------------------------------

/**
 * Build a fresh Yukon deal. Consumes rng ONLY here (via `shuffle`).
 * Column 0 gets 1 face-up card. Column i (1..6) gets `i` face-down cards then 5
 * face-up cards on top — i.e. col1 = 1 down + 5 up, … col6 = 6 down + 5 up.
 * Total = 1 + (6+7+8+9+10+11) = 52. Foundations empty.
 */
export function deal(rng: Rng): State {
  const deck = shuffle(makeDeck(), rng)
  const tableau: Card[][] = Array.from({ length: TABLEAU_COLS }, () => [])
  let idx = 0
  for (let col = 0; col < TABLEAU_COLS; col++) {
    for (let n = 0; n < DOWN_PER_COL[col]; n++) {
      const card = deck[idx++]
      card.faceUp = false
      tableau[col].push(card)
    }
    for (let n = 0; n < UP_PER_COL[col]; n++) {
      const card = deck[idx++]
      card.faceUp = true
      tableau[col].push(card)
    }
  }
  return {
    tableau,
    foundations: [[], [], [], []],
    status: 'playing',
    moves: 0,
  }
}

export function createGame(seed: number): State {
  return deal(mulberry32(seed))
}

// -- Validators --------------------------------------------------------------

/**
 * May the pile whose BOTTOM card is `bottom` land on tableau top `onto`?
 * Opposite colour, and `onto` exactly one rank higher. (Yukon does NOT require
 * the pile above `bottom` to be an ordered sequence — this checks only landing.)
 */
export function canStack(bottom: Card, onto: Card): boolean {
  return onto.rank === bottom.rank + 1 && color(onto.suit) !== color(bottom.suit)
}

/** May `card` go to its suit foundation whose current top is `foundationTop`? */
export function canFoundation(card: Card, foundationTop: Card | undefined): boolean {
  if (!foundationTop) return card.rank === RANK_ACE
  return card.suit === foundationTop.suit && card.rank === foundationTop.rank + 1
}

// -- Small pure utilities ----------------------------------------------------

function top<T>(arr: T[]): T | undefined {
  return arr.length ? arr[arr.length - 1] : undefined
}

/** Flip the new top of a tableau column face-up (after a removal). Mutates the
 *  passed (already-cloned) column. */
function flipExposed(col: Card[]): void {
  const t = top(col)
  if (t && !t.faceUp) t.faceUp = true
}

export function foundationCardCount(state: State): number {
  return state.foundations.reduce((n, f) => n + f.length, 0)
}

/** All four foundations complete (13 each). */
export function isWon(state: State): boolean {
  return state.foundations.every((f) => f.length === 13)
}

function withStatus(state: State): State {
  return isWon(state) ? { ...state, status: 'won' } : state
}

// -- Moves (each pure; illegal → same reference) -----------------------------

/**
 * Move the pile of `fromCol` starting at `fromIndex` (that card + everything on
 * top of it) onto `toCol`. The pile's BOTTOM card (at fromIndex) must be
 * face-up. Landing is legal if `toCol` is empty AND that bottom card is a King,
 * OR `toCol`'s top card is opposite colour and exactly one rank higher than the
 * bottom card. There is NO requirement that the pile is an ordered sequence —
 * this is the defining Yukon rule. Flips the newly-exposed card of `fromCol`.
 */
export function movePile(
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
  const bottom = src[fromIndex]
  if (!bottom.faceUp) return state
  const dest = state.tableau[toCol]
  const destTop = top(dest)
  const ok = destTop ? canStack(bottom, destTop) : bottom.rank === RANK_KING
  if (!ok) return state

  const tableau = state.tableau.map((c, i) =>
    i === fromCol || i === toCol ? cloneCol(c) : c,
  )
  const moving = tableau[fromCol].splice(fromIndex) // already-cloned cards
  for (const c of moving) tableau[toCol].push(c)
  flipExposed(tableau[fromCol])
  return { ...state, tableau, moves: state.moves + 1 }
}

/** Send a tableau column's top card to its suit foundation (flips exposed). */
export function tableauToFoundation(state: State, col: number): State {
  if (state.status !== 'playing') return state
  if (col < 0 || col >= TABLEAU_COLS) return state
  const card = top(state.tableau[col])
  if (!card || !card.faceUp) return state
  const fi = suitIndex(card.suit)
  if (!canFoundation(card, top(state.foundations[fi]))) return state
  const tableau = state.tableau.map((c, i) => (i === col ? cloneCol(c) : c))
  const moved = tableau[col].pop() as Card
  flipExposed(tableau[col])
  const foundations = state.foundations.map((f, i) => (i === fi ? cloneCol(f) : f))
  foundations[fi].push(moved)
  return withStatus({ ...state, tableau, foundations, moves: state.moves + 1 })
}

/**
 * Sweep every tableau top that can legally advance a foundation, repeatedly,
 * until no more move is possible. Used by the double-tap helper and (when the
 * board is trivially winnable) the one-click "Auto-finish". Returns the SAME
 * reference if nothing could be moved.
 */
export function autoToFoundation(state: State): State {
  let cur = state
  for (;;) {
    let advanced = false
    for (let col = 0; col < TABLEAU_COLS; col++) {
      const next = tableauToFoundation(cur, col)
      if (next !== cur) {
        cur = next
        advanced = true
      }
    }
    if (!advanced) break
  }
  return cur
}

/**
 * True when the deal can be finished with a single click: every remaining card
 * is face-up (so the foundation sweep can reach them all). Yukon has no stock.
 */
export function canAutoFinish(state: State): boolean {
  if (state.status !== 'playing') return false
  if (foundationCardCount(state) === 0 && state.tableau.every((c) => c.length === 0))
    return false
  return state.tableau.every((col) => col.every((c) => c.faceUp))
}

// -- Scoring -----------------------------------------------------------------

/**
 * Higher = better, always a positive-or-zero integer, monotonic as cards reach
 * the foundations. 100 per foundation card, plus a completion bonus on a win.
 */
export function score(state: State): number {
  const base = foundationCardCount(state) * 100
  return state.status === 'won' ? base + 2000 : base
}
