'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clearMismatch, flip, newMemoryGame, type MemoryState } from '@/lib/games/memory/engine'

const MISMATCH_MS = 900

export function GameMemory({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<MemoryState | null>(null)
  const [best, setBest] = useState(0) // 최소 moves. 0 = 기록 없음
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setState(newMemoryGame(Math.random))
  }, [])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? stored : 0)
  }, [restart, storageKey])

  // 승리 시 최소 moves 기록 (업데이터 밖 persist)
  useEffect(() => {
    if (state?.won && (best === 0 || state.moves < best)) {
      setBest(state.moves)
      localStorage.setItem(storageKey, String(state.moves))
    }
  }, [state, best, storageKey])

  const handleFlip = useCallback((index: number) => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setState((s) => {
      if (!s) return s
      const base = s.faceUp.length >= 2 ? clearMismatch(s) : s
      return flip(base, index)
    })
  }, [])

  // 미스매치 자동 정리
  useEffect(() => {
    if (!state || state.faceUp.length < 2) return
    timer.current = setTimeout(() => setState((s) => (s ? clearMismatch(s) : s)), MISMATCH_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  const header = (moves: number) => (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex gap-2 text-sm">
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Moves <span className="font-bold" data-testid="moves">{moves}</span>
        </div>
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Best <span className="font-bold">{best > 0 ? best : '—'}</span>
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

  const hint = <p className="mt-3 text-center text-sm text-fg-muted">Flip two cards and find every matching pair.</p>

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        {header(0)}
        <div className="aspect-square rounded-xl bg-surface" data-testid="memory-loading" />
        {hint}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-100 select-none">
      {header(state.moves)}
      <div className="relative grid aspect-square grid-cols-4 gap-2 rounded-xl bg-surface p-2" data-testid="memory-board">
        {state.cards.map((card, i) => {
          const shown = card.matched || state.faceUp.includes(i)
          return (
            <button
              key={card.id}
              data-testid="memory-card"
              data-shown={shown}
              onClick={() => handleFlip(i)}
              className={`flex items-center justify-center rounded-lg text-3xl transition ${
                shown ? (card.matched ? 'bg-white/10 opacity-60' : 'bg-white/15') : 'bg-accent/20 hover:bg-accent/30'
              }`}
            >
              {shown ? card.emoji : '?'}
            </button>
          )
        })}
        {state.won && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/80"
            data-testid="game-over"
          >
            <p className="text-2xl font-bold">You win!</p>
            <p className="text-fg-muted">{state.moves} moves</p>
            <button onClick={restart} className="rounded-lg bg-accent px-4 py-2 font-semibold text-stone-900">
              Play again
            </button>
          </div>
        )}
      </div>
      {hint}
    </div>
  )
}
