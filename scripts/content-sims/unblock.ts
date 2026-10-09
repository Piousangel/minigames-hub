/**
 * Unblock content analysis — feeds src/content/guides/unblock.ts.
 *
 * For every level in the real LEVELS bank, explores the full reachable state
 * graph using the real engine's `slide`/`maxSlide` (one move = one block, any
 * distance) and reports:
 *   - blocks on the board, reachable positions, solved positions
 *   - par (re-derived here, checked against LEVEL_PAR)
 *   - legal opening moves vs. opening moves that keep an optimal solution
 *   - how many moves along one optimal line are made by the red block itself
 *   - the worst "distance to exit" of any reachable position (how lost you can get)
 *
 * Run: npx tsx scripts/content-sims/unblock.ts
 */
import { LEVELS, LEVEL_PAR, fromLevel, maxSlide, slide, isSolved, type State } from '../../src/lib/games/unblock/engine'

const key = (s: State) => s.blocks.map((b) => (b.dir === 'h' ? b.col : b.row)).join(',')

function moves(s: State): Array<{ id: string; delta: number; next: State }> {
  const out: Array<{ id: string; delta: number; next: State }> = []
  for (const b of s.blocks) {
    for (const sign of [1, -1] as const) {
      const far = maxSlide(s, b.id, sign)
      for (let d = 1; d <= far; d++) {
        const next = slide(s, b.id, sign * d)
        if (next !== s) out.push({ id: b.id, delta: sign * d, next })
      }
    }
  }
  return out
}

const rows: string[] = []
let totalStates = 0
console.log('lvl name          blocks states  solved par(pinned) openings optimal-openings red-moves worst-dist')
LEVELS.forEach((lvl, i) => {
  const start = fromLevel(i)
  // full graph over positions; solved positions are terminal in play but we still
  // count them. Edges from a solved position are not explored (game ends).
  const states = new Map<string, State>([[key(start), start]])
  const adj = new Map<string, string[]>()
  const queue = [start]
  while (queue.length) {
    const s = queue.shift()!
    const k = key(s)
    const nexts: string[] = []
    // explore from solved positions too (with status forced back to playing) so the graph is symmetric
    const live: State = s.status === 'won' ? { ...s, status: 'playing' } : s
    for (const m of moves(live)) {
      const nk = key(m.next)
      nexts.push(nk)
      if (!states.has(nk)) {
        states.set(nk, m.next)
        queue.push(m.next)
      }
    }
    adj.set(k, nexts)
  }
  // multi-source BFS from solved positions (moves are reversible → graph undirected)
  const dist = new Map<string, number>()
  const q: string[] = []
  for (const [k, s] of states) if (isSolved(s)) {
      dist.set(k, 0)
      q.push(k)
    }
  while (q.length) {
    const k = q.shift()!
    for (const nk of adj.get(k)!) if (!dist.has(nk)) {
        dist.set(nk, dist.get(k)! + 1)
        q.push(nk)
      }
  }
  const par = dist.get(key(start))!
  const opens = moves(start)
  const optimalOpens = opens.filter((m) => dist.get(key(m.next)) === par - 1)
  // follow one optimal line, count red-block moves
  let cur = start
  let red = 0
  while (!isSolved(cur)) {
    const d = dist.get(key(cur))!
    const m = moves(cur).find((mm) => dist.get(key(mm.next)) === d - 1)!
    if (m.id === 'X') red++
    cur = m.next
  }
  let worst = 0
  for (const d of dist.values()) worst = Math.max(worst, d)
  const solvedCount = [...states.values()].filter(isSolved).length
  totalStates += states.size
  const flag = par === LEVEL_PAR[i] ? '' : ` MISMATCH(pinned ${LEVEL_PAR[i]})`
  rows.push(
    `${String(i + 1).padStart(3)} ${lvl.name.padEnd(13)} ${String(lvl.blocks.length).padStart(6)} ${String(states.size).padStart(6)} ${String(solvedCount).padStart(7)} ${String(par).padStart(5)}${flag} ${String(opens.length).padStart(9)} ${String(optimalOpens.length).padStart(8)} (${optimalOpens.map((m) => `${m.id}${m.delta > 0 ? '+' : ''}${m.delta}`).join(' ')}) ${String(red).padStart(4)} ${String(worst).padStart(5)}`,
  )
})
rows.forEach((r) => console.log(r))
console.log(`levels: ${LEVELS.length}, total reachable positions across bank: ${totalStates}`)
const pars = [...LEVEL_PAR]
console.log(`par sum ${pars.reduce((a, b) => a + b, 0)}, median ${[...pars].sort((a, b) => a - b)[Math.floor(pars.length / 2)]}`)
