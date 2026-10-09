/**
 * Clusters content sim — what the puzzle bank and daily seed actually produce.
 *
 * Run: npx --yes tsx@4.19.2 scripts/content-sims/clusters.ts
 *
 * Aggregate statistics only; no specific day's answer is printed.
 *  1. Bank shape: groups per tier, duplicate items, item-word lengths per tier.
 *  2. Board composition over N random seeds: tiers per board (does every board
 *     get exactly one group per tier?).
 *  3. Daily boards for 365 consecutive UTC dates from 2026-10-09: how often a
 *     group reappears from the previous day / previous 7 days, and the spread of
 *     appearances per group.
 *  4. The Shuffle button: how many presses until the layout repeats, and whether
 *     neighbouring tiles stay neighbours (it is a rotation, not a re-deal).
 *  5. Guessing baseline: chance that a uniformly random set of 4 tiles is a
 *     group, and that it is "one away".
 */
import {
  BANK,
  createGame,
  dailySeed,
  GROUP_COUNT,
  reduce,
  rotateTiles,
  type ClustersState,
} from '../../src/lib/games/clusters/engine'

// ---- 1. bank ----
const byTier = [0, 1, 2, 3].map((t) => BANK.filter((g) => g.tier === t))
const allItems = BANK.flatMap((g) => [...g.items])
const dupes = allItems.filter((it, i) => allItems.indexOf(it) !== i)
console.log(`# Bank: ${BANK.length} groups, ${allItems.length} items, ${new Set(allItems).size} distinct; duplicate items: ${dupes.length}`)
byTier.forEach((gs, t) => {
  const items = gs.flatMap((g) => [...g.items])
  const avgLen = items.reduce((a, s) => a + s.length, 0) / items.length
  const multiWord = items.filter((s) => s.includes(' ')).length
  console.log(`  tier ${t}: ${gs.length} groups; mean item length ${avgLen.toFixed(2)} letters; multi-word items ${multiWord}`)
})
// Items that also appear as a word inside another group's NAME (surface-level cross-links)
let nameLinks = 0
for (const g of BANK)
  for (const it of g.items)
    for (const h of BANK) if (h !== g && h.name.toLowerCase().split(/\W+/).includes(it.toLowerCase())) nameLinks++
console.log(`  items that literally appear in another group's name: ${nameLinks}`)

// ---- 2. composition ----
const N = 100_000
let onePerTier = 0
for (let s = 1; s <= N; s++) {
  const g = createGame(s)
  const tiers = g.groups.map((x) => x.tier).join('')
  if (tiers === '0123') onePerTier++
}
console.log(`\n# Board composition over ${N.toLocaleString()} seeds: exactly one group from each tier on ${((100 * onePerTier) / N).toFixed(2)}%`)
console.log(`  distinct group combinations possible with one group per tier: ${byTier.map((g) => g.length).reduce((a, b) => a * b, 1).toLocaleString()}`)

// ---- 3. daily ----
const DAYS = 365
const days: string[][] = []
const d = new Date(Date.UTC(2026, 9, 9))
for (let i = 0; i < DAYS; i++) {
  const iso = d.toISOString().slice(0, 10)
  days.push(createGame(dailySeed(iso)).groups.map((g) => g.name))
  d.setUTCDate(d.getUTCDate() + 1)
}
let repeatYesterday = 0
let repeatWeek = 0
let sameFullBoard = 0
const appear = new Map<string, number>()
for (let i = 0; i < DAYS; i++) {
  for (const n of days[i]) appear.set(n, (appear.get(n) ?? 0) + 1)
  if (i > 0 && days[i].some((n) => days[i - 1].includes(n))) repeatYesterday++
  if (i >= 7) {
    const prev = new Set(days.slice(i - 7, i).flat())
    if (days[i].some((n) => prev.has(n))) repeatWeek++
  }
  for (let j = 0; j < i; j++) if (days[j].join('|') === days[i].join('|')) sameFullBoard++
}
const counts = [...appear.values()].sort((a, b) => a - b)
console.log(`\n# Daily boards, ${DAYS} consecutive UTC dates from 2026-10-09`)
console.log(`  days sharing at least one group with the previous day: ${repeatYesterday} of ${DAYS - 1} (${((100 * repeatYesterday) / (DAYS - 1)).toFixed(1)}%)`)
console.log(`  days sharing at least one group with the previous 7 days: ${repeatWeek} of ${DAYS - 7} (${((100 * repeatWeek) / (DAYS - 7)).toFixed(1)}%)`)
console.log(`  groups used at least once: ${appear.size} of ${BANK.length}; appearances per group min ${counts[0]}, median ${counts[Math.floor(counts.length / 2)]}, max ${counts[counts.length - 1]}`)
console.log(`  pairs of days with an identical set of four groups: ${sameFullBoard}`)

// ---- 4. shuffle ----
console.log('\n# Shuffle button (rotateTiles)')
for (const n of [16, 12, 8, 4]) {
  const start = Array.from({ length: n }, (_, i) => `t${i}`)
  let cur = start
  let presses = 0
  do {
    cur = rotateTiles(cur)
    presses++
  } while (cur.join() !== start.join())
  // cyclic neighbour pairs preserved after one press?
  const after = rotateTiles(start)
  const pairs = (a: string[]) => new Set(a.map((x, i) => `${x}>${a[(i + 1) % a.length]}`))
  const before = pairs(start)
  const kept = [...pairs(after)].filter((p) => before.has(p)).length
  console.log(`  ${n} tiles left: layout repeats after ${presses} presses; ${kept}/${n} reading-order neighbour pairs survive a press (counting wrap-around)`)
}

// ---- 5. guessing baseline ----
let groupHits = 0
let oneAway = 0
let total = 0
const g0: ClustersState = createGame(12345)
const tiles = g0.tiles
for (let a = 0; a < 16; a++)
  for (let b = a + 1; b < 16; b++)
    for (let c = b + 1; c < 16; c++)
      for (let e = c + 1; e < 16; e++) {
        let s = g0
        for (const i of [a, b, c, e]) s = reduce(s, { type: 'select', item: tiles[i] })
        s = reduce(s, { type: 'submit' })
        total++
        if (s.lastResult === 'correct') groupHits++
        if (s.lastResult === 'one-away') oneAway++
      }
console.log(`\n# All ${total} possible first guesses on a 16-tile board (scored by reduce)`)
console.log(`  correct: ${groupHits} (${((100 * groupHits) / total).toFixed(2)}%), one away: ${oneAway} (${((100 * oneAway) / total).toFixed(2)}%), plain wrong: ${total - groupHits - oneAway}`)
console.log(`  groups per board: ${GROUP_COUNT}`)
