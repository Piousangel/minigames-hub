import { describe, expect, it } from 'vitest'
import { simulate } from './engine'
import { mulberry32, perturb } from './rng'
import { capInk, chaikin, dropClose, polyLength, processStroke, rdp, resample } from './strokePipeline'
import { CONST, type Pt, type Stage } from './types'

const base: Stage = {
  id: 't',
  tier: 1,
  terrain: [],
  spawn: { x: 100, y: 100 },
  acorns: [{ x: -90, y: -90 }, { x: -90, y: -90 }, { x: -90, y: -90 }],
  nest: { x: 900, y: 900 },
  spikes: [],
  ink: 600,
}
const floor = (y: number, x0 = 0, x1 = 390) => ({ a: { x: x0, y }, b: { x: x1, y } })

describe('engine', () => {
  it('아무것도 없으면 떨어진다(추락)', () => {
    const r = simulate(base, [])
    expect(r.outcome).toBe('fell')
    expect(r.steps).toBeGreaterThan(CONST.START_DELAY)
  })

  it('낙하 시작은 손을 뗀 뒤 0.5초(60스텝) 지연', () => {
    const tr: Pt[] = []
    simulate(base, [], undefined, tr)
    // 지연 동안은 제자리: 첫 트레이스 점(지연 직후)이 스폰 근처
    expect(Math.abs(tr[0].y - base.spawn.y)).toBeLessThan(5)
  })

  it('바닥 위에서 멈추면 stalled(1초 연속 느림)', () => {
    const r = simulate({ ...base, terrain: [floor(300)] }, [])
    expect(r.outcome).toBe('stalled')
  })

  it('둥지에 닿으면 도착, 밤송이에 닿으면 실패', () => {
    const rest = { x: 100, y: 300 - CONST.D0 }
    expect(simulate({ ...base, terrain: [floor(300)], nest: rest }, []).outcome).toBe('nest')
    expect(simulate({ ...base, terrain: [floor(300)], spikes: [rest] }, []).outcome).toBe('spiked')
  })

  it('속도 상한(800px/s)에서도 얇은 선을 통과하지 않는다(터널링 없음)', () => {
    // 520px 낙하하면 상한에 걸린다(자유낙하 속도 ~967 > 800). 선이 하나뿐이어도 뚫리면 안 된다.
    const stage: Stage = { ...base, spawn: { x: 195, y: 0 }, terrain: [floor(520, 100, 290)] }
    const r = simulate(stage, [])
    expect(r.outcome).not.toBe('fell')
  })

  it('경사면에서는 미끄러진다(마찰 0.08은 작음)', () => {
    const slope: Stage = { ...base, spawn: { x: 60, y: 100 }, terrain: [{ a: { x: 40, y: 160 }, b: { x: 330, y: 420 } }], nest: { x: 300, y: 380 } }
    expect(simulate(slope, []).outcome).toBe('nest')
  })

  it('결정적: 같은 입력은 매번 같은 결과(1,000회)', () => {
    const stage: Stage = { ...base, terrain: [floor(500, 150, 390)], nest: { x: 330, y: 484 } }
    const line = processStroke([{ x: 80, y: 140 }, { x: 140, y: 300 }, { x: 220, y: 470 }], 600)!
    const first = JSON.stringify(simulate(stage, [line]))
    for (let i = 0; i < 1000; i++) expect(JSON.stringify(simulate(stage, [line]))).toBe(first)
  })

  it('물리 계수(g·마찰)를 바꾸면 결과가 달라질 수 있다(강건성 시험이 의미 있음)', () => {
    const stage: Stage = { ...base, terrain: [floor(300)] }
    expect(simulate(stage, [], { g: 700, e: 0.1, mu: 0.08 }).steps).not.toBe(simulate(stage, [], { g: 1100, e: 0.1, mu: 0.08 }).steps)
  })
})

describe('strokePipeline', () => {
  const line = (n: number): Pt[] => Array.from({ length: n }, (_, i) => ({ x: i * 5, y: 0 }))

  it('3px 미만으로 가까운 점은 버린다', () => {
    expect(dropClose([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 0 }]).length).toBe(2)
  })

  it('RDP는 일직선 점을 양 끝으로 줄이고, Chaikin은 끝점을 유지', () => {
    expect(rdp(line(20), 1.5)).toHaveLength(2)
    const c = chaikin([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }])
    expect(c[0]).toEqual({ x: 0, y: 0 })
    expect(c[c.length - 1]).toEqual({ x: 20, y: 0 })
  })

  it('8px 간격 재샘플', () => {
    const r = resample([{ x: 0, y: 0 }, { x: 80, y: 0 }], 8)
    expect(r.length).toBeGreaterThanOrEqual(10)
    expect(Math.abs(r[1].x - r[0].x - 8)).toBeLessThan(1e-9)
  })

  it('잉크 한도에서 선이 멈춘다', () => {
    expect(polyLength(capInk(line(100), 100))).toBeLessThanOrEqual(100.0001)
  })

  it('40px 미만 선은 null(시작 안 함), 정상 선은 0.5px 격자 위', () => {
    expect(processStroke([{ x: 10, y: 10 }, { x: 30, y: 10 }], 500)).toBeNull()
    const out = processStroke([{ x: 10, y: 10 }, { x: 60, y: 40 }, { x: 120, y: 90 }], 500)!
    for (const p of out) {
      expect(p.x * 2).toBeCloseTo(Math.round(p.x * 2), 9)
      expect(p.y * 2).toBeCloseTo(Math.round(p.y * 2), 9)
    }
  })
})

describe('사람형 오차(perturb) 보정', () => {
  it('점당 총 rms가 σ에 가깝다(프로토타입 ×0.5 버그 재발 방지)', () => {
    const rng = mulberry32(42)
    const dense: Pt[] = Array.from({ length: 200 }, (_, i) => ({ x: i * 2, y: 100 }))
    let sum = 0
    let n = 0
    for (let k = 0; k < 400; k++) {
      const p = perturb(dense, 10, 0, rng) // 떨림 없이 순수 저주파+점별
      for (let i = 0; i < p.length; i++) {
        sum += (p[i].x - dense[i].x) ** 2 + (p[i].y - dense[i].y) ** 2
        n += 2
      }
    }
    const rms = Math.sqrt(sum / n)
    expect(rms).toBeGreaterThan(9)
    expect(rms).toBeLessThan(11)
  })
})

import { lineHitsSpawnBan, segmentHitsSpawnBan } from './strokePipeline'
describe('스폰 금지 반경 선분 판정', () => {
  const spawn = { x: 100, y: 100 }
  it('점이 모두 밖이어도 선분이 원을 지나면 금지', () => {
    expect(segmentHitsSpawnBan({ x: 50, y: 150 }, { x: 110, y: 40 }, spawn)).toBe(true)
  })
  it('멀리 지나가는 선분은 허용', () => {
    expect(segmentHitsSpawnBan({ x: 0, y: 300 }, { x: 300, y: 300 }, spawn)).toBe(false)
    expect(lineHitsSpawnBan([{ x: 0, y: 300 }, { x: 300, y: 300 }], spawn)).toBe(false)
  })
})

import { runLine, waypointsToRaw } from './solver'
import { SLIME_STAGES, STAGE_HINTS } from './stages'
describe('추천 길(힌트)', () => {
  it('모든 스테이지의 추천 길이 실제로 도착하고 별 3개를 먹는다', () => {
    for (const st of SLIME_STAGES) {
      const r = runLine(st, waypointsToRaw(STAGE_HINTS[st.id]))
      expect(r?.res.outcome, st.id).toBe('nest')
      expect(r?.res.acorns, st.id).toBe(3)
    }
  })
})

import { mirrorStage } from './stages'
import { BOARD_W } from './types'
describe('미러 스테이지', () => {
  it('원본과 반전본에서 같은(반전한) 선이 같은 결과를 낸다', () => {
    const mx = (p: { x: number; y: number }) => ({ x: BOARD_W - p.x, y: p.y })
    for (const st of SLIME_STAGES.filter((s) => !s.id.endsWith('-m') && !s.bouncy)) {
      const hint = waypointsToRaw(STAGE_HINTS[st.id])
      const a = runLine(st, hint)
      const b = runLine(mirrorStage(st), hint.map(mx))
      expect(b?.res.outcome, st.id).toBe(a?.res.outcome)
      expect(b?.res.acorns, st.id).toBe(a?.res.acorns)
    }
  })
  it('스테이지 id가 모두 다르고, 새 규칙 스테이지가 반전본 자리를 대체한다', () => {
    expect(new Set(SLIME_STAGES.map((s) => s.id)).size).toBe(SLIME_STAGES.length)
    expect(SLIME_STAGES.map((s) => s.id)).toEqual(['g-slide', 'g-slide-m', 's-spike', 's-spike-m', 'g-wall', 's-bounce', 's-wall-b', 's-wall-b-m'])
  })
})

describe('추천 길은 그리기 구역에서 시작한다', () => {
  it('시작점이 스크롤 띠(x<20 또는 >370)에 있지 않다', () => {
    for (const [id, wp] of Object.entries(STAGE_HINTS)) {
      expect(wp[0].x, id).toBeGreaterThanOrEqual(20)
      expect(wp[0].x, id).toBeLessThanOrEqual(370)
    }
  })
})

describe('3단계 튕기는 벽', () => {
  const st = SLIME_STAGES.find((s) => s.id === 's-bounce')!
  it('추천 길로 별 3개를 먹고 도착하며, 튕김을 빼면 같은 선이 실패한다(튕김이 정말 필요)', () => {
    const r = runLine(st, waypointsToRaw(STAGE_HINTS['s-bounce']))
    expect(r?.res.outcome).toBe('nest')
    expect(r?.res.acorns).toBe(3)
    expect(simulate({ ...st, bouncy: undefined }, [r!.line]).outcome).not.toBe('nest')
  })
  it('같은 입력은 항상 같은 결과(결정성)', () => {
    const line = runLine(st, waypointsToRaw(STAGE_HINTS['s-bounce']))!.line
    const a = simulate(st, [line])
    const b = simulate(st, [line])
    expect(b).toEqual(a)
  })
})
