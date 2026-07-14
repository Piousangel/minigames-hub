'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { move, newGame, SIZE, type Direction, type SlidingState } from '@/lib/games/sliding/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const GAP = 8 // px — matches the board's gap-2 background grid
const VALUES = Array.from({ length: SIZE * SIZE - 1 }, (_, i) => i + 1) // 1..15

const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

// Depth/color: cool-to-warm gradient so the number tiles read as a set while
// still being easy to scan individually. Correctly-placed tiles get a lift.
function tileFace(value: number, correct: boolean): string {
  const base = correct
    ? 'bg-accent text-stone-900 shadow-[0_0_16px_rgba(245,158,11,0.45)] ring-1 ring-white/40'
    : 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md ring-1 ring-white/10'
  return base
}

export function GameSliding({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 보드는 클라이언트에서만 생성
  const [state, setState] = useState<SlidingState | null>(null)
  const [best, setBest] = useState(0)
  const [cell, setCell] = useState(0)
  const [gen, setGen] = useState(0) // bumps on New Game to replay the entrance

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const boardInnerRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<SlidingState | null>(null)
  const solvedSeenRef = useRef(false)

  const commitState = useCallback((s: SlidingState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const restart = useCallback(() => {
    solvedSeenRef.current = false
    commitState(newGame(Math.random))
    setGen((g) => g + 1)
  }, [commitState])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? stored : 0)
  }, [restart, storageKey])

  // Persist Best = fewest moves to solve.
  useEffect(() => {
    if (!state?.solved) return
    if (best === 0 || state.moves < best) {
      setBest(state.moves)
      localStorage.setItem(storageKey, String(state.moves))
    }
  }, [state, best, storageKey])

  // Measure the tile layer so tiles can be positioned with px transforms.
  useLayoutEffect(() => {
    const el = boardInnerRef.current
    if (!el) return
    const measure = () => setCell(Math.max(0, (el.clientWidth - GAP * (SIZE - 1)) / SIZE))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [state !== null])

  const doMove = useCallback(
    (arg: number | Direction) => {
      const s = stateRef.current
      if (!s || s.solved) return
      const next = move(s, arg)
      if (next === s) return // illegal move — no-op
      play('move')
      commitState(next)
      if (next.solved && !solvedSeenRef.current) {
        solvedSeenRef.current = true
        play('win')
      }
    },
    [commitState, play],
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

  const hint = 'Click a tile next to the gap — or use arrow keys — to slide it. Order 1–15 to win.'

  if (!state) {
    return (
      <GameShell
        stats={[
          { label: 'Moves', value: 0, testId: 'moves' },
          { label: 'Best', value: best },
        ]}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="sliding-loading" />
      </GameShell>
    )
  }

  const empty = state.tiles.indexOf(0)
  const reduced = reducedRef.current

  return (
    <GameShell
      stats={[
        { label: 'Moves', value: state.moves, testId: 'moves' },
        { label: 'Best', value: best },
      ]}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <div
        className="anim-board-in relative aspect-square w-full touch-none rounded-xl bg-surface p-2"
        data-testid="sliding-board"
      >
        {/* Background grid — the empty slots (depth) */}
        <div className="grid h-full w-full grid-cols-4 gap-2">
          {Array.from({ length: SIZE * SIZE }, (_, i) => (
            <div key={i} className="rounded-lg bg-white/[0.04] shadow-inner" />
          ))}
        </div>

        {/* Tile layer — absolutely positioned, transform-animated */}
        <div ref={boardInnerRef} className="absolute inset-2">
          {VALUES.map((value) => {
            const index = state.tiles.indexOf(value)
            const row = Math.floor(index / SIZE)
            const col = index % SIZE
            const correct = index === value - 1
            // adjacency: same row & |col diff| 1, or same col & |row diff| 1
            const adjacent =
              (row === Math.floor(empty / SIZE) && Math.abs(col - (empty % SIZE)) === 1) ||
              (col === empty % SIZE && Math.abs(row - Math.floor(empty / SIZE)) === 1)
            const clickable = !state.solved && adjacent
            return (
              <button
                key={value}
                type="button"
                aria-label={`Tile ${value}${correct ? ', in place' : ''}`}
                disabled={!clickable}
                onClick={() => doMove(value)}
                className={`${reduced ? '' : 'tile-slide'} absolute left-0 top-0 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                style={{
                  width: cell,
                  height: cell,
                  transform: `translate(${col * (cell + GAP)}px, ${row * (cell + GAP)}px)`,
                  visibility: cell > 0 ? 'visible' : 'hidden',
                }}
              >
                <div
                  key={`${gen}`}
                  className={`anim-spawn flex h-full w-full items-center justify-center rounded-lg text-2xl font-bold tabular-nums transition-[filter] ${tileFace(value, correct)} ${clickable ? 'hover:brightness-110' : ''}`}
                  style={{ animationDelay: reduced ? undefined : `${index * 22}ms` }}
                >
                  {value}
                </div>
              </button>
            )
          })}
        </div>

        <GameOverlay show={state.solved} variant="win" title="Solved!" testId="you-win">
          <p className="text-fg-muted">
            Finished in <span className="font-bold text-fg">{state.moves}</span> moves
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
