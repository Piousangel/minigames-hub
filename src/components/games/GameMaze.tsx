'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canMove,
  hasWall,
  idx,
  move,
  newGame,
  SIZES,
  type Difficulty,
  type Direction,
  type MazeState,
} from '@/lib/games/maze/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  W: 'up',
  a: 'left',
  A: 'left',
  s: 'down',
  S: 'down',
  d: 'right',
  D: 'right',
}

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']
const DIFF_LABELS: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function bestKey(storageKey: string, diff: Difficulty): string {
  return `${storageKey}:${diff}:bestMs`
}

// 컴포넌트 스코프 keyframes — 전역 충돌을 피하려 고유 접두사(mz-) 사용.
const MAZE_STYLES = `
@keyframes mz-player-glow {
  0%, 100% { box-shadow: 0 0 6px 1px var(--accent, #fbbf24), 0 0 12px 2px rgba(251,191,36,0.4); }
  50% { box-shadow: 0 0 10px 2px var(--accent, #fbbf24), 0 0 20px 5px rgba(251,191,36,0.6); }
}
@keyframes mz-exit-pulse {
  0%, 100% { transform: scale(0.72); opacity: 0.75; }
  50% { transform: scale(0.92); opacity: 1; }
}
@keyframes mz-step {
  0% { transform: scale(0.82); }
  60% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
@keyframes mz-trail-in {
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: scale(1); }
}
`

function Chip({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 shadow-[inset_0_0_10px_rgba(140,140,200,0.08)]">
      <span className="text-fg-muted">{label}</span>{' '}
      <span data-testid={testId} className="neon-text inline-block font-bold text-accent">
        {value}
      </span>
    </div>
  )
}

export function GameMaze({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 미로는 클라이언트에서만 생성.
  const [state, setState] = useState<MazeState | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [bestMs, setBestMs] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [stepKey, setStepKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<MazeState | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const finalMsRef = useRef(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const commit = useCallback((s: MazeState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const readBest = useCallback(
    (diff: Difficulty) => {
      const raw = Number(localStorage.getItem(bestKey(storageKey, diff)))
      setBestMs(Number.isFinite(raw) && raw > 0 ? raw : null)
    },
    [storageKey],
  )

  const restart = useCallback(
    (diff: Difficulty) => {
      startedAtRef.current = null
      finalMsRef.current = 0
      setElapsed(0)
      commit(newGame(Math.random, SIZES[diff]))
      readBest(diff)
    },
    [commit, readBest],
  )

  // 최초 마운트 + 난이도 변경 시 새 미로.
  useEffect(() => {
    restart(difficulty)
  }, [difficulty, restart])

  // 타이머: 첫 이동 후 시작, 풀리면 정지.
  useEffect(() => {
    if (!state || state.solved || startedAtRef.current === null) return
    const id = window.setInterval(() => {
      if (startedAtRef.current !== null) setElapsed(Date.now() - startedAtRef.current)
    }, 250)
    return () => window.clearInterval(id)
  }, [state, state?.solved])

  const doMove = useCallback(
    (dir: Direction) => {
      const s = stateRef.current
      if (!s || s.solved) return
      if (!canMove(s, dir)) return
      if (startedAtRef.current === null) startedAtRef.current = Date.now()
      const next = move(s, dir)
      commit(next)
      setStepKey((k) => k + 1)

      if (next.solved) {
        const finalMs = startedAtRef.current !== null ? Date.now() - startedAtRef.current : 0
        finalMsRef.current = finalMs
        setElapsed(finalMs)
        play('win')
        const prev = Number(localStorage.getItem(bestKey(storageKey, difficulty)))
        if (!Number.isFinite(prev) || prev <= 0 || finalMs < prev) {
          localStorage.setItem(bestKey(storageKey, difficulty), String(finalMs))
          setBestMs(finalMs)
        }
      } else {
        play('move')
      }
    },
    [commit, difficulty, play, storageKey],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const dir = KEY_DIRS[e.key]
      if (dir) {
        e.preventDefault()
        doMove(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doMove])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const hint = 'Arrow keys / WASD, swipe, or the D-pad to reach the glowing exit.'

  const diffSelector = (disabled: boolean) => (
    <div className="mb-3 flex justify-center gap-2" role="group" aria-label="Difficulty">
      {DIFFS.map((d) => (
        <GameButton
          key={d}
          variant={d === difficulty ? 'accent' : 'ghost'}
          aria-pressed={d === difficulty}
          disabled={disabled}
          onClick={() => setDifficulty(d)}
          className="px-3 py-1.5"
        >
          {DIFF_LABELS[d]}
        </GameButton>
      ))}
    </div>
  )

  if (!state) {
    return (
      <GameShell
        stats={[{ label: 'Moves', value: 0, testId: 'moves', float: true }]}
        headerExtra={
          <>
            <Chip label="Time" value="0:00" testId="time" />
            <Chip label="Best" value="—" testId="best" />
          </>
        }
        onNewGame={() => restart(difficulty)}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        {diffSelector(true)}
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="maze-loading" />
      </GameShell>
    )
  }

  const { size, player, exit, start, visited, solved } = state

  return (
    <GameShell
      stats={[{ label: 'Moves', value: state.moves, testId: 'moves', float: true }]}
      headerExtra={
        <>
          <Chip label="Time" value={formatTime(elapsed)} testId="time" />
          <Chip label="Best" value={bestMs !== null ? formatTime(bestMs) : '—'} testId="best" />
        </>
      }
      onNewGame={() => restart(difficulty)}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{MAZE_STYLES}</style>
      {diffSelector(false)}

      <div
        className="anim-board-in relative grid aspect-square w-full touch-none rounded-xl bg-surface p-2"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="maze-board"
        role="grid"
        aria-label={`Maze, ${size} by ${size}`}
      >
        {Array.from({ length: size * size }, (_, i) => {
          const row = Math.floor(i / size)
          const col = i % size
          const isPlayer = player.row === row && player.col === col
          const isExit = exit.row === row && exit.col === col
          const isStart = start.row === row && start.col === col
          const isTrail = visited[idx(size, row, col)] && !isPlayer && !isStart

          // 벽선(네온 시안). 벽이 있는 방향에만 테두리.
          const wallColor = 'rgba(103,232,249,0.55)'
          const bw = '2px'
          const style: React.CSSProperties = {
            borderTop: hasWall(state, row, col, 'up') ? `${bw} solid ${wallColor}` : `${bw} solid transparent`,
            borderRight: hasWall(state, row, col, 'right') ? `${bw} solid ${wallColor}` : `${bw} solid transparent`,
            borderBottom: hasWall(state, row, col, 'down') ? `${bw} solid ${wallColor}` : `${bw} solid transparent`,
            borderLeft: hasWall(state, row, col, 'left') ? `${bw} solid ${wallColor}` : `${bw} solid transparent`,
          }

          return (
            <div key={i} className="relative flex items-center justify-center" style={style}>
              {isTrail && (
                <span
                  aria-hidden="true"
                  className="absolute inset-[15%] rounded-[2px] bg-accent/15"
                  style={reduced ? undefined : { animation: 'mz-trail-in 180ms ease-out' }}
                />
              )}
              {isStart && !isPlayer && (
                <span aria-hidden="true" className="absolute inset-[28%] rounded-[2px] bg-accent/25" />
              )}
              {isExit && (
                <span
                  aria-hidden="true"
                  data-testid="maze-exit"
                  className="absolute inset-[8%] rounded-full bg-neon-green shadow-[0_0_10px_2px_rgba(74,222,128,0.6)]"
                  style={
                    reduced
                      ? { transform: 'scale(0.82)', opacity: 0.9 }
                      : { animation: 'mz-exit-pulse 1.4s ease-in-out infinite' }
                  }
                />
              )}
              {isPlayer && (
                <span
                  key={stepKey}
                  aria-hidden="true"
                  data-testid="maze-player"
                  className="absolute inset-[18%] z-[1] rounded-full bg-accent"
                  style={
                    reduced
                      ? { boxShadow: '0 0 6px 1px rgba(251,191,36,0.7)' }
                      : {
                          animation: `mz-step 220ms ease-out, mz-player-glow 1.6s ease-in-out infinite`,
                        }
                  }
                />
              )}
            </div>
          )
        })}

        <GameOverlay show={solved} variant="win" title="Solved!" testId="you-win">
          <p className="text-fg-muted">
            {state.moves} moves · {formatTime(finalMsRef.current)}
          </p>
          <GameButton onClick={() => restart(difficulty)} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>
      </div>

      {/* 모바일 D-pad */}
      <div className="mt-4 flex justify-center sm:hidden">
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Direction pad">
          <span />
          <GameButton variant="ghost" aria-label="Move up" onClick={() => doMove('up')} className="px-4 py-3 text-lg">
            ↑
          </GameButton>
          <span />
          <GameButton variant="ghost" aria-label="Move left" onClick={() => doMove('left')} className="px-4 py-3 text-lg">
            ←
          </GameButton>
          <GameButton variant="ghost" aria-label="Move down" onClick={() => doMove('down')} className="px-4 py-3 text-lg">
            ↓
          </GameButton>
          <GameButton variant="ghost" aria-label="Move right" onClick={() => doMove('right')} className="px-4 py-3 text-lg">
            →
          </GameButton>
        </div>
      </div>
    </GameShell>
  )
}
