import { describe, expect, it } from 'vitest'
import {
  arm,
  average,
  best,
  MAX_DELAY,
  MIN_DELAY,
  newReactionGame,
  randomDelay,
  react,
  reset,
  start,
  tooSoon,
  type ReactionState,
} from './engine'

const S = (partial: Partial<ReactionState>): ReactionState => ({
  phase: 'idle',
  delayMs: 0,
  lastMs: null,
  attempts: [],
  ...partial,
})

describe('newReactionGame', () => {
  it('빈 idle 상태로 시작한다', () => {
    const s = newReactionGame()
    expect(s.phase).toBe('idle')
    expect(s.lastMs).toBeNull()
    expect(s.attempts).toEqual([])
  })
})

describe('randomDelay', () => {
  it('rng=0 이면 하한(MIN_DELAY)', () => {
    expect(randomDelay(() => 0)).toBe(MIN_DELAY)
  })
  it('rng이 1에 근접해도 상한(MAX_DELAY) 미만이다', () => {
    const d = randomDelay(() => 0.999999)
    expect(d).toBeGreaterThanOrEqual(MIN_DELAY)
    expect(d).toBeLessThan(MAX_DELAY)
  })
  it('rng=0.5 이면 중간값', () => {
    expect(randomDelay(() => 0.5)).toBe(2000)
  })
})

describe('상태 전이', () => {
  it('idle → waiting: start가 지연시간을 정하고 빨간 화면으로 간다', () => {
    const s = start(S({}), () => 0.5)
    expect(s.phase).toBe('waiting')
    expect(s.delayMs).toBe(2000)
  })
  it('waiting → ready: arm이 초록으로 전환한다', () => {
    const s = arm(S({ phase: 'waiting', delayMs: 1500 }))
    expect(s.phase).toBe('ready')
    expect(s.delayMs).toBe(1500)
  })
  it('ready → result: react가 반응시간을 기록한다', () => {
    const s = react(S({ phase: 'ready' }), 234)
    expect(s.phase).toBe('result')
    expect(s.lastMs).toBe(234)
    expect(s.attempts).toEqual([234])
  })
  it('react는 반올림하고 음수를 0으로 막는다', () => {
    expect(react(S({ phase: 'ready' }), 199.6).lastMs).toBe(200)
    expect(react(S({ phase: 'ready' }), -5).lastMs).toBe(0)
  })
  it('idle → waiting → ready → result 전체 흐름', () => {
    let s = newReactionGame()
    s = start(s, () => 0)
    expect(s.phase).toBe('waiting')
    s = arm(s)
    expect(s.phase).toBe('ready')
    s = react(s, 300)
    expect(s.phase).toBe('result')
    expect(s.attempts).toEqual([300])
  })
})

describe('too soon (조기 클릭)', () => {
  it('waiting 중 클릭하면 early 상태가 되고 기록은 남지 않는다', () => {
    const s = tooSoon(S({ phase: 'waiting', attempts: [200] }))
    expect(s.phase).toBe('early')
    expect(s.attempts).toEqual([200])
  })
  it('ready 상태에서는 tooSoon이 무시된다', () => {
    const s = S({ phase: 'ready' })
    expect(tooSoon(s)).toBe(s)
  })
})

describe('잘못된 전이 방어', () => {
  it('waiting이 아닐 때 arm은 무시된다', () => {
    const s = S({ phase: 'idle' })
    expect(arm(s)).toBe(s)
  })
  it('ready가 아닐 때 react는 무시된다', () => {
    const s = S({ phase: 'waiting' })
    expect(react(s, 100)).toBe(s)
  })
})

describe('통계 (average / best)', () => {
  it('빈 기록에서는 null', () => {
    expect(average([])).toBeNull()
    expect(best([])).toBeNull()
  })
  it('best는 가장 빠른(최소) 값', () => {
    expect(best([320, 210, 450, 199])).toBe(199)
  })
  it('average는 최근 N개 평균을 반올림한다', () => {
    // 최근 5개: 200,300,400,500,600 → 평균 400
    expect(average([999, 200, 300, 400, 500, 600], 5)).toBe(400)
  })
  it('기록이 N보다 적으면 있는 만큼 평균낸다', () => {
    expect(average([100, 200], 5)).toBe(150)
  })
  it('여러 시도 후 통계가 누적된다', () => {
    let s = newReactionGame()
    for (const ms of [250, 300, 200]) {
      s = react(arm(start(s, () => 0)), ms)
    }
    expect(s.attempts).toEqual([250, 300, 200])
    expect(best(s.attempts)).toBe(200)
    expect(average(s.attempts)).toBe(250)
  })
})

describe('reset', () => {
  it('기록을 지우고 idle로 되돌린다', () => {
    const played = react(arm(start(newReactionGame(), () => 0)), 222)
    expect(played.attempts).toHaveLength(1)
    const fresh = reset()
    expect(fresh.phase).toBe('idle')
    expect(fresh.attempts).toEqual([])
    expect(fresh.lastMs).toBeNull()
  })
})
