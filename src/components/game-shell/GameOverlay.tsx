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
  return (
    <div
      data-testid={testId}
      role="alertdialog"
      aria-label={title}
      className="anim-backdrop-in absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/70"
    >
      {variant === 'win' && <Confetti active={show} />}
      <div className="anim-overlay-in flex flex-col items-center gap-3">
        <p
          className={`text-3xl font-extrabold tracking-tight ${
            variant === 'win' ? 'text-accent' : 'text-fg'
          }`}
        >
          {title}
        </p>
        {children}
      </div>
    </div>
  )
}
