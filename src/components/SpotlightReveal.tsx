'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ChevronIcon } from '@/components/home/HomeIcons'
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
 * 홈의 "TODAY'S SPOTLIGHT" — 어제 예고했던 게임을 공개한다. R4: 정원 스타일 한 줄(56px, Continue 줄 아래).
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
    <Link
      href={`/${spotlightItem.slug}`}
      data-testid="spotlight-reveal"
      className="font-ui flex h-14 items-center gap-3 rounded-2xl border-2 border-dashed border-garden-ink bg-garden-paper px-3 text-garden-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-[11px] leading-4 font-bold tracking-[0.04em] text-garden-coral-text">
          TODAY&apos;S SPOTLIGHT
          {reveal.wasOpenedToday && (
            <span data-testid="spotlight-opened" className="font-semibold tracking-normal text-garden-leaf-text">
              Opened today ✓
            </span>
          )}
          {reveal.wasTeased && (
            <span data-testid="spotlight-teased" className="font-semibold tracking-normal text-garden-ink-soft">
              Teased yesterday
            </span>
          )}
        </span>
        <span className="block truncate text-[15px] leading-5 font-semibold">{spotlightItem.title}</span>
      </span>
      <ChevronIcon className="h-5 w-5 shrink-0" />
    </Link>
  )
}
