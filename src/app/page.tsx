import type { Metadata } from 'next'
import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import {
  CATEGORIES,
  DEFAULT_META,
  gameMeta,
  type NeonAccent,
} from '@/lib/games/gameMeta'
import { siteConfig } from '@/lib/siteConfig'
import { GameIcon } from '@/components/icons/GameIcon'

export const metadata: Metadata = { alternates: { canonical: '/' } }

// accent 키 → globals.css의 --neon-* CSS 변수. 인라인 color로 넣어
// .neon-box / .neon-text 가 currentColor 로 발광하도록 한다.
const ACCENT_VAR: Record<NeonAccent, string> = {
  cyan: 'var(--neon-cyan)',
  magenta: 'var(--neon-magenta)',
  lime: 'var(--neon-lime)',
  amber: 'var(--neon-amber)',
  purple: 'var(--neon-purple)',
  blue: 'var(--neon-blue)',
  red: 'var(--neon-red)',
  green: 'var(--neon-green)',
}

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      {/* ===== HERO — 아케이드 캐비닛 진입 화면 ===== */}
      <section className="relative overflow-hidden py-14 text-center sm:py-20">
        <p
          aria-hidden="true"
          className="font-pixel neon-text mb-6 inline-block text-[10px] tracking-[0.3em] text-neon-cyan sm:text-xs"
        >
          ◄ INSERT COIN ►
        </p>
        <div
          className="font-pixel neon-text-strong mx-auto mb-5 max-w-3xl text-2xl leading-relaxed sm:text-4xl"
          style={{ color: 'var(--neon-amber)' }}
        >
          {siteConfig.name}
        </div>
        <h1 className="mx-auto mb-4 max-w-2xl text-lg font-semibold uppercase tracking-[0.15em] text-fg sm:text-2xl">
          Free Online Mini Games
        </h1>
        <p
          aria-hidden="true"
          className="font-pixel neon-text mb-5 text-[10px] tracking-[0.2em] text-neon-magenta sm:text-sm"
        >
          PLAY · INSTANTLY · FREE
        </p>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-fg-muted sm:text-base">
          {siteConfig.description}
        </p>
      </section>

      {/* ===== 카테고리별 섹션 (정적/SSR — 인터랙티브 필터 없음) ===== */}
      <div className="space-y-14">
        {CATEGORIES.map((category) => {
          const games = gamePages.filter(
            (g) => (gameMeta[g.slug] ?? DEFAULT_META).category === category,
          )
          if (games.length === 0) return null
          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
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

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {games.map((g) => {
                  const meta = gameMeta[g.slug] ?? DEFAULT_META
                  const accent = ACCENT_VAR[meta.accent]
                  return (
                    <Link
                      key={g.slug}
                      href={`/${g.slug}`}
                      style={{ color: accent }}
                      className="neon-box neon-box-hover group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-surface/80 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <span
                        aria-hidden="true"
                        className="neon-icon inline-flex transition-transform duration-200 group-hover:scale-110"
                      >
                        <GameIcon
                          slug={g.slug}
                          className="h-8 w-8 sm:h-9 sm:w-9"
                        />
                      </span>
                      <h3 className="neon-text text-base font-bold leading-tight sm:text-lg">
                        {g.h1}
                      </h3>
                      <p className="text-xs leading-relaxed text-fg-muted sm:text-sm">
                        {g.shortDescription}
                      </p>
                      <span
                        aria-hidden="true"
                        className="font-pixel mt-1 text-[9px] tracking-[0.2em] text-fg-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      >
                        PLAY ►
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
