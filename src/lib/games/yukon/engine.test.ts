import { describe, it, expect } from 'vitest'
import {
  type Card,
  type State,
  type Suit,
  SUITS,
  TABLEAU_COLS,
  DOWN_PER_COL,
  UP_PER_COL,
  autoToFoundation,
  canAutoFinish,
  canFoundation,
  canStack,
  color,
  createGame,
  deal,
  foundationCardCount,
  isRed,
  isWon,
  makeDeck,
  movePile,
  mulberry32,
  score,
  shuffle,
  suitIndex,
  tableauToFoundation,
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
    status: 'playing',
    moves: 0,
    ...over,
  }
}

/** Two-column state: cards in col 0 (from) and col 1 (to). */
function twoColState(from: Card[], to: Card[]): State {
  const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
  t[0] = from
  t[1] = to
  return mkState({ tableau: t })
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
  it('preserves all 52 cards but reorders them, without mutating input', () => {
    const deck = makeDeck()
    const snapshot = deck.map(fmt)
    const shuffled = shuffle(deck, mulberry32(SEED))
    expect(new Set(shuffled.map(fmt)).size).toBe(52)
    expect(shuffled.map(fmt)).not.toEqual(snapshot)
    expect(deck.map(fmt)).toEqual(snapshot) // input untouched
  })
})

// -- colour helpers ----------------------------------------------------------

describe('isRed / color / suitIndex', () => {
  it('hearts and diamonds are red; spades and clubs black', () => {
    expect(isRed('H')).toBe(true)
    expect(isRed('D')).toBe(true)
    expect(isRed('S')).toBe(false)
    expect(color('C')).toBe('black')
  })
  it('suitIndex matches SUITS order', () => {
    expect(suitIndex('S')).toBe(0)
    expect(suitIndex('C')).toBe(3)
  })
})

// -- deal (Yukon layout + golden) --------------------------------------------

describe('deal', () => {
  const s = deal(mulberry32(SEED))

  it('lays 7 Yukon-sized columns (1, 6, 7, 8, 9, 10, 11)', () => {
    expect(s.tableau.map((col) => col.length)).toEqual([1, 6, 7, 8, 9, 10, 11])
  })
  it('uses all 52 cards exactly once, foundations empty', () => {
    const all = [...s.tableau.flat(), ...s.foundations.flat()]
    expect(all).toHaveLength(52)
    expect(new Set(all.map(fmt)).size).toBe(52)
    expect(s.foundations.flat()).toHaveLength(0)
  })
  it('col0 = 1 face-up; col i≥1 = i face-down then 5 face-up', () => {
    // face-down counts per column
    expect(s.tableau.map((col) => col.filter((x) => !x.faceUp).length)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ])
    // face-up counts per column
    expect(s.tableau.map((col) => col.filter((x) => x.faceUp).length)).toEqual([
      1, 5, 5, 5, 5, 5, 5,
    ])
    // The down cards are the bottom `DOWN_PER_COL[i]`; the rest are up.
    for (let col = 0; col < TABLEAU_COLS; col++) {
      const down = DOWN_PER_COL[col]
      for (let i = 0; i < s.tableau[col].length; i++) {
        expect(s.tableau[col][i].faceUp).toBe(i >= down)
      }
      expect(UP_PER_COL[col]).toBe(s.tableau[col].length - down)
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
    expect(s.tableau[0][0].faceUp).toBe(true)
    expect(fmt(s.tableau[6][s.tableau[6].length - 1])).toBe('12C') // col6 top
    expect(fmt(s.tableau[6][0])).toBe('7H') // col6 buried bottom
    expect(s.tableau[6][0].faceUp).toBe(false)
    expect(fmt(s.tableau[3][3])).toBe('9H')
    expect(s.tableau[1].map(fmt)).toEqual(['10H', '13H', '6D', '2H', '8C', '4D'])
  })
  it('createGame(seed) equals deal(mulberry32(seed))', () => {
    expect(createGame(SEED)).toEqual(deal(mulberry32(SEED)))
  })
})

// -- canStack (landing rule) -------------------------------------------------

describe('canStack', () => {
  it('accepts a card onto an opposite-colour card one rank higher', () => {
    expect(canStack(c(6, 'H'), c(7, 'S'))).toBe(true)
    expect(canStack(c(9, 'S'), c(10, 'H'))).toBe(true)
  })
  it('rejects same colour', () => {
    expect(canStack(c(6, 'H'), c(7, 'D'))).toBe(false)
    expect(canStack(c(9, 'S'), c(10, 'C'))).toBe(false)
  })
  it('rejects non-adjacent or non-descending ranks', () => {
    expect(canStack(c(6, 'H'), c(6, 'S'))).toBe(false) // equal
    expect(canStack(c(8, 'H'), c(7, 'S'))).toBe(false) // lower target
    expect(canStack(c(5, 'H'), c(7, 'S'))).toBe(false) // gap of 2
  })
})

// -- canFoundation -----------------------------------------------------------

describe('canFoundation', () => {
  it('accepts an Ace onto an empty foundation, rejects non-Ace', () => {
    expect(canFoundation(c(1, 'S'), undefined)).toBe(true)
    expect(canFoundation(c(2, 'S'), undefined)).toBe(false)
    expect(canFoundation(c(13, 'H'), undefined)).toBe(false)
  })
  it('accepts the next rank of the same suit', () => {
    expect(canFoundation(c(2, 'S'), c(1, 'S'))).toBe(true)
    expect(canFoundation(c(13, 'H'), c(12, 'H'))).toBe(true)
  })
  it('rejects a different suit or a rank gap', () => {
    expect(canFoundation(c(2, 'H'), c(1, 'S'))).toBe(false)
    expect(canFoundation(c(3, 'S'), c(1, 'S'))).toBe(false)
  })
})

// -- movePile: the DEFINING Yukon rule ---------------------------------------

describe('movePile', () => {
  it('moves a single face-up card onto a legal target', () => {
    const s = twoColState([c(6, 'H')], [c(7, 'S')])
    const next = movePile(s, 0, 0, 1)
    expect(next.tableau[0]).toHaveLength(0)
    expect(next.tableau[1].map(fmt)).toEqual(['7S', '6H'])
    expect(next.moves).toBe(1)
  })

  it('moves an UNORDERED face-up pile as long as the BOTTOM card lands legally', () => {
    // The defining Yukon rule: the pile [6H, 9C, 3D] is NOT an ordered
    // sequence, yet it moves because its bottom card (6H) legally lands on 7S.
    const s = twoColState([c(6, 'H'), c(9, 'C'), c(3, 'D')], [c(7, 'S')])
    const next = movePile(s, 0, 0, 1)
    expect(next.tableau[0]).toHaveLength(0)
    expect(next.tableau[1].map(fmt)).toEqual(['7S', '6H', '9C', '3D'])
    expect(next.moves).toBe(1)
  })

  it('moves a pile starting mid-column, leaving lower cards behind', () => {
    // Pick up from index 1: [9C, 2S] (unordered) onto 10H; 8D stays.
    const s = twoColState([c(8, 'D'), c(9, 'C'), c(2, 'S')], [c(10, 'H')])
    const next = movePile(s, 0, 1, 1)
    expect(next.tableau[0].map(fmt)).toEqual(['8D'])
    expect(next.tableau[1].map(fmt)).toEqual(['10H', '9C', '2S'])
  })

  it('flips the newly-exposed card of the source column', () => {
    // A face-down 10C sits under a face-up pile; moving the pile exposes it.
    const s = twoColState([c(10, 'C', false), c(6, 'H'), c(9, 'C')], [c(7, 'S')])
    const next = movePile(s, 0, 1, 1)
    expect(next.tableau[0].map(fmt)).toEqual(['10C'])
    expect(next.tableau[0][0].faceUp).toBe(true) // flipped up
    expect(next.tableau[1].map(fmt)).toEqual(['7S', '6H', '9C'])
  })

  it('moves a King (with its pile) onto an empty column', () => {
    const s = twoColState([c(13, 'S'), c(4, 'D'), c(7, 'C')], [])
    const next = movePile(s, 0, 0, 1)
    expect(next.tableau[0]).toHaveLength(0)
    expect(next.tableau[1].map(fmt)).toEqual(['13S', '4D', '7C'])
  })

  it('rejects a non-King bottom onto an empty column (same ref)', () => {
    const s = twoColState([c(5, 'S'), c(2, 'H')], [])
    expect(movePile(s, 0, 0, 1)).toBe(s)
  })

  it('rejects an illegal landing — same colour (same ref)', () => {
    const s = twoColState([c(6, 'S'), c(9, 'C')], [c(7, 'S')]) // 6S onto 7S = same colour
    expect(movePile(s, 0, 0, 1)).toBe(s)
  })

  it('rejects an illegal landing — wrong rank (same ref)', () => {
    const s = twoColState([c(5, 'H')], [c(7, 'S')]) // 5H onto 7S, gap
    expect(movePile(s, 0, 0, 1)).toBe(s)
  })

  it('rejects a FACE-DOWN bottom card (same ref)', () => {
    const s = twoColState([c(6, 'H', false), c(9, 'C')], [c(7, 'S')])
    expect(movePile(s, 0, 0, 1)).toBe(s)
  })

  it('rejects moving a column onto itself (same ref)', () => {
    const s = twoColState([c(6, 'H')], [c(7, 'S')])
    expect(movePile(s, 0, 0, 0)).toBe(s)
  })

  it('rejects an out-of-range fromIndex (same ref)', () => {
    const s = twoColState([c(6, 'H')], [c(7, 'S')])
    expect(movePile(s, 0, 5, 1)).toBe(s)
  })

  it('does not mutate the source state', () => {
    const s = twoColState([c(6, 'H'), c(9, 'C')], [c(7, 'S')])
    movePile(s, 0, 0, 1)
    expect(s.tableau[0].map(fmt)).toEqual(['6H', '9C'])
    expect(s.tableau[1].map(fmt)).toEqual(['7S'])
  })
})

// -- tableauToFoundation -----------------------------------------------------

describe('tableauToFoundation', () => {
  it('sends the top card and flips the newly-exposed card', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[3] = [c(9, 'H', false), c(2, 'S')] // 2S on top of a face-down 9H
    const s = mkState({ tableau: t, foundations: foundationsUpTo(1) })
    const next = tableauToFoundation(s, 3)
    expect(next.foundations[suitIndex('S')].map(fmt)).toEqual(['1S', '2S'])
    expect(next.tableau[3].map(fmt)).toEqual(['9H'])
    expect(next.tableau[3][0].faceUp).toBe(true) // flipped up
    expect(next.moves).toBe(1)
  })
  it('builds a suit foundation ascending A→2→3', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(1, 'S')]
    t[1] = [c(2, 'S')]
    t[2] = [c(3, 'S')]
    let s = mkState({ tableau: t })
    s = tableauToFoundation(s, 0)
    s = tableauToFoundation(s, 1)
    s = tableauToFoundation(s, 2)
    expect(s.foundations[suitIndex('S')].map(fmt)).toEqual(['1S', '2S', '3S'])
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

// -- autoToFoundation / canAutoFinish ---------------------------------------

describe('autoToFoundation', () => {
  it('sweeps every reachable tableau card up to the foundations', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(2, 'S'), c(1, 'S')] // 1S reachable, then 2S
    t[1] = [c(1, 'H')]
    t[2] = [c(1, 'C')]
    const s = mkState({ tableau: t })
    const next = autoToFoundation(s)
    expect(next.foundations[suitIndex('S')].map(fmt)).toEqual(['1S', '2S'])
    expect(next.foundations[suitIndex('H')].map(fmt)).toEqual(['1H'])
    expect(next.foundations[suitIndex('C')].map(fmt)).toEqual(['1C'])
    expect(next.tableau.flat()).toHaveLength(0)
  })
  it('is a no-op (same ref) when nothing can advance', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(5, 'S')]
    const s = mkState({ tableau: t })
    expect(autoToFoundation(s)).toBe(s)
  })
})

describe('canAutoFinish', () => {
  it('is true when every tableau card is face-up', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(2, 'S'), c(1, 'S')]
    expect(canAutoFinish(mkState({ tableau: t }))).toBe(true)
  })
  it('is false while a tableau card is still face-down', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(2, 'S', false), c(1, 'S')]
    expect(canAutoFinish(mkState({ tableau: t }))).toBe(false)
  })
  it('is false on a fully empty board', () => {
    expect(canAutoFinish(mkState())).toBe(false)
  })
})

// -- win detection + scripted win -------------------------------------------

describe('winning', () => {
  it('isWon requires all four foundations to hold 13', () => {
    expect(isWon(mkState({ foundations: foundationsUpTo(13) }))).toBe(true)
    expect(isWon(mkState({ foundations: foundationsUpTo(12) }))).toBe(false)
  })

  it('a scripted sequence reaches status "won"', () => {
    // Near-win fixture: every foundation at Queen; the four Kings sit as tops.
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(13, 'S')]
    t[1] = [c(13, 'H')]
    t[2] = [c(13, 'D')]
    t[3] = [c(13, 'C')]
    let s: State = mkState({ tableau: t, foundations: foundationsUpTo(12) })
    s = tableauToFoundation(s, 0) // K♠
    s = tableauToFoundation(s, 1) // K♥
    s = tableauToFoundation(s, 2) // K♦
    expect(s.status).toBe('playing') // not yet — one King left
    s = tableauToFoundation(s, 3) // K♣ → win
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
    expect(movePile(won, 0, 0, 1)).toBe(won)
    expect(tableauToFoundation(won, 0)).toBe(won)
  })
})

// -- scoring -----------------------------------------------------------------

describe('score', () => {
  it('is 0 for a fresh deal', () => {
    expect(score(createGame(SEED))).toBe(0)
    expect(foundationCardCount(createGame(SEED))).toBe(0)
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
