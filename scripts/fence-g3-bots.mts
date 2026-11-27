/**
 * 꽃담 정원 G3-1(#264): G2 합격 판마다 봇 두 종(무작위·한 수 앞 탐욕) 성공률 + 12판 고르기.
 * 실행: pnpm dlx tsx scripts/fence-g3-bots.mts [개수=200] [시드 시작=1] [봇 시도=1000] [봇 시드=7]
 * 같은 인자로 두 번 돌리면 같은 숫자(전부 시드 고정). 선정 규칙은 generator의 pickSet — 판 내용이 아니라 시드만 고른다.
 */
import { botRate } from '../src/lib/games/fencegarden/bots'
import { generateHop, gradeHop, passesGate, pickSet, orderIssues, FENCE_SET_SEEDS, type SetRow } from '../src/lib/games/fencegarden/generator'

const count = Number(process.argv[2] ?? 200)
const seed0 = Number(process.argv[3] ?? 1)
const trials = Number(process.argv[4] ?? 1000)
const botSeed = Number(process.argv[5] ?? 7)

const t0 = Date.now()
const rows: SetRow[] = []
for (let i = 0; i < count; i++) {
  const seed = seed0 + i
  const g = gradeHop(generateHop(seed), { botTrials: trials, botSeed })
  if (!passesGate(g)) continue
  rows.push({
    seed,
    min: g.min!,
    sets: g.fenceSetsAtMin,
    planless: g.bot,
    random: botRate(g.puzzle, 'random', trials, botSeed),
    greedy: botRate(g.puzzle, 'greedy', trials, botSeed),
  })
}
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
console.log(`G2 합격 ${rows.length}판(시드 ${seed0}~${seed0 + count - 1}, 봇 ${trials}회·시드 ${botSeed}) · ${((Date.now() - t0) / 1000).toFixed(1)}초`)
console.log('\n| 시드 | 최소 턴 | 집합 | 잡초 우선 봇 | 무작위 봇 | 한 수 앞 봇 |\n|---|---|---|---|---|---|')
for (const r of rows) console.log(`| ${r.seed} | ${r.min} | ${r.sets} | ${pct(r.planless)} | ${pct(r.random)} | ${pct(r.greedy)} |`)

const set = pickSet(rows)
console.log(`\n선정 ${set.length}판(쉬움 → 어려움)\n| # | 시드 | 최소 턴 | 집합 | 한 수 앞 봇 | 무작위 봇 |\n|---|---|---|---|---|---|`)
set.forEach((r, i) => console.log(`| ${i + 1} | ${r.seed} | ${r.min} | ${r.sets} | ${pct(r.greedy)} | ${pct(r.random)} |`))
const issues = orderIssues(set)
console.log(`\n순서 역전(최소 턴 2 이상 감소): ${issues.length ? issues.join(', ') : '없음'}`)
const same = JSON.stringify(set.map((r) => r.seed)) === JSON.stringify(FENCE_SET_SEEDS)
console.log(`FENCE_SET_SEEDS와 같음: ${same ? '예' : '아니오 — ' + JSON.stringify(set.map((r) => r.seed))}`)
