'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { sendHit } from '@/lib/hit'

/** worker의 `String(b.slug).slice(0, 40)`과 같은 상한 — 잘림이 서버에서 조용히 일어나지 않게 여기서 맞춘다. */
const KEY_MAX = 40

/** `/collection/two-player-games/` → `collection/two-player-games`, `/` → `home`. */
export function pageKey(pathname: string): string {
  const trimmed = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  return (trimmed || 'home').slice(0, KEY_MAX)
}

/**
 * 비게임 페이지(홈·카테고리·데일리·정책 등)의 조회·체류 비콘. RecordPlay는
 * GamePageLayout에서만 발화하므로 홈만 보고 나간 방문자가 `mg_events`에 아예 안
 * 잡혔다 — 외부 유입 캠페인의 효과를 재려면 이 사각지대부터 없어야 한다.
 *
 * 이벤트 이름을 'view'가 아니라 'pageview'로 분리하는 게 핵심이다. 기존 분석·메모리가
 * 전부 `blob1='view'` = "실제 게임 플레이"라는 정의 위에 서 있어서, 같은 이름을 쓰면
 * 2026-08 이전 수치와 비교가 깨진다. 루트 레이아웃에 걸려 게임 페이지에서도 함께
 * 발화하지만(=pageview는 전 페이지 균일), 'view' 집계는 그대로 게임 전용으로 남는다.
 */
export function RecordPageView() {
  const pathname = usePathname()

  useEffect(() => {
    const key = pageKey(pathname ?? '/')
    sendHit(key, 'pageview')

    const start = Date.now()
    let sent = false
    const flush = () => {
      if (sent) return
      sent = true
      sendHit(key, 'dwell', (Date.now() - start) / 1000)
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
  }, [pathname])

  return null
}
