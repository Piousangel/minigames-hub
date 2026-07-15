'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CODE_LENGTH,
  MAX_GUESSES,
  NUM_COLORS,
  guessesRemaining,
  isValidGuess,
  newGame,
  submitGuess,
  type GameState,
  type Peg,
} from '@/lib/games/mastermind/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// Six neon pegs. `name` is spoken by screen readers so color is never the only
// signal; `hex`/`glow` drive the visual. Kept in-file so no shared file changes.
const COLORS: { name: string; hex: string; glow: string }[] = [
  { name: 'Cyan', hex: '#22d3ee', glow: 'rgba(34,211,238,0.7)' },
  { name: 'Magenta', hex: '#e879f9', glow: 'rgba(232,121,249,0.7)' },
  { name: 'Lime', hex: '#a3e635', glow: 'rgba(163,230,53,0.7)' },
  { name: 'Amber', hex: '#fbbf24', glow: 'rgba(251,191,36,0.7)' },
  { name: 'Rose', hex: '#fb7185', glow: 'rgba(251,113,133,0.7)' },
  { name: 'Violet', hex: '#a78bfa', glow: 'rgba(167,139,250,0.7)' },
]

function readWins(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { wins?: unknown }
    return Number.isFinite(parsed.wins) ? Number(parsed.wins) : 0
  } catch {
    return 0
  }
}

/** A single filled color peg (used in the working row and history rows). */
function ColorPeg({
  color,
  size,
  animate,
  onClick,
  label,
  testId,
}: {
  color: number
  size: string
  animate?: boolean
  onClick?: () => void
  label?: string
  testId?: string
}) {
  const c = COLORS[color]
  const style = {
    background: `radial-gradient(circle at 35% 30%, #ffffffcc, ${c.hex} 55%, ${c.hex})`,
    boxShadow: `0 0 10px ${c.glow}, inset 0 -2px 6px rgba(0,0,0,0.35)`,
  }
  const cls = `${size} rounded-full border border-white/25 ${animate ? 'mm-pop' : ''}`
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        data-testid={testId}
        className={`${cls} btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan`}
        style={style}
      />
    )
  }
  return <span role="img" aria-label={label ?? c.name} data-testid={testId} className={cls} style={style} />
}

/** An empty slot in the working row. */
function EmptySlot({ size }: { size: string }) {
  return (
    <span
      aria-label="Empty slot"
      className={`${size} rounded-full border-2 border-dashed border-white/20 bg-white/5`}
    />
  )
}

export function GameMastermind({ storageKey }: { storageKey: string }) {
  // SSR-safe: the secret is rng-generated on the client only.
  const [state, setState] = useState<GameState | null>(null)
  const [draft, setDraft] = useState<Peg[]>([])
  const [wins, setWins] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const commit = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const restart = useCallback(() => {
    setDraft([])
    commit(newGame(Math.random))
  }, [commit])

  useEffect(() => {
    restart()
    setWins(readWins(storageKey))
  }, [restart, storageKey])

  const recordWin = useCallback(() => {
    setWins((prev) => {
      const next = prev + 1
      try {
        localStorage.setItem(storageKey, JSON.stringify({ wins: next }))
      } catch {
        /* storage may be unavailable; keep in-memory count */
      }
      return next
    })
  }, [storageKey])

  const addPeg = useCallback(
    (color: Peg) => {
      const s = stateRef.current
      if (!s || s.status !== 'playing') return
      setDraft((cur) => {
        if (cur.length >= CODE_LENGTH) return cur
        play('flip')
        return [...cur, color]
      })
    },
    [play],
  )

  const removePeg = useCallback(
    (index: number) => {
      const s = stateRef.current
      if (!s || s.status !== 'playing') return
      play('move')
      setDraft((cur) => cur.filter((_, i) => i !== index))
    },
    [play],
  )

  const handleSubmit = useCallback(() => {
    const s = stateRef.current
    if (!s || s.status !== 'playing') return
    if (!isValidGuess(draft)) {
      play('error')
      return
    }
    const next = submitGuess(s, draft)
    commit(next)
    setDraft([])
    if (next.status === 'won') {
      play('win')
      recordWin()
    } else if (next.status === 'lost') {
      play('lose')
    } else {
      play('move')
    }
  }, [draft, play, commit, recordWin])

  const hint = 'Pick 4 pegs, then Guess. ● right color & spot, ○ right color, wrong spot.'

  if (!state) {
    return (
      <GameShell
        stats={[{ label: 'Wins', value: wins }]}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="mx-auto h-80 w-full max-w-[22rem] rounded-xl bg-surface" data-testid="mastermind-loading" />
      </GameShell>
    )
  }

  const gameOver = state.status !== 'playing'
  const remaining = guessesRemaining(state)
  const canSubmit = state.status === 'playing' && draft.length === CODE_LENGTH

  return (
    <GameShell
      stats={[
        { label: 'Wins', value: wins },
        { label: 'Left', value: remaining, testId: 'mastermind-remaining' },
      ]}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-[24rem]"
    >
      {/* Component-scoped keyframes only. Reduced-motion users get no animation
          because the class is gated on reducedRef when we add it. */}
      <style>{`
        @keyframes mm-pop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes mm-reveal { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .mm-pop { animation: mm-pop 220ms ease-out both; }
        .mm-reveal { animation: mm-reveal 260ms ease-out both; }
      `}</style>

      <div className="relative">
        <div
          className="anim-board-in rounded-xl border border-border bg-surface/60 p-3"
          data-testid="mastermind-board"
        >
          {/* History — most recent at the bottom, like the classic board. */}
          <ol className="flex flex-col gap-2" data-testid="mastermind-history">
            {state.guesses.map((g, gi) => (
              <li
                key={gi}
                className="flex items-center justify-between gap-3 rounded-lg bg-bg/40 px-3 py-2"
                data-testid="mastermind-guess-row"
              >
                <div className="flex gap-2">
                  {g.pegs.map((c, pi) => (
                    <ColorPeg key={pi} color={c} size="h-7 w-7" label={COLORS[c].name} />
                  ))}
                </div>
                <FeedbackPegs
                  black={g.black}
                  white={g.white}
                  reveal={!reducedRef.current && gi === state.guesses.length - 1}
                />
              </li>
            ))}
          </ol>

          {/* Working row (hidden once the game is over). */}
          {!gameOver && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-white/15 px-3 py-2">
              <div className="flex gap-2" data-testid="mastermind-draft">
                {Array.from({ length: CODE_LENGTH }, (_, i) =>
                  i < draft.length ? (
                    <ColorPeg
                      key={i}
                      color={draft[i]}
                      size="h-8 w-8"
                      animate={!reducedRef.current}
                      onClick={() => removePeg(i)}
                      label={`${COLORS[draft[i]].name} peg, tap to remove`}
                      testId="mastermind-draft-peg"
                    />
                  ) : (
                    <EmptySlot key={i} size="h-8 w-8" />
                  ),
                )}
              </div>
              <GameButton
                onClick={handleSubmit}
                disabled={!canSubmit}
                data-testid="mastermind-submit"
                className="px-4 py-2"
              >
                Guess
              </GameButton>
            </div>
          )}

          {/* Palette */}
          <div className="mt-4 flex flex-wrap justify-center gap-2" data-testid="mastermind-palette">
            {Array.from({ length: NUM_COLORS }, (_, c) => (
              <ColorPeg
                key={c}
                color={c}
                size="h-9 w-9"
                onClick={() => addPeg(c)}
                label={`Add ${COLORS[c].name} peg`}
                testId={`mastermind-color-${c}`}
              />
            ))}
          </div>
        </div>

        <GameOverlay
          show={state.status === 'won'}
          variant="win"
          title="Code cracked!"
          testId="mastermind-win"
        >
          <p className="text-fg-muted">
            Solved in {state.guesses.length} {state.guesses.length === 1 ? 'guess' : 'guesses'}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>

        <GameOverlay
          show={state.status === 'lost'}
          variant="lose"
          title="Out of guesses"
          testId="mastermind-lose"
        >
          <div className="flex flex-col items-center gap-2">
            <p className="text-fg-muted">The code was</p>
            <div className="flex gap-2" data-testid="mastermind-reveal">
              {state.secret.map((c, i) => (
                <ColorPeg key={i} color={c} size="h-8 w-8" label={COLORS[c].name} />
              ))}
            </div>
          </div>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}

/** Black (exact) then white (color-only) feedback pegs, with a11y text. */
function FeedbackPegs({ black, white, reveal }: { black: number; white: number; reveal: boolean }) {
  const total = black + white
  const empty = CODE_LENGTH - total
  const label = `${black} exact, ${white} color-only`
  const anim = reveal ? 'mm-reveal' : ''
  return (
    <div
      className="grid grid-cols-2 grid-rows-2 gap-1"
      role="img"
      aria-label={label}
      data-testid="mastermind-feedback"
    >
      {Array.from({ length: black }, (_, i) => (
        <span
          key={`b${i}`}
          className={`h-3 w-3 rounded-full bg-white ${anim}`}
          style={{ boxShadow: '0 0 6px rgba(255,255,255,0.8)' }}
        />
      ))}
      {Array.from({ length: white }, (_, i) => (
        <span key={`w${i}`} className={`h-3 w-3 rounded-full border-2 border-white/70 ${anim}`} />
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <span key={`e${i}`} className="h-3 w-3 rounded-full border border-white/10" />
      ))}
    </div>
  )
}
