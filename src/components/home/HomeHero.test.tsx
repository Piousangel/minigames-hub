import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }))
vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

import { gamePages } from '@/lib/games/registry'
import { HomeHero } from './HomeHero'
import { SiteHeader } from '@/components/site-chrome/SiteHeader'

// 시계를 2026-11-19 12:00 UTC로 고정(호수 No.125). toFake는 Date만 — 타이머는 진짜로 둔다.
const NOW = new Date('2026-11-19T12:00:00Z')
const attempt = { outcome: 'nest', stars: 2, score: 120, hint: false }

/** 테스트 환경의 현지 날짜(말랑 키는 현지 자정 기준) */
function localDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

/** 노란색(sun) 면을 쓰는 요소 = bg-garden-sun 클래스 또는 인라인 #ffc933 배경 */
function sunSurfaces(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('*')].filter(
    (el) => /(^|\s)bg-garden-sun(\s|$)/.test(el.getAttribute('class') ?? '') || /#ffc933|var\(--garden-sun\)/i.test(el.getAttribute('style') ?? ''),
  )
}

describe('홈 히어로(R3)', () => {
  it('H1 2단: 키워드 "Free online mini games" + 세계관 문장(둘째 구절 italic)', () => {
    render(<HomeHero />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Free online mini games A small garden that blooms daily.')
    expect(within(h1).getByText('that blooms daily.').tagName).toBe('EM')
  })

  it('부제의 게임 수는 gamePages에서 계산한다(D4)', () => {
    render(<HomeHero />)
    expect(screen.getByText(`${gamePages.length} and growing. No sign-up.`)).toBeInTheDocument()
  })

  it('정적 HTML(SSR) = first: 날짜 없는 마스트헤드, Slime Slide, 꽃 0/3, Play → /slime-slide', () => {
    const html = renderToStaticMarkup(<HomeHero />)
    expect(html).toContain('Today’s edition')
    expect(html).not.toContain('rel="preload"') // 썸네일이 LCP 키아트와 preload로 다투지 않는다
    expect(html).not.toMatch(/No\. \d+/)
    expect(html).toContain('data-state="first"')
    expect(html).toContain('Today’s puzzle · 2 min')
    expect(html).toContain('Play today’s Slime Slide')
    expect(html).toContain('href="/slime-slide"')
    expect(html).toContain('Today&#x27;s garden: 0 of 3 bloomed')
  })

  it('키아트: <picture> + <img fetchpriority="high"> + 크기 속성(CSS 배경 아님)', () => {
    const html = renderToStaticMarkup(<HomeHero />)
    expect(html).toMatch(/<picture><source media="\(min-width: 768px\)" srcSet="\/art\/hub-hero-desktop\.webp" width="1376" height="768"\/>/i)
    expect(html).toMatch(/<img[^>]*src="\/art\/hub-hero-mobile\.webp"[^>]*srcSet="[^"]*hub-hero-mobile-720\.webp 720w[^"]*"[^>]*width="896"[^>]*height="1200"[^>]*fetchPriority="high"[^>]*decoding="async"/i)
    expect(html).not.toMatch(/background(-image)?:\s*url/i)
  })

  it('마운트 뒤 마스트헤드 "No. 125 · Thu, Nov 19"', () => {
    render(<HomeHero />)
    expect(screen.getByTestId('hero-masthead')).toHaveTextContent('No. 125 · Thu, Nov 19')
  })

  it('first: 꽃 3칸 빈칸, 노란 버튼 하나', () => {
    const { container } = render(<HomeHero />)
    const card = screen.getByTestId('today-card')
    expect(card).toHaveAttribute('data-state', 'first')
    expect(within(card).getByLabelText("Today's garden: 0 of 3 bloomed")).toBeInTheDocument()
    expect(screen.getByTestId('today-play')).toHaveAttribute('href', '/slime-slide')
    expect(screen.getByTestId('today-play')).toHaveTextContent('Play today’s Slime Slide')
    expect(sunSurfaces(container)).toHaveLength(1)
  })

  it('in-progress: 말랑을 했으면 다음 권할 게임은 Plop Landing, 같은 칸 구조', () => {
    localStorage.setItem(`slime:daily2:${localDay(NOW)}`, JSON.stringify([[attempt], [], []]))
    const { container } = render(<HomeHero />)
    const card = screen.getByTestId('today-card')
    expect(card).toHaveAttribute('data-state', 'in-progress')
    expect(within(card).getByLabelText("Today's garden: 1 of 3 bloomed")).toBeInTheDocument()
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('Plop Landing')
    expect(screen.getByTestId('today-play')).toHaveAttribute('href', '/plop-landing')
    expect(screen.getByTestId('today-play')).toHaveTextContent('Play today’s Plop Landing')
    expect(sunSurfaces(container)).toHaveLength(1)
  })

  it('complete: 세 송이 → "All three bloomed", Play는 /daily로', () => {
    localStorage.setItem(`slime:daily2:${localDay(NOW)}`, JSON.stringify([[attempt]]))
    localStorage.setItem('quest:2026-11-19', JSON.stringify(['plop-landing', 'acorn-hop']))
    const { container } = render(<HomeHero />)
    const card = screen.getByTestId('today-card')
    expect(card).toHaveAttribute('data-state', 'complete')
    expect(within(card).getByLabelText("Today's garden: 3 of 3 bloomed")).toBeInTheDocument()
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('All three bloomed')
    expect(screen.getByTestId('today-play')).toHaveAttribute('href', '/daily')
    expect(sunSurfaces(container)).toHaveLength(1)
  })

  it('손상된 저장값이어도 카드는 first로 그려진다', () => {
    localStorage.setItem(`slime:daily2:${localDay(NOW)}`, '{broken')
    localStorage.setItem('quest:2026-11-19', 'nope')
    render(<HomeHero />)
    expect(screen.getByTestId('today-card')).toHaveAttribute('data-state', 'first')
  })

  it('세 상태의 카드 칸 구조(고정 높이 클래스)는 같다 — 높이 예약', () => {
    const shape = () =>
      [...screen.getByTestId('today-card').querySelectorAll('*')]
        .map((el) => (el.getAttribute('class') ?? '').match(/\b(h-\[?[\w.]+\]?|mt-\d)\b/g)?.join(' ') ?? '')
        .filter(Boolean)
        .join('|')
    const first = render(<HomeHero />)
    const a = shape()
    first.unmount()
    localStorage.setItem('quest:2026-11-19', JSON.stringify(['plop-landing']))
    const mid = render(<HomeHero />)
    const b = shape()
    mid.unmount()
    localStorage.setItem(`slime:daily2:${localDay(NOW)}`, JSON.stringify([[attempt]]))
    localStorage.setItem('quest:2026-11-19', JSON.stringify(['plop-landing', 'acorn-hop']))
    render(<HomeHero />)
    const c = shape()
    expect(b).toBe(a)
    // complete는 썸네일 대신 꽃 아이콘(같은 72px 칸 안) — 칸 바깥 구조는 같다
    expect(c.replace('|h-10', '')).toBe(a)
  })
})

describe('헤더 오늘 pill(R3 진행 상태)', () => {
  it('first: "3 free daily puzzles"(R2 문구 유지)', () => {
    render(<SiteHeader />)
    expect(screen.getByTestId('today-pill')).toHaveAccessibleName('3 free daily puzzles')
  })

  it('in-progress: "Today 2/3"', () => {
    localStorage.setItem(`slime:daily2:${localDay(NOW)}`, JSON.stringify([[attempt]]))
    localStorage.setItem('quest:2026-11-19', JSON.stringify(['acorn-hop']))
    render(<SiteHeader />)
    const pill = screen.getByTestId('today-pill')
    expect(pill).toHaveTextContent('Today 2/3')
    expect(pill.getAttribute('aria-label')).toMatch(/^Today 2\/3/)
    expect(pill).toHaveAttribute('href', '/daily')
  })

  it('complete: "Garden full"', () => {
    localStorage.setItem(`slime:daily2:${localDay(NOW)}`, JSON.stringify([[attempt]]))
    localStorage.setItem('quest:2026-11-19', JSON.stringify(['acorn-hop', 'plop-landing']))
    render(<SiteHeader />)
    expect(screen.getByTestId('today-pill')).toHaveTextContent('Garden full')
  })

  it('다른 탭에서 기록이 생기면(storage 이벤트) pill이 따라 바뀐다', () => {
    render(<SiteHeader />)
    expect(screen.getByTestId('today-pill')).toHaveAttribute('data-state', 'first')
    act(() => {
      localStorage.setItem('quest:2026-11-19', JSON.stringify(['acorn-hop']))
      window.dispatchEvent(new StorageEvent('storage'))
    })
    expect(screen.getByTestId('today-pill')).toHaveTextContent('Today 1/3')
  })

  it('2행 내비에 게임 페이지 숨김 표식(data-site-nav-row)이 있다', () => {
    const { container } = render(<SiteHeader />)
    expect(container.querySelector('nav[data-site-nav-row]')).not.toBeNull()
  })
})
