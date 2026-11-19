'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { OverlayScoreSubmit } from '@/components/game-shell/OverlayScoreSubmit'
import { ShareButtons } from '@/components/ShareButtons'
import { SlimeProto } from '@/components/SlimeProto'
import { todayLocal } from '@/lib/dailyDate'
import { sendHit, visitorId } from '@/lib/hit'
import {
  DAILY_ATTEMPTS,
  attemptsLeft,
  clearedCount,
  currentStage,
  dailyNumber,
  dailyOver,
  dailyTotal,
  emptyProgress,
  progressShareText,
  recordAttempt,
  slimeDayKey,
  slimeSubmitBody,
  stageState,
  type Attempt,
  type DailyProgress,
} from '@/lib/games/slime/daily'
import { SLIME_STAGES } from '@/lib/games/slime/stages'
import { slotName } from '@/lib/games/slime/theme'
import { SlimeJourney } from '@/components/games/SlimeJourney'
import { EN } from '@/lib/games/slime/strings'
import { trackVisit, type VisitTrigger } from '@/lib/games/slime/visits'
import { DailyResultSheet } from '@/components/daily/DailyResultSheet'
import { recordDoneInBrowser, type DailyResult } from '@/lib/daily/result'

const SLUG = 'slime-slide'
const TOTAL = SLIME_STAGES.length
type Mode = 'daily' | 'practice'
const NEXT_DELAY_MS = 3200 // 깬 뒤 다음 스테이지로 자동으로 넘어가기까지

const dayKey = slimeDayKey
function loadProgress(iso: string): DailyProgress {
  try {
    const v = JSON.parse(localStorage.getItem(dayKey(iso)) ?? 'null')
    if (Array.isArray(v) && v.length === TOTAL && v.every((l) => Array.isArray(l))) return (v as Attempt[][]).map((l) => l.slice(0, DAILY_ATTEMPTS))
  } catch {
    /* 깨진 저장값은 새로 시작 */
  }
  return emptyProgress(TOTAL)
}
function saveProgress(iso: string, p: DailyProgress) {
  try {
    localStorage.setItem(dayKey(iso), JSON.stringify(p))
    const total = dailyTotal(p)
    const prev = Number(localStorage.getItem(`best:${SLUG}`) ?? 0)
    if (total > prev) localStorage.setItem(`best:${SLUG}`, String(total)) // 리더보드 제출용(하루 합산 최고)
  } catch {
    /* 저장소를 못 써도 판은 계속된다 */
  }
}

/** 기기 단위 하루 1회 이벤트(시작·완료·재방문). 중복 방지는 visits.ts가 저장소로 한다. */
function fireVisit(iso: string, trigger: VisitTrigger) {
  try {
    for (const e of trackVisit(localStorage, iso, trigger)) sendHit(SLUG, e)
  } catch {
    /* 측정 실패가 판을 막지 않게 */
  }
}

/** 저장된 시도에서 끝에서부터 이어진 실패 횟수(깨면 0). */
/** 그 스테이지를 깬 시도 중 최고점의 선(고스트용). 구 데이터에는 선이 없다. */
const clearedLine = (list: Attempt[]): number[][] | null => {
  const won = list.filter((a) => a.outcome === 'nest' && a.line)
  return won.length ? (won.reduce((b, a) => (a.score > b.score ? a : b)).line ?? null) : null
}

const failStreakOf = (list: Attempt[]): number => {
  let n = 0
  for (let i = list.length - 1; i >= 0 && list[i].outcome !== 'nest'; i--) n++
  return n
}

/** 오늘 끝낸 하루의 결과(R5 DailyResult 입력). 일일 규칙·점수는 daily.ts 그대로 — 여기선 숫자만 옮긴다. */
const doneInput = (day: string, p: DailyProgress) => ({
  slug: SLUG,
  day, // 말랑의 '오늘' = 현지 날짜(todayLocal) — 완료 키도 같은 날짜(src/lib/daily/result.ts)
  primary: { label: 'points', value: dailyTotal(p) },
  secondary: { label: 'stages', value: `${clearedCount(p)}/${TOTAL}` },
})

/** 말랑 미끄럼길: 일일(1스테이지를 깨면 다음이 열린다, 스테이지당 3번, 하루 점수는 스테이지별 최고점 합) / 연습. */
export function GameSlimeSlide({ storageKey: _storageKey }: { storageKey?: string }) {
  void _storageKey
  const [day, setDay] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [progress, setProgress] = useState<DailyProgress>(() => emptyProgress(TOTAL))
  const [view, setView] = useState(0) // 지금 보드에 올라간 스테이지
  const [settled, setSettled] = useState(true) // 보드의 재생이 끝났는가(끝나기 전에는 다음 스테이지로 넘기지 않는다)
  const [practiceIdx, setPracticeIdx] = useState(0) // 연습 = 해금된 스테이지 중 하나(점수 반영 없음)
  const [daily, setDaily] = useState<DailyResult | null>(null) // 오늘 끝냈으면 결과(시트·완료 기록)
  const [sheetOpen, setSheetOpen] = useState(false)
  const finishedNow = useRef(false) // 이번 방문에 마지막 시도로 하루를 끝냈다(그때만 시트를 자동으로 올린다)

  useEffect(() => {
    const d = todayLocal()
    const p = loadProgress(d)
    setDay(d)
    setProgress(p)
    setView(currentStage(p) ?? 0)
    // 이미 끝낸 날(배포 전에 끝냈거나 다시 연 경우): 완료 기록을 채우고 결과만 준비한다(시트는 자동으로 올리지 않는다)
    if (dailyOver(p)) setDaily(recordDoneInBrowser(doneInput(d, p)))
    sendHit(SLUG, 'view')
    // 탭을 열어 둔 채 UTC 자정을 넘기면 어제 기록이 오늘 보드로 올라가지 않게, 다시 보일 때 날짜를 확인한다(엔지니어 검수)
    const onVis = () => {
      if (document.hidden) return
      const now = todayLocal()
      setDay((prev) => {
        if (prev === null || prev === now) return prev
        const np = loadProgress(now)
        setProgress(np)
        setView(currentStage(np) ?? 0)
        setDaily(dailyOver(np) ? recordDoneInBrowser(doneInput(now, np)) : null)
        setSheetOpen(false)
        return now
      })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const onAttempt = useCallback(
    (a: { stageId: string; outcome: Attempt['outcome']; stars: number; score: number; hint: boolean; line: number[][] }) => {
      if (mode !== 'daily' || !day) return
      setSettled(false)
      setProgress((prev) => {
        const next = recordAttempt(prev, view, { outcome: a.outcome, stars: a.stars, score: a.score, hint: a.hint, line: a.line })
        if (next !== prev) {
          saveProgress(day, next)
          fireVisit(day, 'start')
          if (dailyOver(next)) {
            fireVisit(day, 'complete') // 기록된 시도로 하루가 끝났다(이미 끝난 날은 recordAttempt가 prev를 돌려준다)
            finishedNow.current = true
          }
        }
        return next
      })
    },
    [mode, day, view],
  )

  // 깨면 3.2초 뒤 열린 다음 스테이지로 자동 이동
  const cur = currentStage(progress)
  useEffect(() => {
    if (mode !== 'daily' || !settled || cur === null || cur === view) return
    const id = window.setTimeout(() => {
      sendHit(SLUG, `unlock_s${cur + 1}`)
      setView(cur)
    }, NEXT_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [mode, cur, view, settled])

  const over = dailyOver(progress)

  // 하루를 끝낸 마지막 시도의 재생이 끝나면(settled): 완료 기록(R5) + 결과 시트
  useEffect(() => {
    if (mode !== 'daily') finishedNow.current = false // 재생 중 연습으로 바꿨다가 돌아와도 시트가 갑자기 뜨지 않게(버튼으로 연다)
    if (mode !== 'daily' || !day || !over || !settled || !finishedNow.current) return
    finishedNow.current = false
    setDaily(recordDoneInBrowser(doneInput(day, progress)))
    setSheetOpen(true)
  }, [mode, day, over, settled, progress])
  const state = stageState(progress, view)
  const locked = mode === 'daily' && state !== 'open'
  const total = dailyTotal(progress)
  const left = attemptsLeft(progress[view] ?? [])
  const share = day ? progressShareText(day, progress, '') : '' // 링크는 ShareButtons가 붙인다

  if (!day) return <div className="mx-auto h-[560px] w-full max-w-[480px]" aria-busy="true" />
  // 리더보드 검증 제출(서버 재생) — 진행 중 칸과 결과 시트가 같은 설정을 쓴다
  const submit = {
    score: total,
    key: `${SLUG}:${day}`,
    request: (name: string) => {
      const body = slimeSubmitBody(day, progress, name, visitorId())
      return body ? { url: '/api/slime/submit', body } : null
    },
  }

  return (
    <div className="mx-auto w-full max-w-[480px]">
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
                if (m === 'practice') {
                  const open = Math.min(TOTAL, progress.filter((_, i) => stageState(progress, i) !== 'locked').length || 1)
                  setPracticeIdx(Math.floor(Math.random() * open))
                }
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
            {over ? (clearedCount(progress) === TOTAL ? 'All stages cleared!' : 'Done for today') : `${left} ${left === 1 ? 'try' : 'tries'} left`}
          </p>
        )}
      </div>

      {mode === 'daily' && <SlimeJourney states={SLIME_STAGES.map((_, i) => stageState(progress, i))} current={view} names={SLIME_STAGES.map((_, i) => slotName(i))} />}

      <SlimeProto
        key={mode === 'daily' ? `daily-${view}` : `practice-${practiceIdx}`}
        text={EN}
        slug={SLUG}
        fixedStage={mode === 'daily' ? view : practiceIdx}
        attemptsLocked={locked}
        onAttempt={onAttempt}
        onRunEnd={() => setSettled(true)}
        memoryLine={mode === 'daily' && view > 0 ? clearedLine(progress[view - 1] ?? []) : null}
        initialFailStreak={mode === 'daily' ? failStreakOf(progress[view] ?? []) : 0}
        devTools={false}
      />

      {mode === 'daily' && (
        <section className="mt-4 rounded-xl border border-white/15 bg-surface p-3 text-center" aria-label="Today's result">
          <p className="text-sm font-semibold">
            {clearedCount(progress)}/{TOTAL} stages · {total} pts
          </p>
          {state === 'cleared' && cur !== null && cur !== view && <p className="mt-1 text-xs text-fg-muted">Stage {cur + 1} unlocks in a moment…</p>}
          {over && daily ? (
            // 하루를 끝냈다: 공유·리더보드 제출은 결과 시트 안(R5). 여기선 다시 여는 버튼만
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              data-testid="open-result-sheet"
              className="mt-2 min-h-11 rounded-full border-2 border-[#5b3a1e] bg-[#fff3dc] px-4 text-sm font-bold text-[#5b3a1e]"
            >
              Today’s result
            </button>
          ) : (
            <>
              {total > 0 && (
                <div className="mt-2">
                  <ShareButtons slug={SLUG} title="Slime Slide" text={share} />
                </div>
              )}
              <OverlayScoreSubmit slug={SLUG} show={total > 0} verified={submit} />
            </>
          )}
        </section>
      )}
      {daily && (
        <DailyResultSheet open={sheetOpen} onClose={() => setSheetOpen(false)} slug={SLUG} gameTitle="Slime Slide" result={daily} shareText={share} leaderboard>
          <OverlayScoreSubmit slug={SLUG} show={sheetOpen && total > 0} verified={submit} tone="garden" />
        </DailyResultSheet>
      )}
    </div>
  )
}
