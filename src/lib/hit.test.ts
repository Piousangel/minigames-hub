import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { entryRef, sendHit } from './hit'

/**
 * 회귀 테스트 — sendHit의 sendBeacon 미지원 폴백(fetch)에 .catch()가 없으면
 * async rejection이 try/catch를 우회해 unhandled rejection이 된다(원래 버그).
 * Node의 내장 navigator엔 sendBeacon이 없고, 상대 URL('/api/hit')로 fetch하면
 * undici가 항상 동기적으로 reject하므로(네트워크 I/O 없음) 이 환경에서 버그가
 * 그대로 재현된다 — gameStats.test.ts가 recordResult 경유로 우연히 이 경로를
 * 건드려 버그를 드러냈던 것과 같은 조건.
 */
describe('sendHit', () => {
  let originalSendBeacon: typeof navigator.sendBeacon | undefined

  beforeEach(() => {
    originalSendBeacon = navigator.sendBeacon
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: originalSendBeacon,
      configurable: true,
      writable: true,
    })
    vi.unstubAllGlobals()
  })

  it('회귀: sendBeacon 미지원 + fetch 폴백 실패가 unhandled rejection을 만들지 않는다', async () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)

    try {
      expect(() => sendHit('test-slug', 'view')).not.toThrow()
      // fetch의 reject가 흘러갈 마이크로태스크/타이머 시간을 준다.
      await new Promise((r) => setTimeout(r, 10))
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }

    expect(unhandled).toEqual([])
  })

  it('sendBeacon 지원 시 fetch가 아니라 sendBeacon을 사용한다', () => {
    const beacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beacon,
      configurable: true,
      writable: true,
    })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    sendHit('test-slug', 'win')

    expect(beacon).toHaveBeenCalledTimes(1)
    expect(beacon.mock.calls[0][0]).toBe('/api/hit')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('entryRef', () => {
  it('referrer만 있으면 그대로', () => {
    expect(entryRef('', 'https://www.google.com/')).toBe('https://www.google.com/')
  })

  it('?ref 태그를 앞에 붙인다 — 메신저 링크(referrer 없음)도 잡히게', () => {
    expect(entryRef('?vs=1-2-abc&ref=share', '')).toBe('ref=share')
    expect(entryRef('?ref=share', 'https://cafe.naver.com/')).toBe('ref=share https://cafe.naver.com/')
  })

  it('이상한 태그 값은 버린다', () => {
    expect(entryRef('?ref=<script>', '')).toBe('')
    expect(entryRef('?ref=' + 'x'.repeat(21), '')).toBe('')
    expect(entryRef('', '')).toBe('')
  })
})
