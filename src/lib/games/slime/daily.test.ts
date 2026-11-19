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

import { clearedCount, currentStage, dailyOver, dailyTotal, emptyProgress, progressShareText, recordAttempt, stageState } from './daily'

describe('순차 해금 일일', () => {
  const win = (stars = 3, score = 300): Attempt => ({ outcome: 'nest', stars, score, hint: false })
  const lose = (): Attempt => ({ outcome: 'spiked', stars: 0, score: 0, hint: false })

  it('처음에는 1스테이지만 열려 있다', () => {
    const p = emptyProgress(4)
    expect([0, 1, 2, 3].map((i) => stageState(p, i))).toEqual(['open', 'locked', 'locked', 'locked'])
    expect(currentStage(p)).toBe(0)
  })
  it('1스테이지를 깨면 2스테이지가 열린다', () => {
    const p = recordAttempt(emptyProgress(4), 0, win())
    expect([0, 1, 2].map((i) => stageState(p, i))).toEqual(['cleared', 'open', 'locked'])
    expect(currentStage(p)).toBe(1)
  })
  it('잠긴 스테이지·이미 깬 스테이지의 기록은 무시한다', () => {
    const p0 = emptyProgress(3)
    expect(recordAttempt(p0, 1, win())).toBe(p0)
    const p1 = recordAttempt(p0, 0, win())
    expect(recordAttempt(p1, 0, win(3, 999))).toBe(p1)
  })
  it('같은 스테이지에서 3번 다 실패하면 그날은 거기서 끝, 점수는 그때까지 합', () => {
    let p = recordAttempt(emptyProgress(4), 0, win(2, 210))
    for (let k = 0; k < 3; k++) p = recordAttempt(p, 1, lose())
    expect(stageState(p, 1)).toBe('failed')
    expect(stageState(p, 2)).toBe('locked')
    expect(currentStage(p)).toBeNull()
    expect(dailyOver(p)).toBe(true)
    expect(dailyTotal(p)).toBe(210)
  })
  it('실패 후 성공하면 그 스테이지는 깬 것이고 점수는 스테이지별 최고점', () => {
    let p = recordAttempt(emptyProgress(2), 0, lose())
    p = recordAttempt(p, 0, win(1, 120))
    expect(stageState(p, 0)).toBe('cleared')
    p = recordAttempt(p, 1, win(3, 330))
    expect(clearedCount(p)).toBe(2)
    expect(dailyTotal(p)).toBe(450)
    expect(dailyOver(p)).toBe(true) // 전부 깼다
  })
  it('공유 문구: 스테이지별 한 칸, 경로 없음', () => {
    let p = recordAttempt(emptyProgress(4), 0, win(3, 330))
    p = recordAttempt(p, 1, win(1, 130))
    expect(progressShareText('2026-11-21', p)).toBe('Slime Slide #2 · 2/4 stages · 460 pts\n🌟⭐⬜⬜')
  })
})
