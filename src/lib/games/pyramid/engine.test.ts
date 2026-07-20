import { describe, it, expect } from 'vitest'
import {
  type Card,
  type State,
  type Suit,
  type Target,
  ROWS,
  canPair,
  color,
  createGame,
  deal,
  drawStock,
  freeCards,
  hasAnyMove,
  isAvailable,
  isFree,
  isRed,
  makeDeck,
  mulberry32,
  pair,
  removeKing,
  score,
  shuffle,
  value,
} from './engine'

const SEED = 12345

// -- fixture helpers ---------------------------------------------------------

let idCounter = 100
/** Build a card with a unique id (irrelevant to logic, keeps keys distinct). */
function c(rank: number, suit: Suit): Card {
  return { rank, suit, id: idCounter++ }
}

/** An all-`null` 7-row pyramid (row r has r+1 slots). */
function emptyPyramid(): (Card | null)[][] {
  const p: (Card | null)[][] = []
  for (let r = 0; r < ROWS; r++) p.push(Array.from({ length: r + 1 }, () => null))
  return p
}

/** Build a State with sensible defaults, overridable per-field. */
function mkState(over: Partial<State> = {}): State {
  return {
    pyramid: emptyPyramid(),
    stock: [],
    waste: [],
    passesLeft: 3,
    status: 'playing',
    moves: 0,
    ...over,
  }
}

const P = (row: number, col: number): Target => ({ kind: 'pyramid', row, col })
const W: Target = { kind: 'waste' }
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
  it('produces 52 unique cards with stable ids 0..51', () => {
    const deck = makeDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map(fmt)).size).toBe(52)
    expect(deck.map((x) => x.id)).toEqual(Array.from({ length: 52 }, (_, i) => i))
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
    const snap = deck.map(fmt)
    shuffle(deck, mulberry32(1))
    expect(deck.map(fmt)).toEqual(snap)
  })
})

// -- helpers -----------------------------------------------------------------

describe('colour + value helpers', () => {
  it('hearts and diamonds are red; spades and clubs black', () => {
    expect(isRed('H')).toBe(true)
    expect(isRed('D')).toBe(true)
    expect(isRed('S')).toBe(false)
    expect(color('C')).toBe('black')
    expect(color('H')).toBe('red')
  })
  it('value(card) is the rank', () => {
    expect(value(c(1, 'S'))).toBe(1)
    expect(value(c(13, 'H'))).toBe(13)
  })
})

// -- deal --------------------------------------------------------------------

describe('deal', () => {
  const s = deal(mulberry32(SEED))

  it('lays 7 rows of sizes 1..7 (28 cards)', () => {
    expect(s.pyramid.map((row) => row.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(s.pyramid.flat().filter(Boolean)).toHaveLength(28)
  })
  it('leaves 24 cards in the stock, empty waste, 3 passes', () => {
    expect(s.stock).toHaveLength(24)
    expect(s.waste).toHaveLength(0)
    expect(s.passesLeft).toBe(3)
    expect(s.status).toBe('playing')
    expect(s.moves).toBe(0)
  })
  it('uses all 52 cards exactly once', () => {
    const all = [...(s.pyramid.flat().filter(Boolean) as Card[]), ...s.stock, ...s.waste]
    expect(all).toHaveLength(52)
    expect(new Set(all.map(fmt)).size).toBe(52)
  })
  it('GOLDEN: seed 12345 deals a known layout', () => {
    // Locked from the current deterministic deal. If this breaks, the RNG or
    // deal order changed and every downstream golden must be re-verified.
    expect(fmt(s.pyramid[0][0] as Card)).toBe('5D') // apex
    expect(fmt(s.pyramid[1][1] as Card)).toBe('13H')
    expect(fmt(s.pyramid[6][6] as Card)).toBe('13S') // bottom-right (free)
    expect(fmt(s.stock[s.stock.length - 1] as Card)).toBe('12C') // stock draw-top
  })
  it('createGame(seed) equals deal(mulberry32(seed))', () => {
    expect(createGame(SEED)).toEqual(deal(mulberry32(SEED)))
  })
})

// -- isFree / isAvailable ----------------------------------------------------

describe('isFree', () => {
  it('the bottom row is always free', () => {
    const p = emptyPyramid()
    p[6][3] = c(4, 'S')
    expect(isFree(mkState({ pyramid: p }), 6, 3)).toBe(true)
  })
  it('a card is NOT free while both coverers are present', () => {
    const p = emptyPyramid()
    p[5][0] = c(4, 'S')
    p[6][0] = c(9, 'H')
    p[6][1] = c(2, 'C')
    expect(isFree(mkState({ pyramid: p }), 5, 0)).toBe(false)
  })
  it('a card is NOT free while ONE coverer remains', () => {
    const p = emptyPyramid()
    p[5][0] = c(4, 'S')
    p[6][1] = c(2, 'C') // only the right child remains
    expect(isFree(mkState({ pyramid: p }), 5, 0)).toBe(false)
  })
  it('becomes free once BOTH coverers are removed', () => {
    const p = emptyPyramid()
    p[5][0] = c(4, 'S') // both children null
    expect(isFree(mkState({ pyramid: p }), 5, 0)).toBe(true)
  })
})

describe('isAvailable / freeCards', () => {
  it('the waste top is available; an empty waste is not', () => {
    expect(isAvailable(mkState({ waste: [c(5, 'S')] }), W)).toBe(true)
    expect(isAvailable(mkState({ waste: [] }), W)).toBe(false)
  })
  it('a covered pyramid card is unavailable; a free one is available', () => {
    const p = emptyPyramid()
    p[5][0] = c(4, 'S')
    p[6][0] = c(9, 'H')
    p[6][1] = c(2, 'C')
    const s = mkState({ pyramid: p })
    expect(isAvailable(s, P(5, 0))).toBe(false)
    expect(isAvailable(s, P(6, 0))).toBe(true)
  })
  it('freeCards lists free pyramid cards plus the waste top', () => {
    const p = emptyPyramid()
    p[5][0] = c(4, 'S') // free (its two children, [6][0] & [6][1], are null)
    p[6][2] = c(9, 'H') // bottom → free
    const s = mkState({ pyramid: p, waste: [c(7, 'D')] })
    const free = freeCards(s)
    expect(free).toContainEqual(P(5, 0))
    expect(free).toContainEqual(P(6, 2))
    expect(free).toContainEqual(W)
    expect(free).toHaveLength(3)
  })
})

// -- canPair -----------------------------------------------------------------

describe('canPair', () => {
  it('accepts two cards whose ranks sum to 13', () => {
    expect(canPair(c(5, 'S'), c(8, 'H'))).toBe(true)
    expect(canPair(c(1, 'S'), c(12, 'H'))).toBe(true) // A + Q
    expect(canPair(c(6, 'C'), c(7, 'D'))).toBe(true)
  })
  it('rejects sums other than 13 (a King has no rank-0 partner, so never pairs)', () => {
    expect(canPair(c(5, 'S'), c(5, 'H'))).toBe(false)
    expect(canPair(c(13, 'S'), c(1, 'H'))).toBe(false) // King + Ace = 14
    expect(canPair(c(13, 'S'), c(13, 'H'))).toBe(false) // two Kings = 26
    expect(canPair(c(10, 'S'), c(10, 'H'))).toBe(false)
  })
})

// -- pair --------------------------------------------------------------------

describe('pair', () => {
  it('removes two free pyramid cards summing to 13', () => {
    const p = emptyPyramid()
    p[6][0] = c(5, 'S')
    p[6][1] = c(8, 'H')
    p[6][2] = c(2, 'C') // keep the pyramid non-empty so status stays "playing"
    const s = mkState({ pyramid: p, stock: [c(9, 'D')] })
    const next = pair(s, P(6, 0), P(6, 1))
    expect(next.pyramid[6][0]).toBeNull()
    expect(next.pyramid[6][1]).toBeNull()
    expect(next.pyramid[6][2]).not.toBeNull()
    expect(next.moves).toBe(1)
    expect(next.status).toBe('playing')
  })
  it('pairs a free pyramid card with the waste top', () => {
    const p = emptyPyramid()
    p[6][0] = c(9, 'S') // 9
    p[6][1] = c(2, 'C')
    const s = mkState({ pyramid: p, waste: [c(4, 'H')], stock: [c(3, 'D')] })
    const next = pair(s, P(6, 0), W)
    expect(next.pyramid[6][0]).toBeNull()
    expect(next.waste).toHaveLength(0)
    expect(next.moves).toBe(1)
  })
  it('rejects a pair that does not sum to 13 (same ref)', () => {
    const p = emptyPyramid()
    p[6][0] = c(5, 'S')
    p[6][1] = c(5, 'H')
    const s = mkState({ pyramid: p })
    expect(pair(s, P(6, 0), P(6, 1))).toBe(s)
  })
  it('rejects pairing a COVERED card (same ref)', () => {
    const p = emptyPyramid()
    p[5][0] = c(4, 'S') // covered
    p[6][0] = c(9, 'H')
    p[6][1] = c(9, 'C') // 4 + 9 = 13, but (5,0) is covered
    const s = mkState({ pyramid: p })
    expect(pair(s, P(5, 0), P(6, 0))).toBe(s)
  })
  it('rejects pairing a target with itself (same ref)', () => {
    const p = emptyPyramid()
    p[6][0] = c(6, 'S')
    const s = mkState({ pyramid: p })
    expect(pair(s, P(6, 0), P(6, 0))).toBe(s)
  })
  it('rejects when a target has no card, e.g. empty waste (same ref)', () => {
    const p = emptyPyramid()
    p[6][0] = c(5, 'S')
    const s = mkState({ pyramid: p, waste: [] })
    expect(pair(s, P(6, 0), W)).toBe(s)
  })
  it('does not mutate the source state', () => {
    const p = emptyPyramid()
    p[6][0] = c(5, 'S')
    p[6][1] = c(8, 'H')
    p[6][2] = c(2, 'C')
    const s = mkState({ pyramid: p, stock: [c(9, 'D')] })
    pair(s, P(6, 0), P(6, 1))
    expect(s.pyramid[6][0]).not.toBeNull()
    expect(s.pyramid[6][1]).not.toBeNull()
  })
})

// -- removeKing --------------------------------------------------------------

describe('removeKing', () => {
  it('removes a free pyramid King alone', () => {
    const p = emptyPyramid()
    p[6][0] = c(13, 'S')
    p[6][1] = c(4, 'C') // keep pyramid non-empty
    const s = mkState({ pyramid: p, stock: [c(9, 'D')] })
    const next = removeKing(s, P(6, 0))
    expect(next.pyramid[6][0]).toBeNull()
    expect(next.moves).toBe(1)
    expect(next.status).toBe('playing')
  })
  it('removes a King from the waste top', () => {
    const p = emptyPyramid()
    p[6][0] = c(4, 'C')
    const s = mkState({ pyramid: p, waste: [c(13, 'H')], stock: [c(9, 'D')] })
    const next = removeKing(s, W)
    expect(next.waste).toHaveLength(0)
    expect(next.moves).toBe(1)
  })
  it('rejects a non-King (same ref)', () => {
    const p = emptyPyramid()
    p[6][0] = c(12, 'S')
    const s = mkState({ pyramid: p })
    expect(removeKing(s, P(6, 0))).toBe(s)
  })
  it('rejects a covered King (same ref)', () => {
    const p = emptyPyramid()
    p[5][0] = c(13, 'S') // covered King
    p[6][0] = c(9, 'H')
    p[6][1] = c(2, 'C')
    const s = mkState({ pyramid: p })
    expect(removeKing(s, P(5, 0))).toBe(s)
  })
})

// -- drawStock ---------------------------------------------------------------

describe('drawStock', () => {
  it('moves the top stock card to the waste and increments moves', () => {
    const p = emptyPyramid()
    p[6][0] = c(4, 'S') // keep pyramid non-empty
    const s = mkState({ pyramid: p, stock: [c(1, 'S'), c(2, 'S'), c(3, 'S')] })
    const next = drawStock(s)
    expect(next.stock).toHaveLength(2)
    expect(next.waste).toHaveLength(1)
    expect(fmt(next.waste[0])).toBe('3S') // drew the END of the stock
    expect(next.moves).toBe(1)
  })
  it('recycles the waste into the stock when a pass remains (passesLeft--)', () => {
    const p = emptyPyramid()
    p[6][0] = c(4, 'S')
    const s = mkState({ pyramid: p, stock: [], waste: [c(1, 'S'), c(2, 'S')], passesLeft: 3 })
    const next = drawStock(s)
    expect(next.stock).toHaveLength(2)
    expect(next.waste).toHaveLength(0)
    expect(next.passesLeft).toBe(2)
    expect(next.moves).toBe(1)
  })
  it('is a no-op (same ref) when the stock is empty and no pass remains', () => {
    const p = emptyPyramid()
    p[6][0] = c(4, 'S')
    const s = mkState({ pyramid: p, stock: [], waste: [c(1, 'S')], passesLeft: 1 })
    expect(drawStock(s)).toBe(s)
  })
  it('is a no-op (same ref) when both stock and waste are empty', () => {
    const p = emptyPyramid()
    p[6][0] = c(4, 'S')
    const s = mkState({ pyramid: p, stock: [], waste: [], passesLeft: 3 })
    expect(drawStock(s)).toBe(s)
  })
  it('does not mutate the source state', () => {
    const p = emptyPyramid()
    p[6][0] = c(4, 'S')
    const s = mkState({ pyramid: p, stock: [c(1, 'S'), c(2, 'S')] })
    drawStock(s)
    expect(s.stock).toHaveLength(2)
    expect(s.waste).toHaveLength(0)
  })
})

// -- win / lose / hasAnyMove -------------------------------------------------

describe('win detection', () => {
  it('clearing the final pyramid card sets status "won"', () => {
    const p = emptyPyramid()
    p[6][0] = c(5, 'S')
    p[6][1] = c(8, 'H') // last two cards, sum 13
    const s = mkState({ pyramid: p })
    const next = pair(s, P(6, 0), P(6, 1))
    expect(next.pyramid.flat().filter(Boolean)).toHaveLength(0)
    expect(next.status).toBe('won')
    expect(score(next)).toBeGreaterThan(52 - 2) // includes win bonus
  })
})

describe('lose detection', () => {
  it('sets status "lost" when the board is stuck after a move', () => {
    const p = emptyPyramid()
    p[6][0] = c(5, 'S')
    p[6][1] = c(8, 'H') // pairs to 13
    p[6][2] = c(2, 'C') // then 2 + 3 = 5, unpairable
    p[6][3] = c(3, 'D')
    const s = mkState({ pyramid: p, stock: [], waste: [], passesLeft: 1 })
    const next = pair(s, P(6, 0), P(6, 1))
    expect(next.status).toBe('lost')
  })
})

describe('hasAnyMove', () => {
  it('is true when a free King can be removed', () => {
    const p = emptyPyramid()
    p[6][0] = c(13, 'S')
    p[6][1] = c(2, 'C')
    expect(hasAnyMove(mkState({ pyramid: p, stock: [], passesLeft: 1 }))).toBe(true)
  })
  it('is false when nothing pairs and the stock is exhausted', () => {
    const p = emptyPyramid()
    p[6][0] = c(2, 'C')
    p[6][1] = c(3, 'D')
    expect(hasAnyMove(mkState({ pyramid: p, stock: [], waste: [], passesLeft: 1 }))).toBe(false)
  })
  it('is true while the stock still has cards', () => {
    const p = emptyPyramid()
    p[6][0] = c(2, 'C')
    expect(hasAnyMove(mkState({ pyramid: p, stock: [c(9, 'S')], passesLeft: 1 }))).toBe(true)
  })
})

// -- terminal no-ops ---------------------------------------------------------

describe('moves after a terminal status are no-ops (same ref)', () => {
  const p = emptyPyramid()
  p[6][0] = c(5, 'S')
  const won = mkState({ pyramid: p, waste: [c(8, 'H')], stock: [c(9, 'D')], status: 'won' })
  it('drawStock / pair / removeKing all return the same reference', () => {
    expect(drawStock(won)).toBe(won)
    expect(pair(won, P(6, 0), W)).toBe(won)
    expect(removeKing(won, P(6, 0))).toBe(won)
  })
})

// -- scoring -----------------------------------------------------------------

describe('score', () => {
  it('is 0 for a fresh deal', () => {
    expect(score(createGame(SEED))).toBe(0)
  })
  it('rises by 100 per card removed from play (monotonic)', () => {
    const p2 = emptyPyramid()
    p2[6][0] = c(5, 'S')
    p2[6][1] = c(8, 'H')
    p2[6][2] = c(2, 'C')
    const s0 = mkState({ pyramid: p2, stock: [c(9, 'D')] }) // 52 - 4 = 48 removed
    const s1 = pair(s0, P(6, 0), P(6, 1)) // two more gone
    expect(score(s1)).toBe(score(s0) + 200)
    expect(score(s1)).toBeGreaterThan(score(s0))
  })
  it('adds a completion bonus on a win', () => {
    const p = emptyPyramid()
    p[6][0] = c(5, 'S')
    p[6][1] = c(8, 'H')
    const won = pair(mkState({ pyramid: p }), P(6, 0), P(6, 1))
    expect(won.status).toBe('won')
    expect(score(won)).toBe(52 * 100 + 2000)
  })
})
