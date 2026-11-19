import { describe, expect, it } from 'vitest'
import { canonLines, decodeLine, encodeLine } from './canon'
import { DAILY_ATTEMPTS, attemptScore, scoreOf } from './daily'
import { simulate } from './engine'
import { SLIME_STAGES, STAGE_HINTS } from './stages'
import { dist, polyLength, processStroke, segmentHitsSpawnBan } from './strokePipeline'
import { CONST, type Pt, type Stage } from './types'
import { BAN_SLACK, INK_SLACK, MAX_GAP, checkLine, dayAcceptable, verifyDay } from './verify'

/** 추천 길 웨이포인트를 손으로 그은 것처럼 4px 간격 원점으로(SlimeProto waypointsToRaw와 같은 생각). */
function rawFrom(wp: Pt[]): Pt[] {
  const out: Pt[] = [wp[0]]
  for (let i = 1; i < wp.length; i++) {
    const d = dist(wp[i - 1], wp[i])
    const n = Math.max(1, Math.ceil(d / 4))
    for (let k = 1; k <= n; k++) out.push({ x: wp[i - 1].x + ((wp[i].x - wp[i - 1].x) * k) / n, y: wp[i - 1].y + ((wp[i].y - wp[i - 1].y) * k) / n })
  }
  return out
}
const hintLine = (s: Stage): Pt[] => processStroke(rawFrom(STAGE_HINTS[s.id]), s.ink)!
/** 확실히 실패하는 선: 보드 아래쪽 구석의 짧은 수평선. */
const missLine = (): Pt[] => processStroke(rawFrom([{ x: 300, y: 80 }, { x: 360, y: 80 }]), 400)!
const att = (l: Pt[]) => ({ lines: [encodeLine(l)] })

let seed = 12345
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648

describe('canon', () => {
  it('encode/decode 왕복이 손실 없다(0.5 격자)', () => {
    const l = hintLine(SLIME_STAGES[0])
    expect(decodeLine(encodeLine(l))).toEqual(l)
  })
  it('형식이 틀리면 null', () => {
    expect(decodeLine([[1, 2]])).toBeNull()
    expect(decodeLine([[1, 2], [1.5, 2]])).toBeNull()
    expect(decodeLine([[1, 2], [3]])).toBeNull()
    expect(decodeLine('x')).toBeNull()
  })
  it('canonLines는 그린 순서와 무관하다(첫 점 x → y → 점 수 → 좌표)', () => {
    const a = [{ x: 10, y: 5 }, { x: 20, y: 5 }]
    const b = [{ x: 10, y: 1 }, { x: 30, y: 9 }]
    const c = [{ x: 3, y: 50 }, { x: 4, y: 50 }]
    expect(canonLines([a, b, c])).toEqual(canonLines([c, a, b]))
    expect(canonLines([a, b, c])[0]).toBe(c)
    expect(canonLines([a, b, c])[1]).toBe(b)
  })
})

describe('dayAcceptable(UTC−12~+14, 나라별 현지 자정)', () => {
  const now = Date.parse('2026-11-20T03:00:00Z')
  it('UTC 날짜 앞뒤 하루는 어떤 시간대에선가 오늘이다', () => {
    expect(dayAcceptable('2026-11-20', now)).toBe(true)
    expect(dayAcceptable('2026-11-19', now)).toBe(true) // UTC−4 이하에선 아직 19일
    expect(dayAcceptable('2026-11-21', Date.parse('2026-11-20T11:00:00Z'))).toBe(true) // UTC+13
  })
  it('먼 날짜·잘못된 형식은 거부', () => {
    expect(dayAcceptable('2026-11-21', now)).toBe(false) // UTC+14에서도 20일 17시
    expect(dayAcceptable('2026-11-17', now)).toBe(false)
    expect(dayAcceptable('2026-02-30', now)).toBe(false)
    expect(dayAcceptable('20261120', now)).toBe(false)
  })
  it('UTC−12의 자정 직후 30분까지 유예', () => {
    const end = Date.parse('2026-11-19T00:00:00Z') + 36 * 3_600_000
    expect(dayAcceptable('2026-11-19', end + 29 * 60_000)).toBe(true)
    expect(dayAcceptable('2026-11-19', end + 31 * 60_000)).toBe(false)
  })
})

describe('checkLine: 클라 파이프라인이 만든 정직한 선은 절대 거부하지 않는다(퍼즈)', () => {
  it('사람형 무작위 획 스테이지당 1,500개 → 모두 통과, 허용 오차 실측 보고', () => {
    let inkOver = -Infinity
    let gapMax = 0
    let banClosest = Infinity
    let n = 0
    for (const st of SLIME_STAGES) {
      for (let k = 0; k < 1500; k++) {
        // 클라 onDown/onMove 규칙: 시작점은 금지 반경 밖, 직전 점과의 선분이 원을 지나면 그 점을 버리고, 잉크 한도에서 멈춘다
        const p0 = { x: rnd() * 390, y: rnd() * 560 }
        if (dist(p0, st.spawn) < CONST.SPAWN_BAN_R) continue
        const raw: Pt[] = [p0]
        let ang = rnd() * 6.283
        let x = p0.x
        let y = p0.y
        const steps = 20 + Math.floor(rnd() * 160)
        for (let i = 0; i < steps; i++) {
          ang += (rnd() - 0.5) * 0.9
          const sp = 1 + rnd() * 24
          x += Math.cos(ang) * sp
          y += Math.sin(ang) * sp
          const p = { x, y }
          if (segmentHitsSpawnBan(raw[raw.length - 1], p, st.spawn)) continue
          if (polyLength(raw) >= st.ink) break
          raw.push(p)
        }
        const l = processStroke(raw, st.ink)
        if (!l) continue
        n++
        const wire = decodeLine(encodeLine(l))!
        expect(checkLine(wire, st)).toBeNull()
        inkOver = Math.max(inkOver, polyLength(wire) - st.ink)
        for (let i = 1; i < wire.length; i++) gapMax = Math.max(gapMax, dist(wire[i - 1], wire[i]))
        for (const p of wire) banClosest = Math.min(banClosest, dist(p, st.spawn))
      }
    }
    expect(n).toBeGreaterThan(3000)
    // 실측이 허용 오차 안쪽에 여유 있게 있는지(값이 바뀌면 보고 문서의 표도 갱신)
    expect(inkOver).toBeLessThan(INK_SLACK)
    expect(gapMax).toBeLessThanOrEqual(MAX_GAP)
    expect(banClosest).toBeGreaterThan(CONST.SPAWN_BAN_R - BAN_SLACK)
  })

  it('위조 모양은 거부: 점 건너뛰기·잉크 초과·스폰 위 시작·보드 밖', () => {
    const st = SLIME_STAGES[0]
    const good = hintLine(st)
    expect(checkLine(good, st)).toBeNull()
    expect(checkLine([good[0], good[good.length - 1]], st)).toBe('gap')
    const long: Pt[] = Array.from({ length: Math.ceil(st.ink / 8) + 4 }, (_, i) => ({ x: 20 + (i % 40) * 8, y: 300 + Math.floor(i / 40) * 8 }))
    expect(checkLine(long, st)).not.toBeNull()
    const onSpawn = [{ x: st.spawn.x, y: st.spawn.y + 2 }, { x: st.spawn.x + 8, y: st.spawn.y + 2 }, ...Array.from({ length: 6 }, (_, i) => ({ x: st.spawn.x + 16 + i * 8, y: st.spawn.y + 2 }))]
    expect(checkLine(onSpawn, st)).toBe('spawn ban')
    expect(checkLine(good.map((p) => ({ x: p.x + 1000, y: p.y })), st)).toBe('out of board')
  })
})

describe('verifyDay: 서버 재계산 = 클라 결과', () => {
  it('정직한 하루(전 스테이지 추천 길 1회 클리어): 점수가 클라 공식과 같다', () => {
    const stages = SLIME_STAGES.map((s) => [att(hintLine(s))])
    const r = verifyDay('2026-11-20', stages)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    let expected = 0
    for (const s of SLIME_STAGES) {
      const l = hintLine(s)
      const sim = simulate(s, [l])
      expect(sim.outcome).toBe('nest')
      expected += scoreOf(sim.outcome, sim.acorns, polyLength(l), s.ink)
    }
    expect(r.total).toBe(expected)
    expect(r.cleared).toBe(SLIME_STAGES.length)
    expect(r.hints).toBe(0)
  })

  it('두 번 실패 뒤 세 번째 시도는 힌트 시도 → 별 상한 2(클라가 hint:false라고 보내도 서버가 계산)', () => {
    const s = SLIME_STAGES[0]
    const l = hintLine(s)
    const r = verifyDay('2026-11-20', [[att(missLine()), att(missLine()), { ...att(l), hint: false }]])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const third = r.stages[0][2]
    expect(third.hint).toBe(true)
    expect(third.outcome).toBe('nest')
    expect(third.score).toBe(attemptScore('nest', third.stars, polyLength(l), s.ink, true))
    expect(r.total).toBeLessThanOrEqual(2 * 100 + 100)
  })

  it('잠긴 스테이지·클리어 뒤 시도·시도 4번·선 개수 위반은 거부', () => {
    const s0 = hintLine(SLIME_STAGES[0])
    expect(verifyDay('2026-11-20', [[att(missLine())], [att(hintLine(SLIME_STAGES[1]))]])).toMatchObject({ ok: false })
    expect(verifyDay('2026-11-20', [[att(s0), att(s0)]])).toMatchObject({ ok: false })
    expect(verifyDay('2026-11-20', [Array.from({ length: DAILY_ATTEMPTS + 1 }, () => att(missLine()))])).toMatchObject({ ok: false })
    expect(verifyDay('2026-11-20', [[{ lines: [] }]])).toMatchObject({ ok: false })
    expect(verifyDay('2026-11-20', [[{ lines: [encodeLine(s0), encodeLine(s0)] }]])).toMatchObject({ ok: false })
    expect(verifyDay('2026-11-20', new Array(SLIME_STAGES.length + 1).fill([]))).toMatchObject({ ok: false })
  })

  it('3번 소진하면 다음 스테이지가 열린다(0점으로 지나감)', () => {
    const r = verifyDay('2026-11-20', [[att(missLine()), att(missLine()), att(missLine())], [att(hintLine(SLIME_STAGES[1]))]])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.cleared).toBe(1)
  })

  it('CPU 예산: 최악(전 스테이지 3시도) 검증이 Node에서 판당 ≤3ms', () => {
    const stages = SLIME_STAGES.map(() => [att(missLine()), att(missLine()), att(missLine())])
    verifyDay('2026-11-20', stages) // 워밍업
    const N = 20
    const t0 = performance.now()
    for (let i = 0; i < N; i++) verifyDay('2026-11-20', stages)
    const perDay = (performance.now() - t0) / N
    const perRun = perDay / (stages.length * 3)
    // 부하 높은 공유 기계라 넉넉한 상한(목표는 판당 중앙값 ≤1ms, 스펙 D-20). 실측은 보고서에 기록.
    expect(perRun).toBeLessThan(3)
  })
})
