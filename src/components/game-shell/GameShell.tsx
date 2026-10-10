'use client'

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { GameButton } from './GameButton'

export interface StatSpec {
  label: string
  /** 대부분 숫자. Mahjong의 Time("mm:ss"), Yahtzee의 Turn("5/13")처럼 포맷된 문자열도
   * 허용한다 — 그런 항목엔 float을 절대 지정하지 말 것(델타 연산이 숫자 전제). */
  value: number | string
  /** data-testid applied to the value span (e.g. "score"). */
  testId?: string
  /** Show a floating "+N" when the value increases. Number values only. */
  float?: boolean
}

interface FloatItem {
  id: number
  delta: number
}

/** A single Score/Best-style stat that pulses on change and can float "+N". */
function Stat({ label, value, testId, float }: StatSpec) {
  const [pulseKey, setPulseKey] = useState(0)
  const [floats, setFloats] = useState<FloatItem[]>([])
  const prev = useRef(value)
  const seq = useRef(0)

  useEffect(() => {
    if (prev.current === value) return
    // 문자열 값은 델타 연산 대상이 아니다(포맷된 표시용) — pulse만 타고 float은 안 뜬다.
    const delta = typeof value === 'number' && typeof prev.current === 'number' ? value - prev.current : 0
    prev.current = value
    setPulseKey((k) => k + 1)
    if (float && delta > 0) {
      const id = ++seq.current
      setFloats((f) => [...f, { id, delta }])
    }
  }, [value, float])

  return (
    <div className="relative rounded-lg border border-border bg-surface/80 px-3 py-1.5 shadow-[inset_0_0_10px_rgba(140,140,200,0.08)]">
      <span className="text-fg-muted">{label}</span>{' '}
      <span
        key={pulseKey}
        data-testid={testId}
        className={`neon-text inline-block font-bold text-accent ${pulseKey > 0 ? 'anim-pulse' : ''}`}
      >
        {value}
      </span>
      {floats.map((f) => (
        <span
          key={f.id}
          aria-hidden="true"
          onAnimationEnd={() => setFloats((cur) => cur.filter((x) => x.id !== f.id))}
          className="anim-float pointer-events-none absolute -top-1 right-2 text-sm font-bold text-accent"
        >
          +{f.delta}
        </span>
      ))}
    </div>
  )
}

function MuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={muted}
      title={muted ? 'Unmute' : 'Mute'}
      className="btn-press min-h-11 min-w-11 rounded-lg border border-border bg-surface/80 px-2.5 py-1.5 text-base hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
    </button>
  )
}

function headerButton(e: MouseEvent<HTMLDivElement>): HTMLElement | null {
  const b = e.target instanceof Element ? e.target.closest('button') : null
  return b instanceof HTMLElement && e.currentTarget.contains(b) ? b : null
}

/**
 * Header controls must not keep focus after a mouse/touch click: games listen for
 * Space/Enter on window, and a focused New Game/Mute would swallow the next press
 * (re-activating the button instead of starting/resuming the run).
 * - mousedown preventDefault stops the click from moving focus at all (mouse, and touch's
 *   compat mousedown), so focus stays wherever the game had it;
 * - a pointer-initiated click (detail > 0) still blurs the button as a fallback for
 *   browsers that focus anyway. Keyboard activation (detail === 0) keeps focus, so
 *   Tab + Enter/Space work exactly as before.
 */
function preventPointerFocus(e: MouseEvent<HTMLDivElement>) {
  if (e.button === 0 && headerButton(e)) e.preventDefault()
}

function blurAfterPointerClick(e: MouseEvent<HTMLDivElement>) {
  if (e.detail > 0) headerButton(e)?.blur()
}

/**
 * Reusable game shell: standardized Score/Best header, mute toggle, New Game
 * button, hint line, and a board slot (`children`). Each game only fills the
 * board and passes its stats/handlers — the juice is inherited.
 */
export function GameShell({
  stats,
  headerExtra,
  onNewGame,
  newGameLabel = 'New Game',
  newGameDisabled = false,
  muted,
  onToggleMute,
  hint,
  children,
  maxWidthClassName = 'max-w-100',
}: {
  stats: StatSpec[]
  headerExtra?: ReactNode
  onNewGame: () => void
  newGameLabel?: string
  newGameDisabled?: boolean
  muted: boolean
  onToggleMute: () => void
  hint?: ReactNode
  children: ReactNode
  /** Override the container width (default matches the square boards). */
  maxWidthClassName?: string
}) {
  return (
    <div className={`mx-auto w-full ${maxWidthClassName} select-none`}>
      <div
        className="mb-3 flex items-center justify-between gap-2"
        onMouseDown={preventPointerFocus}
        onClick={blurAfterPointerClick}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {stats.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
          {headerExtra}
        </div>
        <div className="flex items-center gap-2">
          <MuteButton muted={muted} onToggle={onToggleMute} />
          <GameButton onClick={onNewGame} disabled={newGameDisabled} className="min-h-11">
            {newGameLabel}
          </GameButton>
        </div>
      </div>
      {children}
      {hint && <p className="mt-3 text-center text-sm text-fg-muted">{hint}</p>}
    </div>
  )
}
