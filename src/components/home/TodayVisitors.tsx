'use client'

import { useEffect, useState } from 'react'
import { visitorsLine } from '@/lib/visitors'

/**
 * 홈 '오늘 방문자' 한 줄(오너 11-20) — 히어로 바로 아래, Continue 줄 위. 광고 밴드와는 홈 본문 맨 아래까지 떨어져 있다.
 * - 숫자는 /api/visitors(워커가 같은 날 같은 IP를 한 번만 센 고유 방문자, UTC 자정 리셋). 10 미만은 숫자 대신 문장.
 * - 줄 높이(h-5)를 처음부터 잡아 둔다: 숫자가 늦게 오거나 실패해도 아래가 밀리지 않는다(CLS 0). 실패·표 없음이면 빈 줄로 남긴다.
 */
export function TodayVisitors() {
  const [line, setLine] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/visitors')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { today?: number | null } | null) => {
        if (alive) setLine(visitorsLine(j?.today))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return (
    <p
      data-testid="today-visitors"
      aria-hidden={line ? undefined : true}
      className="flex h-5 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12px] leading-5 sm:text-[13px] text-garden-ink-deep tabular-nums"
    >
      {line && (
        <>
          <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full bg-garden-leaf" />
          <span className="truncate">{line}</span>
          <span className="shrink-0 text-garden-ink-soft">· since 00:00 UTC</span>
        </>
      )}
    </p>
  )
}
