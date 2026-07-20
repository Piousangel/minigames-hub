/**
 * Solitaire — Klondike (draw-3) pure engine.
 *
 * The classic "Windows solitaire". 7 tableau piles, 4 foundations (build UP by
 * suit A→K), a face-down stock and a face-up waste. Tableau builds DOWN in
 * ALTERNATING colours; a face-up run moves as a unit; an empty column accepts
 * only a King (or a King-led run). Drawing turns 3 cards stock→waste and
 * recycles the waste when the stock runs dry. Win = all 52 cards on foundations.
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

export function isRed(suit: Suit): boolean {
  return suit === 'H' || suit === 'D'
}

export function color(suit: Suit): Color {
  return isRed(suit) ? 'red' : 'black'
}

export function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit)
}

// -- PRNG (byte-identical to the clusters/decant template's mulberry32) -------

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

/** FNV-1a hash of a date string 'YYYY-MM-DD' → 32-bit unsigned seed. */
export function dailySeed(dateStr: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
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
  tableau: Card[][] // 7 piles; only run-tops are face-up
  foundations: Card[][] // 4 piles, one per SUITS[i], built A→K
  stock: Card[] // face-down; top = END of array (we draw from the end)
  waste: Card[] // face-up; top = END of array
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
 * Build a fresh Klondike deal. Consumes rng ONLY here (via `shuffle`).
 * Pile i (0-based) receives i+1 cards; the last card of each pile is face-up.
 * The remaining 24 cards form the face-down stock. Waste + foundations empty.
 */
export function deal(rng: Rng): State {
  const deck = shuffle(makeDeck(), rng)
  const tableau: Card[][] = Array.from({ length: TABLEAU_COLS }, () => [])
  let idx = 0
  for (let col = 0; col < TABLEAU_COLS; col++) {
    for (let n = 0; n <= col; n++) {
      const card = deck[idx++]
      card.faceUp = n === col // top (last) card of the pile is face-up
      tableau[col].push(card)
    }
  }
  const stock = deck.slice(idx) // remaining 24, all face-down already
  for (const c of stock) c.faceUp = false
  return {
    tableau,
    foundations: [[], [], [], []],
    stock,
    waste: [],
    status: 'playing',
    moves: 0,
  }
}

export function createGame(seed: number): State {
  return deal(mulberry32(seed))
}

// -- Validators --------------------------------------------------------------

/** May `moving` be placed on `onto` in the tableau? (down, alternating colour) */
export function canStackTableau(moving: Card, onto: Card): boolean {
  return onto.rank === moving.rank + 1 && color(onto.suit) !== color(moving.suit)
}

/** May `card` go to its suit foundation whose current top is `foundationTop`? */
export function canGoFoundation(card: Card, foundationTop: Card | undefined): boolean {
  if (!foundationTop) return card.rank === RANK_ACE
  return card.suit === foundationTop.suit && card.rank === foundationTop.rank + 1
}

/** Is a face-up sequence a legal movable run (descending, alternating colour)? */
export function isValidRun(cards: Card[]): boolean {
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].faceUp) return false
    if (i > 0 && !canStackTableau(cards[i], cards[i - 1])) return false
  }
  return cards.length > 0
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

function foundationCardCount(state: State): number {
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
 * Draw up to 3 stock→waste (face-up). When the stock is empty, recycle the
 * waste back into the stock (face-down, order reset so the cycle repeats).
 * Illegal (both stock and waste empty) → same reference.
 */
export function drawFromStock(state: State): State {
  if (state.status !== 'playing') return state
  if (state.stock.length > 0) {
    const stock = cloneCol(state.stock)
    const waste = cloneCol(state.waste)
    const n = Math.min(3, stock.length)
    for (let i = 0; i < n; i++) {
      const c = stock.pop() as Card
      c.faceUp = true
      waste.push(c)
    }
    return { ...state, stock, waste, moves: state.moves + 1 }
  }
  // Stock empty → recycle waste (needs a non-empty waste).
  if (state.waste.length === 0) return state
  const stock = cloneCol(state.waste).reverse()
  for (const c of stock) c.faceUp = false
  return { ...state, stock, waste: [], moves: state.moves + 1 }
}

/** Move the waste's top card onto a tableau column. */
export function wasteToTableau(state: State, col: number): State {
  if (state.status !== 'playing') return state
  if (col < 0 || col >= TABLEAU_COLS) return state
  const card = top(state.waste)
  if (!card) return state
  const dest = state.tableau[col]
  const destTop = top(dest)
  const ok = destTop ? canStackTableau(card, destTop) : card.rank === RANK_KING
  if (!ok) return state
  const waste = cloneCol(state.waste)
  const moved = waste.pop() as Card
  const tableau = state.tableau.map((c, i) => (i === col ? cloneCol(c) : c))
  tableau[col].push(moved)
  return { ...state, waste, tableau, moves: state.moves + 1 }
}

/** Send the waste's top card to its suit foundation. */
export function wasteToFoundation(state: State): State {
  if (state.status !== 'playing') return state
  const card = top(state.waste)
  if (!card) return state
  const fi = suitIndex(card.suit)
  if (!canGoFoundation(card, top(state.foundations[fi]))) return state
  const waste = cloneCol(state.waste)
  const moved = waste.pop() as Card
  const foundations = state.foundations.map((f, i) => (i === fi ? cloneCol(f) : f))
  foundations[fi].push(moved)
  return withStatus({ ...state, waste, foundations, moves: state.moves + 1 })
}

/** Send a tableau column's top card to its suit foundation (flips exposed). */
export function tableauToFoundation(state: State, col: number): State {
  if (state.status !== 'playing') return state
  if (col < 0 || col >= TABLEAU_COLS) return state
  const card = top(state.tableau[col])
  if (!card) return state
  const fi = suitIndex(card.suit)
  if (!canGoFoundation(card, top(state.foundations[fi]))) return state
  const tableau = state.tableau.map((c, i) => (i === col ? cloneCol(c) : c))
  const moved = tableau[col].pop() as Card
  flipExposed(tableau[col])
  const foundations = state.foundations.map((f, i) => (i === fi ? cloneCol(f) : f))
  foundations[fi].push(moved)
  return withStatus({ ...state, tableau, foundations, moves: state.moves + 1 })
}

/**
 * Move the face-up run of `fromCol` starting at `fromIndex` onto `toCol`.
 * Validates the run itself (descending, alternating colour, all face-up) AND
 * the landing (onto a card one higher & opposite colour, or a King onto an
 * empty column). Flips the newly-exposed card of `fromCol`.
 */
export function tableauToTableau(
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
  if (!isValidRun(run)) return state
  const dest = state.tableau[toCol]
  const destTop = top(dest)
  const head = run[0]
  const ok = destTop ? canStackTableau(head, destTop) : head.rank === RANK_KING
  if (!ok) return state

  const tableau = state.tableau.map((c, i) =>
    i === fromCol || i === toCol ? cloneCol(c) : c,
  )
  const moving = tableau[fromCol].splice(fromIndex) // already-cloned cards
  for (const c of moving) tableau[toCol].push(c)
  flipExposed(tableau[fromCol])
  return { ...state, tableau, moves: state.moves + 1 }
}

/**
 * Sweep every card that can legally go to a foundation (waste top + tableau
 * tops), repeatedly, until no more moves are possible. Used by the one-click
 * "Auto-finish" and the double-click helper. Returns the SAME reference if
 * nothing could be moved.
 */
export function autoToFoundation(state: State): State {
  let cur = state
  for (;;) {
    let advanced = false
    const afterWaste = wasteToFoundation(cur)
    if (afterWaste !== cur) {
      cur = afterWaste
      advanced = true
    }
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
 * True when the deal can be finished with a single click: stock + waste empty
 * and every tableau card face-up (so every remaining card is reachable by the
 * foundation sweep).
 */
export function canAutoFinish(state: State): boolean {
  if (state.status !== 'playing') return false
  if (state.stock.length > 0 || state.waste.length > 0) return false
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
