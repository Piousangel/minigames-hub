import { describe, it, expect } from 'vitest'
import {
  type Category,
  type State,
  ALL_CATEGORIES,
  LOWER_CATEGORIES,
  UPPER_CATEGORIES,
  bestCategory,
  categoryScore,
  chanceScore,
  counts,
  createGame,
  dieFromFloat,
  fourKindScore,
  fullHouseScore,
  grandTotal,
  hold,
  isGameOver,
  isYahtzee,
  largeStraightScore,
  lowerTotal,
  mulberry32,
  mulberry32Step,
  potentialScores,
  roll,
  score,
  smallStraightScore,
  sumDice,
  threeKindScore,
  upperBonus,
  upperScore,
  upperTotal,
  yahtzeeScore,
} from './engine'

const SEED = 12345

/** Force the dice/rolled state without going through the PRNG (for scoring tests). */
function withDice(state: State, dice: number[]): State {
  return { ...state, dice: dice.slice(), rolled: true, rollsLeft: 2 }
}

// -- Upper section -----------------------------------------------------------

describe('upper section scoring', () => {
  it('ones = sum of 1s', () => {
    expect(upperScore([1, 1, 3, 1, 5], 1)).toBe(3)
  })
  it('twos = sum of 2s', () => {
    expect(upperScore([2, 2, 2, 4, 6], 2)).toBe(6)
  })
  it('threes = sum of 3s', () => {
    expect(upperScore([3, 3, 3, 3, 1], 3)).toBe(12)
  })
  it('fours = sum of 4s', () => {
    expect(upperScore([4, 4, 1, 2, 3], 4)).toBe(8)
  })
  it('fives = sum of 5s', () => {
    expect(upperScore([5, 5, 5, 5, 5], 5)).toBe(25)
  })
  it('sixes = 0 when none present', () => {
    expect(upperScore([1, 2, 3, 4, 5], 6)).toBe(0)
  })
  it('categoryScore dispatches upper categories by face', () => {
    expect(categoryScore('fours', [4, 4, 4, 2, 1])).toBe(12)
    expect(categoryScore('sixes', [6, 6, 6, 6, 1])).toBe(24)
  })
})

// -- Three / Four of a kind --------------------------------------------------

describe('three & four of a kind', () => {
  it('three of a kind = sum of ALL dice when ≥3 match', () => {
    expect(threeKindScore([3, 3, 3, 4, 5])).toBe(18)
  })
  it('three of a kind also true for 4 or 5 of a kind', () => {
    expect(threeKindScore([2, 2, 2, 2, 5])).toBe(13)
    expect(threeKindScore([6, 6, 6, 6, 6])).toBe(30)
  })
  it('three of a kind = 0 when no triple', () => {
    expect(threeKindScore([1, 1, 2, 2, 3])).toBe(0)
  })
  it('four of a kind = sum of ALL dice when ≥4 match', () => {
    expect(fourKindScore([5, 5, 5, 5, 2])).toBe(22)
  })
  it('four of a kind = 0 with only a triple', () => {
    expect(fourKindScore([5, 5, 5, 2, 2])).toBe(0)
  })
  it('four of a kind true for a yahtzee', () => {
    expect(fourKindScore([4, 4, 4, 4, 4])).toBe(20)
  })
})

// -- Full house --------------------------------------------------------------

describe('full house', () => {
  it('25 for a 3+2', () => {
    expect(fullHouseScore([2, 2, 2, 5, 5])).toBe(25)
  })
  it('25 for a different 3+2', () => {
    expect(fullHouseScore([6, 6, 1, 1, 1])).toBe(25)
  })
  it('0 for two pair', () => {
    expect(fullHouseScore([2, 2, 5, 5, 6])).toBe(0)
  })
  it('0 for a bare triple', () => {
    expect(fullHouseScore([3, 3, 3, 1, 2])).toBe(0)
  })
  it('five of a kind is NOT a full house (strict rule)', () => {
    expect(fullHouseScore([4, 4, 4, 4, 4])).toBe(0)
  })
})

// -- Straights ---------------------------------------------------------------

describe('straights', () => {
  it('small straight 1-2-3-4 = 30', () => {
    expect(smallStraightScore([1, 2, 3, 4, 4])).toBe(30)
  })
  it('small straight 2-3-4-5 = 30', () => {
    expect(smallStraightScore([2, 3, 4, 5, 5])).toBe(30)
  })
  it('small straight 3-4-5-6 = 30', () => {
    expect(smallStraightScore([6, 3, 4, 5, 6])).toBe(30)
  })
  it('small straight found inside a large straight', () => {
    expect(smallStraightScore([1, 2, 3, 4, 5])).toBe(30)
  })
  it('small straight = 0 with a gap (1-2-3-_-5-6)', () => {
    expect(smallStraightScore([1, 2, 3, 5, 6])).toBe(0)
  })
  it('large straight 1-5 = 40', () => {
    expect(largeStraightScore([1, 2, 3, 4, 5])).toBe(40)
  })
  it('large straight 2-6 = 40', () => {
    expect(largeStraightScore([2, 3, 4, 5, 6])).toBe(40)
  })
  it('large straight = 0 for a small straight with a dupe', () => {
    expect(largeStraightScore([1, 2, 3, 4, 4])).toBe(0)
  })
})

// -- Yahtzee & chance --------------------------------------------------------

describe('yahtzee & chance', () => {
  it('yahtzee = 50 for five of a kind', () => {
    expect(yahtzeeScore([3, 3, 3, 3, 3])).toBe(50)
    expect(isYahtzee([3, 3, 3, 3, 3])).toBe(true)
  })
  it('yahtzee = 0 for four of a kind', () => {
    expect(yahtzeeScore([3, 3, 3, 3, 1])).toBe(0)
    expect(isYahtzee([3, 3, 3, 3, 1])).toBe(false)
  })
  it('chance = sum of all dice regardless of shape', () => {
    expect(chanceScore([1, 2, 3, 4, 5])).toBe(15)
    expect(chanceScore([6, 6, 6, 6, 6])).toBe(30)
  })
  it('counts and sumDice helpers are correct', () => {
    expect(counts([1, 1, 6, 6, 6])).toEqual([0, 2, 0, 0, 0, 0, 3])
    expect(sumDice([1, 2, 3, 4, 5])).toBe(15)
  })
})

// -- potentialScores & bestCategory ------------------------------------------

describe('potential-score preview', () => {
  it('maps every category to its score-if-picked-now', () => {
    const p = potentialScores([5, 5, 5, 2, 2])
    expect(p.fives).toBe(15)
    expect(p.fullHouse).toBe(25)
    expect(p.threeKind).toBe(19)
    expect(p.fourKind).toBe(0)
    expect(p.yahtzee).toBe(0)
    expect(p.chance).toBe(19)
    expect(p.largeStraight).toBe(0)
  })
  it('covers all 13 categories', () => {
    expect(Object.keys(potentialScores([1, 2, 3, 4, 5])).length).toBe(13)
  })
  it('bestCategory picks the highest unused option', () => {
    const s = withDice(createGame(1), [2, 3, 4, 5, 6]) // large straight = 40 wins
    expect(bestCategory(s)).toBe('largeStraight')
  })
  it('bestCategory skips already-used categories', () => {
    let s = withDice(createGame(1), [2, 3, 4, 5, 6])
    s = { ...s, scores: { ...s.scores, largeStraight: 40 } }
    // next best for 2-3-4-5-6 is chance(20) or smallStraight(30) → smallStraight
    expect(bestCategory(s)).toBe('smallStraight')
  })
  it('bestCategory returns null when the card is full', () => {
    const full = {} as Record<Category, number>
    for (const c of ALL_CATEGORIES) full[c] = 0
    const s = { ...createGame(1), scores: full, rolled: true }
    expect(bestCategory(s)).toBeNull()
  })
})

// -- Upper bonus -------------------------------------------------------------

describe('upper bonus at 63', () => {
  function upperScored(map: Partial<Record<Category, number>>): State {
    const s = createGame(1)
    return { ...s, scores: { ...s.scores, ...map } }
  }
  it('no bonus below 63', () => {
    // three each of 1..6 = 3+6+9+12+15+18 = 63 → exactly hits it, so back off one
    const s = upperScored({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 15 })
    expect(upperTotal(s)).toBe(60)
    expect(upperBonus(s)).toBe(0)
  })
  it('+35 bonus at exactly 63', () => {
    const s = upperScored({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 })
    expect(upperTotal(s)).toBe(63)
    expect(upperBonus(s)).toBe(35)
  })
  it('+35 bonus above 63', () => {
    const s = upperScored({ ones: 5, twos: 10, threes: 15, fours: 12, fives: 15, sixes: 18 })
    expect(upperTotal(s)).toBe(75)
    expect(upperBonus(s)).toBe(35)
  })
})

// -- Yahtzee +100 bonus ------------------------------------------------------

describe('yahtzee +100 bonus', () => {
  it('adds +100 when scoring an extra yahtzee while the box holds 50', () => {
    let s = createGame(1)
    s = { ...s, scores: { ...s.scores, yahtzee: 50 } } // box already 50
    s = withDice(s, [4, 4, 4, 4, 4]) // another yahtzee
    const after = score(s, 'fours') // score it elsewhere
    expect(after.yahtzeeBonus).toBe(100)
    expect(after.scores.fours).toBe(20)
  })
  it('two extra yahtzees stack to +200', () => {
    let s = createGame(1)
    s = { ...s, scores: { ...s.scores, yahtzee: 50 } }
    s = withDice(s, [2, 2, 2, 2, 2])
    s = score(s, 'twos')
    expect(s.yahtzeeBonus).toBe(100)
    s = withDice(s, [3, 3, 3, 3, 3])
    s = score(s, 'threes')
    expect(s.yahtzeeBonus).toBe(200)
  })
  it('no bonus when the yahtzee box is not yet filled', () => {
    let s = withDice(createGame(1), [5, 5, 5, 5, 5])
    s = score(s, 'yahtzee') // first yahtzee = the 50 itself, no bonus
    expect(s.scores.yahtzee).toBe(50)
    expect(s.yahtzeeBonus).toBe(0)
  })
  it('no bonus when the yahtzee box was scored 0', () => {
    let s = createGame(1)
    s = { ...s, scores: { ...s.scores, yahtzee: 0 } } // took a zero there
    s = withDice(s, [6, 6, 6, 6, 6])
    s = score(s, 'sixes')
    expect(s.yahtzeeBonus).toBe(0)
  })
  it('lowerTotal and grandTotal include the yahtzee bonus', () => {
    let s = createGame(1)
    s = { ...s, scores: { ...s.scores, yahtzee: 50 }, yahtzeeBonus: 100 }
    expect(lowerTotal(s)).toBe(150)
    expect(grandTotal(s)).toBe(150)
  })
})

// -- roll / hold mechanics ---------------------------------------------------

describe('roll mechanics', () => {
  it('first roll fills all 5 dice with faces 1..6 and marks rolled', () => {
    const s = roll(createGame(SEED))
    expect(s.rolled).toBe(true)
    expect(s.rollsLeft).toBe(2)
    expect(s.dice.length).toBe(5)
    for (const d of s.dice) expect(d).toBeGreaterThanOrEqual(1)
    for (const d of s.dice) expect(d).toBeLessThanOrEqual(6)
  })
  it('respects the 3-roll limit — a 4th roll is a ===no-op', () => {
    let s = roll(createGame(SEED))
    s = roll(s)
    s = roll(s)
    expect(s.rollsLeft).toBe(0)
    expect(roll(s)).toBe(s) // no rolls left → same reference
  })
  it('held dice keep their value across a reroll', () => {
    let s = roll(createGame(SEED)) // [6,2,3,5,4]
    const kept = [s.dice[0], s.dice[2]]
    s = hold(s, 0)
    s = hold(s, 2)
    s = roll(s)
    expect(s.dice[0]).toBe(kept[0])
    expect(s.dice[2]).toBe(kept[1])
  })
})

describe('hold mechanics', () => {
  it('hold before any roll is a ===no-op', () => {
    const s = createGame(SEED)
    expect(hold(s, 0)).toBe(s)
  })
  it('hold toggles the flag after a roll', () => {
    let s = roll(createGame(SEED))
    s = hold(s, 1)
    expect(s.held[1]).toBe(true)
    s = hold(s, 1)
    expect(s.held[1]).toBe(false)
  })
  it('hold out of range is a ===no-op', () => {
    const s = roll(createGame(SEED))
    expect(hold(s, 5)).toBe(s)
    expect(hold(s, -1)).toBe(s)
  })
  it('hold after the last roll (0 left) is a ===no-op', () => {
    let s = roll(createGame(SEED))
    s = roll(s)
    s = roll(s)
    expect(hold(s, 0)).toBe(s)
  })
})

// -- score / turn transitions ------------------------------------------------

describe('score & turn transitions', () => {
  it('scoring locks the value, advances the turn, and resets for the next turn', () => {
    let s = roll(createGame(SEED)) // [6,2,3,5,4]
    s = score(s, 'chance')
    expect(s.scores.chance).toBe(20)
    expect(s.turn).toBe(1)
    expect(s.rollsLeft).toBe(3)
    expect(s.rolled).toBe(false)
    expect(s.held).toEqual([false, false, false, false, false])
  })
  it('scoring a used category is a ===no-op', () => {
    let s = roll(createGame(SEED))
    s = score(s, 'chance')
    const rolled = roll(s)
    expect(score(rolled, 'chance')).toBe(rolled) // chance already used
  })
  it('scoring before rolling is a ===no-op', () => {
    const s = createGame(SEED)
    expect(score(s, 'chance')).toBe(s)
  })
  it('a wasted category can be scored as 0', () => {
    let s = withDice(createGame(SEED), [1, 1, 2, 3, 4])
    s = score(s, 'sixes') // no sixes → 0
    expect(s.scores.sixes).toBe(0)
  })
})

// -- Full 13-turn game -------------------------------------------------------

describe('full game to completion', () => {
  it('plays 13 turns (roll×3, no holds, score in order) → game over with a correct grand total', () => {
    let s = createGame(999)
    expect(isGameOver(s)).toBe(false)
    for (const cat of ALL_CATEGORIES) {
      s = roll(s)
      s = roll(s)
      s = roll(s)
      expect(s.rollsLeft).toBe(0)
      s = score(s, cat)
    }
    expect(s.turn).toBe(13)
    expect(s.status).toBe('over')
    expect(isGameOver(s)).toBe(true)
    // every category filled
    for (const cat of ALL_CATEGORIES) expect(s.scores[cat]).not.toBeNull()
    // grand total = upper + bonus + lower + yahtzee bonus, and is self-consistent
    const upper = UPPER_CATEGORIES.reduce((a, c) => a + (s.scores[c] ?? 0), 0)
    const lower = LOWER_CATEGORIES.reduce((a, c) => a + (s.scores[c] ?? 0), 0)
    const expected = upper + (upper >= 63 ? 35 : 0) + lower + s.yahtzeeBonus
    expect(grandTotal(s)).toBe(expected)
    expect(grandTotal(s)).toBeGreaterThan(0)
  })
  it('cannot roll or score after game over (===no-op)', () => {
    let s = createGame(999)
    for (const cat of ALL_CATEGORIES) {
      s = roll(s)
      s = score(s, cat)
    }
    expect(roll(s)).toBe(s)
    expect(score(s, 'chance')).toBe(s)
    expect(hold(s, 0)).toBe(s)
  })
})

// -- Determinism -------------------------------------------------------------

describe('determinism', () => {
  it('dieFromFloat maps [0,1) into 1..6', () => {
    expect(dieFromFloat(0)).toBe(1)
    expect(dieFromFloat(0.999999)).toBe(6)
    expect(dieFromFloat(0.5)).toBe(4)
  })
  it('mulberry32Step matches the closure form byte-for-byte', () => {
    const rng = mulberry32(SEED)
    let a = SEED >>> 0
    for (let i = 0; i < 20; i++) {
      const [v, next] = mulberry32Step(a)
      a = next
      expect(v).toBe(rng())
    }
  })
  it('golden: seed 12345 first roll is exactly [6,2,3,5,4]', () => {
    const s = roll(createGame(SEED))
    expect(s.dice).toEqual([6, 2, 3, 5, 4])
  })
  it('same seed + same moves ⇒ identical full-game result', () => {
    function play(seed: number): State {
      let s = createGame(seed)
      for (const cat of ALL_CATEGORIES) {
        s = roll(s)
        s = roll(s)
        s = score(s, cat)
      }
      return s
    }
    const a = play(777)
    const b = play(777)
    expect(a.scores).toEqual(b.scores)
    expect(grandTotal(a)).toBe(grandTotal(b))
    expect(a.rngState).toBe(b.rngState)
  })
})
