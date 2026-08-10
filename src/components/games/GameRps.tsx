'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MOVES,
  play,
  type GameState,
  type Move,
  type Outcome,
} from '@/lib/games/rps/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const SUSPENSE_MS = 750

const EMOJI: Record<Move, string> = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
}
const LABEL: Record<Move, string> = {
  rock: 'Rock',
  paper: 'Paper',
  scissors: 'Scissors',
}

type Phase = 'idle' | 'suspense' | 'result'
type Target = 0 | 3 | 5 // 0 = endless

interface Stored {
  wins: number
  losses: number
  draws: number
}

function loadTallies(storageKey: string): Stored {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { wins: 0, losses: 0, draws: 0 }
    const parsed = JSON.parse(raw) as Partial<Stored>
    return {
      wins: Number(parsed.wins) || 0,
      losses: Number(parsed.losses) || 0,
      draws: Number(parsed.draws) || 0,
    }
  } catch {
    return { wins: 0, losses: 0, draws: 0 }
  }
}

const RESULT_TEXT: Record<Outcome, string> = {
  win: 'You win!',
  lose: 'You lose',
  draw: 'Draw',
}

export function GameRps({ storageKey }: { storageKey: string }) {
  // Engine state (all-time tallies + last round + streak). Client-only to avoid SSR mismatch.
  const [state, setState] = useState<GameState | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [pending, setPending] = useState<Move | null>(null) // player's current pick
  const [target, setTarget] = useState<Target>(0)
  const [match, setMatch] = useState({ p: 0, c: 0 }) // wins within the current match

  const { play: playSound, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  // Hydrate persisted tallies after mount.
  useEffect(() => {
    const t = loadTallies(storageKey)
    const s: GameState = { tallies: t, last: null, streak: 0 }
    stateRef.current = s
    setState(s)
  }, [storageKey])

  useEffect(() => () => clearTimer(), [clearTimer])

  const matchOver =
    target !== 0 && (match.p >= target || match.c >= target)

  const resolve = useCallback(
    (playerMove: Move) => {
      const base = stateRef.current
      if (!base) return
      const next = play(base, playerMove, Math.random)
      stateRef.current = next
      setState(next)
      setPhase('result')

      // Persist all-time tallies.
      localStorage.setItem(storageKey, JSON.stringify(next.tallies))

      const outcome = next.last!.outcome
      // Reveal tick, then the result sound.
      playSound('flip')
      if (outcome === 'win') playSound('win')
      else if (outcome === 'lose') playSound('lose')
      else playSound('match')
      recordResult(storageKey.replace(/^best:/, ''), { won: outcome === 'win' })

      setMatch((m) => ({
        p: m.p + (outcome === 'win' ? 1 : 0),
        c: m.c + (outcome === 'lose' ? 1 : 0),
      }))
    },
    [playSound, storageKey],
  )

  const pick = useCallback(
    (move: Move) => {
      if (phase === 'suspense') return
      if (matchOver) return
      clearTimer()
      setPending(move)
      playSound('move')

      if (reducedRef.current) {
        // No suspense animation — resolve immediately.
        resolve(move)
        return
      }
      setPhase('suspense')
      timer.current = setTimeout(() => {
        timer.current = null
        resolve(move)
      }, SUSPENSE_MS)
    },
    [phase, matchOver, clearTimer, playSound, reducedRef, resolve],
  )

  // Reset just the current match (keeps all-time tallies).
  const newMatch = useCallback(() => {
    clearTimer()
    setMatch({ p: 0, c: 0 })
    setPhase('idle')
    setPending(null)
    setState((s) => {
      const next: GameState = s
        ? { ...s, last: null, streak: 0 }
        : { tallies: { wins: 0, losses: 0, draws: 0 }, last: null, streak: 0 }
      stateRef.current = next
      return next
    })
  }, [clearTimer])

  const changeTarget = useCallback(
    (t: Target) => {
      setTarget(t)
      clearTimer()
      setMatch({ p: 0, c: 0 })
      setPhase('idle')
      setPending(null)
    },
    [clearTimer],
  )

  // During suspense, show a shaking placeholder that cycles for extra juice.
  const [shakeTick, setShakeTick] = useState(0)
  useEffect(() => {
    if (phase !== 'suspense' || reduced) return
    const id = setInterval(() => setShakeTick((n) => n + 1), 130)
    return () => clearInterval(id)
  }, [phase, reduced])

  const last = state?.last ?? null
  const outcome = phase === 'result' ? last?.outcome ?? null : null
  const totalRounds = state
    ? state.tallies.wins + state.tallies.losses + state.tallies.draws
    : 0

  // The computer emoji to display right now.
  const cycleMove = MOVES[shakeTick % MOVES.length]
  const computerDisplay: string =
    phase === 'suspense'
      ? reduced
        ? '❔'
        : EMOJI[cycleMove]
      : phase === 'result' && last
        ? EMOJI[last.computer]
        : '❔'

  const playerDisplay = pending ? EMOJI[pending] : '❔'

  const overlay = matchOver
    ? match.p >= (target || Infinity)
      ? { variant: 'win' as const, title: 'You won the match!', testId: 'match-win' }
      : { variant: 'lose' as const, title: 'Computer won the match', testId: 'match-lose' }
    : null

  const stats = [
    { label: 'Wins', value: state?.tallies.wins ?? 0, testId: 'wins' as const },
    { label: 'Losses', value: state?.tallies.losses ?? 0 },
    { label: 'Draw', value: state?.tallies.draws ?? 0 },
  ]

  const targetToggle = (
    <div
      className="flex overflow-hidden rounded-lg border border-border bg-surface/80 p-0.5"
      role="group"
      aria-label="Match length"
    >
      {([0, 3, 5] as const).map((t) => (
        <button
          key={t}
          onClick={() => changeTarget(t)}
          aria-pressed={target === t}
          className={`btn-press rounded-md px-2.5 py-1 text-sm font-semibold transition-colors ${
            target === t ? 'bg-accent text-stone-900' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {t === 0 ? 'Endless' : `First to ${t}`}
        </button>
      ))}
    </div>
  )

  const streak = state?.streak ?? 0

  const hint = matchOver
    ? 'Match complete — start a new match to play again.'
    : phase === 'suspense'
      ? 'Rock… Paper… Scissors…'
      : 'Pick your throw. Rock beats scissors, scissors beats paper, paper beats rock.'

  const resultColor =
    outcome === 'win'
      ? 'text-neon-green'
      : outcome === 'lose'
        ? 'text-neon-red'
        : 'text-fg'

  const choicesDisabled = phase === 'suspense' || matchOver || !state

  return (
    <GameShell
      stats={stats}
      headerExtra={targetToggle}
      onNewGame={newMatch}
      newGameLabel="New match"
      newGameDisabled={!state}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{RPS_KEYFRAMES}</style>
      <div
        data-testid="rps-board"
        className="anim-board-in relative mx-auto flex w-full max-w-100 flex-col gap-4 rounded-xl border border-border bg-surface/80 p-4"
      >
        {/* Match progress (only in first-to-N mode). */}
        {target !== 0 && (
          <div
            className="text-center text-sm font-semibold text-fg-muted"
            data-testid="rps-match"
          >
            You <span className="text-neon-green">{match.p}</span>
            {' — '}
            <span className="text-neon-red">{match.c}</span> Computer
            <span className="text-fg-muted"> · first to {target}</span>
          </div>
        )}

        {/* Hands arena */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Hand
            heading="You"
            emoji={playerDisplay}
            animate={!reduced && phase === 'result' ? 'rps-pop' : undefined}
            testId="rps-player-hand"
          />
          <div className="text-center text-xl font-black text-fg-muted">VS</div>
          <Hand
            heading="Computer"
            emoji={computerDisplay}
            animate={
              reduced
                ? undefined
                : phase === 'suspense'
                  ? 'rps-shake'
                  : phase === 'result'
                    ? 'rps-pop'
                    : undefined
            }
            testId="rps-computer-hand"
          />
        </div>

        {/* Result banner */}
        <div className="h-8 text-center" aria-live="polite">
          {outcome && (
            <span
              key={totalRounds}
              data-testid="rps-result"
              data-outcome={outcome}
              className={`inline-block text-2xl font-extrabold ${resultColor} ${
                reduced ? '' : 'rps-flash'
              }`}
            >
              {RESULT_TEXT[outcome]}
              {last && ` — ${LABEL[last.computer]}`}
            </span>
          )}
        </div>

        {/* Streak badge */}
        {streak >= 2 && !matchOver && (
          <div
            className="text-center text-sm font-bold text-accent"
            data-testid="rps-streak"
          >
            🔥 {streak} win streak
          </div>
        )}

        {/* Choice buttons */}
        <div className="grid grid-cols-3 gap-3" role="group" aria-label="Choose your throw">
          {MOVES.map((m) => {
            const isPick = pending === m && phase !== 'idle'
            return (
              <button
                key={m}
                type="button"
                data-testid="rps-choice"
                data-move={m}
                aria-label={LABEL[m]}
                disabled={choicesDisabled}
                onClick={() => pick(m)}
                className={`btn-press flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-4xl transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                  isPick
                    ? 'border-accent bg-accent/15 shadow-[0_0_18px_rgba(251,191,36,0.5)]'
                    : 'border-border bg-white/[0.04] enabled:hover:border-neon-cyan/60 enabled:hover:bg-white/[0.08]'
                }`}
              >
                <span aria-hidden="true">{EMOJI[m]}</span>
                <span className="text-xs font-semibold text-fg-muted">{LABEL[m]}</span>
              </button>
            )
          })}
        </div>

        {overlay && (
          <GameOverlay show variant={overlay.variant} title={overlay.title} testId={overlay.testId}>
            <p className="text-sm text-fg-muted" data-testid="rps-match-score">
              {match.p} — {match.c}
            </p>
            <GameButton onClick={newMatch} className="px-4 py-2">
              Play again
            </GameButton>
          </GameOverlay>
        )}
      </div>
    </GameShell>
  )
}

function Hand({
  heading,
  emoji,
  animate,
  testId,
}: {
  heading: string
  emoji: string
  animate?: string
  testId: string
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-fg-muted">{heading}</span>
      <div
        data-testid={testId}
        className="flex aspect-square w-full max-w-24 items-center justify-center rounded-2xl border border-border bg-bg-2/60 text-5xl"
      >
        <span
          // Re-key on emoji change so pop/shake restart per reveal.
          key={emoji + (animate ?? '')}
          aria-hidden="true"
          style={animate ? { animation: `${animate} 0.32s ease-out both` } : undefined}
          className="inline-block"
        >
          {emoji}
        </span>
      </div>
    </div>
  )
}

// Component-scoped keyframes (unique names avoid clobbering globals.css).
const RPS_KEYFRAMES = `
@keyframes rps-shake {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-6px) rotate(-8deg); }
  75% { transform: translateY(-6px) rotate(8deg); }
}
@keyframes rps-pop {
  0% { transform: scale(0.4); opacity: 0; }
  60% { transform: scale(1.18); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes rps-flash {
  0% { transform: scale(0.85); opacity: 0; }
  40% { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
`
