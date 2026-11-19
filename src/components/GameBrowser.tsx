'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES, type GameCategory } from '@/lib/games/gameMeta'
import { FAVORITES_EVENT, loadFavorites } from '@/lib/favorites'
import { LIBRARY_PREVIEW, libraryOrder } from '@/lib/home/shelves'
import { SeedCard } from '@/components/home/SeedCard'
import { SeedIcon } from '@/components/home/HomeIcons'
import { ALL_GAMES_ANCHOR, SEARCH_ANCHOR } from '@/components/site-chrome/anchors'
import { SearchIcon } from '@/components/site-chrome/GardenIcons'

export interface BrowseItem {
  slug: string
  title: string
  description: string
  category: GameCategory
  daily?: boolean
}

// Daily는 카테고리가 아니라 가로지르는 축이다 — 매일 같은 판이 주어지는 게임을 모은다.
// 'My games'는 즐겨찾기(하트) — 예전 홈 'My Games' 레일을 R4에서 이 필터로 흡수했다(기능 유지).
type Filter = 'All' | 'Daily' | GameCategory | 'My games'

const FILTERS: Filter[] = ['All', 'Daily', ...CATEGORIES, 'My games']

/**
 * 홈 '씨앗 도서관'(All games, 리디자인 v2 R4): 인스턴트 검색 + 필터 칩 + 씨앗 던지기(랜덤).
 * - 기본(검색어 없음·All): 전 게임을 카테고리 번갈아 순서(libraryOrder)로. 앞 24개만 보이고 나머지는
 *   CSS로 접어 두지만 **113개 링크가 모두 정적 HTML에 있다**(SEO·내부 링크 — e2e가 지킨다). "Show all N"으로 편다.
 * - 검색·필터: 맞는 게임만 평평한 그리드(data-testid="browse-results"), 접지 않는다.
 * - 앵커: 헤더 검색 `/#search`(입력), 헤더 All games `/#all-games`(섹션 머리).
 */
export function GameBrowser({ items, heading }: { items: BrowseItem[]; heading?: ReactNode }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('All')
  const [expanded, setExpanded] = useState(false)
  const [favs, setFavs] = useState<string[]>([])
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLElement>(null)

  // 헤더 검색·All games(다른 페이지 → /#search, /#all-games, 또는 새로 열기·새로고침)로 왔을 때.
  // Next 클라이언트 이동은 이 섹션까지 스크롤해 주지 않고(실측), 새로 로드하면 위쪽 섹션(Continue 줄 등
  // 클라이언트 렌더)이 늦게 바뀌어 앵커가 밀릴 수 있다. 그래서 몇 번 다시 맞추되,
  // 사용자가 직접 스크롤·터치·키 입력을 하면 바로 멈춘다.
  useEffect(() => {
    const hash = window.location.hash
    const isSearch = hash === `#${SEARCH_ANCHOR}`
    if (!isSearch && hash !== `#${ALL_GAMES_ANCHOR}`) return
    const align = () => {
      if (isSearch) inputRef.current?.scrollIntoView({ block: 'center' })
      else rootRef.current?.scrollIntoView({ block: 'start' })
    }
    const timers = [0, 250, 700, 1500].map((ms) => window.setTimeout(align, ms))
    const stop = () => timers.forEach((t) => window.clearTimeout(t))
    const userEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    userEvents.forEach((e) => window.addEventListener(e, stop, { once: true, passive: true }))
    if (isSearch) inputRef.current?.focus({ preventScroll: true })
    return () => {
      stop()
      userEvents.forEach((e) => window.removeEventListener(e, stop))
    }
  }, [])

  // 즐겨찾기 목록(하트 토글 시 커스텀 이벤트로 즉시 갱신)
  useEffect(() => {
    const sync = () => setFavs(loadFavorites())
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    return () => window.removeEventListener(FAVORITES_EVENT, sync)
  }, [])

  const q = query.trim().toLowerCase()
  const isBrowsing = q === '' && filter === 'All'
  const library = useMemo(() => libraryOrder(items), [items])

  const matches = useMemo(() => {
    const favSet = new Set(favs)
    const pool =
      filter === 'My games'
        ? // 즐겨찾기는 최근에 담은 순서(favorites.ts: 맨 앞이 최신)
          favs.map((s) => items.find((it) => it.slug === s)).filter((x): x is BrowseItem => Boolean(x))
        : items
    return pool.filter((it) => {
      if (filter === 'Daily' && !it.daily) return false
      if (filter === 'My games' && !favSet.has(it.slug)) return false
      if (filter !== 'All' && filter !== 'Daily' && filter !== 'My games' && it.category !== filter) return false
      if (!q) return true
      return it.title.toLowerCase().includes(q) || it.description.toLowerCase().includes(q)
    })
  }, [items, filter, q, favs])

  function playRandom() {
    const pool = matches.length > 0 ? matches : items
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick) router.push(`/${pick.slug}`)
  }

  const hidden = library.length - LIBRARY_PREVIEW

  return (
    // 헤더 'All games' 앵커. sticky 헤더 여백은 html scroll-padding-top(globals.css)이 맡는다.
    <section ref={rootRef} id={ALL_GAMES_ANCHOR} aria-labelledby="all-games-title" className="font-ui text-garden-ink">
      {heading}

      {/* 검색 + 씨앗 던지기 */}
      <div className="mt-4 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" />
          <input
            ref={inputRef}
            id={SEARCH_ANCHOR}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games…"
            aria-label="Search games"
            className="h-12 w-full rounded-xl border-2 border-garden-ink bg-garden-cream-2 pr-3 pl-10 text-[16px] text-garden-ink placeholder:text-garden-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-paper"
          />
        </div>
        <button
          type="button"
          onClick={playRandom}
          className="garden-jelly flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-garden-ink bg-garden-cream px-3 text-[14px] font-semibold shadow-[var(--garden-shadow-button)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-paper"
        >
          <SeedIcon className="h-5 w-5" />
          <span>
            Random<span className="max-[359px]:hidden"> seed</span>
          </span>
        </button>
      </div>

      {/* 필터 칩(44px, bugs Q2). 390에선 한 줄 가로 스크롤 — 페이지 가로 스크롤은 0 */}
      <div role="group" aria-label="Filter games" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {FILTERS.map((f) => {
          const active = filter === f
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={`flex h-11 shrink-0 items-center rounded-full border-2 border-garden-ink px-4 text-[14px] font-semibold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-paper ${
                active ? 'bg-garden-ink text-garden-cream' : 'bg-garden-cream text-garden-ink'
              }`}
            >
              {f === 'My games' ? (
                <>
                  <span aria-hidden="true" className="mr-1">
                    ♥
                  </span>
                  My games
                </>
              ) : (
                f
              )}
            </button>
          )
        })}
      </div>

      {isBrowsing ? (
        <>
          <ul
            id="library-grid"
            data-testid="library-grid"
            data-collapsed={expanded ? undefined : 'true'}
            className="seed-grid mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4"
          >
            {library.map((g) => (
              <li key={g.slug}>
                <SeedCard slug={g.slug} title={g.title} description={g.description} category={g.category} />
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-controls="library-grid"
                data-testid="library-toggle"
                className="garden-jelly flex h-12 items-center rounded-full border-2 border-garden-ink bg-garden-cream px-6 text-[15px] font-semibold shadow-[var(--garden-shadow-button)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-paper"
              >
                {expanded ? 'Show fewer' : `Show all ${library.length}`}
              </button>
            </div>
          )}
        </>
      ) : matches.length > 0 ? (
        <div className="mt-4">
          <p className="mb-3 text-[13px] text-garden-ink-soft" aria-live="polite">
            {matches.length} game{matches.length === 1 ? '' : 's'}
          </p>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4" data-testid="browse-results">
            {matches.map((g) => (
              <li key={g.slug}>
                <SeedCard slug={g.slug} title={g.title} description={g.description} category={g.category} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="py-10 text-center text-[15px] text-garden-ink-soft" aria-live="polite">
          {filter === 'My games' && !q
            ? 'No saved games yet — tap the heart on any game to keep it here.'
            : `No games match “${query}”. Try another word, or toss a random seed.`}
        </p>
      )}
    </section>
  )
}
