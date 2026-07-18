'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  flagCount,
  MS_MINES,
  MS_SIZE,
  newMinesweeper,
  reveal,
  toggleFlag,
  type MsState,
} from '@/lib/games/minesweeper/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// Vivid, high-contrast number colors with a soft drop-shadow for depth.
const NUMBER_COLORS: Record<number, string> = {
  1: 'text-sky-400',
  2: 'text-emerald-400',
  3: 'text-rose-400',
  4: 'text-violet-400',
  5: 'text-amber-400',
  6: 'text-cyan-300',
  7: 'text-pink-300',
  8: 'text-stone-300',
}

// Flood-fill ripple: cells further from the click reveal slightly later.
const RIPPLE_STEP = 16 // ms per Manhattan step
const RIPPLE_CAP = 200 // ms

// 개인 베스트(클리어 시간, 낮을수록 좋음) 전용 키. 리더보드엔 넣지 않는다 —
// 리더보드는 "높을수록 좋은 정수" 규약이라 시간(낮을수록 좋음)과 맞지 않는다.
const MS_BEST_KEY = 'best:minesweeper:time'

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function GameMinesweeper() {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<MsState | null>(null)
  const [flagMode, setFlagMode] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [best, setBest] = useState<number | null>(null)
  const elapsedRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const runningRef = useRef(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  // Latest state read synchronously in handlers (avoids stale closures / double
  // side-effects from running sound inside a setState updater).
  const stateRef = useRef<MsState | null>(null)
  // Origin of the last reveal — drives the flood-fill ripple delay.
  const originRef = useRef<{ x: number; y: number } | null>(null)

  const commit = useCallback((s: MsState | null) => {
    stateRef.current = s
    setState(s)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    runningRef.current = false
  }, [])

  const startTimer = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    timerRef.current = window.setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
    }, 1000)
  }, [])

  const restart = useCallback(() => {
    originRef.current = null
    stopTimer()
    elapsedRef.current = 0
    setElapsed(0)
    commit(newMinesweeper())
    setFlagMode(false)
  }, [commit, stopTimer])

  useEffect(() => {
    restart()
    const raw = Number(localStorage.getItem(MS_BEST_KEY))
    setBest(Number.isFinite(raw) && raw > 0 ? raw : null)
    return () => stopTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCell = useCallback(
    (x: number, y: number, flag: boolean) => {
      const s = stateRef.current
      if (!s || s.over) return
      if (flag) {
        const next = toggleFlag(s, x, y)
        if (next === s) return
        play('flag')
        commit(next)
        return
      }
      const next = reveal(s, x, y, Math.random)
      if (next === s) return
      const wasFirstReveal = originRef.current === null
      originRef.current = { x, y }
      if (next.over) {
        stopTimer()
        if (next.won) {
          const t = elapsedRef.current
          setBest((prev) => {
            if (prev === null || t < prev) {
              try {
                localStorage.setItem(MS_BEST_KEY, String(t))
              } catch {
                /* ignore */
              }
              return t
            }
            return prev
          })
          play('win')
        } else {
          play('lose')
        }
      } else {
        if (wasFirstReveal) startTimer() // 첫 오픈에서 시계 시작
        play('move')
      }
      commit(next)
    },
    [commit, play, startTimer, stopTimer],
  )

  const flagToggle = (
    <button
      onClick={() => setFlagMode((f) => !f)}
      aria-pressed={flagMode}
      className={`btn-press rounded-lg px-3 py-1.5 text-sm font-semibold ${
        flagMode ? 'bg-accent text-stone-900 shadow-sm' : 'bg-surface text-fg hover:bg-white/10'
      }`}
    >
      🚩 Flag
    </button>
  )

  const headerChips = (
    <div className="flex items-center gap-2">
      <div className="rounded-lg bg-surface px-3 py-1.5 text-sm">
        Time{' '}
        <span className="font-bold tabular-nums" data-testid="ms-time">
          {fmtTime(elapsed)}
        </span>
      </div>
      <div className="rounded-lg bg-surface px-3 py-1.5 text-sm">
        Best{' '}
        <span className="font-bold tabular-nums" data-testid="ms-best">
          {best !== null ? fmtTime(best) : '—'}
        </span>
      </div>
      {flagToggle}
    </div>
  )

  const hint = 'Click to reveal. Right-click (or toggle 🚩 Flag) to mark a mine.'

  if (!state) {
    return (
      <GameShell
        stats={[{ label: 'Mines', value: MS_MINES, testId: 'mines-left' }]}
        headerExtra={headerChips}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="aspect-square rounded-xl bg-surface" data-testid="ms-loading" />
      </GameShell>
    )
  }

  const origin = originRef.current

  return (
    <GameShell
      stats={[{ label: 'Mines', value: MS_MINES - flagCount(state), testId: 'mines-left' }]}
      headerExtra={headerChips}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <div
        className="anim-board-in relative grid aspect-square gap-px rounded-xl bg-surface p-2"
        style={{ gridTemplateColumns: `repeat(${MS_SIZE}, minmax(0, 1fr))` }}
        data-testid="ms-board"
      >
        {state.grid.flatMap((row, y) =>
          row.map((cell, x) => {
            // A key that only changes when the cell's face changes, so the inner
            // span remounts (and re-runs its entrance animation) exactly once per
            // transition — on reveal or flag — and never on unrelated re-renders.
            const face = cell.revealed ? 'r' : cell.flagged ? 'f' : 'e'

            let content = ''
            let faceAnim = ''
            let faceStyle: React.CSSProperties | undefined
            if (cell.revealed) {
              content = cell.mine ? '💣' : cell.adjacent > 0 ? String(cell.adjacent) : ''
              if (content && !reducedRef.current) {
                faceAnim = 'anim-spawn [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]'
                const delay = origin
                  ? Math.min((Math.abs(x - origin.x) + Math.abs(y - origin.y)) * RIPPLE_STEP, RIPPLE_CAP)
                  : 0
                faceStyle = delay ? { animationDelay: `${delay}ms` } : undefined
              } else if (content) {
                faceAnim = '[text-shadow:0_1px_2px_rgba(0,0,0,0.5)]'
              }
            } else if (cell.flagged) {
              content = '🚩'
              if (!reducedRef.current) faceAnim = 'anim-pop'
            }

            return (
              <button
                key={`${x},${y}`}
                data-testid="ms-cell"
                data-revealed={cell.revealed}
                aria-label={`cell ${x + 1}, ${y + 1}`}
                onClick={() => handleCell(x, y, flagMode)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  handleCell(x, y, true)
                }}
                className={`btn-press flex aspect-square items-center justify-center rounded-[2px] text-sm font-bold ${
                  cell.revealed ? 'bg-white/10 shadow-inner' : 'bg-white/5 hover:bg-white/15'
                } ${NUMBER_COLORS[cell.adjacent] ?? ''}`}
              >
                <span key={face} className={faceAnim} style={faceStyle}>
                  {content}
                </span>
              </button>
            )
          }),
        )}
        <GameOverlay
          show={state.over}
          variant={state.won ? 'win' : 'lose'}
          title={state.won ? 'You win!' : 'Boom!'}
          testId="game-over"
        >
          <GameButton onClick={restart} className="px-4 py-2">
            {state.won ? 'Play again' : 'Try again'}
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
