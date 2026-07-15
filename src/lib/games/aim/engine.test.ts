import { describe, expect, it } from 'vitest'
import {
  accuracy,
  DEFAULT_TARGET_COUNT,
  isComplete,
  MARGIN,
  newGame,
  nextTarget,
  registerHit,
  registerMiss,
  targetsPerSecond,
  type AimState,
} from './engine'

const play = (n: number, target = 5): AimState => {
  let s = newGame(target)
  for (let i = 0; i < n; i++) s = registerHit(s)
  return s
}

describe('newGame', () => {
  it('빈 상태로 시작한다', () => {
    const s = newGame(30)
    expect(s.targetCount).toBe(30)
    expect(s.hits).toBe(0)
    expect(s.misses).toBe(0)
    expect(s.done).toBe(false)
  })
  it('인자 없으면 기본 목표 수를 쓴다', () => {
    expect(newGame().targetCount).toBe(DEFAULT_TARGET_COUNT)
  })
})

describe('registerHit', () => {
  it('히트는 hits를 늘리고 완료로 다가간다', () => {
    let s = newGame(3)
    s = registerHit(s)
    expect(s.hits).toBe(1)
    expect(s.done).toBe(false)
    s = registerHit(s)
    expect(s.hits).toBe(2)
    expect(s.done).toBe(false)
  })
  it('목표 수만큼 히트하면 완료된다', () => {
    const s = play(5, 5)
    expect(s.hits).toBe(5)
    expect(s.done).toBe(true)
    expect(isComplete(s)).toBe(true)
  })
  it('완료 후 추가 히트는 무시된다', () => {
    const done = play(5, 5)
    const after = registerHit(done)
    expect(after).toBe(done)
    expect(after.hits).toBe(5)
  })
  it('완료 전에는 isComplete가 false', () => {
    expect(isComplete(play(4, 5))).toBe(false)
  })
})

describe('registerMiss', () => {
  it('미스를 추적하지만 완료로 다가가지 않는다', () => {
    let s = newGame(5)
    s = registerMiss(s)
    s = registerMiss(s)
    expect(s.misses).toBe(2)
    expect(s.hits).toBe(0)
    expect(s.done).toBe(false)
  })
  it('완료 후 미스는 무시된다', () => {
    const done = play(5, 5)
    expect(registerMiss(done)).toBe(done)
  })
})

describe('accuracy', () => {
  it('클릭이 없으면 0', () => {
    expect(accuracy(newGame(5))).toBe(0)
  })
  it('3 히트 + 1 미스 → 75%', () => {
    let s = play(3, 10)
    s = registerMiss(s)
    expect(accuracy(s)).toBe(75)
  })
  it('미스가 없으면 100%', () => {
    expect(accuracy(play(4, 10))).toBe(100)
  })
  it('반올림한다 (2 히트, 1 미스 → 67%)', () => {
    let s = play(2, 10)
    s = registerMiss(s)
    expect(accuracy(s)).toBe(67)
  })
})

describe('nextTarget', () => {
  it('rng=0 이면 좌상단 MARGIN 위치', () => {
    const t = nextTarget(newGame(5), () => 0)
    expect(t.x).toBeCloseTo(MARGIN)
    expect(t.y).toBeCloseTo(MARGIN)
  })
  it('다양한 rng에서 0..1 범위를 벗어나지 않는다', () => {
    const rngs = [0, 0.25, 0.5, 0.75, 0.999999, 1]
    for (const r of rngs) {
      const t = nextTarget(newGame(5), () => r)
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.x).toBeLessThanOrEqual(1)
      expect(t.y).toBeGreaterThanOrEqual(0)
      expect(t.y).toBeLessThanOrEqual(1)
    }
  })
  it('x와 y에 대해 rng을 독립적으로 샘플링한다', () => {
    const seq = [0, 1]
    let i = 0
    const rng = () => seq[i++]
    const t = nextTarget(newGame(5), rng)
    expect(t.x).toBeCloseTo(MARGIN)
    expect(t.y).toBeCloseTo(1 - MARGIN)
  })
})

describe('targetsPerSecond', () => {
  it('경과 시간으로부터 초당 타겟 수를 계산한다', () => {
    const s = play(30, 30)
    expect(targetsPerSecond(s, 10_000)).toBeCloseTo(3)
  })
  it('경과 시간이 0 이하이면 0', () => {
    expect(targetsPerSecond(play(5, 5), 0)).toBe(0)
    expect(targetsPerSecond(play(5, 5), -100)).toBe(0)
  })
  it('부분 진행에서도 계산된다 (5 히트 / 2.5s → 2 t/s)', () => {
    expect(targetsPerSecond(play(5, 30), 2_500)).toBeCloseTo(2)
  })
})
