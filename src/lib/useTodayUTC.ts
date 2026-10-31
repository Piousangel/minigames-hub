'use client'

import { useEffect, useState } from 'react'
import { todayUTC } from '@/lib/dailyDate'
import { msUntilNextUTCDay } from '@/lib/dailyStreak'

// 자정 직후에 확실히 새 날짜가 읽히도록 두는 여유.
const ROLLOVER_MARGIN_MILLISECONDS = 50

/**
 * 오늘(UTC 'YYYY-MM-DD')을 돌려준다. 마운트 전에는 null(정적 export 하이드레이션 안전),
 * 마운트 뒤에는 탭을 열어 둔 채 UTC 자정을 넘기면 새 날짜로 바뀐다.
 * 매초 틱 대신 다음 자정까지의 타이머 하나만 쓰고, 값이 같아도 매번 다음 자정을 다시 예약한다.
 */
export function useTodayUTC(): string | null {
  const [today, setToday] = useState<string | null>(null)

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>
    const syncAndScheduleNext = () => {
      setToday(todayUTC())
      timerId = setTimeout(syncAndScheduleNext, msUntilNextUTCDay(Date.now()) + ROLLOVER_MARGIN_MILLISECONDS)
    }
    syncAndScheduleNext()
    return () => clearTimeout(timerId)
  }, [])

  return today
}
