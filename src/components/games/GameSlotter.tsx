'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_CONFIG,
  cardProgress,
  createGame,
  mulberry32,
  place,
  tick,
  type SlotterState,
} from '@/lib/games/slotter/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const STEP_MS = 40 // master loop granularity
const TICK_INTERVAL_MS = 80 // fixed tick cadence, per engine spec (~3.6s deadline @ 45 ticks)
const MAX_CATCHUP = 8 // guard against spiral-of-death per step

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

function saveBest(storageKey: string, score: number): void {
  try {
    localStorage.setItem(storageKey, String(score))
  } catch {
    // ignore storage failures
  }
}

const SOUND: Record<'none' | 'spawn' | 'insert' | 'wrong' | 'timeout', SoundName | null> = {
  none: null,
  spawn: null,
  insert: 'match',
  wrong: 'error',
  timeout: 'lose',
}

function gapLabel(row: number[], index: number): string {
  if (row.length === 0) return 'Insert here'
  if (index === 0) return `Insert before ${row[0]}`
  if (index === row.length) return `Insert after ${row[row.length - 1]}`
  return `Insert between ${row[index - 1]} and ${row[index]}`
}

/** Urgency band for the approaching card, purely for color — same idea as ZeroHour's fuseBand. */
function urgencyBand(progress: number): 'safe' | 'warn' | 'danger' {
  return progress < 0.55 ? 'safe' : progress < 0.85 ? 'warn' : 'danger'
}

export function GameSlotter({ storageKey }: { storageKey: string }) {
  // SSR safety: build the game only on the client (decant/zerohour pattern).
  const [state, setState] = useState<SlotterState | null>(null)
  const [running, setRunning] = useState(false)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [focus, setFocus] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const nextTickAt = useRef(0)
  const prevOver = useRef(false)
  const gapRefs = useRef<(HTMLButtonElement | null)[]>([])

  const over = state?.over ?? false

  const start = useCallback(() => {
    const g = createGame(DEFAULT_CONFIG, freshSeed(), mulberry32(freshSeed()))
    setState(g)
    setNewBest(false)
    setFocus(0)
    prevOver.current = false
    nextTickAt.current = performance.now() + TICK_INTERVAL_MS
    setRunning(true)
  }, [])

  // Init + load best (client only).
  useEffect(() => {
    setBest(loadBest(storageKey))
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Master loop: single deadline-driven interval, catch-up capped (zerohour pattern).
  useEffect(() => {
    if (!running || over) return
    const id = setInterval(() => {
      const now = performance.now()
      setState((s) => {
        if (!s || s.over) return s
        let next = s
        let iterations = 0
        while (now >= nextTickAt.current && iterations < MAX_CATCHUP) {
          next = tick(next)
          if (next.lastEvent.type === 'timeout') play('lose')
          nextTickAt.current += TICK_INTERVAL_MS
          iterations++
          if (next.over) break
        }
        return next
      })
    }, STEP_MS)
    return () => clearInterval(id)
  }, [running, over, play])

  // Pause when tab is hidden so the deadline doesn't burn in the background.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setRunning(false)
      else if (state && !state.over) {
        nextTickAt.current = performance.now() + TICK_INTERVAL_MS
        setRunning(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Game-over effect: persist best + stats + sound (sound already fired for
  // timeout/wrong at the moment they happen; this just handles persistence).
  useEffect(() => {
    if (!state) return
    if (state.over && !prevOver.current) {
      setRunning(false)
      const beatBest = state.score > best
      if (beatBest) {
        setBest(state.score)
        saveBest(storageKey, state.score)
      }
      setNewBest(beatBest)
      if (beatBest) play('win')
      recordResult(storageKey.replace(/^best:/, ''), { won: false, bucket: state.streak })
    }
    prevOver.current = state.over
  }, [state, best, storageKey, play])

  // Keep the roving gap focus in range as the row grows/shrinks/resets.
  useEffect(() => {
    if (!state) return
    setFocus((f) => Math.min(f, state.row.length))
  }, [state])

  const placeAt = useCallback(
    (index: number) => {
      setState((s) => {
        if (!s) return s
        const next = place(s, index, Math.random)
        const sound = SOUND[next.lastEvent.type]
        if (sound) play(sound)
        return next
      })
      setFocus(index)
    },
    [play],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = state
      if (!s) return
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setFocus((f) => Math.max(0, f - 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setFocus((f) => Math.min(s.row.length, f + 1))
          break
        case 'Home':
          e.preventDefault()
          setFocus(0)
          break
        case 'End':
          e.preventDefault()
          setFocus(s.row.length)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (!s.over) placeAt(focus)
          break
        case 'r':
        case 'R':
          e.preventDefault()
          start()
          break
      }
    },
    [state, focus, placeAt, start],
  )

  // Keep DOM focus in sync with the roving index.
  useEffect(() => {
    if (!state) return
    gapRefs.current[focus]?.focus()
  }, [focus, state])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="slotter-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const progress = cardProgress(state)
  const band = urgencyBand(progress)
  const wrongIndex = state.lastEvent.type === 'wrong' ? state.lastEvent.index : null

  const hint = state.over
    ? 'Row broken — press Play again.'
    : 'Click the exact gap where the card belongs before it reaches the deadline.'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Streak', value: state.streak },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      onNewGame={() => start()}
      newGameLabel={state.over ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <div
        role="group"
        aria-label="Slotter row"
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-4"
        style={reduced ? undefined : { animation: 'sl-board-in .3s ease-out both' }}
        data-testid="slotter-board"
      >
        {/* Approach lane: the active card slides toward the deadline marker. */}
        <div className="mb-4">
          <div
            className="sl-lane relative h-14 w-full overflow-hidden rounded-lg border border-border bg-black/20"
            aria-hidden="true"
          >
            {/* Fixed deadline marker, static (never animated as a layout prop). */}
            <div className="absolute left-0 top-0 h-full w-1.5 bg-[var(--neon-red)]" />
            {state.card && (
              <div
                className="absolute inset-0"
                style={{
                  transform: `translateX(-${Math.min(100, Math.max(0, progress * 100))}%)`,
                  transition: reduced ? undefined : `transform ${STEP_MS}ms linear`,
                }}
              >
                <span
                  data-testid="slotter-card"
                  data-band={band}
                  className="sl-card absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-base font-extrabold tabular-nums"
                >
                  {state.card.value}
                </span>
              </div>
            )}
          </div>
          <p className="mt-1 flex items-center justify-between text-xs text-fg-muted">
            <span>Deadline</span>
            <span data-testid="slotter-remaining" className="tabular-nums">
              {state.card ? `${Math.max(0, state.card.remainingTicks)} ticks left` : '—'}
            </span>
          </p>
        </div>

        {/* Sorted row: gap buttons (row.length + 1) interleaved with slot values. */}
        <div className="flex flex-wrap items-center justify-center gap-1" aria-label="Row of inserted cards">
          {Array.from({ length: state.row.length + 1 }, (_, i) => i).map((gap) => {
            const isFocused = gap === focus
            const node = (
              <button
                key={`gap-${gap}`}
                ref={(el) => {
                  gapRefs.current[gap] = el
                }}
                type="button"
                data-testid="gap"
                aria-label={gapLabel(state.row, gap)}
                tabIndex={isFocused ? 0 : -1}
                onFocus={() => setFocus(gap)}
                onClick={() => placeAt(gap)}
                disabled={state.over}
                className={`sl-gap flex h-11 w-4 items-center justify-center rounded-full border border-dashed border-border/70 text-fg-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-40 ${
                  isFocused ? 'border-accent text-accent' : ''
                }`}
              >
                <span aria-hidden="true">┊</span>
              </button>
            )
            if (gap === state.row.length) return node
            const value = state.row[gap]
            const isWrong = wrongIndex === gap
            return (
              <div key={`pair-${gap}`} className="contents">
                {node}
                <span
                  data-testid="slot-value"
                  aria-hidden="true"
                  className="sl-slot flex h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums"
                  data-wrong={isWrong || undefined}
                  style={{
                    animation:
                      reduced || isWrong ? undefined : gap === state.row.length - 1 ? 'sl-drop .18s ease-out both' : undefined,
                  }}
                >
                  {value}
                </span>
              </div>
            )
          })}
        </div>

        <GameOverlay show={state.over} variant={newBest ? 'win' : 'lose'} title={newBest ? 'New best!' : 'Row broken!'} testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Streak <span className="font-bold text-accent">{state.streak}</span> · Best streak{' '}
              <span className="font-bold text-accent">{state.bestStreak}</span>
            </p>
            <p>
              Placed <span className="font-bold text-accent">{state.placed}</span>
            </p>
          </div>
          <GameButton onClick={() => start()}>Play again</GameButton>
        </GameOverlay>

        <style>{`
          @keyframes sl-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes sl-drop { from { opacity: .2; transform: translateY(-10px) } to { opacity: 1; transform: none } }
          .sl-card { background: linear-gradient(160deg,#3f3f46,#27272a); color: #fafafa; box-shadow: inset 0 0 10px rgba(0,0,0,.3); }
          .sl-card[data-band='warn'] { background: linear-gradient(160deg,#a16207,#854d0e); color:#fef9c3; }
          .sl-card[data-band='danger'] { background: linear-gradient(160deg,#b91c1c,#7f1d1d); color:#fee2e2; }
          .sl-slot { background: rgba(255,255,255,0.06); color: var(--fg, #e4e4e7); border: 1px solid rgba(255,255,255,0.08); }
          .sl-slot[data-wrong] { background: rgba(239,68,68,.25); border-color: rgba(239,68,68,.7); color: #fee2e2; }
        `}</style>
      </div>
    </GameShell>
  )
}
