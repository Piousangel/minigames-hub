import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadStats, recordResult, winRate, statsKey } from './gameStats'

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
})
