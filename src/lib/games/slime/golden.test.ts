import { describe, expect, it } from 'vitest'
import { runLine, waypointsToRaw } from './solver'
import type { Stage } from './types'
import { KNOWN_LEGACY_STAGES, SHIPPED_EXTRA_STAGES, STAGE_HINTS } from './stages'

/**
 * 골든 회귀(11-19): 엔진에 기믹(튕기는 벽 등)을 더해도 **기존 스테이지의 결과는 한 비트도 바뀌지 않는다**.
 * 기믹 필드가 없는 스테이지는 이전과 같은 계산 경로를 탄다는 증명. 이 값을 고치려면 출시된 일일 결과가 바뀐다는 뜻이므로
 * 반드시 새 스테이지 id로 내보낼 것(DECISIONS 11-19, 엔지니어 의견서).
 */
const GOLDEN: string[] = [
  "g-slide|hint|nest,211,3,20.1365",
  "g-slide|diag|nest,194,1,16.7858",
  "g-slide|flat|fell,321,2,181.8509",
  "g-slide-m|hint|nest,211,3,20.1365",
  "g-slide-m|diag|fell,196,1,250.5262",
  "g-slide-m|flat|fell,181,1,323.0085",
  "s-spike|hint|nest,203,3,21.0083",
  "s-spike|diag|spiked,140,1,293.9610",
  "s-spike|flat|spiked,164,2,297.7969",
  "s-spike-m|hint|nest,203,3,21.0083",
  "s-spike-m|diag|fell,196,2,250.5262",
  "s-spike-m|flat|fell,181,2,323.0085",
  "g-wall|hint|nest,232,3,18.8149",
  "g-wall|diag|stalled,284,1,238.0891",
  "g-wall|flat|fell,431,1,121.2336",
  "g-wall-m|hint|nest,232,3,18.8149",
  "g-wall-m|diag|fell,199,1,260.5060",
  "g-wall-m|flat|fell,292,1,330.6585",
  "s-wall-b|hint|nest,276,3,19.9183",
  "s-wall-b|diag|stalled,297,2,186.7975",
  "s-wall-b|flat|fell,385,1,164.6881",
  "s-wall-b-m|hint|nest,276,3,19.9183",
  "s-wall-b-m|diag|fell,190,1,265.0732",
  "s-wall-b-m|flat|fell,224,1,333.7613"
]

/**
 * 11-20 보강: 이미 출시된 c-meadow·s-bounce는 위 표(기본 4 + 반전본)에 없었다. **위 표는 한 줄도 건드리지 않고** 별도 표로 고정한다
 * (반전본은 만들지 않는다 — 풀에서 빠졌다, 오너 11-19).
 */
const GOLDEN_SHIPPED_EXTRA: string[] = [
  "c-meadow|hint|nest,202,3,19.9985",
  "c-meadow|diag|spiked,118,1,370.2108",
  "c-meadow|flat|fell,321,2,181.8509",
  "s-bounce|hint|nest,391,3,18.2919",
  "s-bounce|diag|fell,296,2,137.4461",
  "s-bounce|flat|fell,385,3,164.6881"
]

function goldenRows(stages: Stage[]): string[] {
  const rows: string[] = []
  for (const st of stages) {
    const lines: [string, { x: number; y: number }[]][] = [
      ['hint', waypointsToRaw(STAGE_HINTS[st.id])],
      ['diag', [{ x: 50, y: 150 }, { x: 315, y: 488 }]],
      ['flat', [{ x: 40, y: 260 }, { x: 350, y: 300 }]],
    ]
    for (const [name, raw] of lines) {
      const r = runLine(st, raw)
      const res = r ? r.res : null
      rows.push(`${st.id}|${name}|${res ? `${res.outcome},${res.steps},${res.acorns},${res.minNest.toFixed(4)}` : 'invalid'}`)
    }
  }
  return rows
}

describe('엔진 골든 회귀', () => {
  it('기존 스테이지 × 고정 선 3종의 결과(결과·스텝·별·근접도)가 같다', () => {
    expect(goldenRows(KNOWN_LEGACY_STAGES)).toEqual(GOLDEN)
  })
  it('출시된 추가 스테이지(c-meadow·s-bounce)도 같다', () => {
    expect(goldenRows(SHIPPED_EXTRA_STAGES)).toEqual(GOLDEN_SHIPPED_EXTRA)
  })
})
