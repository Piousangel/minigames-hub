import { describe, it, expect } from 'vitest'
import {
  type Card,
  type State,
  type Suit,
  type SuitCount,
  DEAL_SIZES,
  SETS_TO_WIN,
  SUITS,
  TABLEAU_COLS,
  TOTAL_CARDS,
  canLand,
  canMoveRun,
  completedRunStart,
  createGame,
  deal,
  dealFromStock,
  isRed,
  isWon,
  makeDeck,
  moveRun,
  mulberry32,
  score,
  shuffle,
  suitsFor,
} from './engine'

const SEED = 12345

// -- fixture helpers ---------------------------------------------------------

/** Build a card (face-up by default). */
function c(rank: number, suit: Suit, faceUp = true): Card {
  return { rank, suit, faceUp }
}

/** A descending same-suit run from `hi` down to `lo` (face-up). */
function run(hi: number, lo: number, suit: Suit): Card[] {
  const out: Card[] = []
  for (let r = hi; r >= lo; r--) out.push(c(r, suit))
  return out
}

/** Build a State with sensible empty defaults, overridable per-field. */
function mkState(over: Partial<State> = {}): State {
  return {
    tableau: Array.from({ length: TABLEAU_COLS }, () => []),
    stock: [],
    completed: 0,
    status: 'playing',
    moves: 0,
    suitCount: 1,
    ...over,
  }
}

// ---------------------------------------------------------------------------
// PRNG + deck
// ---------------------------------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(SEED)
    const b = mulberry32(SEED)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('returns floats in [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('isRed', () => {
  it('classifies hearts and diamonds red, spades/clubs black', () => {
    expect(isRed('H')).toBe(true)
    expect(isRed('D')).toBe(true)
    expect(isRed('S')).toBe(false)
    expect(isRed('C')).toBe(false)
  })
})

describe('suitsFor', () => {
  it('returns the right suits per difficulty', () => {
    expect(suitsFor(1)).toEqual(['S'])
    expect(suitsFor(2)).toEqual(['S', 'H'])
    expect(suitsFor(4)).toEqual(['S', 'H', 'D', 'C'])
  })
})

describe('makeDeck composition', () => {
  for (const sc of [1, 2, 4] as SuitCount[]) {
    it(`builds exactly 104 cards for ${sc}-suit`, () => {
      expect(makeDeck(sc)).toHaveLength(TOTAL_CARDS)
    })

    it(`uses only the allowed suits for ${sc}-suit`, () => {
      const deck = makeDeck(sc)
      const used = new Set(deck.map((x) => x.suit))
      expect([...used].sort()).toEqual(suitsFor(sc).slice().sort())
    })

    it(`has correct rank multiplicity for ${sc}-suit`, () => {
      const deck = makeDeck(sc)
      const copies = TOTAL_CARDS / (sc * 13) // 8 / 4 / 2
      // Each (suit,rank) appears exactly `copies` times.
      for (const suit of suitsFor(sc)) {
        for (let rank = 1; rank <= 13; rank++) {
          const n = deck.filter((x) => x.suit === suit && x.rank === rank).length
          expect(n).toBe(copies)
        }
      }
    })
  }

  it('starts all cards face-down', () => {
    expect(makeDeck(4).every((x) => !x.faceUp)).toBe(true)
  })
})

describe('shuffle', () => {
  it('preserves the multiset and does not mutate input', () => {
    const deck = makeDeck(4)
    const before = deck.map((x) => `${x.rank}${x.suit}`).sort()
    const out = shuffle(deck, mulberry32(SEED))
    expect(out).toHaveLength(TOTAL_CARDS)
    expect(out.map((x) => `${x.rank}${x.suit}`).sort()).toEqual(before)
    // input untouched
    expect(deck.map((x) => `${x.rank}${x.suit}`).sort()).toEqual(before)
  })

  it('is deterministic for a fixed seed', () => {
    const a = shuffle(makeDeck(4), mulberry32(SEED))
    const b = shuffle(makeDeck(4), mulberry32(SEED))
    expect(a).toEqual(b)
  })
})

// ---------------------------------------------------------------------------
// deal — golden
// ---------------------------------------------------------------------------

describe('deal', () => {
  for (const sc of [1, 2, 4] as SuitCount[]) {
    const s = deal(mulberry32(SEED), sc)

    it(`deals 54 to the tableau and leaves 50 in stock (${sc}-suit)`, () => {
      const dealt = s.tableau.reduce((n, col) => n + col.length, 0)
      expect(dealt).toBe(54)
      expect(s.stock).toHaveLength(50)
    })

    it(`gives columns 0–3 six cards and 4–9 five (${sc}-suit)`, () => {
      expect(s.tableau.map((col) => col.length)).toEqual([...DEAL_SIZES])
    })

    it(`exposes exactly the top card of each column face-up (${sc}-suit)`, () => {
      for (const col of s.tableau) {
        expect(col.filter((x) => x.faceUp)).toHaveLength(1)
        expect(col[col.length - 1].faceUp).toBe(true)
      }
    })

    it(`keeps the whole stock face-down (${sc}-suit)`, () => {
      expect(s.stock.every((x) => !x.faceUp)).toBe(true)
    })

    it(`preserves the full 104-card multiset (${sc}-suit)`, () => {
      const all = [...s.tableau.flat(), ...s.stock]
      expect(all).toHaveLength(TOTAL_CARDS)
    })

    it(`records suitCount and starts playing (${sc}-suit)`, () => {
      expect(s.suitCount).toBe(sc)
      expect(s.status).toBe('playing')
      expect(s.moves).toBe(0)
      expect(s.completed).toBe(0)
    })
  }

  it('is a byte-stable golden deal for seed 12345, 1-suit', () => {
    const s = deal(mulberry32(SEED), 1)
    // Known cards from the fixed seed (all Spades for 1-suit).
    expect(s.tableau[0][s.tableau[0].length - 1]).toEqual(c(2, 'S', true))
    expect(s.tableau[0][0]).toEqual(c(4, 'S', false))
    expect(s.tableau[4][s.tableau[4].length - 1]).toEqual(c(5, 'S', true))
    expect(s.stock[0]).toEqual(c(4, 'S', false))
  })

  it('createGame(seed, suitCount) matches deal(mulberry32(seed), suitCount)', () => {
    expect(createGame(SEED, 2)).toEqual(deal(mulberry32(SEED), 2))
  })
})

// ---------------------------------------------------------------------------
// canMoveRun — the movable-run rule
// ---------------------------------------------------------------------------

describe('canMoveRun', () => {
  it('accepts a single face-up card', () => {
    expect(canMoveRun([c(7, 'S')])).toBe(true)
  })

  it('accepts a same-suit descending run', () => {
    expect(canMoveRun(run(9, 5, 'H'))).toBe(true)
    expect(canMoveRun([c(13, 'C'), c(12, 'C'), c(11, 'C')])).toBe(true)
  })

  it('rejects a mixed-suit run even if descending', () => {
    expect(canMoveRun([c(9, 'S'), c(8, 'H'), c(7, 'S')])).toBe(false)
    expect(canMoveRun([c(6, 'C'), c(5, 'C'), c(4, 'D')])).toBe(false)
  })

  it('rejects a broken (non-consecutive) descending sequence', () => {
    expect(canMoveRun([c(9, 'S'), c(7, 'S')])).toBe(false)
  })

  it('rejects an ascending sequence', () => {
    expect(canMoveRun([c(5, 'S'), c(6, 'S')])).toBe(false)
  })

  it('rejects a run containing a face-down card', () => {
    expect(canMoveRun([c(9, 'S'), c(8, 'S', false)])).toBe(false)
    expect(canMoveRun([c(9, 'S', false)])).toBe(false)
  })

  it('rejects an empty run', () => {
    expect(canMoveRun([])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canLand — landing rule (rank+1, any suit; empty accepts anything)
// ---------------------------------------------------------------------------

describe('canLand', () => {
  it('accepts landing on a card exactly one rank higher, any suit', () => {
    expect(canLand(c(6, 'S'), c(7, 'S'))).toBe(true)
    expect(canLand(c(6, 'S'), c(7, 'H'))).toBe(true) // any suit allowed
    expect(canLand(c(12, 'C'), c(13, 'D'))).toBe(true)
  })

  it('accepts landing on an empty column (undefined top)', () => {
    expect(canLand(c(13, 'S'), undefined)).toBe(true)
    expect(canLand(c(4, 'H'), undefined)).toBe(true)
  })

  it('rejects landing on an equal or lower rank', () => {
    expect(canLand(c(7, 'S'), c(7, 'S'))).toBe(false)
    expect(canLand(c(7, 'S'), c(6, 'S'))).toBe(false)
  })

  it('rejects landing on a rank more than one higher', () => {
    expect(canLand(c(5, 'S'), c(7, 'S'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// completedRunStart
// ---------------------------------------------------------------------------

describe('completedRunStart', () => {
  it('finds a full K→A same-suit run at the tail', () => {
    const col = [c(9, 'S', false), ...run(13, 1, 'S')]
    expect(completedRunStart(col)).toBe(1)
  })

  it('ignores a run shorter than 13', () => {
    expect(completedRunStart(run(13, 2, 'S'))).toBe(-1)
  })

  it('rejects a mixed-suit K→A tail', () => {
    const col = run(13, 1, 'S')
    col[5] = c(col[5].rank, 'H') // swap one suit
    expect(completedRunStart(col)).toBe(-1)
  })

  it('rejects when a card in the run is face-down', () => {
    const col = run(13, 1, 'S')
    col[3].faceUp = false
    expect(completedRunStart(col)).toBe(-1)
  })

  it('rejects a broken (non-K-to-A) 13-card tail', () => {
    const col = [c(13, 'S'), ...run(13, 2, 'S')] // starts 13,13,12,...
    expect(completedRunStart(col)).toBe(-1)
  })
})

// ---------------------------------------------------------------------------
// moveRun
// ---------------------------------------------------------------------------

describe('moveRun', () => {
  it('moves a legal same-suit run onto a valid destination', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    tableau[0] = [c(10, 'S', false), c(8, 'S'), c(7, 'S')]
    tableau[1] = [c(9, 'H')]
    const s = mkState({ tableau })
    const next = moveRun(s, 0, 1, 1) // move 8,7 (spades) onto 9H
    expect(next).not.toBe(s)
    expect(next.tableau[1].map((x) => `${x.rank}${x.suit}`)).toEqual(['9H', '8S', '7S'])
    expect(next.moves).toBe(1)
    // exposed card of source flips up
    expect(next.tableau[0]).toHaveLength(1)
    expect(next.tableau[0][0].faceUp).toBe(true)
  })

  it('moves onto an empty column (any rank head)', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    tableau[0] = [c(6, 'S'), c(5, 'S')]
    const s = mkState({ tableau })
    const next = moveRun(s, 0, 0, 3)
    expect(next.tableau[3].map((x) => x.rank)).toEqual([6, 5])
    expect(next.tableau[0]).toHaveLength(0)
  })

  it('rejects moving a mixed-suit run (no-op, same ref)', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    tableau[0] = [c(8, 'S'), c(7, 'H')] // not same-suit
    tableau[1] = [c(9, 'S')]
    const s = mkState({ tableau })
    expect(moveRun(s, 0, 0, 1)).toBe(s)
  })

  it('rejects landing on a non-matching rank (no-op, same ref)', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    tableau[0] = [c(5, 'S')]
    tableau[1] = [c(9, 'S')] // 5 cannot land on 9
    const s = mkState({ tableau })
    expect(moveRun(s, 0, 0, 1)).toBe(s)
  })

  it('rejects picking a run whose head is face-down (no-op)', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    tableau[0] = [c(5, 'S', false)]
    tableau[1] = [c(6, 'S')]
    const s = mkState({ tableau })
    expect(moveRun(s, 0, 0, 1)).toBe(s)
  })

  it('rejects fromCol === toCol', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    tableau[0] = [c(5, 'S')]
    const s = mkState({ tableau })
    expect(moveRun(s, 0, 0, 0)).toBe(s)
  })

  it('rejects out-of-range columns and indices', () => {
    const s = mkState({ tableau: [[c(5, 'S')], ...Array.from({ length: 9 }, () => [] as Card[])] })
    expect(moveRun(s, -1, 0, 1)).toBe(s)
    expect(moveRun(s, 0, 0, 99)).toBe(s)
    expect(moveRun(s, 0, 5, 1)).toBe(s) // bad index
  })

  it('does nothing once the game is won', () => {
    const s = mkState({ status: 'won', tableau: [[c(5, 'S')], [c(6, 'S')], ...Array.from({ length: 8 }, () => [] as Card[])] })
    expect(moveRun(s, 0, 0, 1)).toBe(s)
  })

  it('auto-removes a completed K→A run, increments completed, and flips the exposed card', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    // Column 1 already holds K..2 spades; a face-down card sits beneath.
    tableau[1] = [c(9, 'H', false), ...run(13, 2, 'S')]
    // Column 0 holds the Ace of spades to complete it.
    tableau[0] = [c(7, 'C', false), c(1, 'S')]
    const s = mkState({ tableau })
    const next = moveRun(s, 0, 1, 1) // drop AS onto 2S → completes K..A
    expect(next.completed).toBe(1)
    // The completed 13 are gone; only the buried card remains, now face-up.
    expect(next.tableau[1]).toHaveLength(1)
    expect(next.tableau[1][0]).toEqual(c(9, 'H', true))
    expect(next.status).toBe('playing')
  })
})

// ---------------------------------------------------------------------------
// dealFromStock
// ---------------------------------------------------------------------------

describe('dealFromStock', () => {
  it('deals one face-up card to every column and shrinks the stock by 10', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, (_, i) => [c(13 - (i % 5), 'S', false)])
    const stock = Array.from({ length: 20 }, (_, i) => c((i % 13) + 1, 'S', false))
    const s = mkState({ tableau, stock })
    const next = dealFromStock(s)
    expect(next).not.toBe(s)
    expect(next.stock).toHaveLength(10)
    for (let col = 0; col < TABLEAU_COLS; col++) {
      expect(next.tableau[col]).toHaveLength(2)
      expect(next.tableau[col][1].faceUp).toBe(true) // freshly dealt card is up
    }
    expect(next.moves).toBe(1)
  })

  it('is REJECTED (same ref) when ANY column is empty', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [c(5, 'S')])
    tableau[7] = [] // one empty column
    const stock = Array.from({ length: 10 }, () => c(3, 'S', false))
    const s = mkState({ tableau, stock })
    expect(dealFromStock(s)).toBe(s)
  })

  it('is REJECTED (same ref) when the stock is empty', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [c(5, 'S')])
    const s = mkState({ tableau, stock: [] })
    expect(dealFromStock(s)).toBe(s)
  })

  it('is REJECTED (same ref) when the stock has fewer than 10 cards', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [c(5, 'S')])
    const stock = Array.from({ length: 9 }, () => c(3, 'S', false))
    const s = mkState({ tableau, stock })
    expect(dealFromStock(s)).toBe(s)
  })

  it('gives cards to columns in order (col i ← stock[i])', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [c(5, 'S', false)])
    const stock = Array.from({ length: 10 }, (_, i) => c(i + 1, 'S', false))
    const s = mkState({ tableau, stock })
    const next = dealFromStock(s)
    for (let col = 0; col < TABLEAU_COLS; col++) {
      expect(next.tableau[col][1].rank).toBe(col + 1)
    }
  })

  it('auto-completes a set when the dealt Ace finishes a K→2 column', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [c(5, 'S', false)])
    // Column 3 is K..2 spades waiting for the Ace.
    tableau[3] = [c(6, 'H', false), ...run(13, 2, 'S')]
    // Arrange stock so column 3 receives the Ace of spades.
    const stock: Card[] = []
    for (let i = 0; i < 10; i++) stock.push(i === 3 ? c(1, 'S', false) : c(9, 'H', false))
    const s = mkState({ tableau, stock })
    const next = dealFromStock(s)
    expect(next.completed).toBe(1)
    expect(next.tableau[3]).toHaveLength(1)
    expect(next.tableau[3][0]).toEqual(c(6, 'H', true))
  })

  it('does nothing once the game is won', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [c(5, 'S')])
    const stock = Array.from({ length: 10 }, () => c(3, 'S', false))
    const s = mkState({ tableau, stock, status: 'won' })
    expect(dealFromStock(s)).toBe(s)
  })
})

// ---------------------------------------------------------------------------
// win / scoring
// ---------------------------------------------------------------------------

describe('isWon / status', () => {
  it('isWon is true only at 8 completed sets', () => {
    expect(isWon(mkState({ completed: 7 }))).toBe(false)
    expect(isWon(mkState({ completed: 8 }))).toBe(true)
  })

  it('reaches status "won" when the 8th set completes (scripted near-win)', () => {
    const tableau = Array.from({ length: TABLEAU_COLS }, () => [] as Card[])
    // 7 sets already home; column 1 is K..2 spades, column 0 holds the last Ace.
    tableau[1] = run(13, 2, 'S')
    tableau[0] = [c(1, 'S')]
    const s = mkState({ tableau, completed: SETS_TO_WIN - 1 })
    const next = moveRun(s, 0, 0, 1) // AS onto 2S → 8th set
    expect(next.completed).toBe(SETS_TO_WIN)
    expect(next.status).toBe('won')
    expect(isWon(next)).toBe(true)
  })
})

describe('score', () => {
  it('is 0 with no progress', () => {
    expect(score(mkState())).toBe(0)
  })

  it('awards 1000 per completed set', () => {
    expect(score(mkState({ completed: 3 }))).toBe(3000)
  })

  it('adds a 2000 win bonus when won', () => {
    expect(score(mkState({ completed: 8, status: 'won' }))).toBe(10000)
  })

  it('is monotonic non-decreasing as sets complete', () => {
    let prev = -1
    for (let k = 0; k <= 8; k++) {
      const cur = score(mkState({ completed: k }))
      expect(cur).toBeGreaterThan(prev)
      prev = cur
    }
    // the win bonus keeps it strictly higher at the end
    expect(score(mkState({ completed: 8, status: 'won' }))).toBeGreaterThan(
      score(mkState({ completed: 8 })),
    )
  })
})

// ---------------------------------------------------------------------------
// integration: a few real moves from a fixed deal stay consistent
// ---------------------------------------------------------------------------

describe('integration', () => {
  it('a fresh deal never has an illegal movable run exposed as multi-card', () => {
    const s = deal(mulberry32(SEED), 1)
    // every column shows exactly one face-up card, so its movable run is length 1
    for (let col = 0; col < TABLEAU_COLS; col++) {
      const faceUp = s.tableau[col].filter((x) => x.faceUp)
      expect(canMoveRun(faceUp)).toBe(true)
      expect(faceUp).toHaveLength(1)
    }
  })

  it('SUITS constant and TABLEAU_COLS are the expected shape', () => {
    expect(SUITS).toEqual(['S', 'H', 'D', 'C'])
    expect(TABLEAU_COLS).toBe(10)
  })
})
