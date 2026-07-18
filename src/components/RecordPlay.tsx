'use client'

import { useEffect } from 'react'
import { todayUTC } from '@/lib/dailyDate'
import { bumpStreak, loadStreak, saveStreak } from '@/lib/dailyStreak'
import { markPlayed } from '@/lib/today'

export const RECENT_KEY = 'recent:games'
export const RECENT_MAX = 8

/**
 * 게임 페이지 방문 시 (1) 최근 플레이 목록, (2) 오늘 퀘스트 기록, (3) 사이트 전역
 * day-streak을 갱신. 렌더 없음. 모든 게임 페이지에 이미 걸려 있어(GamePageLayout)
 * 여기 몇 줄이 전 게임에 파급되는 유일한 전역 방문 훅이다.
 */
export function RecordPlay({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      const list: string[] = raw ? JSON.parse(raw) : []
      const next = [slug, ...list.filter((s) => s !== slug)].slice(0, RECENT_MAX)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))

      // TODAY 보드: 오늘 퀘스트 + 사이트 day-streak (bumpStreak은 같은 날 멱등).
      const today = todayUTC()
      markPlayed(today, slug)
      saveStreak('site:streak', bumpStreak(loadStreak('site:streak'), today))
    } catch {
      /* localStorage 불가 환경 무시 */
    }
  }, [slug])
  return null
}
