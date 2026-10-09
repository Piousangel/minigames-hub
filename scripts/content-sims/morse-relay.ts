/**
 * Morse Relay content simulation — feeds src/content/guides/morse-relay.ts.
 *
 * Feeds a modelled human keyer into the REAL reducer (createGame/reduce) and
 * measures what timing consistency is worth at each level.
 *
 * Keyer model (an assumption, stated in the guide): the player's true unit is
 * 100 ms. Every press and every gap is its ideal length (1/3 units for
 * dot/dash, 1/3/7 units for element/letter/word gaps) multiplied by
 * (1 + sigma * z), z ~ standard normal. sigma = timing spread (coefficient of
 * variation). Words are drawn from the level's real bucket with a seeded RNG.
 *
 * Part 2 is deterministic: a keyer with perfect timing except the FIRST press
 * of the word, which is off by a factor f. Shows the window of f for which the
 * word still goes through with no mistakes and every symbol clean.
 *
 * Run: npx tsx scripts/content-sims/morse-relay.ts [wordsPerCell=2000]
 */
import {
  WORD_BUCKETS,
  buildTarget,
  createGame,
  reduce,
  toleranceFor,
  wordBucketIndex,
  type MorseRelayState,
} from '../../src/lib/games/morse-relay/engine'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const N = Number(process.argv[2] ?? 2000)
const U = 100

function gauss(rng: () => number) {
  const u = Math.max(rng(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

/** Key one whole word at a fixed level. `len(kind, ideal)` returns the actual ms. */
function keyWord(word: string, level: number, len: (ideal: number, isFirstPress: boolean) => number) {
  let s: MorseRelayState = { ...createGame(1), level, target: buildTarget(word), targetLabel: word }
  const startLives = s.lives
  let t = 1000
  const target = s.target
  let first = true
  let symbolsKeyed = 0
  let cleanSymbols = 0
  for (let li = 0; li < target.length; li++) {
    const letter = target[li]
    for (let si = 0; si < letter.pattern.length; si++) {
      if (li > 0 || si > 0) {
        const gapIdeal = si > 0 ? 1 : target[li - 1].wordBreakAfter ? 7 : 3
        t += Math.max(5, len(gapIdeal, false))
      }
      s = reduce(s, { type: 'down', t })
      if (s.lost) break
      t += Math.max(5, len(letter.pattern[si] === '.' ? 1 : 3, first))
      first = false
      const comboBefore = s.combo
      s = reduce(s, { type: 'up', t })
      symbolsKeyed++
      if (s.lastEvent === 'symbolOk' && s.combo > comboBefore) cleanSymbols++
      if (s.lost) break
    }
    if (s.lost) break
  }
  if (!s.lost) s = reduce(s, { type: 'tick', t: t + 2900 })
  return {
    livesLost: startLives - s.lives,
    mistakes: s.mistakes,
    done: s.lastEvent === 'wordComplete',
    cleanSymbols,
    symbolsKeyed,
    score: s.score,
  }
}

console.log(`Part 1 — modelled keyer, ${N} words per cell (unit 100 ms)`)
console.log('level tol   sigma  lives-lost/word  words-with-0-mistakes  clean-symbol-rate  avg-score/word')
for (const level of [1, 2, 3, 4, 6]) {
  for (const sigma of [0.1, 0.2, 0.3]) {
    const rng = mulberry32(level * 1000 + Math.round(sigma * 100))
    const bucket = WORD_BUCKETS[wordBucketIndex(level)]
    let lives = 0
    let perfect = 0
    let clean = 0
    let keyed = 0
    let score = 0
    for (let i = 0; i < N; i++) {
      const word = bucket[Math.floor(rng() * bucket.length)]
      const r = keyWord(word, level, (ideal) => ideal * U * (1 + sigma * gauss(rng)))
      lives += r.livesLost
      if (r.mistakes === 0) perfect++
      clean += r.cleanSymbols
      keyed += r.symbolsKeyed
      score += r.score
    }
    console.log(
      `${String(level).padStart(5)} ${toleranceFor(level).toFixed(2)}  ${sigma.toFixed(2)}   ${(lives / N).toFixed(2).padStart(14)}  ${((100 * perfect) / N).toFixed(1).padStart(20)}%  ${((100 * clean) / keyed).toFixed(1).padStart(16)}%  ${(score / N).toFixed(0).padStart(13)}`,
    )
  }
}

console.log('\nPart 2 — perfect keyer, first press off by factor f (all levels, every word in the bucket)')
console.log('level  window of f with 0 mistakes      window of f with 0 mistakes AND all symbols clean')
for (const level of [1, 2, 3, 4, 5, 6]) {
  const bucket = WORD_BUCKETS[wordBucketIndex(level)]
  const okF: number[] = []
  const cleanF: number[] = []
  for (let f = 0.3; f <= 3.0001; f += 0.01) {
    let allOk = true
    let allClean = true
    for (const word of bucket) {
      const r = keyWord(word, level, (ideal, isFirst) => ideal * U * (isFirst ? f : 1))
      if (r.mistakes > 0 || !r.done) allOk = false
      if (r.cleanSymbols !== r.symbolsKeyed) allClean = false
    }
    if (allOk) okF.push(f)
    if (allOk && allClean) cleanF.push(f)
  }
  const span = (a: number[]) => (a.length ? `${a[0].toFixed(2)}–${a[a.length - 1].toFixed(2)}` : 'none')
  console.log(`${String(level).padStart(5)}  ${span(okF).padEnd(32)} ${span(cleanF)}`)
}
