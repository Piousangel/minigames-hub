'use client'

import { useEffect } from 'react'

export const RECENT_KEY = 'recent:games'
export const RECENT_MAX = 8

/** 게임 페이지 방문 시 최근 플레이 목록(localStorage)에 slug 기록. 렌더 없음. */
export function RecordPlay({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      const list: string[] = raw ? JSON.parse(raw) : []
      const next = [slug, ...list.filter((s) => s !== slug)].slice(0, RECENT_MAX)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* localStorage 불가 환경 무시 */
    }
  }, [slug])
  return null
}
