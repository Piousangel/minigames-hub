import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { RecordPageView } from './RecordPageView'

const sendHit = vi.fn()
let pathname = '/'

vi.mock('@/lib/hit', () => ({ sendHit: (...a: unknown[]) => sendHit(...a) }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

/**
 * 홈·카테고리 등 비게임 페이지의 계측 사각지대를 메우는 비콘. RecordPlay(게임 전용,
 * event='view')와 이벤트 이름을 분리해('pageview') 기존 "실인간 게임 플레이" 집계가
 * 오염되지 않는 게 핵심 계약이다.
 */
describe('RecordPageView', () => {
  beforeEach(() => {
    sendHit.mockClear()
    pathname = '/'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("루트 경로는 'home' 키로 pageview를 보낸다", () => {
    render(<RecordPageView />)
    expect(sendHit).toHaveBeenCalledWith('home', 'pageview')
  })

  it('중첩 경로는 앞뒤 슬래시를 뗀 키로 보낸다', () => {
    pathname = '/collection/two-player-games/'
    render(<RecordPageView />)
    expect(sendHit).toHaveBeenCalledWith('collection/two-player-games', 'pageview')
  })

  it('worker가 자르는 40자 상한을 클라이언트에서 미리 맞춘다', () => {
    pathname = '/' + 'a'.repeat(60)
    render(<RecordPageView />)
    const key = sendHit.mock.calls[0][0] as string
    expect(key).toHaveLength(40)
  })

  it('페이지를 떠날 때 체류(dwell)를 보낸다', () => {
    render(<RecordPageView />)
    sendHit.mockClear()
    window.dispatchEvent(new Event('pagehide'))
    expect(sendHit).toHaveBeenCalledTimes(1)
    expect(sendHit.mock.calls[0][0]).toBe('home')
    expect(sendHit.mock.calls[0][1]).toBe('dwell')
  })

  it('dwell은 한 번만 보낸다 — pagehide 뒤 언마운트가 이중 계상되지 않는다', () => {
    const { unmount } = render(<RecordPageView />)
    sendHit.mockClear()
    window.dispatchEvent(new Event('pagehide'))
    unmount()
    expect(sendHit).toHaveBeenCalledTimes(1)
  })

  it('렌더 결과가 없다 — 레이아웃에 영향을 주지 않는다', () => {
    const { container } = render(<RecordPageView />)
    expect(container).toBeEmptyDOMElement()
  })
})
