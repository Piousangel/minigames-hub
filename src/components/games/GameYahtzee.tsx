'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Category,
  type State,
  LOWER_CATEGORIES,
  MAX_ROLLS,
  UPPER_BONUS,
  UPPER_BONUS_THRESHOLD,
  UPPER_CATEGORIES,
  bestCategory,
  categoryScore,
  createGame,
  grandTotal,
  hold as holdDie,
  isYahtzee,
  roll as rollDice,
  score as scoreCategory,
  upperBonus,
  upperRemaining,
  upperTotal,
} from '@/lib/games/yahtzee/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { recordResult } from '@/lib/gameStats'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// -- presentation data -------------------------------------------------------

const CATEGORY_LABEL: Record<Category, string> = {
  ones: 'Ones',
  twos: 'Twos',
  threes: 'Threes',
  fours: 'Fours',
  fives: 'Fives',
  sixes: 'Sixes',
  threeKind: '3 of a Kind',
  fourKind: '4 of a Kind',
  fullHouse: 'Full House',
  smallStraight: 'Sm. Straight',
  largeStraight: 'Lg. Straight',
  yahtzee: 'YAHTZEE',
  chance: 'Chance',
}

// Short "what it scores" so a first-timer never guesses.
const CATEGORY_HELP: Record<Category, string> = {
  ones: 'Sum of 1s',
  twos: 'Sum of 2s',
  threes: 'Sum of 3s',
  fours: 'Sum of 4s',
  fives: 'Sum of 5s',
  sixes: 'Sum of 6s',
  threeKind: 'Sum of all · 3 alike',
  fourKind: 'Sum of all · 4 alike',
  fullHouse: '25 · three + pair',
  smallStraight: '30 · 4 in a row',
  largeStraight: '40 · 5 in a row',
  yahtzee: '50 · 5 alike',
  chance: 'Sum of all dice',
}

// Pip layouts (0-based grid slots in a 3×3, index = row*3+col).
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

/** Random-free seed for a "New game": OK in the COMPONENT (never the engine). */
function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

// -- a single die (real pips, neon) ------------------------------------------

function Die({
  value,
  held,
  disabled,
  rolling,
  onClick,
}: {
  value: number
  held: boolean
  disabled: boolean
  rolling: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid="die"
      data-held={held}
      aria-pressed={held}
      aria-label={`Die showing ${value}${held ? ', held' : ''}`}
      className={`relative grid aspect-square w-full place-items-center rounded-xl border-2 transition-transform disabled:cursor-default ${
        rolling ? 'yz-roll' : ''
      }`}
      style={{
        background: held
          ? 'linear-gradient(160deg, rgba(163,230,53,0.22), rgba(52,227,155,0.14))'
          : 'linear-gradient(160deg, #f4f5fb, #d7dae8)',
        borderColor: held ? 'var(--neon-lime)' : 'rgba(0,0,0,0.28)',
        boxShadow: held
          ? '0 0 0 2px var(--neon-lime), 0 0 16px rgba(163,230,53,0.55)'
          : 'inset 0 -3px 6px rgba(0,0,0,0.18), inset 0 2px 3px rgba(255,255,255,0.7)',
      }}
    >
      <span className="grid h-[68%] w-[68%] grid-cols-3 grid-rows-3 gap-[2px]">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="place-self-center rounded-full"
            style={{
              width: '82%',
              height: '82%',
              background: PIPS[value]?.includes(i)
                ? held
                  ? 'var(--neon-lime)'
                  : '#1b2130'
                : 'transparent',
              boxShadow: PIPS[value]?.includes(i) && held ? '0 0 5px var(--neon-lime)' : undefined,
            }}
          />
        ))}
      </span>
      {held && (
        <span
          className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-[1px] text-[0.6rem] font-extrabold tracking-wider text-stone-900"
          style={{ background: 'var(--neon-lime)' }}
        >
          HELD
        </span>
      )}
    </button>
  )
}

// -- one scorecard row -------------------------------------------------------

function ScoreRow({
  cat,
  used,
  value,
  preview,
  isBest,
  canScore,
  onScore,
}: {
  cat: Category
  used: boolean
  value: number | null
  preview: number | null
  isBest: boolean
  canScore: boolean
  onScore: () => void
}) {
  const interactive = canScore && !used
  return (
    <button
      type="button"
      onClick={onScore}
      disabled={!interactive}
      data-testid="score-row"
      data-cat={cat}
      data-used={used}
      aria-label={`${CATEGORY_LABEL[cat]}${
        used ? `, scored ${value}` : preview != null ? `, would score ${preview}` : ''
      }`}
      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
        interactive ? 'cursor-pointer' : 'cursor-default'
      }`}
      style={{
        borderColor: used
          ? 'var(--border)'
          : isBest && interactive
            ? 'var(--neon-amber)'
            : interactive
              ? 'color-mix(in srgb, var(--neon-cyan) 45%, transparent)'
              : 'var(--border)',
        background: used
          ? 'color-mix(in srgb, var(--neon-cyan) 6%, transparent)'
          : isBest && interactive
            ? 'color-mix(in srgb, var(--neon-amber) 12%, transparent)'
            : 'transparent',
        boxShadow: isBest && interactive ? '0 0 10px rgba(251,191,36,0.35)' : undefined,
      }}
    >
      <span className="min-w-0">
        <span
          className={`block truncate text-[0.86rem] font-bold ${
            cat === 'yahtzee' ? 'tracking-wide' : ''
          }`}
          style={{ color: used ? 'var(--fg-muted)' : 'var(--fg)' }}
        >
          {CATEGORY_LABEL[cat]}
        </span>
        <span className="block truncate text-[0.66rem] leading-tight text-fg-muted">
          {CATEGORY_HELP[cat]}
        </span>
      </span>
      <span
        data-testid="score-value"
        className="shrink-0 rounded-md px-2 py-0.5 text-sm font-extrabold tabular-nums"
        style={
          used
            ? { color: 'var(--neon-cyan)' }
            : preview != null
              ? {
                  color: isBest ? 'var(--neon-amber)' : 'var(--fg-muted)',
                  background: isBest ? 'rgba(251,191,36,0.14)' : 'rgba(148,163,184,0.12)',
                }
              : { color: 'transparent' }
        }
      >
        {used ? value : preview != null ? preview : '—'}
      </span>
    </button>
  )
}

// -- the game ----------------------------------------------------------------

export function GameYahtzee({ storageKey }: { storageKey: string }) {
  const [state, setState] = useState<State | null>(null)
  const [best, setBest] = useState(0)
  const [rollingKey, setRollingKey] = useState(0) // bumps to retrigger the tumble
  const [gotYahtzee, setGotYahtzee] = useState(false) // flash a YAHTZEE! banner

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<State | null>(null)
  const overRef = useRef(false)
  const slug = storageKey.replace(/^best:/, '')

  const commit = useCallback((next: State) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Bootstrap on the client only (never Date/random in render).
  useEffect(() => {
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0)
    overRef.current = false
    setGotYahtzee(false)
    commit(createGame(freshSeed()))
  }, [storageKey, commit])

  const newGame = useCallback(() => {
    overRef.current = false
    setGotYahtzee(false)
    commit(createGame(freshSeed()))
  }, [commit])

  const persistFinal = useCallback(
    (finalState: State) => {
      const total = grandTotal(finalState)
      const stored = Number(localStorage.getItem(storageKey))
      const prev = Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0
      if (total > prev) {
        try {
          localStorage.setItem(storageKey, String(total)) // PLAIN NUMBER — leaderboard-safe
        } catch {
          /* storage unavailable */
        }
        setBest(total)
      }
      recordResult(slug, { won: true })
    },
    [storageKey, slug],
  )

  const onRoll = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const next = rollDice(s)
    if (next === s) {
      play('error')
      return
    }
    commit(next)
    setRollingKey((k) => k + 1)
    play('move')
  }, [commit, play])

  const onHold = useCallback(
    (i: number) => {
      const s = stateRef.current
      if (!s) return
      const next = holdDie(s, i)
      if (next === s) return
      commit(next)
      play('flip')
    },
    [commit, play],
  )

  const onScore = useCallback(
    (cat: Category) => {
      const s = stateRef.current
      if (!s) return
      const wasYahtzee = isYahtzee(s.dice)
      const next = scoreCategory(s, cat)
      if (next === s) {
        play('error')
        return
      }
      commit(next)

      const finished = next.status === 'over' && !overRef.current
      if (finished) {
        overRef.current = true
        play('win') // finishing all 13 turns is the finale
        persistFinal(next)
        return
      }
      if (wasYahtzee && (cat === 'yahtzee' || next.yahtzeeBonus > s.yahtzeeBonus)) {
        setGotYahtzee(true)
        play('win')
      } else {
        play('match')
      }
    },
    [commit, play, persistFinal],
  )

  // Clear the YAHTZEE! banner shortly after it flashes.
  useEffect(() => {
    if (!gotYahtzee) return
    const id = setTimeout(() => setGotYahtzee(false), 1400)
    return () => clearTimeout(id)
  }, [gotYahtzee])

  // Keyboard: Space/Enter = roll, 1-5 toggle hold, N = new game.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        onRoll()
      } else if (e.key >= '1' && e.key <= '5') {
        e.preventDefault()
        onHold(Number(e.key) - 1)
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        newGame()
      }
    },
    [onRoll, onHold, newGame],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-112 select-none">
        <div className="h-96 rounded-xl bg-surface" data-testid="yahtzee-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const over = state.status === 'over'
  const total = grandTotal(state)
  const upper = upperTotal(state)
  const bonus = upperBonus(state)
  const remaining = upperRemaining(state)
  const best_ = over ? Math.max(best, total) : best
  const best_cat = state.rolled && !over ? bestCategory(state) : null

  // Preview map — only meaningful once the player has rolled this turn.
  const preview = (cat: Category): number | null =>
    state.rolled ? categoryScore(cat, state.dice) : null

  const canScore = state.rolled && !over

  const hint = over
    ? `Game over — you scored ${total}. Hit New game to beat it.`
    : !state.rolled
      ? `Turn ${state.turn + 1}/13 — press ROLL to throw all 5 dice.`
      : state.rollsLeft > 0
        ? `Tap dice to HOLD them, then ROLL again — or tap a scorecard row to score. ${state.rollsLeft} roll${state.rollsLeft === 1 ? '' : 's'} left.`
        : 'No rolls left — tap a scorecard row to bank your dice.'

  const rollLabel = !state.rolled
    ? 'ROLL'
    : state.rollsLeft > 0
      ? `ROLL (${state.rollsLeft} left)`
      : 'No rolls left'

  const headerExtra = (
    <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
      <span className="text-fg-muted">Turn</span>{' '}
      <span className="font-bold text-accent" data-testid="turn">
        {Math.min(state.turn + (over ? 0 : 1), 13)}
      </span>
      <span className="text-fg-muted">/13</span>
    </span>
  )

  return (
    <GameShell
      stats={[
        { label: 'Total', value: total, testId: 'score', float: true },
        { label: 'Best', value: best_, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={newGame}
      newGameLabel="New game"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-112"
    >
      <div
        role="group"
        aria-label="Yahtzee board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid="yahtzee-board"
      >
        {/* Scoped dice-tumble keyframe (self-contained; only applied when not reduced-motion). */}
        <style>{`
          @keyframes yz-tumble {
            0%   { transform: translateY(0) rotate(0deg) scale(1); }
            30%  { transform: translateY(-10px) rotate(140deg) scale(1.08); }
            60%  { transform: translateY(-4px) rotate(280deg) scale(1.04); }
            100% { transform: translateY(0) rotate(360deg) scale(1); }
          }
          .yz-roll { animation: yz-tumble 0.42s cubic-bezier(0.3, 0.8, 0.4, 1); }
          @media (prefers-reduced-motion: reduce) { .yz-roll { animation: none; } }
        `}</style>
        {/* Dice tray — dimmed until the first roll of the turn signals "roll to begin". */}
        <div
          className="grid grid-cols-5 gap-2 transition-opacity sm:gap-2.5"
          style={{ opacity: state.rolled || over ? 1 : 0.5 }}
          data-testid="dice-tray"
        >
          {state.dice.map((value, i) => (
            <Die
              key={`${rollingKey}-${i}`}
              value={value}
              held={state.held[i]}
              disabled={!state.rolled || over || state.rollsLeft <= 0}
              rolling={!reduced && !state.held[i] && state.rolled}
              onClick={() => onHold(i)}
            />
          ))}
        </div>

        {/* Roll button + rolls-left dots */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <GameButton
            onClick={onRoll}
            disabled={state.rollsLeft <= 0 || over}
            className="px-6 py-2.5 text-base"
          >
            🎲 {rollLabel}
          </GameButton>
          <span className="flex items-center gap-1.5" aria-hidden="true" data-testid="rolls-left">
            {Array.from({ length: MAX_ROLLS }, (_, i) => {
              const used = i >= state.rollsLeft
              return (
                <span
                  key={i}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: used ? 'rgba(148,163,184,0.3)' : 'var(--neon-cyan)',
                    boxShadow: used ? undefined : '0 0 8px var(--neon-cyan)',
                  }}
                />
              )
            })}
          </span>
        </div>

        {/* Scorecard */}
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3" data-testid="scorecard">
          {/* Upper */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between px-0.5">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-neon-cyan">
                Upper
              </span>
              <span className="text-[0.62rem] text-fg-muted">
                {upper}/{UPPER_BONUS_THRESHOLD}
              </span>
            </div>
            {UPPER_CATEGORIES.map((cat) => (
              <ScoreRow
                key={cat}
                cat={cat}
                used={state.scores[cat] !== null}
                value={state.scores[cat]}
                preview={preview(cat)}
                isBest={best_cat === cat}
                canScore={canScore}
                onScore={() => onScore(cat)}
              />
            ))}
            {/* Bonus tracker */}
            <div
              className="rounded-lg border border-dashed px-2.5 py-1.5 text-[0.68rem] leading-tight"
              style={{
                borderColor:
                  bonus > 0 ? 'var(--neon-lime)' : 'color-mix(in srgb, var(--neon-amber) 40%, transparent)',
                color: bonus > 0 ? 'var(--neon-lime)' : 'var(--fg-muted)',
              }}
              data-testid="upper-bonus"
            >
              {bonus > 0 ? (
                <span className="font-bold">✓ +{UPPER_BONUS} bonus earned!</span>
              ) : (
                <>
                  <span className="font-bold">+{UPPER_BONUS} bonus</span> at {UPPER_BONUS_THRESHOLD} —{' '}
                  {remaining} to go
                </>
              )}
            </div>
          </div>

          {/* Lower */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between px-0.5">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-neon-magenta">
                Lower
              </span>
              {state.yahtzeeBonus > 0 && (
                <span className="text-[0.62rem] font-bold text-neon-lime" data-testid="yahtzee-bonus">
                  +{state.yahtzeeBonus} 🎉
                </span>
              )}
            </div>
            {LOWER_CATEGORIES.map((cat) => (
              <ScoreRow
                key={cat}
                cat={cat}
                used={state.scores[cat] !== null}
                value={state.scores[cat]}
                preview={preview(cat)}
                isBest={best_cat === cat}
                canScore={canScore}
                onScore={() => onScore(cat)}
              />
            ))}
          </div>
        </div>

        {/* YAHTZEE! flash */}
        {gotYahtzee && (
          <div
            className="anim-overlay-in pointer-events-none absolute inset-x-0 top-1/3 z-10 flex justify-center"
            aria-hidden="true"
          >
            <span
              className="neon-text-strong rounded-2xl border px-6 py-3 text-3xl font-extrabold tracking-widest"
              style={{
                color: 'var(--neon-lime)',
                borderColor: 'var(--neon-lime)',
                background: 'rgba(10,12,20,0.85)',
              }}
            >
              YAHTZEE!
            </span>
          </div>
        )}

        <GameOverlay show={over} variant="win" title="Game over!" testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Final score <span className="font-bold text-accent">{total}</span>
            </p>
            <p className="text-fg-muted">
              Upper {upper} {bonus > 0 && <span className="text-neon-lime">(+{bonus})</span>} · Lower{' '}
              {LOWER_CATEGORIES.reduce((a, c) => a + (state.scores[c] ?? 0), 0)}
              {state.yahtzeeBonus > 0 && (
                <span className="text-neon-lime"> · Yahtzee +{state.yahtzeeBonus}</span>
              )}
            </p>
            <p>
              Best <span className="font-bold text-accent">{best_}</span>
              {total >= best_ && total > 0 && (
                <span className="ml-1 font-bold text-neon-lime">★ New best!</span>
              )}
            </p>
          </div>
          <GameButton onClick={newGame}>New game</GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
