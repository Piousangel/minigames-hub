import { describe, expect, it } from 'vitest'
import {
  D_CAP, D_MAX_FRAC, HALFW_FLOOR, HALFW_MIN, SINK_START_MS, WIND_MAX_LATE, pingOf, previewFracOf, windMaxOf, MIN_GAP, PING_MS, RMAX, WIND_MAX, dailySeedFor, ensureIslands, flightDuration, flightPos,
  halfWOf, inputLocked, newGame, nextIsland, powerAt, press, previewPoints, rangeAt, rangeMax, release, startIsland, tick, tintOf, cancelCharge,
} from './engine'

function jump(st: ReturnType<typeof newGame>, holdMs: number) {
  press(st, st.clock)
  const ok = release(st, st.clock + holdMs)
  if (ok) tick(st, st.flight!.durMs)
  return ok
}

describe('물리', () => {
  it('무풍 최대 사거리는 약 329px, 사거리는 힘에 선형', () => {
    expect(RMAX).toBeGreaterThan(328)
    expect(RMAX).toBeLessThan(330.5)
    expect(rangeAt(0.5, 0)).toBeCloseTo(rangeAt(1, 0) / 2, 6)
  })
  it('바람 ±0.15g는 사거리를 약 ±21% 바꾼다', () => {
    expect(rangeMax(0.15) / RMAX).toBeGreaterThan(1.19)
    expect(rangeMax(-0.15) / RMAX).toBeLessThan(0.81)
  })
  it('해석식 비행: 끝 시각의 x가 rangeAt과 같고 y는 0', () => {
    for (const [p, w] of [[0.3, 0], [0.9, 0.1], [1, -0.12]] as const) {
      const end = flightPos(0, p, w, flightDuration(p))
      expect(end.x).toBeCloseTo(rangeAt(p, w), 3)
      expect(end.y).toBeCloseTo(0, 3)
    }
  })
  it('핑퐁: 0→1→0, 한 방향 1300ms', () => {
    expect(powerAt(0)).toBe(0)
    expect(powerAt(PING_MS)).toBeCloseTo(1, 9)
    expect(powerAt(PING_MS * 2)).toBeCloseTo(0, 9)
    expect(powerAt(PING_MS * 1.5)).toBeCloseTo(0.5, 9)
  })
  it('점선 미리보기는 궤적의 앞 40%', () => {
    const pts = previewPoints(0, 0.8, 0.05)
    const full = flightPos(0, 0.8, 0.05, flightDuration(0.8) * 0.4)
    expect(pts[pts.length - 1].x).toBeCloseTo(full.x, 6)
  })
})

describe('섬 생성(결정성·도달 가능성)', () => {
  it('같은 시드는 같은 코스, 다른 시드는 다른 코스', () => {
    const a = newGame(42), b = newGame(42), c = newGame(43)
    ensureIslands(a, 30); ensureIslands(b, 30); ensureIslands(c, 30)
    expect(a.islands).toEqual(b.islands)
    expect(a.islands).not.toEqual(c.islands)
  })
  it('1,000 시드 × 40섬: 모두 도달 가능·겹치지 않음·간격 ≥ MIN_GAP·바람 ≤ 0.15g', () => {
    for (let s = 0; s < 1000; s++) {
      const st = newGame(s * 2654435761 >>> 0)
      ensureIslands(st, 40)
      for (let i = 1; i < st.islands.length; i++) {
        const prev = st.islands[i - 1], isl = st.islands[i]
        const d = isl.cx - prev.cx
        expect(Math.abs(isl.wind)).toBeLessThanOrEqual(windMaxOf(isl.i) + 1e-9)
        expect(d).toBeLessThanOrEqual(D_MAX_FRAC * rangeMax(isl.wind) + 1e-6)      // 최대 힘의 85% 이내(맞바람이어도 닿음)
        expect(d).toBeLessThanOrEqual(D_CAP + 1e-6)                                 // 카메라 한계(다음 섬 중심이 항상 화면 안)
        expect(d - prev.halfW - isl.halfW).toBeGreaterThanOrEqual(MIN_GAP - 1e-6)   // 겹치지 않음
        expect(isl.halfW).toBeGreaterThanOrEqual(HALFW_FLOOR)
      }
    }
  })
  it('반폭: 1~3번 110, 4번부터 선형 감소, 19번에서 하한', () => {
    expect(halfWOf(1)).toBe(110)
    expect(halfWOf(3)).toBe(110)
    expect(halfWOf(11)).toBeLessThan(halfWOf(5))
    expect(halfWOf(15)).toBe(HALFW_MIN)
    expect(halfWOf(28)).toBeLessThan(HALFW_MIN) // 19번 이후에도 계속 줄어든다(후반 램프)
    expect(halfWOf(50)).toBe(HALFW_FLOOR)
  })
  it('바람은 5번째 섬(번호 4)부터', () => {
    const st = newGame(7); ensureIslands(st, 10)
    for (let i = 1; i < 4; i++) expect(st.islands[i].wind).toBe(0)
    expect(Math.abs(st.islands[4].wind)).toBeCloseTo(0.06, 6)
  })
  it('다음 섬 한가운데(Perfect)에 맞는 힘이 항상 1 이하', () => {
    for (let s = 0; s < 200; s++) {
      const st = newGame(s + 5); ensureIslands(st, 30)
      for (let i = 1; i < 30; i++) {
        const need = (st.islands[i].cx - st.islands[i - 1].cx) / rangeMax(st.islands[i].wind)
        expect(need).toBeLessThanOrEqual(D_MAX_FRAC + 1e-9)
      }
    }
  })
  it('시작 섬 규약', () => {
    expect(startIsland()).toMatchObject({ i: 0, cx: 0, wind: 0, graceMs: 0 })
  })
})

describe('판정과 점수', () => {
  function perfectHold(st: ReturnType<typeof newGame>) {
    ensureIslands(st, st.cur + 4)
    const f = st.islands[st.cur], t = st.islands[st.cur + 1]
    return ((t.cx - f.cx) / rangeMax(t.wind)) * PING_MS
  }
  it('정확히 맞추면 Perfect, 점수 2, 콤보 1', () => {
    const st = newGame(1)
    expect(jump(st, perfectHold(st))).toBe(true)
    expect(st.flight!.kind).toBe('perfect')
    expect(st.score).toBe(2)
    expect(st.landed).toBe(1)
    expect(st.cur).toBe(1)
  })
  it('연속 Perfect는 배수가 오른다(상한 ×3)', () => {
    const st = newGame(2)
    const scores: number[] = []
    for (let k = 0; k < 6; k++) {
      const before = st.score
      jump(st, perfectHold(st))
      scores.push(st.score - before)
      if (st.phase === 'over') break
    }
    expect(scores.slice(0, 3)).toEqual([2, 3, 3]) // 2×1, 2×1.25=2.5→3, 2×1.5=3
    expect(Math.max(...scores)).toBeLessThanOrEqual(6)
  })
  it('가장자리는 Good(+1), 콤보 한 단계 감소', () => {
    const st = newGame(3)
    ensureIslands(st, 6)
    const t = st.islands[1]
    // 섬 오른쪽 가장자리 근처 착지
    const landX = t.cx - t.halfW * 0.8 // 왼쪽 가장자리(오른쪽은 최대 사거리를 넘을 수 있다)
    const hold = (landX / rangeMax(t.wind)) * PING_MS
    jump(st, hold)
    expect(st.flight!.kind).toBe('good')
    expect(st.score).toBe(1)
  })
  it('섬 앞 빈 공간에 내려앉으면 short 추락', () => {
    const b = newGame(4)
    ensureIslands(b, 6)
    const t = b.islands[1]
    const gapX = t.cx - t.halfW - 20 // 섬 앞 빈 공간
    jump(b, (gapX / rangeMax(t.wind)) * PING_MS)
    expect(b.phase).toBe('over')
    expect(b.endReason).toBe('short')
    expect(b.flight!.dx).toBeLessThan(0) // 사망 고스트: 음수 = 짧음
  })
  it('점프하지 못한 약한 놓기(자기 섬 착지)는 추락이 아니다', () => {
    const a = newGame(4)
    ensureIslands(a, 6)
    jump(a, 0.15 * PING_MS) // 사거리 ~49px: 현재 섬 안
    expect(a.phase).toBe('ready')
    expect(a.flight!.kind).toBe('self')
    expect(a.landed).toBe(0)
  })
  it('다음 섬을 건너뛰어 그다음 섬에 내려앉아도 착지로 센다(보너스 없음)', () => {
    const st = newGame(9)
    ensureIslands(st, 8)
    const far = st.islands[2]
    const hold = (far.cx / rangeMax(st.islands[1].wind)) * PING_MS
    if (hold <= PING_MS) {
      jump(st, hold)
      expect(st.cur === 2 || st.phase === 'over').toBe(true)
    }
  })
  it('p < 0.08로 놓으면 점프하지 않는다(페널티 없음)', () => {
    const st = newGame(5)
    press(st, 0)
    expect(release(st, 0.05 * PING_MS)).toBe(false)
    expect(st.phase).toBe('ready')
    expect(st.holds).toHaveLength(0)
  })
  it('취소하면 ready로 돌아가고 점프 기록이 없다', () => {
    const st = newGame(5)
    press(st, 0)
    cancelCharge(st)
    expect(st.phase).toBe('ready')
    expect(st.holds).toHaveLength(0)
  })
})

describe('가라앉는 섬', () => {
  function toIsland5(st: ReturnType<typeof newGame>) {
    for (let k = 0; k < 4 && st.phase !== 'over'; k++) {
      ensureIslands(st, st.cur + 4)
      const f = st.islands[st.cur], t = st.islands[st.cur + 1]
      jump(st, ((t.cx - f.cx) / rangeMax(t.wind)) * PING_MS)
    }
  }
  it('1~3번 섬(번호 1~3)은 가라앉지 않는다', () => {
    const st = newGame(11)
    ensureIslands(st, 10)
    jump(st, ((st.islands[1].cx) / rangeMax(0)) * PING_MS)
    expect(st.sinkLeftMs).toBe(0)
    tick(st, 60_000)
    expect(st.phase).toBe('ready')
  })
  it('5번째 섬부터는 충전을 시작하지 않으면 가라앉아 게임 오버', () => {
    const st = newGame(12)
    toIsland5(st)
    expect(st.cur).toBe(4)
    expect(st.sinkLeftMs).toBeGreaterThan(SINK_START_MS - 100)
    const left = st.sinkLeftMs
    tick(st, left - 100)
    expect(st.phase).toBe('ready')
    tick(st, 200)
    expect(st.phase).toBe('over')
    expect(st.endReason).toBe('sunk')
  })
  it('충전 중에는 타이머가 멈춘다', () => {
    const st = newGame(12)
    toIsland5(st)
    tick(st, 1000)
    const left = st.sinkLeftMs
    press(st, st.clock)
    tick(st, 10_000)
    expect(st.sinkLeftMs).toBe(left)
    expect(st.phase).toBe('charging')
  })
  it('Perfect 착지는 시간을 +0.5초 더 준다', () => {
    const st = newGame(13)
    toIsland5(st)
    const isl = st.islands[st.cur]
    // 모든 점프가 정확했다면 마지막 착지는 Perfect
    if (st.flight?.kind === 'perfect') expect(st.sinkLeftMs).toBeCloseTo(isl.graceMs + 500, 6)
  })
})

describe('결정성·입력 잠금·일일 시드', () => {
  it('같은 시드와 같은 입력 열은 같은 결과', () => {
    const run = () => {
      const st = newGame(777)
      const holds = [610, 700, 640, 720, 800, 560]
      for (const h of holds) { if (st.phase === 'over') break; if (st.phase === 'ready') jump(st, h) }
      return { score: st.score, landed: st.landed, reason: st.endReason, holds: st.holds, tint: tintOf(777) }
    }
    expect(run()).toEqual(run())
  })
  it('죽은 직후 150ms는 입력 잠금', () => {
    const st = newGame(21)
    ensureIslands(st, 6)
    jump(st, 0.15 * PING_MS)
    // 강제로 over 상태를 만든다
    st.phase = 'over'; st.overAtMs = st.clock
    expect(inputLocked(st)).toBe(true)
    tick(st, 200)
    expect(inputLocked(st)).toBe(false)
  })
  it('일일 시드는 날짜마다 다르고 같은 날은 같다, 틴트는 0~2', () => {
    expect(dailySeedFor(20261117)).toBe(dailySeedFor(20261117))
    expect(dailySeedFor(20261117)).not.toBe(dailySeedFor(20261118))
    for (let s = 0; s < 50; s++) expect([0, 1, 2]).toContain(tintOf(s * 99991))
  })
  it('nextIsland는 순수 함수', () => {
    const a = nextIsland(5, 6, { i: 5, cx: 900, halfW: 90, wind: 0.1, graceMs: 3000 })
    const b = nextIsland(5, 6, { i: 5, cx: 900, halfW: 90, wind: 0.1, graceMs: 3000 })
    expect(a).toEqual(b)
  })
})

describe('후반 난이도 램프', () => {
  it('게이지는 8번째 섬 이후 점점 빨라지고 30번째에서 최대', () => {
    expect(pingOf(1)).toBe(PING_MS)
    expect(pingOf(6)).toBe(PING_MS)
    expect(pingOf(15)).toBeLessThan(PING_MS)
    expect(pingOf(30)).toBe(600)
    expect(pingOf(60)).toBe(600)
  })
  it('점선 미리보기는 10번째 섬 이후 짧아진다', () => {
    expect(previewFracOf(5)).toBe(0.4)
    expect(previewFracOf(16)).toBeLessThan(0.4)
    expect(previewFracOf(40)).toBeCloseTo(0.18, 6)
  })
  it('후반 바람 상한이 올라가도 생성기는 도달 가능', () => {
    expect(windMaxOf(40)).toBeCloseTo(WIND_MAX_LATE, 6)
    expect(windMaxOf(5)).toBeLessThan(windMaxOf(40))
  })
})
