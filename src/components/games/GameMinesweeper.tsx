'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  flagCount,
  MS_MINES,
  MS_SIZE,
  newMinesweeper,
  reveal,
  toggleFlag,
  type MsState,
} from '@/lib/games/minesweeper/engine'

const NUMBER_COLORS: Record<number, string> = {
  1: 'text-blue-400',
  2: 'text-green-400',
  3: 'text-red-400',
  4: 'text-purple-400',
  5: 'text-amber-500',
  6: 'text-teal-400',
  7: 'text-fg',
  8: 'text-fg-muted',
}

export function GameMinesweeper() {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<MsState | null>(null)
  const [flagMode, setFlagMode] = useState(false)

  const restart = useCallback(() => {
    setState(newMinesweeper())
    setFlagMode(false)
  }, [])

  useEffect(() => {
    restart()
  }, [restart])

  const handleCell = useCallback(
    (x: number, y: number, flag: boolean) => {
      setState((s) => {
        if (!s || s.over) return s
        return flag ? toggleFlag(s, x, y) : reveal(s, x, y, Math.random)
      })
    },
    [],
  )

  const header = (minesLeft: number) => (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex gap-2 text-sm">
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Mines <span className="font-bold" data-testid="mines-left">{minesLeft}</span>
        </div>
        <button
          onClick={() => setFlagMode((f) => !f)}
          aria-pressed={flagMode}
          className={`rounded-lg px-3 py-1.5 font-semibold ${flagMode ? 'bg-accent text-stone-900' : 'bg-surface'}`}
        >
          🚩 Flag
        </button>
      </div>
      <button
        onClick={restart}
        disabled={!state}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-stone-900"
      >
        New Game
      </button>
    </div>
  )

  const hint = (
    <p className="mt-3 text-center text-sm text-fg-muted">
      Click to reveal. Right-click (or toggle 🚩 Flag) to mark a mine.
    </p>
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        {header(MS_MINES)}
        <div className="aspect-square rounded-xl bg-surface" data-testid="ms-loading" />
        {hint}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-100 select-none">
      {header(MS_MINES - flagCount(state))}
      <div
        className="relative grid aspect-square gap-px rounded-xl bg-surface p-2"
        style={{ gridTemplateColumns: `repeat(${MS_SIZE}, minmax(0, 1fr))` }}
        data-testid="ms-board"
      >
        {state.grid.flatMap((row, y) =>
          row.map((cell, x) => (
            <button
              key={`${x},${y}`}
              data-testid="ms-cell"
              data-revealed={cell.revealed}
              onClick={() => handleCell(x, y, flagMode)}
              onContextMenu={(e) => {
                e.preventDefault()
                handleCell(x, y, true)
              }}
              className={`flex items-center justify-center rounded-[2px] text-sm font-bold ${
                cell.revealed ? 'bg-white/10' : 'bg-white/5 hover:bg-white/15'
              } ${NUMBER_COLORS[cell.adjacent] ?? ''}`}
            >
              {cell.revealed
                ? cell.mine
                  ? '💣'
                  : cell.adjacent > 0
                    ? cell.adjacent
                    : ''
                : cell.flagged
                  ? '🚩'
                  : ''}
            </button>
          )),
        )}
        {state.over && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/80"
            data-testid="game-over"
          >
            <p className="text-2xl font-bold">{state.won ? 'You win!' : 'Boom!'}</p>
            <button onClick={restart} className="rounded-lg bg-accent px-4 py-2 font-semibold text-stone-900">
              {state.won ? 'Play again' : 'Try again'}
            </button>
          </div>
        )}
      </div>
      {hint}
    </div>
  )
}
