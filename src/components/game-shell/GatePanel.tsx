'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import type { GatePhase } from '@/lib/useGameGate'

/**
 * 시작 게이트 · 일시정지 · 재개 카운트다운을 보드 위 한 겹으로 보여 준다(리뉴얼 R1).
 * 보드(relative) 안에 넣는다. running이면 아무것도 그리지 않는다.
 *
 * - ready: 조작 1줄 + Play 버튼. 패널 빈 곳을 눌러도 시작한다(1탭).
 *   `passThrough`면(flappy) 패널이 입력을 가로채지 않고 안내만 띄운다 — 첫 탭이 곧 날갯짓.
 * - paused: Resume 버튼 + 'P to resume'. 탭 숨김으로 멈췄을 때도 같은 패널(자동 재개 없음).
 * - countdown: 숫자만(색에 의존하지 않음), aria-live로 읽힌다. 입력은 막지 않는다(⏸는 그대로).
 */
export function GatePanel({
  phase,
  count,
  onStart,
  onResume,
  title = 'Tap to play',
  hint,
  passThrough = false,
  showButton = true,
}: {
  phase: GatePhase
  count: number
  onStart: () => void
  onResume: () => void
  title?: string
  hint?: ReactNode
  passThrough?: boolean
  /** passThrough일 때도 Play 버튼을 둔다(버튼만 입력을 받는다). */
  showButton?: boolean
}) {
  // 일시정지되면 Resume에 포커스(스크롤 없이) — 키보드로 ⏸를 누른 사람이 body로 떨어지지 않게(구현 리뷰 4).
  const resumeRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (phase === 'paused') resumeRef.current?.focus({ preventScroll: true })
  }, [phase])

  if (phase === 'running') return null

  if (phase === 'countdown') {
    return (
      <div
        data-testid="gate-countdown"
        aria-live="polite"
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      >
        <span className="neon-text-strong text-6xl font-extrabold tabular-nums text-accent drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
          {count > 0 ? count : ''}
        </span>
      </div>
    )
  }

  const paused = phase === 'paused'
  const primary = paused ? onResume : onStart

  return (
    <div
      data-testid={paused ? 'gate-paused' : 'gate-ready'}
      role={paused ? 'dialog' : undefined}
      aria-live={paused ? 'polite' : undefined}
      aria-label={paused ? 'Paused' : title}
      onClick={passThrough && !paused ? undefined : primary}
      className={`anim-backdrop-in absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl p-4 text-center ${
        passThrough && !paused ? 'pointer-events-none bg-bg/45' : 'cursor-pointer bg-bg/60'
      }`}
    >
      <p className="neon-text-strong text-2xl font-extrabold tracking-tight text-fg">{paused ? 'Paused' : title}</p>
      {hint && <p className="max-w-64 text-sm text-fg-muted">{hint}</p>}
      {(paused || !passThrough || showButton) && (
        <button
          type="button"
          ref={paused ? resumeRef : undefined}
          data-testid={paused ? 'gate-resume' : 'gate-start'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation()
            primary()
          }}
          className="btn-press pointer-events-auto min-h-11 min-w-28 rounded-lg bg-accent px-5 py-2 text-base font-bold text-stone-900 shadow-[0_0_14px_rgba(251,191,36,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {paused ? '▶ Resume' : '▶ Play'}
        </button>
      )}
      {paused && <p className="text-xs text-fg-muted">Press P to resume</p>}
    </div>
  )
}

/**
 * 일시정지 버튼(44px). GameShell `headerActions`에 넣는다 — 보드 모서리는 390px에서 스크롤 띠(12%)와 겹쳐
 * 스크롤하다 잘못 눌리므로 쓰지 않는다(R1 독립 리뷰 7). 헤더 버튼은 클릭 뒤 포커스를 남기지 않는다.
 * 대기(ready)·일시정지·게임오버에서는 보이지 않지만 자리는 유지한다.
 */
export function PauseButton({ phase, onPause, show = true }: { phase: GatePhase; onPause: () => void; show?: boolean }) {
  // 자리는 항상 차지한다(visibility만 숨김) — 첫 탭에 버튼이 생기며 헤더가 줄바꿈되어 보드가 손가락 밑에서
  // 밀려 내려가는 레이아웃 이동을 막는다(390px flappy 실측 44→76px).
  const active = show && (phase === 'running' || phase === 'countdown')
  return (
    <button
      type="button"
      data-testid={active ? 'gate-pause' : undefined}
      aria-label="Pause (P)"
      aria-hidden={active ? undefined : true}
      tabIndex={active ? undefined : -1}
      disabled={!active}
      title="Pause (P)"
      onClick={onPause}
      className={`${active ? '' : 'invisible '}btn-press flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface/80 px-2.5 py-1.5 text-base text-fg hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg`}
    >
      <span aria-hidden="true">⏸</span>
    </button>
  )
}
