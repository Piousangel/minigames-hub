'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { changeDir, GRID, newSnakeGame, tick, type Dir, type SnakeState } from '@/lib/games/snake/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'

const KEY_DIRS: Record<string, Dir> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

const TICK_MS = 130

export function GameSnake({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<SnakeState | null>(null)
  const [running, setRunning] = useState(false)
  const [best, setBest] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const restart = useCallback(() => {
    setState(newSnakeGame(Math.random))
    setRunning(false)
  }, [])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) ? stored : 0)
  }, [restart, storageKey])

  const over = state?.over ?? false

  useEffect(() => {
    if (!running || over) return
    const id = setInterval(() => setState((s) => (s && !s.over ? tick(s, Math.random) : s)), TICK_MS)
    return () => clearInterval(id)
  }, [running, over])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setRunning(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (state && state.score > best) {
      setBest(state.score)
      localStorage.setItem(storageKey, String(state.score))
    }
  }, [state, best, storageKey])

  const steer = useCallback((dir: Dir) => {
    setRunning(true)
    setState((s) => (s && !s.over ? changeDir(s, dir) : s))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const dir = KEY_DIRS[e.key]
      if (dir) {
        e.preventDefault()
        steer(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steer])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const header = (score: number) => (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex gap-2 text-sm">
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Score <span className="font-bold" data-testid="score">{score}</span>
        </div>
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Best <span className="font-bold">{best}</span>
        </div>
      </div>
      <button
        onClick={restart}
        disabled={!state}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-stone-900"
      >
        New Game
      </button>
    </div>
  )

  const hint = (
    <p className="mt-3 text-center text-sm text-fg-muted">Press an arrow key (or swipe) to start.</p>
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        {header(0)}
        <div className="aspect-square rounded-xl bg-surface" data-testid="snake-loading" />
        {hint}
      </div>
    )
  }

  const occupied = new Map<string, 'head' | 'body'>()
  state.snake.forEach((p, i) => occupied.set(`${p.x},${p.y}`, i === 0 ? 'head' : 'body'))

  return (
    <div className="mx-auto w-full max-w-100 select-none">
      {header(state.score)}
      <div
        className="relative grid aspect-square gap-px rounded-xl bg-surface p-2 touch-none"
        style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="snake-board"
      >
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const x = i % GRID
          const y = Math.floor(i / GRID)
          const kind = occupied.get(`${x},${y}`)
          const isFood = state.food.x === x && state.food.y === y
          return (
            <div
              key={i}
              className={
                kind === 'head'
                  ? 'rounded-[2px] bg-accent'
                  : kind === 'body'
                    ? 'rounded-[2px] bg-accent/70'
                    : isFood
                      ? 'rounded-full bg-red-500'
                      : 'rounded-[2px] bg-white/5'
              }
            />
          )
        })}
        {state.over && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/80"
            data-testid="game-over"
          >
            <p className="text-2xl font-bold">Game over</p>
            <p className="text-fg-muted">Score: {state.score}</p>
            <button onClick={restart} className="rounded-lg bg-accent px-4 py-2 font-semibold text-stone-900">
              Try again
            </button>
          </div>
        )}
      </div>
      {hint}
    </div>
  )
}
