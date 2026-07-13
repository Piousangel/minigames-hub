import { describe, expect, it } from 'vitest'
import { clearMismatch, flip, MEMORY_EMOJI, newMemoryGame, type MemoryState } from './engine'

// 4장짜리 미니 상태로 flip 로직을 검증 (엔진은 카드 수에 무관)
const mini = (): MemoryState => ({
  cards: [
    { id: 0, emoji: 'A', matched: false },
    { id: 1, emoji: 'A', matched: false },
    { id: 2, emoji: 'B', matched: false },
    { id: 3, emoji: 'B', matched: false },
  ],
  faceUp: [],
  moves: 0,
  won: false,
})

describe('newMemoryGame', () => {
  it('8쌍 16장, 이모지당 정확히 2장이다', () => {
    const s = newMemoryGame(() => 0)
    expect(s.cards).toHaveLength(16)
    for (const e of MEMORY_EMOJI) {
      expect(s.cards.filter((c) => c.emoji === e)).toHaveLength(2)
    }
    expect(s.moves).toBe(0)
  })
  it('같은 rng 시퀀스면 같은 배치가 나온다 (rng 주입 셔플)', () => {
    expect(newMemoryGame(() => 0)).toEqual(newMemoryGame(() => 0))
  })
})

describe('flip', () => {
  it('첫 장은 faceUp에 쌓이고 moves는 그대로', () => {
    const s = flip(mini(), 0)
    expect(s.faceUp).toEqual([0])
    expect(s.moves).toBe(0)
  })
  it('매치되면 matched 처리되고 faceUp이 비고 moves+1', () => {
    const s = flip(flip(mini(), 0), 1)
    expect(s.cards[0].matched).toBe(true)
    expect(s.cards[1].matched).toBe(true)
    expect(s.faceUp).toEqual([])
    expect(s.moves).toBe(1)
    expect(s.won).toBe(false)
  })
  it('미스매치면 두 장이 faceUp에 남고 moves+1', () => {
    const s = flip(flip(mini(), 0), 2)
    expect(s.faceUp).toEqual([0, 2])
    expect(s.moves).toBe(1)
    expect(s.cards[0].matched).toBe(false)
  })
  it('2장 올라간 상태·같은 카드·matched 카드 flip은 no-op', () => {
    const two = flip(flip(mini(), 0), 2)
    expect(flip(two, 3)).toBe(two)
    const one = flip(mini(), 0)
    expect(flip(one, 0)).toBe(one)
    const matched = flip(flip(mini(), 0), 1)
    expect(flip(matched, 0)).toBe(matched)
  })
  it('마지막 쌍이 맞으면 won', () => {
    const half = flip(flip(mini(), 0), 1)
    const done = flip(flip(half, 2), 3)
    expect(done.won).toBe(true)
    expect(done.moves).toBe(2)
    expect(flip(done, 0)).toBe(done) // 승리 후 no-op
  })
})

describe('clearMismatch', () => {
  it('faceUp 2장을 내리고, 2장 미만이면 no-op', () => {
    const two = flip(flip(mini(), 0), 2)
    expect(clearMismatch(two).faceUp).toEqual([])
    const one = flip(mini(), 0)
    expect(clearMismatch(one)).toBe(one)
  })
})
