/**
 * Yahtzee: three bot strategies played through the site's real engine.
 * Run: npx tsx scripts/content-sims/yahtzee-strategies.ts
 * Deterministic: game i uses engine seed (BASE_SEED + i).
 */
import {
  ALL_CATEGORIES,
  UPPER_CATEGORIES,
  bestCategory,
  categoryScore,
  counts,
  createGame,
  grandTotal,
  hold,
  roll,
  score,
  upperBonus,
  upperTotal,
  type Category,
  type State,
} from '../../src/lib/games/yahtzee/engine'

const GAMES = 100_000
const BASE_SEED = 20261009

type Strategy = { name: string; play: (s: State) => State }

function setHolds(s: State, want: boolean[]): State {
  let out = s
  for (let i = 0; i < 5; i++) if (out.held[i] !== want[i]) out = hold(out, i)
  return out
}

/** A. One roll, then take whatever category scores most right now. */
const noReroll: Strategy = {
  name: 'One roll, best box',
  play: (s) => {
    const r = roll(s)
    return score(r, bestCategory(r)!)
  },
}

/** Hold every die showing the most common face (ties → higher face). */
function holdMostCommon(dice: number[]): boolean[] {
  const c = counts(dice)
  let face = 6
  for (let f = 6; f >= 1; f--) if (c[f] > c[face]) face = f
  return dice.map((d) => d === face)
}

/** B. Chase the most common face for all three rolls, then best box. */
const chaseKind: Strategy = {
  name: 'Chase of-a-kind, best box',
  play: (s) => {
    let r = roll(s)
    while (r.rollsLeft > 0) r = roll(setHolds(r, holdMostCommon(r.dice)))
    return score(r, bestCategory(r)!)
  },
}

/** Longest run of consecutive distinct faces present → the faces in it. */
function longestRun(dice: number[]): number[] {
  const c = counts(dice)
  let best: number[] = []
  let cur: number[] = []
  for (let f = 1; f <= 6; f++) {
    if (c[f] > 0) cur = [...cur, f]
    else cur = []
    if (cur.length > best.length) best = cur
  }
  return best
}

const open = (s: State, cat: Category) => s.scores[cat] === null

/** Expected-ish "par" per box: scoring below par costs future value. */
const PAR: Record<Category, number> = {
  ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18,
  threeKind: 22, fourKind: 13, fullHouse: 20, smallStraight: 24,
  largeStraight: 26, yahtzee: 18, chance: 22,
}

function chooseBox(s: State): Category {
  let best: Category = ALL_CATEGORIES.find((c) => open(s, c))!
  let bestVal = -Infinity
  const upNow = upperTotal(s)
  for (const cat of ALL_CATEGORIES) {
    if (!open(s, cat)) continue
    const v = categoryScore(cat, s.dice)
    let value = v - PAR[cat]
    if ((UPPER_CATEGORIES as readonly string[]).includes(cat)) {
      // Crossing 63 with this box is worth the +35 bonus.
      if (upNow < 63 && upNow + v >= 63) value += 35
    }
    if (cat === 'yahtzee' && v === 50) value += 100
    if (value > bestVal) {
      bestVal = value
      best = cat
    }
  }
  return best
}

function heuristicHolds(s: State): boolean[] | null {
  const d = s.dice
  if (open(s, 'yahtzee') && categoryScore('yahtzee', d) > 0) return null
  if (open(s, 'largeStraight') && categoryScore('largeStraight', d) > 0) return null
  if (open(s, 'fullHouse') && categoryScore('fullHouse', d) > 0 && !open(s, 'yahtzee')) return null
  const c = counts(d)
  const maxCount = Math.max(...c)
  const run = longestRun(d)
  const straightsOpen = open(s, 'smallStraight') || open(s, 'largeStraight')
  if (straightsOpen && maxCount <= 2 && run.length >= 3) {
    if (run.length >= 4 && !open(s, 'largeStraight')) return null // small straight made
    const used = new Set<number>()
    return d.map((f) => (run.includes(f) && !used.has(f) ? (used.add(f), true) : false))
  }
  return holdMostCommon(d)
}

/** C. Situational: straights when they're live, par-aware box choice. */
const heuristic: Strategy = {
  name: 'Situational heuristic',
  play: (s) => {
    let r = roll(s)
    while (r.rollsLeft > 0) {
      const want = heuristicHolds(r)
      if (!want) break
      r = roll(setHolds(r, want))
    }
    return score(r, chooseBox(r))
  },
}

function pct(n: number, d: number) {
  return ((100 * n) / d).toFixed(1) + '%'
}

for (const strat of [noReroll, chaseKind, heuristic]) {
  const totals: number[] = []
  let bonus = 0
  let anyYahtzee = 0
  let lgStraight = 0
  let fullHouse = 0
  let zeros = 0
  let upperSum = 0
  const boxSum: Record<string, number> = {}
  for (const c of ALL_CATEGORIES) boxSum[c] = 0
  for (let i = 0; i < GAMES; i++) {
    let s = createGame(BASE_SEED + i)
    while (s.status === 'playing') s = strat.play(s)
    totals.push(grandTotal(s))
    if (upperBonus(s) > 0) bonus++
    if (s.scores.yahtzee === 50) anyYahtzee++
    if ((s.scores.largeStraight ?? 0) > 0) lgStraight++
    if ((s.scores.fullHouse ?? 0) > 0) fullHouse++
    zeros += ALL_CATEGORIES.filter((c) => s.scores[c] === 0).length
    upperSum += upperTotal(s)
    for (const c of ALL_CATEGORIES) boxSum[c] += s.scores[c] ?? 0
  }
  totals.sort((a, b) => a - b)
  const mean = totals.reduce((a, b) => a + b, 0) / GAMES
  const sd = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / GAMES)
  const q = (p: number) => totals[Math.floor(p * (GAMES - 1))]
  const over = (t: number) => pct(totals.filter((x) => x >= t).length, GAMES)
  console.log(`\n== ${strat.name} (${GAMES} games) ==`)
  console.log(`mean ${mean.toFixed(1)}  sd ${sd.toFixed(1)}  min ${totals[0]}  p10 ${q(0.1)}  median ${q(0.5)}  p90 ${q(0.9)}  max ${totals[GAMES - 1]}`)
  console.log(`>=150 ${over(150)}  >=200 ${over(200)}  >=250 ${over(250)}  >=300 ${over(300)}`)
  console.log(`upper bonus ${pct(bonus, GAMES)}  avg upper ${(upperSum / GAMES).toFixed(1)}  yahtzee box=50 ${pct(anyYahtzee, GAMES)}`)
  console.log('avg per box: ' + ALL_CATEGORIES.map((c) => `${c} ${(boxSum[c] / GAMES).toFixed(1)}`).join(', '))
  console.log(`large straight scored ${pct(lgStraight, GAMES)}  full house scored ${pct(fullHouse, GAMES)}  avg zero boxes ${(zeros / GAMES).toFixed(2)}`)
}
