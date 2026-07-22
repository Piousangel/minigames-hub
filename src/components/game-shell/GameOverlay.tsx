'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Confetti } from './Confetti'
import { useGameNav } from '@/components/GameNav'
import { nearestGoalHint } from '@/lib/achievements'

/**
 * Shared win/lose overlay: blurred backdrop, entrance animation, optional
 * confetti on win. Fills its positioned parent (`absolute inset-0`).
 *
 * `testId` and any accessibility wiring are supplied by the caller so existing
 * e2e selectors (`game-over`, `you-win`, …) are preserved per game.
 */
export function GameOverlay({
  show,
  variant,
  title,
  children,
  testId,
}: {
  show: boolean
  variant: 'win' | 'lose'
  title: string
  children?: ReactNode
  testId?: string
}) {
  // 게임오버 = 최고 이탈 지점. 여기에 '다음 게임'을 꽂아 세션을 이어붙인다(DOMAIN §2, 체류↑).
  // 훅은 early-return 전에 호출.
  const nav = useGameNav()
  // 게임오버 순간, 지금 바로 늘릴 수 있는 목표가 가깝다면 구체적 넛지("1 more win for Champion").
  const [goalHint, setGoalHint] = useState<{ text: string; icon: string } | null>(null)
  useEffect(() => {
    setGoalHint(show ? nearestGoalHint() : null)
  }, [show])
  if (!show) return null
  // 승/패에 따른 네온 색 — 컨테이너 currentColor 로 .neon-box 발광.
  const neon = variant === 'win' ? 'var(--neon-green)' : 'var(--neon-red)'
  // 세션 연속 플레이(RUN) 게임화: 손실회피로 "한 판 더"를 유도(방문당 플레이 수↑).
  const run = nav.runCount
  const runMilestone = run >= 3 && (run === 3 || run === 5 || run === 10 || run === 20 || run % 25 === 0)
  return (
    <div
      data-testid={testId}
      role="alertdialog"
      aria-label={title}
      className="anim-backdrop-in absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/75"
    >
      {/* 승리 + 세션 RUN 마일스톤에 축하 — 세션 길이 자체를 보상해 '한 판 더'를 강화(체류↑). */}
      {(variant === 'win' || runMilestone) && <Confetti active={show} />}
      <div
        style={{ color: neon }}
        className="neon-box anim-overlay-in flex flex-col items-center gap-4 rounded-2xl border border-current/40 bg-bg-2/85 px-8 py-6 text-center"
      >
        <p className="neon-text-strong text-3xl font-extrabold tracking-tight">
          {title}
        </p>
        <div className="flex flex-col items-center gap-3 text-fg">{children}</div>
        {/* 넛지: 목표가 가까우면 구체적으로(강한 동기), 아니면 세션 RUN. 한 줄만 — 클러터 방지. */}
        {goalHint ? (
          <p data-testid="overlay-goal-hint" className="text-sm font-semibold text-neon-amber">
            {goalHint.icon} {goalHint.text} — one more?
          </p>
        ) : (
          run > 1 && (
            <p
              data-testid="overlay-run"
              className={`text-sm font-semibold ${runMilestone ? 'text-neon-amber' : 'text-fg-muted'}`}
            >
              {runMilestone ? `🔥 ${run}-game run! Keep it going —` : `🔥 Run ×${run} · one more?`}
            </p>
          )
        )}
        {nav.nextSlug && nav.nextTitle && (
          <Link
            href={`/${nav.nextSlug}`}
            data-testid="overlay-next-game"
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-neon-lime/50 bg-surface px-4 py-2 text-sm font-semibold text-neon-lime transition-colors hover:bg-neon-lime/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-lime focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <span aria-hidden="true">▶</span>
            <span>Next: {nav.nextTitle}</span>
          </Link>
        )}
      </div>
    </div>
  )
}
