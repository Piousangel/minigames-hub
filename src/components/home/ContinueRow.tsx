'use client'

import { useEffect, useMemo, useState } from 'react'
import type { GameCategory } from '@/lib/games/gameMeta'
import { rankFeatured } from '@/lib/popular'
import { RECENT_KEY } from '@/components/RecordPlay'
import { FAVORITES_EVENT, loadFavorites } from '@/lib/favorites'
import { spotlightFor } from '@/lib/spotlight'
import { useTodayUTC } from '@/lib/useTodayUTC'
import { usePopular } from '@/lib/home/usePopular'
import { SeedCard } from './SeedCard'

export type ContinueItem = { slug: string; title: string; description: string; category: GameCategory }

export const CONTINUE_COUNT = 4

/**
 * 홈 Continue 줄(리디자인 v2 R4) — "Pick up where you left off".
 * - 단골: 최근 플레이(RecordPlay의 `recent:games`, 최신이 앞) → 즐겨찾기(하트, 최근에 담은 순) → 인기 순으로 채워 늘 4칸.
 *   (예전 홈 'My Games' 레일 몫 — 즐겨찾기 전체 목록은 씨앗 도서관 'My games' 필터.)
 * - 인기로 채우는 칸에서는 오늘의 스포트라이트 게임을 뺀다 — 바로 아래 스포트라이트 줄과 겹치지 않게(예전 TodayBoard 규칙).
 * - 첫 방문: 인기 4(예전 Featured 레일의 큐레이션 순서 → /api/popular가 있으면 그 안에서 재정렬, rankFeatured).
 * - 정적 HTML = 첫 방문 모양(큐레이션 앞 4개). 마운트 뒤 바뀌어도 칸 수·크기가 같아 CLS 0(D2).
 *
 * @param curated 인기 후보(큐레이션 순서). 4개 이상.
 * @param items  최근 플레이를 찾을 전 게임 목록(설명 없이 가볍게 — GameBrowser와 페이로드가 겹치지 않게).
 */
export function ContinueRow({ curated, items }: { curated: ContinueItem[]; items: ContinueItem[] }) {
  const [recent, setRecent] = useState<string[] | null>(null)
  const [favs, setFavs] = useState<string[]>([])
  const today = useTodayUTC()

  useEffect(() => {
    const sync = () => setFavs(loadFavorites())
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    return () => window.removeEventListener(FAVORITES_EVENT, sync)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      const v = raw ? (JSON.parse(raw) as unknown) : []
      setRecent(Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [])
    } catch {
      setRecent([])
    }
  }, [])

  const bySlug = useMemo(() => new Map(items.map((it) => [it.slug, it])), [items])
  // 단골 칸: 최근 플레이 → 즐겨찾기(중복 제거), 최대 4
  const own = useMemo(() => {
    const out: { item: ContinueItem; ref: 'home-continue' | 'home-saved' }[] = []
    const seen = new Set<string>()
    const push = (slugs: string[], ref: 'home-continue' | 'home-saved') => {
      for (const s of slugs) {
        const it = bySlug.get(s)
        if (!it || seen.has(s) || out.length >= CONTINUE_COUNT) continue
        seen.add(s)
        out.push({ item: it, ref })
      }
    }
    push(recent ?? [], 'home-continue')
    push(favs, 'home-saved')
    return out
  }, [recent, favs, bySlug])
  // 단골 칸으로 4칸이 다 차면 인기 데이터는 필요 없다(요청 안 함)
  const popular = usePopular(recent !== null && own.length < CONTINUE_COUNT)
  const curatedBySlug = useMemo(() => new Map(curated.map((c) => [c.slug, c])), [curated])
  const ranked = useMemo(
    () => rankFeatured(curated.map((c) => c.slug), popular, { known: new Set(curatedBySlug.keys()) }),
    [curated, popular, curatedBySlug],
  )

  const returning = own.length > 0
  const spotlight = today ? spotlightFor(today) : null
  const taken = new Set(own.map((o) => o.item.slug))
  const fill = ranked.order
    .filter((s) => !taken.has(s) && s !== spotlight)
    .map((s) => curatedBySlug.get(s))
    .filter((x): x is ContinueItem => Boolean(x))
    .map((item) => ({ item, ref: 'home-popular' as const }))
  const tiles = [...own, ...fill].slice(0, CONTINUE_COUNT)

  return (
    <section aria-labelledby="continue-title" data-testid="continue-row" data-state={returning ? 'returning' : 'first'}>
      <p className="text-[12px] leading-4 font-semibold text-garden-coral-text">
        {!returning ? 'Popular to start' : own.some((o) => o.ref === 'home-continue') ? 'Recently played' : 'Saved games'}
      </p>
      <h2 id="continue-title" className="font-display mt-1 text-[24px] leading-[30px] font-semibold tracking-[-0.015em]">
        {returning ? (
          <>
            Pick up where <em className="font-display-italic italic">you left off</em>
          </>
        ) : (
          <>
            A good place <em className="font-display-italic italic">to start</em>
          </>
        )}
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {/* 칸 위치로 key — 첫 방문 → 단골로 바뀔 때 칸(DOM)은 그대로 두고 내용만 바꾼다(카드가 옆 칸으로 '이동'하면 CLS로 잡힌다) */}
        {tiles.map(({ item: g, ref }, i) => (
          <li key={i} data-testid="continue-tile">
            <SeedCard
              slug={g.slug}
              title={g.title}
              description={g.description}
              category={g.category}
              favoritable={false}
              showDescription={false}
              href={`/${g.slug}?ref=${ref}`}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
