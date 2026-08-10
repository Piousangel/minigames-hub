'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { gamePages } from '@/lib/games/registry'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { todayUTC } from '@/lib/dailyDate'
import { loadPlayedToday } from '@/lib/today'
import { RECENT_KEY } from '@/components/RecordPlay'

const RUN_KEY = 'run:count'

export interface GameNav {
  slug: string // 현재 게임(오버레이가 리더보드 존재 여부 등을 판단할 때 씀)
  nextSlug: string | null // 다음에 권할 게임
  nextTitle: string | null
  runCount: number // 이번 세션 연속 플레이 수
}

const Ctx = createContext<GameNav>({ slug: '', nextSlug: null, nextTitle: null, runCount: 0 })
export const useGameNav = () => useContext(Ctx)

/**
 * 게임 페이지의 '다음 게임' 단일 소스(체류/세션연장 핵심). NextUp(보드 아래 카드)과
 * GameOverlay(승/패 모달의 '다음 게임' 버튼)가 이 하나의 픽을 공유한다 — 그래서 RUN 카운터가
 * 이중 증가하지 않는다. 픽 규칙: 오늘·세션·최근 미플레이 우선, 같은 카테고리 우선, RUN으로 회전.
 * 클라이언트 전용(하이드레이션 안전). 프로바이더 밖에선 nextSlug=null이라 버튼이 안 뜬다.
 */
export function GameNavProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [nav, setNav] = useState<GameNav>({ slug, nextSlug: null, nextTitle: null, runCount: 0 })

  useEffect(() => {
    let run = 0
    try {
      run = (Number(sessionStorage.getItem(RUN_KEY)) || 0) + 1
      sessionStorage.setItem(RUN_KEY, String(run))
    } catch {
      run = 1
    }
    const played = new Set(loadPlayedToday(todayUTC()))
    let recent: string[] = []
    try {
      recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[]
    } catch {
      recent = []
    }
    const excl = new Set<string>([slug, ...played, ...recent])
    const cat = (gameMeta[slug] ?? DEFAULT_META).category
    const all = gamePages.map((g) => g.slug)
    const fresh = all.filter((s) => !excl.has(s))
    const sameCat = fresh.filter((s) => (gameMeta[s] ?? DEFAULT_META).category === cat)
    // 추천 가중: 잘 만든(featured) 게임을 우선 제안(같은 카테고리 우선 유지) → 다음 게임도 품질 위주.
    const feat = (list: string[]) => list.filter((s) => gameMeta[s]?.featured)
    const pool =
      feat(sameCat).length > 0
        ? feat(sameCat)
        : sameCat.length > 0
          ? sameCat
          : feat(fresh).length > 0
            ? feat(fresh)
            : fresh.length > 0
              ? fresh
              : all.filter((s) => s !== slug)
    const nextSlug = pool.length > 0 ? pool[run % pool.length] : null
    const g = nextSlug ? gamePages.find((p) => p.slug === nextSlug) : null
    setNav({ slug, nextSlug, nextTitle: g?.h1 ?? null, runCount: run })
  }, [slug])

  return <Ctx.Provider value={nav}>{children}</Ctx.Provider>
}
