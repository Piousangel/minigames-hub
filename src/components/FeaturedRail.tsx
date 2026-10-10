'use client'

import { useEffect, useMemo, useState } from 'react'
import { GameCard } from '@/components/GameCard'
import type { BrowseItem } from '@/components/GameBrowser'
import { parsePopularRows, rankFeatured, type PopularEntry } from '@/lib/popular'

const SESSION_KEY = 'mg:popular:v1'

function readSession(): PopularEntry[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? parsePopularRows({ data: JSON.parse(raw) }) : null
  } catch {
    return null
  }
}

function writeSession(games: PopularEntry[]): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(games))
  } catch {
    // 프라이빗 모드 등 — 무시
  }
}

/**
 * Featured 레일의 클라이언트 부분 — 첫 렌더(SSR 포함)는 큐레이션 순서 그대로, 마운트 후 /api/popular를
 * 한 번 받아(세션 캐시) 같은 개수의 카드를 인기순으로 재배치한다(src/lib/popular.ts rankFeatured).
 * 카드 수·크기가 같아 레이아웃 시프트 없음. API가 없거나(정적 e2e) 실패하면 큐레이션 순서 유지.
 */
export function FeaturedRail({ curated, items }: { curated: string[]; items: BrowseItem[] }) {
  const bySlug = useMemo(() => new Map(items.map((it) => [it.slug, it])), [items])
  const [popular, setPopular] = useState<PopularEntry[]>([])

  useEffect(() => {
    const cached = readSession()
    if (cached) {
      setPopular(cached)
      return
    }
    let cancelled = false
    fetch('/api/popular')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: unknown) => {
        const games = parsePopularRows({ data: (body as { games?: unknown } | null)?.games })
        writeSession(games)
        if (!cancelled) setPopular(games)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const { order, popular: hot } = useMemo(
    () => rankFeatured(curated, popular, { known: new Set(bySlug.keys()) }),
    [curated, popular, bySlug],
  )
  const games = order.map((s) => bySlug.get(s)).filter((g): g is BrowseItem => Boolean(g))

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {games.map((g) => (
        <div key={g.slug} className="relative h-full">
          <GameCard slug={g.slug} title={g.title} description={g.description} />
          {hot.has(g.slug) && (
            <span
              className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 rounded-full border border-neon-amber/50 bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-neon-amber"
              data-testid="popular-badge"
            >
              <span aria-hidden="true">🔥 </span>Popular
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
