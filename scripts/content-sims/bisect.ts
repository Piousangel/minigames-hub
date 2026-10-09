/**
 * Bisect content sim — what a fixed tap delay is worth.
 *
 * Run: npx --yes tsx@4.19.2 scripts/content-sims/bisect.ts
 *
 * In the real engine the END signal can only appear after the true midpoint,
 * so a player who taps at the midpoint has seen START but never END. Every
 * round's interval is drawn uniformly from MIN_INTERVAL..MAX_INTERVAL ticks
 * (60 ticks = 1 s in the UI). This script:
 *
 * 1. Exact table: for each tap delay d (ticks after START), enumerates every
 *    interval length the engine can generate and grades the tap with the real
 *    `judge()`; reports P(perfect/good/ok/miss) and expected points.
 * 2. Full runs: plays complete 3-life games through arm/step/tap with a fixed
 *    target delay plus Gaussian timing noise (a modelling assumption, stated
 *    as a coefficient of variation), and reports mean score and rounds.
 */
import {
  arm,
  judge,
  MAX_INTERVAL,
  MIN_INTERVAL,
  mulberry32,
  newGame,
  POINTS,
  step,
  tap,
  type Grade,
  type Rng,
} from '../../src/lib/games/bisect/engine'

const TPS = 60
const lengths: number[] = []
for (let L = MIN_INTERVAL; L <= MAX_INTERVAL; L++) lengths.push(L)

console.log(`# Exact: fixed tap delay vs every interval length (${lengths.length} equally likely lengths, ${MIN_INTERVAL}-${MAX_INTERVAL} ticks)`)
let bestHit = { d: 0, p: 0 }
let bestPts = { d: 0, e: 0 }
const rows: string[] = []
for (let d = 10; d <= 100; d++) {
  const n: Record<Grade, number> = { perfect: 0, good: 0, ok: 0, miss: 0 }
  for (const L of lengths) {
    // START at tick 0; tap at tick d. A tap at/after END is still judged by
    // judge() (and is always a miss since normError >= 1).
    n[judge(0, L, d).grade]++
  }
  const T = lengths.length
  const pHit = (T - n.miss) / T
  const ePts = (n.perfect * POINTS.perfect + n.good * POINTS.good + n.ok * POINTS.ok) / T
  if (pHit > bestHit.p) bestHit = { d, p: pHit }
  if (ePts > bestPts.e) bestPts = { d, e: ePts }
  if (d % 5 === 0 || d === 50 || d === 54)
    rows.push(
      `  d=${String(d).padStart(3)} ticks (${(d / TPS).toFixed(2)} s): perfect ${((100 * n.perfect) / T).toFixed(1)}%, good ${((100 * n.good) / T).toFixed(1)}%, ok ${((100 * n.ok) / T).toFixed(1)}%, miss ${((100 * n.miss) / T).toFixed(1)}%, E[base pts] ${ePts.toFixed(1)}`,
    )
}
rows.forEach((r) => console.log(r))
console.log(`  best P(not miss): d=${bestHit.d} (${(bestHit.d / TPS).toFixed(2)} s) -> ${(100 * bestHit.p).toFixed(1)}%`)
console.log(`  best E[base pts]: d=${bestPts.d} (${(bestPts.d / TPS).toFixed(2)} s) -> ${bestPts.e.toFixed(1)}`)

// Per-interval window: for an interval of L ticks, which delays score?
console.log('\n# Scoring windows for a known interval (ticks after START)')
for (const L of [30, 60, 90, 120, 150, 180]) {
  const win = (g: Grade) => {
    const ds: number[] = []
    for (let d = 0; d <= L + 60; d++) if (judge(0, L, d).grade === g) ds.push(d)
    return ds.length ? `${ds[0]}-${ds[ds.length - 1]}` : 'none'
  }
  console.log(`  L=${L} (${(L / TPS).toFixed(1)} s, mid ${(L / 2 / TPS).toFixed(2)} s): perfect ${win('perfect')}, good ${win('good')}, ok ${win('ok')}`)
}

// ---------- full-run Monte Carlo ----------
function gauss(r: Rng): number {
  const u = Math.max(r(), 1e-12)
  const v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function playRun(target: number, cv: number, seed: number) {
  const roundRng = mulberry32(seed)
  const noise = mulberry32(seed ^ 0x9e3779b9)
  let s = arm(newGame(), roundRng)
  while (s.phase !== 'over') {
    // advance to START
    s = step(s, s.round!.startTick)
    const delay = Math.max(1, Math.round(target * (1 + cv * gauss(noise))))
    const tapAt = s.round!.startTick + delay
    if (tapAt >= s.round!.endTick + 60) {
      s = step(s, s.round!.endTick + 60) // timeout
    } else {
      s = tap(s, tapAt)
    }
    if (s.phase === 'resolved') s = arm(s, roundRng)
  }
  return { score: s.score, rounds: s.roundsPlayed, best: s.bestStreak }
}

const RUNS = 20_000
console.log(`\n# Full 3-life runs through arm/step/tap (${RUNS.toLocaleString()} runs per row)`)
for (const cv of [0, 0.05, 0.1, 0.15]) {
  for (const target of [40, 54, 60, 70]) {
    let sc = 0
    let rd = 0
    let bs = 0
    for (let i = 0; i < RUNS; i++) {
      const r = playRun(target, cv, 1000 + i)
      sc += r.score
      rd += r.rounds
      bs += r.best
    }
    console.log(
      `  timing noise ${String(cv * 100).padStart(2)}%, target ${(target / TPS).toFixed(2)} s: mean score ${(sc / RUNS).toFixed(0)}, mean rounds ${(rd / RUNS).toFixed(2)}, mean best streak ${(bs / RUNS).toFixed(2)}`,
    )
  }
}
