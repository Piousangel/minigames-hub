'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { GameIcon } from '@/components/icons/GameIcon'
import { RECENT_KEY } from '@/components/RecordPlay'

/**
 * 게임 페이지 '최근 게임' 퀵스위처(Poki식 영구 레일, DOMAIN §2). 지금 게임에서 방금 하던 다른
 * 게임으로 원탭 전환 → 세션 게임 수↑(체류). 홈의 RecentlyPlayed 카드와 달리, 게임 중에도 늘 보이는
 * 컴팩트 아이콘 바. 현재 게임 제외, 최근 없으면 안 그림. 클라이언트 전용(하이드레이션 안전).
 */
export function GameSwitcher({ currentSlug }: { currentSlug: string }) {
  const [slugs, setSlugs] = useState<string[]>([])

  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[]
      setSlugs(list.filter((s) => s !== currentSlug).slice(0, 6))
    } catch {
      setSlugs([])
    }
  }, [currentSlug])

  const bySlug = new Map(gamePages.map((g) => [g.slug, g]))
  const games = slugs.map((s) => bySlug.get(s)).filter((g): g is NonNullable<typeof g> => Boolean(g))
  if (games.length === 0) return null

  return (
    <nav
      aria-label="Jump back to a recent game"
      className="mt-6 flex flex-wrap items-center gap-2"
      data-testid="game-switcher"
    >
      <span className="text-xs uppercase tracking-wide text-fg-muted">Jump back to</span>
      {games.map((g) => (
        <Link
          key={g.slug}
          href={`/${g.slug}`}
          aria-label={g.h1}
          title={g.h1}
          className="neon-icon flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <GameIcon slug={g.slug} className="h-6 w-6" />
        </Link>
      ))}
    </nav>
  )
}
