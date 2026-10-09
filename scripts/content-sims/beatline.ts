// Beatline chart + scoring analysis against the real engine (src/lib/games/beatline/engine.ts).
// Run: npx tsx scripts/content-sims/beatline.ts
import {
  DEFAULT_CONFIG,
  GOOD_WINDOW_TICKS,
  PERFECT_WINDOW_TICKS,
  TICK_MS,
  advanceStage,
  advanceTick,
  createGame,
  mulberry32,
  press,
  ticksPerBeat,
  type BeatlineState,
} from '../../src/lib/games/beatline/engine'

const SEEDS = Number(process.env.SEEDS ?? 1000)

// ---- 1. Chart shape per stage, across many seeds ----
console.log(`Timing windows: Perfect ±${PERFECT_WINDOW_TICKS * TICK_MS}ms, Good ±${GOOD_WINDOW_TICKS * TICK_MS}ms (tick = ${TICK_MS}ms)`)
DEFAULT_CONFIG.stages.forEach((st, i) => {
  let durSum = 0
  let minGap = Infinity
  let sameLaneBackToBack = 0
  let pairs = 0
  let notesTotal = 0
  let maxDur = 0
  let minDur = Infinity
  for (let seed = 1; seed <= SEEDS; seed++) {
    const chart = createGame(DEFAULT_CONFIG, seed).stageCharts[i]
    notesTotal += chart.length
    const dur = chart[chart.length - 1].tick * TICK_MS
    durSum += dur
    maxDur = Math.max(maxDur, dur)
    minDur = Math.min(minDur, dur)
    for (let k = 1; k < chart.length; k++) {
      minGap = Math.min(minGap, chart[k].tick - chart[k - 1].tick)
      pairs++
      if (chart[k].lane === chart[k - 1].lane) sameLaneBackToBack++
    }
  }
  const tpb = ticksPerBeat(st.bpm)
  const slot = Math.max(Math.round(tpb / st.subdivision), GOOD_WINDOW_TICKS + 1)
  console.log(
    `Stage ${i + 1}: ${st.bpm} BPM, beat=${tpb * TICK_MS}ms, note grid=${slot * TICK_MS}ms, notes/stage avg ${(notesTotal / SEEDS).toFixed(1)} (target ${st.noteCount}), ` +
      `last note at avg ${(durSum / SEEDS / 1000).toFixed(1)}s (min ${(minDur / 1000).toFixed(1)}, max ${(maxDur / 1000).toFixed(1)}), ` +
      `avg ${(((notesTotal / SEEDS) / (durSum / SEEDS)) * 1000).toFixed(2)} notes/s, tightest gap ${minGap * TICK_MS}ms, same lane back-to-back ${((100 * sameLaneBackToBack) / pairs).toFixed(1)}%`,
  )
})

// ---- 2. Drive the real reducer with a simulated player ----
// offsetFor(noteIndex) returns the press offset in ticks for that note (null = don't press).
function runPlayer(seed: number, offsetFor: (globalIdx: number, rng: () => number) => number | null, extraPresses = 0) {
  let s: BeatlineState = createGame(DEFAULT_CONFIG, seed)
  const rng = mulberry32(seed ^ 0xabcdef)
  let globalIdx = 0
  for (;;) {
    // Build this stage's press schedule, sorted by press tick.
    const events: { tick: number; lane: number }[] = []
    for (const n of s.chart) {
      const off = offsetFor(globalIdx++, rng)
      if (off !== null) events.push({ tick: n.tick + off, lane: n.lane })
    }
    for (let e = 0; e < extraPresses; e++) {
      // stray "ghost" taps at random points of the stage
      const last = s.chart[s.chart.length - 1].tick
      events.push({ tick: 1 + Math.floor(rng() * last), lane: Math.floor(rng() * 4) })
    }
    events.sort((a, b) => a.tick - b.tick)
    for (const ev of events) {
      if (ev.tick > s.tick) s = advanceTick(s, ev.tick)
      if (s.lost || s.stageCleared || s.won) break
      s = press(s, ev.lane)
      if (s.lost || s.stageCleared || s.won) break
    }
    if (!s.lost && !s.stageCleared && !s.won) s = advanceTick(s, s.chart[s.chart.length - 1].tick + GOOD_WINDOW_TICKS + 1)
    if (s.won || s.lost) return s
    s = advanceStage(s)
  }
}

const perfectRun = runPlayer(1, () => 0)
console.log(`\nAll-Perfect run (seed 1): score ${perfectRun.score}, notes ${perfectRun.perfects}, bestCombo ${perfectRun.bestCombo}`)
const goodRun = runPlayer(1, () => PERFECT_WINDOW_TICKS + 1)
console.log(`All-Good run (every hit 60ms late): score ${goodRun.score}`)
const total = perfectRun.perfects
for (const missAt of [0, 9, 10, Math.floor(total / 2), total - 1]) {
  const r = runPlayer(1, (i) => (i === missAt ? null : 0))
  console.log(`One skipped note at #${missAt + 1}: score ${r.score} (cost ${perfectRun.score - r.score}), lives left ${r.lives}`)
}
const early = runPlayer(1, (i) => (i === 5 ? -(GOOD_WINDOW_TICKS + 3) : 0))
console.log(`One press 150ms early on note #6: misses ${early.misses}, lives left ${early.lives}, score ${early.score}`)

// ---- 3. Human-like timing error: Gaussian offset with sigma ms, N seeds each ----
function gauss(rng: () => number) {
  const u = Math.max(1e-12, rng())
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
const N = Number(process.env.N ?? 1000)
console.log(`\nGaussian timing error, N=${N} runs per row (offset rounded to 10ms ticks):`)
for (const sigmaMs of [20, 35, 50, 65, 80]) {
  let wins = 0
  let scoreSum = 0
  let perf = 0
  let good = 0
  let stageReachedSum = 0
  const lostIn = [0, 0, 0, 0, 0]
  for (let seed = 1; seed <= N; seed++) {
    const r = runPlayer(seed, (_i, rng) => Math.round((gauss(rng) * sigmaMs) / TICK_MS))
    if (r.won) wins++
    scoreSum += r.score
    perf += r.perfects
    good += r.goods
    stageReachedSum += r.stageIndex + 1
    if (r.lost) lostIn[r.stageIndex]++
  }
  console.log(
    `sigma ${sigmaMs}ms: run win ${((100 * wins) / N).toFixed(1)}%, avg score ${(scoreSum / N).toFixed(0)}, perfect share of hits ${((100 * perf) / Math.max(1, perf + good)).toFixed(1)}%, avg stage reached ${(stageReachedSum / N).toFixed(2)}, runs lost in stage 1..5: ${lostIn.join('/')}`,
  )
}
