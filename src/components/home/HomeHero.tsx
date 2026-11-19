import { gamePages } from '@/lib/games/registry'
import { gameMeta } from '@/lib/games/gameMeta'
import { GARDEN_SLUGS } from '@/lib/home/garden'
import { HeroMasthead } from './HeroMasthead'
import { TodayCard, type TodayCardGame } from './TodayCard'
import { HeroTickets, type TicketGame } from './HeroTickets'

/** 키아트 크기(파일 실제 픽셀). width·height 속성으로 자리를 먼저 잡아 CLS 0. */
export const HERO_ART = {
  // 모바일은 폭별 3단(600·720·896w). 원본 896w(57KB) 하나면 1.75x 기기(라이트하우스 모바일)도 다 받는다
  mobile: {
    src: '/art/hub-hero-mobile.webp',
    srcSet: '/art/hub-hero-mobile-600.webp 600w, /art/hub-hero-mobile-720.webp 720w, /art/hub-hero-mobile.webp 896w',
    sizes: '(min-width: 640px) 640px, 100vw',
    width: 896,
    height: 1200,
  },
  desktop: { src: '/art/hub-hero-desktop.webp', width: 1376, height: 768 },
} as const

/**
 * 홈 히어로(리디자인 v2 R3) — 노을 고정 하늘 + H1 2단(D1) + 마스트헤드 + 키아트(D10) + 오늘 호 카드(D2).
 * - 하늘은 헤더 뒤까지 이어진다(섹션을 크롬 높이만큼 위로 당김, globals.css .home-hero). 헤더 크림 .86이 하늘 위에 얹힌다.
 * - 키아트는 CSS 배경이 아니라 <picture>/<img fetchpriority="high"> — LCP 후보가 HTML에서 바로 보이게(리뷰 B8).
 *   768 미만: 모바일 전용판이 글 아래로 이어지고 위쪽을 그라데이션 div로 하늘에 녹인다.
 *   768 이상: 데스크톱판이 섹션 전체(헤더 뒤 포함)를 덮고 글·카드는 왼쪽 빈 하늘 위. 1440 넘는 화면은
 *   1440 틀 안에 두고 바깥은 같은 하늘 그라데이션으로 잇는다(1920 업스케일 판단은 PR 본문).
 * - 숫자(게임 수)는 gamePages에서 계산(D4).
 */
// 티켓 세 번째 칸 'Continue'가 최근 게임 이름을 찾는 목록(slug·제목만, 약 4KB)
const ticketGames: TicketGame[] = gamePages.map((g) => ({ slug: g.slug, title: g.h1 }))
const dailyCount = gamePages.filter((g) => gameMeta[g.slug]?.daily).length

export function HomeHero() {
  const games: TodayCardGame[] = GARDEN_SLUGS.map((slug) => ({
    slug,
    title: gamePages.find((g) => g.slug === slug)?.h1 ?? slug,
  }))
  return (
    <section className="home-hero" data-testid="home-hero" aria-labelledby="home-h1">
      <div className="home-hero__inner">
        <div className="home-hero__copy font-ui">
          <HeroMasthead />
          <h1 id="home-h1" className="mt-4 text-garden-ink lg:mt-7">
            <span className="block text-[18px] leading-6 font-semibold text-garden-ink-deep">Free online mini games</span>{' '}
            <span className="font-display mt-1 block text-[36px] leading-10 font-semibold tracking-[-0.02em] lg:mt-2 lg:text-[56px] lg:leading-[60px] lg:tracking-[-0.025em]">
              A small garden{' '}
              <em className="font-display-italic block italic">that blooms daily.</em>
            </span>
          </h1>
          <p className="mt-2 text-[16px] leading-6 text-garden-ink-deep lg:mt-4 lg:text-[18px] lg:leading-7">
            {gamePages.length} and growing. No sign-up.
          </p>
        </div>

        <div className="home-hero__art">
          <picture>
            <source media="(min-width: 768px)" srcSet={HERO_ART.desktop.src} width={HERO_ART.desktop.width} height={HERO_ART.desktop.height} />
            {/* 정적 export라 next/image 대신 <picture> 아트 디렉션·fetchpriority를 직접 제어 */}
            <img
              src={HERO_ART.mobile.src}
              srcSet={HERO_ART.mobile.srcSet}
              sizes={HERO_ART.mobile.sizes}
              width={HERO_ART.mobile.width}
              height={HERO_ART.mobile.height}
              alt="Mallang the jelly and Tori the squirrel on a floating sunflower island at sunset"
              fetchPriority="high"
              decoding="async"
              className="home-hero__img"
            />
          </picture>
          {/* 키아트 위쪽을 하늘에 녹이는 페이드(모바일), 1440 넘는 화면의 좌우 이음(데스크톱) */}
          <div aria-hidden="true" className="home-hero__fade" />
          <div aria-hidden="true" className="home-hero__edge home-hero__edge--l" />
          <div aria-hidden="true" className="home-hero__edge home-hero__edge--r" />
        </div>

        <div className="home-hero__card">
          <TodayCard games={games} />
        </div>

        {/* 1280 이상: 바닥 라벤더 띠 위 '오늘 호' 티켓 3장(R5, R4 이월). 그 아래 폭에선 display:none */}
        <HeroTickets games={ticketGames} dailyCount={dailyCount} />
      </div>
    </section>
  )
}
