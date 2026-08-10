import { describe, expect, it } from 'vitest'
import {
  CLEAR_BONUS,
  DIFFICULTIES,
  MARGIN_BONUS_MAX,
  applyDecision,
  createGame,
  currentCard,
  gaugeOf,
  generateDeck,
  graspsUntilCap,
  maxGrasps,
  mulberry32,
  reduce,
  tallyValueCounts,
  type GraspConfig,
  type GraspState,
} from './engine'

const EASY = DIFFICULTIES.easy
const NORMAL = DIFFICULTIES.normal
const HARD = DIFFICULTIES.hard

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })
})

describe('generateDeck', () => {
  it('length matches deckSize for every difficulty', () => {
    for (const cfg of [EASY, NORMAL, HARD]) {
      expect(generateDeck(cfg, mulberry32(1)).length).toBe(cfg.deckSize)
    }
  })

  it('multiset composition is fixed: copiesPerValue of each value', () => {
    const deck = generateDeck(NORMAL, mulberry32(77))
    const counts = tallyValueCounts(deck, 0, NORMAL.valueMax)
    for (const c of counts) expect(c).toBe(NORMAL.copiesPerValue)
  })

  it('is deterministic: same seed => identical array', () => {
    expect(generateDeck(NORMAL, mulberry32(5))).toEqual(generateDeck(NORMAL, mulberry32(5)))
  })

  it('is seed-sensitive: different seeds diverge (golden)', () => {
    const a = generateDeck(NORMAL, mulberry32(42))
    const b = generateDeck(NORMAL, mulberry32(43))
    expect(a).not.toEqual(b)
  })

  it('golden: easy seed=1 produces the exact expected deck', () => {
    expect(generateDeck(EASY, mulberry32(1))).toEqual([
      1, 2, 4, 3, 5, 2, 1, 1, 5, 4, 3, 2, 5, 3, 2, 4, 5, 3, 1, 4,
    ])
  })

  it('golden: normal seed=42 produces the exact expected deck', () => {
    expect(generateDeck(NORMAL, mulberry32(42))).toEqual([
      4, 3, 1, 3, 6, 1, 4, 5, 3, 2, 6, 1, 5, 5, 2, 1, 2, 5, 4, 6, 2, 4, 3, 2, 6, 1, 6, 5, 3, 4,
    ])
  })
})

describe('maxGrasps', () => {
  it('easy=6, normal=8, hard=10', () => {
    expect(maxGrasps(EASY)).toBe(6)
    expect(maxGrasps(NORMAL)).toBe(8)
    expect(maxGrasps(HARD)).toBe(10)
  })
})

describe('DIFFICULTIES config sanity', () => {
  it('deckSize === valueMax * copiesPerValue for every preset', () => {
    for (const cfg of [EASY, NORMAL, HARD]) {
      expect(cfg.deckSize).toBe(cfg.valueMax * cfg.copiesPerValue)
    }
  })
})

describe('createGame', () => {
  it('golden: easy seed=1 initial valueCounts are all copiesPerValue', () => {
    expect(createGame(EASY, 1).valueCounts).toEqual([4, 4, 4, 4, 4])
  })

  it('initial state fields', () => {
    const g = createGame(EASY, 1)
    expect(g.cursor).toBe(0)
    expect(g.score).toBe(0)
    expect(g.graspCount).toBe(0)
    expect(g.over).toBe(false)
    expect(g.cleared).toBe(false)
    expect(g.lastEvent).toBe('none')
    expect(g.lastCard).toBeNull()
  })
})

describe('tallyValueCounts', () => {
  it('sums to the full deck length from index 0', () => {
    const deck = generateDeck(NORMAL, mulberry32(3))
    const counts = tallyValueCounts(deck, 0, NORMAL.valueMax)
    expect(counts.reduce((a, b) => a + b, 0)).toBe(deck.length)
  })
})

describe('golden scenario A — easy seed=1, always grasp', () => {
  it('caps on the 6th grasp with the exact expected running totals', () => {
    let s = createGame(EASY, 1)
    const expectedCards = [1, 2, 4, 3, 5, 2]
    const expectedGains = [1, 2, 4, 3, 5, 2]
    const expectedScores = [1, 3, 7, 10, 15, 17]
    for (let i = 0; i < 6; i++) {
      s = reduce(s, { type: 'decide', decision: 'grasp' })
      expect(s.lastCard).toBe(expectedCards[i])
      expect(s.lastGain).toBe(expectedGains[i])
      expect(s.score).toBe(expectedScores[i])
    }
    expect(s).toMatchObject({
      over: true,
      cleared: false,
      score: 17,
      graspCount: 6,
      cursor: 6,
      lastEvent: 'capped',
    })
  })
})

describe('golden scenario B — same seed=1, always release', () => {
  it('clears on the 20th release with max margin bonus', () => {
    let s = createGame(EASY, 1)
    for (let i = 0; i < 20; i++) {
      s = reduce(s, { type: 'decide', decision: 'release' })
    }
    expect(s).toMatchObject({
      cursor: 20,
      over: true,
      cleared: true,
      score: 300,
      lastEvent: 'cleared',
    })
  })
})

describe('golden scenario C — clear/cap tie-break', () => {
  const CFG: GraspConfig = { deckSize: 3, valueMax: 3, copiesPerValue: 1, gaugeStep: 100, gaugeMax: 100 }

  it('release, release, then a capping grasp on the last card resolves as cleared', () => {
    let s = createGame(CFG, 7)
    expect(s.deck).toEqual([2, 3, 1])
    s = reduce(s, { type: 'decide', decision: 'release' })
    s = reduce(s, { type: 'decide', decision: 'release' })
    s = reduce(s, { type: 'decide', decision: 'grasp' })
    expect(s).toMatchObject({
      lastEvent: 'cleared',
      over: true,
      cleared: true,
      score: 201,
      lastCard: 1,
      lastGain: 201,
    })
  })
})

describe('applyDecision guards', () => {
  it('returns null once state.over is true', () => {
    const s: GraspState = { ...createGame(EASY, 1), over: true }
    expect(applyDecision(s, 'grasp')).toBeNull()
    expect(applyDecision(s, 'release')).toBeNull()
  })
})

describe('reduce — over is a no-op', () => {
  it('a decide action after over leaves every field unchanged except lastEvent', () => {
    let s = createGame(EASY, 1)
    for (let i = 0; i < 6; i++) s = reduce(s, { type: 'decide', decision: 'grasp' })
    expect(s.over).toBe(true)
    const before = { ...s }
    const after = reduce(s, { type: 'decide', decision: 'grasp' })
    expect(after).toEqual({ ...before, lastEvent: 'none' })
  })
})

describe('reduce — reset / new', () => {
  it('reset reproduces createGame with the same seed', () => {
    let s = createGame(NORMAL, 999)
    s = reduce(s, { type: 'decide', decision: 'grasp' })
    s = reduce(s, { type: 'decide', decision: 'release' })
    const reset = reduce(s, { type: 'reset' })
    expect(reset).toEqual(createGame(NORMAL, 999))
  })

  it('new starts a fresh game with the new seed and does not carry over score/cursor', () => {
    let s = createGame(NORMAL, 1)
    s = reduce(s, { type: 'decide', decision: 'grasp' })
    s = reduce(s, { type: 'decide', decision: 'grasp' })
    const fresh = reduce(s, { type: 'new', seed: 555 })
    expect(fresh).toEqual(createGame(NORMAL, 555))
    expect(fresh.score).toBe(0)
    expect(fresh.cursor).toBe(0)
  })
})

describe('gaugeOf', () => {
  it('always equals graspCount * gaugeStep across several steps', () => {
    let s = createGame(NORMAL, 1)
    expect(gaugeOf(s)).toBe(0)
    const seq: Array<'grasp' | 'release'> = ['release', 'grasp', 'release', 'grasp', 'grasp']
    for (const d of seq) {
      s = reduce(s, { type: 'decide', decision: d })
      expect(gaugeOf(s)).toBe(s.graspCount * s.config.gaugeStep)
    }
  })
})

describe('graspsUntilCap', () => {
  it('starts at maxGrasps and decrements by 1 per grasp, hitting 0 at over', () => {
    let s = createGame(EASY, 1)
    expect(graspsUntilCap(s)).toBe(6)
    for (let i = 1; i <= 6; i++) {
      s = reduce(s, { type: 'decide', decision: 'grasp' })
      if (s.over) {
        expect(graspsUntilCap(s)).toBe(0)
      } else {
        expect(graspsUntilCap(s)).toBe(6 - i)
      }
    }
    expect(s.over).toBe(true)
  })
})

describe('valueCounts integrity', () => {
  it('valueCounts always sums to deckSize - cursor over a mixed sequence', () => {
    let s = createGame(NORMAL, 2024)
    const pattern: Array<'grasp' | 'release'> = ['grasp', 'release', 'release', 'grasp', 'release']
    for (let i = 0; i < 20 && !s.over; i++) {
      const decision = pattern[i % pattern.length]
      s = reduce(s, { type: 'decide', decision })
      const sum = s.valueCounts.reduce((a, b) => a + b, 0)
      expect(sum).toBe(s.config.deckSize - s.cursor)
    }
  })
})

describe('biggestGrasp', () => {
  it('tracks the max grasped card value; release never changes it', () => {
    let s = createGame(NORMAL, 10)
    s = reduce(s, { type: 'decide', decision: 'release' })
    expect(s.biggestGrasp).toBe(0)
    let maxSoFar = 0
    for (let i = 0; i < 8 && !s.over; i++) {
      const prevCursor = s.cursor
      const card = s.deck[prevCursor]
      s = reduce(s, { type: 'decide', decision: 'grasp' })
      maxSoFar = Math.max(maxSoFar, card)
      expect(s.biggestGrasp).toBe(maxSoFar)
    }
  })
})

describe('score monotonicity', () => {
  it('score never decreases across an alternating grasp/release sequence', () => {
    let s = createGame(HARD, 55)
    let prevScore = s.score
    let decision: 'grasp' | 'release' = 'grasp'
    for (let i = 0; i < 20 && !s.over; i++) {
      s = reduce(s, { type: 'decide', decision })
      expect(s.score).toBeGreaterThanOrEqual(prevScore)
      prevScore = s.score
      decision = decision === 'grasp' ? 'release' : 'grasp'
    }
  })
})

describe('currentCard', () => {
  it('matches deck[cursor] before over, and is null after', () => {
    let s = createGame(EASY, 1)
    for (let i = 0; i < 6; i++) {
      expect(currentCard(s)).toBe(s.deck[s.cursor])
      s = reduce(s, { type: 'decide', decision: 'grasp' })
    }
    expect(s.over).toBe(true)
    expect(currentCard(s)).toBeNull()
  })
})

describe('CLEAR_BONUS / MARGIN_BONUS_MAX constants sanity', () => {
  it('are the documented values', () => {
    expect(CLEAR_BONUS).toBe(200)
    expect(MARGIN_BONUS_MAX).toBe(100)
  })
})
