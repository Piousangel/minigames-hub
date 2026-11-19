import { describe, expect, it } from 'vitest'
import { doneKey } from '@/lib/daily/result'
import { editionFor } from './edition'
import { FIRST_GARDEN, bloomedCount, nextSlot, readGarden } from './garden'

const today = editionFor(new Date('2026-11-19T12:00:00Z'))

function store(entries: Record<string, string>): Pick<Storage, 'getItem'> {
  return { getItem: (k) => (k in entries ? entries[k] : null) }
}
const done = (day: string, slug: string, value = 58) =>
  [doneKey(day, slug), JSON.stringify({ slug, day, primary: { label: 'points', value }, streak: 1, bloomed: true })] as const
const slimeAttempt = { outcome: 'nest', stars: 2, score: 120, hint: false }

describe('readGarden (오늘의 정원 3상태 — R5 완료 기록)', () => {
  it('빈 저장소 = first, 세 칸 모두 안 핌', () => {
    const g = readGarden(store({}), today)
    expect(g).toEqual(FIRST_GARDEN)
    expect(g.state).toBe('first')
    expect(nextSlot(g)).toBe('slime-slide')
  })

  it('말랑 완료 기록 1개 = in-progress, 다음 권할 게임은 뿅 착지, 칸에 결과가 실린다', () => {
    const g = readGarden(store(Object.fromEntries([done('2026-11-19', 'slime-slide', 820)])), today)
    expect(g.state).toBe('in-progress')
    expect(g.slots.map((s) => s.status)).toEqual(['bloomed', 'unplayed', 'unplayed'])
    expect(g.slots[0].result?.primary.value).toBe(820)
    expect(bloomedCount(g)).toBe(1)
    expect(nextSlot(g)).toBe('plop-landing')
  })

  it('말랑은 현지 날짜 키를 읽는다(D3) — UTC 날짜와 다르면 현지 키가 기준', () => {
    const s = store(Object.fromEntries([done('2026-11-20', 'slime-slide')]))
    expect(readGarden(s, today).state).toBe('first') // UTC 11-19 키에는 없다
    expect(readGarden(s, today, '2026-11-20').slots[0].status).toBe('bloomed')
  })

  it('뿅·도토리는 UTC 날짜 키를 읽는다 — 현지 날짜 키나 어제 기록은 세지 않는다', () => {
    const g = readGarden(
      store(Object.fromEntries([done('2026-11-19', 'plop-landing'), done('2026-11-18', 'acorn-hop'), done('2026-11-20', 'acorn-hop')])),
      today,
      '2026-11-20',
    )
    expect(g.slots.map((s) => s.status)).toEqual(['unplayed', 'bloomed', 'unplayed'])
    expect(nextSlot(g)).toBe('slime-slide')
  })

  it('세 칸 모두 = complete, 다음 권할 게임 없음', () => {
    const g = readGarden(store(Object.fromEntries([done('2026-11-19', 'slime-slide'), done('2026-11-19', 'plop-landing'), done('2026-11-19', 'acorn-hop')])), today)
    expect(g.state).toBe('complete')
    expect(bloomedCount(g)).toBe(3)
    expect(nextSlot(g)).toBeNull()
  })

  it('R3의 약한 신호(말랑 시도 기록·페이지를 연 quest 기록)는 더 이상 핀 것으로 보지 않는다', () => {
    const g = readGarden(
      store({
        'slime:daily2:2026-11-19': JSON.stringify([[slimeAttempt], [], []]),
        'quest:2026-11-19': JSON.stringify(['slime-slide', 'plop-landing', 'acorn-hop']),
      }),
      today,
    )
    expect(g).toEqual(FIRST_GARDEN)
  })

  it.each([
    ['JSON 아님', '{not json'],
    ['배열', '[1,2]'],
    ['숫자', '42'],
    ['null', 'null'],
    ['slug 다름', JSON.stringify({ slug: 'acorn-hop', day: '2026-11-19', primary: { label: 'p', value: 1 } })],
    ['날짜 다름', JSON.stringify({ slug: 'plop-landing', day: '2026-11-18', primary: { label: 'p', value: 1 } })],
    ['primary 없음', JSON.stringify({ slug: 'plop-landing', day: '2026-11-19' })],
    ['value 문자열', JSON.stringify({ slug: 'plop-landing', day: '2026-11-19', primary: { label: 'p', value: '9' } })],
  ])('손상된 완료 기록(%s)은 안 핀 칸으로 보고 던지지 않는다', (_name, raw) => {
    expect(readGarden(store({ [doneKey('2026-11-19', 'plop-landing')]: raw }), today).slots[1].status).toBe('unplayed')
  })

  it('getItem이 던지는 저장소(비공개 모드 등)는 first', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(readGarden(throwing, today)).toEqual(FIRST_GARDEN)
  })
})
