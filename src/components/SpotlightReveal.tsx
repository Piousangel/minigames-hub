'use client'

import { useEffect, useState } from 'react'
import { GameCard } from '@/components/GameCard'
import type { BrowseItem } from '@/components/GameBrowser'
import { todayUTC } from '@/lib/dailyDate'
import { spotlightFor } from '@/lib/spotlight'
import { wasTeasedFor } from '@/lib/spotlightSeen'
import { loadPlayedToday } from '@/lib/today'

interface RevealState {
  spotlightSlug: string
  wasTeased: boolean
  wasOpenedToday: boolean
}

/**
 * 홈의 "TODAY'S SPOTLIGHT" — 어제 게임오버에서 예고했던 게임을 공개한다.
 * 새 보상은 없다(기존 데일리 스트릭이 그대로 오른다). 클라이언트 전용·하이드레이션 안전.
 */
export function SpotlightReveal({ items }: { items: BrowseItem[] }) {
  const [reveal, setReveal] = useState<RevealState | null>(null)

  useEffect(() => {
    const today = todayUTC()
    const spotlightSlug = spotlightFor(today)
    if (!spotlightSlug) return
    setReveal({
      spotlightSlug,
      wasTeased: wasTeasedFor(today),
      wasOpenedToday: loadPlayedToday(today).includes(spotlightSlug),
    })
  }, [])

  const spotlightItem = reveal ? items.find((item) => item.slug === reveal.spotlightSlug) : undefined
  if (!reveal || !spotlightItem) return null

  return (
    <div data-testid="spotlight-reveal" className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold tracking-wide text-neon-amber">TODAY&apos;S SPOTLIGHT</p>
        {reveal.wasTeased && (
          <span
            data-testid="spotlight-teased"
            className="rounded-full border border-neon-cyan/40 bg-surface px-2 py-0.5 text-[10px] font-semibold text-neon-cyan"
          >
            Teased yesterday
          </span>
        )}
        {reveal.wasOpenedToday && (
          <span
            data-testid="spotlight-opened"
            className="rounded-full border border-neon-lime/40 bg-surface px-2 py-0.5 text-[10px] font-semibold text-neon-lime"
          >
            Opened today ✓
          </span>
        )}
      </div>
      <div className="max-w-xs">
        <GameCard slug={spotlightItem.slug} title={spotlightItem.title} description={spotlightItem.description} />
      </div>
    </div>
  )
}
