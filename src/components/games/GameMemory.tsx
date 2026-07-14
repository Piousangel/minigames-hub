'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clearMismatch, flip, newMemoryGame, type MemoryState } from '@/lib/games/memory/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const MISMATCH_MS = 900

const countMatched = (s: MemoryState) => s.cards.reduce((n, c) => n + (c.matched ? 1 : 0), 0)

export function GameMemory({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<MemoryState | null>(null)
  const [best, setBest] = useState(0) // 최소 moves. 0 = 기록 없음
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  // Previous-state trackers used to derive sound cues from state transitions.
  const prevMatched = useRef(0)
  const prevMoves = useRef(0)
  const prevFaceUp = useRef(0)
  const prevWon = useRef(false)

  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    prevMatched.current = 0
    prevMoves.current = 0
    prevFaceUp.current = 0
    prevWon.current = false
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

  // Sound cues driven off state transitions (win > match > mismatch > flip).
  useEffect(() => {
    if (!state) return
    const matched = countMatched(state)
    const faceUp = state.faceUp.length
    if (state.won && !prevWon.current) play('win')
    else if (matched > prevMatched.current) play('match')
    else if (state.moves > prevMoves.current) play('mismatch')
    else if (faceUp === 1 && faceUp !== prevFaceUp.current) play('flip')
    prevMatched.current = matched
    prevMoves.current = state.moves
    prevFaceUp.current = faceUp
    prevWon.current = state.won
  }, [state, play])

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

  const stats = [{ label: 'Moves', value: state?.moves ?? 0, testId: 'moves' }]
  const bestChip = (
    <div className="rounded-lg bg-surface px-3 py-1.5 text-sm">
      Best <span className="font-bold">{best > 0 ? best : '—'}</span>
    </div>
  )
  const hint = 'Flip two cards and find every matching pair.'

  if (!state) {
    return (
      <GameShell
        stats={stats}
        headerExtra={bestChip}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="aspect-square rounded-xl bg-surface" data-testid="memory-loading" />
      </GameShell>
    )
  }

  const mismatched = state.faceUp.length === 2

  return (
    <GameShell
      stats={stats}
      headerExtra={bestChip}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <div
        className="anim-board-in relative grid aspect-square grid-cols-4 gap-2 rounded-xl bg-surface p-2"
        data-testid="memory-board"
      >
        {state.cards.map((card, i) => {
          const shown = card.matched || state.faceUp.includes(i)
          const shaking = mismatched && state.faceUp.includes(i)
          return (
            <button
              key={card.id}
              data-testid="memory-card"
              data-shown={shown}
              aria-label={shown ? card.emoji : 'face-down card'}
              onClick={() => handleFlip(i)}
              className={`memory-card relative aspect-square rounded-lg ${shaking ? 'anim-shake' : ''} ${
                card.matched ? 'anim-match' : ''
              }`}
            >
              <span className="memory-card-inner" data-flipped={shown}>
                <span className="memory-face memory-face-front bg-accent/20 text-2xl text-accent transition-colors hover:bg-accent/30">
                  ?
                </span>
                <span
                  className={`memory-face memory-face-back text-3xl ${
                    card.matched
                      ? 'bg-white/10 opacity-70 shadow-[0_0_14px_rgba(74,222,128,0.55)] ring-1 ring-green-400/40'
                      : 'bg-white/15'
                  }`}
                >
                  {card.emoji}
                </span>
              </span>
            </button>
          )
        })}
        <GameOverlay show={state.won} variant="win" title="You win!" testId="game-over">
          <p className="text-fg-muted">{state.moves} moves</p>
          <GameButton onClick={restart} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
