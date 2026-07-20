import { describe, it, expect } from 'vitest'
import {
  type Card,
  type State,
  type Suit,
  STOCK_SIZE,
  TABLEAU_COLS,
  TABLEAU_ROWS,
  TABLEAU_SIZE,
  createGame,
  deal,
  dealStock,
  exposed,
  hasMove,
  makeDeck,
  mulberry32,
  playColumn,
  playableColumns,
  rankAdjacent,
  score,
  shuffle,
  tableauRemaining,
} from './engine'

const SEED = 12345

// -- fixture helpers ---------------------------------------------------------

function c(rank: number, suit: Suit): Card {
  return { rank, suit }
}

/** Build a State with sensible defaults, overridable per-field. */
function mkState(over: Partial<State> = {}): State {
  return {
    tableau: Array.from({ length: TABLEAU_COLS }, () => []),
    waste: [],
    stock: [],
    status: 'playing',
    moves: 0,
    wrap: false,
    ...over,
  }
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

describe('makeDeck / shuffle', () => {
  it('produces 52 unique cards', () => {
    const deck = makeDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map(fmt)).size).toBe(52)
  })
  it('shuffle is deterministic and preserves the 52 cards', () => {
    const a = shuffle(makeDeck(), mulberry32(7)).map(fmt)
    const b = shuffle(makeDeck(), mulberry32(7)).map(fmt)
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(52)
    expect(a).not.toEqual(makeDeck().map(fmt))
  })
  it('shuffle does not mutate the input', () => {
    const deck = makeDeck()
    const snap = deck.map(fmt)
    shuffle(deck, mulberry32(1))
    expect(deck.map(fmt)).toEqual(snap)
  })
})

// -- deal (layout + golden) --------------------------------------------------

describe('deal', () => {
  const s = deal(mulberry32(SEED))

  it('lays 7 columns of 5, a 1-card waste and a 16-card stock', () => {
    expect(s.tableau).toHaveLength(TABLEAU_COLS)
    expect(s.tableau.map((col) => col.length)).toEqual([5, 5, 5, 5, 5, 5, 5])
    expect(s.tableau.flat()).toHaveLength(TABLEAU_SIZE) // 35
    expect(s.waste).toHaveLength(1)
    expect(s.stock).toHaveLength(STOCK_SIZE) // 16
  })
  it('uses all 52 cards exactly once', () => {
    const all = [...s.tableau.flat(), ...s.waste, ...s.stock]
    expect(all).toHaveLength(52)
    expect(new Set(all.map(fmt)).size).toBe(52)
  })
  it('starts playing at zero moves, classic (no wrap) by default', () => {
    expect(s.status).toBe('playing')
    expect(s.moves).toBe(0)
    expect(s.wrap).toBe(false)
  })
  it('deal(rng, true) sets wrap', () => {
    expect(deal(mulberry32(SEED), true).wrap).toBe(true)
  })
  it('GOLDEN: seed 12345 deals a known layout', () => {
    // Locked from the current deterministic deal. If this breaks, the RNG or
    // deal order changed and every downstream golden must be re-verified.
    expect(fmt(s.tableau[0][0])).toBe('5D')
    expect(fmt(exposed(s.tableau[0]) as Card)).toBe('2H') // col 0 playable card
    expect(fmt(exposed(s.tableau[6]) as Card)).toBe('11S')
    expect(fmt(s.waste[0])).toBe('5H') // initial foundation
    expect(fmt(s.stock[s.stock.length - 1])).toBe('12C') // stock deal-top
  })
  it('createGame(seed) equals deal(mulberry32(seed))', () => {
    expect(createGame(SEED)).toEqual(deal(mulberry32(SEED)))
    expect(createGame(SEED, true).wrap).toBe(true)
  })
})

// -- rankAdjacent ------------------------------------------------------------

describe('rankAdjacent (classic, no wrap)', () => {
  it('is true for a strict one-step difference either way', () => {
    expect(rankAdjacent(6, 7, false)).toBe(true)
    expect(rankAdjacent(7, 6, false)).toBe(true)
    expect(rankAdjacent(1, 2, false)).toBe(true) // Ace low ↔ 2
  })
  it('is false for equal or gap-of-two ranks', () => {
    expect(rankAdjacent(6, 6, false)).toBe(false)
    expect(rankAdjacent(5, 7, false)).toBe(false)
  })
  it('does NOT wrap: Ace is not adjacent to King', () => {
    expect(rankAdjacent(1, 13, false)).toBe(false)
    expect(rankAdjacent(13, 1, false)).toBe(false)
  })
})

describe('rankAdjacent (wrap / around-the-corner)', () => {
  it('keeps the classic one-step adjacencies', () => {
    expect(rankAdjacent(6, 7, true)).toBe(true)
    expect(rankAdjacent(7, 6, true)).toBe(true)
  })
  it('additionally allows Ace ↔ King', () => {
    expect(rankAdjacent(1, 13, true)).toBe(true)
    expect(rankAdjacent(13, 1, true)).toBe(true)
  })
  it('still rejects a gap of two', () => {
    expect(rankAdjacent(1, 12, true)).toBe(false)
    expect(rankAdjacent(2, 13, true)).toBe(false)
  })
})

// -- exposed -----------------------------------------------------------------

describe('exposed', () => {
  it('returns the last (bottom-most) card of a column', () => {
    expect(fmt(exposed([c(5, 'S'), c(6, 'H'), c(7, 'D')]) as Card)).toBe('7D')
  })
  it('returns undefined for an empty column', () => {
    expect(exposed([])).toBeUndefined()
  })
})

// -- playColumn --------------------------------------------------------------

describe('playColumn', () => {
  function oneCol(col: Card[], waste: Card[], wrap = false): State {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = col
    return mkState({ tableau: t, waste, wrap })
  }

  it('plays an exposed card one ABOVE the waste top', () => {
    const s = oneCol([c(3, 'S'), c(8, 'H')], [c(7, 'C')]) // 8 on 7
    const next = playColumn(s, 0)
    expect(next).not.toBe(s)
    expect(fmt(next.waste[next.waste.length - 1])).toBe('8H')
    expect(next.tableau[0].map(fmt)).toEqual(['3S'])
    expect(next.moves).toBe(1)
  })
  it('plays an exposed card one BELOW the waste top', () => {
    const s = oneCol([c(6, 'D')], [c(7, 'C')]) // 6 on 7
    const next = playColumn(s, 0)
    expect(fmt(next.waste[next.waste.length - 1])).toBe('6D')
    expect(next.tableau[0]).toHaveLength(0)
  })
  it('rejects a non-adjacent exposed card (same ref)', () => {
    const s = oneCol([c(4, 'S')], [c(7, 'C')])
    expect(playColumn(s, 0)).toBe(s)
  })
  it('classic: rejects a King played on an Ace (same ref)', () => {
    const s = oneCol([c(13, 'S')], [c(1, 'C')])
    expect(playColumn(s, 0)).toBe(s)
  })
  it('wrap: allows a King played on an Ace', () => {
    const s = oneCol([c(13, 'S')], [c(1, 'C')], true)
    const next = playColumn(s, 0)
    expect(next).not.toBe(s)
    expect(fmt(next.waste[next.waste.length - 1])).toBe('13S')
  })
  it('is a no-op on an empty column (same ref)', () => {
    const s = oneCol([], [c(7, 'C')])
    expect(playColumn(s, 0)).toBe(s)
  })
  it('is a no-op for an out-of-range column (same ref)', () => {
    const s = oneCol([c(6, 'D')], [c(7, 'C')])
    expect(playColumn(s, 99)).toBe(s)
    expect(playColumn(s, -1)).toBe(s)
  })
  it('does not mutate the source state', () => {
    const s = oneCol([c(6, 'D')], [c(7, 'C')])
    playColumn(s, 0)
    expect(s.tableau[0].map(fmt)).toEqual(['6D'])
    expect(s.waste.map(fmt)).toEqual(['7C'])
  })
})

// -- dealStock ---------------------------------------------------------------

describe('dealStock', () => {
  it('moves the top stock card onto the waste and increments moves', () => {
    const s = mkState({ stock: [c(2, 'S'), c(9, 'H')], waste: [c(4, 'C')] })
    const next = dealStock(s)
    expect(next.stock.map(fmt)).toEqual(['2S'])
    expect(fmt(next.waste[next.waste.length - 1])).toBe('9H')
    expect(next.moves).toBe(1)
  })
  it('is a no-op (same ref) when the stock is empty', () => {
    const s = mkState({ stock: [], waste: [c(4, 'C')], tableau: seedTableau() })
    expect(dealStock(s)).toBe(s)
  })
  it('does not mutate the source state', () => {
    const s = mkState({ stock: [c(9, 'H')], waste: [c(4, 'C')] })
    dealStock(s)
    expect(s.stock.map(fmt)).toEqual(['9H'])
    expect(s.waste.map(fmt)).toEqual(['4C'])
  })
  it('a fresh stock card can re-enable a chain', () => {
    // exposed 5 blocked by waste top 8; deal a 6 → now 5 is playable.
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(5, 'S')]
    let s: State = mkState({ tableau: t, waste: [c(8, 'C')], stock: [c(6, 'H')] })
    expect(playableColumns(s)).toEqual([])
    s = dealStock(s)
    expect(playableColumns(s)).toEqual([0])
  })
})

/** A tableau that still holds one card (keeps a state non-won). */
function seedTableau(): Card[][] {
  const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
  t[0] = [c(11, 'S')]
  return t
}

// -- playableColumns / hasMove ----------------------------------------------

describe('playableColumns / hasMove', () => {
  it('lists every column whose exposed card is adjacent to the waste top', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(8, 'S')] // adjacent (7→8)
    t[1] = [c(2, 'S')] // not adjacent
    t[2] = [c(6, 'D')] // adjacent (7→6)
    const s = mkState({ tableau: t, waste: [c(7, 'C')] })
    expect(playableColumns(s)).toEqual([0, 2])
  })
  it('hasMove is true while the stock is non-empty even if nothing is playable', () => {
    const s = mkState({ tableau: seedTableau(), waste: [c(1, 'C')], stock: [c(9, 'H')] })
    expect(playableColumns(s)).toEqual([])
    expect(hasMove(s)).toBe(true)
  })
  it('hasMove is false with an empty stock and no playable column', () => {
    const s = mkState({ tableau: seedTableau(), waste: [c(1, 'C')], stock: [] })
    expect(hasMove(s)).toBe(false)
  })
})

// -- terminal detection ------------------------------------------------------

describe('terminal status', () => {
  it('WIN: clearing the last tableau card sets status "won"', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(8, 'H')] // the only card left
    const s = mkState({ tableau: t, waste: [c(7, 'C')], stock: [c(3, 'D')] })
    const next = playColumn(s, 0)
    expect(tableauRemaining(next)).toBe(0)
    expect(next.status).toBe('won')
  })
  it('LOST: no playable column and empty stock after a deal → "lost"', () => {
    // one card (a 5) far from everything; last stock card is a King → dead.
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(5, 'S')]
    const s = mkState({ tableau: t, waste: [c(9, 'C')], stock: [c(13, 'H')] })
    const next = dealStock(s)
    expect(next.stock).toHaveLength(0)
    expect(next.status).toBe('lost')
  })
  it('still playing while a stock card remains', () => {
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(5, 'S')]
    const s = mkState({ tableau: t, waste: [c(9, 'C')], stock: [c(13, 'H'), c(2, 'D')] })
    const next = dealStock(s)
    expect(next.status).toBe('playing')
  })
  it('moves after a terminal state are no-ops (same ref)', () => {
    const won = mkState({
      tableau: Array.from({ length: TABLEAU_COLS }, () => []),
      waste: [c(4, 'C')],
      stock: [c(2, 'S')],
      status: 'won',
    })
    expect(dealStock(won)).toBe(won)
    const lost = mkState({ tableau: seedTableau(), waste: [c(1, 'C')], stock: [], status: 'lost' })
    expect(playColumn(lost, 0)).toBe(lost)
    expect(dealStock(lost)).toBe(lost)
  })
  it('a scripted clear empties the tableau column by column', () => {
    // waste 7C; columns each a single card that chains: 8,9,10 then back down.
    const t = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t[0] = [c(8, 'S')]
    t[1] = [c(9, 'H')]
    t[2] = [c(10, 'D')]
    let s: State = mkState({ tableau: t, waste: [c(7, 'C')], stock: [] })
    s = playColumn(s, 0) // 8 on 7
    s = playColumn(s, 1) // 9 on 8
    s = playColumn(s, 2) // 10 on 9
    expect(tableauRemaining(s)).toBe(0)
    expect(s.status).toBe('won')
  })
})

// -- scoring -----------------------------------------------------------------

describe('score', () => {
  it('is 0 for a fresh deal (nothing cleared)', () => {
    expect(score(createGame(SEED))).toBe(0)
  })
  it('rises by 100 per cleared tableau card (monotonic)', () => {
    const t1 = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t1[0] = Array.from({ length: TABLEAU_ROWS }, (_, i) => c(i + 1, 'S')) // 5 left → 30 cleared
    const t2 = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    t2[0] = [c(1, 'S')] // 1 left → 34 cleared
    const s1 = mkState({ tableau: t1 })
    const s2 = mkState({ tableau: t2 })
    expect(score(s1)).toBe(30 * 100)
    expect(score(s2)).toBe(34 * 100)
    expect(score(s2)).toBeGreaterThan(score(s1))
  })
  it('adds a completion bonus on a win', () => {
    const won = mkState({ tableau: Array.from({ length: TABLEAU_COLS }, () => []), status: 'won' })
    expect(score(won)).toBe(TABLEAU_SIZE * 100 + 1000)
    expect(score(won)).toBeGreaterThan(TABLEAU_SIZE * 100)
  })
})
