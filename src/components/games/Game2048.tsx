'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { move, newGame, type Direction, type GameState } from '@/lib/games/g2048/engine'
import type { Theme2048 } from '@/lib/games/g2048/themes'

const KEY_DIRS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

const TILE_STYLES: Record<number, string> = {
  0: 'bg-white/5',
  2: 'bg-amber-100 text-stone-800',
  4: 'bg-amber-200 text-stone-800',
  8: 'bg-orange-300 text-stone-900',
  16: 'bg-orange-400 text-white',
  32: 'bg-orange-500 text-white',
  64: 'bg-red-500 text-white',
  128: 'bg-yellow-400 text-stone-900',
  256: 'bg-yellow-500 text-stone-900',
  512: 'bg-yellow-600 text-white',
  1024: 'bg-amber-600 text-white',
  2048: 'bg-accent text-stone-900',
}

export function Game2048({ theme, storageKey }: { theme: Theme2048; storageKey: string }) {
  // SSR 불일치 방지: 초기 보드는 클라이언트에서만 생성
  const [state, setState] = useState<GameState | null>(null)
  const [best, setBest] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const restart = useCallback(() => setState(newGame(Math.random)), [])

  useEffect(() => {
    restart()
    setBest(Number(localStorage.getItem(storageKey) ?? 0))
  }, [restart, storageKey])

  useEffect(() => {
    if (state && state.score > best) {
      setBest(state.score)
      localStorage.setItem(storageKey, String(state.score))
    }
  }, [state, best, storageKey])

  const doMove = useCallback((dir: Direction) => {
    setState((s) => (s && !s.over ? move(s, dir, Math.random) : s))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  if (!state) {
    return <div className="mx-auto aspect-square w-full max-w-100 rounded-xl bg-surface" data-testid="board-loading" />
  }

  return (
    <div className="mx-auto w-full max-w-100 select-none">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-2 text-sm">
          <div className="rounded-lg bg-surface px-3 py-1.5">
            Score <span className="font-bold" data-testid="score">{state.score}</span>
          </div>
          <div className="rounded-lg bg-surface px-3 py-1.5">
            Best <span className="font-bold">{best}</span>
          </div>
        </div>
        <button onClick={restart} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-stone-900">
          New Game
        </button>
      </div>
      <div
        className="relative grid aspect-square grid-cols-4 gap-2 rounded-xl bg-surface p-2 touch-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="board"
      >
        {state.board.flat().map((v, i) => (
          <div
            key={i}
            data-testid={v > 0 ? 'tile' : 'cell'}
            className={`flex items-center justify-center rounded-lg text-2xl font-bold ${TILE_STYLES[v] ?? TILE_STYLES[2048]}`}
          >
            {v > 0 ? theme.tiles[v] ?? v : ''}
          </div>
        ))}
        {state.over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/80" data-testid="game-over">
            <p className="text-2xl font-bold">Game over</p>
            <button onClick={restart} className="rounded-lg bg-accent px-4 py-2 font-semibold text-stone-900">
              Try again
            </button>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-sm text-fg-muted">Arrow keys or swipe to move the tiles.</p>
    </div>
  )
}
