import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  REACTIONS,
  emptyReactionCounts,
  hasReacted,
  isValidReaction,
  isValidReactionSlug,
  markReacted,
} from './reactions'

describe('reactions', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    })
  })

  describe('emptyReactionCounts', () => {
    it('모든 REACTIONS를 0으로 초기화한다', () => {
      const counts = emptyReactionCounts()
      for (const r of REACTIONS) {
        expect(counts[r]).toBe(0)
      }
      expect(Object.keys(counts).length).toBe(REACTIONS.length)
    })
  })

  describe('isValidReaction', () => {
    it('허용된 이모지만 true', () => {
      expect(isValidReaction('🔥')).toBe(true)
      expect(isValidReaction('😂')).toBe(true)
    })

    it('허용 목록 밖 이모지·임의 문자열은 false', () => {
      expect(isValidReaction('👍')).toBe(false)
      expect(isValidReaction('')).toBe(false)
      expect(isValidReaction('script')).toBe(false)
    })
  })

  describe('isValidReactionSlug', () => {
    it('소문자·숫자·하이픈 40자 이하만 허용', () => {
      expect(isValidReactionSlug('snake')).toBe(true)
      expect(isValidReactionSlug('bubble-shooter')).toBe(true)
      expect(isValidReactionSlug('2048')).toBe(true)
    })

    it('빈 문자열·대문자·특수문자·과도한 길이는 거부', () => {
      expect(isValidReactionSlug('')).toBe(false)
      expect(isValidReactionSlug('Snake')).toBe(false)
      expect(isValidReactionSlug('snake!')).toBe(false)
      expect(isValidReactionSlug('a'.repeat(41))).toBe(false)
    })
  })

  describe('hasReacted / markReacted', () => {
    it('마킹 전엔 false, 마킹 후엔 true', () => {
      expect(hasReacted('snake', '🔥')).toBe(false)
      markReacted('snake', '🔥')
      expect(hasReacted('snake', '🔥')).toBe(true)
    })

    it('게임·이모지 조합별로 독립적으로 추적된다', () => {
      markReacted('snake', '🔥')
      expect(hasReacted('snake', '😂')).toBe(false)
      expect(hasReacted('tetris', '🔥')).toBe(false)
    })

    it('localStorage가 없어도(예외) 안전하게 false를 반환한다', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {
          throw new Error('blocked')
        },
      })
      expect(hasReacted('snake', '🔥')).toBe(false)
      expect(() => markReacted('snake', '🔥')).not.toThrow()
    })
  })
})
