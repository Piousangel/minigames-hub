import { describe, expect, it } from 'vitest'
import { gamePages } from '@/lib/games/registry'
import { gameMeta } from '@/lib/games/gameMeta'
import { entryTag } from '@/lib/hit'
import { NEXT_EVENTS, ORIGINAL_SLUGS, pickNextGames } from './nextGame'

const all = gamePages.map((g) => g.slug)

describe('pickNextGames', () => {
  it('same는 같은 category, diff는 controls[0]이 다르고 서로·현재와 다르다', () => {
    for (const cur of all) {
      for (let run = 1; run <= 4; run++) {
        const { same, diff } = pickNextGames({ current: cur, all, exclude: [], run })
        expect(same?.slug).not.toBe(cur)
        expect(diff?.slug).not.toBe(cur)
        if (same && diff) expect(same.slug).not.toBe(diff.slug)
        if (same) expect(gameMeta[same.slug].category).toBe(gameMeta[cur].category)
        const c = gameMeta[cur].controls?.[0]
        if (diff && c) expect(gameMeta[diff.slug].controls?.[0]).not.toBe(c)
      }
    }
  })

  it('오리지널이 후보에 있으면 featured 클래식보다 먼저 — Lagline 다음이 Snake·Tetris가 아니다(결함 재현)', () => {
    const { same } = pickNextGames({ current: 'lagline', all, exclude: [], run: 1 })
    expect(same).not.toBeNull()
    expect(same!.original).toBe(true)
    expect(ORIGINAL_SLUGS.has(same!.slug)).toBe(true)
  })

  it('결정적: 같은 입력은 같은 결과, run이 바뀌면 회전한다', () => {
    const a = pickNextGames({ current: 'snake', all, exclude: [], run: 2 })
    const b = pickNextGames({ current: 'snake', all, exclude: [], run: 2 })
    expect(a).toEqual(b)
    const seen = new Set<string>()
    for (let r = 0; r < 12; r++) seen.add(pickNextGames({ current: 'snake', all, exclude: [], run: r }).same!.slug)
    expect(seen.size).toBeGreaterThan(1)
  })

  it('제외 목록이 후보를 모두 지우면 현재만 제외하고 폴백한다', () => {
    const exclude = all.filter((s) => s !== 'snake')
    const { same, diff } = pickNextGames({ current: 'snake', all, exclude, run: 1 })
    expect(same).not.toBeNull()
    expect(diff).not.toBeNull()
    expect(same!.slug).not.toBe('snake')
  })

  it('최근·오늘 한 게임은 후보가 있으면 피한다', () => {
    const first = pickNextGames({ current: 'snake', all, exclude: [], run: 1 }).same!.slug
    const again = pickNextGames({ current: 'snake', all, exclude: [first], run: 1 }).same!.slug
    expect(again).not.toBe(first)
  })

  it('빈 풀이면 null, controls 없는 현재 게임도 동작', () => {
    expect(pickNextGames({ current: 'x', all: ['x'], exclude: [], run: 1 })).toEqual({ same: null, diff: null })
    const r = pickNextGames({ current: 'no-meta', all, exclude: [], run: 1 })
    expect(r.diff).not.toBeNull()
  })

  it('이유 문구가 조작 라벨로 자동 생성된다', () => {
    const { diff } = pickNextGames({ current: 'snake', all, exclude: [], run: 1 })
    expect(diff!.reason).toMatch(/instead of arrow keys$/)
  })
})

describe('계측 규약', () => {
  it('이벤트 이름 ≤ 20자, ?ref=next 태그 인식', () => {
    for (const e of NEXT_EVENTS) expect(e.length).toBeLessThanOrEqual(20)
    expect(entryTag('?ref=next')).toBe('next')
  })
})

describe('낯섦 완화(리서치 2 가정2)', () => {
  it('같은 장르 카드가 오리지널이면 다른 입력 카드는 익숙한 featured를 먼저 준다(후보가 있을 때)', () => {
    let checked = 0
    for (const cur of all) {
      const { same, diff } = pickNextGames({ current: cur, all, exclude: [], run: 1 })
      if (same?.original && diff && !diff.original) {
        expect(gameMeta[diff.slug].featured).toBe(true)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})
