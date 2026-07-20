import { describe, it, expect } from 'vitest'
import {
  type Card,
  type State,
  type Suit,
  CASCADE_COLS,
  FREE_CELLS,
  SUITS,
  autoToFoundations,
  canGoFoundation,
  canStackCascade,
  cascadeToCascade,
  cascadeToFoundation,
  color,
  createGame,
  deal,
  emptyCascades,
  emptyFreeCells,
  foundationCardCount,
  foundationTop,
  freeCellToCascade,
  freeCellToFoundation,
  isRed,
  isSequence,
  isWon,
  makeDeck,
  maxSupermove,
  mulberry32,
  score,
  shuffle,
  suitIndex,
  toFreeCell,
} from './engine'

const SEED = 12345

// -- fixture helpers ---------------------------------------------------------

function c(rank: number, suit: Suit): Card {
  return { rank, suit }
}

function mkState(over: Partial<State> = {}): State {
  return {
    cascades: Array.from({ length: CASCADE_COLS }, () => []),
    freeCells: Array.from({ length: FREE_CELLS }, () => null),
    foundations: [[], [], [], []],
    status: 'playing',
    moves: 0,
    ...over,
  }
}

function key(card: Card): string {
  return `${card.rank}${card.suit}`
}

// -- PRNG / deck -------------------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(SEED)
    const b = mulberry32(SEED)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('returns floats in [0,1)', () => {
    const r = mulberry32(1)
    for (let i = 0; i < 100; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('makeDeck', () => {
  it('produces 52 unique cards', () => {
    const deck = makeDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map(key)).size).toBe(52)
  })
})

describe('shuffle', () => {
  it('is deterministic for a given seed', () => {
    const a = shuffle(makeDeck(), mulberry32(SEED))
    const b = shuffle(makeDeck(), mulberry32(SEED))
    expect(a.map(key)).toEqual(b.map(key))
  })

  it('does not mutate the input deck and stays a permutation', () => {
    const deck = makeDeck()
    const before = deck.map(key)
    const out = shuffle(deck, mulberry32(7))
    expect(deck.map(key)).toEqual(before)
    expect(new Set(out.map(key)).size).toBe(52)
  })
})

// -- Card helpers ------------------------------------------------------------

describe('card colour helpers', () => {
  it('isRed only for hearts and diamonds', () => {
    expect(isRed('H')).toBe(true)
    expect(isRed('D')).toBe(true)
    expect(isRed('S')).toBe(false)
    expect(isRed('C')).toBe(false)
  })

  it('color maps suits to red/black', () => {
    expect(color('H')).toBe('red')
    expect(color('S')).toBe('black')
  })

  it('suitIndex follows SUITS order', () => {
    SUITS.forEach((s, i) => expect(suitIndex(s)).toBe(i))
  })
})

// -- Deal --------------------------------------------------------------------

describe('deal', () => {
  it('lays out 8 cascades: cols 0–3 get 7, cols 4–7 get 6', () => {
    const s = deal(mulberry32(SEED))
    expect(s.cascades).toHaveLength(8)
    expect(s.cascades.slice(0, 4).map((c) => c.length)).toEqual([7, 7, 7, 7])
    expect(s.cascades.slice(4, 8).map((c) => c.length)).toEqual([6, 6, 6, 6])
  })

  it('deals all 52 cards, uniquely, face-up (no free cells / foundations)', () => {
    const s = deal(mulberry32(SEED))
    const all = s.cascades.flat()
    expect(all).toHaveLength(52)
    expect(new Set(all.map(key)).size).toBe(52)
    expect(s.freeCells).toEqual([null, null, null, null])
    expect(s.foundations).toEqual([[], [], [], []])
    expect(s.status).toBe('playing')
    expect(s.moves).toBe(0)
  })

  it('GOLDEN: seed 12345 lands known cards in known slots', () => {
    const s = deal(mulberry32(SEED))
    expect(s.cascades[0][0]).toEqual(c(5, 'D'))
    expect(s.cascades[0][s.cascades[0].length - 1]).toEqual(c(2, 'C'))
    expect(s.cascades[7][s.cascades[7].length - 1]).toEqual(c(11, 'C'))
  })

  it('createGame is deterministic (rng consumed only at deal)', () => {
    const a = createGame(SEED)
    const b = createGame(SEED)
    expect(a.cascades.flat().map(key)).toEqual(b.cascades.flat().map(key))
  })
})

// -- Foundation rule ---------------------------------------------------------

describe('canGoFoundation', () => {
  it('empty foundation accepts only an Ace', () => {
    expect(canGoFoundation(c(1, 'S'), undefined)).toBe(true)
    expect(canGoFoundation(c(2, 'S'), undefined)).toBe(false)
    expect(canGoFoundation(c(13, 'H'), undefined)).toBe(false)
  })

  it('accepts the next rank of the same suit', () => {
    expect(canGoFoundation(c(2, 'S'), c(1, 'S'))).toBe(true)
    expect(canGoFoundation(c(13, 'H'), c(12, 'H'))).toBe(true)
  })

  it('rejects the wrong suit', () => {
    expect(canGoFoundation(c(2, 'H'), c(1, 'S'))).toBe(false)
  })

  it('rejects a rank skip or same rank', () => {
    expect(canGoFoundation(c(3, 'S'), c(1, 'S'))).toBe(false)
    expect(canGoFoundation(c(1, 'S'), c(1, 'S'))).toBe(false)
  })
})

// -- Cascade stacking rule ---------------------------------------------------

describe('canStackCascade', () => {
  it('allows one lower onto opposite colour', () => {
    expect(canStackCascade(c(6, 'H'), c(7, 'S'))).toBe(true) // red on black
    expect(canStackCascade(c(6, 'S'), c(7, 'H'))).toBe(true) // black on red
  })

  it('rejects same colour', () => {
    expect(canStackCascade(c(6, 'H'), c(7, 'D'))).toBe(false)
    expect(canStackCascade(c(6, 'S'), c(7, 'C'))).toBe(false)
  })

  it('rejects non-descending', () => {
    expect(canStackCascade(c(7, 'H'), c(7, 'S'))).toBe(false)
    expect(canStackCascade(c(5, 'H'), c(7, 'S'))).toBe(false)
  })
})

describe('isSequence', () => {
  it('accepts a descending alternating run', () => {
    expect(isSequence([c(8, 'H'), c(7, 'S'), c(6, 'H'), c(5, 'S')])).toBe(true)
  })

  it('accepts a single card and rejects empty', () => {
    expect(isSequence([c(5, 'D')])).toBe(true)
    expect(isSequence([])).toBe(false)
  })

  it('rejects a same-colour break', () => {
    expect(isSequence([c(8, 'H'), c(7, 'D')])).toBe(false)
  })

  it('rejects a rank break', () => {
    expect(isSequence([c(8, 'H'), c(6, 'S')])).toBe(false)
  })
})

// -- Supermove math (the #1 FreeCell bug) ------------------------------------

describe('maxSupermove', () => {
  it('4 free cells, 0 empty columns → 5', () => {
    const padded = mkState({
      cascades: Array.from({ length: CASCADE_COLS }, () => [c(1, 'S')]),
    })
    expect(emptyFreeCells(padded)).toBe(4)
    expect(emptyCascades(padded)).toBe(0)
    expect(maxSupermove(padded, false)).toBe(5)
  })

  it('0 free cells, 0 empty columns → 1', () => {
    const s = mkState({
      freeCells: [c(1, 'S'), c(2, 'S'), c(3, 'S'), c(4, 'S')],
      cascades: Array.from({ length: CASCADE_COLS }, () => [c(5, 'S')]),
    })
    expect(maxSupermove(s, false)).toBe(1)
  })

  it('2 free cells + 1 other empty column → 6 to a non-empty col', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [c(9, 'S')])
    cascades[7] = [] // one empty column
    const s = mkState({ freeCells: [null, null, c(1, 'S'), c(2, 'S')], cascades })
    expect(emptyFreeCells(s)).toBe(2)
    expect(emptyCascades(s)).toBe(1)
    expect(maxSupermove(s, false)).toBe(6) // (2+1) * 2^1
  })

  it('2 free cells + 1 empty column → only 3 when moving TO the empty col', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [c(9, 'S')])
    cascades[7] = []
    const s = mkState({ freeCells: [null, null, c(1, 'S'), c(2, 'S')], cascades })
    expect(maxSupermove(s, true)).toBe(3) // (2+1) * 2^(1-1)
  })

  it('never lets the exponent go negative', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [c(9, 'S')])
    cascades[7] = []
    const s = mkState({ freeCells: [c(1, 'S'), c(2, 'S'), c(3, 'S'), c(4, 'S')], cascades })
    // 0 free, 1 empty, moving to it → (0+1)*2^0 = 1
    expect(maxSupermove(s, true)).toBe(1)
  })
})

// -- toFreeCell --------------------------------------------------------------

describe('toFreeCell', () => {
  it('moves the top card into the first empty cell', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [] as Card[])
    cascades[0] = [c(9, 'S'), c(4, 'H')]
    const s = mkState({ cascades })
    const next = toFreeCell(s, 0)
    expect(next).not.toBe(s)
    expect(next.freeCells[0]).toEqual(c(4, 'H'))
    expect(next.cascades[0]).toEqual([c(9, 'S')])
    expect(next.moves).toBe(1)
  })

  it('is a no-op (same ref) when all free cells are full', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [] as Card[])
    cascades[0] = [c(4, 'H')]
    const s = mkState({ freeCells: [c(1, 'S'), c(2, 'S'), c(3, 'S'), c(4, 'S')], cascades })
    expect(toFreeCell(s, 0)).toBe(s)
  })

  it('is a no-op (same ref) for an empty column', () => {
    const s = mkState()
    expect(toFreeCell(s, 0)).toBe(s)
  })
})

// -- free cell moves ---------------------------------------------------------

describe('freeCellToFoundation', () => {
  it('sends an Ace home from a free cell', () => {
    const s = mkState({ freeCells: [c(1, 'S'), null, null, null] })
    const next = freeCellToFoundation(s, 0)
    expect(next.freeCells[0]).toBeNull()
    expect(foundationTop(next, 'S')).toEqual(c(1, 'S'))
  })

  it('is a no-op (same ref) for an illegal foundation move', () => {
    const s = mkState({ freeCells: [c(5, 'S'), null, null, null] })
    expect(freeCellToFoundation(s, 0)).toBe(s)
  })

  it('is a no-op (same ref) for an empty cell', () => {
    const s = mkState()
    expect(freeCellToFoundation(s, 0)).toBe(s)
  })
})

describe('freeCellToCascade', () => {
  it('drops onto a legal cascade top', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [] as Card[])
    cascades[0] = [c(7, 'S')]
    const s = mkState({ freeCells: [c(6, 'H'), null, null, null], cascades })
    const next = freeCellToCascade(s, 0, 0)
    expect(next.freeCells[0]).toBeNull()
    expect(next.cascades[0]).toEqual([c(7, 'S'), c(6, 'H')])
  })

  it('drops onto an empty cascade', () => {
    const s = mkState({ freeCells: [c(6, 'H'), null, null, null] })
    const next = freeCellToCascade(s, 0, 3)
    expect(next.cascades[3]).toEqual([c(6, 'H')])
  })

  it('is a no-op (same ref) for an illegal landing', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [] as Card[])
    cascades[0] = [c(7, 'S')]
    const s = mkState({ freeCells: [c(6, 'S'), null, null, null], cascades }) // same colour
    expect(freeCellToCascade(s, 0, 0)).toBe(s)
  })
})

// -- cascadeToFoundation -----------------------------------------------------

describe('cascadeToFoundation', () => {
  it('sends the top card home when legal', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [] as Card[])
    cascades[0] = [c(9, 'S'), c(1, 'H')]
    const s = mkState({ cascades })
    const next = cascadeToFoundation(s, 0)
    expect(foundationTop(next, 'H')).toEqual(c(1, 'H'))
    expect(next.cascades[0]).toEqual([c(9, 'S')])
    expect(next.moves).toBe(1)
  })

  it('is a no-op (same ref) when illegal', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [] as Card[])
    cascades[0] = [c(5, 'H')]
    const s = mkState({ cascades })
    expect(cascadeToFoundation(s, 0)).toBe(s)
  })
})

// -- cascadeToCascade (runs + supermove gate) --------------------------------

describe('cascadeToCascade', () => {
  it('moves a single card onto a legal top', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [] as Card[])
    cascades[0] = [c(6, 'H')]
    cascades[1] = [c(7, 'S')]
    const s = mkState({ cascades })
    const next = cascadeToCascade(s, 0, 1, 1)
    expect(next.cascades[0]).toEqual([])
    expect(next.cascades[1]).toEqual([c(7, 'S'), c(6, 'H')])
    expect(next.moves).toBe(1)
  })

  it('moves a valid run within the supermove limit', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [c(1, 'S')])
    cascades[0] = [c(2, 'C'), c(8, 'H'), c(7, 'S'), c(6, 'H'), c(5, 'S')]
    cascades[1] = [c(9, 'S')] // head 8H (red) lands on 9S (black)
    const s = mkState({ cascades }) // 4 free cells → max non-empty = 5
    const next = cascadeToCascade(s, 0, 4, 1)
    expect(next).not.toBe(s)
    expect(next.cascades[1]).toEqual([c(9, 'S'), c(8, 'H'), c(7, 'S'), c(6, 'H'), c(5, 'S')])
    expect(next.cascades[0]).toEqual([c(2, 'C')])
  })

  it('rejects (same ref) a run that exceeds the supermove limit', () => {
    // 0 free cells, 0 empty columns → max = 1, but run length 2.
    const cascades = Array.from({ length: CASCADE_COLS }, () => [c(4, 'S')])
    cascades[0] = [c(7, 'H'), c(6, 'S')]
    cascades[1] = [c(7, 'D')] // 6S would land on 7D legally, head 7H on... wait
    // make landing legal for the run head 7H onto 8S
    cascades[1] = [c(8, 'S')]
    const s = mkState({
      freeCells: [c(1, 'S'), c(2, 'S'), c(3, 'S'), c(4, 'S')],
      cascades,
    })
    expect(maxSupermove(s, false)).toBe(1)
    expect(cascadeToCascade(s, 0, 2, 1)).toBe(s)
  })

  it('rejects (same ref) when the moved cards are not a valid sequence', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [c(1, 'S')])
    cascades[0] = [c(8, 'H'), c(6, 'S')] // rank break
    cascades[1] = [c(9, 'S')]
    const s = mkState({ cascades })
    expect(cascadeToCascade(s, 0, 2, 1)).toBe(s)
  })

  it('rejects (same ref) an illegal landing', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [c(1, 'S')])
    cascades[0] = [c(6, 'H')]
    cascades[1] = [c(7, 'D')] // same colour → illegal
    const s = mkState({ cascades })
    expect(cascadeToCascade(s, 0, 1, 1)).toBe(s)
  })

  it('rejects (same ref) fromCol === toCol', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [c(1, 'S')])
    cascades[0] = [c(6, 'H')]
    const s = mkState({ cascades })
    expect(cascadeToCascade(s, 0, 1, 0)).toBe(s)
  })

  it('EMPTY-COLUMN case: a run of 4 fits a non-empty col but NOT the empty col', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [c(9, 'S')])
    cascades[0] = [c(2, 'C'), c(8, 'H'), c(7, 'S'), c(6, 'H'), c(5, 'S')]
    cascades[6] = [c(9, 'S')] // head 8H lands on 9S (non-empty target)
    cascades[7] = [] // the empty destination
    const s = mkState({ freeCells: [null, null, c(1, 'H'), c(2, 'H')], cascades })
    // Non-empty target: (2+1)*2^1 = 6 → run of 4 allowed.
    expect(cascadeToCascade(s, 0, 4, 6)).not.toBe(s)
    // Empty target: (2+1)*2^0 = 3 → run of 4 rejected (same ref)...
    expect(cascadeToCascade(s, 0, 4, 7)).toBe(s)
    // ...but a run of 3 to the empty column is allowed.
    const three = cascadeToCascade(s, 0, 3, 7)
    expect(three).not.toBe(s)
    expect(three.cascades[7]).toEqual([c(7, 'S'), c(6, 'H'), c(5, 'S')])
  })
})

// -- auto / win / score ------------------------------------------------------

describe('autoToFoundations', () => {
  it('sweeps every card that can safely go home', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [] as Card[])
    cascades[0] = [c(9, 'S'), c(1, 'S')]
    cascades[1] = [c(2, 'S')]
    const s = mkState({ freeCells: [c(1, 'H'), null, null, null], cascades })
    const next = autoToFoundations(s)
    expect(foundationTop(next, 'S')).toEqual(c(2, 'S'))
    expect(foundationTop(next, 'H')).toEqual(c(1, 'H'))
    expect(next.freeCells[0]).toBeNull()
  })

  it('returns the same reference when nothing can move', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [] as Card[])
    cascades[0] = [c(9, 'S')]
    const s = mkState({ cascades })
    expect(autoToFoundations(s)).toBe(s)
  })

  it('finishes a near-win fixture to status "won"', () => {
    // Foundations at Queen (12) for every suit = 48 cards; 4 Kings reachable.
    const foundations = SUITS.map((suit) => {
      const pile: Card[] = []
      for (let r = 1; r <= 12; r++) pile.push(c(r, suit))
      return pile
    })
    const cascades = Array.from({ length: CASCADE_COLS }, () => [] as Card[])
    cascades[0] = [c(13, 'S')]
    cascades[1] = [c(13, 'H')]
    const s = mkState({
      foundations,
      cascades,
      freeCells: [c(13, 'D'), c(13, 'C'), null, null],
    })
    expect(foundationCardCount(s)).toBe(48)
    const won = autoToFoundations(s)
    expect(won.status).toBe('won')
    expect(isWon(won)).toBe(true)
    expect(foundationCardCount(won)).toBe(52)
  })
})

describe('win detection blocks further moves', () => {
  it('a won state rejects moves (same ref)', () => {
    const cascades = Array.from({ length: CASCADE_COLS }, () => [] as Card[])
    cascades[0] = [c(5, 'H')]
    const s = mkState({ status: 'won', cascades })
    expect(toFreeCell(s, 0)).toBe(s)
    expect(cascadeToFoundation(s, 0)).toBe(s)
  })
})

describe('score', () => {
  it('is 0 at the start of a deal', () => {
    expect(score(deal(mulberry32(SEED)))).toBe(0)
  })

  it('is monotonic: 100 per foundation card', () => {
    const foundations = [[c(1, 'S'), c(2, 'S')], [c(1, 'H')], [], []]
    const s = mkState({ foundations })
    expect(score(s)).toBe(300)
  })

  it('adds a 2000 win bonus on a won state', () => {
    const foundations = SUITS.map((suit) => {
      const pile: Card[] = []
      for (let r = 1; r <= 13; r++) pile.push(c(r, suit))
      return pile
    })
    const s = mkState({ foundations, status: 'won' })
    expect(isWon(s)).toBe(true)
    expect(score(s)).toBe(52 * 100 + 2000)
    expect(Number.isInteger(score(s))).toBe(true)
    expect(score(s)).toBeGreaterThan(0)
  })
})
