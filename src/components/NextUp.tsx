'use client'

import { useEffect, useState } from 'react'
import { gamePages } from '@/lib/games/registry'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { GameCard } from '@/components/GameCard'
import { todayUTC } from '@/lib/dailyDate'
import { loadPlayedToday } from '@/lib/today'
import { RECENT_KEY } from '@/components/RecordPlay'

const RUN_KEY = 'run:count'

/**
 * 게임 직후 "NEXT UP" — 이탈 지점(게임오버)에서 다음 게임으로 원탭 유도(체류↑).
 * 오늘·이번 세션·최근에 안 한 게임을 같은 카테고리 우선으로 하나 제안(결정비용 제거).
 * 세션 RUN ×N 카운터로 "달리고 있다"는 관성. 클라이언트 전용(하이드레이션 안전).
 */
export function NextUp({ currentSlug }: { currentSlug: string }) {
  const [ready, setReady] = useState(false)
  const [runCount, setRunCount] = useState(0)
  const [nextSlug, setNextSlug] = useState<string | null>(null)

  useEffect(() => {
    // 이 게임을 이번 세션에 열었다 → RUN +1 (탭/세션 닫으면 리셋)
    let run = 0
    try {
      run = (Number(sessionStorage.getItem(RUN_KEY)) || 0) + 1
      sessionStorage.setItem(RUN_KEY, String(run))
    } catch {
      run = 1
    }
    setRunCount(run)

    // 다음 게임 픽: 오늘/세션/최근 미플레이 우선, 같은 카테고리 우선, RUN으로 회전
    const played = new Set(loadPlayedToday(todayUTC()))
    let recent: string[] = []
    try {
      recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[]
    } catch {
      recent = []
    }
    const excl = new Set<string>([currentSlug, ...played, ...recent])
    const cat = (gameMeta[currentSlug] ?? DEFAULT_META).category
    const all = gamePages.map((g) => g.slug)
    const fresh = all.filter((s) => !excl.has(s))
    const sameCat = fresh.filter((s) => (gameMeta[s] ?? DEFAULT_META).category === cat)
    const pool = sameCat.length > 0 ? sameCat : fresh.length > 0 ? fresh : all.filter((s) => s !== currentSlug)
    setNextSlug(pool.length > 0 ? pool[run % pool.length] : null)
    setReady(true)
  }, [currentSlug])

  if (!ready || !nextSlug) return null
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
