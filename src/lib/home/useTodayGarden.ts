'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { todayLocal } from '@/lib/dailyDate'
import { editionFor, type Edition } from './edition'
import { FIRST_GARDEN, readGarden, type Garden } from './garden'

export type TodayGarden = { edition: Edition | null; garden: Garden }

/**
 * 오늘 호 + 오늘의 정원(클라이언트 전용). 첫 렌더(=정적 HTML·하이드레이션)는 늘
 * `{ edition: null, garden: first }` — 서버 HTML과 같아 하이드레이션 불일치가 없다(D2).
 * 마운트 뒤 시계·저장소를 읽고, 탭이 다시 보일 때(다른 탭에서 게임을 하고 돌아옴·자정 넘김)와
 * 다른 탭의 storage 이벤트에 다시 읽는다. 헤더 pill은 루트 레이아웃이라 클라이언트 이동 때 다시 마운트되지 않으므로
 * 경로가 바뀔 때마다도 다시 읽는다(같은 탭 기록엔 storage 이벤트가 없다 — 리뷰 반영). setTimeout 0: 새 페이지의
 * RecordPlay effect가 오늘 기록을 쓴 뒤에 읽으려고.
 */
export function useTodayGarden(): TodayGarden {
  const pathname = usePathname()
  const [v, setV] = useState<TodayGarden>({ edition: null, garden: FIRST_GARDEN })
  useEffect(() => {
    const read = () => {
      const edition = editionFor(new Date())
      let garden = FIRST_GARDEN
      try {
        garden = readGarden(window.localStorage, edition, todayLocal())
      } catch {
        /* localStorage 접근 자체가 막힌 환경 */
      }
      setV({ edition, garden })
    }
    read()
    const later = window.setTimeout(read, 0)
    const onVis = () => {
      if (document.visibilityState === 'visible') read()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('storage', read)
    return () => {
      window.clearTimeout(later)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('storage', read)
    }
  }, [pathname])
  return v
}
