import { describe, expect, it } from 'vitest'
import { VISIT_KEY, dayGap, lastDayFromKeys, parseVisit, returnBucket, trackVisit, visitEvents, type VisitRecord, type VisitStorage } from './visits'

const rec = (lastDay: string | null, day = '', events: string[] = []): VisitRecord => ({ lastDay, firedToday: { day, events } })

class FakeStorage implements VisitStorage {
  m = new Map<string, string>()
  broken = false
  get length() {
    return this.m.size
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  getItem(k: string) {
    if (this.broken) throw new Error('blocked')
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    if (this.broken) throw new Error('blocked')
    this.m.set(k, v)
  }
}

describe('parseVisit', () => {
  it('없음·깨짐·이상한 모양은 빈 기록', () => {
    for (const raw of [null, '', '{', '42', '[]', '{"lastDay":"어제"}']) expect(parseVisit(raw).lastDay).toBeNull()
    expect(parseVisit('{"lastDay":"2026-11-18","firedToday":{"day":"2026-11-18","events":["sl_daily_start",3]}}')).toEqual(
      rec('2026-11-18', '2026-11-18', ['sl_daily_start']),
    )
  })
})

describe('날짜 간격·버킷', () => {
  it('월·연 경계와 DST 무관하게 하루 단위', () => {
    expect(dayGap('2026-11-18', '2026-11-19')).toBe(1)
    expect(dayGap('2026-12-31', '2027-01-01')).toBe(1)
    expect(dayGap('2026-03-07', '2026-03-09')).toBe(2)
  })
  it('1일 / 2~7일 / 8일 이상', () => {
    expect([1, 2, 7, 8, 30].map(returnBucket)).toEqual(['sl_return_d1', 'sl_return_d2_7', 'sl_return_d2_7', 'sl_return_d8p', 'sl_return_d8p'])
  })
})

describe('visitEvents', () => {
  const T = '2026-11-19'
  it('첫 기기: 시작만, 재방문 아님', () => {
    const r = visitEvents(rec(null), T, 'start')
    expect(r.events).toEqual(['sl_daily_start'])
    expect(r.next).toEqual(rec(T, T, ['sl_daily_start']))
  })
  it('어제 하던 기기: 시작 + 재방문 d1', () => {
    expect(visitEvents(rec('2026-11-18'), T, 'start').events).toEqual(['sl_daily_start', 'sl_return', 'sl_return_d1'])
  })
  it('간격 버킷', () => {
    expect(visitEvents(rec('2026-11-14'), T, 'start').events).toContain('sl_return_d2_7')
    expect(visitEvents(rec('2026-11-01'), T, 'start').events).toContain('sl_return_d8p')
  })
  it('같은 날 두 번째 시작은 아무것도 안 쏜다', () => {
    const first = visitEvents(rec('2026-11-18'), T, 'start').next
    expect(visitEvents(first, T, 'start')).toEqual({ events: [], next: first })
  })
  it('오늘 시작했으면 lastDay가 오늘이라 재방문으로 다시 세지 않는다(시작 기록이 지워졌어도)', () => {
    expect(visitEvents(rec(T), T, 'start').events).toEqual(['sl_daily_start'])
  })
  it('완료는 하루 한 번, 시작 기록에 이어 붙는다', () => {
    const started = visitEvents(rec(null), T, 'start').next
    const done = visitEvents(started, T, 'complete')
    expect(done.events).toEqual(['sl_daily_complete'])
    expect(done.next.firedToday.events).toEqual(['sl_daily_start', 'sl_daily_complete'])
    expect(visitEvents(done.next, T, 'complete').events).toEqual([])
  })
  it('완료는 lastDay를 바꾸지 않는다', () => {
    expect(visitEvents(rec('2026-11-10'), T, 'complete').next.lastDay).toBe('2026-11-10')
  })
  it('다음 날에는 어제 쏜 목록을 무시하고 새로 쏜다', () => {
    const yday = visitEvents(visitEvents(rec(null), '2026-11-18', 'start').next, '2026-11-18', 'complete').next
    expect(visitEvents(yday, T, 'start').events).toEqual(['sl_daily_start', 'sl_return', 'sl_return_d1'])
    expect(visitEvents(yday, T, 'complete').events).toEqual(['sl_daily_complete'])
  })
  it('lastDay가 없으면 과거 진행 키 날짜로 재방문을 판정한다', () => {
    expect(visitEvents(rec(null), T, 'start', '2026-11-12').events).toEqual(['sl_daily_start', 'sl_return', 'sl_return_d2_7'])
  })
  it('기기 시계가 거꾸로 가도(lastDay가 미래) 재방문으로 세지 않는다', () => {
    expect(visitEvents(rec('2026-11-20'), T, 'start').events).toEqual(['sl_daily_start'])
  })
})

describe('lastDayFromKeys', () => {
  it('오늘 이전의 가장 최근 일일 키', () => {
    const keys = ['vid', 'slime:muted', 'slime:daily2:2026-11-17', 'slime:daily2:2026-11-19', 'slime:daily2:2026-11-15', 'slime:daily2:junk']
    expect(lastDayFromKeys(keys, '2026-11-19')).toBe('2026-11-17')
    expect(lastDayFromKeys(['vid', 'slime:daily2:2026-11-19'], '2026-11-19')).toBeNull()
  })
})

describe('trackVisit', () => {
  it('저장하고 중복을 막는다 + 기존 진행 키로 첫 측정부터 재방문을 잡는다', () => {
    const s = new FakeStorage()
    s.setItem('slime:daily2:2026-11-18', '[[]]')
    s.setItem('slime:daily2:2026-11-19', '[[]]') // 오늘 진행은 방금 저장된 것 — 과거로 치지 않는다
    expect(trackVisit(s, '2026-11-19', 'start')).toEqual(['sl_daily_start', 'sl_return', 'sl_return_d1'])
    expect(trackVisit(s, '2026-11-19', 'start')).toEqual([])
    expect(trackVisit(s, '2026-11-19', 'complete')).toEqual(['sl_daily_complete'])
    expect(trackVisit(s, '2026-11-19', 'complete')).toEqual([])
    expect(JSON.parse(s.getItem(VISIT_KEY) ?? '')).toEqual(rec('2026-11-19', '2026-11-19', ['sl_daily_start', 'sl_return', 'sl_return_d1', 'sl_daily_complete']))
  })
  it('저장소를 못 쓰면 조용히 []', () => {
    const s = new FakeStorage()
    s.broken = true
    expect(trackVisit(s, '2026-11-19', 'start')).toEqual([])
  })
})
