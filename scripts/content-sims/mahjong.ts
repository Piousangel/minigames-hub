// Mahjong Solitaire play-policy simulation against the real engine
// (src/lib/games/mahjong/engine.ts). Run: npx tsx scripts/content-sims/mahjong.ts
//
// Every deal from createGame(seed) is solvable by construction. The question players
// care about is how easy it is to throw that away: how often does a given move-picking
// habit dead-end, and how much do the 3 rescue shuffles help?
import {
  LAYOUT,
  MAX_SHUFFLES,
  availableMatches,
  createGame,
  findSolution,
  generate,
  freeTiles,
  mulberry32,
  removePair,
  shuffle,
  type State,
} from '../../src/lib/games/mahjong/engine'

type Policy = (s: State, rng: () => number) => [number, number]

const randomPick: Policy = (s, rng) => {
  const m = availableMatches(s)
  return m[Math.floor(rng() * m.length)]
}
// What the in-game Hint button highlights: availableMatches(s)[0].
const hintPick: Policy = (s) => availableMatches(s)[0]

const zOf = (i: number) => LAYOUT[i].z
// Heuristic: (1) if all remaining copies of a face are free, clear them (can't hurt);
// (2) otherwise prefer the pair that frees the most new tiles; (3) then higher layers;
// (4) then tiles at the ends of long rows (smaller "|x - centre|" penalty reversed).
const keyOf = (s: State, i: number) => {
  const t = s.tiles[i]!
  return t.kind === 'flower' || t.kind === 'season' ? t.kind : `${t.kind}:${t.value}`
}
const smartPick: Policy = (s) => {
  const m = availableMatches(s)
  const free = new Set(freeTiles(s))
  const remain = new Map<string, number>()
  const freeCount = new Map<string, number>()
  s.tiles.forEach((t, i) => {
    if (!t) return
    const k = keyOf(s, i)
    remain.set(k, (remain.get(k) ?? 0) + 1)
    if (free.has(i)) freeCount.set(k, (freeCount.get(k) ?? 0) + 1)
  })
  let best = m[0]
  let bestScore = -Infinity
  for (const [i, j] of m) {
    const k = keyOf(s, i)
    const safe = remain.get(k) === freeCount.get(k) ? 1000 : 0
    const after = removePair(s, i, j)
    const newlyFree = freeTiles(after).filter((x) => !free.has(x)).length
    const score = safe + newlyFree * 10 + zOf(i) + zOf(j)
    if (score > bestScore) {
      bestScore = score
      best = [i, j]
    }
  }
  return best
}

// Row-aware heuristic: safe pairs first; otherwise prefer tiles that sit in the row with the
// most tiles still in it (long rows can only be peeled from their ends) and tiles that cover
// tiles below; tie-break by how many matching pairs the move leaves available.
function blockWeight(s: State, i: number): number {
  const a = LAYOUT[i]
  let w = 0
  s.tiles.forEach((t, j) => {
    if (!t || j === i) return
    const b = LAYOUT[j]
    if (b.z === a.z && b.y === a.y) w += 1 // same row, still present
    if (b.z === a.z - 1 && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2) w += 3 // covered tile
  })
  return w
}
const rowPick: Policy = (s) => {
  const m = availableMatches(s)
  const free = new Set(freeTiles(s))
  const remain = new Map<string, number>()
  const freeCount = new Map<string, number>()
  s.tiles.forEach((t, i) => {
    if (!t) return
    const k = keyOf(s, i)
    remain.set(k, (remain.get(k) ?? 0) + 1)
    if (free.has(i)) freeCount.set(k, (freeCount.get(k) ?? 0) + 1)
  })
  let best = m[0]
  let bestScore = -Infinity
  for (const [i, j] of m) {
    const k = keyOf(s, i)
    const safe = remain.get(k) === freeCount.get(k) ? 1e6 : 0
    const after = removePair(s, i, j)
    const score = safe + (blockWeight(s, i) + blockWeight(s, j)) * 100 + availableMatches(after).length
    if (score > bestScore) {
      bestScore = score
      best = [i, j]
    }
  }
  return best
}

interface Outcome { cleared: boolean; tilesLeft: number; shufflesUsed: number }

function play(seed: number, policy: Policy, useShuffles: boolean): Outcome {
  const rng = mulberry32(seed ^ 0x5bd1e995)
  let s = createGame(seed)
  let shufflesUsed = 0
  if (!useShuffles) s = { ...s, shufflesLeft: 0 }
  for (;;) {
    if (s.status === 'won') return { cleared: true, tilesLeft: 0, shufflesUsed }
    const m = availableMatches(s)
    if (m.length === 0) {
      if (useShuffles && s.shufflesLeft > 0) {
        s = shuffle(s, rng)
        shufflesUsed++
        continue
      }
      return { cleared: false, tilesLeft: s.tiles.filter(Boolean).length, shufflesUsed }
    }
    const [i, j] = policy(s, rng)
    s = removePair(s, i, j)
  }
}

const N = Number(process.env.N ?? 500)

// Opening position statistics.
let freeSum = 0
let matchSum = 0
let minMatches = Infinity
let maxMatches = 0
for (let seed = 1; seed <= N; seed++) {
  const s = createGame(seed)
  freeSum += freeTiles(s).length
  const m = availableMatches(s).length
  matchSum += m
  minMatches = Math.min(minMatches, m)
  maxMatches = Math.max(maxMatches, m)
}
console.log(`Opening (N=${N} deals): free tiles avg ${(freeSum / N).toFixed(1)} of ${LAYOUT.length}; available matching pairs avg ${(matchSum / N).toFixed(1)} (min ${minMatches}, max ${maxMatches})`)
const layers = [0, 1, 2, 3].map((z) => LAYOUT.filter((p) => p.z === z).length)
console.log(`Layout tiles per layer z0..z3: ${layers.join(', ')}`)

for (const [name, policy] of [
  ['random pair', randomPick],
  ['always take Hint pair', hintPick],
  ['heuristic (safe > unblock > high layer)', smartPick],
  ['row-aware (safe > longest row / covering > options)', rowPick],
] as [string, Policy][]) {
  for (const useShuffles of [false, true]) {
    let cleared = 0
    let leftSum = 0
    let shufSum = 0
    for (let seed = 1; seed <= N; seed++) {
      const o = play(seed, policy, useShuffles)
      if (o.cleared) cleared++
      else leftSum += o.tilesLeft
      shufSum += o.shufflesUsed
    }
    const fails = N - cleared
    console.log(
      `${name} | shuffles ${useShuffles ? `up to ${MAX_SHUFFLES}` : 'none'} | cleared ${cleared}/${N} (${((100 * cleared) / N).toFixed(1)}%) | avg tiles left when stuck ${fails ? (leftSum / fails).toFixed(1) : '-'} | avg shuffles used ${(shufSum / N).toFixed(2)}`,
    )
  }
}

// Does a rescue shuffle keep the board solvable? Play random pairs until stuck, then shuffle
// once and ask the engine's independent solver whether the new arrangement can be cleared.
const M = Number(process.env.M ?? 200)
let stuckBoards = 0
let solvableAfter = 0
let unknown = 0
for (let seed = 1; stuckBoards < M && seed < 100000; seed++) {
  const rng = mulberry32(seed ^ 0x1234567)
  let s = createGame(seed)
  while (s.status === 'playing' && availableMatches(s).length > 0) {
    const [i, j] = randomPick(s, rng)
    s = removePair(s, i, j)
  }
  if (s.status !== 'playing') continue
  stuckBoards++
  const after = shuffle(s, rng)
  const sol = findSolution(after.tiles)
  if (sol) solvableAfter++
  else if (availableMatches(after).length === 0) {
    /* immediately stuck again */
  } else unknown++
}
// Calibration: same solver on positions KNOWN to be solvable (a deal's own winning line
// played forward to the same tile counts), so a low rate above is not just solver budget.
let calib = 0
let calibOk = 0
for (let seed = 1; calib < M; seed++) {
  const { state, solution } = generate(mulberry32(seed))
  let s = state
  const k = 30 + (seed % 25) // leave roughly 28..56 tiles, like the stuck boards above
  for (let x = 0; x < k && x < solution.length; x++) s = removePair(s, solution[x][0], solution[x][1])
  calib++
  if (findSolution(s.tiles)) calibOk++
}
console.log(`Calibration: solver clears ${calibOk}/${calib} known-solvable mid-game positions`)
console.log(`Stuck boards reshuffled once: ${stuckBoards}; solver clears the reshuffled board in ${solvableAfter} (${((100 * solvableAfter) / stuckBoards).toFixed(1)}%)${unknown ? `; ${unknown} not cleared within the solver budget` : ''}`)
