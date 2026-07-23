'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isSolved,
  levelCount,
  loadLevel,
  move,
  reset,
  tileAt,
  type Direction,
  type GameState,
  type TileKind,
} from '@/lib/games/sokoban/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
}

const bestKey = (storageKey: string, level: number) => `${storageKey}:lvl${level}`

function loadBest(storageKey: string, level: number): number | null {
  const raw = localStorage.getItem(bestKey(storageKey, level))
  const n = Number(raw)
  return raw !== null && Number.isFinite(n) && n > 0 ? n : null
}

interface Snapshot {
  boxes: string[]
  player: { row: number; col: number }
  moves: number
}

export function GameSokoban({ storageKey }: { storageKey: string }) {
  // SSR-safe: state is created on the client only.
  const [state, setState] = useState<GameState | null>(null)
  const [best, setBest] = useState<number | null>(null)
  const [solved, setSolved] = useState(false)
  const [solveSeen, setSolveSeen] = useState(false)
  const [nudge, setNudge] = useState<{ dir: Direction; key: number } | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const historyRef = useRef<Snapshot[]>([])
  const solvedRef = useRef(false)
  const nudgeSeq = useRef(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const commit = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const startLevel = useCallback(
    (index: number) => {
      historyRef.current = []
      solvedRef.current = false
      setSolved(false)
      setSolveSeen(false)
      setNudge(null)
      const s = loadLevel(index)
      commit(s)
      setBest(loadBest(storageKey, s.levelIndex))
    },
    [commit, storageKey],
  )

  // Initial mount — level 0.
  useEffect(() => {
    startLevel(0)
  }, [startLevel])

  const doMove = useCallback(
    (dir: Direction) => {
      const s = stateRef.current
      if (!s || solvedRef.current) return
      const next = move(s, dir)
      if (next === s) return // blocked — no state change, no history push

      historyRef.current.push({
        boxes: [...s.boxes],
        player: { ...s.player },
        moves: s.moves,
      })
      commit(next)

      // Nudge/step animation cue.
      nudgeSeq.current += 1
      if (!reducedRef.current) setNudge({ dir, key: nudgeSeq.current })

      // Did a box land on (or slide off) a target this step?
      let onTargetBefore = 0
      let onTargetAfter = 0
      for (const k of s.boxes) {
        const [r, c] = k.split(',').map(Number)
        if (s.targets[r][c]) onTargetBefore++
      }
      for (const k of next.boxes) {
        const [r, c] = k.split(',').map(Number)
        if (next.targets[r][c]) onTargetAfter++
      }

      if (isSolved(next)) {
        solvedRef.current = true
        setSolved(true)
        play('win')
        // 개인 기록: 클리어한 레벨 수 누적(소코반은 패배 없음 → 항상 승) → 스탯 패널이 읽는다.
        recordResult(storageKey.replace(/^best:/, ''), { won: true })
        const prevBest = loadBest(storageKey, next.levelIndex)
        if (prevBest === null || next.moves < prevBest) {
          localStorage.setItem(bestKey(storageKey, next.levelIndex), String(next.moves))
          setBest(next.moves)
        } else {
          setBest(prevBest)
        }
      } else if (onTargetAfter > onTargetBefore) {
        play('match') // a box just settled onto a target
      } else if (onTargetAfter < onTargetBefore) {
        play('flip') // a box slid off a target
      } else {
        play('move')
      }
    },
    [commit, play, reducedRef, storageKey],
  )

  const undo = useCallback(() => {
    const s = stateRef.current
    const snap = historyRef.current.pop()
    if (!s || !snap) return
    solvedRef.current = false
    setSolved(false)
    setSolveSeen(false)
    setNudge(null)
    commit({ ...s, boxes: new Set(snap.boxes), player: snap.player, moves: snap.moves })
    play('flip')
  }, [commit, play])

  const restartLevel = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    historyRef.current = []
    solvedRef.current = false
    setSolved(false)
    setSolveSeen(false)
    setNudge(null)
    commit(reset(s))
  }, [commit])

  const nextLevel = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    startLevel((s.levelIndex + 1) % levelCount)
  }, [startLevel])

  // Keyboard controls (guarded against typing targets).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        undo()
        return
      }
      const dir = KEY_DIRS[e.key]
      if (dir) {
        e.preventDefault()
        doMove(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doMove, undo])

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

  const hint =
    'Arrow keys / WASD or swipe to move the orb. Push every crate onto a glowing ring — it locks green. Z to undo.'

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="aspect-square w-full rounded-xl bg-surface p-2" data-testid="sokoban-loading" />
        <p className="mt-3 text-center text-sm text-fg-muted">{hint}</p>
      </div>
    )
  }

  const winOverlayVisible = solved && !solveSeen
  const isLastLevel = state.levelIndex === levelCount - 1
  const canUndo = historyRef.current.length > 0

  // The box just pushed sits one step beyond the player in the move direction.
  let pushedBox: { r: number; c: number } | null = null
  if (nudge) {
    const dv = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[nudge.dir]
    pushedBox = { r: state.player.row + dv[0], c: state.player.col + dv[1] }
  }

  return (
    <GameShell
      stats={[
        { label: 'Level', value: state.levelIndex + 1 },
        { label: 'Moves', value: state.moves, testId: 'moves' },
        { label: 'Best', value: best ?? 0 },
      ]}
      headerExtra={
        <div className="flex items-center gap-1.5">
          <label htmlFor="sokoban-level" className="text-fg-muted">
            Go
          </label>
          <select
            id="sokoban-level"
            value={state.levelIndex}
            onChange={(e) => startLevel(Number(e.target.value))}
            className="rounded-lg border border-border bg-surface/80 px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
            aria-label="Jump to level"
          >
            {Array.from({ length: levelCount }, (_, i) => (
              <option key={i} value={i}>
                Level {i + 1}
              </option>
            ))}
          </select>
        </div>
      }
      onNewGame={restartLevel}
      newGameLabel="Restart"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{keyframes}</style>
      <div
        className="anim-board-in relative w-full touch-none rounded-xl bg-surface p-2"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="sokoban-board"
      >
        <div
          className="grid w-full gap-px overflow-hidden rounded-lg"
          style={{ gridTemplateColumns: `repeat(${state.width}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: state.height }, (_, r) =>
            Array.from({ length: state.width }, (_, c) => {
              const kind = tileAt(state, r, c)
              const isPlayerCell = kind === 'player' || kind === 'player-on-target'
              const isBoxOnTarget = kind === 'box-on-target'
              const isPushedBox = kind === 'box' && pushedBox?.r === r && pushedBox?.c === c
              const nudgeClass =
                isPlayerCell && nudge
                  ? nudgeAnim(nudge.dir)
                  : isBoxOnTarget
                    ? 'sok-pop'
                    : isPushedBox && nudge
                      ? nudgeAnim(nudge.dir)
                      : ''
              return (
                <div
                  key={`${r}-${c}`}
                  data-testid="sokoban-cell"
                  data-kind={kind}
                  className={`relative flex aspect-square items-center justify-center text-lg leading-none sm:text-xl ${cellBg(kind)}`}
                >
                  {/* Target marker — a glowing amber ring, under any box/player. */}
                  {(kind === 'target' || isBoxOnTarget || kind === 'player-on-target') && (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute h-[44%] w-[44%] rounded-full ${
                        isBoxOnTarget || kind === 'player-on-target' ? '' : 'sok-glow'
                      }`}
                      style={{ border: '2px solid var(--neon-amber)', boxShadow: '0 0 8px var(--neon-amber)' }}
                    />
                  )}
                  {/* Wall — a beveled neon-slate block. */}
                  {kind === 'wall' && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-[6%] rounded-[3px]"
                      style={{
                        background: 'linear-gradient(to bottom, rgba(120,150,235,0.30), rgba(80,100,175,0.12))',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 1px rgba(130,150,235,0.4)',
                      }}
                    />
                  )}
                  {/* Box — a neon crate; turns green and pops when it locks onto a target. */}
                  {(kind === 'box' || isBoxOnTarget) && (
                    <span
                      key={isPushedBox ? nudge?.key ?? 0 : undefined}
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-[15%] rounded-[5px] ${
                        isBoxOnTarget ? 'sok-pop' : ''
                      } ${isPushedBox ? nudgeClass : ''}`}
                      style={{
                        background: isBoxOnTarget
                          ? 'color-mix(in srgb, var(--neon-green) 45%, transparent)'
                          : 'color-mix(in srgb, var(--neon-amber) 28%, transparent)',
                        border: `2px solid ${isBoxOnTarget ? 'var(--neon-green)' : 'var(--neon-amber)'}`,
                        boxShadow: isBoxOnTarget
                          ? '0 0 10px var(--neon-green), inset 0 0 6px rgba(52,227,155,0.5)'
                          : '0 0 6px var(--neon-amber), inset 0 0 5px rgba(251,191,36,0.4)',
                      }}
                    />
                  )}
                  {/* Player — a glowing neon orb (the site's "play" identity). */}
                  {isPlayerCell && (
                    <span
                      key={nudge?.key ?? 0}
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-[20%] rounded-full ${nudgeClass}`}
                      style={{
                        background:
                          'radial-gradient(circle at 40% 34%, #ffffff, var(--neon-cyan) 52%, rgba(34,211,238,0.18) 80%)',
                        boxShadow: '0 0 10px var(--neon-cyan), 0 0 3px #ffffff',
                      }}
                    />
                  )}
                </div>
              )
            }),
          )}
        </div>

        <GameOverlay
          show={winOverlayVisible}
          variant="win"
          title={isLastLevel ? 'All levels cleared!' : 'Level solved!'}
          testId="sokoban-win"
        >
          <p className="text-sm text-fg-muted">
            Solved in <span className="font-bold text-accent">{state.moves}</span> moves
            {best !== null && best === state.moves ? ' — new best!' : ''}
          </p>
          <div className="flex gap-2">
            {!isLastLevel && (
              <GameButton onClick={nextLevel} className="px-4 py-2">
                Next Level
              </GameButton>
            )}
            <GameButton variant="ghost" onClick={restartLevel} className="px-4 py-2">
              {isLastLevel ? 'Play again' : 'Replay'}
            </GameButton>
          </div>
        </GameOverlay>
      </div>

      {/* Controls: undo + on-screen D-pad for touch/mouse. */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <GameButton
          variant="ghost"
          onClick={undo}
          disabled={!canUndo || solved}
          className="px-4 py-2"
          aria-label="Undo last move"
        >
          ↩ Undo
        </GameButton>

        <div
          className="grid grid-cols-3 grid-rows-2 gap-1.5"
          role="group"
          aria-label="Direction pad"
          data-testid="sokoban-dpad"
        >
          <DpadButton dir="up" label="Move up" onPress={doMove} className="col-start-2 row-start-1">
            ▲
          </DpadButton>
          <DpadButton dir="left" label="Move left" onPress={doMove} className="col-start-1 row-start-2">
            ◀
          </DpadButton>
          <DpadButton dir="down" label="Move down" onPress={doMove} className="col-start-2 row-start-2">
            ▼
          </DpadButton>
          <DpadButton dir="right" label="Move right" onPress={doMove} className="col-start-3 row-start-2">
            ▶
          </DpadButton>
        </div>
      </div>
    </GameShell>
  )
}

function DpadButton({
  dir,
  label,
  onPress,
  className,
  children,
}: {
  dir: Direction
  label: string
  onPress: (d: Direction) => void
  className: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onPress(dir)}
      className={`btn-press flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface/80 text-sm text-fg hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${className}`}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}

function cellBg(kind: TileKind): string {
  // Walls now render their own beveled block; keep the cell base a faint floor
  // so the grid reads without competing with the neon pieces.
  return kind === 'wall' ? 'bg-white/[0.04]' : 'bg-white/[0.02]'
}

function nudgeAnim(dir: Direction): string {
  switch (dir) {
    case 'up':
      return 'sok-step-up'
    case 'down':
      return 'sok-step-down'
    case 'left':
      return 'sok-step-left'
    case 'right':
      return 'sok-step-right'
  }
}

// Component-scoped keyframes — no shared globals touched.
const keyframes = `
.sok-step-up { animation: sok-step-up 130ms ease-out; }
.sok-step-down { animation: sok-step-down 130ms ease-out; }
.sok-step-left { animation: sok-step-left 130ms ease-out; }
.sok-step-right { animation: sok-step-right 130ms ease-out; }
.sok-pop { animation: sok-pop 220ms ease-out; }
.sok-glow { animation: sok-glow 2.4s ease-in-out infinite; }
@keyframes sok-step-up { from { transform: translateY(35%); } to { transform: translateY(0); } }
@keyframes sok-step-down { from { transform: translateY(-35%); } to { transform: translateY(0); } }
@keyframes sok-step-left { from { transform: translateX(35%); } to { transform: translateX(0); } }
@keyframes sok-step-right { from { transform: translateX(-35%); } to { transform: translateX(0); } }
@keyframes sok-pop { 0% { transform: scale(1); } 45% { transform: scale(1.28); } 100% { transform: scale(1); } }
@keyframes sok-glow { 0%, 100% { opacity: 0.45; transform: scale(0.92); } 50% { opacity: 0.85; transform: scale(1.05); } }
@media (prefers-reduced-motion: reduce) {
  .sok-step-up, .sok-step-down, .sok-step-left, .sok-step-right, .sok-pop, .sok-glow { animation: none; }
}
`
