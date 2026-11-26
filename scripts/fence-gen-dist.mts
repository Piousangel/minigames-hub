/**
 * 꽃담 정원 G2(#255): 생성기 200개 분포 판정.
 * 실행: pnpm dlx tsx scripts/fence-gen-dist.mts [개수=200] [시드 시작=1] [봇 시도=1000]
 * 합격 = 최소 턴 ≥ 3 · 최소 해 울타리 집합 ≤ 3 · 계획 없는 봇 < 20%(턴 한도 = 최소 + 2). 합격 비율 ≥ 10% → G3.
 */
import { generateHop, gradeHop, passesGate, summarize, GATE, SOLVE_CAP, type GenOpts } from '../src/lib/games/fencegarden/generator'

const count = Number(process.argv[2] ?? 200)
const seed0 = Number(process.argv[3] ?? 1)
const botTrials = Number(process.argv[4] ?? 1000)
const opts: GenOpts = process.argv[5] ? JSON.parse(process.argv[5]) : {}

const rows = []
const passed = []
const t0 = Date.now()
for (let i = 0; i < count; i++) {
  const seed = seed0 + i
  const g = gradeHop(generateHop(seed, opts), { botTrials, botSeed: 7 })
  rows.push(g)
  if (passesGate(g)) passed.push(g)
}
const s = summarize(rows)
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const hist = (h: Record<string, number>, keys: string[]) => keys.map((k) => `| ${k} | ${h[k] ?? 0} |`).join('\n')
console.log(`판 ${s.total}개(시드 ${seed0}~${seed0 + count - 1}, 봇 ${botTrials}회, 솔버 상한 ${SOLVE_CAP}턴, 옵션 ${JSON.stringify(opts)}) · ${((Date.now() - t0) / 1000).toFixed(1)}초`)
console.log(`합격 ${s.passed} / ${s.total} = ${pct(s.ratio)} (기준 ${pct(GATE.passRatio)}) → ${s.verdict === 'G3' ? 'G3 제안' : '미달'}`)
console.log('\n최소 턴\n| 턴 | 판 |\n|---|---|\n' + hist(s.minHist, ['1', '2', '3', '4', 'none']))
console.log('\n최소 해 울타리 집합 수(풀리는 판)\n| 집합 | 판 |\n|---|---|\n' + hist(s.setsHist, ['1', '2', '3', '4-9', '10+']))
console.log('\n계획 없는 봇 해결률(풀리는 판)\n| 구간 | 판 |\n|---|---|\n' + hist(s.botHist, ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90']))
const deep = rows.filter((r) => r.min !== null && r.min >= GATE.minTurns)
const nSets = deep.filter((r) => r.fenceSetsAtMin <= GATE.maxSets).length
const nBot = deep.filter((r) => r.bot < GATE.maxBot).length
console.log(`\n조건별(최소 턴 ≥3인 ${deep.length}판 중): 집합 ≤3 ${nSets} · 봇 <20% ${nBot} · 둘 다 ${s.passed}`)
console.log('\n합격 판(시드·최소·집합·봇)')
for (const g of passed) console.log(`${g.puzzle.id} min ${g.min} sets ${g.fenceSetsAtMin} bot ${pct(g.bot)} start ${g.puzzle.start} flowers ${g.puzzle.flowers} weeds ${g.puzzle.weeds} fixed ${g.puzzle.fixed}`)
