/**
 * Minesweeper content simulation — feeds src/content/guides/minesweeper.ts.
 *
 * Plays N boards through the REAL engine (newMinesweeper/reveal) with a seeded
 * RNG and measures:
 *   1. how often the first click opens an area (lands on a 0) by click position,
 *      plus how many cells it uncovers;
 *   2. how often a perfect-logic player (exact constraint enumeration including
 *      the global mine count) can clear the board without ever guessing;
 *   3. the win rate of that player when it must guess (it picks the lowest-risk
 *      unknown cell).
 *
 * Run: npx tsx scripts/content-sims/minesweeper.ts [boardsPerStart=5000]
 */
import { MS_MINES, MS_SIZE, newMinesweeper, reveal, type MsState } from '../../src/lib/games/minesweeper/engine'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const N = Number(process.argv[2] ?? 5000)
const idx = (x: number, y: number) => y * MS_SIZE + x
const nbrs: number[][] = []
for (let y = 0; y < MS_SIZE; y++)
  for (let x = 0; x < MS_SIZE; x++) {
    const out: number[] = []
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < MS_SIZE && ny < MS_SIZE) out.push(idx(nx, ny))
      }
    nbrs.push(out)
  }

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return r
}

/** Exact mine probability for every unknown cell, given revealed numbers + known mines. */
function probabilities(s: MsState, known: Set<number>): Map<number, number> {
  const cells = MS_SIZE * MS_SIZE
  const revealed = (i: number) => s.grid[Math.floor(i / MS_SIZE)][i % MS_SIZE].revealed
  const constraints: Array<{ cells: number[]; need: number }> = []
  const frontierSet = new Set<number>()
  for (let i = 0; i < cells; i++) {
    if (!revealed(i)) continue
    const c = s.grid[Math.floor(i / MS_SIZE)][i % MS_SIZE]
    const unk = nbrs[i].filter((n) => !revealed(n) && !known.has(n))
    if (unk.length === 0) continue
    const need = c.adjacent - nbrs[i].filter((n) => known.has(n)).length
    constraints.push({ cells: unk, need })
    unk.forEach((u) => frontierSet.add(u))
  }
  const interior: number[] = []
  for (let i = 0; i < cells; i++) if (!revealed(i) && !known.has(i) && !frontierSet.has(i)) interior.push(i)
  // order frontier cells by adjacency so constraints close early (better pruning)
  const frontier: number[] = []
  const seen = new Set<number>()
  for (const start of frontierSet) {
    if (seen.has(start)) continue
    const q = [start]
    seen.add(start)
    while (q.length) {
      const c = q.shift()!
      frontier.push(c)
      for (const n of nbrs[c]) if (frontierSet.has(n) && !seen.has(n)) {
        seen.add(n)
        q.push(n)
      }
    }
  }
  const pos = new Map(frontier.map((c, i) => [c, i]))
  const byCell: number[][] = frontier.map(() => [])
  constraints.forEach((k, ci) => k.cells.forEach((c) => byCell[pos.get(c)!].push(ci)))
  const lastIdx = constraints.map((k) => Math.max(...k.cells.map((c) => pos.get(c)!)))
  const minesLeft = MS_MINES - known.size
  const assign = new Array<number>(frontier.length).fill(0)
  const sum = new Array<number>(constraints.length).fill(0)
  const weightByCell = new Array<number>(frontier.length).fill(0)
  let interiorMineWeight = 0
  let total = 0
  const rec = (i: number, used: number) => {
    if (used > minesLeft) return
    if (i === frontier.length) {
      const rest = minesLeft - used
      const w = choose(interior.length, rest)
      if (w === 0) return
      total += w
      for (let j = 0; j < frontier.length; j++) if (assign[j]) weightByCell[j] += w
      if (interior.length) interiorMineWeight += (w * rest) / interior.length
      return
    }
    for (const v of [0, 1]) {
      assign[i] = v
      let ok = true
      for (const ci of byCell[i]) {
        sum[ci] += v
        const k = constraints[ci]
        if (sum[ci] > k.need || (lastIdx[ci] === i && sum[ci] !== k.need)) ok = false
      }
      if (ok) rec(i + 1, used + v)
      for (const ci of byCell[i]) sum[ci] -= v
    }
    assign[i] = 0
  }
  rec(0, 0)
  const out = new Map<number, number>()
  frontier.forEach((c, j) => out.set(c, weightByCell[j] / total))
  for (const c of interior) out.set(c, interiorMineWeight / total)
  return out
}

type Start = 'corner' | 'edge' | 'center'
const startCell: Record<Start, [number, number]> = { corner: [0, 0], edge: [4, 0], center: [4, 4] }

function play(start: Start, rng: () => number) {
  let s = reveal(newMinesweeper(), startCell[start][0], startCell[start][1], rng)
  const firstOpened = s.grid.flat().filter((c) => c.revealed).length
  const opened = s.grid[startCell[start][1]][startCell[start][0]].adjacent === 0
  const known = new Set<number>()
  let guesses = 0
  while (!s.over) {
    const p = probabilities(s, known)
    let progressed = false
    for (const [c, pr] of p) {
      if (pr > 1 - 1e-9) known.add(c)
    }
    for (const [c, pr] of p) {
      if (pr < 1e-9) {
        s = reveal(s, c % MS_SIZE, Math.floor(c / MS_SIZE), rng)
        progressed = true
      }
    }
    if (progressed) continue
    // forced guess: lowest risk cell
    let best = -1
    let bestP = 2
    for (const [c, pr] of p) if (!known.has(c) && pr < bestP) {
        bestP = pr
        best = c
      }
    guesses++
    s = reveal(s, best % MS_SIZE, Math.floor(best / MS_SIZE), rng)
  }
  return { opened, firstOpened, guesses, won: s.won }
}

console.log(`Minesweeper ${MS_SIZE}x${MS_SIZE}, ${MS_MINES} mines — ${N} boards per start position`)
for (const start of ['corner', 'edge', 'center'] as Start[]) {
  const rng = mulberry32(start === 'corner' ? 1 : start === 'edge' ? 2 : 3)
  let opened = 0
  let openedCells = 0
  let noGuess = 0
  let wins = 0
  let guessGames = 0
  let guessWins = 0
  const guessHist: Record<string, number> = {}
  for (let i = 0; i < N; i++) {
    const r = play(start, rng)
    if (r.opened) opened++
    openedCells += r.firstOpened
    if (r.guesses === 0) noGuess++
    else {
      guessGames++
      if (r.won) guessWins++
    }
    if (r.won) wins++
    const g = r.guesses >= 3 ? '3+' : String(r.guesses)
    guessHist[g] = (guessHist[g] ?? 0) + 1
  }
  const pct = (x: number) => ((100 * x) / N).toFixed(1) + '%'
  console.log(
    `${start.padEnd(6)} first click opens area: ${pct(opened)} | avg cells after 1st click: ${(openedCells / N).toFixed(1)} | ` +
      `solvable w/o guessing: ${pct(noGuess)} | perfect-play win rate: ${pct(wins)} | ` +
      `win rate when a guess was needed: ${((100 * guessWins) / Math.max(1, guessGames)).toFixed(1)}% | guesses/game ${JSON.stringify(guessHist)}`,
  )
}
// exact (analytic) chance the first click is a zero, given only the clicked cell is excluded
const cellsLeft = MS_SIZE * MS_SIZE - 1
for (const [name, k] of [['corner', 3], ['edge', 5], ['center', 8]] as const) {
  console.log(`analytic P(first click is a 0) ${name}: ${((100 * choose(cellsLeft - k, MS_MINES)) / choose(cellsLeft, MS_MINES)).toFixed(1)}%`)
}
