import type { Metadata } from 'next'
import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { siteConfig } from '@/lib/siteConfig'
import { AdSlot } from '@/components/ads/AdSlot'
import { GameBrowser, type BrowseItem } from '@/components/GameBrowser'
import { Achievements } from '@/components/Achievements'
import { FeaturedGames } from '@/components/FeaturedGames'
import { HomeHero } from '@/components/home/HomeHero'
import { LatestRelease } from '@/components/LatestRelease'
import { HomeAbout } from '@/components/HomeAbout'
import { Marquee } from '@/components/Marquee'
import { MyGames } from '@/components/MyGames'
import { NewGames } from '@/components/NewGames'
import { RecentlyPlayed } from '@/components/RecentlyPlayed'
import { TodayBoard } from '@/components/TodayBoard'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
}

const items: BrowseItem[] = gamePages.map((g) => ({
  slug: g.slug,
  title: g.h1,
  description: g.shortDescription,
  category: (gameMeta[g.slug] ?? DEFAULT_META).category,
  daily: (gameMeta[g.slug] ?? DEFAULT_META).daily,
}))

export default function Home() {
  return (
    <main>
      {/* ===== HERO — 리디자인 v2 R3 「오늘 호 표지」: 노을 하늘·H1 2단·키아트·오늘 호 카드 ===== */}
      <HomeHero />

      {/* 히어로 아래는 R4 전까지 예전(다크 네온) 섹션 그대로 */}
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10">
        {/* ===== 최신 출시 — 가장 최근에 추가된 게임을 히어로 바로 아래 최상단에(addedDate 자동) ===== */}
        <LatestRelease />

        {/* ===== 아케이드 마퀴 티커 ===== */}
        <Marquee />

        {/* ===== Explore — 최고 권위 페이지(홈)에서 SEO 랜딩으로 가는 내부링크 스트립 ===== */}
        <nav aria-label="Explore games" className="mb-10 flex flex-wrap justify-center gap-2 text-sm">
          {[
            { href: '/daily', label: '🔥 Daily games' },
            { href: '/collections', label: '★ Collections' },
            ...(siteConfig.thinPagesNoindex ? [] : [{ href: '/unblocked', label: 'Unblocked' }]),
            { href: '/category/puzzle', label: 'Puzzle' },
            { href: '/category/arcade', label: 'Arcade' },
            { href: '/category/classic', label: 'Classic' },
            { href: '/category/skill', label: 'Skill' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* ===== Featured(엄선 — 최고 게임을 첫 화면에, 서버 렌더) ===== */}
        <FeaturedGames items={items} />

        {/* ===== TODAY 보드(사이트 streak + 오늘 3게임 퀘스트 + 오늘의 픽) ===== */}
        <TodayBoard items={items} />

        {/* ===== Goals(목표 진척 — 계속 플레이 유도, 진척 없으면 안 보임) ===== */}
        <Achievements />

        {/* ===== My Games(즐겨찾기, 비었으면 안 보임) ===== */}
        <MyGames items={items} />

        {/* ===== New games(최근 추가, 없으면 안 보임 — 홈 신선함) ===== */}
        <NewGames items={items} />

        {/* ===== 최근 플레이(리텐션, 비었으면 안 보임) ===== */}
        <RecentlyPlayed items={items} />

        {/* ===== 검색 + 필터 + 랜덤 + 게임 그리드 ===== */}
        <GameBrowser items={items} />

        {/* ===== 실질 편집 콘텐츠(사이트 목적·차별점·구성) — 심사자 착지 페이지의 고유 가치 ===== */}
        <HomeAbout />

        {/* 하단 광고 자리(승인 전엔 렌더 안 됨) */}
        <AdSlot slot="home-footer" className="mt-14" />
      </div>
    </main>
  )
}
