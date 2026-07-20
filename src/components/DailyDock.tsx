'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  currentStreak,
  formatCountdown,
  loadStreak,
  milestoneReached,
  msUntilNextUTCDay,
} from '@/lib/dailyStreak'
import { todayUTC } from '@/lib/dailyDate'
import { loadPlayedToday, QUEST_TARGET } from '@/lib/today'

/**
 * 게임 페이지 리턴 훅 — SEO·커뮤니티 유입은 홈이 아니라 개별 게임 페이지에 착지하는데
 * 그 페이지엔 재방문 장치가 없었다(팀 결정). 완주 직후(보드 아래, NextUp 인접)에 사이트
 * day-streak·오늘 퀘스트 진행·다음 데일리 카운트다운을 노출해 방문자를 재방문자로 전환한다.
 *
 * 기존 헬퍼만 조립(신규 로직 없음). 클라이언트 전용·하이드레이션 안전(준비 전 렌더 안 함).
 * above-the-fold를 밀지 않게 보드 아래에만 둔다.
 */
export function DailyDock() {
  const [ready, setReady] = useState(false)
  const [streak, setStreak] = useState(0)
  const [freezes, setFreezes] = useState(0)
  const [doneToday, setDoneToday] = useState(false)
  const [played, setPlayed] = useState(0)
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const today = todayUTC()
    const s = loadStreak('site:streak')
    setStreak(currentStreak(s, today))
    setFreezes(s?.freezes ?? 0)
    setDoneToday(s?.lastDate === today)
    setPlayed(loadPlayedToday(today).length)
    setReady(true)
  }, [])

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(msUntilNextUTCDay(Date.now())))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!ready) return null

  const done = Math.min(played, QUEST_TARGET)
  const questComplete = done >= QUEST_TARGET
  const milestone = milestoneReached(streak)

  return (
    <section
      aria-label="Your daily progress"
      className="mt-8 rounded-xl border border-border bg-surface/60 p-4"
      data-testid="daily-dock"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* 사이트 day-streak */}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-neon-amber">🔥 {streak}</span>
          <span className="text-xs text-fg-muted">day{streak === 1 ? '' : 's'}</span>
          {freezes > 0 && (
            <span
              className="rounded-full border border-neon-cyan/40 px-1.5 py-0.5 text-[10px] font-semibold text-neon-cyan"
              title="A freeze protects your streak if you miss a day"
            >
              ❄️ {freezes}
            </span>
          )}
        </div>

        {/* 오늘 퀘스트 진행 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-muted">Today</span>
          <span className="font-bold tabular-nums text-neon-cyan" data-testid="dock-quest">
            {done}/{QUEST_TARGET}
          </span>
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: QUEST_TARGET }, (_, i) => (
              <span
                key={i}
                className={`h-2 w-4 rounded-full ${i < done ? 'bg-neon-cyan' : 'bg-white/10'}`}
              />
            ))}
          </span>
        </div>

        {/* 다음 데일리 카운트다운 */}
        {countdown && (
          <div className="ml-auto flex items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-wide text-fg-muted">Next daily</span>
            <span className="tabular-nums font-bold text-neon-amber" data-testid="dock-countdown">
              {countdown}
            </span>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-fg-muted">
        {milestone
          ? `🎉 ${milestone}-day milestone! Come back tomorrow to keep it going.`
          : questComplete
            ? "Daily goal done — nice run. Come back tomorrow to keep your streak."
            : doneToday
              ? 'Streak safe for today. '
              : 'Play a daily game today to keep your streak alive. '}
        {!questComplete && !milestone && (
          <Link href="/daily" className="text-neon-cyan hover:underline">
            See today&apos;s daily games →
          </Link>
        )}
      </p>
    </section>
  )
}
