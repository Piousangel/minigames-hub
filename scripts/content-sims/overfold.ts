/**
 * Overfold content sim — is par really the minimum, and how forgiving is a board?
 *
 * Run: npx --yes tsx@4.19.2 scripts/content-sims/overfold.ts
 *
 * For levels 1..5 (par 3..7) generates boards with the real generateBoard
 * (mulberry32(seed), seeds 1..N) and searches every fold sequence with the
 * real previewFold. Both prefer sides are tried on even creases (keyboard
 * Shift+Enter folds the high side; a tap always folds the low side).
 *
 * Reports per level:
 *   - board size and pip count
 *   - true minimum folds to clear every pip (any route), vs par
 *   - minimum folds to clear while never forming a jam ("clean" route)
 *   - how many first folds still allow a win within the fold budget (par+3)
 *   - win chance and mean score for a player who taps random creases
 *   - score of replaying the generator's own par solution
 *   - best achievable score (exhaustive search over every fold sequence)
 *
 * Note: isWon() only asks "are any pips left?". A pip that folds onto a jam is
 * destroyed, so jams also remove pips — which is why random play wins so often.
 */
import {
  FOLD_SLACK,
  PAR_BONUS,
  generateBoard,
  isWon,
  legalCreases,
  mulberry32,
  pipCount,
  previewFold,
  type Board,
  type Prefer,
} from '../../src/lib/games/overfold/engine'

const N = Number(process.env.N ?? 1000)

type Move = { axis: 'v' | 'h'; index: number; prefer: Prefer }

function moves(b: Board): Move[] {
  const out: Move[] = []
  for (const c of legalCreases(b)) {
    const dim = c.axis === 'v' ? b.w : b.h
    out.push({ ...c, prefer: 'low' })
    if (c.index * 2 === dim) out.push({ ...c, prefer: 'high' })
  }
  return out
}

const bkey = (b: Board) => `${b.w}x${b.h}:${b.cells.join(',')}`

/** Min folds to reach a pip-free board within `limit`; Infinity if none. clean=true forbids jams/blocked pips. */
function minFolds(b: Board, limit: number, clean: boolean, memo = new Map<string, number>()): number {
  if (isWon(b)) return 0
  if (limit === 0 || (b.w === 1 && b.h === 1)) return Infinity
  const k = `${limit}|${bkey(b)}`
  const hit = memo.get(k)
  if (hit !== undefined) return hit
  let best = Infinity
  for (const m of moves(b)) {
    const p = previewFold(b, m.axis, m.index, m.prefer)
    if (clean && p.overlaps.some((o) => o.kind === 'jam' || o.kind === 'blocked')) continue
    const sub = 1 + minFolds(p.next, limit - 1, clean, memo)
    if (sub < best) best = sub
  }
  memo.set(k, best)
  return best
}

/** Count fold sequences (each move equally likely at every step) that win within `limit`: returns win probability. */
function randomWinProb(b: Board, limit: number, memo = new Map<string, number>()): number {
  if (isWon(b)) return 1
  if (limit === 0 || (b.w === 1 && b.h === 1)) return 0
  const k = `${limit}|${bkey(b)}`
  const hit = memo.get(k)
  if (hit !== undefined) return hit
  // A tap never chooses 'high', so the random player only uses low-side folds.
  const ms = legalCreases(b)
  let sum = 0
  for (const m of ms) sum += randomWinProb(previewFold(b, m.axis, m.index, 'low').next, limit - 1, memo)
  const p = sum / ms.length
  memo.set(k, p)
  return p
}

/** Best total score reachable from `b` having used `used` folds. -Infinity if no win is reachable. */
function bestScore(b: Board, used: number, par: number, budget: number, memo: Map<string, number>): number {
  if (isWon(b)) return used <= par ? PAR_BONUS : 0
  if (used >= budget || (b.w === 1 && b.h === 1)) return -Infinity
  const k = `${used}|${bkey(b)}`
  const hit = memo.get(k)
  if (hit !== undefined) return hit
  let best = -Infinity
  for (const m of moves(b)) {
    const p = previewFold(b, m.axis, m.index, m.prefer)
    const v = p.scoreDelta + bestScore(p.next, used + 1, par, budget, memo)
    if (v > best) best = v
  }
  memo.set(k, best)
  return best
}

/** Expected score for a random tapper (a loss keeps whatever seals were banked). */
function randomScore(b: Board, used: number, par: number, budget: number, memo: Map<string, number>): number {
  if (isWon(b)) return used <= par ? PAR_BONUS : 0
  if (used >= budget || (b.w === 1 && b.h === 1)) return 0
  const k = `${used}|${bkey(b)}`
  const hit = memo.get(k)
  if (hit !== undefined) return hit
  const ms = legalCreases(b)
  let sum = 0
  for (const m of ms) {
    const p = previewFold(b, m.axis, m.index, 'low')
    sum += p.scoreDelta + randomScore(p.next, used + 1, par, budget, memo)
  }
  const v = sum / ms.length
  memo.set(k, v)
  return v
}

for (let level = 1; level <= 5; level++) {
  const stat = {
    w: 0,
    h: 0,
    pips: 0,
    par: 0,
    below: 0,
    cleanEqPar: 0,
    cleanBelow: 0,
    firstMoves: 0,
    firstOk: 0,
    firstOkMin: Infinity,
    randWin: 0,
    jamShortcut: 0,
    randScore: 0,
    parScore: 0,
    maxScore: 0,
    maxBeatsPar: 0,
    anySum: 0,
    cleanSum: 0,
  }
  for (let seed = 1; seed <= N; seed++) {
    const { board, par, solution } = generateBoard(mulberry32(seed), level)
    const budget = par + FOLD_SLACK
    stat.w += board.w
    stat.h += board.h
    stat.pips += pipCount(board)
    stat.par += par
    const any = minFolds(board, budget, false)
    const clean = minFolds(board, budget, true)
    stat.anySum += any
    stat.cleanSum += clean
    if (any < par) stat.below++
    if (clean === par) stat.cleanEqPar++
    if (clean < par) stat.cleanBelow++
    if (any < clean) stat.jamShortcut++
    const ms = moves(board)
    let ok = 0
    const memo = new Map<string, number>()
    for (const m of ms) {
      const nb = previewFold(board, m.axis, m.index, m.prefer).next
      if (1 + minFolds(nb, budget - 1, false, memo) <= budget) ok++
    }
    stat.firstMoves += ms.length
    stat.firstOk += ok
    stat.firstOkMin = Math.min(stat.firstOkMin, ok)
    stat.randWin += randomWinProb(board, budget)
    stat.randScore += randomScore(board, 0, par, budget, new Map())
    let sb = board
    let ps = 0
    for (const m of solution) {
      const p = previewFold(sb, m.axis, m.index, m.prefer)
      ps += p.scoreDelta
      sb = p.next
    }
    if (!isWon(sb)) throw new Error('par solution did not win')
    ps += PAR_BONUS
    stat.parScore += ps
    const mx = bestScore(board, 0, par, budget, new Map())
    stat.maxScore += mx
    if (mx > ps) stat.maxBeatsPar++
  }
  const f = (x: number) => (x / N).toFixed(2)
  const pc = (x: number) => ((100 * x) / N).toFixed(1) + '%'
  console.log(`\n## Level ${level} — ${N} boards (seeds 1..${N})`)
  console.log(`  mean size ${f(stat.w)} x ${f(stat.h)}, mean pips ${f(stat.pips)}, par ${f(stat.par)}, fold budget par+${FOLD_SLACK}`)
  console.log(`  mean minimum folds: any route ${f(stat.anySum)}, jam-free route ${f(stat.cleanSum)} (par ${f(stat.par)})`)
  console.log(`  boards beatable in fewer folds than par (any route): ${stat.below} (${pc(stat.below)})`)
  console.log(`  clean (jam-free) minimum == par: ${pc(stat.cleanEqPar)}; clean minimum < par: ${pc(stat.cleanBelow)}`)
  console.log(`  boards where jamming gives a shorter win than any clean route: ${stat.jamShortcut} (${pc(stat.jamShortcut)})`)
  console.log(`  first folds that keep a win in budget: ${(stat.firstOk / N).toFixed(2)} of ${(stat.firstMoves / N).toFixed(2)} on average (min ${stat.firstOkMin})`)
  console.log(`  win chance for a player who taps random creases: ${((100 * stat.randWin) / N).toFixed(1)}%; their mean score ${f(stat.randScore)}`)
  console.log(`  replaying the generator's par solution scores ${f(stat.parScore)} on average; best possible ${f(stat.maxScore)}; best beats the par line on ${pc(stat.maxBeatsPar)} of boards`)
}
