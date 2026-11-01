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
 * 기기가 절전·백그라운드에 있으면 타이머가 멈춰 있을 수 있어서, 탭이 다시 보이거나
 * 페이지가 복원될 때도 날짜를 다시 읽고 타이머를 새로 건다.
 */
export function useTodayUTC(): string | null {
  const [today, setToday] = useState<string | null>(null)

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>
    const syncAndScheduleNext = () => {
      clearTimeout(timerId)
      setToday(todayUTC())
      timerId = setTimeout(syncAndScheduleNext, msUntilNextUTCDay(Date.now()) + ROLLOVER_MARGIN_MILLISECONDS)
    }
    const resyncWhenVisible = () => {
      if (document.visibilityState !== 'hidden') syncAndScheduleNext()
    }
    syncAndScheduleNext()
    document.addEventListener('visibilitychange', resyncWhenVisible)
    window.addEventListener('pageshow', syncAndScheduleNext)
    return () => {
      clearTimeout(timerId)
      document.removeEventListener('visibilitychange', resyncWhenVisible)
      window.removeEventListener('pageshow', syncAndScheduleNext)
    }
  }, [])

  return today
}
