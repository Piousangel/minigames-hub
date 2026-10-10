'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  arm,
  mulberry32,
  newGame,
  step,
  tap,
  type BisectEvent,
  type BisectState,
  type Grade,
  type Rng,
} from '@/lib/games/bisect/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// UI-only timing constants (the engine itself never sees wall-clock time —
// only integer ticks). At 60 ticks/sec a tick lines up ~1:1 with a frame.
const TICKS_PER_SECOND = 60
const MS_PER_TICK = 1000 / TICKS_PER_SECOND
const MAX_DT_SEC = 0.05 // clamp huge dt spikes (tab-away, devtools pause)

const SOUND: Record<BisectEvent, SoundName | null> = {
  none: null,
  start: 'flip',
  end: 'flip',
  falseStart: 'error',
  timeout: 'error',
  perfect: 'match',
  good: 'move',
  ok: 'flip',
  miss: 'error',
  over: 'lose',
}

const GRADE_LABEL: Record<Grade, string> = {
  perfect: 'PERFECT',
  good: 'GOOD',
  ok: 'OK',
  miss: 'MISS',
}

const GRADE_COLOR: Record<Grade, string> = {
  perfect: 'var(--neon-lime)',
  good: 'var(--neon-cyan)',
  ok: 'var(--neon-amber)',
  miss: 'var(--neon-red)',
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const raw = Number(localStorage.getItem(storageKey))
    return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0
  } catch {
    return 0
  }
}

function saveBest(storageKey: string, score: number): void {
  try {
    localStorage.setItem(storageKey, String(score))
  } catch {
    // ignore storage failures (private mode / quota)
  }
}

function formatErrorMs(error: number | null): string {
  if (error === null) return 'Timed out'
  const ms = Math.round(error * MS_PER_TICK)
  if (ms === 0) return '±0ms'
  return ms > 0 ? `+${ms}ms` : `${ms}ms`
}

function hintFor(state: BisectState): string {
  switch (state.phase) {
    case 'idle':
      return 'Tap to begin.'
    case 'armed':
      return 'Wait for it…'
    case 'live':
      return 'Tap the exact halfway point between start and end.'
    case 'resolved':
      return 'Tap for next round.'
    case 'over':
      return 'Run ended — tap Play again.'
    default:
      return ''
  }
}

interface Flash {
  seq: number
  kind: 'start' | 'end'
}

export function GameBisect({ storageKey }: { storageKey: string }) {
  // SSR safety: the round (and its rng-derived tick targets) is generated
  // only on the client.
  const [state, setState] = useState<BisectState | null>(null)
  const [best, setBest] = useState(0)
  const [flash, setFlash] = useState<Flash | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<BisectState | null>(null)
  const rngRef = useRef<Rng>(mulberry32(1))
  const bestRef = useRef(0)
  const newBestRef = useRef(false)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)
  const tickAccumRef = useRef(0)
  const flashSeq = useRef(0)
  const overPersistedRef = useRef(false)

  const commit = useCallback((next: BisectState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const persist = useCallback(
    (score: number) => {
      newBestRef.current = score > bestRef.current
      if (newBestRef.current) {
        bestRef.current = score
        setBest(score)
      }
      saveBest(storageKey, Math.max(bestRef.current, score))
      recordResult(storageKey.replace(/^best:/, ''))
    },
    [storageKey],
  )

  const applyNext = useCallback(
    (next: BisectState) => {
      const prevPhase = stateRef.current?.phase
      commit(next)

      // Persist before deciding the game-over sound so newBestRef reflects
      // this run's outcome (over -> win/lose, matching the newBest title/variant).
      if (next.phase === 'over' && prevPhase !== 'over' && !overPersistedRef.current) {
        overPersistedRef.current = true
        persist(next.score)
      }
      if (next.phase !== 'over') overPersistedRef.current = false

      const sound = next.lastEvent === 'over' ? (newBestRef.current ? 'win' : 'lose') : SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastEvent === 'start' || next.lastEvent === 'end') {
        flashSeq.current += 1
        setFlash({ seq: flashSeq.current, kind: next.lastEvent })
      }
    },
    [commit, play, persist],
  )

  const frame = useCallback(
    (ts: number) => {
      const prev = stateRef.current
      if (!prev || (prev.phase !== 'armed' && prev.phase !== 'live')) {
        rafRef.current = 0
        return
      }
      const last = lastTsRef.current || ts
      lastTsRef.current = ts
      const dtSec = Math.min(Math.max((ts - last) / 1000, 0), MAX_DT_SEC)
      tickAccumRef.current += dtSec * TICKS_PER_SECOND
      const tick = Math.floor(tickAccumRef.current)
      applyNext(step(prev, tick))
      rafRef.current = requestAnimationFrame(frame)
    },
    [applyNext],
  )

  const startLoop = useCallback(() => {
    tickAccumRef.current = 0
    lastTsRef.current = 0
    if (rafRef.current === 0) rafRef.current = requestAnimationFrame(frame)
  }, [frame])

  const restart = useCallback(() => {
    applyNext(arm(newGame(), rngRef.current))
    startLoop()
  }, [applyNext, startLoop])

  const doAction = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    if (s.phase === 'idle' || s.phase === 'over') {
      restart()
    } else if (s.phase === 'armed' || s.phase === 'live') {
      const tick = Math.max(Math.floor(tickAccumRef.current), s.tick)
      applyNext(tap(s, tick))
    } else if (s.phase === 'resolved') {
      applyNext(arm(s, rngRef.current))
      startLoop()
    }
  }, [applyNext, restart, startLoop])

  // Init (client only, SSR-safe).
  useEffect(() => {
    const stored = loadBest(storageKey)
    bestRef.current = stored
    setBest(stored)
    rngRef.current = mulberry32(freshSeed())
    commit(newGame())
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Keyboard: unified Space/Enter action, R for a hard New Game.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault()
        doAction()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        restart()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [doAction, restart])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="bisect-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const phase = state.phase
  const ariaLabel =
    phase === 'idle'
      ? 'Bisect board, tap to begin'
      : phase === 'armed'
        ? 'Bisect board, waiting for the start signal'
        : phase === 'live'
          ? 'Bisect board, live — tap the halfway point'
          : phase === 'resolved'
            ? `Bisect board, round result: ${state.lastGrade ?? ''}`
            : 'Bisect board, run over'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Lives', value: state.lives },
        { label: 'Streak', value: state.streak },
      ]}
      onNewGame={restart}
      newGameLabel="New Game"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hintFor(state)}
      maxWidthClassName="max-w-100"
    >
      <div className="relative rounded-xl bg-surface p-4" data-testid="bisect-board">
        <div
          role="button"
          tabIndex={0}
          aria-label={ariaLabel}
          onClick={doAction}
          className="relative flex h-64 w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-bg-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {phase === 'idle' && (
            <p className="text-lg font-semibold text-fg-muted">Tap to begin</p>
          )}

          {phase === 'armed' && (
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full bg-fg-muted/50"
              style={reduced ? undefined : { animation: 'bs-pulse 1.1s ease-in-out infinite' }}
            />
          )}

          {phase === 'live' && (
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-fg-muted/20" />
          )}

          {phase === 'resolved' && state.lastGrade && (
            <div
              className="flex flex-col items-center gap-1"
              style={reduced ? undefined : { animation: 'bs-result-in .2s ease-out both' }}
            >
              <p
                className="neon-text-strong text-3xl font-extrabold tracking-tight"
                style={{ color: GRADE_COLOR[state.lastGrade] }}
                data-testid="bisect-grade"
              >
                {GRADE_LABEL[state.lastGrade]}
              </p>
              <p className="text-sm text-fg-muted" data-testid="bisect-error">
                {formatErrorMs(state.lastError)}
              </p>
            </div>
          )}

          {flash && phase === 'live' && (
            <span
              key={flash.seq}
              aria-hidden="true"
              onAnimationEnd={() => setFlash(null)}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span
                className="h-24 w-24 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${
                    flash.kind === 'start' ? 'var(--neon-cyan)' : 'var(--neon-magenta)'
                  } 0%, transparent 70%)`,
                  ...(reduced
                    ? { opacity: 0.9 }
                    : { animation: 'bs-flash .45s ease-out both' }),
                }}
              />
            </span>
          )}
        </div>

        <GameOverlay show={phase === 'over'} variant={newBestRef.current ? 'win' : 'lose'} title={newBestRef.current ? 'New best!' : "Time's up"} testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Rounds <span className="font-bold text-accent">{state.roundsPlayed}</span>
            </p>
            <p>
              Perfects <span className="font-bold text-accent">{state.perfects}</span>
            </p>
            <p>
              Best streak <span className="font-bold text-accent">{state.bestStreak}</span>
            </p>
          </div>
          <GameButton onClick={restart}>Play again</GameButton>
        </GameOverlay>

        <style>{`
          @keyframes bs-pulse {
            0%, 100% { opacity: .35; transform: scale(1); }
            50% { opacity: .9; transform: scale(1.4); }
          }
          @keyframes bs-flash {
            0% { opacity: 0; transform: scale(.4); }
            35% { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(1.6); }
          }
          @keyframes bs-result-in {
            from { opacity: 0; transform: translateY(6px) scale(.97); }
            to { opacity: 1; transform: none; }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
