'use client'

import { useEffect, useState } from 'react'
import { GameCard } from '@/components/GameCard'
import { RECENT_KEY } from '@/components/RecordPlay'
import type { BrowseItem } from '@/components/GameBrowser'

/**
 * 홈 상단 "Recently Played" — localStorage의 최근 플레이 slug를 카드로.
 * 클라이언트 전용(비었으면 아무것도 안 그림 → SSR/SEO 영향 없음, 리텐션용).
 */
export function RecentlyPlayed({ items }: { items: BrowseItem[] }) {
  const [slugs, setSlugs] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      setSlugs(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      setSlugs([])
    }
  }, [])

  const bySlug = new Map(items.map((it) => [it.slug, it]))
  const recent = slugs.map((s) => bySlug.get(s)).filter((x): x is BrowseItem => Boolean(x))
  if (recent.length === 0) return null

  return (
    <section aria-labelledby="recent" className="mb-12">
      <div className="mb-6 flex items-center gap-4">
        <h2 id="recent" className="font-pixel neon-text text-sm text-neon-magenta sm:text-base">
          Recently Played
        </h2>
        <span
          aria-hidden="true"
          className="h-px flex-1 bg-gradient-to-r from-neon-magenta/50 to-transparent"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {recent.map((g) => (
          <GameCard key={g.slug} slug={g.slug} title={g.title} description={g.description} />
        ))}
      </div>
    </section>
  )
}
