import type { Metadata } from 'next'
import { gamePages } from '@/lib/games/registry'
import { CATEGORIES, DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { siteConfig } from '@/lib/siteConfig'
import { GameCard } from '@/components/GameCard'
import { Reveal } from '@/components/Reveal'
import { Marquee } from '@/components/Marquee'

export const metadata: Metadata = { alternates: { canonical: '/' } }

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
      </section>

      {/* ===== 아케이드 마퀴 티커 ===== */}
      <Marquee />

      {/* ===== 카테고리별 섹션 (정적/SSR — 인터랙티브 필터 없음) ===== */}
      <div className="space-y-14">
        {CATEGORIES.map((category) => {
          const games = gamePages.filter(
            (g) => (gameMeta[g.slug] ?? DEFAULT_META).category === category,
          )
          if (games.length === 0) return null
          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <Reveal>
                <div className="mb-6 flex items-center gap-4">
                  <h2
                    id={`cat-${category}`}
                    className="font-pixel neon-text text-sm text-neon-cyan sm:text-base"
                  >
                    {category}
                  </h2>
                  <span
                    aria-hidden="true"
                    className="h-px flex-1 bg-gradient-to-r from-neon-cyan/50 to-transparent"
                  />
                  <span
                    aria-hidden="true"
                    className="font-pixel text-[10px] text-fg-muted"
                  >
                    {String(games.length).padStart(2, '0')}
                  </span>
                </div>
              </Reveal>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {games.map((g, i) => (
                  <Reveal key={g.slug} delay={Math.min(i * 50, 300)}>
                    <GameCard page={g} />
                  </Reveal>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
