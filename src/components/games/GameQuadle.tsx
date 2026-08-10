'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BOARDS,
  MAX_GUESSES,
  WORD_LENGTH,
  boardRows,
  createGame,
  dailySeed,
  guessesUsed,
  isBoardSolved,
  mergedKeyHints,
  score as scoreOf,
  solvedCount,
  submit,
  type LetterState,
  type QuadleState,
} from '@/lib/games/quadle/engine'
import { isValidGuess } from '@/lib/games/wordguess/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak, loadStreak, saveStreak } from '@/lib/dailyStreak'
import { recordResult } from '@/lib/gameStats'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { type Grade } from '@/lib/dailyShare'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'

// Tile fill by feedback — shared palette with Word Guess for consistency.
const TILE_STATE: Record<LetterState, string> = {
  correct: 'bg-green-600 border-green-600 text-white',
  present: 'bg-yellow-500 border-yellow-500 text-stone-900',
  absent: 'bg-stone-600 border-stone-600 text-white',
}

// Merged on-screen keyboard: only "absent everywhere" is tinted; the rest stay
// neutral, because correct/present differ per board.
const KEY_STATE: Record<LetterState, string> = {
  correct: 'bg-white/10 text-fg',
  present: 'bg-white/10 text-fg',
  absent: 'bg-stone-800 text-fg-muted',
}

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const

// Number emoji per board for the spoiler-free share grid.
const NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

/** Grade from guesses used (fewer = better); a loss is always D. */
function gradeFor(state: QuadleState): Grade {
  if (state.status !== 'won') return 'D'
  const used = guessesUsed(state)
  if (used <= 4) return 'S'
  if (used <= 5) return 'A'
  if (used <= 6) return 'B'
  if (used <= 8) return 'C'
  return 'D'
}

/** Spoiler-free 2×2 grid: the guess number each board was solved on (✖ if not). */
function shareGrid(state: QuadleState): string {
  const cell = (b: number) => {
    const at = state.solvedAt[b]
    return at === null ? '✖' : NUM_EMOJI[at]
  }
  return `${cell(0)} ${cell(1)}\n${cell(2)} ${cell(3)}`
}

export function GameQuadle({ storageKey }: { storageKey: string }) {
  // SSR safety: build the boards on the client only (never Date/random in render).
  const [state, setState] = useState<QuadleState | null>(null)
  const [guess, setGuess] = useState('')
  const [mode, setMode] = useState<Mode>('daily')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [shakeKey, setShakeKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<QuadleState | null>(null)
  const guessRef = useRef('')
  const modeRef = useRef<Mode>('daily')
  const prevOverRef = useRef(false)
  const prevSolvedRef = useRef(0)

  const bestKey = storageKey
  const streakKey = `${storageKey}:streak`

  const commitState = useCallback((s: QuadleState) => {
    stateRef.current = s
    setState(s)
  }, [])
  const commitGuess = useCallback((g: string) => {
    guessRef.current = g
    setGuess(g)
  }, [])

  const startBoard = useCallback(
    (nextMode: Mode) => {
      modeRef.current = nextMode
      prevOverRef.current = false
      prevSolvedRef.current = 0
      commitGuess('')
      setShakeKey(0)
      commitState(nextMode === 'daily' ? createGame(dailySeed(todayUTC())) : createGame(freshSeed()))
    },
    [commitGuess, commitState],
  )

  // Bootstrap (client only).
  useEffect(() => {
    const storedBest = Number(localStorage.getItem(bestKey))
    setBest(Number.isFinite(storedBest) && storedBest > 0 ? Math.floor(storedBest) : 0)
    setStreak(currentStreak(loadStreak(streakKey)))
    startBoard('daily')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const persistOutcome = useCallback(
    (next: QuadleState) => {
      const s = scoreOf(next)
      const storedBest = Number(localStorage.getItem(bestKey))
      const prevBest = Number.isFinite(storedBest) && storedBest > 0 ? Math.floor(storedBest) : 0
      if (s > prevBest) {
        try {
          localStorage.setItem(bestKey, String(s)) // PLAIN NUMBER — leaderboard reads Number()
        } catch {
          /* storage unavailable */
        }
        setBest(s)
      }
      if (next.status === 'won' && modeRef.current === 'daily') {
        const bumped = bumpStreak(loadStreak(streakKey))
        saveStreak(streakKey, bumped)
        setStreak(bumped.streak)
      }
      recordResult(bestKey.replace(/^best:/, ''), {
        won: next.status === 'won',
        bucket: next.status === 'won' ? guessesUsed(next) : 'X',
      })
    },
    [bestKey, streakKey],
  )

  const handleSubmit = useCallback(() => {
    const s = stateRef.current
    if (!s || s.status !== 'playing') return
    const word = guessRef.current
    if (!isValidGuess(word)) {
      play('error')
      if (!reducedRef.current) setShakeKey((k) => k + 1)
      return
    }

    const next = submit(s, word)
    commitState(next)
    commitGuess('')
    play('flip')

    // A board newly locked → match chime.
    const nowSolved = solvedCount(next)
    if (nowSolved > prevSolvedRef.current) play('match')
    prevSolvedRef.current = nowSolved

    const over = next.status !== 'playing'
    if (over && !prevOverRef.current) {
      if (next.status === 'won') play('win')
      else play('lose')
      persistOutcome(next)
    }
    prevOverRef.current = over
  }, [commitGuess, commitState, persistOutcome, play, reducedRef])

  const typeLetter = useCallback(
    (letter: string) => {
      const s = stateRef.current
      if (!s || s.status !== 'playing') return
      if (guessRef.current.length >= WORD_LENGTH) return
      commitGuess(guessRef.current + letter.toLowerCase())
      play('move')
    },
    [commitGuess, play],
  )

  const backspace = useCallback(() => {
    commitGuess(guessRef.current.slice(0, -1))
  }, [commitGuess])

  // Physical keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        backspace()
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        typeLetter(e.key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSubmit, backspace, typeLetter])

  const onNewGame = useCallback(() => {
    startBoard(modeRef.current)
  }, [startBoard])

  const switchMode = useCallback(
    (m: Mode) => {
      if (m === mode) return
      setMode(m)
      startBoard(m)
    },
    [mode, startBoard],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-160 select-none">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="quadle-board">
          {Array.from({ length: BOARDS }, (_, i) => (
            <div key={i} className="aspect-[5/9] rounded-xl bg-surface" />
          ))}
        </div>
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const over = state.status !== 'playing'
  const won = state.status === 'won'
  const activeRow = guessesUsed(state)
  const keyHints = mergedKeyHints(state)
  const score = scoreOf(state)

  const hint = over
    ? won
      ? 'Solved all four! Come back tomorrow for a new daily.'
      : 'Out of guesses — the four words are revealed below.'
    : `One guess hits all four boards. Solve all four in ${MAX_GUESSES} tries. ${solvedCount(state)}/${BOARDS} solved.`

  const headerExtra = (
    <>
      <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Game mode">
        {(['daily', 'practice'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            aria-pressed={mode === m}
            className={`btn-press px-2.5 py-1.5 text-sm font-semibold capitalize ${
              mode === m ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      {mode === 'daily' && (
        <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          Streak <span className="font-bold text-accent" data-testid="streak">{streak}</span>
        </span>
      )}
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Guess</span>{' '}
        <span className="font-bold" data-testid="guesses">
          {Math.min(activeRow + (over ? 0 : 1), MAX_GUESSES)}/{MAX_GUESSES}
        </span>
      </span>
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Score', value: score, testId: 'score', float: true },
        { label: 'Best', value: best, testId: 'best' },
        { label: 'Solved', value: solvedCount(state), testId: 'solved' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={mode === 'daily' ? 'Replay Daily' : 'New Board'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-160"
    >
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        data-testid="quadle-board"
        aria-label="Quadle boards"
      >
        {Array.from({ length: BOARDS }, (_, b) => {
          const rows = boardRows(state, b)
          const solved = isBoardSolved(state, b)
          return (
            <div
              key={b}
              data-testid="quadle-single-board"
              data-solved={solved}
              className={`rounded-xl bg-surface p-2 transition-opacity ${solved ? 'opacity-55' : ''}`}
            >
              <div className="mb-1 flex items-center justify-between px-1 text-[0.7rem] font-semibold uppercase tracking-wide text-fg-muted">
                <span>Board {b + 1}</span>
                {solved ? (
                  <span className="text-neon-lime" aria-label="solved">✓ solved</span>
                ) : over ? (
                  <span className="font-bold uppercase tracking-wide text-neon-amber">
                    {state.answers[b]}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-1">
                {Array.from({ length: MAX_GUESSES }, (_, r) => {
                  const result = rows[r]
                  const isActive = r === activeRow && !over && !solved
                  return (
                    <div
                      key={isActive ? `active-${shakeKey}` : `row-${r}`}
                      className={`grid grid-cols-5 gap-1 ${isActive && shakeKey > 0 ? 'anim-shake' : ''}`}
                    >
                      {Array.from({ length: WORD_LENGTH }, (_, c) => {
                        let letter = ''
                        let cls = 'border-2 border-white/12 bg-transparent text-fg'
                        if (result) {
                          const word = state.guesses[r]
                          letter = word[c].toUpperCase()
                          cls = TILE_STATE[result[c]]
                        } else if (isActive) {
                          const ch = guess[c]
                          if (ch) {
                            letter = ch.toUpperCase()
                            cls = `border-2 border-white/40 bg-transparent text-fg${reduced ? '' : ' anim-pop'}`
                          }
                        }
                        return (
                          <div
                            key={c}
                            data-testid="quadle-tile"
                            className={`flex aspect-square items-center justify-center rounded text-sm font-bold uppercase select-none sm:text-base ${cls}`}
                          >
                            {letter}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Shared on-screen keyboard */}
      <div className="mx-auto mt-4 flex w-full max-w-[30rem] flex-col gap-1.5" data-testid="quadle-keyboard">
        {KEY_ROWS.map((row, i) => (
          <div key={row} className="flex justify-center gap-1">
            {i === 2 && (
              <KeyButton label="Enter" wide onClick={handleSubmit} disabled={over} testId="quadle-key-enter" />
            )}
            {row.split('').map((letter) => (
              <KeyButton
                key={letter}
                label={letter}
                disabled={over}
                stateClass={keyHints.get(letter) ? KEY_STATE[keyHints.get(letter)!] : undefined}
                onClick={() => typeLetter(letter)}
                testId={`quadle-key-${letter}`}
              />
            ))}
            {i === 2 && (
              <KeyButton label="⌫" wide onClick={backspace} disabled={over} testId="quadle-key-back" ariaLabel="Backspace" />
            )}
          </div>
        ))}
      </div>

      <GameOverlay
        show={over}
        variant={won ? 'win' : 'lose'}
        title={won ? 'All four solved!' : 'Out of guesses'}
        testId="quadle-game-over"
      >
        <div className="flex flex-col items-center gap-1 text-sm">
          <p>
            Score <span className="font-bold text-accent">{score}</span>
          </p>
          <p>
            Boards <span className="font-bold text-accent">{solvedCount(state)}</span> / {BOARDS} in{' '}
            <span className="font-bold text-accent">{guessesUsed(state)}</span> guesses
          </p>
          {mode === 'daily' && (
            <p>
              Streak <span className="font-bold text-accent">{streak}</span>
            </p>
          )}
          <div className="mt-1 grid grid-cols-2 gap-1 text-center text-xs">
            {state.answers.map((a, b) => (
              <span
                key={b}
                className={`rounded px-2 py-1 font-bold uppercase tracking-wide ${
                  isBoardSolved(state, b) ? 'bg-white/5 text-neon-lime' : 'bg-white/5 text-neon-amber'
                }`}
              >
                {a}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {mode === 'daily' && (
            <DailyShareButton
              payload={() => {
                const grade = gradeFor(state)
                const grid = shareGrid(state)
                const result = won ? `${solvedCount(state)}/${BOARDS}` : `X/${BOARDS}`
                return {
                  gameName: 'Quadle',
                  dateISO: todayUTC(),
                  accent: '#22d3ee',
                  lines: [],
                  streak,
                  url: `${window.location.origin}/quadle`,
                  isDaily: true,
                  grade,
                  scoreLine: `${score} PTS`,
                  textSnippet: `Quadle ${todayUTC()}  ${result}\n${grid}\nYour turn ↓`,
                }
              }}
            />
          )}
          <GameButton onClick={onNewGame}>{mode === 'daily' ? 'Replay Daily' : 'New Board'}</GameButton>
        </div>
      </GameOverlay>
    </GameShell>
  )
}

function KeyButton({
  label,
  onClick,
  stateClass,
  wide,
  disabled,
  testId,
  ariaLabel,
}: {
  label: string
  onClick: () => void
  stateClass?: string
  wide?: boolean
  disabled?: boolean
  testId?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-label={ariaLabel ?? label}
      className={`btn-press flex h-11 min-h-11 items-center justify-center rounded-md text-sm font-semibold uppercase disabled:opacity-50 ${
        wide ? 'px-3 text-xs' : 'flex-1'
      } ${stateClass ?? 'bg-white/10 text-fg hover:bg-white/20'}`}
    >
      {label}
    </button>
  )
}
