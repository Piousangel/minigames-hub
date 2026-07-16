import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BAND_BUCKET,
  MAX_GEN_ATTEMPTS,
  QUOTA_RATIO,
  START_LIVES,
  bandOf,
  bestGuaranteed,
  createGame,
  defaultAssign,
  enumerateSplits,
  evaluate,
  generateBoard,
  hindsightOptimum,
  isValidSplit,
  itemCount,
  maxValue,
  mulberry32,
  reduce,
  rivalPick,
  roundRng,
  sumMy,
  type CleaveAction,
  type CleaveState,
  type Item,
  type Pile,
  type Rng,
} from './engine'

/** Build an item without repeating the band bookkeeping in every fixture. */
function item(id: number, my: number, their: number, sealed = false, maxVal = 6): Item {
  const band = sealed ? bandOf(their, maxVal) : { lo: their, hi: their }
  return { id, myValue: my, theirValue: their, sealed, bandLo: band.lo, bandHi: band.hi }
}

/** An Rng that plays a fixed script, then repeats its last value forever. */
function scripted(values: number[]): Rng {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

function spy(inner: Rng): Rng & { calls: number } {
  const f = (() => {
    f.calls++
    return inner()
  }) as Rng & { calls: number }
  f.calls = 0
  return f
}

/**
 * The hand-computed board from the spec worksheet (maxVal 6):
 *   0: my5 their1 · 1: my4 their6 · 2: my3 their2 · 3: my1 their6 SEALED band 4..6
 *
 * Worked by hand across all 14 splits: the split {1,3} | {0,2} hands the rival a
 * magenta total of 6+v (>= 10) against 3, so it always takes that pile and leaves
 * my 5+3 = 8 — and 8 survives every v in 4..6, so bestGuaranteed = 8. With the
 * true v = 6, {2,3} | {0,1} instead scores 9 (magenta 8 vs 7), so hindsight = 9.
 */
const WORKSHEET: Item[] = [
  item(0, 5, 1),
  item(1, 4, 6),
  item(2, 3, 2),
  item(3, 1, 6, true, 6),
]

function stateWith(items: Item[], assign: Pile[], over: Partial<CleaveState> = {}): CleaveState {
  const guaranteed = bestGuaranteed(items)
  return {
    seed: 1,
    round: 1,
    board: {
      round: 1,
      items,
      maxVal: 6,
      sealedIndex: items.findIndex((i) => i.sealed),
      bestGuaranteed: guaranteed,
      hindsightOptimum: hindsightOptimum(items),
      quota: Math.ceil(QUOTA_RATIO * guaranteed),
    },
    assign,
    phase: 'split',
    score: 0,
    lives: START_LIVES,
    bestMargin: Infinity,
    perfects: 0,
    lastResult: null,
    lastEvent: 'none',
    ...over,
  }
}

// -- Determinism / rng ------------------------------------------------------

describe('determinism', () => {
  it('mulberry32(42) matches a pinned snapshot', () => {
    const r = mulberry32(42)
    const got = [r(), r(), r(), r(), r()].map((v) => Number(v.toFixed(10)))
    expect(got).toEqual([0.6011037519, 0.448290559, 0.8524657935, 0.6697340414, 0.1748138987])
    for (const v of got) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('generateBoard is reproducible for a fixed stream', () => {
    const a = generateBoard(3, mulberry32(7))
    const b = generateBoard(3, mulberry32(7))
    expect(a).toEqual(b)
    // Golden board: shape + the derived values that drive scoring.
    expect(a.items.length).toBe(itemCount(3))
    expect(a.maxVal).toBe(maxValue(3))
    expect(a.items.filter((i) => i.sealed).length).toBe(1)
    expect(a.items[a.sealedIndex].sealed).toBe(true)
    expect(a.quota).toBe(Math.ceil(QUOTA_RATIO * a.bestGuaranteed))
  })

  it('consumes rng in whole 2N+1 attempts and nothing more', () => {
    const s = spy(mulberry32(7))
    generateBoard(3, s)
    const n = itemCount(3)
    const perAttempt = 2 * n + 1
    expect(s.calls % perAttempt).toBe(0)
    expect(s.calls).toBeGreaterThanOrEqual(perAttempt)
    expect(s.calls).toBeLessThanOrEqual(perAttempt * MAX_GEN_ATTEMPTS)
  })

  it('draws myValue before theirValue for each item', () => {
    // round 1: N=4, maxVal=6. Script: item0 (lo,hi), item1 (hi,lo), rest lo,
    // then sealedIndex -> 0. Two items already disagree, so no retry.
    const rng = scripted([0, 0.99, 0.99, 0, 0, 0, 0, 0, 0])
    const b = generateBoard(1, rng)
    expect(b.maxVal).toBe(6)
    expect({ my: b.items[0].myValue, their: b.items[0].theirValue }).toEqual({ my: 1, their: 6 })
    expect({ my: b.items[1].myValue, their: b.items[1].theirValue }).toEqual({ my: 6, their: 1 })
    expect(b.sealedIndex).toBe(0)
  })

  it('roundRng isolates rounds but repeats for a fixed (seed, round)', () => {
    expect(roundRng(99, 1)()).not.toBe(roundRng(99, 2)())
    const a = roundRng(99, 5)
    const b = roundRng(99, 5)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('plays a scripted game to a golden score/lives/round', () => {
    // Every commit below is a genuine two-pile split, so this pins five `next`
    // transitions and six scored rounds — not the illegal path.
    const script: CleaveAction[] = [
      { type: 'toggle', item: 0 },
      { type: 'toggle', item: 3 },
      { type: 'commit' },
      { type: 'next' },
      { type: 'assign', item: 1, pile: 'A' },
      { type: 'toggle', item: 2 },
      { type: 'commit' },
      { type: 'next' },
      { type: 'toggle', item: 0 },
      { type: 'commit' },
      { type: 'next' },
      { type: 'assign', item: 4, pile: 'B' },
      { type: 'toggle', item: 1 },
      { type: 'commit' },
      { type: 'next' },
      { type: 'toggle', item: 2 },
      { type: 'toggle', item: 4 },
      { type: 'commit' },
      { type: 'next' },
      { type: 'commit' },
    ]
    let s = createGame(1234)
    const banked: number[] = []
    for (const a of script) {
      s = reduce(s, a)
      expect(s.lastEvent).not.toBe('illegal')
      if (a.type === 'commit') banked.push(s.lastResult!.myKept)
    }
    expect(banked).toEqual([8, 7, 11, 9, 8, 14])
    // score is exactly the sum of what was kept — no bonus smuggles luck in.
    expect(s.score).toBe(banked.reduce((a, b) => a + b, 0))
    expect({ score: s.score, lives: s.lives, round: s.round }).toEqual({
      score: 57,
      lives: 3, // the quota was met every round
      round: 6,
    })
  })

  it('engine source contains no ambient entropy', () => {
    const src = readFileSync(join(__dirname, 'engine.ts'), 'utf8')
    for (const banned of ['Math.rand' + 'om', 'Date.n' + 'ow', 'performance.n' + 'ow']) {
      expect(src).not.toContain(banned)
    }
  })
})

// -- rivalPick contract -----------------------------------------------------

describe('rivalPick', () => {
  it('takes the pile with the bigger magenta total', () => {
    const items = [item(0, 1, 9), item(1, 1, 2)]
    expect(rivalPick(items, ['A', 'B'])).toBe('A')
    expect(rivalPick(items, ['B', 'A'])).toBe('B')
  })

  it('breaks a magenta tie by taking the bigger cyan pile (worst for you)', () => {
    const items = [item(0, 5, 3), item(1, 1, 3)]
    expect(rivalPick(items, ['A', 'B'])).toBe('A')
  })

  it('pins a total tie to B', () => {
    const items = [item(0, 3, 3), item(1, 3, 3)]
    expect(rivalPick(items, ['A', 'B'])).toBe('B')
    expect(rivalPick(items, ['B', 'A'])).toBe('B')
  })

  it('mirrors under a full A/B relabel, except the pinned total tie', () => {
    const items = [item(0, 5, 1), item(1, 4, 6), item(2, 3, 2)]
    for (const split of enumerateSplits(3)) {
      const flipped = split.map((p) => (p === 'A' ? 'B' : 'A')) as Pile[]
      const tie =
        sumMy(items, split, 'A') === sumMy(items, split, 'B') &&
        rivalPick(items, split) === rivalPick(items, flipped)
      if (tie) continue
      const want = rivalPick(items, split) === 'A' ? 'B' : 'A'
      expect(rivalPick(items, flipped)).toBe(want)
    }
    // The pinned case, stated explicitly.
    const even = [item(0, 3, 3), item(1, 3, 3)]
    expect(rivalPick(even, ['A', 'B'])).toBe('B')
    expect(rivalPick(even, ['B', 'A'])).toBe('B')
  })

  it('honours sealedOverride, flipping the decision across a band', () => {
    // WORKSHEET split {2,3} | {0,1}: magenta 2+v vs 7.
    const assign: Pile[] = ['B', 'B', 'A', 'A']
    expect(rivalPick(WORKSHEET, assign, 4)).toBe('B') // 6 < 7
    expect(rivalPick(WORKSHEET, assign, 6)).toBe('A') // 8 > 7
  })

  it('conserves cyan: myKept + myGiven === total (20 random boards)', () => {
    const rng = mulberry32(31337)
    for (let b = 0; b < 20; b++) {
      const board = generateBoard(1 + (b % 6), rng)
      for (const split of enumerateSplits(board.items.length).slice(0, 12)) {
        const ev = evaluate(board.items, split)
        const total = board.items.reduce((a, i) => a + i.myValue, 0)
        expect(ev.myKept + ev.myGiven).toBe(total)
        expect(ev.robbed).toBe(ev.myGiven > ev.myKept)
        expect(ev.keptPile).not.toBe(ev.rivalTook)
      }
    }
  })
})

// -- Bands / optima ---------------------------------------------------------

describe('bands and optima', () => {
  it('always brackets the true value', () => {
    for (let maxVal = 6; maxVal <= 12; maxVal++) {
      for (let v = 1; v <= maxVal; v++) {
        const { lo, hi } = bandOf(v, maxVal)
        expect(lo).toBeLessThanOrEqual(v)
        expect(hi).toBeGreaterThanOrEqual(v)
        expect(lo).toBeGreaterThanOrEqual(1)
        expect(hi).toBeLessThanOrEqual(maxVal)
      }
    }
  })

  it('maps a whole bucket onto one band, so the true value is not recoverable', () => {
    expect(BAND_BUCKET).toBe(3)
    expect(bandOf(4, 6)).toEqual(bandOf(6, 6))
    expect(bandOf(1, 6)).toEqual(bandOf(3, 6))
    expect(bandOf(4, 6)).not.toEqual(bandOf(1, 6))
  })

  it('collapses the band to a point for unsealed items', () => {
    const b = generateBoard(4, mulberry32(11))
    for (const it of b.items) {
      if (it.sealed) continue
      expect(it.bandLo).toBe(it.theirValue)
      expect(it.bandHi).toBe(it.theirValue)
    }
  })

  it('never exceeds hindsight (30 seeded boards)', () => {
    for (let s = 0; s < 30; s++) {
      const b = generateBoard(1 + (s % 5), mulberry32(1000 + s))
      expect(b.bestGuaranteed).toBeGreaterThanOrEqual(0)
      expect(b.bestGuaranteed).toBeLessThanOrEqual(b.hindsightOptimum)
      expect(b.quota).toBe(Math.ceil(QUOTA_RATIO * b.bestGuaranteed))
      expect(b.quota).toBeLessThanOrEqual(b.bestGuaranteed)
    }
  })

  it('does not depend on the sealed true value (luck is excluded)', () => {
    const base = bestGuaranteed(WORKSHEET)
    for (let v = WORKSHEET[3].bandLo; v <= WORKSHEET[3].bandHi; v++) {
      const shifted = WORKSHEET.map((i) => (i.sealed ? { ...i, theirValue: v } : i))
      expect(bestGuaranteed(shifted)).toBe(base)
    }
    // Hindsight, by contrast, is allowed to move with the true value.
    const atLo = WORKSHEET.map((i) => (i.sealed ? { ...i, theirValue: 4 } : i))
    expect(hindsightOptimum(atLo)).not.toBe(hindsightOptimum(WORKSHEET))
  })

  it('enumerates 2^n - 2 valid splits', () => {
    expect(enumerateSplits(4).length).toBe(14)
    expect(enumerateSplits(9).length).toBe(510)
    for (const s of enumerateSplits(4)) {
      expect(isValidSplit(s)).toBe(true)
      expect(s.length).toBe(4)
    }
    expect(isValidSplit(['A', 'A', 'A'])).toBe(false)
    expect(isValidSplit(['B', 'B'])).toBe(false)
    expect(isValidSplit(defaultAssign(5))).toBe(true)
  })

  it('matches the hand-computed worksheet board', () => {
    expect(bestGuaranteed(WORKSHEET)).toBe(8)
    expect(hindsightOptimum(WORKSHEET)).toBe(9)
    // The line that guarantees 8: rival is baited onto {1,3}.
    const line: Pile[] = ['B', 'A', 'B', 'A']
    for (let v = 4; v <= 6; v++) {
      expect(evaluate(WORKSHEET, line, v).myKept).toBe(8)
    }
  })
})

// -- Reducer ----------------------------------------------------------------

describe('reducer', () => {
  it('only moves chips during the split phase', () => {
    const base = stateWith(WORKSHEET, ['A', 'B', 'A', 'B'])
    expect(reduce(base, { type: 'toggle', item: 0 }).assign[0]).toBe('B')
    expect(reduce(base, { type: 'toggle', item: 0 }).lastEvent).toBe('assign')

    for (const phase of ['reveal', 'over'] as const) {
      const frozen = stateWith(WORKSHEET, ['A', 'B', 'A', 'B'], { phase })
      const out = reduce(frozen, { type: 'toggle', item: 0 })
      expect(out.assign).toEqual(frozen.assign)
      expect(out.lastEvent).toBe('none')
      expect(reduce(frozen, { type: 'assign', item: 0, pile: 'B' }).lastEvent).toBe('none')
      expect(reduce(frozen, { type: 'commit' }).lastEvent).toBe('none')
    }
  })

  it('rejects a one-pile commit without touching the state', () => {
    const s = stateWith(WORKSHEET, ['A', 'A', 'A', 'A'])
    expect(s.board.bestGuaranteed).toBeGreaterThan(0)
    const out = reduce(s, { type: 'commit' })
    expect(out.lastEvent).toBe('illegal')
    expect(out.phase).toBe('split')
    expect(out.score).toBe(0)
    expect(out.lives).toBe(START_LIVES)
    expect(out.lastResult).toBeNull()
  })

  it('commits into reveal, banks exactly myKept, then deals the next round', () => {
    const s = stateWith(WORKSHEET, ['B', 'A', 'B', 'A'], { seed: 1234 })
    const after = reduce(s, { type: 'commit' })
    expect(after.phase).toBe('reveal')
    expect(after.lastResult).not.toBeNull()
    const r = after.lastResult!
    expect(r.myKept).toBe(8)
    expect(after.score).toBe(8)
    expect(r.myKept + r.myGiven).toBe(13)
    expect(r.sealedTheirValue).toBe(6)
    expect(r.leftOnTable).toBe(1) // hindsight 9 - kept 8
    expect(r.metQuota).toBe(true)
    expect(after.lives).toBe(START_LIVES)

    const next = reduce(after, { type: 'next' })
    expect(next.round).toBe(2)
    expect(next.phase).toBe('split')
    expect(next.lastEvent).toBe('next')
    expect(next.board.round).toBe(2)
    expect(next.assign).toEqual(defaultAssign(next.board.items.length))
    expect(next.score).toBe(8)
  })

  it('spends a life on a quota miss but still banks the round, and ends at zero', () => {
    // {3} | {0,1,2}: rival takes the fat magenta pile, leaving my 1 — below the
    // quota of ceil(0.5 * 8) = 4.
    const bad: Pile[] = ['B', 'B', 'B', 'A']
    let s = stateWith(WORKSHEET, bad)
    expect(s.board.quota).toBe(4)

    s = reduce(s, { type: 'commit' })
    expect(s.lastResult!.myKept).toBe(1)
    expect(s.lastResult!.metQuota).toBe(false)
    expect(s.score).toBe(1) // score still rises: only a life is lost
    expect(s.lives).toBe(START_LIVES - 1)
    expect(s.lastEvent).toBe('quotaFail')
    expect(s.phase).toBe('reveal')

    // Drain the last two lives on the same losing line.
    let drained = stateWith(WORKSHEET, bad, { lives: 1, score: 100 })
    drained = reduce(drained, { type: 'commit' })
    expect(drained.lives).toBe(0)
    expect(drained.phase).toBe('over')
    expect(drained.score).toBe(101)
    expect(reduce(drained, { type: 'next' })).toEqual({ ...drained, lastEvent: 'none' })
    expect(reduce(drained, { type: 'commit' }).lastEvent).toBe('none')
  })

  it('flags robbed and perfect rounds', () => {
    // {0,1} | {2,3} at v=6: rival takes B (magenta 8 vs 7), leaving my 9 = hindsight.
    const perfect = reduce(stateWith(WORKSHEET, ['A', 'A', 'B', 'B']), { type: 'commit' })
    expect(perfect.lastResult!.myKept).toBe(9)
    expect(perfect.lastEvent).toBe('perfect')
    expect(perfect.perfects).toBe(1)
    expect(perfect.lastResult!.leftOnTable).toBe(0)

    // {0,1,2} | {3}: my 12 walks, my 1 stays.
    const robbed = reduce(stateWith(WORKSHEET, ['A', 'A', 'A', 'B']), { type: 'commit' })
    expect(robbed.lastResult!.robbed).toBe(true)
    expect(robbed.lastResult!.myGiven).toBeGreaterThan(robbed.lastResult!.myKept)
  })

  it('rebuilds the same game on reset and a different one on new', () => {
    const a = createGame(4242)
    const played = reduce(a, { type: 'toggle', item: 0 })
    expect(reduce(played, { type: 'reset' })).toEqual(a)
    expect(createGame(4242).board).toEqual(a.board)
    expect(reduce(a, { type: 'new', seed: 99 }).seed).toBe(99)
  })

  it('scales rounds monotonically within bounds', () => {
    let prev = 0
    for (let r = 1; r <= 40; r++) {
      const n = itemCount(r)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(9)
      expect(n).toBeGreaterThanOrEqual(prev)
      prev = n
      expect(maxValue(r)).toBeLessThanOrEqual(12)
    }
    expect(maxValue(1)).toBe(6)
    expect(itemCount(1)).toBe(4)
  })
})
