/** G2 관문: 봇 시뮬 합격선(브리프 8-1장). 출력하려면 PLOP_SIM=1 */
import { describe, expect, it } from 'vitest'
import { BOTS, simulate } from './sim'

const R = { s8: simulate(BOTS.s8), s12: simulate(BOTS.s12), s18: simulate(BOTS.s18), slow: simulate(BOTS.slow) }

if (process.env.PLOP_SIM) {
  const fmt = (r: ReturnType<typeof simulate>) => ({
    중앙값: r.medianLanded, p10: r.p10, p90: r.p90, 퍼펙트비율: +r.perfectRatio.toFixed(3), 첫5섬: +r.first5.toFixed(3), 중앙초: +r.medianSec.toFixed(1), 사망률: Object.fromEntries(Object.entries(r.deathRate).map(([k, v]) => [k, +v.toFixed(3)])), 바람비율: +r.windRatio.toFixed(2),
    원인: Object.fromEntries(Object.entries(r.reasons).map(([k, v]) => [k, +v.toFixed(3)])),
  })
  console.log(JSON.stringify({ s8: fmt(R.s8), s12: fmt(R.s12), s18: fmt(R.s18), slow: fmt(R.slow) }, null, 1))
}

describe('G2 봇 시뮬 합격선', () => {
  it('σ18% 봇: 첫 5섬 성공률 ≥ 90%', () => {
    expect(R.s18.first5).toBeGreaterThanOrEqual(0.9)
  })
  it('σ12% 봇: 도달 섬 수 중앙값 10~24, 한 판 중앙 20~60초', () => {
    expect(R.s12.medianLanded).toBeGreaterThanOrEqual(10)
    expect(R.s12.medianLanded).toBeLessThanOrEqual(24)
    expect(R.s12.medianSec).toBeGreaterThanOrEqual(20)
    expect(R.s12.medianSec).toBeLessThanOrEqual(60)
  })
  it('σ8% 봇: Perfect 비율 45~65%', () => {
    expect(R.s8.perfectRatio).toBeGreaterThanOrEqual(0.45)
    expect(R.s8.perfectRatio).toBeLessThanOrEqual(0.65)
  })
  it('사망 원인: 짧음/김이 한쪽으로 쏠리지 않고(35~65%), 가라앉음은 20% 이하', () => {
    for (const r of [R.s8, R.s12, R.s18]) {
      const miss = (r.reasons.short ?? 0) + (r.reasons.long ?? 0)
      if (miss > 0.3) {
        expect((r.reasons.short ?? 0) / miss).toBeGreaterThanOrEqual(0.35)
        expect((r.reasons.short ?? 0) / miss).toBeLessThanOrEqual(0.65)
      }
      expect(r.reasons.sunk ?? 0).toBeLessThanOrEqual(0.2)
    }
  })
  it('바람 공정성: 센 바람(≥0.1g) 점프의 사망률이 약한 바람 점프의 1.4배 이하(같은 단계 비교)', () => {
    for (const r of [R.s12, R.s18]) expect(r.windRatio).toBeLessThanOrEqual(1.4)
  })
  it('느린 플레이어(사고 0.8~3.0초): 가라앉음이 눈에 띄는 원인이되 주된 원인은 아님(5~40%)', () => {
    const sunk = R.slow.reasons.sunk ?? 0
    expect(sunk).toBeGreaterThanOrEqual(0.05)
    expect(sunk).toBeLessThanOrEqual(0.4)
  })
})
