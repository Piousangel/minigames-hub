import { describe, expect, it } from 'vitest'
import { buildTargets, distToPath, strokeStats } from './strokeSample'

describe('strokeSample', () => {
  it('목표 경로 20개, id 중복 없음, 캔버스(폭 1·높이 1.25) 안', () => {
    const t = buildTargets()
    expect(t).toHaveLength(20)
    expect(new Set(t.map((x) => x.id)).size).toBe(20)
    for (const { pts } of t) for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0.05)
      expect(p.x).toBeLessThanOrEqual(0.95)
      expect(p.y).toBeGreaterThanOrEqual(0.05)
      expect(p.y).toBeLessThanOrEqual(1.2)
    }
  })
  it('경로 위의 점은 거리 0, 선에서 0.1 떨어진 점은 0.1', () => {
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }]
    expect(distToPath({ x: 0.5, y: 0 }, path)).toBe(0)
    expect(distToPath({ x: 0.5, y: 0.1 }, path)).toBeCloseTo(0.1)
    expect(distToPath({ x: 1.3, y: 0 }, path)).toBeCloseTo(0.3)
  })
  it('통계: 일정하게 10px 벗어난 획의 rms·시작/끝 오차·속도', () => {
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }]
    const s = Array.from({ length: 11 }, (_, i) => ({ x: i / 10, y: 10 / 360, t: i * 100 }))
    const st = strokeStats(s, path, 360)
    expect(st.rms).toBeCloseTo(10, 5)
    expect(st.startErr).toBeCloseTo(10, 5)
    expect(st.endErr).toBeCloseTo(10, 5)
    expect(st.meanSpeed).toBeCloseTo(360, 3)
  })
  it('점이 2개 미만이면 0 통계', () => {
    expect(strokeStats([{ x: 0, y: 0, t: 0 }], [{ x: 0, y: 0 }, { x: 1, y: 0 }], 360).rms).toBe(0)
  })
})
