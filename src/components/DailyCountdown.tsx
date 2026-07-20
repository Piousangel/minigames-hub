'use client'

import { useEffect, useState } from 'react'
import { formatCountdown, msUntilNextUTCDay } from '@/lib/dailyStreak'

/**
 * '다음 퍼즐까지 HH:MM:SS' — /daily 허브 상단 어포인트먼트 훅(DOMAIN §3). 데일리 검색으로
 * 랜딩한 유저에게 "매일 새 판" 리듬을 즉시 보여준다. 클라이언트 전용 초 단위 틱(하이드레이션 후).
 */
export function DailyCountdown() {
  const [cd, setCd] = useState('')
  useEffect(() => {
    const tick = () => setCd(formatCountdown(msUntilNextUTCDay(Date.now())))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  if (!cd) return null
  return (
    <p className="mb-8 inline-flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-fg-muted">
      <span aria-hidden="true" className="font-pixel text-[9px] uppercase tracking-[0.2em] text-neon-amber">
        Next puzzles in
      </span>
      <span className="tabular-nums font-bold text-neon-amber" data-testid="daily-hub-countdown">
        {cd}
      </span>
    </p>
  )
}
