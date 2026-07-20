'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MAX_MISSES,
  guessLetter,
  isHit,
  maskedLetters,
  newGame,
  type GameState,
} from '@/lib/games/hangman/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

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

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('')

export function GameHangman({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<GameState | null>(null)
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [shakeKey, setShakeKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const recordedRef = useRef(false)

  const commit = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const restart = useCallback(() => {
    recordedRef.current = false
    setShakeKey(0)
    commit(newGame(Math.random))
  }, [commit])

  useEffect(() => {
    restart()
    setStats(readStats(storageKey))
  }, [restart, storageKey])

  const recordEnd = useCallback(
    (won: boolean) => {
      if (recordedRef.current) return
      recordedRef.current = true
      // 개인 기록: 완료 판수/승수 + 오답 분포(misses) 누적 → 스탯 패널이 읽는다.
      // (storageKey에는 {wins,streak} JSON이 들어가지만 recordResult는 별도 stats: 키에 쓴다.)
      recordResult(storageKey.replace(/^best:/, ''), { won, bucket: stateRef.current?.misses })
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

  const doGuess = useCallback(
    (letter: string) => {
      const s = stateRef.current
      if (!s || s.status !== 'playing') return
      if (s.guessed.includes(letter.toLowerCase())) return

      const next = guessLetter(s, letter)
      if (next === s) return
      commit(next)

      const hit = isHit(s, letter)
      if (next.status === 'won') {
        play('win')
        recordEnd(true)
      } else if (next.status === 'lost') {
        play('lose')
        recordEnd(false)
      } else if (hit) {
        play('match')
      } else {
        play('error')
        // Skip the shake re-mount entirely when the user prefers reduced motion.
        if (!reducedRef.current) setShakeKey((k) => k + 1)
      }
    },
    [commit, play, recordEnd, reducedRef],
  )

  // Physical keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        doGuess(e.key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doGuess])

  const hint = 'Guess the hidden word one letter at a time. Six wrong guesses and it is game over.'

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
        <div className="mx-auto h-72 w-full max-w-100 rounded-xl bg-surface" data-testid="hangman-loading" />
      </GameShell>
    )
  }

  const mask = maskedLetters(state)
  const guessedSet = new Set(state.guessed)
  const gameOver = state.status !== 'playing'
  const remaining = MAX_MISSES - state.misses

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
      {/* Component-scoped keyframes — motion is disabled under prefers-reduced-motion. */}
      <style>{`
        @keyframes hm-draw {
          from { stroke-dashoffset: var(--len, 120); opacity: 0.2; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes hm-drop {
          0% { transform: translateY(-10px) scale(0.6); opacity: 0; }
          60% { transform: translateY(2px) scale(1.08); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .hm-part { animation: hm-draw 420ms ease forwards; }
        .hm-slot-reveal { animation: hm-drop 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .hm-part { animation: none; stroke-dashoffset: 0; opacity: 1; }
          .hm-slot-reveal { animation: none; }
        }
      `}</style>

      <div
        className={`anim-board-in mx-auto flex w-full max-w-100 flex-col items-center gap-5 rounded-xl bg-surface p-4 ${
          shakeKey > 0 ? 'anim-shake' : ''
        }`}
        // Re-mount on each wrong guess so the shake replays.
        key={`board-${shakeKey}`}
        data-testid="hangman-board"
      >
        <HangmanFigure misses={state.misses} />

        <p className="text-sm font-medium tracking-wide text-fg-muted">
          Category: <span className="font-semibold text-fg">{state.category}</span>
          <span aria-hidden="true"> · </span>
          <span className={remaining <= 2 ? 'font-semibold text-red-400' : ''}>
            {remaining} {remaining === 1 ? 'guess' : 'guesses'} left
          </span>
        </p>

        {/* Masked word */}
        <div
          className="flex flex-wrap justify-center gap-x-2 gap-y-3"
          aria-label={`Word: ${mask.map((c) => c ?? 'blank').join(', ')}`}
          data-testid="hangman-word"
        >
          {mask.map((ch, i) => {
            const missReveal = gameOver && state.status === 'lost' && !guessedSet.has(state.word[i])
            return (
              <span
                key={i}
                className="flex h-11 w-8 items-end justify-center border-b-[3px] border-white/25 pb-1"
              >
                {ch && (
                  <span
                    key={ch}
                    className={`text-2xl font-extrabold ${
                      missReveal ? 'text-red-400' : 'text-fg'
                    } ${!missReveal ? 'hm-slot-reveal' : ''}`}
                  >
                    {ch}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      </div>

      {/* A–Z letter bank */}
      <div
        className="mx-auto mt-4 grid w-full max-w-[26rem] grid-cols-7 gap-1.5"
        data-testid="hangman-keyboard"
      >
        {ALPHABET.map((letter) => {
          const used = guessedSet.has(letter)
          const hit = used && state.word.includes(letter)
          let tint = 'bg-white/10 text-fg hover:bg-white/20'
          if (used) tint = hit ? 'bg-green-600 text-white' : 'bg-stone-700 text-fg-muted'
          return (
            <button
              key={letter}
              type="button"
              disabled={used || gameOver}
              onClick={() => doGuess(letter)}
              data-testid={`hangman-key-${letter}`}
              aria-label={`Guess ${letter.toUpperCase()}`}
              className={`btn-press flex h-10 items-center justify-center rounded-md text-sm font-bold uppercase disabled:cursor-default ${tint}`}
            >
              {letter}
            </button>
          )
        })}
      </div>

      <GameOverlay
        show={state.status === 'won'}
        variant="win"
        title="You saved him!"
        testId="hangman-win"
      >
        <p className="text-fg-muted">
          The word was <span className="font-bold uppercase tracking-wide text-fg">{state.word}</span>
        </p>
        <GameButton onClick={restart} className="px-4 py-2">
          New Game
        </GameButton>
      </GameOverlay>

      <GameOverlay
        show={state.status === 'lost'}
        variant="lose"
        title="Game over"
        testId="hangman-lose"
      >
        <p className="text-fg-muted">
          The word was <span className="font-bold uppercase tracking-wide text-fg">{state.word}</span>
        </p>
        <GameButton onClick={restart} className="px-4 py-2">
          Try again
        </GameButton>
      </GameOverlay>
    </GameShell>
  )
}

/**
 * The gallows + hanging man, drawn part-by-part as misses accumulate. Each of
 * the six body parts appears on its corresponding wrong guess (1…6), animating
 * its stroke in. The static gallows is always visible.
 */
function HangmanFigure({ misses }: { misses: number }) {
  // Each entry reveals at its 1-based miss count. `len` seeds the draw dash.
  const parts: { show: number; el: React.ReactNode; len: number }[] = [
    {
      show: 1,
      len: 60,
      el: <circle cx="130" cy="70" r="18" fill="none" />,
    },
    {
      show: 2,
      len: 60,
      el: <line x1="130" y1="88" x2="130" y2="140" />,
    },
    {
      show: 3,
      len: 45,
      el: <line x1="130" y1="100" x2="104" y2="122" />,
    },
    {
      show: 4,
      len: 45,
      el: <line x1="130" y1="100" x2="156" y2="122" />,
    },
    {
      show: 5,
      len: 45,
      el: <line x1="130" y1="140" x2="108" y2="170" />,
    },
    {
      show: 6,
      len: 45,
      el: <line x1="130" y1="140" x2="152" y2="170" />,
    },
  ]

  return (
    <svg
      viewBox="0 0 200 200"
      className="h-44 w-44"
      role="img"
      aria-label={`Hangman figure: ${misses} of ${MAX_MISSES} wrong guesses`}
      data-testid="hangman-figure"
    >
      {/* Gallows — always drawn, muted stroke. */}
      <g stroke="var(--color-fg-muted, #9ca3af)" strokeWidth="5" strokeLinecap="round">
        <line x1="30" y1="185" x2="90" y2="185" />
        <line x1="55" y1="185" x2="55" y2="25" />
        <line x1="55" y1="25" x2="130" y2="25" />
        <line x1="130" y1="25" x2="130" y2="52" />
      </g>
      {/* Body parts — accent stroke, revealed and animated on each miss. */}
      <g stroke="var(--color-accent, #f59e0b)" strokeWidth="5" strokeLinecap="round" fill="none">
        {parts.map((p) =>
          misses >= p.show ? (
            <g
              key={p.show}
              className="hm-part"
              style={
                {
                  strokeDasharray: p.len,
                  strokeDashoffset: p.len,
                  ['--len' as string]: p.len,
                } as React.CSSProperties
              }
            >
              {p.el}
            </g>
          ) : null,
        )}
      </g>
    </svg>
  )
}
