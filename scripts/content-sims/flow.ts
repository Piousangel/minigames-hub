// Flow level-bank analysis against the real engine (src/lib/games/flow/engine.ts).
// Run: npx tsx scripts/content-sims/flow.ts
//
// For every shipped level: board size, pair count, endpoint-only cells vs open cells,
// how many endpoints sit on the border, how many DISTINCT full-coverage solutions exist
// (exhaustive count, capped), and how much search the engine's own solver needs.
import { LEVELS, difficultyOf, solve, type Level } from '../../src/lib/games/flow/engine'

const CAP = 10_000

/** Count full-cover solutions (every pair linked, every cell filled), capped at CAP. */
function countSolutions(level: Level): { count: number; nodes: number } {
  const N = level.size
  const owner = new Array<number>(N * N).fill(-1)
  const idx = (r: number, c: number) => r * N + c
  const colors = level.pairs.map((p, k) => ({ k, a: idx(p.a[0], p.a[1]), b: idx(p.b[0], p.b[1]) }))
  for (const c of colors) {
    owner[c.a] = c.k
    owner[c.b] = c.k
  }
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  let count = 0
  let nodes = 0
  function extend(cur: number, k: number, bk: number, nextK: number) {
    if (count >= CAP) return
    nodes++
    const r = Math.floor(cur / N)
    const c = cur % N
    for (const [dr, dc] of DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue
      const ni = idx(nr, nc)
      if (ni === bk) dfs(nextK)
      else if (owner[ni] === -1) {
        owner[ni] = k
        extend(ni, k, bk, nextK)
        owner[ni] = -1
      }
    }
  }
  function dfs(k: number) {
    if (k === colors.length) {
      for (let i = 0; i < N * N; i++) if (owner[i] === -1) return
      count++
      return
    }
    extend(colors[k].a, colors[k].k, colors[k].b, k + 1)
  }
  dfs(0)
  return { count, nodes }
}

/** Search nodes needed by a solver that stops at the FIRST solution (proxy for difficulty). */
function firstSolutionNodes(level: Level): number {
  // Re-implement the engine solver's order but count steps; also assert engine agrees.
  if (!solve(level)) throw new Error('engine says unsolvable')
  const N = level.size
  const owner = new Array<number>(N * N).fill(-1)
  const idx = (r: number, c: number) => r * N + c
  const colors = level.pairs.map((p, k) => ({ k, a: idx(p.a[0], p.a[1]), b: idx(p.b[0], p.b[1]) }))
  for (const c of colors) {
    owner[c.a] = c.k
    owner[c.b] = c.k
  }
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  let steps = 0
  function extend(cur: number, k: number, bk: number, nextK: number): boolean {
    steps++
    const r = Math.floor(cur / N)
    const c = cur % N
    for (const [dr, dc] of DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue
      const ni = idx(nr, nc)
      if (ni === bk) {
        if (dfs(nextK)) return true
      } else if (owner[ni] === -1) {
        owner[ni] = k
        if (extend(ni, k, bk, nextK)) return true
        owner[ni] = -1
      }
    }
    return false
  }
  function dfs(k: number): boolean {
    if (k === colors.length) {
      for (let i = 0; i < N * N; i++) if (owner[i] === -1) return false
      return true
    }
    return extend(colors[k].a, colors[k].k, colors[k].b, k + 1)
  }
  dfs(0)
  return steps
}

const onBorder = (size: number, [r, c]: [number, number]) => r === 0 || c === 0 || r === size - 1 || c === size - 1
const adjacentPair = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1

const bySize = new Map<number, number>()
let unique = 0
console.log('lvl size diff  pairs openCells borderEnds adjPairs solutions firstSolveNodes')
LEVELS.forEach((lv, i) => {
  bySize.set(lv.size, (bySize.get(lv.size) ?? 0) + 1)
  const ends = lv.pairs.flatMap((p) => [p.a, p.b])
  const border = ends.filter((e) => onBorder(lv.size, e)).length
  const adj = lv.pairs.filter((p) => adjacentPair(p.a, p.b)).length
  const { count } = countSolutions(lv)
  if (count === 1) unique++
  const nodes = firstSolutionNodes(lv)
  console.log(
    `${String(i + 1).padStart(3)} ${lv.size}x${lv.size} ${difficultyOf(lv).padEnd(6)} ${lv.pairs.length}     ${String(lv.size * lv.size - ends.length).padStart(3)}       ${border}/${ends.length}       ${adj}        ${count >= CAP ? `>=${CAP}` : count}       ${nodes}`,
  )
})
console.log(`\nlevels by size: ${[...bySize.entries()].map(([s, n]) => `${s}x${s}: ${n}`).join(', ')} (total ${LEVELS.length})`)
console.log(`levels with exactly one full-coverage solution: ${unique}/${LEVELS.length}`)
