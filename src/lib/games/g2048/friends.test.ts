import { describe, it, expect } from 'vitest'
import { collectionOf, friendMeet, LADDER } from './friends'

describe('friendMeet', () => {
  it('no banner when the merge does not beat this game\'s best tile', () => {
    expect(friendMeet(128, 128, 64)).toBeNull()
    expect(friendMeet(128, 64, 0)).toBeNull()
    expect(friendMeet(4, 4, 0)).toBeNull()
  })
  it('round-only when the animal was already met in a past game', () => {
    expect(friendMeet(32, 64, 64)).toEqual({ value: 64, kind: 'round' })
    expect(friendMeet(32, 64, 2048)).toEqual({ value: 64, kind: 'round' })
  })
  it('lifetime ("New friend!") when the merge beats the lifetime record', () => {
    expect(friendMeet(64, 128, 64)).toEqual({ value: 128, kind: 'lifetime' })
    expect(friendMeet(2, 4, 0)).toEqual({ value: 4, kind: 'lifetime' })
  })
  it('a stale lifetime value below this game\'s best never re-announces an animal met earlier this game', () => {
    // 평생 기록 미러가 한 박자 늦어도(64) 이번 판에서 이미 256을 만났으면 256은 새 친구가 아니다
    expect(friendMeet(256, 256, 64)).toBeNull()
    expect(friendMeet(256, 512, 64)).toEqual({ value: 512, kind: 'lifetime' })
  })
})

describe('collectionOf', () => {
  it('marks steps up to the lifetime best as met', () => {
    const c = collectionOf(64)
    expect(c).toHaveLength(LADDER.length)
    expect(c.filter((x) => x.met).map((x) => x.value)).toEqual([2, 4, 8, 16, 32, 64])
  })
  it('no record → nothing met; 4096+ → all met', () => {
    expect(collectionOf(0).some((x) => x.met)).toBe(false)
    expect(collectionOf(4096).every((x) => x.met)).toBe(true)
  })
})
