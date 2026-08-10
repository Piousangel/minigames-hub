'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  COLS,
  MAX_GUESSES,
  SYMBOLS,
  dailySeed,
  guessesUsed,
  isValidEquation,
  keyStates as keyStatesOf,
  mulberry32,
  newGame,
  score as scoreOf,
  scoreRow,
  submitGuess,
  type GameState,
  type TileState,
} from '@/lib/games/equate/engine'
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

// Reveal timing (skipped entirely under prefers-reduced-motion).
const FLIP_MS = 300
const STAGGER_MS = 180

// Tile fill by feedback — neon tokens over the dark board.
const TILE_STATE: Record<TileState, string> = {
  green: 'border-transparent bg-neon-green text-stone-900',
  purple: 'border-transparent bg-neon-purple text-white',
  grey: 'border-transparent bg-white/12 text-fg-muted',
}

// On-screen keypad tint by best-known state per symbol.
const KEY_STATE: Record<TileState, string> = {
  green: 'bg-neon-green text-stone-900',
  purple: 'bg-neon-purple text-white',
  grey: 'bg-white/8 text-fg-muted',
}

const EMOJI: Record<TileState, string> = { green: '🟩', purple: '🟪', grey: '⬛' }

// Keypad layout: digits over operators; Enter/Backspace flank the operator row.
const PAD_ROWS = ['0123456789'.split(''), '+-*/='.split('')] as const

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

/** Grade from guesses used (fewer is better); a loss is D. */
function gradeFor(state: GameState): Grade {
  if (state.status !== 'won') return 'D'
  // 1→S, 2→S, 3→A, 4→B, 5→C, 6→D
  const used = guessesUsed(state)
  return (['S', 'S', 'A', 'B', 'C', 'D'] as const)[Math.min(used - 1, 5)]
}

/** Spoiler-free color grid, one row per guess. */
function emojiGrid(state: GameState): string {
  return state.guesses.map((g) => scoreRow(g, state.answer).map((t) => EMOJI[t]).join('')).join('\n')
}

export function GameEquate({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board on the client only (never Date/random in render).
  const [state, setState] = useState<GameState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [guess, setGuess] = useState('')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [shakeKey, setShakeKey] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [revealRow, setRevealRow] = useState(-1)
  const [revealing, setRevealing] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const guessRef = useRef('')
  const modeRef = useRef<Mode>('daily')
  const revealingRef = useRef(false)
  const prevOverRef = useRef(false)
  const timers = useRef<number[]>([])

  const bestKey = storageKey
  const streakKey = `${storageKey}:streak`

  const commitState = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])
  const commitGuess = useCallback((g: string) => {
    guessRef.current = g
    setGuess(g)
  }, [])

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }, [])

  const startBoard = useCallback(
    (nextMode: Mode) => {
      clearTimers()
      modeRef.current = nextMode
      prevOverRef.current = false
      revealingRef.current = false
      setRevealing(false)
      setRevealRow(-1)
      setShakeKey(0)
      setErrorMsg('')
      commitGuess('')
      const seed = nextMode === 'daily' ? dailySeed(todayUTC()) : freshSeed()
      commitState(newGame(mulberry32(seed)))
    },
    [clearTimers, commitGuess, commitState],
  )

  // Bootstrap (client only).
  useEffect(() => {
    const storedBest = Number(localStorage.getItem(bestKey))
    setBest(Number.isFinite(storedBest) && storedBest > 0 ? Math.floor(storedBest) : 0)
    setStreak(currentStreak(loadStreak(streakKey)))
    startBoard('daily')
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const persistOutcome = useCallback(
    (next: GameState) => {
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
      // Day-streak only on a daily WIN.
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

  const flagError = useCallback((msg: string) => {
    play('error')
    setErrorMsg(msg)
    setShakeKey((k) => k + 1)
    window.setTimeout(() => setErrorMsg(''), 1600)
  }, [play])

  const handleSubmit = useCallback(() => {
    const s = stateRef.current
    if (!s || s.status !== 'playing' || revealingRef.current) return
    const g = guessRef.current
    if (g.length !== COLS) {
      flagError(`Fill all ${COLS} tiles`)
      return
    }
    if (!isValidEquation(g)) {
      flagError('Not a valid equation')
      return
    }

    const next = submitGuess(s, g)
    const row = next.guesses.length - 1
    commitState(next)
    commitGuess('')
    setRevealRow(row)
    setErrorMsg('')

    const finishEnd = () => {
      const over = next.status !== 'playing'
      if (over && !prevOverRef.current) {
        if (next.status === 'won') play('win')
        else play('lose')
        persistOutcome(next)
      }
      prevOverRef.current = over
    }

    if (reducedRef.current) {
      play('flip')
      finishEnd()
      return
    }

    revealingRef.current = true
    setRevealing(true)
    for (let c = 0; c < COLS; c++) {
      timers.current.push(window.setTimeout(() => play('flip'), c * STAGGER_MS))
    }
    const total = (COLS - 1) * STAGGER_MS + FLIP_MS
    timers.current.push(
      window.setTimeout(() => {
        revealingRef.current = false
        setRevealing(false)
        finishEnd()
      }, total),
    )
  }, [commitGuess, commitState, flagError, play, persistOutcome, reducedRef])

  const typeSymbol = useCallback(
    (sym: string) => {
      const s = stateRef.current
      if (!s || s.status !== 'playing' || revealingRef.current) return
      if (guessRef.current.length >= COLS) return
      setErrorMsg('')
      commitGuess(guessRef.current + sym)
      play('move')
    },
    [commitGuess, play],
  )

  const backspace = useCallback(() => {
    if (revealingRef.current) return
    setErrorMsg('')
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
      } else if (e.key.length === 1 && SYMBOLS.includes(e.key)) {
        e.preventDefault()
        typeSymbol(e.key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSubmit, backspace, typeSymbol])

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

  const hint =
    'Guess the hidden equation. Type an 8-tile equation that computes, then Enter. ' +
    'Green = right spot, purple = wrong spot.'

  if (!state) {
    return (
      <GameShell
        stats={[{ label: 'Best', value: 0 }]}
        onNewGame={() => {}}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="mx-auto aspect-[8/6] w-full max-w-[26rem] rounded-xl bg-surface" data-testid="equate-loading" />
      </GameShell>
    )
  }

  const keyMap = keyStatesOf(state)
  const activeRow = state.guesses.length
  const gameOver = state.status !== 'playing'
  const won = state.status === 'won'
  const scoreVal = scoreOf(state)

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
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Score', value: scoreVal, testId: 'score' },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={mode === 'daily' ? 'Replay Daily' : 'New Board'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-[30rem]"
    >
      <style>{`
        @keyframes eq-flip {
          0% { transform: rotateX(0deg); }
          50% { transform: rotateX(90deg); }
          100% { transform: rotateX(0deg); }
        }
        .eq-reveal { animation: eq-flip ${FLIP_MS}ms ease both; }
      `}</style>

      <div className="anim-board-in mx-auto grid w-full max-w-[26rem] gap-1.5" data-testid="equate-board">
        {Array.from({ length: MAX_GUESSES }, (_, r) => {
          const submitted = state.guesses[r]
          const row = submitted ? scoreRow(submitted, state.answer) : null
          const isActive = r === activeRow && !gameOver
          const isRevealing = r === revealRow && revealing
          return (
            <div
              key={isActive ? `active-${shakeKey}` : `row-${r}`}
              className={`grid grid-cols-8 gap-1.5 ${isActive && shakeKey > 0 ? 'anim-shake' : ''}`}
              data-testid="equate-row"
            >
              {Array.from({ length: COLS }, (_, c) => {
                let sym = ''
                let stateClass = 'border-2 border-white/15 bg-transparent text-fg'
                let reveal = ''

                if (submitted && row) {
                  sym = submitted[c]
                  stateClass = TILE_STATE[row[c]]
                  if (isRevealing) reveal = 'eq-reveal'
                } else if (isActive) {
                  const ch = guess[c]
                  if (ch) {
                    sym = ch
                    stateClass = 'border-2 border-white/40 bg-transparent text-fg anim-pop'
                  }
                }

                return (
                  <div
                    key={c}
                    data-testid="equate-tile"
                    className={`flex aspect-square items-center justify-center rounded-md text-xl font-bold select-none sm:text-2xl ${stateClass} ${reveal}`}
                    style={reveal ? { animationDelay: `${c * STAGGER_MS}ms` } : undefined}
                  >
                    {sym}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Error / status line */}
      <div className="mt-2 flex h-6 items-center justify-center text-sm" aria-live="polite">
        {errorMsg && <span className="font-semibold text-neon-red" data-testid="equate-error">{errorMsg}</span>}
      </div>

      {/* On-screen keypad */}
      <div className="mx-auto flex w-full max-w-[28rem] flex-col gap-1.5" data-testid="equate-keypad">
        <div className="flex justify-center gap-1">
          {PAD_ROWS[0].map((sym) => (
            <KeyButton
              key={sym}
              label={sym}
              stateClass={keyMap.get(sym) ? KEY_STATE[keyMap.get(sym)!] : undefined}
              onClick={() => typeSymbol(sym)}
              testId={`equate-key-${sym}`}
            />
          ))}
        </div>
        <div className="flex justify-center gap-1">
          <KeyButton label="Enter" wide onClick={handleSubmit} testId="equate-key-enter" />
          {PAD_ROWS[1].map((sym) => (
            <KeyButton
              key={sym}
              label={sym}
              stateClass={keyMap.get(sym) ? KEY_STATE[keyMap.get(sym)!] : undefined}
              onClick={() => typeSymbol(sym)}
              testId={`equate-key-${sym === '*' ? 'mul' : sym === '/' ? 'div' : sym === '+' ? 'add' : sym === '-' ? 'sub' : 'eq'}`}
            />
          ))}
          <KeyButton label="⌫" wide onClick={backspace} testId="equate-key-back" ariaLabel="Backspace" />
        </div>
      </div>

      <GameOverlay
        show={gameOver && !revealing}
        variant={won ? 'win' : 'lose'}
        title={won ? 'Solved!' : 'Out of guesses'}
        testId="equate-game-over"
      >
        <div className="flex flex-col items-center gap-1 text-sm">
          <p>
            The equation was{' '}
            <span className="font-bold tracking-wide text-accent" data-testid="equate-answer">{state.answer}</span>
          </p>
          {won ? (
            <p>
              Solved in <span className="font-bold text-accent">{guessesUsed(state)}</span>/{MAX_GUESSES}
            </p>
          ) : null}
          {mode === 'daily' && (
            <p>
              Streak <span className="font-bold text-accent">{streak}</span>
            </p>
          )}
          {state.guesses.length > 0 && (
            <pre className="mt-1 text-base leading-tight" aria-hidden="true">
              {emojiGrid(state)}
            </pre>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {mode === 'daily' && (
            <DailyShareButton
              payload={() => {
                const grade = gradeFor(state)
                const grid = emojiGrid(state)
                const resultLine = won ? `${guessesUsed(state)}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`
                return {
                  gameName: 'Equate',
                  dateISO: todayUTC(),
                  accent: '#c084fc',
                  lines: [],
                  streak,
                  url: `${window.location.origin}/equate`,
                  isDaily: true,
                  grade,
                  scoreLine: `${scoreVal} PTS`,
                  textSnippet: `Equate ${todayUTC()}  ${resultLine}\n${grid}\nYour turn ↓`,
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
  testId,
  ariaLabel,
}: {
  label: string
  onClick: () => void
  stateClass?: string
  wide?: boolean
  testId?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-label={ariaLabel ?? label}
      className={`btn-press flex h-11 min-w-11 items-center justify-center rounded-md text-base font-semibold ${
        wide ? 'px-3 text-xs' : 'flex-1'
      } ${stateClass ?? 'bg-white/10 text-fg hover:bg-white/20'}`}
    >
      {label}
    </button>
  )
}
