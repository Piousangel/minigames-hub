'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameNav } from '@/components/GameNav'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { nextDayUTC } from '@/lib/dailyStreak'
import { spotlightFor } from '@/lib/spotlight'
import { markTeaserSeen } from '@/lib/spotlightSeen'
import { buildDailyIcs } from '@/lib/dailyIcs'
import { downloadTextFile } from '@/lib/downloadFile'
import { siteConfig } from '@/lib/siteConfig'
import { sendHit } from '@/lib/hit'
import { useTodayUTC } from '@/lib/useTodayUTC'

const REMINDER_FILENAME = 'quickminigames-daily.ics'
// 고정 UID: 다시 내려받아도 캘린더에 일정이 중복으로 쌓이지 않고 같은 일정이 갱신된다.
const REMINDER_UID = 'daily-reminder@quickminigames.site'
const REMINDER_SUMMARY = "Today's daily puzzles are live"
const REMINDER_DESCRIPTION = 'New daily boards just unlocked on Quick MiniGames.'

type SaveStatus = 'idle' | 'started' | 'failed'

/** 열리는 시각(00:00 UTC)을 사용자 로컬 시각으로 — 예: 한국이면 09:00. */
function localOpeningTime(spotlightDate: string): string {
  return new Date(`${spotlightDate}T00:00:00Z`).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

/**
 * "내일의 스포트라이트" 예고 — 이름·아이콘은 숨기고 카테고리와 열리는 시각만 보여 준다.
 * 버튼은 매일 00:00 UTC에 반복되는 .ics 일정을 내려받게 한다(사이트는 알림 권한을 요청하지 않는다).
 * 클라이언트 전용·하이드레이션 안전: 마운트 전에는 렌더하지 않는다.
 * 남은 시간 카운트다운은 같은 DailyDock의 "Next daily"와 겹쳐서 두지 않는다.
 */
export function SpotlightTeaser() {
  const { slug: currentSlug } = useGameNav()
  const today = useTodayUTC()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const rootRef = useRef<HTMLDivElement>(null)
  // 연타해도 클릭 지표가 부풀지 않게 마운트당 한 번만 보낸다(파일 저장은 클릭마다 한다).
  const hitSentRef = useRef(false)

  const tomorrowDate = useMemo(() => (today ? nextDayUTC(today) : null), [today])
  const openingTimeLocal = useMemo(() => (tomorrowDate ? localOpeningTime(tomorrowDate) : ''), [tomorrowDate])
  const spotlightSlug = useMemo(() => (tomorrowDate ? spotlightFor(tomorrowDate) : null), [tomorrowDate])

  // 카드가 실제로 화면에 보였을 때만 "예고를 봤다"고 기록한다(보드 아래라 스크롤 안 하면 안 보인다).
  useEffect(() => {
    if (!tomorrowDate || !spotlightSlug) return
    const markSeen = () => markTeaserSeen(tomorrowDate)
    const element = rootRef.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      markSeen()
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        markSeen()
        observer.disconnect()
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [tomorrowDate, spotlightSlug])

  if (!tomorrowDate || !spotlightSlug) return null

  const category = (gameMeta[spotlightSlug] ?? DEFAULT_META).category

  const saveReminder = () => {
    const calendar = buildDailyIcs({
      uid: REMINDER_UID,
      summary: REMINDER_SUMMARY,
      description: REMINDER_DESCRIPTION,
      url: `${siteConfig.url}/daily`,
      nowMilliseconds: Date.now(),
    })
    const started = downloadTextFile(REMINDER_FILENAME, 'text/calendar', calendar)
    // 클릭이 던지지 않았다는 뜻일 뿐 실제 저장 여부는 알 수 없어서 이벤트 이름도 click으로 둔다.
    if (started && !hitSentRef.current) {
      hitSentRef.current = true
      sendHit(currentSlug || 'site', 'spotlight_ics_click')
    }
    setSaveStatus(started ? 'started' : 'failed')
  }

  return (
    <div
      ref={rootRef}
      data-testid="spotlight-teaser"
      className="w-full max-w-xs rounded-lg border border-dashed border-border bg-surface/60 px-3 py-1.5 text-left"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="select-none text-xl blur-[2px]">
          🎁
        </span>
        <div className="min-w-0 flex-1 text-xs">
          <p className="text-[11px] font-semibold tracking-[0.15em] text-neon-amber">TOMORROW&apos;S SPOTLIGHT</p>
          <p className="text-fg-muted">
            <span className="font-semibold text-fg">
              <span aria-hidden="true">???</span>
              <span className="sr-only">Mystery game</span> · {category}
            </span>{' '}
            · opens 00:00 UTC ({openingTimeLocal} your time)
          </p>
        </div>
        <button
          type="button"
          onClick={saveReminder}
          data-testid="spotlight-ics"
          aria-label="Add to calendar — downloads a daily reminder file"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neon-cyan/50 bg-surface px-2 py-1 text-xs font-semibold text-neon-cyan transition-colors hover:bg-neon-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <span aria-hidden="true">📅</span>
          <span>Add to calendar</span>
        </button>
      </div>
      {/* 라이브 리전은 항상 마운트해 두고 문구만 바꾼다(비어 있다가 채워질 때 스크린리더가 읽는다). */}
      <p aria-live="polite" data-testid="spotlight-ics-status" className="text-xs text-fg-muted [&:not(:empty)]:mt-1">
        {saveStatus === 'started' &&
          'Download started — open the file to add a daily 00:00 UTC reminder to your calendar.'}
        {saveStatus === 'failed' && "Couldn't save the file in this browser."}
      </p>
    </div>
  )
}
