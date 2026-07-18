'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  arm,
  average,
  newReactionGame,
  react,
  reset as resetGame,
  start,
  tooSoon,
  type Phase,
  type ReactionState,
} from '@/lib/games/reaction/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const PAD_CLASS: Record<Phase, string> = {
  idle: 'bg-surface text-fg',
  waiting: 'bg-red-500 text-white',
  ready: 'bg-green-500 text-stone-900',
  result: 'bg-surface text-fg',
  early: 'bg-red-600 text-white',
}

export function GameReaction({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<ReactionState | null>(null)
  const [best, setBest] = useState(0) // fastest ms (lower is better); 0 = none yet
  const [newBest, setNewBest] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<ReactionState | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const greenAtRef = useRef(0)
  const bestRef = useRef(0)

  const commit = useCallback((s: ReactionState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const clearPending = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const restart = useCallback(() => {
    clearPending()
    setNewBest(false)
    commit(resetGame())
  }, [clearPending, commit])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    const value = Number.isFinite(stored) && stored > 0 ? stored : 0
    bestRef.current = value
    setBest(value)
  }, [restart, storageKey])

  // Clean up any armed timer on unmount.
  useEffect(() => () => clearPending(), [clearPending])

  // idle / result / early → waiting (red), then arm green after a random delay.
  const beginWait = useCallback(() => {
    setNewBest(false)
    const s = start(stateRef.current ?? newReactionGame(), Math.random)
    commit(s)
    clearPending()
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      const cur = stateRef.current
      if (!cur || cur.phase !== 'waiting') return
      greenAtRef.current = performance.now() // timer starts the instant green shows
      commit(arm(cur))
      play('flip')
    }, s.delayMs)
  }, [clearPending, commit, play])

  // ready → result: measure elapsed time and fold in best/celebration.
  const doReact = useCallback(() => {
    const cur = stateRef.current
    if (!cur || cur.phase !== 'ready') return
    const elapsed = performance.now() - greenAtRef.current
    const next = react(cur, elapsed)
    commit(next)
    const ms = next.lastMs
    if (ms !== null && (bestRef.current === 0 || ms < bestRef.current)) {
      bestRef.current = ms
      setBest(ms)
      localStorage.setItem(storageKey, String(ms))
      setNewBest(true)
      play('win')
    } else {
      play('flip')
    }
  }, [commit, play, storageKey])

  // Single entry point for both pointer and keyboard activation.
  const activate = useCallback(() => {
    const cur = stateRef.current
    if (!cur) return
    if (cur.phase === 'waiting') {
      clearPending()
      commit(tooSoon(cur)) // clicked before green → fail this attempt
      play('error')
      return
    }
    if (cur.phase === 'ready') {
      doReact()
      return
    }
    beginWait() // idle / result / early → new attempt
  }, [beginWait, clearPending, commit, doReact, play])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        activate()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activate])

  const phase: Phase = state?.phase ?? 'idle'
  const last = state?.lastMs ?? 0
  const avg = state ? average(state.attempts) ?? 0 : 0
  const attemptCount = state?.attempts.length ?? 0

  const hint =
    phase === 'ready'
      ? 'Click now!'
      : phase === 'waiting'
        ? 'Wait for green — don’t click yet.'
        : 'Click the pad (or press Space) to start, then click the instant it turns green.'

  const transition = reduced ? '' : 'transition-colors duration-200'

  const renderPad = () => {
    switch (phase) {
      case 'waiting':
        return (
          <>
            <span className="text-2xl font-extrabold sm:text-3xl">Wait for green…</span>
            <span className="mt-1 text-sm opacity-80">Don’t click yet</span>
          </>
        )
      case 'ready':
        return <span className="text-4xl font-extrabold sm:text-5xl">Click!</span>
      case 'result':
        return (
          <>
            <span
              key={attemptCount}
              data-testid="reaction-ms"
              className={`text-4xl font-extrabold tabular-nums sm:text-6xl ${reduced ? '' : 'anim-pop'}`}
            >
              {last} ms
            </span>
            <span className="mt-2 text-sm text-fg-muted">Click to try again</span>
          </>
        )
      case 'early':
        return (
          <>
            <span className="text-3xl font-extrabold sm:text-4xl">Too soon!</span>
            <span className="mt-1 text-sm opacity-90">Click to retry</span>
          </>
        )
      default:
        return (
          <>
            <span className="text-3xl font-extrabold sm:text-4xl">Ready?</span>
            <span className="mt-2 text-sm text-fg-muted">Click to start</span>
          </>
        )
    }
  }

  return (
    <GameShell
      stats={[
        { label: 'Last', value: last },
        { label: 'Avg', value: avg },
        { label: 'Best', value: best },
      ]}
      onNewGame={restart}
      newGameLabel="Restart"
      newGameDisabled={!state}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <div className="anim-board-in relative">
        <button
          type="button"
          onClick={activate}
          data-testid="reaction-pad"
          aria-label={
            phase === 'ready'
              ? 'Green — click now'
              : phase === 'waiting'
                ? 'Wait for green'
                : 'Reaction pad — click to start'
          }
          className={`flex aspect-[4/3] w-full touch-manipulation select-none flex-col items-center justify-center rounded-xl ${PAD_CLASS[phase]} ${transition} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
        >
          {renderPad()}
        </button>

        <GameOverlay show={newBest && phase === 'result'} variant="win" title="New best!" testId="new-best">
          <p className="text-2xl font-extrabold tabular-nums text-fg">{last} ms</p>
          <GameButton onClick={beginWait} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
