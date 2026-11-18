import { describe, expect, it } from 'vitest'
import { BOTS, simulate } from './sim'
import {
  STAR_BONUS, STAR_EVERY, STAR_FROM, STAR_GAP, STAR_HALF_MAX, STAR_MID_HALF_MAX, starCandidate, starHalfOf,
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
        // 겹치지 않음: 별 구간(가운데·별 섬)은 STAR_GAP, 나머지는 MIN_GAP
        expect(d - prev.halfW - isl.halfW).toBeGreaterThanOrEqual((isl.star || isl.starReach !== undefined ? STAR_GAP : MIN_GAP) - 1e-6)
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

describe('별 섬(11-18)', () => {
  const build = (seed: number, n = 46) => {
    const st = newGame(seed)
    ensureIslands(st, n)
    return st.islands
  }

  it('불변식(1,000시드): 별 섬은 앞 섬이 보장한 거리 안, 반폭 ≤40(≥18), 4개 간격 이상, STAR_FROM 이후, 가운데 섬 ≤50, 두 칸·한 칸 점프가 항상 닿는다', () => {
    let stars = 0
    let firstStarSum = 0
    for (let seed = 1; seed <= 1000; seed++) {
      const isl = build(seed)
      const first = isl.findIndex((x) => x.star)
      firstStarSum += first >= 0 ? first : isl.length
      let lastStar = -99
      for (let i = 0; i < isl.length; i++) {
        const s = isl[i]
        if (!s.star) continue
        stars++
        expect(i).toBeGreaterThanOrEqual(STAR_FROM)
        expect(starCandidate(seed, i)).toBe(true)
        expect(i - lastStar).toBeGreaterThanOrEqual(STAR_EVERY)
        lastStar = i
        expect(s.halfW).toBe(starHalfOf(i))
        expect(s.halfW).toBeLessThanOrEqual(STAR_HALF_MAX)
        // 두 칸 점프(i-2 → 별)는 가운데 섬(i-1)의 바람 기준 사거리 0.85배·카메라 상한 안
        const dSkip = s.cx - isl[i - 2].cx
        expect(dSkip).toBeLessThanOrEqual(Math.min(D_CAP, D_MAX_FRAC * rangeMax(isl[i - 1].wind)) + 1e-9)
        // 가운데→별 간격은 섬 가장자리 사이 MIN_GAP 이상, 한 칸씩 가는 점프도 별 섬 바람 기준 사거리 0.85배·카메라 상한 안(리뷰 지적)
        const dStep = s.cx - isl[i - 1].cx
        expect(dStep).toBeGreaterThanOrEqual(isl[i - 1].halfW + s.halfW + STAR_GAP - 1e-9)
        expect(isl[i - 1].halfW).toBeLessThanOrEqual(STAR_MID_HALF_MAX) // 가운데 섬은 작다
        expect(isl[i - 2].cx + isl[i - 2].halfW + STAR_GAP).toBeLessThanOrEqual(isl[i - 1].cx - isl[i - 1].halfW + 1e-9)
        expect(dStep).toBeLessThanOrEqual(Math.min(D_CAP, D_MAX_FRAC * rangeMax(s.wind)) + 1e-9)
      }
    }
    expect(stars).toBeGreaterThan(5000) // 시드당 평균 5개 이상 등장(46섬 기준)
    expect(firstStarSum / 1000).toBeLessThan(14) // 첫 별 섬은 평균 14번째 이전(11-18 밤: 18번째가 너무 늦다는 지적)
  })

  it('같은 시드는 같은 별 섬 배치(결정적)', () => {
    expect(build(777).map((s) => !!s.star)).toEqual(build(777).map((s) => !!s.star))
  })

  it('한 번에 두 칸(별 섬)에 착지하면 +4, 일반 착지 점수에 가산(콤보 유지)', () => {
    const seed = 4242
    const st = newGame(seed)
    ensureIslands(st, 46)
    const k = st.islands.findIndex((s) => s.star)
    expect(k).toBeGreaterThan(2)
    st.cur = k - 2
    st.landed = 5
    const from = st.islands[st.cur]
    const mid = st.islands[st.cur + 1]
    const star = st.islands[k]
    const p = (star.cx - from.cx) / rangeMax(mid.wind) // 정확히 별 섬 중심으로
    expect(p).toBeLessThanOrEqual(1)
    const before = st.score
    expect(jump(st, p * pingOf(st.cur + 1))).toBe(true)
    expect(st.cur).toBe(k)
    expect(st.stars).toBe(1)
    expect(st.score - before).toBeGreaterThanOrEqual(1 + STAR_BONUS) // good(+1) 또는 perfect(+2×배수) + 4
  })

  it('한 칸씩 가면(가운데 섬 → 별 섬) 별 보너스가 없다', () => {
    const st = newGame(4242)
    ensureIslands(st, 46)
    const k = st.islands.findIndex((s) => s.star)
    st.cur = k - 2
    const from = st.islands[st.cur]
    const mid = st.islands[st.cur + 1]
    const p1 = (mid.cx - from.cx) / rangeMax(mid.wind)
    expect(jump(st, p1 * pingOf(st.cur + 1))).toBe(true)
    expect(st.cur).toBe(k - 1)
    const star = st.islands[k]
    const p2 = (star.cx - st.islands[k - 1].cx) / rangeMax(star.wind)
    expect(jump(st, p2 * pingOf(st.cur + 1))).toBe(true)
    expect(st.cur).toBe(k)
    expect(st.stars).toBe(0)
  })

  it('별 섬 보너스는 정확히 두 칸 건너뛰기만(세 칸 점프가 별에 앉아도 보너스 없음)', () => {
    const st = newGame(4242)
    ensureIslands(st, 46)
    const k = st.islands.findIndex((s) => s.star)
    st.cur = k - 3 // 세 칸 앞이 별
    const from = st.islands[st.cur]
    const star = st.islands[k]
    const p = (star.cx - from.cx) / rangeMax(st.islands[st.cur + 1].wind)
    if (p > 0 && p <= 1) {
      const ok = jump(st, p * pingOf(st.cur + 1))
      if (ok && st.cur === k) expect(st.stars).toBe(0)
    }
  })

  it('별 시도(starTry)는 가운데 섬을 넘긴 점프만 true, 한 칸 점프는 false', () => {
    const st = newGame(4242)
    ensureIslands(st, 46)
    const k = st.islands.findIndex((s) => s.star)
    st.cur = k - 2
    const from = st.islands[st.cur]
    const mid = st.islands[st.cur + 1]
    const pMid = (mid.cx - from.cx) / rangeMax(mid.wind)
    press(st, 0)
    release(st, pMid * pingOf(st.cur + 1))
    expect(st.flight!.starTry).toBe(false)
    const st2 = newGame(4242)
    ensureIslands(st2, 46)
    st2.cur = k - 2
    const pStar = (st2.islands[k].cx - from.cx) / rangeMax(mid.wind)
    press(st2, 0)
    release(st2, pStar * pingOf(st2.cur + 1))
    expect(st2.flight!.starTry).toBe(true)
  })

  it('별을 노리지 않는 사람형 봇의 난이도는 변하지 않는다(기준선 대비 중앙 섬 수 ±2: σ30=33, σ40=28, σ60=21(별 섬 도입 직전). 현재 32/27/20 = −1섬)', () => {
    const base: Record<string, number> = { c30: 33, c40: 28, c60: 21 }
    for (const k of ['c30', 'c40', 'c60'] as const) {
      const r = simulate(BOTS[k], 300)
      expect(Math.abs(r.medianLanded - base[k]), k).toBeLessThanOrEqual(2)
    }
  })
})

