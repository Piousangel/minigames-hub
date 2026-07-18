'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  aiMove,
  applyMove,
  newGame,
  type Difficulty,
  type GameState,
} from '@/lib/games/tictactoe/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const AI_DELAY_MS = 420

interface Record {
  wins: number
  losses: number
  draws: number
}

const EMPTY_RECORD: Record = { wins: 0, losses: 0, draws: 0 }

function loadRecord(storageKey: string): Record {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return EMPTY_RECORD
    const parsed = JSON.parse(raw) as Partial<Record>
    return {
      wins: Number(parsed.wins) || 0,
      losses: Number(parsed.losses) || 0,
      draws: Number(parsed.draws) || 0,
    }
  } catch {
    return EMPTY_RECORD
  }
}

// Player is X, computer is O.
const PLAYER = 'X'
const COMPUTER = 'O'

export function GameTicTacToe({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<GameState | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('hard')
  const [record, setRecord] = useState<Record>(EMPTY_RECORD)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const difficultyRef = useRef<Difficulty>('hard')
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordedRef = useRef(false)

  const commit = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const clearAiTimer = useCallback(() => {
    if (aiTimer.current !== null) {
      clearTimeout(aiTimer.current)
      aiTimer.current = null
    }
  }, [])

  const persistResult = useCallback(
    (s: GameState) => {
      if (recordedRef.current || !s.over) return
      recordedRef.current = true
      setRecord((prev) => {
        const next: Record = {
          wins: prev.wins + (s.winner === PLAYER ? 1 : 0),
          losses: prev.losses + (s.winner === COMPUTER ? 1 : 0),
          draws: prev.draws + (s.winner === 'draw' ? 1 : 0),
        }
        localStorage.setItem(storageKey, JSON.stringify(next))
        return next
      })
      if (s.winner === PLAYER) play('win')
      else if (s.winner === COMPUTER) play('lose')
      else play('match')
    },
    [play, storageKey],
  )

  const restart = useCallback(() => {
    clearAiTimer()
    recordedRef.current = false
    commit(newGame())
  }, [clearAiTimer, commit])

  useEffect(() => {
    restart()
    setRecord(loadRecord(storageKey))
  }, [restart, storageKey])

  useEffect(() => () => clearAiTimer(), [clearAiTimer])

  // The computer (O) responds a short beat after the player moves.
  const scheduleComputer = useCallback(() => {
    clearAiTimer()
    const run = () => {
      aiTimer.current = null
      const s = stateRef.current
      if (!s || s.over || s.turn !== COMPUTER) return
      const move = aiMove(s, difficultyRef.current, Math.random)
      if (move < 0) return
      const next = applyMove(s, move)
      play('flip')
      commit(next)
      persistResult(next)
    }
    if (reducedRef.current) {
      run()
    } else {
      aiTimer.current = setTimeout(run, AI_DELAY_MS)
    }
  }, [clearAiTimer, commit, persistResult, play, reducedRef])

  const handleCell = useCallback(
    (index: number) => {
      const s = stateRef.current
      // Block clicks after game over, during the computer's turn, or on filled cells.
      if (!s || s.over || s.turn !== PLAYER || s.board[index] !== null) return
      if (aiTimer.current !== null) return
      const next = applyMove(s, index)
      if (next === s) return
      play('move')
      commit(next)
      if (next.over) {
        persistResult(next)
      } else {
        scheduleComputer()
      }
    },
    [commit, persistResult, play, scheduleComputer],
  )

  const changeDifficulty = useCallback(
    (level: Difficulty) => {
      difficultyRef.current = level
      setDifficulty(level)
      restart()
    },
    [restart],
  )

  const hint =
    difficulty === 'hard'
      ? 'You are X. Tap a square — the Hard computer is unbeatable, so aim for a draw.'
      : 'You are X. Tap a square to place your mark and beat the Easy computer.'

  const line = state?.line ?? null
  const isWinningCell = (i: number) => line !== null && line.includes(i)

  const overlay = (() => {
    if (!state || !state.over) return null
    if (state.winner === PLAYER) {
      return { variant: 'win' as const, title: 'You win!', testId: 'you-win' }
    }
    if (state.winner === COMPUTER) {
      return { variant: 'lose' as const, title: 'Computer wins', testId: 'you-lose' }
    }
    return { variant: 'lose' as const, title: "It's a draw", testId: 'draw' }
  })()

  const difficultyToggle = (
    <div className="flex overflow-hidden rounded-lg bg-surface p-0.5" role="group" aria-label="Difficulty">
      {(['easy', 'hard'] as const).map((level) => (
        <button
          key={level}
          onClick={() => changeDifficulty(level)}
          aria-pressed={difficulty === level}
          className={`btn-press rounded-md px-2.5 py-1 text-sm font-semibold capitalize transition-colors ${
            difficulty === level ? 'bg-accent text-stone-900' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {level}
        </button>
      ))}
    </div>
  )

  const stats = [
    { label: 'Wins', value: record.wins, testId: 'wins' as const },
    { label: 'Losses', value: record.losses },
    { label: 'Draw', value: record.draws },
  ]

  if (!state) {
    return (
      <GameShell
        stats={stats}
        headerExtra={difficultyToggle}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="mx-auto aspect-square w-full max-w-80 rounded-xl bg-surface" data-testid="ttt-loading" />
      </GameShell>
    )
  }

  return (
    <GameShell
      stats={stats}
      headerExtra={difficultyToggle}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <div
        className="anim-board-in relative mx-auto grid aspect-square w-full max-w-80 grid-cols-3 gap-2 rounded-xl bg-surface p-2"
        data-testid="ttt-board"
      >
        {state.board.map((cell, i) => {
          const winning = isWinningCell(i)
          const clickable = !state.over && state.turn === PLAYER && cell === null
          return (
            <button
              key={i}
              type="button"
              data-testid="ttt-cell"
              aria-label={`Square ${i + 1}${cell ? `, ${cell}` : ', empty'}`}
              disabled={!clickable}
              onClick={() => handleCell(i)}
              className={`flex aspect-square items-center justify-center rounded-lg text-5xl font-extrabold transition-colors ${
                winning
                  ? 'bg-accent/20 shadow-[0_0_18px_rgba(245,158,11,0.55)]'
                  : 'bg-white/[0.04] enabled:hover:bg-white/[0.08]'
              } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {cell && (
                <span
                  key={cell}
                  className={`anim-spawn inline-block ${
                    cell === PLAYER ? 'text-accent' : winning ? 'text-red-400' : 'text-fg'
                  } ${winning ? 'anim-pulse' : ''}`}
                >
                  {cell}
                </span>
              )}
            </button>
          )
        })}

        {overlay && (
          <GameOverlay show variant={overlay.variant} title={overlay.title} testId={overlay.testId}>
            <GameButton onClick={restart} className="px-4 py-2">
              Play again
            </GameButton>
          </GameOverlay>
        )}
      </div>
    </GameShell>
  )
}
