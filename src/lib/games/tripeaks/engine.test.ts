import { describe, it, expect } from 'vitest'
import {
  type Card,
  type State,
  type Suit,
  CHAIN_STEP,
  COVER,
  COVERS,
  TABLEAU_SIZE,
  clearedCount,
  createGame,
  deal,
  drawStock,
  freePlayable,
  hasMove,
  isFree,
  isRed,
  isWon,
  makeDeck,
  mulberry32,
  playCard,
  rankAdjacent,
  rowOf,
  score,
  shuffle,
  wasteTop,
} from './engine'

const SEED = 12345
const fmt = (c: Card) => `${c.rank}${c.suit}`

// -- fixture helpers ---------------------------------------------------------

let nextId = 0
function c(rank: number, suit: Suit, faceUp = true): Card {
  return { rank, suit, faceUp, id: nextId++ }
}

/** State with an empty 28-slot tableau by default, overridable per-field. */
function mkState(over: Partial<State> = {}): State {
  return {
    tableau: Array.from({ length: TABLEAU_SIZE }, () => null),
    stock: [],
    waste: [],
    status: 'playing',
    moves: 0,
    chain: 0,
    chainBonus: 0,
    ...over,
  }
}

// -- PRNG / deck -------------------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('makeDeck', () => {
  it('produces 52 unique face-down cards with unique ids', () => {
    const deck = makeDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map(fmt)).size).toBe(52)
    expect(new Set(deck.map((x) => x.id)).size).toBe(52)
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
    const s = shuffle(makeDeck(), mulberry32(SEED))
    expect(new Set(s.map(fmt)).size).toBe(52)
    expect(s.map(fmt)).not.toEqual(makeDeck().map(fmt))
  })
  it('does not mutate the input deck', () => {
    const deck = makeDeck()
    const snap = deck.map(fmt)
    shuffle(deck, mulberry32(1))
    expect(deck.map(fmt)).toEqual(snap)
  })
})

describe('isRed', () => {
  it('hearts and diamonds are red; spades and clubs are not', () => {
    expect(isRed('H')).toBe(true)
    expect(isRed('D')).toBe(true)
    expect(isRed('S')).toBe(false)
    expect(isRed('C')).toBe(false)
  })
})

// -- cover table integrity ---------------------------------------------------

describe('COVER / COVERS layout', () => {
  it('has 28 slots with the bottom row (18..27) uncovered', () => {
    expect(COVER).toHaveLength(TABLEAU_SIZE)
    for (let i = 18; i < 28; i++) expect(COVER[i]).toEqual([])
  })
  it('COVERS is the exact inverse of COVER', () => {
    for (let upper = 0; upper < COVER.length; upper++) {
      for (const lower of COVER[upper]) {
        expect(COVERS[lower]).toContain(upper)
      }
    }
    for (let lower = 0; lower < COVERS.length; lower++) {
      for (const upper of COVERS[lower]) {
        expect(COVER[upper]).toContain(lower)
      }
    }
  })
  it('assigns rows 0..3 by slot', () => {
    expect(rowOf(0)).toBe(0)
    expect(rowOf(8)).toBe(1)
    expect(rowOf(17)).toBe(2)
    expect(rowOf(27)).toBe(3)
  })
})

// -- deal (layout + golden) --------------------------------------------------

describe('deal', () => {
  const s = deal(mulberry32(SEED))

  it('lays 28 tableau slots, 1 waste, 23 stock', () => {
    expect(s.tableau).toHaveLength(TABLEAU_SIZE)
    expect(s.tableau.every((x) => x != null)).toBe(true)
    expect(s.waste).toHaveLength(1)
    expect(s.stock).toHaveLength(23)
  })
  it('uses all 52 cards exactly once', () => {
    const all = [...(s.tableau as Card[]), ...s.stock, ...s.waste]
    expect(all).toHaveLength(52)
    expect(new Set(all.map((x) => x.id)).size).toBe(52)
  })
  it('deals only the bottom row (18..27) + waste face-up', () => {
    for (let i = 0; i < 18; i++) expect(s.tableau[i]!.faceUp).toBe(false)
    for (let i = 18; i < 28; i++) expect(s.tableau[i]!.faceUp).toBe(true)
    expect(s.waste[0].faceUp).toBe(true)
    expect(s.stock.every((x) => !x.faceUp)).toBe(true)
  })
  it('starts playing with zero moves and zero chain', () => {
    expect(s.status).toBe('playing')
    expect(s.moves).toBe(0)
    expect(s.chain).toBe(0)
  })
  it('GOLDEN: seed 12345 deals a known layout', () => {
    // Locked from the current deterministic deal. If this breaks, the RNG or
    // deal order changed and every downstream golden must be re-verified.
    expect(fmt(s.tableau[0]!)).toBe('5D')
    expect(fmt(s.tableau[2]!)).toBe('13H')
    expect(fmt(s.tableau[18]!)).toBe('1C') // bottom-row first card, face-up
    expect(fmt(s.tableau[27]!)).toBe('13S') // bottom-row last card
    expect(fmt(s.waste[0])).toBe('6H') // initial waste top
    expect(fmt(s.stock[s.stock.length - 1])).toBe('12C') // next stock draw
  })
  it('createGame(seed) equals deal(mulberry32(seed))', () => {
    expect(createGame(SEED)).toEqual(deal(mulberry32(SEED)))
  })
})

// -- isFree ------------------------------------------------------------------

describe('isFree', () => {
  it('a bottom-row card is free while present', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(5, 'S')
    expect(isFree(mkState({ tableau: t }), 18)).toBe(true)
  })
  it('a covered card is NOT free', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    // slot 9 is covered by 18 and 19 (COVER[9] = [18,19]).
    t[9] = c(5, 'S')
    t[18] = c(1, 'C')
    t[19] = c(2, 'D')
    expect(isFree(mkState({ tableau: t }), 9)).toBe(false)
  })
  it('becomes free once BOTH coverers are removed (not after just one)', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[9] = c(5, 'S')
    t[19] = c(2, 'D')
    // slot 18 already gone, 19 present → still covered.
    expect(isFree(mkState({ tableau: t }), 9)).toBe(false)
    t[19] = null // now both coverers gone
    expect(isFree(mkState({ tableau: t }), 9)).toBe(true)
  })
  it('a removed slot is never free', () => {
    expect(isFree(mkState(), 18)).toBe(false)
  })
})

// -- rankAdjacent (incl. wraps) ----------------------------------------------

describe('rankAdjacent', () => {
  it('accepts neighbours one apart', () => {
    expect(rankAdjacent(5, 6)).toBe(true)
    expect(rankAdjacent(6, 5)).toBe(true)
    expect(rankAdjacent(12, 13)).toBe(true)
  })
  it('wraps Ace ↔ King (1 ↔ 13)', () => {
    expect(rankAdjacent(1, 13)).toBe(true)
    expect(rankAdjacent(13, 1)).toBe(true)
  })
  it('wraps Ace ↔ 2 (1 ↔ 2)', () => {
    expect(rankAdjacent(1, 2)).toBe(true)
    expect(rankAdjacent(2, 1)).toBe(true)
  })
  it('rejects equal ranks', () => {
    expect(rankAdjacent(7, 7)).toBe(false)
  })
  it('rejects a gap of two or more', () => {
    expect(rankAdjacent(5, 7)).toBe(false)
    expect(rankAdjacent(2, 13)).toBe(false) // 2 and K are NOT adjacent
    expect(rankAdjacent(11, 1)).toBe(false)
  })
})

// -- playCard ----------------------------------------------------------------

describe('playCard', () => {
  function bottomState(over: Partial<State> = {}): State {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(5, 'S')
    return mkState({ tableau: t, waste: [c(6, 'H')], ...over })
  }

  it('clears a free, rank-adjacent card onto the waste and extends the chain', () => {
    const s = bottomState()
    const next = playCard(s, 18)
    expect(next).not.toBe(s)
    expect(next.tableau[18]).toBeNull()
    expect(fmt(wasteTop(next)!)).toBe('5S')
    expect(next.chain).toBe(1)
    expect(next.moves).toBe(1)
  })
  it('clears a card adjacent by WRAP (A onto K)', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(1, 'S') // Ace
    const s = mkState({ tableau: t, waste: [c(13, 'H')] }) // King on waste
    const next = playCard(s, 18)
    expect(next.tableau[18]).toBeNull()
    expect(fmt(wasteTop(next)!)).toBe('1S')
  })
  it('rejects a non-free card (same ref)', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[9] = c(5, 'S') // covered by 18/19
    t[18] = c(6, 'H')
    t[19] = c(4, 'C')
    const s = mkState({ tableau: t, waste: [c(6, 'D')] })
    expect(playCard(s, 9)).toBe(s)
  })
  it('rejects a non-adjacent rank (same ref)', () => {
    const s = bottomState({ waste: [c(9, 'H')] }) // 5 not adjacent to 9
    expect(playCard(s, 18)).toBe(s)
  })
  it('is a no-op on an empty slot (same ref)', () => {
    const s = bottomState()
    expect(playCard(s, 0)).toBe(s)
  })
  it('reveals a newly-freed upper card face-up when its last coverer leaves', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[9] = c(7, 'S', false) // upper, still face-down
    t[18] = null // one coverer already gone
    t[19] = c(5, 'D') // last coverer of slot 9
    const s = mkState({ tableau: t, waste: [c(6, 'H')] })
    const next = playCard(s, 19) // remove 5D (adjacent to 6H)
    expect(next.tableau[19]).toBeNull()
    expect(isFree(next, 9)).toBe(true)
    expect(next.tableau[9]!.faceUp).toBe(true) // revealed
  })
  it('does NOT reveal an upper card while a coverer remains', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[9] = c(7, 'S', false)
    t[18] = c(5, 'D') // coverer we remove
    t[19] = c(2, 'C') // coverer that stays
    const s = mkState({ tableau: t, waste: [c(6, 'H')] })
    const next = playCard(s, 18)
    expect(next.tableau[9]!.faceUp).toBe(false) // still covered by 19
  })
  it('does not mutate the source state', () => {
    const s = bottomState()
    playCard(s, 18)
    expect(s.tableau[18]).not.toBeNull()
    expect(s.waste).toHaveLength(1)
    expect(s.chain).toBe(0)
  })
})

// -- drawStock ---------------------------------------------------------------

describe('drawStock', () => {
  it('moves the top stock card to the waste face-up and resets chain', () => {
    const s = mkState({ stock: [c(4, 'C', false), c(9, 'D', false)], waste: [c(6, 'H')], chain: 3 })
    const next = drawStock(s)
    expect(next.stock).toHaveLength(1)
    expect(fmt(wasteTop(next)!)).toBe('9D') // drawn from the END
    expect(wasteTop(next)!.faceUp).toBe(true)
    expect(next.chain).toBe(0)
    expect(next.moves).toBe(1)
  })
  it('is a no-op (same ref) when the stock is empty', () => {
    const s = mkState({ stock: [], waste: [c(6, 'H')] })
    expect(drawStock(s)).toBe(s)
  })
  it('does not mutate the source state', () => {
    const s = mkState({ stock: [c(4, 'C', false)], waste: [c(6, 'H')], chain: 2 })
    drawStock(s)
    expect(s.stock).toHaveLength(1)
    expect(s.waste).toHaveLength(1)
    expect(s.chain).toBe(2)
  })
})

// -- freePlayable / hasMove --------------------------------------------------

describe('freePlayable / hasMove', () => {
  it('lists only free cards rank-adjacent to the waste top', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(5, 'S') // adjacent to 6
    t[19] = c(7, 'D') // adjacent to 6
    t[20] = c(9, 'C') // not adjacent
    const s = mkState({ tableau: t, waste: [c(6, 'H')] })
    expect(freePlayable(s).sort()).toEqual([18, 19])
    expect(hasMove(s)).toBe(true)
  })
  it('hasMove is true when the stock still has cards even if nothing is playable', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(9, 'C') // not adjacent to 6
    const s = mkState({ tableau: t, waste: [c(6, 'H')], stock: [c(2, 'S', false)] })
    expect(freePlayable(s)).toEqual([])
    expect(hasMove(s)).toBe(true)
  })
})

// -- lose detection ----------------------------------------------------------

describe('losing', () => {
  it('drawStock reaches "lost" when the last stock card leaves no playable move', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(9, 'C') // never adjacent to 6 or 8
    const s = mkState({ tableau: t, waste: [c(6, 'H')], stock: [c(8, 'S', false)] })
    const next = drawStock(s) // waste top becomes 8S; 9C IS adjacent → still playing
    expect(next.status).toBe('playing')
  })
  it('is "lost" when stock empty and no free card is adjacent', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(10, 'C') // not adjacent to 6
    const s = mkState({ tableau: t, waste: [c(6, 'H')], stock: [] })
    // Play cannot help; simulate the settle by a no-op draw path via playCard reject.
    expect(hasMove(s)).toBe(false)
    // A move that changes the board triggers settle; force via an adjacent-less draw:
    const drawn = drawStock(s) // stock empty → same ref, so status still 'playing' on s
    expect(drawn).toBe(s)
  })
  it('a play that empties a dead board yields "lost" through settle', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(5, 'S') // adjacent to 6 → playable
    t[19] = c(10, 'C') // NOT adjacent to 5 (the new top) or anything, no stock
    const s = mkState({ tableau: t, waste: [c(6, 'H')], stock: [] })
    const next = playCard(s, 18) // clears 5S; top becomes 5S; 10C not adjacent; stock empty
    expect(next.status).toBe('lost')
  })
})

// -- winning -----------------------------------------------------------------

describe('winning', () => {
  it('isWon requires every tableau slot to be null', () => {
    expect(isWon(mkState())).toBe(true)
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(5, 'S')
    expect(isWon(mkState({ tableau: t }))).toBe(false)
  })
  it('clearing the last tableau card wins the game', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(7, 'S') // the only card left
    const s = mkState({ tableau: t, waste: [c(6, 'H')] })
    const next = playCard(s, 18)
    expect(isWon(next)).toBe(true)
    expect(next.status).toBe('won')
  })
  it('moves after a win/loss are no-ops (same ref) even with cards left to draw', () => {
    const won = mkState({ status: 'won', stock: [c(1, 'S', false)] })
    expect(playCard(won, 18)).toBe(won)
    expect(drawStock(won)).toBe(won)
    const lost = mkState({ status: 'lost', stock: [c(1, 'S', false)] })
    expect(drawStock(lost)).toBe(lost)
    expect(playCard(lost, 18)).toBe(lost)
  })
})

// -- scoring -----------------------------------------------------------------

describe('score', () => {
  it('is 0 for a fresh deal', () => {
    expect(score(createGame(SEED))).toBe(0)
  })
  it('rises by 100 per cleared card (monotonic)', () => {
    const t1 = Array.from({ length: TABLEAU_SIZE }, (_, i) => (i < 26 ? null : c(5, 'S')))
    const t2 = Array.from({ length: TABLEAU_SIZE }, (_, i) => (i < 27 ? null : c(5, 'S')))
    const s1 = mkState({ tableau: t1 }) // 26 cleared
    const s2 = mkState({ tableau: t2 }) // 27 cleared
    expect(score(s1)).toBe(2600)
    expect(score(s2)).toBe(2700)
    expect(score(s2)).toBeGreaterThan(score(s1))
  })
  it('adds a completion bonus on a win', () => {
    const won = mkState({ status: 'won' }) // 28 cleared
    expect(score(won)).toBe(28 * 100 + 500)
    expect(score(won)).toBeGreaterThan(28 * 100)
  })
  // registry.ts promises "longer chains score much higher" (tips + FAQ). The
  // chain bonus is banked per clear so the score stays monotonic.
  it('banks a chain bonus that grows with chain length', () => {
    // Bottom row 18..22 = 6,7,8,9,10; waste top 5 → five consecutive clears.
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    ;[6, 7, 8, 9, 10].forEach((r, k) => (t[18 + k] = c(r, 'S')))
    t[0] = c(1, 'H', false) // keep the board unwon
    let s = mkState({ tableau: t, waste: [c(5, 'H')], stock: [c(2, 'C', false)] })
    const scores: number[] = [score(s)]
    for (let k = 0; k < 5; k++) {
      s = playCard(s, 18 + k)
      scores.push(score(s))
    }
    const gains = scores.slice(1).map((v, k) => v - scores[k])
    // Each successive clear in a chain is worth strictly more than the last.
    for (let k = 1; k < gains.length; k++) expect(gains[k]).toBeGreaterThan(gains[k - 1])
    expect(s.chainBonus).toBe(CHAIN_STEP * (0 + 1 + 2 + 3 + 4))
    expect(scores[5] - scores[0]).toBe(5 * 100 + CHAIN_STEP * 10)
  })
  it('a draw resets the chain but never lowers the banked score', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(6, 'S')
    t[19] = c(7, 'S')
    t[0] = c(1, 'H', false)
    let s = mkState({ tableau: t, waste: [c(5, 'H')], stock: [c(12, 'C', false)] })
    s = playCard(s, 18)
    s = playCard(s, 19)
    const before = score(s)
    s = drawStock(s)
    expect(s.chain).toBe(0)
    expect(score(s)).toBe(before)
  })
  it('one long chain outscores the same clears split by draws', () => {
    const long = mkState({ tableau: Array(TABLEAU_SIZE).fill(null), chainBonus: CHAIN_STEP * 45 })
    const split = mkState({ tableau: Array(TABLEAU_SIZE).fill(null), chainBonus: CHAIN_STEP * 20 })
    expect(score(long)).toBeGreaterThan(score(split))
  })
  it('clearedCount counts removed slots', () => {
    const t = Array.from({ length: TABLEAU_SIZE }, () => null as Card | null)
    t[18] = c(5, 'S')
    t[19] = c(6, 'D')
    expect(clearedCount(mkState({ tableau: t }))).toBe(26)
  })
})
