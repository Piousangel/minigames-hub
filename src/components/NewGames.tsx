'use client'

import { useEffect, useState } from 'react'
import { GameCard } from '@/components/GameCard'
import { newSlugs } from '@/lib/newGames'
import type { BrowseItem } from '@/components/GameBrowser'

/**
 * 홈 "New games" 행 — 최근 추가 게임을 최신순으로(DOMAIN §3 홈 신선함). 복귀 유저에게
 * "새 게 있다"는 신호. 클라이언트 now 기준이라 자동 만료. 최근 게임 없으면 안 그림.
 */
export function NewGames({ items }: { items: BrowseItem[] }) {
  const [slugs, setSlugs] = useState<string[]>([])

  useEffect(() => {
    setSlugs(newSlugs(Date.now()))
  }, [])

  const bySlug = new Map(items.map((it) => [it.slug, it]))
  const games = slugs.map((s) => bySlug.get(s)).filter((x): x is BrowseItem => Boolean(x))
  if (games.length === 0) return null

  return (
    <section aria-labelledby="new-games" className="mb-12">
      <div className="mb-6 flex items-center gap-4">
        <h2 id="new-games" className="font-pixel neon-text text-sm text-neon-lime sm:text-base">
          New games
        </h2>
        <span
          aria-hidden="true"
          className="h-px flex-1 bg-gradient-to-r from-neon-lime/50 to-transparent"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {games.map((g) => (
          <GameCard key={g.slug} slug={g.slug} title={g.title} description={g.description} />
        ))}
      </div>
    </section>
  )
}
