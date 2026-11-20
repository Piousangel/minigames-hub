import { describe, expect, it } from 'vitest'
import { DISMISS_VELOCITY, dimOpacity, dragOffset, keyboardInset, releaseVelocity, shouldDismiss } from './sheetGesture'

describe('shouldDismiss', () => {
  it('높이 25%를 넘겨 놓으면 닫힌다, 못 넘기고 천천히 놓으면 복귀', () => {
    expect(shouldDismiss(101, 400, 0)).toBe(true)
    expect(shouldDismiss(100, 400, 0)).toBe(false)
    expect(shouldDismiss(60, 400, 0.1)).toBe(false)
  })
  it('빠르게 튕기면 짧아도 닫힌다(최소 12px)', () => {
    expect(shouldDismiss(30, 600, DISMISS_VELOCITY + 0.1)).toBe(true)
    expect(shouldDismiss(8, 600, 3)).toBe(false) // 떨림
  })
  it('위로 튕기거나 제자리면 닫지 않는다', () => {
    expect(shouldDismiss(0, 400, 2)).toBe(false)
    expect(shouldDismiss(40, 400, -2)).toBe(false)
  })
})

describe('releaseVelocity', () => {
  it('마지막 100ms 안의 표본만 본다', () => {
    const s = [
      { t: 0, y: 0 },
      { t: 500, y: 10 }, // 오래 머문 뒤
      { t: 540, y: 50 },
      { t: 580, y: 90 },
    ]
    expect(releaseVelocity(s)).toBeCloseTo(1, 5) // (90-10)/80
  })
  it('느린 기기(프레임 간격 > 100ms)에도 바로 앞 표본으로 잰다', () => {
    expect(
      releaseVelocity([
        { t: 0, y: 0 },
        { t: 150, y: 120 },
      ]),
    ).toBeCloseTo(0.8)
  })
  it('마지막 움직임 뒤 150ms 넘게 멈췄다 놓으면 0', () => {
    const s = [
      { t: 0, y: 0 },
      { t: 30, y: 60 },
    ]
    expect(releaseVelocity(s, 100)).toBeCloseTo(2)
    expect(releaseVelocity(s, 200)).toBe(0)
  })
  it('표본 1개·시간 0이면 0', () => {
    expect(releaseVelocity([{ t: 1, y: 1 }])).toBe(0)
    expect(
      releaseVelocity([
        { t: 1, y: 1 },
        { t: 1, y: 9 },
      ]),
    ).toBe(0)
  })
})

describe('dragOffset·dimOpacity', () => {
  it('위로는 움직이지 않는다', () => {
    expect(dragOffset(-30)).toBe(0)
    expect(dragOffset(42)).toBe(42)
  })
  it('끝까지 내리면 어둠 0.35, 제자리 1', () => {
    expect(dimOpacity(0, 400)).toBe(1)
    expect(dimOpacity(400, 400)).toBeCloseTo(0.35)
    expect(dimOpacity(800, 400)).toBeCloseTo(0.35)
  })
})

describe('keyboardInset', () => {
  it('visualViewport가 줄어든 만큼(키보드)', () => {
    expect(keyboardInset(844, 508, 0)).toBe(336)
    expect(keyboardInset(844, 508, 100)).toBe(236) // iOS가 화면을 위로 민 만큼 뺀다
  })
  it('주소창 접힘(수십 px)·핀치 확대는 키보드가 아니다', () => {
    expect(keyboardInset(844, 810, 0)).toBe(0)
    expect(keyboardInset(844, 400, 0, 2)).toBe(0)
  })
})
