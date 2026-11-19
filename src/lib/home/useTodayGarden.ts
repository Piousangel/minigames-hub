'use client'

import { useEffect, useState } from 'react'
import { todayLocal } from '@/lib/dailyDate'
import { editionFor, type Edition } from './edition'
import { FIRST_GARDEN, readGarden, type Garden } from './garden'

export type TodayGarden = { edition: Edition | null; garden: Garden }

/**
 * 오늘 호 + 오늘의 정원(클라이언트 전용). 첫 렌더(=정적 HTML·하이드레이션)는 늘
 * `{ edition: null, garden: first }` — 서버 HTML과 같아 하이드레이션 불일치가 없다(D2).
 * 마운트 뒤 시계·저장소를 읽고, 탭이 다시 보일 때(다른 탭에서 게임을 하고 돌아옴·자정 넘김)와
 * 다른 탭의 storage 이벤트에 다시 읽는다.
 */
export function useTodayGarden(): TodayGarden {
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
    const onVis = () => {
      if (document.visibilityState === 'visible') read()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('storage', read)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('storage', read)
    }
  }, [])
  return v
}
