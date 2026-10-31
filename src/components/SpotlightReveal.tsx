'use client'

import { useMemo } from 'react'
import { GameCard } from '@/components/GameCard'
import type { BrowseItem } from '@/components/GameBrowser'
import { spotlightFor } from '@/lib/spotlight'
import { wasTeasedFor } from '@/lib/spotlightSeen'
import { loadPlayedToday } from '@/lib/today'
import { useTodayUTC } from '@/lib/useTodayUTC'

interface RevealState {
  spotlightSlug: string
  wasTeased: boolean
  wasOpenedToday: boolean
}

/**
 * 홈의 "TODAY'S SPOTLIGHT" — 어제 예고했던 게임을 공개한다.
 * 새 보상은 없다(기존 데일리 스트릭이 그대로 오른다). 클라이언트 전용·하이드레이션 안전:
 * 마운트 전에는 렌더하지 않고, 탭을 열어 둔 채 UTC 자정을 넘기면 새 날짜의 게임으로 바뀐다.
 */
export function SpotlightReveal({ items }: { items: BrowseItem[] }) {
  const today = useTodayUTC()

  const reveal = useMemo<RevealState | null>(() => {
    if (!today) return null
    const spotlightSlug = spotlightFor(today)
    if (!spotlightSlug) return null
    return {
      spotlightSlug,
      wasTeased: wasTeasedFor(today),
      wasOpenedToday: loadPlayedToday(today).includes(spotlightSlug),
    }
  }, [today])

  const spotlightItem = reveal ? items.find((item) => item.slug === reveal.spotlightSlug) : undefined
  if (!reveal || !spotlightItem) return null

  return (
    <div data-testid="spotlight-reveal" className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold tracking-wide text-neon-amber">TODAY&apos;S SPOTLIGHT</p>
        {reveal.wasOpenedToday && (
          <span
            data-testid="spotlight-opened"
            className="rounded-full border border-neon-lime/40 bg-surface px-2 py-0.5 text-[11px] font-semibold text-neon-lime"
          >
            Opened today ✓
          </span>
        )}
        {reveal.wasTeased && (
          <span
            data-testid="spotlight-teased"
            className="rounded-full border border-neon-cyan/40 bg-surface px-2 py-0.5 text-[11px] font-semibold text-neon-cyan"
          >
            Teased yesterday
          </span>
        )}
      </div>
      <div className="max-w-xs">
        <GameCard slug={spotlightItem.slug} title={spotlightItem.title} description={spotlightItem.description} />
      </div>
    </div>
  )
}
