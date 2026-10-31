'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGameNav } from '@/components/GameNav'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { todayUTC } from '@/lib/dailyDate'
import { msUntilNextUTCDay, nextDayUTC } from '@/lib/dailyStreak'
import { spotlightFor } from '@/lib/spotlight'
import { markTeaserSeen } from '@/lib/spotlightSeen'
import { buildDailyIcs } from '@/lib/dailyIcs'
import { downloadTextFile } from '@/lib/downloadFile'
import { siteConfig } from '@/lib/siteConfig'
import { sendHit } from '@/lib/hit'

const REMINDER_FILENAME = 'quickminigames-daily.ics'
// 고정 UID: 다시 내려받아도 캘린더에 일정이 중복으로 쌓이지 않고 같은 일정이 갱신된다.
const REMINDER_UID = 'daily-reminder@quickminigames.site'
const REMINDER_SUMMARY = "Today's daily puzzles are live"
const REMINDER_DESCRIPTION = 'New daily boards just unlocked on Quick MiniGames.'
// 자정 직후에 확실히 새 날짜가 읽히도록 두는 여유.
const ROLLOVER_MARGIN_MILLISECONDS = 50

type SaveStatus = 'idle' | 'started' | 'failed'

/**
 * "내일의 스포트라이트" 예고 — 이름·아이콘은 숨기고 카테고리와 열리는 시각만 보여 준다.
 * 버튼은 매일 00:00 UTC에 반복되는 .ics 일정을 내려받게 한다(사이트는 알림 권한을 요청하지 않는다).
 * 클라이언트 전용·하이드레이션 안전: 마운트 전에는 렌더하지 않는다.
 * 남은 시간 카운트다운은 같은 DailyDock의 "Next daily"와 겹쳐서 두지 않는다. 매초 틱 대신
 * 다음 UTC 자정에 한 번만 날짜를 갱신한다.
 */
export function SpotlightTeaser() {
  const { slug: currentSlug } = useGameNav()
  const [today, setToday] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  useEffect(() => {
    setToday(todayUTC())
  }, [])

  useEffect(() => {
    if (!today) return
    const timerId = setTimeout(
      () => setToday(todayUTC()),
      msUntilNextUTCDay(Date.now()) + ROLLOVER_MARGIN_MILLISECONDS,
    )
    return () => clearTimeout(timerId)
  }, [today])

  const tomorrowDate = useMemo(() => (today ? nextDayUTC(today) : null), [today])
  const spotlightSlug = useMemo(() => (tomorrowDate ? spotlightFor(tomorrowDate) : null), [tomorrowDate])

  useEffect(() => {
    if (tomorrowDate && spotlightSlug) markTeaserSeen(tomorrowDate)
  }, [tomorrowDate, spotlightSlug])

  if (!spotlightSlug) return null

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
    if (started) sendHit(currentSlug || 'site', 'spotlight_ics')
    setSaveStatus(started ? 'started' : 'failed')
  }

  return (
    <div
      data-testid="spotlight-teaser"
      className="w-full max-w-xs rounded-lg border border-dashed border-border bg-surface/60 px-3 py-1.5 text-left"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="select-none text-xl blur-[2px]">
          🎁
        </span>
        <div className="min-w-0 flex-1 text-xs">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-neon-amber">TOMORROW&apos;S SPOTLIGHT</p>
          <p className="text-fg-muted">
            <span className="font-semibold text-fg">??? · {category}</span> · opens 00:00 UTC
          </p>
        </div>
        <button
          type="button"
          onClick={saveReminder}
          data-testid="spotlight-ics"
          aria-label="Remind me when it opens (adds a daily calendar reminder)"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neon-cyan/50 bg-surface px-2 py-1 text-xs font-semibold text-neon-cyan transition-colors hover:bg-neon-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <span aria-hidden="true">🔔</span>
          <span>Remind me</span>
        </button>
      </div>
      {saveStatus !== 'idle' && (
        <p aria-live="polite" data-testid="spotlight-ics-status" className="mt-1 text-[11px] text-fg-muted">
          {saveStatus === 'started'
            ? 'Download started — open the file to add a daily 00:00 UTC reminder to your calendar.'
            : "Couldn't save the file in this browser."}
        </p>
      )}
    </div>
  )
}
