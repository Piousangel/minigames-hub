'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
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
      className="btn-press rounded-lg border border-border bg-surface/80 px-2.5 py-1.5 text-base hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
    </button>
  )
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {stats.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
          {headerExtra}
        </div>
        <div className="flex items-center gap-2">
          <MuteButton muted={muted} onToggle={onToggleMute} />
          <GameButton onClick={onNewGame} disabled={newGameDisabled}>
            {newGameLabel}
          </GameButton>
        </div>
      </div>
      {children}
      {hint && <p className="mt-3 text-center text-sm text-fg-muted">{hint}</p>}
    </div>
  )
}
