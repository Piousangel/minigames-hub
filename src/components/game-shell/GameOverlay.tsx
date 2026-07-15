'use client'

import type { ReactNode } from 'react'
import { Confetti } from './Confetti'

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
  if (!show) return null
  // 승/패에 따른 네온 색 — 컨테이너 currentColor 로 .neon-box 발광.
  const neon = variant === 'win' ? 'var(--neon-green)' : 'var(--neon-red)'
  return (
    <div
      data-testid={testId}
      role="alertdialog"
      aria-label={title}
      className="anim-backdrop-in absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/75"
    >
      {variant === 'win' && <Confetti active={show} />}
      <div
        style={{ color: neon }}
        className="neon-box anim-overlay-in flex flex-col items-center gap-4 rounded-2xl border border-current/40 bg-bg-2/85 px-8 py-6 text-center"
      >
        <p className="neon-text-strong text-3xl font-extrabold tracking-tight">
          {title}
        </p>
        <div className="flex flex-col items-center gap-3 text-fg">{children}</div>
      </div>
    </div>
  )
}
