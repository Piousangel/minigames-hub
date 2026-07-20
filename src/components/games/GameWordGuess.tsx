'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MAX_GUESSES,
  WORD_LENGTH,
  isValidGuess,
  newGame,
  submitGuess,
  type GameState,
  type LetterState,
} from '@/lib/games/wordguess/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// Reveal timing (skipped entirely under prefers-reduced-motion).
const FLIP_MS = 320
const STAGGER_MS = 220

interface Stats {
  wins: number
  streak: number
}

const EMPTY_STATS: Stats = { wins: 0, streak: 0 }

function readStats(key: string): Stats {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return EMPTY_STATS
    const parsed = JSON.parse(raw) as Partial<Stats>
    return {
      wins: Number.isFinite(parsed.wins) ? Number(parsed.wins) : 0,
      streak: Number.isFinite(parsed.streak) ? Number(parsed.streak) : 0,
    }
  } catch {
    return EMPTY_STATS
  }
}

// Tile fill by feedback — chosen for strong contrast against the dark board.
const TILE_STATE: Record<LetterState, string> = {
  correct: 'bg-green-600 border-green-600 text-white',
  present: 'bg-yellow-500 border-yellow-500 text-stone-900',
  absent: 'bg-stone-600 border-stone-600 text-white',
}

// On-screen keyboard tint by best-known state for each letter.
const KEY_STATE: Record<LetterState, string> = {
  correct: 'bg-green-600 text-white',
  present: 'bg-yellow-500 text-stone-900',
  absent: 'bg-stone-800 text-fg-muted',
}

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const

// correct > present > absent — a letter never downgrades once known.
const RANK: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 }

function bestKeyStates(state: GameState): Map<string, LetterState> {
  const map = new Map<string, LetterState>()
  for (const g of state.guesses) {
    for (let i = 0; i < g.word.length; i++) {
      const letter = g.word[i]
      const next = g.result[i]
      const prev = map.get(letter)
      if (!prev || RANK[next] > RANK[prev]) map.set(letter, next)
    }
  }
  return map
}

export function GameWordGuess({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<GameState | null>(null)
  const [guess, setGuess] = useState('')
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [shakeKey, setShakeKey] = useState(0)
  const [revealRow, setRevealRow] = useState(-1)
  const [revealing, setRevealing] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const guessRef = useRef('')
  const revealingRef = useRef(false)
  const timers = useRef<number[]>([])

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

  const restart = useCallback(() => {
    clearTimers()
    revealingRef.current = false
    setRevealing(false)
    setRevealRow(-1)
    setShakeKey(0)
    commitGuess('')
    commitState(newGame(Math.random))
  }, [clearTimers, commitGuess, commitState])

  useEffect(() => {
    restart()
    setStats(readStats(storageKey))
    return () => clearTimers()
  }, [restart, storageKey, clearTimers])

  const recordEnd = useCallback(
    (won: boolean) => {
      setStats((prev) => {
        const next: Stats = won
          ? { wins: prev.wins + 1, streak: prev.streak + 1 }
          : { wins: prev.wins, streak: 0 }
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          /* storage may be unavailable; keep in-memory stats */
        }
        return next
      })
    },
    [storageKey],
  )

  const handleSubmit = useCallback(() => {
    const s = stateRef.current
    if (!s || s.status !== 'playing' || revealingRef.current) return
    const word = guessRef.current

    if (!isValidGuess(word)) {
      // Not a full/real word — shake the active row and buzz.
      play('error')
      setShakeKey((k) => k + 1)
      return
    }

    const next = submitGuess(s, word)
    const row = next.guesses.length - 1
    commitState(next)
    commitGuess('')
    setRevealRow(row)

    const finishEnd = () => {
      if (next.status === 'won') {
        play('win')
        recordEnd(true)
      } else if (next.status === 'lost') {
        play('lose')
        recordEnd(false)
      }
      if (next.status !== 'playing') {
        // 개인 기록: 완료 판수/승수 + 사용한 추측 수 분포 누적 → 스탯 패널이 읽는다.
        // (storageKey에는 {wins,streak} JSON이 들어가지만 recordResult는 별도 stats: 키에 쓴다.)
        recordResult(storageKey.replace(/^best:/, ''), {
          won: next.status === 'won',
          bucket: next.guesses.length,
        })
      }
    }

    if (reducedRef.current) {
      play('flip')
      finishEnd()
      return
    }

    revealingRef.current = true
    setRevealing(true)
    for (let c = 0; c < WORD_LENGTH; c++) {
      timers.current.push(window.setTimeout(() => play('flip'), c * STAGGER_MS))
    }
    const total = (WORD_LENGTH - 1) * STAGGER_MS + FLIP_MS
    timers.current.push(
      window.setTimeout(() => {
        revealingRef.current = false
        setRevealing(false)
        finishEnd()
      }, total),
    )
  }, [commitGuess, commitState, play, recordEnd, reducedRef, storageKey])

  const typeLetter = useCallback(
    (letter: string) => {
      const s = stateRef.current
      if (!s || s.status !== 'playing' || revealingRef.current) return
      if (guessRef.current.length >= WORD_LENGTH) return
      commitGuess(guessRef.current + letter.toLowerCase())
    },
    [commitGuess],
  )

  const backspace = useCallback(() => {
    if (revealingRef.current) return
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

  const hint = 'Type a 5-letter word and press Enter. Green = right spot, yellow = wrong spot.'

  if (!state) {
    return (
      <GameShell
        stats={[
          { label: 'Wins', value: stats.wins },
          { label: 'Streak', value: stats.streak },
        ]}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="mx-auto aspect-[5/6] w-full max-w-[21rem] rounded-xl bg-surface" data-testid="wordguess-loading" />
      </GameShell>
    )
  }

  const keyStates = bestKeyStates(state)
  const activeRow = state.guesses.length
  const gameOver = state.status !== 'playing'

  return (
    <GameShell
      stats={[
        { label: 'Wins', value: stats.wins },
        { label: 'Streak', value: stats.streak },
      ]}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      {/* Scoped flip keyframe — applied only when motion is allowed. */}
      <style>{`
        @keyframes wg-flip {
          0% { transform: rotateX(0deg); }
          50% { transform: rotateX(90deg); }
          100% { transform: rotateX(0deg); }
        }
        .wg-reveal { animation: wg-flip ${FLIP_MS}ms ease both; }
      `}</style>

      <div
        className="anim-board-in mx-auto grid w-full max-w-[21rem] gap-1.5"
        data-testid="wordguess-board"
      >
        {Array.from({ length: MAX_GUESSES }, (_, r) => {
          const submitted = state.guesses[r]
          const isActive = r === activeRow && !gameOver
          const isRevealing = r === revealRow && revealing
          return (
            <div
              // Re-mount the active row on each invalid submit so the shake replays.
              key={isActive ? `active-${shakeKey}` : `row-${r}`}
              className={`grid grid-cols-5 gap-1.5 ${isActive && shakeKey > 0 ? 'anim-shake' : ''}`}
              data-testid="wordguess-row"
            >
              {Array.from({ length: WORD_LENGTH }, (_, c) => {
                let letter = ''
                let stateClass = 'border-2 border-white/15 bg-transparent text-fg'
                let reveal = ''

                if (submitted) {
                  letter = submitted.word[c].toUpperCase()
                  stateClass = TILE_STATE[submitted.result[c]]
                  if (isRevealing) reveal = 'wg-reveal'
                } else if (isActive) {
                  const ch = guess[c]
                  if (ch) {
                    letter = ch.toUpperCase()
                    stateClass = 'border-2 border-white/40 bg-transparent text-fg anim-pop'
                  }
                }

                return (
                  <div
                    key={c}
                    data-testid="wordguess-tile"
                    className={`flex aspect-square items-center justify-center rounded-md text-2xl font-bold uppercase select-none ${stateClass} ${reveal}`}
                    style={reveal ? { animationDelay: `${c * STAGGER_MS}ms` } : undefined}
                  >
                    {letter}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* On-screen keyboard */}
      <div className="mx-auto mt-4 flex w-full max-w-[24rem] flex-col gap-1.5" data-testid="wordguess-keyboard">
        {KEY_ROWS.map((row, i) => (
          <div key={row} className="flex justify-center gap-1">
            {i === 2 && (
              <KeyButton label="Enter" wide onClick={handleSubmit} testId="wordguess-key-enter" />
            )}
            {row.split('').map((letter) => (
              <KeyButton
                key={letter}
                label={letter}
                stateClass={keyStates.get(letter) ? KEY_STATE[keyStates.get(letter)!] : undefined}
                onClick={() => typeLetter(letter)}
                testId={`wordguess-key-${letter}`}
              />
            ))}
            {i === 2 && (
              <KeyButton label="⌫" wide onClick={backspace} testId="wordguess-key-back" ariaLabel="Backspace" />
            )}
          </div>
        ))}
      </div>

      {/* Overlays are gated on !revealing so they appear after the flip. */}
      <GameOverlay
        show={state.status === 'won' && !revealing}
        variant="win"
        title="You got it!"
        testId="wordguess-win"
      >
        <p className="text-fg-muted">
          Solved in {state.guesses.length} {state.guesses.length === 1 ? 'guess' : 'guesses'}
        </p>
        <GameButton onClick={restart} className="px-4 py-2">
          New Game
        </GameButton>
      </GameOverlay>

      <GameOverlay
        show={state.status === 'lost' && !revealing}
        variant="lose"
        title="Out of guesses"
        testId="wordguess-lose"
      >
        <p className="text-fg-muted">
          The word was <span className="font-bold uppercase tracking-wide text-fg">{state.answer}</span>
        </p>
        <GameButton onClick={restart} className="px-4 py-2">
          Try again
        </GameButton>
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
      className={`btn-press flex h-12 items-center justify-center rounded-md text-sm font-semibold uppercase ${
        wide ? 'px-3 text-xs' : 'flex-1'
      } ${stateClass ?? 'bg-white/10 text-fg hover:bg-white/20'}`}
    >
      {label}
    </button>
  )
}
