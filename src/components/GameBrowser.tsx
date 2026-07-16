'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES, type GameCategory } from '@/lib/games/gameMeta'
import { GameCard } from '@/components/GameCard'
import { DiceIcon } from '@/components/icons/DiceIcon'
import { Reveal } from '@/components/Reveal'

export interface BrowseItem {
  slug: string
  title: string
  description: string
  category: GameCategory
  daily?: boolean
}

// Daily는 카테고리가 아니라 가로지르는 축이다 — 매일 같은 판이 주어지는 게임을 모은다.
// 재방문 훅이라 찾을 수 있어야 하는데 그전엔 노출 경로가 0개였다.
type Filter = 'All' | 'Daily' | GameCategory

const FILTERS: Filter[] = ['All', 'Daily', ...CATEGORIES]

/**
 * 홈 게임 브라우저: 인스턴트 검색 + 카테고리 필터 + 랜덤 게임.
 * 검색어 없고 필터 All이면 기존 카테고리 섹션 레이아웃(SSR 초기 렌더 = SEO 보존).
 * 검색/필터 시 매칭 결과를 플랫 그리드로.
 */
export function GameBrowser({ items }: { items: BrowseItem[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('All')
  const router = useRouter()

  const q = query.trim().toLowerCase()
  const isBrowsing = q === '' && filter === 'All'

  const matches = useMemo(() => {
    return items.filter((it) => {
      if (filter === 'Daily') {
        if (!it.daily) return false
      } else if (filter !== 'All' && it.category !== filter) {
        return false
      }
      if (!q) return true
      return (
        it.title.toLowerCase().includes(q) || it.description.toLowerCase().includes(q)
      )
    })
  }, [items, filter, q])

  function playRandom() {
    const pool = matches.length > 0 ? matches : items
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick) router.push(`/${pick.slug}`)
  }

  return (
    <div>
      {/* 검색 + 랜덤 */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3-3" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games…"
            aria-label="Search games"
            className="w-full rounded-lg border border-border bg-surface/80 py-2.5 pl-10 pr-3 text-sm text-fg placeholder:text-fg-muted focus-visible:border-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/40"
          />
        </div>
        <button
          onClick={playRandom}
          className="btn-press font-pixel flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neon-magenta/60 bg-surface/80 px-4 text-[10px] tracking-[0.15em] text-neon-magenta hover:bg-neon-magenta/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-magenta/50"
          style={{ color: 'var(--neon-magenta)' }}
        >
          <DiceIcon className="h-4 w-4" />
          RANDOM
        </button>
      </div>

      {/* 카테고리 필터 칩 */}
      <div className="mb-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={`btn-press rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/50 ${
                active
                  ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                  : 'border-border bg-surface/60 text-fg-muted hover:text-fg'
              }`}
            >
              {f}
            </button>
          )
        })}
      </div>

      {isBrowsing ? (
        // 브라우즈 상태: 카테고리 섹션(기존 레이아웃)
        <div className="space-y-14">
          {CATEGORIES.map((category) => {
            const games = items.filter((it) => it.category === category)
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
                    <span aria-hidden="true" className="font-pixel text-[10px] text-fg-muted">
                      {String(games.length).padStart(2, '0')}
                    </span>
                  </div>
                </Reveal>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {games.map((g, i) => (
                    <Reveal key={g.slug} delay={Math.min(i * 50, 300)}>
                      <GameCard slug={g.slug} title={g.title} description={g.description} />
                    </Reveal>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : matches.length > 0 ? (
        // 검색/필터 결과: 플랫 그리드
        <div>
          <p className="mb-4 text-xs text-fg-muted">
            {matches.length} game{matches.length === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {matches.map((g) => (
              <GameCard key={g.slug} slug={g.slug} title={g.title} description={g.description} />
            ))}
          </div>
        </div>
      ) : (
        <p className="py-12 text-center text-fg-muted">
          No games match “{query}”. Try another search or hit RANDOM.
        </p>
      )}
    </div>
  )
}
