import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadStats, recordFinish, recordResult, winRate, statsKey } from './gameStats'
import { sendHit } from './hit'

vi.mock('./hit', () => ({ sendHit: vi.fn() }))

describe('gameStats', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    })
  })

  it('빈 기록은 plays/wins 0', () => {
    expect(loadStats('x')).toEqual({ plays: 0, wins: 0 })
  })

  it('recordResult가 판수·승수·분포를 누적', () => {
    recordResult('x', { won: true, bucket: 0 })
    recordResult('x', { won: false, bucket: 4 })
    recordResult('x', { won: true, bucket: 0 })
    const s = loadStats('x')
    expect(s.plays).toBe(3)
    expect(s.wins).toBe(2)
    expect(s.dist).toEqual({ '0': 2, '4': 1 })
  })

  it('bucket 없이도 판수/승수만 누적', () => {
    recordResult('y', { won: true })
    const s = loadStats('y')
    expect(s).toEqual({ plays: 1, wins: 1 })
    expect(s.dist).toBeUndefined()
  })

  it('winRate: 반올림 퍼센트, 무플레이 0', () => {
    expect(winRate({ plays: 0, wins: 0 })).toBe(0)
    expect(winRate({ plays: 3, wins: 2 })).toBe(67)
    expect(winRate({ plays: 4, wins: 4 })).toBe(100)
  })

  it('statsKey는 slug 네임스페이스', () => {
    expect(statsKey('clusters')).toBe('stats:clusters')
  })

  describe('endless 게임(gameMeta.endless)', () => {
    beforeEach(() => vi.mocked(sendHit).mockClear())

    it('recordFinish는 중립 완주 — plays만 늘고 wins 불변, 이벤트는 finish', () => {
      recordFinish('snake')
      recordFinish('snake')
      // 안전망: endless 게임이 실수로 recordResult를 불러도 won은 무시된다
      recordResult('snake', { won: true })
      expect(loadStats('snake')).toEqual({ plays: 3, wins: 0 })
      expect(vi.mocked(sendHit).mock.calls).toEqual([
        ['snake', 'finish'],
        ['snake', 'finish'],
        ['snake', 'finish'],
      ])
    })

    it('bucket 분포는 그대로 누적(Slotter streak 등)', () => {
      recordFinish('slotter', { bucket: 3 })
      recordFinish('slotter', { bucket: 3 })
      expect(loadStats('slotter')).toEqual({ plays: 2, wins: 0, dist: { '3': 2 } })
    })

    it('레거시 기록(예전 won:true로 쌓인 wins)도 그대로 로드되고 이어서 누적된다', () => {
      localStorage.setItem(statsKey('tetris'), JSON.stringify({ plays: 5, wins: 5 }))
      expect(loadStats('tetris')).toEqual({ plays: 5, wins: 5 })
      expect(recordFinish('tetris')).toEqual({ plays: 6, wins: 5 })
    })

    it('승패 게임은 기존대로 win/lose 이벤트와 승수', () => {
      recordResult('minesweeper', { won: true })
      recordResult('minesweeper', { won: false })
      expect(loadStats('minesweeper')).toEqual({ plays: 2, wins: 1 })
      expect(vi.mocked(sendHit).mock.calls.map((c) => c[1])).toEqual(['win', 'lose'])
    })
  })
})
