'use client'

import { useEffect, useState } from 'react'
import { GameCard } from '@/components/GameCard'
import { SpotlightReveal } from '@/components/SpotlightReveal'
import { spotlightFor } from '@/lib/spotlight'
import type { BrowseItem } from '@/components/GameBrowser'
import {
  currentStreak,
  formatCountdown,
  loadStreak,
  milestoneReached,
  msUntilNextUTCDay,
  nextMilestone,
} from '@/lib/dailyStreak'
import { useTodayUTC } from '@/lib/useTodayUTC'
import { loadPlayedToday, pickDailyPicks, QUEST_TARGET } from '@/lib/today'

/**
 * 홈 상단 "TODAY 보드" — 사이트 전역 재방문/체류 훅.
 *  - 🔥 N일 연속 방문(사이트 day-streak). 오늘 아직이면 "끊겨요" 경고(loss-aversion).
 *  - TODAY k/3 — 오늘 플레이한 distinct 게임 수 게이지.
 *  - 오늘의 픽 3 — 날짜 시드 결정론 추첨(결정비용 제거 + 롱테일 노출).
 *
 * 클라이언트 전용(localStorage). 하이드레이션 안전을 위해 준비 전엔 렌더하지 않는다.
 */
export function TodayBoard({ items }: { items: BrowseItem[] }) {
  const [ready, setReady] = useState(false)
  const [streak, setStreak] = useState(0)
  const [freezes, setFreezes] = useState(0)
  const [doneToday, setDoneToday] = useState(false)
  const [playedCount, setPlayedCount] = useState(0)
  const [picks, setPicks] = useState<string[]>([])
  const [countdown, setCountdown] = useState('')

  const today = useTodayUTC()

  // 탭을 열어 둔 채 UTC 자정을 넘기면 스트릭·퀘스트·오늘의 픽을 새 날짜로 다시 계산한다.
  useEffect(() => {
    if (!today) return
    const s = loadStreak('site:streak')
    setStreak(currentStreak(s, today))
    setFreezes(s?.freezes ?? 0)
    setDoneToday(s?.lastDate === today)
    setPlayedCount(loadPlayedToday(today).length)
    // 스포트라이트와 같은 게임이 "오늘의 픽"에 또 나오지 않게 뺀다.
    const spotlightSlug = spotlightFor(today)
    setPicks(pickDailyPicks(today, QUEST_TARGET, spotlightSlug ? [spotlightSlug] : []))
    setReady(true)
  }, [today])

  // '다음 데일리까지 HH:MM:SS' — 클라이언트 전용 초 단위 틱(하이드레이션 후에만).
  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(msUntilNextUTCDay(Date.now())))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!ready) return null

  const bySlug = new Map(items.map((it) => [it.slug, it]))
  const pickItems = picks.map((s) => bySlug.get(s)).filter((x): x is BrowseItem => Boolean(x))
  const done = Math.min(playedCount, QUEST_TARGET)
  const questComplete = done >= QUEST_TARGET
  const streakAtRisk = streak > 0 && !doneToday
  const milestone = milestoneReached(streak)
  const next = nextMilestone(streak)

  return (
    <section aria-labelledby="today" className="mb-12">
      <div className="mb-6 flex items-center gap-4">
        <h2 id="today" className="font-pixel neon-text text-sm text-neon-amber sm:text-base">
          Today
        </h2>
        <span
          aria-hidden="true"
          className="h-px flex-1 bg-gradient-to-r from-neon-amber/50 to-transparent"
        />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {/* 사이트 day-streak */}
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold text-neon-amber">🔥 {streak}</span>
            <span className="text-sm text-fg-muted">day{streak === 1 ? '' : 's'} in a row</span>
            {freezes > 0 && (
              <span
                className="ml-auto rounded-full border border-neon-cyan/40 bg-surface px-2 py-0.5 text-xs font-semibold text-neon-cyan"
                title="A freeze protects your streak if you miss a day"
              >
                ❄️ {freezes}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            {streak === 0
              ? 'Play any game today to start your streak.'
              : streakAtRisk
                ? freezes > 0
                  ? "Play today, or a freeze will save your streak."
                  : "Play today or your streak resets — don't break it."
                : 'Streak safe for today. Come back tomorrow to keep it going.'}
          </p>
          {milestone ? (
            <p className="mt-1 text-xs font-semibold text-neon-lime" data-testid="streak-milestone">
              🎉 {milestone}-day milestone! You&apos;re on fire.
            </p>
          ) : (
            next != null &&
            streak > 0 && (
              <p className="mt-1 text-xs text-fg-muted">
                {next - streak} day{next - streak === 1 ? '' : 's'} to your {next}-day badge.
              </p>
            )
          )}
          {doneToday && countdown && (
            <p className="mt-1 text-xs text-fg-muted">
              Next daily in{' '}
              <span className="tabular-nums text-neon-cyan" data-testid="daily-countdown">
                {countdown}
              </span>
              .
            </p>
          )}
        </div>

        {/* 오늘 3게임 퀘스트 */}
        <div className="rounded-xl border border-border bg-surface/60 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-fg">Today&apos;s challenge</span>
            <span className="font-bold tabular-nums text-neon-cyan" data-testid="today-quest">
              {done}/{QUEST_TARGET}
            </span>
          </div>
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: QUEST_TARGET }, (_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full ${i < done ? 'bg-neon-cyan' : 'bg-white/10'}`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-fg-muted">
            {questComplete ? 'Done! Three games today. Nice run.' : 'Play 3 different games today.'}
          </p>
        </div>
      </div>

      {/* 어제 예고한 스포트라이트 공개 */}
      <SpotlightReveal items={items} />

      {/* 오늘의 픽 */}
      {pickItems.length > 0 && (
        <>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Picks for today
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {pickItems.map((g) => (
              <GameCard key={g.slug} slug={g.slug} title={g.title} description={g.description} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
