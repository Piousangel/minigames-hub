/**
 * Sudoku content analysis — feeds src/content/guides/sudoku.ts.
 *
 * Generates puzzles with the REAL generator (newGame) under a seeded RNG and
 * measures, per difficulty:
 *   - the actual number of givens (target vs. what uniqueness allowed)
 *   - the hardest human technique a step-by-step solver needed, trying in
 *     order: naked single → hidden single → locked candidates (pointing /
 *     claiming) → naked pair → hidden pair → naked triple. Puzzles that stall
 *     after all of these are counted as "needs more" (X-wing, chains, …).
 *
 * Run: npx tsx scripts/content-sims/sudoku.ts [puzzlesPerDifficulty=500]
 */
import { CLUE_TARGETS, countGivens, newGame, type Difficulty, type Grid } from '../../src/lib/games/sudoku/engine'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const N = Number(process.argv[2] ?? 500)

// units: 27 lists of 9 cell indexes
const UNITS: number[][] = []
for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c))
for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c))
for (let b = 0; b < 9; b++)
  UNITS.push(Array.from({ length: 9 }, (_, i) => (Math.floor(b / 3) * 3 + Math.floor(i / 3)) * 9 + (b % 3) * 3 + (i % 3)))
const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const set = new Set<number>()
  for (const u of UNITS) if (u.includes(i)) u.forEach((c) => c !== i && set.add(c))
  return [...set]
})

const TECH = ['naked single', 'hidden single', 'locked candidates', 'naked pair', 'hidden pair', 'naked triple'] as const
type Tech = (typeof TECH)[number] | 'needs more'

function rate(puzzle: Grid): { hardest: Tech; counts: Record<string, number> } {
  const val = puzzle.flat()
  const cand: Set<number>[] = val.map((v) => (v ? new Set<number>() : new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])))
  for (let i = 0; i < 81; i++) if (val[i]) PEERS[i].forEach((p) => cand[p].delete(val[i]))
  const place = (i: number, v: number) => {
    val[i] = v
    cand[i].clear()
    PEERS[i].forEach((p) => cand[p].delete(v))
  }
  const counts: Record<string, number> = {}
  let hardest = 0
  const used = (t: number) => {
    counts[TECH[t]] = (counts[TECH[t]] ?? 0) + 1
    hardest = Math.max(hardest, t)
  }
  for (;;) {
    if (val.every((v) => v)) return { hardest: TECH[hardest], counts }
    // 0 naked single
    const i = val.findIndex((v, k) => !v && cand[k].size === 1)
    if (i >= 0) {
      place(i, [...cand[i]][0])
      used(0)
      continue
    }
    // 1 hidden single
    let done = false
    for (const u of UNITS) {
      for (let d = 1; d <= 9 && !done; d++) {
        const spots = u.filter((c) => !val[c] && cand[c].has(d))
        if (spots.length === 1 && !u.some((c) => val[c] === d)) {
          place(spots[0], d)
          used(1)
          done = true
        }
      }
      if (done) break
    }
    if (done) continue
    // 2 locked candidates: digit confined to the intersection of two units
    for (const a of UNITS) {
      for (let d = 1; d <= 9 && !done; d++) {
        const spots = a.filter((c) => !val[c] && cand[c].has(d))
        if (spots.length < 2) continue
        for (const b of UNITS) {
          if (b === a || !spots.every((c) => b.includes(c))) continue
          let changed = false
          for (const c of b) if (!spots.includes(c) && cand[c].has(d)) {
            cand[c].delete(d)
            changed = true
          }
          if (changed) {
            used(2)
            done = true
            break
          }
        }
      }
      if (done) break
    }
    if (done) continue
    // 3 naked pair / 5 naked triple
    for (const size of [2, 3]) {
      for (const u of UNITS) {
        const open = u.filter((c) => !val[c] && cand[c].size >= 2 && cand[c].size <= size)
        const combos = (arr: number[], k: number): number[][] =>
          k === 0 ? [[]] : arr.flatMap((x, j) => combos(arr.slice(j + 1), k - 1).map((r) => [x, ...r]))
        for (const group of combos(open, size)) {
          const union = new Set<number>()
          group.forEach((c) => cand[c].forEach((d) => union.add(d)))
          if (union.size !== size) continue
          let changed = false
          for (const c of u) {
            if (val[c] || group.includes(c)) continue
            for (const d of union) if (cand[c].has(d)) {
            cand[c].delete(d)
            changed = true
          }
          }
          if (changed) {
            used(size === 2 ? 3 : 5)
            done = true
            break
          }
        }
        if (done) break
      }
      if (done) break
      if (size === 2) {
        // 4 hidden pair (checked before triples)
        for (const u of UNITS) {
          const where: Record<number, number[]> = {}
          for (let d = 1; d <= 9; d++) where[d] = u.filter((c) => !val[c] && cand[c].has(d))
          for (let d1 = 1; d1 <= 9 && !done; d1++)
            for (let d2 = d1 + 1; d2 <= 9 && !done; d2++) {
              const w1 = where[d1]
              const w2 = where[d2]
              if (w1.length !== 2 || w2.length !== 2 || w1[0] !== w2[0] || w1[1] !== w2[1]) continue
              let changed = false
              for (const c of w1) for (const d of [...cand[c]]) if (d !== d1 && d !== d2) {
            cand[c].delete(d)
            changed = true
          }
              if (changed) {
                used(4)
                done = true
              }
            }
          if (done) break
        }
        if (done) break
      }
    }
    if (done) continue
    return { hardest: 'needs more', counts }
  }
}

console.log(`Sudoku — ${N} generated puzzles per difficulty (seeded)`)
const t0 = Date.now()
for (const diff of ['easy', 'medium', 'hard'] as Difficulty[]) {
  const rng = mulberry32(diff === 'easy' ? 11 : diff === 'medium' ? 22 : 33)
  const givens: number[] = []
  const hardest: Record<string, number> = {}
  let singlesSteps = 0
  for (let i = 0; i < N; i++) {
    const g = newGame(diff, rng)
    givens.push(countGivens(g.puzzle))
    const r = rate(g.puzzle)
    hardest[r.hardest] = (hardest[r.hardest] ?? 0) + 1
    singlesSteps += r.counts['hidden single'] ?? 0
  }
  givens.sort((a, b) => a - b)
  const atTarget = givens.filter((x) => x === CLUE_TARGETS[diff]).length
  const mean = givens.reduce((a, b) => a + b, 0) / N
  console.log(
    `${diff.padEnd(6)} target ${CLUE_TARGETS[diff]} | givens min ${givens[0]} median ${givens[Math.floor(N / 2)]} max ${givens[N - 1]} mean ${mean.toFixed(2)} | exactly at target ${((100 * atTarget) / N).toFixed(1)}%`,
  )
  const order: Tech[] = [...TECH, 'needs more']
  console.log(
    '        hardest technique needed: ' +
      order.filter((t) => hardest[t]).map((t) => `${t} ${((100 * hardest[t]) / N).toFixed(1)}%`).join(' | ') +
      ` | avg hidden-single placements ${(singlesSteps / N).toFixed(1)}`,
  )
}
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`)
