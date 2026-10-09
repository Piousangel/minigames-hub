/**
 * Word Guess: which opening word works best against THIS site's answer list?
 * Run: npx tsx scripts/content-sims/wordguess-openers.ts
 * Uses the real engine's ANSWERS, VALID_GUESSES, scoreGuess and submitGuess.
 * Deterministic: the only randomness (the "random consistent" bot) is seeded.
 */
import {
  ANSWERS,
  MAX_GUESSES,
  VALID_GUESSES,
  mulberry32,
  scoreGuess,
  submitGuess,
  type GameState,
  type LetterState,
} from '../../src/lib/games/wordguess/engine'

const answers = [...new Set(ANSWERS)]
const guesses = [...VALID_GUESSES]

const code = (r: LetterState[]) =>
  r.reduce((acc, x) => acc * 3 + (x === 'correct' ? 2 : x === 'present' ? 1 : 0), 0)
const SOLVED = code(['correct', 'correct', 'correct', 'correct', 'correct'])

// pattern[g][a] for every legal guess × every answer, via the engine's scorer.
const pattern: Uint8Array[] = guesses.map((g) => {
  const row = new Uint8Array(answers.length)
  answers.forEach((a, j) => (row[j] = code(scoreGuess(g, a))))
  return row
})
const gIdx = new Map(guesses.map((w, i) => [w, i]))

/** Expected number of answers still possible after guessing g (lower = better). */
function expectedLeft(g: number, cands: number[]) {
  const buckets = new Map<number, number>()
  for (const a of cands) buckets.set(pattern[g][a], (buckets.get(pattern[g][a]) ?? 0) + 1)
  let sq = 0
  for (const n of buckets.values()) sq += n * n
  return { exp: sq / cands.length, buckets: buckets.size, worst: Math.max(...buckets.values()) }
}

console.log(`answers: ${answers.length}, accepted guesses: ${guesses.length}, max guesses: ${MAX_GUESSES}\n`)

// ---- 1. Rank every legal opener by one-step information -------------------
const all = answers.map((_, i) => i)
const ranked = guesses
  .map((w, g) => ({ w, ...expectedLeft(g, all) }))
  .sort((a, b) => a.exp - b.exp || b.buckets - a.buckets)
console.log('Top 10 openers (expected answers left after guess 1):')
ranked.slice(0, 10).forEach((r, i) =>
  console.log(`${i + 1}. ${r.w}  exp ${r.exp.toFixed(1)}  patterns ${r.buckets}  worst-case ${r.worst}`),
)
console.log('Bottom 3:')
ranked.slice(-3).forEach((r) => console.log(`   ${r.w}  exp ${r.exp.toFixed(1)}  patterns ${r.buckets}  worst-case ${r.worst}`))
const POPULAR = ['crane', 'slate', 'stare', 'raise', 'arise', 'audio', 'adieu', 'trace', 'crate', 'salet', 'roate', 'soare']
console.log('Popular openers (rank among all legal guesses):')
for (const w of POPULAR) {
  const k = ranked.findIndex((r) => r.w === w)
  if (k < 0) console.log(`   ${w}  not accepted by this game`)
  else console.log(`   ${w}  rank ${k + 1}  exp ${ranked[k].exp.toFixed(1)}  patterns ${ranked[k].buckets}  worst-case ${ranked[k].worst}`)
}

// ---- 2. Play full games through submitGuess --------------------------------
type Picker = (cands: number[], turn: number, rng: () => number) => string

/** Greedy: any legal word minimising expected remaining; ties prefer a possible answer. */
const greedyAny: Picker = (cands) => {
  if (cands.length <= 2) return answers[cands[0]]
  let best = 0
  let bestScore = Infinity
  const candSet = new Set(cands.map((a) => answers[a]))
  for (let g = 0; g < guesses.length; g++) {
    const s = expectedLeft(g, cands).exp - (candSet.has(guesses[g]) ? 1e-6 : 0)
    if (s < bestScore) {
      bestScore = s
      best = g
    }
  }
  return guesses[best]
}

/** Hard-mode style: only ever guess a word that could still be the answer. */
const greedyCandidate: Picker = (cands) => {
  let best = cands[0]
  let bestScore = Infinity
  for (const a of cands) {
    const s = expectedLeft(gIdx.get(answers[a])!, cands).exp
    if (s < bestScore) {
      bestScore = s
      best = a
    }
  }
  return answers[best]
}

/** Casual player: a random word that fits every clue so far. */
const randomCandidate: Picker = (cands, _t, rng) => answers[cands[Math.floor(rng() * cands.length)]]

const RANDOM_PASSES = 20 // the random bot plays every answer 20 times (seeds 777..796)

function playAll(opener: string, pick: Picker, seed: number) {
  const passes = pick === randomCandidate ? RANDOM_PASSES : 1
  const dist = new Array(MAX_GUESSES + 2).fill(0)
  const cache = new Map<string, string>() // greedy bots are deterministic per clue history
  for (let pass = 0; pass < passes; pass++) {
    const rng = mulberry32(seed + pass)
    for (const answer of answers) {
      let state: GameState = { answer, guesses: [], status: 'playing' }
      let cands = all
      let history = ''
      while (state.status === 'playing') {
        let word: string
        if (state.guesses.length === 0) word = opener
        else if (pick !== randomCandidate && cache.has(history)) word = cache.get(history)!
        else {
          word = pick(cands, state.guesses.length, rng)
          if (pick !== randomCandidate) cache.set(history, word)
        }
        const next = submitGuess(state, word)
        if (next === state) throw new Error(`rejected guess ${word}`)
        state = next
        const p = code(state.guesses[state.guesses.length - 1].result)
        const gi = gIdx.get(word)!
        cands = cands.filter((a) => pattern[gi][a] === p)
        history += `${word}:${p};`
        if (p === SOLVED) break
      }
      dist[state.status === 'won' ? state.guesses.length : MAX_GUESSES + 1]++
    }
  }
  const total = answers.length * passes
  const won = total - dist[MAX_GUESSES + 1]
  const avg = dist.slice(1, MAX_GUESSES + 1).reduce((s, n, i) => s + n * (i + 1), 0) / won
  return { dist, won, avg, total }
}

console.log(`\nFull games over all ${answers.length} answers (dist = solved in 1..6, then failed):`)
const openers = [...ranked.slice(0, 3).map((r) => r.w), 'crane', 'slate', 'audio', ranked[ranked.length - 1].w]
for (const [name, pick] of [
  ['greedy (any legal word)', greedyAny],
  ['greedy (possible answers only)', greedyCandidate],
  ['random consistent word', randomCandidate],
] as const) {
  console.log(`-- bot: ${name}`)
  for (const op of openers) {
    if (!VALID_GUESSES.has(op)) continue
    const r = playAll(op, pick, 777)
    console.log(
      `   ${op.padEnd(6)} games ${r.total}  win ${((100 * r.won) / r.total).toFixed(1)}%  avg ${r.avg.toFixed(2)}  dist ${r.dist.slice(1).join('/')}`,
    )
  }
}

// Answer-list letter frequencies (supporting detail).
const freq = new Map<string, number>()
for (const w of answers) for (const ch of new Set(w)) freq.set(ch, (freq.get(ch) ?? 0) + 1)
console.log('\nLetters by share of answers containing them:')
console.log(
  [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([c, n]) => `${c} ${((100 * n) / answers.length).toFixed(0)}%`)
    .join(', '),
)
