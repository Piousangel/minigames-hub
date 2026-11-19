import { describe, expect, it } from 'vitest'
import { DONE_KEEP_DAYS, asDoneRecord, doneKey, nextStreak, pruneDone, readDone, readStreak, recordDone, shiftDay, streakKey } from './result'

/** Map 기반 Storage(key·length·removeItem까지). */
function mem(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return {
    m,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
  }
}
const plop = (day: string, value: number) => ({ slug: 'plop-landing', day, primary: { label: 'points', value }, secondary: { label: 'islands', value: '7' } })

describe('완료 키 규칙', () => {
  it('garden:done:<날짜>:<slug> 하나의 모양', () => {
    expect(doneKey('2026-11-20', 'slime-slide')).toBe('garden:done:2026-11-20:slime-slide')
    expect(streakKey('acorn-hop')).toBe('garden:streak:acorn-hop')
  })
  it('shiftDay는 달·해 경계를 넘는다', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('recordDone (DailyResult)', () => {
  it('첫 완료 = 기록 + streak 1 + bloomed', () => {
    const s = mem()
    const r = recordDone(s, plop('2026-11-20', 58))
    expect(r).toEqual({ slug: 'plop-landing', primary: { label: 'points', value: 58 }, secondary: { label: 'islands', value: '7' }, streak: 1, bloomed: true })
    expect(readDone(s, '2026-11-20', 'plop-landing')?.primary.value).toBe(58)
  })

  it('같은 날 다시 끝내면 streak은 그대로, 기록은 더 높을 때만 바뀐다', () => {
    const s = mem()
    recordDone(s, plop('2026-11-20', 58))
    expect(recordDone(s, plop('2026-11-20', 30)).streak).toBe(1)
    expect(readDone(s, '2026-11-20', 'plop-landing')?.primary.value).toBe(58) // 낮은 판은 덮지 않는다
    recordDone(s, plop('2026-11-20', 90))
    expect(readDone(s, '2026-11-20', 'plop-landing')?.primary.value).toBe(90)
  })

  it('어제 끝냈으면 +1, 하루 건너뛰면 1로 다시', () => {
    const s = mem()
    recordDone(s, plop('2026-11-18', 10))
    expect(recordDone(s, plop('2026-11-19', 10)).streak).toBe(2)
    expect(recordDone(s, plop('2026-11-20', 10)).streak).toBe(3)
    expect(readStreak(s, 'plop-landing', '2026-11-21')).toBe(3) // 오늘 아직 안 했어도 어제까지 이어짐
    expect(readStreak(s, 'plop-landing', '2026-11-22')).toBe(0)
    expect(recordDone(s, plop('2026-11-22', 10)).streak).toBe(1)
  })

  it('게임마다 streak이 따로다', () => {
    const s = mem()
    recordDone(s, plop('2026-11-19', 1))
    recordDone(s, plop('2026-11-20', 1))
    expect(recordDone(s, { slug: 'acorn-hop', day: '2026-11-20', primary: { label: 'points', value: 3 } }).streak).toBe(1)
  })

  it('nextStreak 경계', () => {
    expect(nextStreak(null, '2026-11-20')).toBe(1)
    expect(nextStreak({ last: '2026-11-20', n: 4 }, '2026-11-20')).toBe(4)
    expect(nextStreak({ last: '2026-11-19', n: 4 }, '2026-11-20')).toBe(5)
    expect(nextStreak({ last: '2026-11-17', n: 4 }, '2026-11-20')).toBe(1)
  })

  it('깨진 streak 값은 1부터, 시계를 거꾸로 돌린 기기는 streak 키를 덮지 않는다', () => {
    const s = mem({ [streakKey('plop-landing')]: '{bad' })
    expect(recordDone(s, plop('2026-11-20', 1)).streak).toBe(1)
    const t = mem({ [streakKey('plop-landing')]: JSON.stringify({ last: '2026-12-01', n: 9 }) })
    recordDone(t, plop('2026-11-20', 1))
    expect(JSON.parse(t.getItem(streakKey('plop-landing'))!)).toEqual({ last: '2026-12-01', n: 9 })
  })

  it('저장소가 던져도 결과는 돌려준다', () => {
    const bad = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(recordDone(bad, plop('2026-11-20', 5))).toMatchObject({ streak: 1, bloomed: true, primary: { value: 5 } })
  })

  it(`${DONE_KEEP_DAYS}일보다 오래된 완료 기록은 지운다(다른 키는 그대로)`, () => {
    const s = mem({ [doneKey('2026-11-01', 'acorn-hop')]: '{}', [doneKey('2026-11-10', 'acorn-hop')]: '{}', 'best:acorn-hop': '9' })
    pruneDone(s, '2026-11-20')
    expect([...s.m.keys()].sort()).toEqual(['best:acorn-hop', doneKey('2026-11-10', 'acorn-hop')].sort())
  })
})

describe('asDoneRecord (손상된 값)', () => {
  it.each([null, 1, 'x', [], { slug: 'plop-landing' }, { slug: 'plop-landing', day: '2026-11-20', primary: { label: 1, value: 1 } }])('%j → null', (v) => {
    expect(asDoneRecord(v, '2026-11-20', 'plop-landing')).toBeNull()
  })
  it('streak이 이상하면 1로 본다', () => {
    expect(asDoneRecord({ slug: 'a', day: '2026-11-20', primary: { label: 'p', value: 2 }, streak: -3 }, '2026-11-20', 'a')?.streak).toBe(1)
  })
})
