import type { Metadata } from 'next'
import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { shelves } from '@/lib/home/shelves'
import { POPULAR_CURATED } from '@/lib/home/popularCurated'
import { GameBrowser, type BrowseItem } from '@/components/GameBrowser'
import { SpotlightReveal } from '@/components/SpotlightReveal'
import { HomeHero } from '@/components/home/HomeHero'
import { CloudEdge } from '@/components/home/CloudEdge'
import { ContinueRow, type ContinueItem } from '@/components/home/ContinueRow'
import { OriginalsToc, type TocGame } from '@/components/home/OriginalsToc'
import { ShelfIndex } from '@/components/home/ShelfIndex'
import { HomeAbout } from '@/components/home/HomeAbout'
import { GardenSignboard } from '@/components/home/GardenSignboard'
import { HomeAdBand } from '@/components/home/HomeAdBand'
import { SeedIcon } from '@/components/home/HomeIcons'
import { TodayVisitors } from '@/components/home/TodayVisitors'

// 홈 검색 제목: 키워드 먼저(브랜드 검색이 아직 없는 새 사이트 — 리서치 2), 브랜드는 끝(잘려도 사이트 이름 줄이 따로 보인다).
// 예전엔 layout 기본값 = 브랜드만("Quick MiniGames"). 게임 페이지 템플릿("… | Quick MiniGames")과 같은 순서.
const HOME_TITLE = 'Free Online Mini Games: 100+ Games, No Download | Quick MiniGames'

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  alternates: { canonical: '/' },
  // 페이지의 openGraph는 layout 것을 통째로 덮는다 → siteName·type을 여기서 다시 준다(없으면 og:site_name이 빠짐).
  openGraph: { url: '/', type: 'website', siteName: siteConfig.name, title: `${siteConfig.name} — free online mini games` },
  // card를 빼면 Next가 summary(작은 정사각)로 떨어진다(리뷰 must-fix) — 다른 쪽과 같이 큰 카드
  twitter: { card: 'summary_large_image', title: `${siteConfig.name} — free online mini games` },
}

// Google 사이트 이름(검색 결과 위 이름 줄)용 WebSite 마크업 — 홈에만, 블록 1개. SearchAction(사이트링크 검색창)은
// 2024-11 폐지라 넣지 않는다. name은 title·og:site_name·헤더 로고와 같은 표기여야 한다(specs/2026-11-20-share-preview-garden.md).
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteConfig.name,
  alternateName: ['QuickMiniGames'],
  url: `${siteConfig.url}/`,
  description: siteConfig.description,
  inLanguage: 'en',
}

const items: BrowseItem[] = gamePages.map((g) => ({
  slug: g.slug,
  title: g.h1,
  description: g.shortDescription,
  category: (gameMeta[g.slug] ?? DEFAULT_META).category,
  daily: (gameMeta[g.slug] ?? DEFAULT_META).daily,
}))


// 클라이언트 섬(Continue·Spotlight)에는 설명 없는 가벼운 목록만 넘긴다 — 113개 설명은 GameBrowser 한 곳에만.
const slim: ContinueItem[] = items.map(({ slug, title, category }) => ({ slug, title, category, description: '' }))
const bySlug = new Map(items.map((it) => [it.slug, it]))
const curated: ContinueItem[] = POPULAR_CURATED.flatMap((s) => {
  const it = bySlug.get(s)
  return it ? [{ slug: it.slug, title: it.title, category: it.category, description: '' }] : []
})
const tocGames: TocGame[] = (['plop-landing', 'acorn-hop'] as const).map((slug) => ({ slug, title: bySlug.get(slug)?.title ?? slug }))

const kicker = 'text-[12px] leading-4 font-semibold text-garden-coral-text'
const h2 = 'font-display mt-1 text-[24px] leading-[30px] font-semibold tracking-[-0.015em]'

export default function Home() {
  const shelf = shelves(gamePages, gameMeta)
  const dailyCount = items.filter((it) => it.daily).length
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      {/* ===== HERO — 리디자인 v2 R3 「오늘 호 표지」: 노을 하늘·H1 2단·키아트·오늘 호 카드 ===== */}
      <HomeHero />

      {/* ===== 본문 — 리디자인 v2 R4 「노을 정원」 paper 종이. 구름 경계로 히어로와 잇는다 ===== */}
      <div className="home-body font-ui text-garden-ink">
        <div className="home-body__edge">
          <CloudEdge />
        </div>
        <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-12 sm:px-6 lg:pt-12">
          {/* 오늘 방문자 한 줄(오너 11-20) — 높이 예약(h-5), 실패하면 빈 줄. 광고 밴드는 본문 맨 아래 */}
          <div className="mb-4">
            <TodayVisitors />
          </div>
          {/* Continue 줄 + 오늘의 스포트라이트(어제 게임 페이지에서 예고한 게임) */}
          <ContinueRow curated={curated} items={slim} />
          <div className="mt-3 min-h-14">
            <SpotlightReveal items={slim} />
          </div>

          {/* 목차(오늘 호 나머지 섬) + 4선반 색인 — 1024 이상 나란히 */}
          <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2 [&>*]:min-w-0">
            <section aria-labelledby="toc-title">
              <div className="flex h-5 items-center justify-between">
                <p className={kicker}>Also in today’s garden</p>
                <Link
                  href="/collection/original-games"
                  className="-my-3 flex h-11 items-center text-[13px] font-semibold underline decoration-garden-ink/40 decoration-2 underline-offset-[3px]"
                >
                  All originals
                </Link>
              </div>
              <h2 id="toc-title" className={h2}>
                The rest of <em className="font-display-italic italic">today’s sky</em>
              </h2>
              <OriginalsToc games={tocGames} />
            </section>

            <section aria-labelledby="shelf-title">
              <div className="flex h-5 items-center justify-between">
                <p className={kicker}>Seed library · {gamePages.length} games</p>
                <Link
                  href="/#all-games"
                  className="-my-3 flex h-11 items-center gap-1.5 text-[13px] font-semibold underline decoration-garden-ink/40 decoration-2 underline-offset-[3px]"
                >
                  <SeedIcon className="h-4 w-4" />
                  Browse all
                </Link>
              </div>
              <h2 id="shelf-title" className={h2}>
                What kind of <em className="font-display-italic italic">five minutes?</em>
              </h2>
              <ShelfIndex shelves={shelf} />
            </section>
          </div>

          {/* 씨앗 도서관(All games): 검색·필터·랜덤, 113개 링크 전부 HTML에 */}
          <div className="mt-12">
            <GameBrowser
              items={items}
              heading={
                <>
                  <p className={kicker}>Seed library</p>
                  <h2 id="all-games-title" className={h2}>
                    All {gamePages.length} <em className="font-display-italic italic">games</em>
                  </h2>
                </>
              }
            />
          </div>

          {/* 편집 블록(About + From the guides). 머리에 안내자 해씨(등불) */}
          <div className="mt-14 border-t-2 border-garden-ink pt-10" data-ad-after="home-about">
            <HomeAbout gameCount={gamePages.length} dailyCount={dailyCount} />
          </div>

          {/* 광고 1(About 아래) — 비활성이면 DOM 없음. R6: 선반 아래에서 옮김 — 마스코트(선반 disc·빈 상태 해씨·About 해씨)와
              400px 이상(D6, DECISIONS 11-20 R6). 위치를 바꾸면 e2e/mascots.spec.ts가 거리를 다시 잰다 */}
          <HomeAdBand slot="home-about" className="mt-12" />

          {/* 정원 안내판(예전 Explore 링크) */}
          <div className="mt-12" data-ad-after="home-footer">
            <GardenSignboard />
          </div>

          {/* 광고 2(푸터 앞) */}
          <HomeAdBand slot="home-footer" className="mt-12" />
        </div>
      </div>
    </main>
  )
}
