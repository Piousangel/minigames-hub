/**
 * FreeCell — the classic open solitaire, pure engine.
 *
 * All 52 cards are dealt FACE-UP into 8 cascades (cols 0–3 get 7 cards, cols
 * 4–7 get 6). There are 4 free cells (each holds one card) and 4 foundations
 * (build UP by suit A→K). Cascades build DOWN in ALTERNATING colours. You move
 * one card at a time; moving a run of N cards is a "supermove" that is only
 * legal when you have enough free cells + empty columns to stage it (see
 * `maxSupermove`). Win = all 52 cards on the foundations. Almost every deal is
 * solvable — that is the appeal.
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
}

/** Foundations are index-tracked by this fixed suit order. */
export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']
export const CASCADE_COLS = 8
export const FREE_CELLS = 4
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

// -- PRNG (byte-identical to the solitaire/decant template's mulberry32) ------

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

export type Status = 'playing' | 'won'

export interface State {
  cascades: Card[][] // 8 columns; all cards face-up. Bottom (top of the pile) = END of array.
  freeCells: (Card | null)[] // 4 slots, each null or one card
  foundations: Card[][] // 4 piles, one per SUITS[i], built A→K
  status: Status
  moves: number
}

// -- Clone helpers -----------------------------------------------------------

function cloneCard(c: Card): Card {
  return { rank: c.rank, suit: c.suit }
}

function cloneCol(col: Card[]): Card[] {
  return col.map(cloneCard)
}

function top<T>(arr: T[]): T | undefined {
  return arr.length ? arr[arr.length - 1] : undefined
}

// -- Deal --------------------------------------------------------------------

/**
 * Build a fresh FreeCell deal. Consumes rng ONLY here (via `shuffle`). Cards
 * are dealt round-robin across the 8 columns: card i → column (i % 8). With 52
 * cards this fills columns 0–3 with 7 cards each and columns 4–7 with 6 each.
 * Free cells + foundations start empty.
 */
export function deal(rng: Rng): State {
  const deck = shuffle(makeDeck(), rng)
  const cascades: Card[][] = Array.from({ length: CASCADE_COLS }, () => [])
  for (let i = 0; i < deck.length; i++) {
    cascades[i % CASCADE_COLS].push(deck[i])
  }
  return {
    cascades,
    freeCells: Array.from({ length: FREE_CELLS }, () => null),
    foundations: [[], [], [], []],
    status: 'playing',
    moves: 0,
  }
}

export function createGame(seed: number): State {
  return deal(mulberry32(seed))
}

// -- Validators --------------------------------------------------------------

/** May `moving` be placed on `onto` in a cascade? (down, alternating colour) */
export function canStackCascade(moving: Card, onto: Card): boolean {
  return onto.rank === moving.rank + 1 && color(onto.suit) !== color(moving.suit)
}

/** May `card` go to its suit foundation whose current top is `foundationTop`? */
export function canGoFoundation(card: Card, foundationTop: Card | undefined): boolean {
  if (!foundationTop) return card.rank === RANK_ACE
  return card.suit === foundationTop.suit && card.rank === foundationTop.rank + 1
}

/** Current top card of the foundation for `suit` (undefined if empty). */
export function foundationTop(state: State, suit: Suit): Card | undefined {
  return top(state.foundations[suitIndex(suit)])
}

/** Is a sequence a legal movable run (descending by 1, alternating colour)? */
export function isSequence(cards: Card[]): boolean {
  if (cards.length === 0) return false
  for (let i = 1; i < cards.length; i++) {
    if (!canStackCascade(cards[i], cards[i - 1])) return false
  }
  return true
}

// -- Supermove limit ---------------------------------------------------------

export function emptyFreeCells(state: State): number {
  return state.freeCells.reduce((n, c) => n + (c === null ? 1 : 0), 0)
}

export function emptyCascades(state: State): number {
  return state.cascades.reduce((n, col) => n + (col.length === 0 ? 1 : 0), 0)
}

/**
 * Maximum number of cards that can be moved as a single run.
 *
 *   maxCards = (freeCellsEmpty + 1) * 2 ^ (emptyColumns)
 *
 * THE #1 FreeCell bug: when the move's DESTINATION is an empty column, that
 * column cannot also be used as a staging area, so it does NOT count toward
 * the exponent — use 2 ^ (emptyColumns - 1) in that case.
 */
export function maxSupermove(state: State, movingToEmpty: boolean): number {
  const free = emptyFreeCells(state)
  let empties = emptyCascades(state)
  if (movingToEmpty) empties = Math.max(0, empties - 1)
  return (free + 1) * Math.pow(2, empties)
}

// -- Win / status ------------------------------------------------------------

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

/** Move the top card of a cascade into the first empty free cell. */
export function toFreeCell(state: State, fromCol: number): State {
  if (state.status !== 'playing') return state
  if (fromCol < 0 || fromCol >= CASCADE_COLS) return state
  const card = top(state.cascades[fromCol])
  if (!card) return state
  const cellIndex = state.freeCells.indexOf(null)
  if (cellIndex === -1) return state
  const cascades = state.cascades.map((c, i) => (i === fromCol ? cloneCol(c) : c))
  const moved = cascades[fromCol].pop() as Card
  const freeCells = state.freeCells.slice()
  freeCells[cellIndex] = moved
  return { ...state, cascades, freeCells, moves: state.moves + 1 }
}

/** Send a free cell's card to its suit foundation. */
export function freeCellToFoundation(state: State, cellIndex: number): State {
  if (state.status !== 'playing') return state
  if (cellIndex < 0 || cellIndex >= FREE_CELLS) return state
  const card = state.freeCells[cellIndex]
  if (!card) return state
  const fi = suitIndex(card.suit)
  if (!canGoFoundation(card, top(state.foundations[fi]))) return state
  const freeCells = state.freeCells.slice()
  freeCells[cellIndex] = null
  const foundations = state.foundations.map((f, i) => (i === fi ? cloneCol(f) : f))
  foundations[fi].push(cloneCard(card))
  return withStatus({ ...state, freeCells, foundations, moves: state.moves + 1 })
}

/** Move a free cell's card onto a cascade (or an empty cascade). */
export function freeCellToCascade(state: State, cellIndex: number, toCol: number): State {
  if (state.status !== 'playing') return state
  if (cellIndex < 0 || cellIndex >= FREE_CELLS) return state
  if (toCol < 0 || toCol >= CASCADE_COLS) return state
  const card = state.freeCells[cellIndex]
  if (!card) return state
  const destTop = top(state.cascades[toCol])
  const ok = destTop ? canStackCascade(card, destTop) : true
  if (!ok) return state
  const freeCells = state.freeCells.slice()
  freeCells[cellIndex] = null
  const cascades = state.cascades.map((c, i) => (i === toCol ? cloneCol(c) : c))
  cascades[toCol].push(cloneCard(card))
  return { ...state, freeCells, cascades, moves: state.moves + 1 }
}

/** Send a cascade's top card to its suit foundation. */
export function cascadeToFoundation(state: State, fromCol: number): State {
  if (state.status !== 'playing') return state
  if (fromCol < 0 || fromCol >= CASCADE_COLS) return state
  const card = top(state.cascades[fromCol])
  if (!card) return state
  const fi = suitIndex(card.suit)
  if (!canGoFoundation(card, top(state.foundations[fi]))) return state
  const cascades = state.cascades.map((c, i) => (i === fromCol ? cloneCol(c) : c))
  const moved = cascades[fromCol].pop() as Card
  const foundations = state.foundations.map((f, i) => (i === fi ? cloneCol(f) : f))
  foundations[fi].push(moved)
  return withStatus({ ...state, cascades, foundations, moves: state.moves + 1 })
}

/**
 * Move the bottom `count` cards of `fromCol` (a run) onto `toCol`. Validates:
 *  - the moved cards form a legal alternating-colour descending sequence,
 *  - the landing is legal (head onto a card one higher & opposite colour, or
 *    any card onto an empty column),
 *  - `count <= maxSupermove(state, destIsEmpty)`.
 * Illegal → same reference.
 */
export function cascadeToCascade(
  state: State,
  fromCol: number,
  count: number,
  toCol: number,
): State {
  if (state.status !== 'playing') return state
  if (fromCol === toCol) return state
  if (fromCol < 0 || fromCol >= CASCADE_COLS) return state
  if (toCol < 0 || toCol >= CASCADE_COLS) return state
  if (!Number.isInteger(count) || count < 1) return state
  const src = state.cascades[fromCol]
  if (count > src.length) return state
  const run = src.slice(src.length - count)
  if (!isSequence(run)) return state
  const dest = state.cascades[toCol]
  const destTop = top(dest)
  const destEmpty = dest.length === 0
  const head = run[0]
  const landOk = destEmpty ? true : canStackCascade(head, destTop as Card)
  if (!landOk) return state
  if (count > maxSupermove(state, destEmpty)) return state

  const cascades = state.cascades.map((c, i) =>
    i === fromCol || i === toCol ? cloneCol(c) : c,
  )
  const moving = cascades[fromCol].splice(cascades[fromCol].length - count, count)
  for (const c of moving) cascades[toCol].push(c)
  return { ...state, cascades, moves: state.moves + 1 }
}

/**
 * Sweep every card that can legally go to a foundation (free cells + cascade
 * tops), repeatedly, until no more move. Used by the "Auto-finish" button and
 * the double-tap helper. Returns the SAME reference when nothing can be moved.
 */
export function autoToFoundations(state: State): State {
  let cur = state
  for (;;) {
    let advanced = false
    for (let i = 0; i < FREE_CELLS; i++) {
      const next = freeCellToFoundation(cur, i)
      if (next !== cur) {
        cur = next
        advanced = true
      }
    }
    for (let col = 0; col < CASCADE_COLS; col++) {
      const next = cascadeToFoundation(cur, col)
      if (next !== cur) {
        cur = next
        advanced = true
      }
    }
    if (!advanced) break
  }
  return cur
}

// -- Scoring -----------------------------------------------------------------

/**
 * Higher = better, always a non-negative integer, monotonic as cards reach the
 * foundations. 100 per foundation card, plus a completion bonus on a win.
 */
export function score(state: State): number {
  const base = foundationCardCount(state) * 100
  return state.status === 'won' ? base + 2000 : base
}
