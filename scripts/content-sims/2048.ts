// 2048 strategy simulation against the real engine (src/lib/games/g2048/engine.ts).
// Run: npx tsx scripts/content-sims/2048.ts
// Deterministic: every game is seeded with mulberry32(seed) so results reproduce.
import { applyMove, move, newGame, type Board, type Direction, type GameState } from '../../src/lib/games/g2048/engine'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DIRS: Direction[] = ['left', 'right', 'up', 'down']
type Policy = (s: GameState, rng: () => number) => Direction

// 1. Random legal move.
const randomPolicy: Policy = (s, rng) => {
  const legal = DIRS.filter((d) => applyMove(s.board, d).moved)
  return legal[Math.floor(rng() * legal.length)]
}

// 2. Corner discipline: always try down, then left, then right, up only if forced.
const cornerPolicy: Policy = (s) => {
  for (const d of ['down', 'left', 'right', 'up'] as Direction[]) if (applyMove(s.board, d).moved) return d
  return 'up'
}

// 3. Greedy: pick the move that leaves the most empty cells (ties -> corner order).
const empties = (b: Board) => b.flat().filter((v) => v === 0).length
const greedyPolicy: Policy = (s) => {
  let best: Direction = 'up'
  let bestVal = -1
  for (const d of ['down', 'left', 'right', 'up'] as Direction[]) {
    const r = applyMove(s.board, d)
    if (!r.moved) continue
    const v = empties(r.board) * 1000 + r.gained
    if (v > bestVal) {
      bestVal = v
      best = d
    }
  }
  return best
}

// 4. Corner + 1-ply evaluation: empties + monotonic snake toward bottom-left, 'up' only if forced.
const SNAKE = [
  [2 ** 3, 2 ** 2, 2 ** 1, 2 ** 0],
  [2 ** 4, 2 ** 5, 2 ** 6, 2 ** 7],
  [2 ** 11, 2 ** 10, 2 ** 9, 2 ** 8],
  [2 ** 12, 2 ** 13, 2 ** 14, 2 ** 15],
]
function evalBoard(b: Board): number {
  let w = 0
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) w += b[i][j] * SNAKE[i][j]
  return w + empties(b) * 4000
}
const snakePolicy: Policy = (s) => {
  let best: Direction | null = null
  let bestVal = -Infinity
  for (const d of ['down', 'left', 'right'] as Direction[]) {
    const r = applyMove(s.board, d)
    if (!r.moved) continue
    const v = evalBoard(r.board)
    if (v > bestVal) {
      bestVal = v
      best = d
    }
  }
  return best ?? 'up'
}

// 5. Two-ply expectimax: my move -> every possible spawn (2 @ 0.9, 4 @ 0.1) -> my best reply,
//    scored with the same snake weights + empty-cell bonus. Uses all four directions.
function bestReply(b: Board): number {
  let best = -Infinity
  for (const d of DIRS) {
    const r = applyMove(b, d)
    if (r.moved) best = Math.max(best, evalBoard(r.board))
  }
  return best === -Infinity ? -1e12 : best
}
function chanceValue(b: Board): number {
  const cells: [number, number][] = []
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (b[i][j] === 0) cells.push([i, j])
  if (!cells.length) return bestReply(b)
  let total = 0
  for (const [i, j] of cells) {
    for (const [v, p] of [[2, 0.9], [4, 0.1]] as const) {
      const nb = b.map((r) => [...r])
      nb[i][j] = v
      total += p * bestReply(nb)
    }
  }
  return total / cells.length
}
const expectimaxPolicy: Policy = (s) => {
  let best: Direction = 'up'
  let bestVal = -Infinity
  for (const d of DIRS) {
    const r = applyMove(s.board, d)
    if (!r.moved) continue
    const v = chanceValue(r.board)
    if (v > bestVal) {
      bestVal = v
      best = d
    }
  }
  return best
}

interface Result { score: number; maxTile: number; moves: number; scoreAt2048: number | null }

function play(policy: Policy, seed: number): Result {
  const rng = mulberry32(seed)
  const prng = mulberry32(seed ^ 0x9e3779b9)
  let s = newGame(rng)
  let moves = 0
  let scoreAt2048: number | null = null
  while (!s.over && moves < 100000) {
    const d = policy(s, prng)
    const n = move(s, d, rng)
    if (n === s) break
    s = n
    moves++
    if (scoreAt2048 === null && s.won) scoreAt2048 = s.score
  }
  return { score: s.score, maxTile: Math.max(...s.board.flat()), moves, scoreAt2048 }
}

function pct(n: number, d: number) {
  return ((100 * n) / d).toFixed(1) + '%'
}

const N_DEFAULT = Number(process.env.N ?? 2000)
const N_SEARCH = Number(process.env.N_SEARCH ?? 200)
const policies: [string, Policy, number][] = [
  ['random', randomPolicy, N_DEFAULT],
  ['corner (down>left>right>up)', cornerPolicy, N_DEFAULT],
  ['greedy most-empty', greedyPolicy, N_DEFAULT],
  ['snake-weighted 1-ply', snakePolicy, N_DEFAULT],
  ['snake-weighted 2-ply expectimax', expectimaxPolicy, N_SEARCH],
]
for (const [name, p, N] of policies) {
  const rs: Result[] = []
  for (let i = 0; i < N; i++) rs.push(play(p, 1000 + i))
  const scores = rs.map((r) => r.score).sort((a, b) => a - b)
  const mean = scores.reduce((a, b) => a + b, 0) / N
  const median = scores[Math.floor(N / 2)]
  const reach = (t: number) => pct(rs.filter((r) => r.maxTile >= t).length, N)
  const meanMoves = rs.reduce((a, r) => a + r.moves, 0) / N
  const at2048 = rs.filter((r) => r.scoreAt2048 !== null).map((r) => r.scoreAt2048!)
  console.log(`\n== ${name} (N=${N}) ==`)
  console.log(`mean score ${mean.toFixed(0)}, median ${median}, max ${scores[N - 1]}, mean moves ${meanMoves.toFixed(0)}`)
  console.log(`reached 256: ${reach(256)}, 512: ${reach(512)}, 1024: ${reach(1024)}, 2048: ${reach(2048)}, 4096: ${reach(4096)}, 8192: ${reach(8192)}`)
  if (at2048.length) {
    at2048.sort((a, b) => a - b)
    console.log(`score at moment of first 2048 tile: min ${at2048[0]}, median ${at2048[Math.floor(at2048.length / 2)]}, max ${at2048[at2048.length - 1]} (n=${at2048.length})`)
  }
}
