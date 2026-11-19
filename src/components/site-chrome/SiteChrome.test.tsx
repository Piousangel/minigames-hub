import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { gamePages } from '@/lib/games/registry'
import { COLLECTIONS } from '@/lib/games/collections'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { HeaderSearchLink } from './HeaderSearchLink'

let pathname = '/2048'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

function hrefs(container: HTMLElement) {
  return new Set([...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!))
}

// R2 이전 헤더·푸터에 있던 내부 링크 — 하나라도 빠지면 내부 링크 수가 줄어든 것(AdSense 필수 페이지 포함).
const LEGACY_LINKS = [
  '/',
  '/leaderboards',
  '/guides',
  '/about',
  '/daily',
  '/category/puzzle',
  '/category/arcade',
  '/category/classic',
  '/category/skill',
  '/collections',
  '/privacy',
  '/terms',
  '/contact',
]

// 크롬이 가리켜도 되는 라우트(app 디렉터리에 실제로 있는 것). 앵커는 홈 GameBrowser.
const KNOWN_ROUTES = new Set([
  ...LEGACY_LINKS,
  ...Object.keys(COLLECTIONS).map((s) => `/collection/${s}`),
])

describe('사이트 크롬(헤더·푸터)', () => {
  beforeEach(() => {
    pathname = '/2048'
  })

  it('예전 헤더·푸터의 내부 링크를 하나도 잃지 않는다', () => {
    const { container } = render(
      <>
        <SiteHeader />
        <SiteFooter />
      </>,
    )
    const got = hrefs(container)
    for (const l of LEGACY_LINKS) expect(got, `잃은 링크: ${l}`).toContain(l)
  })

  it('모든 내부 링크는 실제 라우트(또는 홈 앵커)를 가리킨다', () => {
    const { container } = render(
      <>
        <SiteHeader />
        <SiteFooter />
      </>,
    )
    for (const h of hrefs(container)) {
      if (!h.startsWith('/')) continue // Ko-fi 같은 외부 링크
      const path = h.split('#')[0] || '/'
      expect(KNOWN_ROUTES, `없는 라우트: ${h}`).toContain(path)
    }
  })

  it('내비 3개(D12) — All games 숫자는 gamePages에서 계산', () => {
    render(<SiteHeader />)
    // lg용·모바일용 두 벌이 DOM에 있다(한 벌은 CSS로 숨김).
    expect(screen.getAllByRole('link', { name: 'Originals' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: `All games (${gamePages.length})` })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Leaderboards' })).toHaveLength(2)
  })

  it('오늘 pill은 /daily, 접근 이름에 첫 방문 문구 전체가 들어간다', () => {
    render(<SiteHeader />)
    const pill = screen.getByRole('link', { name: /3 free daily puzzles/ })
    expect(pill).toHaveAttribute('href', '/daily')
  })

  it('검색 버튼: 다른 페이지에선 /#search 로 이동(기본 동작 유지)', () => {
    render(<HeaderSearchLink />)
    const link = screen.getByRole('link', { name: 'Search games' })
    expect(link).toHaveAttribute('href', '/#search')
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(ev)
    // Next Link가 클라이언트 이동을 위해 preventDefault 할 수 있으므로 포커스 이동이 없는 것만 확인
    expect(document.activeElement).not.toHaveAttribute('id', 'search')
  })

  it('검색 버튼: 홈에선 검색 입력으로 포커스를 옮긴다', () => {
    pathname = '/'
    render(
      <>
        <HeaderSearchLink />
        <input id="search" aria-label="Search games input" />
      </>,
    )
    const input = screen.getByLabelText('Search games input')
    input.scrollIntoView = vi.fn()
    fireEvent.click(screen.getByRole('link', { name: 'Search games' }))
    expect(document.activeElement).toBe(input)
    expect(window.location.hash).toBe('#search')
  })
})
