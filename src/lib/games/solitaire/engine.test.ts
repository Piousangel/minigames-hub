import { describe, it, expect } from 'vitest'
import {
  type Card,
  type State,
  type Suit,
  SUITS,
  TABLEAU_COLS,
  autoToFoundation,
  canAutoFinish,
  canGoFoundation,
  canStackTableau,
  color,
  createGame,
  deal,
  drawFromStock,
  isRed,
  isValidRun,
  isWon,
  makeDeck,
  mulberry32,
  score,
  shuffle,
  suitIndex,
  tableauToFoundation,
  tableauToTableau,
  wasteToFoundation,
  wasteToTableau,
} from './engine'

const SEED = 12345

// -- fixture helpers ---------------------------------------------------------

/** Build a card (face-up by default). */
function c(rank: number, suit: Suit, faceUp = true): Card {
  return { rank, suit, faceUp }
}

/** Build a State with sensible empty defaults, overridable per-field. */
function mkState(over: Partial<State> = {}): State {
  return {
    tableau: Array.from({ length: TABLEAU_COLS }, () => []),
    foundations: [[], [], [], []],
    stock: [],
    waste: [],
    status: 'playing',
    moves: 0,
    ...over,
  }
}

/** Foundations filled A..upTo for every suit (SUITS order). */
function foundationsUpTo(upTo: number): Card[][] {
  return SUITS.map((s) => {
    const pile: Card[] = []
    for (let r = 1; r <= upTo; r++) pile.push(c(r, s))
    return pile
  })
}

const fmt = (card: Card) => `${card.rank}${card.suit}`

// -- PRNG / deck -------------------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('makeDeck', () => {
  it('produces 52 unique face-down cards', () => {
    const deck = makeDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map(fmt)).size).toBe(52)
    expect(deck.every((x) => !x.faceUp)).toBe(true)
  })
})

describe('shuffle', () => {
  it('is deterministic given the same seed', () => {
    const a = shuffle(makeDeck(), mulberry32(7)).map(fmt)
    const b = shuffle(makeDeck(), mulberry32(7)).map(fmt)
    expect(a).toEqual(b)
  })
  it('preserves all 52 cards but reorders them', () => {
    const shuffled = shuffle(makeDeck(), mulberry32(SEED))
    expect(new Set(shuffled.map(fmt)).size).toBe(52)
    expect(shuffled.map(fmt)).not.toEqual(makeDeck().map(fmt))
  })
  it('does not mutate the input deck', () => {
    const deck = makeDeck()
    const snapshot = deck.map(fmt)
    shuffle(deck, mulberry32(1))
    expect(deck.map(fmt)).toEqual(snapshot)
  })
})

// -- colour helpers ----------------------------------------------------------

describe('isRed / color', () => {
  it('hearts and diamonds are red', () => {
    expect(isRed('H')).toBe(true)
    expect(isRed('D')).toBe(true)
    expect(color('H')).toBe('red')
  })
  it('spades and clubs are black', () => {
    expect(isRed('S')).toBe(false)
    expect(isRed('C')).toBe(false)
    expect(color('C')).toBe('black')
  })
  it('suitIndex matches SUITS order', () => {
    expect(suitIndex('S')).toBe(0)
    expect(suitIndex('C')).toBe(3)
  })
})

// -- deal (layout + golden) --------------------------------------------------

describe('deal', () => {
  const s = deal(mulberry32(SEED))

  it('lays 7 piles of sizes 1..7', () => {
    expect(s.tableau.map((col) => col.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  it('leaves 24 face-down cards in the stock, empty waste + foundations', () => {
    expect(s.stock).toHaveLength(24)
    expect(s.stock.every((x) => !x.faceUp)).toBe(true)
    expect(s.waste).toHaveLength(0)
    expect(s.foundations.flat()).toHaveLength(0)
  })
  it('uses all 52 cards exactly once', () => {
    const all = [...s.tableau.flat(), ...s.stock, ...s.waste, ...s.foundations.flat()]
    expect(all).toHaveLength(52)
    expect(new Set(all.map(fmt)).size).toBe(52)
  })
  it('face-up only the top card of each pile', () => {
    for (const col of s.tableau) {
      expect(col[col.length - 1].faceUp).toBe(true)
      for (let i = 0; i < col.length - 1; i++) expect(col[i].faceUp).toBe(false)
    }
  })
  it('starts playing with zero moves', () => {
    expect(s.status).toBe('playing')
    expect(s.moves).toBe(0)
  })
  it('GOLDEN: seed 12345 deals a known layout', () => {
    // Locked from the current deterministic deal. If this breaks, the RNG or
    // deal order changed and every downstream golden must be re-verified.
    expect(fmt(s.tableau[0][0])).toBe('5D')
    expect(fmt(s.tableau[6][6])).toBe('13S') // King of Spades, face-up top
    expect(s.tableau[6][6].faceUp).toBe(true)
    expect(fmt(s.tableau[2][2])).toBe('8C')
    expect(fmt(s.stock[s.stock.length - 1])).toBe('12C') // stock draw-top
  })
  it('createGame(seed) equals deal(mulberry32(seed))', () => {
    expect(createGame(SEED)).toEqual(deal(mulberry32(SEED)))
  })
})

// -- canStackTableau ---------------------------------------------------------

describe('canStackTableau', () => {
  it('accepts one-lower onto opposite colour (red on black)', () => {
    expect(canStackTableau(c(6, 'H'), c(7, 'S'))).toBe(true)
    expect(canStackTableau(c(6, 'D'), c(7, 'C'))).toBe(true)
  })
  it('accepts black on red', () => {
    expect(canStackTableau(c(9, 'S'), c(10, 'H'))).toBe(true)
  })
  it('rejects same colour', () => {
    expect(canStackTableau(c(6, 'H'), c(7, 'D'))).toBe(false)
    expect(canStackTableau(c(9, 'S'), c(10, 'C'))).toBe(false)
  })
  it('rejects non-descending ranks', () => {
    expect(canStackTableau(c(6, 'H'), c(6, 'S'))).toBe(false) // equal
    expect(canStackTableau(c(8, 'H'), c(7, 'S'))).toBe(false) // higher
    expect(canStackTableau(c(5, 'H'), c(7, 'S'))).toBe(false) // gap of 2
  })
})

// -- canGoFoundation ---------------------------------------------------------

describe('canGoFoundation', () => {
  it('accepts an Ace onto an empty foundation', () => {
    expect(canGoFoundation(c(1, 'S'), undefined)).toBe(true)
  })
  it('rejects a non-Ace onto an empty foundation', () => {
    expect(canGoFoundation(c(2, 'S'), undefined)).toBe(false)
    expect(canGoFoundation(c(13, 'H'), undefined)).toBe(false)
  })
  it('accepts the next rank of the same suit', () => {
    expect(canGoFoundation(c(2, 'S'), c(1, 'S'))).toBe(true)
    expect(canGoFoundation(c(13, 'H'), c(12, 'H'))).toBe(true)
  })
  it('rejects a different suit', () => {
    expect(canGoFoundation(c(2, 'H'), c(1, 'S'))).toBe(false)
  })
  it('rejects a rank gap or non-ascending', () => {
    expect(canGoFoundation(c(3, 'S'), c(1, 'S'))).toBe(false)
    expect(canGoFoundation(c(1, 'S'), c(2, 'S'))).toBe(false)
  })
})

// -- isValidRun --------------------------------------------------------------

describe('isValidRun', () => {
  it('accepts a descending alternating-colour run', () => {
    expect(isValidRun([c(7, 'S'), c(6, 'H'), c(5, 'S')])).toBe(true)
  })
  it('accepts a single face-up card', () => {
    expect(isValidRun([c(4, 'D')])).toBe(true)
  })
  it('rejects a same-colour break', () => {
    expect(isValidRun([c(7, 'S'), c(6, 'C')])).toBe(false)
  })
  it('rejects a rank break', () => {
    expect(isValidRun([c(7, 'S'), c(5, 'H')])).toBe(false)
  })
  it('rejects a run containing a face-down card', () => {
    expect(isValidRun([c(7, 'S'), c(6, 'H', false)])).toBe(false)
  })
})

// -- drawFromStock -----------------------------------------------------------

describe('drawFromStock', () => {
  it('moves 3 stock→waste face-up and increments moves', () => {
    const s = mkState({ stock: [c(1, 'S', false), c(2, 'S', false), c(3, 'S', false), c(4, 'S', false)] })
    const next = drawFromStock(s)
    expect(next.stock).toHaveLength(1)
    expect(next.waste).toHaveLength(3)
    expect(next.waste.every((x) => x.faceUp)).toBe(true)
    expect(next.moves).toBe(1)
  })
  it('draws fewer than 3 when the stock is short', () => {
    const s = mkState({ stock: [c(1, 'S', false), c(2, 'S', false)] })
    const next = drawFromStock(s)
    expect(next.stock).toHaveLength(0)
    expect(next.waste).toHaveLength(2)
  })
  it('recycles the waste into a face-down stock when stock empty', () => {
    const s = mkState({ stock: [], waste: [c(1, 'S'), c(2, 'S'), c(3, 'S')] })
    const next = drawFromStock(s)
    expect(next.stock).toHaveLength(3)
    expect(next.waste).toHaveLength(0)
    expect(next.stock.every((x) => !x.faceUp)).toBe(true)
    expect(next.moves).toBe(1)
  })
  it('is a no-op (same ref) when stock AND waste are empty', () => {
    const s = mkState()
    expect(drawFromStock(s)).toBe(s)
  })
  it('does not mutate the source state', () => {
    const s = mkState({ stock: [c(1, 'S', false), c(2, 'S', false), c(3, 'S', false)] })
    drawFromStock(s)
    expect(s.waste).toHaveLength(0)
    expect(s.stock).toHaveLength(3)
  })
})

// -- wasteToTableau ----------------------------------------------------------

describe('wasteToTableau', () => {
  it('drops a King onto an empty column', () => {
    const s = mkState({ waste: [c(13, 'S')] })
    const next = wasteToTableau(s, 0)
    expect(next.tableau[0].map(fmt)).toEqual(['13S'])
    expect(next.waste).toHaveLength(0)
    expect(next.moves).toBe(1)
  })
  it('rejects a non-King onto an empty column (same ref)', () => {
    const s = mkState({ waste: [c(5, 'S')] })
    expect(wasteToTableau(s, 0)).toBe(s)
  })
  it('stacks onto a legal tableau top', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[1] = [c(7, 'S')]
    const s = mkState({ tableau: t, waste: [c(6, 'H')] })
    const next = wasteToTableau(s, 1)
    expect(next.tableau[1].map(fmt)).toEqual(['7S', '6H'])
  })
  it('rejects an illegal stack (same ref)', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[1] = [c(7, 'S')]
    const s = mkState({ tableau: t, waste: [c(6, 'S')] }) // same colour
    expect(wasteToTableau(s, 1)).toBe(s)
  })
  it('is a no-op with an empty waste', () => {
    const s = mkState()
    expect(wasteToTableau(s, 0)).toBe(s)
  })
})

// -- wasteToFoundation -------------------------------------------------------

describe('wasteToFoundation', () => {
  it('sends an Ace from the waste to its suit foundation', () => {
    const s = mkState({ waste: [c(1, 'H')] })
    const next = wasteToFoundation(s)
    expect(next.foundations[suitIndex('H')].map(fmt)).toEqual(['1H'])
    expect(next.waste).toHaveLength(0)
    expect(next.moves).toBe(1)
  })
  it('rejects an illegal foundation move (same ref)', () => {
    const s = mkState({ waste: [c(5, 'H')] })
    expect(wasteToFoundation(s)).toBe(s)
  })
})

// -- tableauToFoundation -----------------------------------------------------

describe('tableauToFoundation', () => {
  it('sends the top card and flips the newly-exposed card', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    const found = foundationsUpTo(1) // aces down
    t[3] = [c(9, 'H', false), c(2, 'S')] // 2S on top of a face-down 9H
    const s = mkState({ tableau: t, foundations: found })
    const next = tableauToFoundation(s, 3)
    expect(next.foundations[suitIndex('S')].map(fmt)).toEqual(['1S', '2S'])
    expect(next.tableau[3].map(fmt)).toEqual(['9H'])
    expect(next.tableau[3][0].faceUp).toBe(true) // flipped up
    expect(next.moves).toBe(1)
  })
  it('rejects when the top card cannot advance the foundation (same ref)', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(5, 'S')]
    const s = mkState({ tableau: t })
    expect(tableauToFoundation(s, 0)).toBe(s)
  })
  it('is a no-op on an empty column', () => {
    const s = mkState()
    expect(tableauToFoundation(s, 2)).toBe(s)
  })
})

// -- tableauToTableau --------------------------------------------------------

describe('tableauToTableau', () => {
  function twoColState(from: Card[], to: Card[]): State {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = from
    t[1] = to
    return mkState({ tableau: t })
  }

  it('moves a single card onto a legal target', () => {
    const s = twoColState([c(6, 'H')], [c(7, 'S')])
    const next = tableauToTableau(s, 0, 0, 1)
    expect(next.tableau[0]).toHaveLength(0)
    expect(next.tableau[1].map(fmt)).toEqual(['7S', '6H'])
    expect(next.moves).toBe(1)
  })
  it('moves a valid multi-card run as a unit', () => {
    const s = twoColState([c(8, 'H'), c(7, 'S'), c(6, 'H')], [c(9, 'S')])
    const next = tableauToTableau(s, 0, 0, 1)
    expect(next.tableau[0]).toHaveLength(0)
    expect(next.tableau[1].map(fmt)).toEqual(['9S', '8H', '7S', '6H'])
  })
  it('moves a partial run starting mid-column and flips the exposed card', () => {
    // face-down 10C under a valid 7S-6H run; move the run, expose the 10C.
    const s = twoColState([c(10, 'C', false), c(7, 'S'), c(6, 'H')], [c(8, 'H')])
    const next = tableauToTableau(s, 0, 1, 1)
    expect(next.tableau[0].map(fmt)).toEqual(['10C'])
    expect(next.tableau[0][0].faceUp).toBe(true)
    expect(next.tableau[1].map(fmt)).toEqual(['8H', '7S', '6H'])
  })
  it('rejects a broken run (same-colour break) — same ref', () => {
    const s = twoColState([c(8, 'H'), c(7, 'D')], [c(9, 'S')]) // 7D on 8H is same-colour
    expect(tableauToTableau(s, 0, 0, 1)).toBe(s)
  })
  it('rejects a legal-looking run onto an illegal target — same ref', () => {
    const s = twoColState([c(7, 'S'), c(6, 'H')], [c(9, 'S')]) // 7S onto 9S illegal
    expect(tableauToTableau(s, 0, 0, 1)).toBe(s)
  })
  it('accepts only a King (or King-led run) onto an empty column', () => {
    const emptyDest = twoColState([c(13, 'S'), c(12, 'H')], [])
    const kingMove = tableauToTableau(emptyDest, 0, 0, 1)
    expect(kingMove.tableau[1].map(fmt)).toEqual(['13S', '12H'])

    const nonKing = twoColState([c(5, 'S')], [])
    expect(tableauToTableau(nonKing, 0, 0, 1)).toBe(nonKing) // no-op
  })
  it('rejects moving a column onto itself (same ref)', () => {
    const s = twoColState([c(6, 'H')], [c(7, 'S')])
    expect(tableauToTableau(s, 0, 0, 0)).toBe(s)
  })
  it('rejects an out-of-range fromIndex (same ref)', () => {
    const s = twoColState([c(6, 'H')], [c(7, 'S')])
    expect(tableauToTableau(s, 0, 5, 1)).toBe(s)
  })
})

// -- autoToFoundation / canAutoFinish ---------------------------------------

describe('autoToFoundation', () => {
  it('sweeps every reachable card up to the foundations', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(1, 'S')]
    t[1] = [c(1, 'H')]
    t[2] = [c(2, 'S')]
    const s = mkState({ tableau: t, waste: [c(1, 'C')] })
    const next = autoToFoundation(s)
    expect(next.foundations[suitIndex('S')].map(fmt)).toEqual(['1S', '2S'])
    expect(next.foundations[suitIndex('H')].map(fmt)).toEqual(['1H'])
    expect(next.foundations[suitIndex('C')].map(fmt)).toEqual(['1C'])
    expect(next.tableau.flat()).toHaveLength(0)
    expect(next.waste).toHaveLength(0)
  })
  it('is a no-op (same ref) when nothing can advance', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(5, 'S')]
    const s = mkState({ tableau: t })
    expect(autoToFoundation(s)).toBe(s)
  })
})

describe('canAutoFinish', () => {
  it('is true when stock+waste empty and all tableau cards are face-up', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(2, 'S'), c(1, 'S')]
    expect(canAutoFinish(mkState({ tableau: t }))).toBe(true)
  })
  it('is false while cards remain in the stock', () => {
    expect(canAutoFinish(mkState({ stock: [c(4, 'C', false)] }))).toBe(false)
  })
  it('is false while a tableau card is still face-down', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(2, 'S', false), c(1, 'S')]
    expect(canAutoFinish(mkState({ tableau: t }))).toBe(false)
  })
})

// -- win detection + scripted win -------------------------------------------

describe('winning', () => {
  it('isWon requires all four foundations to hold 13', () => {
    expect(isWon(mkState({ foundations: foundationsUpTo(13) }))).toBe(true)
    expect(isWon(mkState({ foundations: foundationsUpTo(12) }))).toBe(false)
  })

  it('a scripted sequence reaches status "won"', () => {
    // Near-win fixture: every foundation at Queen; the four Kings sit as tops:
    // one on the waste, three on tableau columns.
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(13, 'S')]
    t[1] = [c(13, 'H')]
    t[2] = [c(13, 'D')]
    let s: State = mkState({
      tableau: t,
      waste: [c(13, 'C')],
      foundations: foundationsUpTo(12),
    })
    s = wasteToFoundation(s) // K♣
    s = tableauToFoundation(s, 0) // K♠
    s = tableauToFoundation(s, 1) // K♥
    expect(s.status).toBe('playing') // not yet — one King left
    s = tableauToFoundation(s, 2) // K♦ → win
    expect(s.status).toBe('won')
    expect(isWon(s)).toBe(true)
  })

  it('autoToFoundation finishes a solved-but-unstacked deal', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(13, 'S')]
    t[1] = [c(13, 'H')]
    t[2] = [c(13, 'D')]
    t[3] = [c(13, 'C')]
    const s = mkState({ tableau: t, foundations: foundationsUpTo(12) })
    expect(canAutoFinish(s)).toBe(true)
    const done = autoToFoundation(s)
    expect(done.status).toBe('won')
  })

  it('moves after a win are no-ops (same ref)', () => {
    const won = mkState({ foundations: foundationsUpTo(13), status: 'won' })
    expect(drawFromStock(won)).toBe(won)
    expect(wasteToFoundation(won)).toBe(won)
    expect(tableauToTableau(won, 0, 0, 1)).toBe(won)
  })
})

// -- scoring -----------------------------------------------------------------

describe('score', () => {
  it('is 0 for a fresh deal', () => {
    expect(score(createGame(SEED))).toBe(0)
  })
  it('rises by 100 per foundation card (monotonic)', () => {
    const s1 = mkState({ foundations: foundationsUpTo(1) }) // 4 cards
    const s2 = mkState({ foundations: foundationsUpTo(2) }) // 8 cards
    expect(score(s1)).toBe(400)
    expect(score(s2)).toBe(800)
    expect(score(s2)).toBeGreaterThan(score(s1))
  })
  it('adds a completion bonus on a win', () => {
    const won = mkState({ foundations: foundationsUpTo(13), status: 'won' })
    expect(score(won)).toBe(52 * 100 + 2000)
    expect(score(won)).toBeGreaterThan(52 * 100)
  })
})
