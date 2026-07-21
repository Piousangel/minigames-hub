'use client'

import { gamePages } from '@/lib/games/registry'
import { GameCard } from '@/components/GameCard'
import { useGameNav } from '@/components/GameNav'

/**
 * 게임 직후 "NEXT UP" 카드 — 이탈 지점(게임오버)에서 다음 게임으로 원탭 유도(체류↑).
 * 다음 게임 픽 + RUN 카운터는 GameNavProvider(단일 소스)에서 온다 — GameOverlay의 '다음 게임'
 * 버튼과 동일 픽을 공유하고 RUN이 이중 증가하지 않는다. 준비 전/픽 없으면 안 그림.
 */
export function NextUp({ currentSlug: _currentSlug }: { currentSlug: string }) {
  const { nextSlug, runCount } = useGameNav()
  if (!nextSlug) return null
  const g = gamePages.find((p) => p.slug === nextSlug)
  if (!g) return null

  return (
    <section aria-label="Next game" className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="neon-text text-sm font-bold uppercase tracking-[0.15em] text-neon-lime">
          Next up
        </span>
        {runCount > 1 && (
          <span
            className="rounded-full border border-neon-lime/40 bg-surface px-3 py-1 text-xs font-bold text-neon-lime"
            data-testid="run-count"
          >
            RUN ×{runCount}
          </span>
        )}
      </div>
      <div className="max-w-xs">
        <GameCard slug={g.slug} title={g.h1} description={g.shortDescription} />
      </div>
    </section>
  )
}
