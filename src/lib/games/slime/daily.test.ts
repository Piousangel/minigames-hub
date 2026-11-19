import { describe, expect, it } from 'vitest'
import { attemptsLeft, bestOf, dailyDone, dailyNumber, scoreOf, shareText, stageIndexForDay, type Attempt } from './daily'

const a = (outcome: Attempt['outcome'], stars: number, score: number, hint = false): Attempt => ({ outcome, stars, score, hint })

describe('일일 구조', () => {
  it('번호는 출시일 #1부터 하루에 1씩', () => {
    expect(dailyNumber('2026-11-20')).toBe(1)
    expect(dailyNumber('2026-11-21')).toBe(2)
    expect(dailyNumber('2026-11-10')).toBe(1) // 출시 전 날짜는 1로 고정
  })
  it('오늘의 스테이지는 풀 크기 주기로 돈다', () => {
    expect([0, 1, 2, 3, 4, 5].map((d) => stageIndexForDay(`2026-11-${20 + d}`, 4))).toEqual([0, 1, 2, 3, 0, 1])
  })
  it('점수: 별×100 + 남긴 잉크%, 실패는 0', () => {
    expect(scoreOf('nest', 3, 300, 600)).toBe(350)
    expect(scoreOf('nest', 0, 600, 600)).toBe(0)
    expect(scoreOf('spiked', 3, 0, 600)).toBe(0)
  })
  it('최고점·남은 시도·종료', () => {
    const list = [a('spiked', 0, 0), a('nest', 2, 230), a('nest', 3, 310)]
    expect(bestOf(list)?.score).toBe(310)
    expect(bestOf([])).toBeNull()
    expect(attemptsLeft(list)).toBe(0)
    expect(dailyDone(list)).toBe(true)
    expect(dailyDone(list.slice(0, 2))).toBe(false)
  })
  it('공유 문구는 경로를 담지 않고 힌트 사용을 밝힌다', () => {
    const t = shareText('2026-11-22', [a('spiked', 0, 0), a('nest', 3, 310, true)], 'https://quickminigames.site/slime-slide')
    expect(t).toContain('Slime Slide #3')
    expect(t).toContain('310 pts')
    expect(t).toContain('(used a hint)')
    expect(t).toContain('💥🌟 2/3')
  })
})
