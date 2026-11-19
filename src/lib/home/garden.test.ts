import { describe, expect, it } from 'vitest'
import { questKey as todayQuestKey } from '@/lib/today'
import { editionFor } from './edition'
import { FIRST_GARDEN, bloomedCount, nextSlot, questKey, readGarden } from './garden'

const today = editionFor(new Date('2026-11-19T12:00:00Z'))

function store(entries: Record<string, string>): Pick<Storage, 'getItem'> {
  return { getItem: (k) => (k in entries ? entries[k] : null) }
}
const slimeAttempt = { outcome: 'nest', stars: 2, score: 120, hint: false }

describe('readGarden (오늘의 정원 3상태)', () => {
  it('빈 저장소 = first, 세 칸 모두 안 핌', () => {
    const g = readGarden(store({}), today)
    expect(g).toEqual(FIRST_GARDEN)
    expect(g.state).toBe('first')
    expect(nextSlot(g)).toBe('slime-slide')
  })

  it('말랑 시도 1개 = in-progress, 다음 권할 게임은 뿅 착지', () => {
    const g = readGarden(store({ 'slime:daily2:2026-11-19': JSON.stringify([[slimeAttempt], [], []]) }), today)
    expect(g.state).toBe('in-progress')
    expect(g.slots.map((s) => s.status)).toEqual(['bloomed', 'unplayed', 'unplayed'])
    expect(bloomedCount(g)).toBe(1)
    expect(nextSlot(g)).toBe('plop-landing')
  })

  it('말랑은 현지 날짜 키를 읽는다(D3) — UTC 날짜와 다르면 현지 키가 기준', () => {
    const s = store({ 'slime:daily2:2026-11-20': JSON.stringify([[slimeAttempt]]) })
    expect(readGarden(s, today).state).toBe('first') // UTC 11-19 키에는 없다
    expect(readGarden(s, today, '2026-11-20').slots[0].status).toBe('bloomed')
  })

  it('말랑 기록이 있어도 시도가 0개면 안 핀 칸', () => {
    expect(readGarden(store({ 'slime:daily2:2026-11-19': JSON.stringify([[], [], []]) }), today).state).toBe('first')
  })

  it('뿅·도토리는 오늘(UTC) 연 기록(quest 키)으로 판정 — 어제 기록은 세지 않는다', () => {
    const g = readGarden(
      store({ 'quest:2026-11-19': JSON.stringify(['plop-landing', '2048']), 'quest:2026-11-18': JSON.stringify(['acorn-hop']) }),
      today,
    )
    expect(g.state).toBe('in-progress')
    expect(g.slots.map((s) => s.status)).toEqual(['unplayed', 'bloomed', 'unplayed'])
    expect(nextSlot(g)).toBe('slime-slide')
  })

  it('세 칸 모두 = complete, 다음 권할 게임 없음', () => {
    const g = readGarden(
      store({
        'slime:daily2:2026-11-19': JSON.stringify([[slimeAttempt]]),
        'quest:2026-11-19': JSON.stringify(['acorn-hop', 'plop-landing', 'slime-slide']),
      }),
      today,
    )
    expect(g.state).toBe('complete')
    expect(bloomedCount(g)).toBe(3)
    expect(nextSlot(g)).toBeNull()
  })

  it('quest 목록에 slime-slide가 있어도(페이지만 열었음) 말랑은 일일 기록으로만 핀다', () => {
    const g = readGarden(store({ 'quest:2026-11-19': JSON.stringify(['slime-slide']) }), today)
    expect(g.state).toBe('first')
  })

  it.each([
    ['JSON 아님', '{not json'],
    ['객체', '{"a":1}'],
    ['숫자', '42'],
    ['null', 'null'],
    ['문자열 배열', '["x","y"]'],
  ])('손상된 말랑 저장값(%s)은 안 핀 칸으로 보고 던지지 않는다', (_name, raw) => {
    expect(readGarden(store({ 'slime:daily2:2026-11-19': raw }), today).slots[0].status).toBe('unplayed')
  })

  it.each([
    ['JSON 아님', '[plop'],
    ['객체', '{"plop-landing":true}'],
    ['숫자 섞임', '[1, null, "plop-landing"]'],
  ])('손상된 quest 저장값(%s)도 던지지 않는다', (_name, raw) => {
    const g = readGarden(store({ 'quest:2026-11-19': raw }), today)
    expect(g.slots[0].status).toBe('unplayed')
    // 섞인 배열에서도 문자열 slug는 살린다
    expect(g.slots[1].status).toBe(raw.includes('"plop-landing"]') ? 'bloomed' : 'unplayed')
  })

  it('getItem이 던지는 저장소(비공개 모드 등)는 first', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(readGarden(throwing, today)).toEqual(FIRST_GARDEN)
  })

  it('quest 키 모양은 today.ts(RecordPlay가 쓰는 쪽)와 같다', () => {
    expect(questKey('2026-11-19')).toBe(todayQuestKey('2026-11-19'))
  })
})
