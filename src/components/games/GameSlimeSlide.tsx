'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { OverlayScoreSubmit } from '@/components/game-shell/OverlayScoreSubmit'
import { ShareButtons } from '@/components/ShareButtons'
import { SlimeProto } from '@/components/SlimeProto'
import { todayUTC } from '@/lib/dailyDate'
import { sendHit } from '@/lib/hit'
import { DAILY_ATTEMPTS, attemptsLeft, bestOf, dailyDone, dailyNumber, shareText, stageIndexForDay, type Attempt } from '@/lib/games/slime/daily'
import { SLIME_STAGES } from '@/lib/games/slime/stages'
import { EN } from '@/lib/games/slime/strings'

const SLUG = 'slime-slide'
type Mode = 'daily' | 'practice'

const dayKey = (iso: string) => `slime:daily:${iso}`
function loadAttempts(iso: string): Attempt[] {
  try {
    const v = JSON.parse(localStorage.getItem(dayKey(iso)) ?? '[]')
    return Array.isArray(v) ? (v as Attempt[]).slice(0, DAILY_ATTEMPTS) : []
  } catch {
    return []
  }
}
function saveAttempts(iso: string, list: Attempt[]) {
  try {
    localStorage.setItem(dayKey(iso), JSON.stringify(list))
    const best = bestOf(list)?.score ?? 0
    const prev = Number(localStorage.getItem(`best:${SLUG}`) ?? 0)
    if (best > prev) localStorage.setItem(`best:${SLUG}`, String(best)) // 리더보드 제출용(최고 일일 점수)
  } catch {
    /* 저장소를 못 써도 판은 계속된다 */
  }
}

/** 말랑 미끄럼길: 일일(오늘의 스테이지 1개, 시도 3회, 최고점 제출·공유) / 연습(전체 스테이지 자유). */
export function GameSlimeSlide({ storageKey: _storageKey }: { storageKey?: string }) {
  void _storageKey
  const [day, setDay] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [attempts, setAttempts] = useState<Attempt[]>([])

  useEffect(() => {
    const d = todayUTC()
    setDay(d)
    setAttempts(loadAttempts(d))
    sendHit(SLUG, 'view')
  }, [])

  const onAttempt = useCallback(
    (a: { stageId: string; outcome: Attempt['outcome']; stars: number; score: number; hint: boolean }) => {
      if (mode !== 'daily' || !day) return
      setAttempts((prev) => {
        if (prev.length >= DAILY_ATTEMPTS) return prev
        const next = [...prev, { outcome: a.outcome, stars: a.stars, score: a.score, hint: a.hint }]
        saveAttempts(day, next)
        return next
      })
    },
    [mode, day],
  )

  const stageIdx = useMemo(() => (day ? stageIndexForDay(day, SLIME_STAGES.length) : 0), [day])
  const locked = mode === 'daily' && dailyDone(attempts)
  const best = bestOf(attempts)
  const left = attemptsLeft(attempts)
  const share = day ? shareText(day, attempts, '') : '' // 링크는 ShareButtons가 붙인다

  if (!day) return <div className="mx-auto h-[560px] w-full max-w-[390px]" aria-busy="true" />

  return (
    <div className="mx-auto w-full max-w-[390px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Mode" className="flex gap-1">
          {(['daily', 'practice'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                sendHit(SLUG, `mode_${m}`)
                setMode(m)
              }}
              className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${mode === m ? 'border-accent bg-accent/15 text-accent' : 'border-white/15 text-fg-muted'}`}
            >
              {m === 'daily' ? `Daily #${dailyNumber(day)}` : 'Practice'}
            </button>
          ))}
        </div>
        {mode === 'daily' && (
          <p className="text-sm text-fg-muted" aria-live="polite">
            {locked ? 'Done for today' : `${left} ${left === 1 ? 'try' : 'tries'} left`}
          </p>
        )}
      </div>

      <SlimeProto
        key={mode}
        text={EN}
        slug={SLUG}
        fixedStage={mode === 'daily' ? stageIdx : undefined}
        attemptsLocked={locked}
        onAttempt={onAttempt}
        devTools={false}
      />

      {mode === 'daily' && attempts.length > 0 && (
        <section className="mt-4 rounded-xl border border-white/15 bg-surface p-3 text-center" aria-label="Today's result">
          <p className="text-sm font-semibold">{best && best.score > 0 ? `Best today: ${best.score} pts ${'⭐'.repeat(best.stars)}` : 'No landing yet. Try again!'}</p>
          {(locked || (best && best.score > 0)) && (
            <div className="mt-2">
              <ShareButtons slug={SLUG} title="Slime Slide" text={share} />
            </div>
          )}
          <OverlayScoreSubmit slug={SLUG} show={!!best && best.score > 0} />
        </section>
      )}
    </div>
  )
}
