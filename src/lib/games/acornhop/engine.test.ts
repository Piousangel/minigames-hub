import { describe, expect, it } from 'vitest'
import {
  ACORN_REFILL, AMMO_MAX, AMMO_START, BAND, REST_EVERY, TAP_COOLDOWN, VIEW_H,
  bandObjects, cameraTop, createGame, dailySeedFor, heightM, isOver, objectsInRange, previewPath, scoreOf, step,
  type HopInput, type HopState,
} from './engine'

const run = (s: HopState, script: Array<[number, HopInput]>, ticks: number): HopState => {
  const at = new Map(script)
  let cur = s
  for (let t = 1; t <= ticks && !isOver(cur); t++) cur = step(cur, at.get(t) ?? null)
  return cur
}

describe('생성', () => {
  it('같은 시드는 같은 하늘을, 다른 시드는 다른 하늘을 만든다', () => {
    const a = JSON.stringify(objectsInRange(7, -2000, 0))
    expect(JSON.stringify(objectsInRange(7, -2000, 0))).toBe(a)
    expect(JSON.stringify(objectsInRange(8, -2000, 0))).not.toBe(a)
  })
  it('쉼터 섬은 REST_EVERY 밴드마다 나오고 그 밴드엔 위험물이 없다', () => {
    for (const seed of [1, 2, 3, 99]) {
      const o = bandObjects(seed, REST_EVERY)
      expect(o.some((x) => x.kind === 'island')).toBe(true)
      expect(o.some((x) => x.kind === 'bramble' || x.kind === 'storm')).toBe(false)
    }
  })
  it('3밴드마다 도토리가 보장된다(탄이 영영 끊기지 않게)', () => {
    for (const seed of [1, 5, 42]) for (const b of [3, 6, 9, 12]) expect(bandObjects(seed, b).some((x) => x.kind === 'acorn')).toBe(true)
  })
  it('초반 밴드(1~2)에는 위험물이 없다', () => {
    for (const seed of [1, 2, 3]) for (const b of [1, 2]) expect(bandObjects(seed, b).some((x) => x.kind === 'bramble' || x.kind === 'storm')).toBe(false)
  })
  it('daily 시드는 날짜마다 다르다', () => {
    expect(dailySeedFor(20261117)).not.toBe(dailySeedFor(20261118))
  })
})

describe('조작과 탄', () => {
  it('첫 탭이 비행을 시작하고 탄 1발을 쓰고 위로 튀어 오른다', () => {
    const s = step(createGame(1), { tap: 1 })
    expect(s.phase).toBe('flying')
    expect(s.ammo).toBe(AMMO_START - 1)
    expect(s.vy).toBeLessThan(0)
    expect(s.vx).toBeGreaterThan(0)
    expect(s.events).toContain('tap')
  })
  it('왼쪽 탭은 왼쪽으로 튀어 오른다', () => {
    expect(step(createGame(1), { tap: -1 }).vx).toBeLessThan(0)
  })
  it('쿨다운 안의 연타는 탄을 쓰지 않는다', () => {
    let s = step(createGame(1), { tap: 1 })
    s = step(s, { tap: 1 })
    expect(s.ammo).toBe(AMMO_START - 1)
    for (let i = 0; i < TAP_COOLDOWN; i++) s = step(s, null)
    s = step(s, { tap: 1 })
    expect(s.ammo).toBe(AMMO_START - 2)
  })
  it('탄이 없으면 dry 이벤트만 나고 속도가 변하지 않는다', () => {
    let s = { ...step(createGame(1), { tap: 1 }), ammo: 0 }
    for (let i = 0; i < TAP_COOLDOWN + 1; i++) s = step(s, null)
    const before = s.vy
    const t = step(s, { tap: 1 })
    expect(t.events).toContain('dry')
    expect(t.vy).toBeCloseTo(before + 0.16, 5)
  })
})

describe('물리', () => {
  it('벽에서 튕긴다', () => {
    let s = step(createGame(1), { tap: -1 })
    s = run(s, [], 120)
    expect(s.x).toBeGreaterThanOrEqual(13)
  })
  it('최고 높이는 줄지 않고 점수는 높이+별로 계산된다', () => {
    const s = run(createGame(3), [[1, { tap: 1 }], [10, { tap: -1 }], [20, { tap: 1 }]], 60)
    expect(heightM(s.minY)).toBeGreaterThan(0)
    expect(scoreOf(s)).toBe(heightM(s.minY) + s.stars * 15)
  })
  it('같은 입력이면 같은 결과(결정성)', () => {
    const script: Array<[number, HopInput]> = [[1, { tap: 1 }], [12, { tap: -1 }], [30, { tap: 1 }], [50, { tap: -1 }]]
    const a = run(createGame(11), script, 200)
    const b = run(createGame(11), script, 200)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('종료와 보상', () => {
  it('아무것도 안 하고 떨어지면 끝난다(fell)', () => {
    let s = step(createGame(1), { tap: 1 })
    s = run(s, [], 900)
    expect(s.phase).toBe('over')
    expect(s.endReason).toBe('fell')
  })
  it('도토리를 먹으면 탄이 채워진다(상한 AMMO_MAX)', () => {
    const seed = 5
    const b = 3
    const acorn = bandObjects(seed, b).find((o) => o.kind === 'acorn')!
    const s0 = createGame(seed)
    const s: HopState = { ...s0, phase: 'flying', grounded: false, x: acorn.x, y: acorn.y, minY: acorn.y, ammo: 1, vy: 0 }
    const t = step(s, null)
    expect(t.events).toContain('acorn')
    expect(t.ammo).toBe(Math.min(AMMO_MAX, 1 + ACORN_REFILL))
    expect(t.acorns).toBe(1)
  })
  it('별을 먹으면 stars가 늘고 같은 별은 두 번 먹히지 않는다', () => {
    const seed = 9
    let star: ReturnType<typeof bandObjects>[number] | undefined
    let b = 1
    while (!star && b < 40) star = bandObjects(seed, b++).find((o) => o.kind === 'star')
    const s: HopState = { ...createGame(seed), phase: 'flying', grounded: false, x: star!.x, y: star!.y, minY: star!.y, ammo: 3 }
    const t = step(s, null)
    expect(t.stars).toBe(1)
    const u = step({ ...t, x: star!.x, y: star!.y, vy: 0 }, null)
    expect(u.stars).toBe(1)
  })
  it('가시덤불에 닿으면 끝난다(brambled)', () => {
    let br: ReturnType<typeof bandObjects>[number] | undefined
    let b = 3
    while (!br && b < 80) br = bandObjects(1, b++).find((o) => o.kind === 'bramble')
    const s: HopState = { ...createGame(1), phase: 'flying', grounded: false, x: br!.x, y: br!.y, minY: br!.y, ammo: 3 }
    const t = step(s, null)
    expect(t.phase).toBe('over')
    expect(t.endReason).toBe('brambled')
  })
  it('쉼터 섬에 위에서 내려앉으면 서고 탄이 기본치까지 채워진다', () => {
    const seed = 2
    const isl = bandObjects(seed, REST_EVERY).find((o) => o.kind === 'island')!
    const s: HopState = { ...createGame(seed), phase: 'flying', grounded: false, x: isl.x, y: isl.y - 13 - 3, minY: isl.y - 100, ammo: 1, vy: 4 }
    const t = step(s, null)
    expect(t.grounded).toBe(true)
    expect(t.ammo).toBe(AMMO_START)
    expect(t.events).toContain('land')
  })
})

describe('보조', () => {
  it('카메라는 올라간 만큼만 따라간다', () => {
    expect(cameraTop({ minY: -1000 })).toBeLessThan(cameraTop({ minY: -100 }))
    expect(cameraTop({ minY: 0 })).toBeLessThanOrEqual(0)
    expect(VIEW_H).toBeGreaterThan(BAND)
  })
  it('미리보기는 탄이 없으면 비고, 있으면 위로 향한다', () => {
    const s = createGame(1)
    expect(previewPath({ ...s, ammo: 0 }, 1)).toEqual([])
    const p = previewPath(s, 1)
    expect(p.length).toBeGreaterThan(3)
    expect(Math.min(...p.map((q) => q.y))).toBeLessThan(s.y)
  })
})
