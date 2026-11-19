import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

let pathname = '/'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => pathname }))
vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

import { gamePages } from '@/lib/games/registry'
import { GARDEN_DONE_EVENT, doneKey } from '@/lib/daily/result'
import { HomeHero } from './HomeHero'
import { SiteHeader } from '@/components/site-chrome/SiteHeader'

// 시계를 2026-11-19 12:00 UTC로 고정(호수 No.125). toFake는 Date만 — 타이머는 진짜로 둔다.
const NOW = new Date('2026-11-19T12:00:00Z')

/** R5 완료 기록(결과 시트가 남기는 것). 말랑은 현지 날짜, 나머지는 UTC 날짜 키. */
function markDone(slug: string, value = 58) {
  const day = slug === 'slime-slide' ? localDay(NOW) : '2026-11-19'
  localStorage.setItem(doneKey(day, slug), JSON.stringify({ slug, day, primary: { label: 'points', value }, streak: 1, bloomed: true }))
}

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

/**
 * 노란색(sun) 면을 쓰는 요소 = bg-garden-sun 클래스 또는 인라인 #ffc933 배경.
 * 기준: '행동 색 sun(#ffc933)은 Play 하나'. 꽃 아이콘의 해바라기색(#ffd966, --garden-sunflower)은 장식 아이콘이라 세지 않는다.
 */
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
    expect(html).toContain('href="/slime-slide?ref=hero-today"')
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
    expect(screen.getByTestId('today-play')).toHaveAttribute('href', '/slime-slide?ref=hero-today')
    expect(screen.getByTestId('today-play')).toHaveTextContent('Play today’s Slime Slide')
    expect(sunSurfaces(container)).toHaveLength(1)
  })

  it('in-progress: 말랑을 끝냈으면 다음 권할 게임은 Plop Landing, 같은 칸 구조', () => {
    markDone('slime-slide')
    const { container } = render(<HomeHero />)
    const card = screen.getByTestId('today-card')
    expect(card).toHaveAttribute('data-state', 'in-progress')
    expect(within(card).getByLabelText("Today's garden: 1 of 3 bloomed")).toBeInTheDocument()
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('Plop Landing')
    expect(screen.getByTestId('today-play')).toHaveAttribute('href', '/plop-landing?ref=hero-today')
    expect(screen.getByTestId('today-play')).toHaveTextContent('Play today’s Plop Landing')
    expect(sunSurfaces(container)).toHaveLength(1)
  })

  it('complete: 세 송이 → "All three bloomed", Play는 /daily로', () => {
    markDone('slime-slide')
    markDone('plop-landing'); markDone('acorn-hop')
    const { container } = render(<HomeHero />)
    const card = screen.getByTestId('today-card')
    expect(card).toHaveAttribute('data-state', 'complete')
    expect(within(card).getByLabelText("Today's garden: 3 of 3 bloomed")).toBeInTheDocument()
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('All three bloomed')
    expect(screen.getByTestId('today-play')).toHaveAttribute('href', '/daily?ref=hero-today')
    expect(sunSurfaces(container)).toHaveLength(1)
  })

  it('손상된 저장값이어도 카드는 first로 그려진다', () => {
    localStorage.setItem(doneKey(localDay(NOW), 'slime-slide'), '{broken')
    localStorage.setItem(doneKey('2026-11-19', 'plop-landing'), 'nope')
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
    markDone('plop-landing')
    const mid = render(<HomeHero />)
    const b = shape()
    mid.unmount()
    markDone('slime-slide')
    markDone('plop-landing'); markDone('acorn-hop')
    render(<HomeHero />)
    const c = shape()
    expect(b).toBe(a)
    // complete는 썸네일 대신 꽃 아이콘(같은 72px 칸 안) — 칸 바깥 구조는 같다
    expect(c.replace('|h-10', '')).toBe(a)
  })
})

describe('데스크톱 히어로 티켓 줄(R5, R4 이월)', () => {
  const ticketSlugs = () => [0, 1, 2].map((i) => screen.getByTestId(`hero-ticket-${i}`).getAttribute('data-slug'))

  it('정적 HTML = first: Plop · Acorn · Daily, 노란 Play(Slime)와 겹치지 않는다', () => {
    const html = renderToStaticMarkup(<HomeHero />)
    expect(html).toContain('href="/plop-landing?ref=hero-ticket"')
    expect(html).toContain('href="/acorn-hop?ref=hero-ticket"')
    expect(html).toContain('href="/daily?ref=hero-ticket"')
    expect(html).not.toContain('href="/slime-slide?ref=hero-ticket"')
  })

  it('first + 최근 플레이가 있으면 세 번째 = Continue(정원 밖 최근 게임)', () => {
    localStorage.setItem('recent:games', JSON.stringify(['plop-landing', '2048']))
    render(<HomeHero />)
    expect(ticketSlugs()).toEqual(['plop-landing', 'acorn-hop', '2048'])
  })

  it('in-progress(카드 = Plop): 첫 티켓이 Play CTA와 같지 않다 — Slime(Bloomed · best N) · Acorn · Daily', () => {
    markDone('slime-slide', 820)
    render(<HomeHero />)
    expect(screen.getByTestId('today-play')).toHaveAttribute('href', '/plop-landing?ref=hero-today')
    expect(ticketSlugs()).toEqual(['slime-slide', 'acorn-hop', 'daily'])
    expect(screen.getByTestId('hero-ticket-status-0')).toHaveTextContent('Bloomed · best 820')
    expect(screen.getByTestId('hero-ticket-status-1')).toHaveTextContent('Unplayed')
  })

  it('complete: 세 정원 게임 모두 Bloomed, 노란 면은 여전히 하나', () => {
    markDone('slime-slide'); markDone('plop-landing', 58); markDone('acorn-hop', 31)
    const { container } = render(<HomeHero />)
    expect(ticketSlugs()).toEqual(['slime-slide', 'plop-landing', 'acorn-hop'])
    expect(screen.getByTestId('hero-ticket-status-1')).toHaveTextContent('Bloomed · best 58')
    expect(sunSurfaces(container)).toHaveLength(1)
  })
})

describe('헤더 오늘 pill(R3 진행 상태)', () => {
  it('first: "3 free daily puzzles"(R2 문구 유지)', () => {
    render(<SiteHeader />)
    expect(screen.getByTestId('today-pill')).toHaveAccessibleName('3 free daily puzzles')
  })

  it('in-progress: "Today 2/3"', () => {
    markDone('slime-slide')
    markDone('acorn-hop')
    render(<SiteHeader />)
    const pill = screen.getByTestId('today-pill')
    expect(pill).toHaveTextContent('Today 2/3')
    expect(pill.getAttribute('aria-label')).toMatch(/^Today 2\/3/)
    expect(pill).toHaveAttribute('href', '/daily')
  })

  it('complete: "Garden full"', () => {
    markDone('slime-slide')
    markDone('acorn-hop'); markDone('plop-landing')
    render(<SiteHeader />)
    expect(screen.getByTestId('today-pill')).toHaveTextContent('Garden full')
  })

  it('다른 탭에서 기록이 생기면(storage 이벤트) pill이 따라 바뀐다', () => {
    render(<SiteHeader />)
    expect(screen.getByTestId('today-pill')).toHaveAttribute('data-state', 'first')
    act(() => {
      markDone('acorn-hop')
      window.dispatchEvent(new StorageEvent('storage'))
    })
    expect(screen.getByTestId('today-pill')).toHaveTextContent('Today 1/3')
  })

  it('같은 탭 클라이언트 이동(경로 변경) 뒤에도 pill이 다시 읽는다 — storage 이벤트 없이', async () => {
    pathname = '/'
    const { rerender } = render(<SiteHeader />)
    expect(screen.getByTestId('today-pill')).toHaveAttribute('data-state', 'first')
    markDone('plop-landing') // 게임 페이지 결과 시트가 쓴 것
    pathname = '/plop-landing'
    rerender(<SiteHeader />)
    expect(await screen.findByText('Today 1/3')).toBeInTheDocument()
  })

  it('같은 탭에서 결과 시트가 완료를 남기면(garden:done 이벤트) pill이 바로 바뀐다(R5)', () => {
    render(<SiteHeader />)
    act(() => {
      markDone('acorn-hop')
      window.dispatchEvent(new CustomEvent(GARDEN_DONE_EVENT))
    })
    expect(screen.getByTestId('today-pill')).toHaveTextContent('Today 1/3')
  })

  it('페이지를 열기만 한 기록(quest)이나 말랑 시도 기록으로는 피지 않는다(R3 약한 신호 폐기, R5)', () => {
    localStorage.setItem('quest:2026-11-19', JSON.stringify(['plop-landing', 'acorn-hop', 'slime-slide']))
    localStorage.setItem(`slime:daily2:${localDay(NOW)}`, JSON.stringify([[{ outcome: 'nest', stars: 2, score: 120, hint: false }]]))
    render(<SiteHeader />)
    expect(screen.getByTestId('today-pill')).toHaveAttribute('data-state', 'first')
  })

  it('2행 내비에 게임 페이지 숨김 표식(data-site-nav-row)이 있다', () => {
    const { container } = render(<SiteHeader />)
    expect(container.querySelector('nav[data-site-nav-row]')).not.toBeNull()
  })
})
