// Quarry deduction analysis against the real engine (src/lib/games/quarry/engine.ts).
// Run: npx tsx scripts/content-sims/quarry.ts
//
// The quarry's start cell is uniform over the board (newLevel: floor(rng*size) per axis),
// and every probe's outcome is deterministic given that cell. So for any deterministic
// strategy we can enumerate EVERY start cell and get exact (not sampled) distributions.
//
// A "belief-tracking" player keeps the set of cells the quarry could be on: after reading
// distance d at probe p, keep cells c with chebyshev(c,p)===d, then move each through
// fleeFrom(c,p,size) — exactly what the engine does to the real quarry.
import {
  budgetForLevel,
  chebyshev,
  fleeFrom,
  levelPoints,
  newLevel,
  parForLevel,
  probe,
  scoreLevel,
  sizeForLevel,
  type Pos,
  type QuarryState,
} from '../../src/lib/games/quarry/engine'

const key = (p: Pos) => p.row * 16 + p.col
function cells(size: number): Pos[] {
  const out: Pos[] = []
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) out.push({ row: r, col: c })
  return out
}

/** Split a belief set by the reading a probe at `at` would produce; return post-flee sets. */
function splitBelief(belief: Pos[], at: Pos, size: number): Map<number, Pos[]> {
  const out = new Map<number, Map<number, Pos>>()
  for (const c of belief) {
    const d = chebyshev(c, at)
    if (!out.has(d)) out.set(d, new Map())
    const nxt = d === 0 ? c : fleeFrom(c, at, size)
    out.get(d)!.set(key(nxt), nxt)
  }
  const res = new Map<number, Pos[]>()
  for (const [d, m] of out) res.set(d, [...m.values()])
  return res
}

type Strategy = (belief: Pos[], size: number, turn: number) => Pos

// A: "Hot-and-cold" naive — probe the centre first, then always probe a random-free
//    deterministic choice: the first remaining candidate cell (reading-order).
const naive: Strategy = (belief, size, turn) => (turn === 0 ? { row: (size - 1) / 2, col: (size - 1) / 2 } : belief[0])

// B: Greedy belief-splitter — choose the probe minimising the expected size of the
//    remaining belief (a catch counts as 0); ties broken toward probing a candidate cell.
const greedy: Strategy = (belief, size) => {
  let best: Pos = belief[0]
  let bestScore = Infinity
  const cand = new Set(belief.map(key))
  for (const at of cells(size)) {
    const parts = splitBelief(belief, at, size)
    let exp = 0
    for (const [d, set] of parts) {
      const weight = belief.filter((c) => chebyshev(c, at) === d).length
      exp += d === 0 ? 0 : weight * set.length
    }
    const score = exp - (cand.has(key(at)) ? 0.5 : 0)
    if (score < bestScore) {
      bestScore = score
      best = at
    }
  }
  return best
}

// C: Exact expected-probe-optimal policy (memoised search over belief sets).
function makeOptimal(size: number) {
  const memo = new Map<string, { exp: number; at: Pos }>()
  const all = cells(size)
  function solve(belief: Pos[], depth: number): { exp: number; at: Pos } {
    if (belief.length === 1) return { exp: 1, at: belief[0] }
    const k = belief.map(key).sort((a, b) => a - b).join(',')
    const hit = memo.get(k)
    if (hit) return hit
    let best = { exp: Infinity, at: belief[0] }
    if (depth > 12) return { exp: 99, at: belief[0] }
    for (const at of all) {
      const parts = splitBelief(belief, at, size)
      if (parts.size === 1 && !parts.has(0)) {
        // No information and no catch possible; only useful if it moves the set to a
        // smaller one. Skip if belief does not shrink.
        const only = [...parts.values()][0]
        if (only.length >= belief.length) continue
      }
      let exp = 1
      for (const [d, set] of parts) {
        if (d === 0) continue
        const weight = belief.filter((c) => chebyshev(c, at) === d).length / belief.length
        exp += weight * solve(set, depth + 1).exp
        if (exp >= best.exp) break
      }
      if (exp < best.exp) best = { exp, at }
    }
    memo.set(k, best)
    return best
  }
  const strat: Strategy = (belief) => solve(belief, 0).at
  return strat
}

/** Play one level with the REAL engine reducer, a strategy, and a fixed start cell. */
function playLevel(level: number, start: Pos, strat: Strategy): QuarryState {
  const size = sizeForLevel(level)
  let s = newLevel(level, () => 0)
  s = { ...s, quarry: start }
  let belief = cells(size)
  let turn = 0
  while (s.status === 'playing') {
    const at = strat(belief, size, turn++)
    const reading = chebyshev(s.quarry, at)
    s = probe(s, at)
    belief = splitBelief(belief, at, size).get(reading) ?? []
  }
  return s
}

function report(name: string, level: number, strat: Strategy) {
  const size = sizeForLevel(level)
  const par = parForLevel(level)
  const budget = budgetForLevel(level)
  const hist = new Map<number, number>()
  let lost = 0
  let stars3 = 0
  let stars2 = 0
  let stars1 = 0
  let total = 0
  let ptsTotal = 0
  const starts = cells(size)
  for (const st of starts) {
    const s = playLevel(level, st, strat)
    if (s.status === 'lost') {
      lost++
      continue
    }
    const used = s.history.length
    hist.set(used, (hist.get(used) ?? 0) + 1)
    total += used
    const sc = scoreLevel(level, used)
    ptsTotal += levelPoints(sc, 0)
    if (sc.stars === 3) stars3++
    else if (sc.stars === 2) stars2++
    else stars1++
  }
  const n = starts.length
  const won = n - lost
  const h = [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' ')
  console.log(
    `${name} | ${size}x${size} par ${par} budget ${budget} | start cells ${n} | lost ${lost} | mean probes (wins) ${(total / Math.max(1, won)).toFixed(2)} | 3★ ${stars3} 2★ ${stars2} 1★ ${stars1} | probe histogram ${h} | mean pts (streak 0) ${(ptsTotal / Math.max(1, won)).toFixed(1)}`,
  )
}

// First-probe information from every cell on each board size.
for (const size of [5, 7]) {
  const all = cells(size)
  const rows: string[] = []
  for (const at of [{ row: (size - 1) / 2, col: (size - 1) / 2 }, { row: 0, col: 0 }, { row: 0, col: (size - 1) / 2 }, greedy(all, size, 0)]) {
    const parts = splitBelief(all, at, size)
    const desc = [...parts.entries()].sort((a, b) => a[0] - b[0]).map(([d, set]) => {
      const pre = all.filter((c) => chebyshev(c, at) === d).length
      return `d=${d}: ${pre} cells -> ${set.length} after flee`
    })
    rows.push(`  probe (${at.row},${at.col}): ${desc.join('; ')}`)
  }
  console.log(`First probe on ${size}x${size}:\n${rows.join('\n')}`)
}

for (const level of [1, 3]) {
  report('naive centre-then-candidate', level, naive)
  report('greedy belief-splitter     ', level, greedy)
}
report('expected-optimal           ', 1, makeOptimal(5))
report('expected-optimal           ', 3, makeOptimal(7))

// Which opening probe does the greedy splitter choose?
for (const size of [5, 7]) {
  const at = greedy(cells(size), size, 0)
  console.log(`greedy opening probe on ${size}x${size}: (${at.row},${at.col})`)
}

// Expected number of candidate cells left after the opening probe (uniform start).
for (const size of [5, 7]) {
  const all = cells(size)
  const mid = (size - 1) / 2
  for (const at of [{ row: mid, col: mid }, { row: 0, col: 0 }, greedy(all, size, 0)]) {
    let exp = 0
    for (const [d, set] of splitBelief(all, at, size)) if (d !== 0) exp += (set.length * set.length) / all.length
    console.log(`${size}x${size} opening (${at.row},${at.col}): expected candidates left ${exp.toFixed(2)}`)
  }
}

// Can a wall pin ever merge two candidates that gave the SAME reading? Check every probe cell
// against every pair of same-reading cells on both boards.
for (const size of [5, 7]) {
  let merges = 0
  for (const at of cells(size)) {
    const seen = new Map<string, number>()
    for (const c of cells(size)) {
      const d = chebyshev(c, at)
      if (d === 0) continue
      const to = fleeFrom(c, at, size)
      const k = `${d}|${to.row},${to.col}`
      seen.set(k, (seen.get(k) ?? 0) + 1)
    }
    for (const v of seen.values()) if (v > 1) merges++
  }
  console.log(`${size}x${size}: same-reading candidates that land on one cell after a flee: ${merges}`)
}
