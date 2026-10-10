'use client'

import { useEffect, useMemo, useState } from 'react'
import { GameCard } from '@/components/GameCard'
import type { BrowseItem } from '@/components/GameBrowser'
import { parsePopularRows, rankFeatured, type PopularEntry } from '@/lib/popular'

const SESSION_KEY = 'mg:popular:v1'

function readSession(): PopularEntry[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const games = parsePopularRows({ data: JSON.parse(raw) })
    return games.length > 0 ? games : null // 빈 값은 미스 취급
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

// 모듈 단위 in-flight 공유 — Strict Mode 이중 effect·동시 마운트가 요청을 한 번만 보내게.
// 성공한 비어있지 않은 결과만 세션에 캐시한다(빈/실패 결과를 캐시하면 세션 내내 재요청을 못 함).
let inflight: Promise<PopularEntry[]> | null = null

function fetchPopular(): Promise<PopularEntry[]> {
  inflight ??= fetch('/api/popular')
    .then((r) => (r.ok ? r.json() : null))
    .then((body: unknown) => {
      const games = parsePopularRows({ data: (body as { games?: unknown } | null)?.games })
      if (games.length > 0) writeSession(games)
      return games
    })
    .catch(() => [] as PopularEntry[])
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** 테스트 전용 — 모듈 in-flight 상태 초기화. */
export function __resetPopularFetchForTest(): void {
  inflight = null
}

/**
 * Featured 레일의 클라이언트 부분 — 첫 렌더(SSR 포함)는 큐레이션 순서 그대로, 마운트 후 /api/popular를
 * 한 번 받아(세션 캐시) 같은 카드 집합을 인기순으로 재배치한다(src/lib/popular.ts rankFeatured).
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
    void fetchPopular().then((games) => {
      if (!cancelled) setPopular(games)
    })
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
        <GameCard
          key={g.slug}
          slug={g.slug}
          title={g.title}
          description={g.description}
          badge={hot.has(g.slug) ? 'popular' : undefined}
        />
      ))}
    </div>
  )
}
