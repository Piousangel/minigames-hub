'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  newGame,
  nextNumber,
  submit,
  type NumberMemoryState,
} from '@/lib/games/numbermemory/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// Component-scoped keyframes — globals.css stays untouched.
const NM_STYLE = `
@keyframes nm-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@keyframes nm-flash-ok {
  0%   { box-shadow: inset 0 0 0 2px rgba(34,197,94,0); }
  30%  { box-shadow: inset 0 0 24px 3px rgba(34,197,94,0.55), inset 0 0 0 2px rgba(34,197,94,0.9); }
  100% { box-shadow: inset 0 0 0 2px rgba(34,197,94,0); }
}
.nm-flash-ok { animation: nm-flash-ok 0.5s ease-out; }
.nm-bar { transform-origin: left center; }
.nm-bar-run { animation: nm-shrink linear forwards; }`

// Show duration scales gently with the digit count (~1s + 0.3s/digit).
function showDurationMs(level: number): number {
  return Math.min(6000, 1000 + level * 300)
}

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function GameNumberMemory({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성.
  const [state, setState] = useState<NumberMemoryState | null>(null)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<'correct' | null>(null)
  const [showMs, setShowMs] = useState(1300)
  const [revealKey, setRevealKey] = useState(0)
  const [shakeKey, setShakeKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<NumberMemoryState | null>(null)
  const inputRef = useRef('')
  const bestRef = useRef(0)
  const bestBeforeRef = useRef(0)
  const timersRef = useRef<number[]>([])
  const boardRef = useRef<HTMLDivElement | null>(null)

  const commit = useCallback((s: NumberMemoryState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const setInputBoth = useCallback((v: string) => {
    inputRef.current = v
    setInput(v)
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
  }, [])

  const after = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms)
    timersRef.current.push(id)
  }, [])

  // show → (timer) → input: flash the number, run the countdown bar, then ask.
  const reveal = useCallback(
    (s: NumberMemoryState) => {
      commit(s) // phase 'show', number ready
      setInputBoth('')
      setFeedback(null)
      const ms = showDurationMs(s.level)
      setShowMs(ms)
      setRevealKey((k) => k + 1)
      play('flip')
      after(ms, () => {
        const cur = stateRef.current
        if (!cur || cur.over) return
        commit({ ...cur, phase: 'input' })
        boardRef.current?.focus()
      })
    },
    [after, commit, play, setInputBoth],
  )

  const start = useCallback(() => {
    clearTimers()
    setNewBest(false)
    bestBeforeRef.current = bestRef.current
    reveal(newGame(Math.random))
  }, [clearTimers, reveal])

  // Mount: prepare idle state + load best.
  useEffect(() => {
    const fresh: NumberMemoryState = { phase: 'idle', level: 1, number: '', reached: 0, over: false }
    commit(fresh)
    const stored = Number(localStorage.getItem(storageKey))
    const value = Number.isFinite(stored) && stored > 0 ? stored : 0
    bestRef.current = value
    bestBeforeRef.current = value
    setBest(value)
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doSubmit = useCallback(() => {
    const cur = stateRef.current
    if (!cur || cur.phase !== 'input' || cur.over) return
    const guess = inputRef.current
    if (guess.length === 0) return
    const next = submit(cur, guess)

    if (next.over) {
      clearTimers()
      commit(next)
      setShakeKey((k) => k + 1)
      recordResult(storageKey.replace(/^best:/, ''), { won: true })
      const isBest = next.reached > bestBeforeRef.current && next.reached > 0
      if (isBest) {
        bestRef.current = next.reached
        setBest(next.reached)
        localStorage.setItem(storageKey, String(next.reached))
        setNewBest(true)
        play('win')
      } else {
        play('error')
        after(140, () => play('lose'))
      }
      return
    }

    // Correct → advance a level. Live-update best, flash, then reveal the longer number.
    commit(next)
    setFeedback('correct')
    if (next.reached > bestRef.current) {
      bestRef.current = next.reached
      setBest(next.reached)
      localStorage.setItem(storageKey, String(next.reached))
    }
    play('merge')
    after(300, () => reveal(nextNumber(next, Math.random)))
  }, [after, clearTimers, commit, play, reveal, storageKey])

  const appendDigit = useCallback((d: string) => {
    const cur = stateRef.current
    if (!cur || cur.phase !== 'input') return
    if (inputRef.current.length >= cur.level) return
    setInputBoth(inputRef.current + d)
  }, [setInputBoth])

  const backspace = useCallback(() => {
    setInputBoth(inputRef.current.slice(0, -1))
  }, [setInputBoth])

  // Physical keyboard: guarded so real inputs elsewhere aren't double-handled.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current
      if (!s) return
      if (s.phase === 'idle' || s.over) {
        if ((e.key === 'Enter' || e.key === ' ') && !isTypingTarget(e.target)) {
          e.preventDefault()
          start()
        }
        return
      }
      if (s.phase !== 'input') return
      if (isTypingTarget(e.target)) return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        appendDigit(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        backspace()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        doSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [appendDigit, backspace, doSubmit, start])

  const phase = state?.phase ?? 'idle'
  const level = state?.level ?? 1
  const overOverlay = phase === 'over'

  const hint =
    phase === 'show'
      ? 'Memorize the number…'
      : phase === 'input'
        ? 'Type the number you saw, then press Enter.'
        : phase === 'over'
          ? 'Press Start to play again.'
          : 'Press Start — a number flashes, then type it from memory. It grows each level.'

  const popClass = reduced ? '' : 'anim-pop'
  const shakeClass = reduced ? '' : 'anim-shake'
  const flashClass = feedback === 'correct' && !reduced ? 'nm-flash-ok' : ''

  return (
    <GameShell
      stats={[
        { label: 'Level', value: level, testId: 'level', float: true },
        { label: 'Best', value: best },
      ]}
      onNewGame={start}
      newGameLabel={phase === 'idle' ? 'Start' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{NM_STYLE}</style>
      <div
        ref={boardRef}
        tabIndex={-1}
        data-testid="numbermemory-board"
        aria-label="Number Memory board"
        className={`anim-board-in relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface p-5 outline-none ${flashClass} ${
          phase === 'over' ? shakeClass : ''
        }`}
        key={`board-${shakeKey}`}
      >
        {phase === 'show' && (
          <div className="flex w-full flex-col items-center gap-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
              Remember this
            </span>
            <span
              key={`num-${revealKey}`}
              data-testid="numbermemory-number"
              className={`neon-text-strong break-all text-center text-5xl font-extrabold tabular-nums text-accent sm:text-6xl ${popClass}`}
            >
              {state?.number}
            </span>
            {/* Countdown bar — shrinks over the show window. */}
            <div className="h-2 w-full max-w-72 overflow-hidden rounded-full bg-bg-2">
              <div
                key={`bar-${revealKey}`}
                className="nm-bar nm-bar-run h-full rounded-full bg-accent"
                style={{ animationDuration: `${showMs}ms` }}
                aria-hidden="true"
              />
            </div>
          </div>
        )}

        {phase === 'input' && (
          <div className="flex w-full flex-col items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
              What was the number?
            </span>
            <div
              data-testid="numbermemory-input"
              role="textbox"
              aria-live="polite"
              aria-label={`Your answer: ${input || 'empty'} (${input.length} of ${level} digits)`}
              className="flex min-h-14 w-full max-w-72 items-center justify-center rounded-lg border border-border bg-bg-2 px-4 text-4xl font-extrabold tabular-nums text-fg"
            >
              {input === '' ? <span className="text-fg-muted/50">•••</span> : input}
            </div>

            {/* On-screen number pad for touch devices. */}
            <div className="grid w-full max-w-72 grid-cols-3 gap-2">
              {DIGIT_KEYS.map((d) => (
                <GameButton
                  key={d}
                  variant="ghost"
                  onClick={() => appendDigit(d)}
                  aria-label={`Digit ${d}`}
                  className="py-3 text-lg"
                >
                  {d}
                </GameButton>
              ))}
              <GameButton
                variant="ghost"
                onClick={backspace}
                aria-label="Delete last digit"
                className="py-3 text-lg"
              >
                ⌫
              </GameButton>
              <GameButton
                variant="ghost"
                onClick={() => appendDigit('0')}
                aria-label="Digit 0"
                className="py-3 text-lg"
              >
                0
              </GameButton>
              <GameButton
                onClick={doSubmit}
                disabled={input.length === 0}
                aria-label="Submit answer"
                className="py-3 text-lg"
              >
                ✓
              </GameButton>
            </div>
          </div>
        )}

        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-2xl font-extrabold tracking-tight text-fg">Number Memory</p>
            <p className="max-w-64 text-sm text-fg-muted">
              A number flashes, then you type it from memory. One more digit each level.
            </p>
            <GameButton onClick={start} className="px-5 py-2">
              Start
            </GameButton>
          </div>
        )}

        <GameOverlay
          show={overOverlay && newBest}
          variant="win"
          title={`New best! Level ${state?.reached ?? 0}`}
          testId="you-win"
        >
          <p className="text-sm text-fg-muted">
            The number was{' '}
            <span className="font-bold tabular-nums text-fg">{state?.number}</span>
          </p>
          <GameButton onClick={start} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>

        <GameOverlay
          show={overOverlay && !newBest}
          variant="lose"
          title={`Reached level ${state?.reached ?? 0}`}
          testId="game-over"
        >
          <p className="text-sm text-fg-muted">
            The number was{' '}
            <span className="font-bold tabular-nums text-fg">{state?.number}</span>
          </p>
          <GameButton onClick={start} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
