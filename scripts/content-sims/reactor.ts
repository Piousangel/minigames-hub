/**
 * Reactor content simulation — feeds src/content/guides/reactor.ts.
 *
 * Drives the REAL engine (tick/tap/buy/canPrestige/prestige) in 100 ms steps
 * and measures time from a fresh save (or a fresh post-reboot run) until
 * lifetime charge reaches the 1,000,000 Reboot threshold, under different
 * buying policies and tapping rates. Deterministic: no randomness.
 *
 * Run: npx tsx scripts/content-sims/reactor.ts
 */
import {
  MODULES,
  PRESTIGE_THRESHOLD,
  buy,
  canPrestige,
  initialState,
  nextCost,
  prestige,
  productionPerSec,
  tap,
  tick,
  type State,
} from '../../src/lib/games/reactor/engine'

type Policy = (s: State) => number // module index to buy now, or -1

/** Buy whatever is cheapest right now (the advice on the game page). */
const cheapest: Policy = (s) => {
  let best = -1
  let bestCost = Infinity
  MODULES.forEach((_, i) => {
    const c = nextCost(s, i)
    if (c < bestCost) {
      bestCost = c
      best = i
    }
  })
  return s.charge >= bestCost ? best : -1
}

/** Payback: target the module with the lowest cost / rate; wait for it. */
const payback: Policy = (s) => {
  let best = -1
  let bestRatio = Infinity
  MODULES.forEach((m, i) => {
    const r = nextCost(s, i) / m.baseRate
    if (r < bestRatio) {
      bestRatio = r
      best = i
    }
  })
  return s.charge >= nextCost(s, best) ? best : -1
}

/**
 * Note: "buy the highest tier you can afford" behaves identically to
 * cheapest-first when purchases are checked every 100 ms — charge only ever
 * crosses the cheapest price first — so it is not listed separately.
 */

/** Capacitors only. */
const capOnly: Policy = (s) => (s.charge >= nextCost(s, 0) ? 0 : -1)

const STEP_MS = 100
const LIMIT_S = 60 * 60 * 24 * 7

function run(start: State, policy: Policy, tapsPerSec: number, tapUntilFirstBuyOnly: boolean) {
  let s = start
  let t = 0
  let tapAcc = 0
  let bought = 0
  const target = start.lifetime + PRESTIGE_THRESHOLD // charge earned THIS run
  while (s.lifetime < target && t < LIMIT_S * 1000) {
    if (!(tapUntilFirstBuyOnly && bought > 0)) {
      tapAcc += (tapsPerSec * STEP_MS) / 1000
      while (tapAcc >= 1) {
        s = tap(s)
        tapAcc -= 1
      }
    }
    for (;;) {
      const i = policy(s)
      if (i < 0) break
      const n = buy(s, i)
      if (n === s) break
      s = n
      bought++
    }
    s = tick(s, STEP_MS)
    t += STEP_MS
  }
  return { seconds: t / 1000, s }
}

const fmtT = (sec: number) => {
  if (sec >= LIMIT_S) return '>7 days'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const ss = Math.round(sec % 60)
  return h ? `${h}h ${m}m` : `${m}m ${ss}s`
}

const policies: Array<[string, Policy]> = [
  ['cheapest-first', cheapest],
  ['best cost/rate', payback],
  ['capacitors only', capOnly],
]

console.log('Time from a fresh save to 1,000,000 lifetime charge (first Reboot unlock)')
for (const [tapLabel, tps, onlyFirst] of [
  ['tap 5/s until first purchase, then idle', 5, true],
  ['tap 3/s the whole time', 3, false],
  ['tap 6/s the whole time', 6, false],
] as const) {
  for (const [name, p] of policies) {
    const r = run(initialState(), p, tps, onlyFirst)
    console.log(
      `  [${tapLabel}] ${name.padEnd(18)} ${fmtT(r.seconds).padStart(8)}  end rate ${productionPerSec(r.s).toFixed(1)}/s  levels ${r.s.levels.join('/')}`,
    )
  }
}

// After a reboot: x1.1 production, tapPower 2. How long until the run earns another 1M?
console.log('\nSecond run (after one Reboot: x1.1 production, 2 charge/tap), measured to +1,000,000 earned this run')
{
  const base = run(initialState(), cheapest, 3, false).s
  const rebooted = prestige(base)
  console.log(`  canPrestige right after reboot: ${canPrestige(rebooted)} (lifetime kept at ${Math.floor(rebooted.lifetime)})`)
  for (const [name, p] of policies) {
    const r = run(rebooted, p, 3, false)
    console.log(`  [tap 3/s] ${name.padEnd(18)} ${fmtT(r.seconds).padStart(8)}`)
  }
}

// Offline: 8h cap. Payout at a few production levels reached in the runs above.
console.log('\nModule payback (cost of first level / base rate):')
MODULES.forEach((m) => console.log(`  ${m.name.padEnd(11)} ${(m.baseCost / m.baseRate).toFixed(0)} s`))
console.log('Payback of the NEXT level after owning n (cost/rate, seconds):')
for (const n of [0, 5, 10, 20, 40]) {
  console.log(`  n=${String(n).padStart(2)}  ` + MODULES.map((m) => `${m.name} ${(Math.ceil(m.baseCost * 1.15 ** n) / m.baseRate).toFixed(0)}s`).join('  '))
}
