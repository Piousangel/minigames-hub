import type { Metadata } from 'next'
import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { siteConfig } from '@/lib/siteConfig'
import { AdSlot } from '@/components/ads/AdSlot'
import { GameBrowser, type BrowseItem } from '@/components/GameBrowser'
import { Achievements } from '@/components/Achievements'
import { FeaturedGames } from '@/components/FeaturedGames'
import { HeroPlayButton } from '@/components/HeroPlayButton'
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
    <main className="mx-auto max-w-6xl px-4 pb-16">
      {/* ===== HERO — 아케이드 캐비닛 진입 화면 ===== */}
      <section className="hero-crt-on relative overflow-hidden py-14 text-center sm:py-20">
        <p
          aria-hidden="true"
          className="font-pixel neon-text mb-6 inline-block text-[10px] tracking-[0.3em] text-neon-cyan sm:text-xs"
        >
          ◄ INSERT COIN ►
        </p>
        <div
          className="hero-breathe font-pixel neon-text-strong mx-auto mb-5 max-w-3xl text-2xl leading-relaxed sm:text-4xl"
          style={{ color: 'var(--neon-amber)' }}
        >
          {siteConfig.name}
        </div>
        <h1 className="mx-auto mb-4 max-w-2xl text-lg font-semibold uppercase tracking-[0.15em] text-fg sm:text-2xl">
          Free Online Mini Games
        </h1>
        <p
          aria-hidden="true"
          className="hero-shimmer font-pixel neon-text mb-5 inline-block text-[10px] tracking-[0.2em] text-neon-magenta sm:text-sm"
        >
          PLAY · INSTANTLY · FREE
        </p>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-fg-muted sm:text-base">
          {siteConfig.description}
        </p>
        {/* 100종 달성 마일스톤 — 최신작(Bearing)으로 유도하는 소프트 CTA 겸 공지 */}
        <div className="mt-5 flex justify-center">
          <Link
            href="/bearing"
            className="btn-press inline-flex items-center gap-2 rounded-full border border-neon-lime/40 bg-neon-lime/10 px-4 py-1.5 text-xs font-semibold text-neon-lime transition-colors hover:bg-neon-lime/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-lime focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:text-sm"
          >
            <span aria-hidden="true">🎉</span>
            100 free games and counting — newest: Bearing
          </Link>
        </div>
        {/* 1차 CTA — "즉시 플레이"를 실제 버튼으로. 콜드 방문자를 바로 게임에 진입시켜 활성화. */}
        <div className="mt-7 flex justify-center">
          <HeroPlayButton />
        </div>
      </section>

      {/* ===== 아케이드 마퀴 티커 ===== */}
      <Marquee />

      {/* ===== Explore — 최고 권위 페이지(홈)에서 SEO 랜딩으로 가는 내부링크 스트립 ===== */}
      <nav aria-label="Explore games" className="mb-10 flex flex-wrap justify-center gap-2 text-sm">
        {[
          { href: '/daily', label: '🔥 Daily games' },
          { href: '/collections', label: '★ Collections' },
          { href: '/unblocked', label: 'Unblocked' },
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
    </main>
  )
}
