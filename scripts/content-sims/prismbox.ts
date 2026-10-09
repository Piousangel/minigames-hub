/**
 * Prismbox content sim — how many beams does a careful deducer need?
 *
 * Run: npx --yes tsx@4.19.2 scripts/content-sims/prismbox.ts
 *
 * Uses the real engine (simulateShot, createGame, reduce). For each difficulty:
 *
 * 1. Enumerates every atom layout the generator's rules allow (atoms on the
 *    interior ring 1..size-2, pairwise Chebyshev distance >= 2) and pre-computes
 *    what every edge port would show for each layout.
 * 2. Outcome mix: across real generated boards (createGame with seeds 1..N),
 *    how often a port produces hit / through / refract / reflect, and whether
 *    every atom can be hit from at least one port (a win is only possible by
 *    hitting every atom).
 * 3. Plays each board with two deduction bots that only use what the UI shows
 *    (event, exit port, traced path, turn cells, hit cell). The set of layouts
 *    consistent with all clues so far is kept exactly.
 *      - "greedy-hit": fire the port most likely to hit a new atom; break ties
 *        by which port splits the remaining layouts best.
 *      - "info-first": fire a sure hit if one exists; otherwise fire the port
 *        whose outcome is most uncertain (max entropy over remaining layouts).
 *    Reports shots to win vs par.
 */
import {
  createGame,
  DIFFICULTIES,
  reduce,
  simulateShot,
  type Coord,
  type Port,
  type PrismboxConfig,
} from '../../src/lib/games/prismbox/engine'

const N_BOARDS = Number(process.env.N_BOARDS ?? 200)
const N_CHECK = Number(process.env.N_CHECK ?? 20000)

function ports(size: number): Port[] {
  const out: Port[] = []
  for (const edge of ['N', 'E', 'S', 'W'] as const) for (let lane = 0; lane < size; lane++) out.push({ edge, lane })
  return out
}

function enumerate(cfg: PrismboxConfig): Coord[][] {
  const cells: Coord[] = []
  for (let r = 1; r <= cfg.size - 2; r++) for (let c = 1; c <= cfg.size - 2; c++) cells.push({ r, c })
  const out: Coord[][] = []
  const pick: Coord[] = []
  const rec = (start: number) => {
    if (pick.length === cfg.atoms) {
      out.push(pick.slice())
      return
    }
    for (let i = start; i < cells.length; i++) {
      const c = cells[i]
      if (pick.some((p) => Math.max(Math.abs(p.r - c.r), Math.abs(p.c - c.c)) < 2)) continue
      pick.push(c)
      rec(i + 1)
      pick.pop()
    }
  }
  rec(0)
  return out
}

const layoutKey = (atoms: Coord[]) =>
  atoms
    .map((a) => a.r * 16 + a.c)
    .sort((x, y) => x - y)
    .join(',')

function obsKey(atoms: Coord[], p: Port, size: number): { key: string; hit: number } {
  const r = simulateShot(atoms, p, size)
  const hit = r.hitAtom ? r.hitAtom.r * 16 + r.hitAtom.c : -1
  const key = `${r.event}|${r.exit ? r.exit.edge + r.exit.lane : ''}|${r.path.map((c) => c.r * 16 + c.c).join('.')}|${r.turns.map((c) => c.r * 16 + c.c).join('.')}|${hit}`
  return { key, hit }
}

type Policy = 'greedy-hit' | 'info-first'

function run(name: string, cfg: PrismboxConfig) {
  const P = ports(cfg.size)
  const layouts = enumerate(cfg)
  const index = new Map<string, number>()
  layouts.forEach((l, i) => index.set(layoutKey(l), i))
  // obs[i][p] -> key string; hits[i][p] -> hit cell id or -1
  const obs: string[][] = []
  const hits: number[][] = []
  for (const l of layouts) {
    const row: string[] = []
    const hrow: number[] = []
    for (const p of P) {
      const o = obsKey(l, p, cfg.size)
      row.push(o.key)
      hrow.push(o.hit)
    }
    obs.push(row)
    hits.push(hrow)
  }

  // ---- outcome mix over real boards ----
  const ev: Record<string, number> = { hit: 0, through: 0, refract: 0, reflect: 0, trapped: 0 }
  let unhittable = 0
  let portsPerAtomSum = 0
  let atomsTotal = 0
  const boards = []
  for (let seed = 1; seed <= N_BOARDS; seed++) {
    const g = createGame(cfg, seed)
    boards.push(g)
    const atomHitCount = new Map<number, number>()
    for (const p of P) {
      const r = simulateShot(g.atoms, p, cfg.size)
      ev[r.event]++
      if (r.hitAtom) {
        const k = r.hitAtom.r * 16 + r.hitAtom.c
        atomHitCount.set(k, (atomHitCount.get(k) ?? 0) + 1)
      }
    }
    for (const a of g.atoms) {
      const n = atomHitCount.get(a.r * 16 + a.c) ?? 0
      portsPerAtomSum += n
      atomsTotal++
      if (n === 0) unhittable++
    }
  }
  const totalShots = N_BOARDS * P.length
  console.log(`\n## ${name}: ${cfg.size}x${cfg.size}, ${cfg.atoms} atoms, par ${Math.round(cfg.atoms * cfg.parPerAtom)} — ${layouts.length.toLocaleString()} legal layouts`)
  console.log(`  every port fired on ${N_BOARDS} generated boards (${totalShots.toLocaleString()} shots):`)
  for (const k of Object.keys(ev)) console.log(`    ${k}: ${((100 * ev[k]) / totalShots).toFixed(1)}%`)
  console.log(`  ports that hit a given atom directly: mean ${(portsPerAtomSum / atomsTotal).toFixed(2)} of ${P.length}; atoms with zero hitting ports: ${unhittable} of ${atomsTotal}`)

  // ---- bots ----
  for (const policy of ['greedy-hit', 'info-first'] as Policy[]) {
    const shotsUsed: number[] = []
    let firstShotHits = 0
    for (const g0 of boards) {
      let g = g0
      let alive = layouts.map((_, i) => i)
      const truth = index.get(layoutKey(g.atoms))!
      if (truth === undefined) throw new Error('generator produced a layout outside the enumeration')
      const fired = new Set<number>()
      const found = new Set<number>()
      while (!g.won) {
        let best = -1
        let bestA = -Infinity
        let bestB = -Infinity
        for (let pi = 0; pi < P.length; pi++) {
          if (fired.has(pi)) continue
          const buckets = new Map<string, number>()
          let pHit = 0
          for (const i of alive) {
            buckets.set(obs[i][pi], (buckets.get(obs[i][pi]) ?? 0) + 1)
            const h = hits[i][pi]
            if (h >= 0 && !found.has(h)) pHit++
          }
          pHit /= alive.length
          let ent = 0
          for (const n of buckets.values()) {
            const q = n / alive.length
            ent -= q * Math.log2(q)
          }
          const a = policy === 'greedy-hit' ? pHit : pHit === 1 ? 1e9 : ent
          const b = policy === 'greedy-hit' ? ent : pHit
          if (a > bestA + 1e-12 || (Math.abs(a - bestA) <= 1e-12 && b > bestB)) {
            best = pi
            bestA = a
            bestB = b
          }
        }
        if (best < 0) break // nothing left to fire
        fired.add(best)
        const seen = obs[truth][best]
        alive = alive.filter((i) => obs[i][best] === seen)
        if (hits[truth][best] >= 0) found.add(hits[truth][best])
        g = reduce(g, { type: 'fire', entry: P[best] })
        if (g.shots.length === 1 && g.shots[0].event === 'hit') firstShotHits++
      }
      shotsUsed.push(g.won ? g.shots.length : Infinity)
    }
    const won = shotsUsed.filter(Number.isFinite)
    won.sort((a, b) => a - b)
    const mean = won.reduce((a, b) => a + b, 0) / won.length
    const par = Math.round(cfg.atoms * cfg.parPerAtom)
    const atPar = won.filter((s) => s <= par).length
    const q = (f: number) => won[Math.min(won.length - 1, Math.floor(f * won.length))]
    console.log(
      `  bot ${policy}: solved ${won.length}/${boards.length}; shots mean ${mean.toFixed(2)}, median ${q(0.5)}, 90th pct ${q(0.9)}, max ${won[won.length - 1]}; within par ${((100 * atPar) / won.length).toFixed(1)}%; first shot was a hit on ${((100 * firstShotHits) / boards.length).toFixed(1)}% of boards`,
    )
  }
}

/** Boards where some atom cannot be hit from any port can never be won. */
function unwinnable(atoms: Coord[], size: number): boolean {
  const hitSet = new Set<number>()
  for (const p of ports(size)) {
    const r = simulateShot(atoms, p, size)
    if (r.hitAtom) hitSet.add(r.hitAtom.r * 16 + r.hitAtom.c)
  }
  return atoms.some((a) => !hitSet.has(a.r * 16 + a.c))
}

console.log(`# Unwinnable-board check (an atom no port can hit), ${N_CHECK.toLocaleString()} boards per difficulty, seeds 1..${N_CHECK}`)
for (const [name, cfg] of Object.entries(DIFFICULTIES)) {
  let bad = 0
  let trapped = 0
  for (let seed = 1; seed <= N_CHECK; seed++) {
    const g = createGame(cfg, seed)
    if (unwinnable(g.atoms, cfg.size)) bad++
    for (const p of ports(cfg.size)) if (simulateShot(g.atoms, p, cfg.size).event === 'trapped') trapped++
  }
  console.log(`  ${name}: ${bad} unwinnable (${((100 * bad) / N_CHECK).toFixed(2)}%); trapped shots ${trapped} of ${(N_CHECK * 4 * cfg.size).toLocaleString()}`)
}
{
  // Daily boards (normal config, seed = UTC YYYYMMDD) for one year from 2026-10-09.
  let bad = 0
  const d = new Date(Date.UTC(2026, 9, 9))
  for (let i = 0; i < 365; i++) {
    const seed = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
    if (unwinnable(createGame(DIFFICULTIES.normal, seed).atoms, DIFFICULTIES.normal.size)) bad++
    d.setUTCDate(d.getUTCDate() + 1)
  }
  console.log(`  daily (2026-10-09 .. +364 days): ${bad} of 365 unwinnable`)
}

for (const [name, cfg] of Object.entries(DIFFICULTIES)) run(name, cfg)
