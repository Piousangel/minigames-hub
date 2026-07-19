'use client'

import { useEffect, useState } from 'react'
import { GameCard } from '@/components/GameCard'
import { FAVORITES_EVENT, loadFavorites } from '@/lib/favorites'
import type { BrowseItem } from '@/components/GameBrowser'

/**
 * 홈 "My Games" 레일 — 즐겨찾기한 게임을 카드로. 무계정 localStorage 차별점(DOMAIN §3).
 * 클라이언트 전용(비었으면 아무것도 안 그림 → SSR/SEO 영향 없음). 하트 토글 시 커스텀
 * 이벤트로 즉시 갱신되어, 레일에서 하트를 끄면 그 카드가 바로 사라진다.
 */
export function MyGames({ items }: { items: BrowseItem[] }) {
  const [slugs, setSlugs] = useState<string[]>([])

  useEffect(() => {
    const sync = () => setSlugs(loadFavorites())
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    return () => window.removeEventListener(FAVORITES_EVENT, sync)
  }, [])

  const bySlug = new Map(items.map((it) => [it.slug, it]))
  const favs = slugs.map((s) => bySlug.get(s)).filter((x): x is BrowseItem => Boolean(x))
  if (favs.length === 0) return null

  return (
    <section aria-labelledby="my-games" className="mb-12">
      <div className="mb-6 flex items-center gap-4">
        <h2 id="my-games" className="font-pixel neon-text text-sm text-neon-magenta sm:text-base">
          ♥ My Games
        </h2>
        <span
          aria-hidden="true"
          className="h-px flex-1 bg-gradient-to-r from-neon-magenta/50 to-transparent"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {favs.map((g) => (
          <GameCard key={g.slug} slug={g.slug} title={g.title} description={g.description} />
        ))}
      </div>
    </section>
  )
}
