import { gamePages } from '@/lib/games/registry'
import { ALL_GAMES_ANCHOR } from './anchors'

/**
 * 사이트 크롬(헤더·푸터) 링크 표. 컴포넌트와 테스트가 같은 표를 본다 —
 * 링크를 빼면 SiteChrome.test가 "지금 있던 링크를 잃었다"로 실패한다(R2: 내부 링크 감소 0).
 * 목적지는 지금 실제로 있는 라우트만(scripts/check-routes.mjs 대상).
 */
export type HeaderNavIcon = 'isle' | 'packet' | 'well'
export type ChromeLink = { href: string; label: string }

// chromeFocus·TODAY_PILL은 클라이언트 섬(TodayPill)도 쓰므로 registry 없는 chromeBase.ts에 둔다.
export { TODAY_PILL, chromeFocus } from './chromeBase'


// D12: Originals · All games (N) · Leaderboards. N은 항상 계산(D4).
// Originals는 전용 라우트가 없어 기존 컬렉션 /collection/original-games로 보낸다(새 라우트는 만들지 않음).
export const HEADER_NAV: (ChromeLink & { icon: HeaderNavIcon })[] = [
  { href: '/collection/original-games', label: 'Originals', icon: 'isle' },
  { href: `/#${ALL_GAMES_ANCHOR}`, label: `All games (${gamePages.length})`, icon: 'packet' },
  { href: '/leaderboards', label: 'Leaderboards', icon: 'well' },
]


// 푸터 '정원 안내판'. 예전 헤더(Guides·About)·푸터 링크를 모두 포함한다(AdSense 필수 페이지 About·Privacy·Terms·Contact).
export const FOOTER_GROUPS: { id: string; title: string; links: ChromeLink[]; inline?: boolean }[] = [
  {
    id: 'play',
    title: 'Play today',
    links: [
      { href: '/daily', label: 'Daily games' },
      { href: '/collections', label: 'Collections' },
      { href: '/guides', label: 'Guides' },
    ],
  },
  {
    id: 'shelves',
    title: 'Garden shelves',
    links: [
      { href: '/category/puzzle', label: 'Puzzle games' },
      { href: '/category/arcade', label: 'Arcade games' },
      { href: '/category/classic', label: 'Classic games' },
      { href: '/category/skill', label: 'Skill games' },
    ],
  },
  {
    id: 'site',
    title: 'About the site',
    inline: true,
    links: [
      { href: '/about', label: 'About' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/contact', label: 'Contact' },
    ],
  },
]
