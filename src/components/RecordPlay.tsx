'use client'

import { useEffect } from 'react'
import { todayUTC } from '@/lib/dailyDate'
import { bumpStreak, loadStreak, saveStreak } from '@/lib/dailyStreak'
import { markPlayed } from '@/lib/today'
import { sendHit } from '@/lib/hit'

export const RECENT_KEY = 'recent:games'
export const RECENT_MAX = 8
/** 누적으로 플레이한 서로 다른 게임 slug 전부(탐험 목표/achievements용). */
export const PLAYED_ALL_KEY = 'played:all'

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

      // 누적 다른 게임 수(탐험 목표용) — 처음 보는 게임이면 추가.
      const allRaw = localStorage.getItem(PLAYED_ALL_KEY)
      const all: string[] = allRaw ? JSON.parse(allRaw) : []
      if (!all.includes(slug)) localStorage.setItem(PLAYED_ALL_KEY, JSON.stringify([...all, slug]))

      // TODAY 보드: 오늘 퀘스트 + 사이트 day-streak (bumpStreak은 같은 날 멱등).
      const today = todayUTC()
      markPlayed(today, slug)
      saveStreak('site:streak', bumpStreak(loadStreak('site:streak'), today))
    } catch {
      /* localStorage 불가 환경 무시 */
    }

    // 1st-party 분석: 조회 1건 + 이 페이지를 떠날 때 체류(초). 북극성(체류) 측정의 시작.
    sendHit(slug, 'view')
    const start = Date.now()
    let sent = false
    const flush = () => {
      if (sent) return
      sent = true
      sendHit(slug, 'dwell', (Date.now() - start) / 1000)
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', flush)
      flush() // 라우트 전환(언마운트)에서도 체류 기록
    }
  }, [slug])
  return null
}
