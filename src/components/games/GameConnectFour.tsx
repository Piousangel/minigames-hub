'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  aiMove,
  COLS,
  dropDisc,
  isDraw,
  lowestEmptyRow,
  newGame,
  ROWS,
  winner,
  type Difficulty,
  type GameState,
} from '@/lib/games/connectfour/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const DROP_MS = 440
const CPU_DELAY = 560
const CPU_DELAY_REDUCED = 220

interface Record {
  w: number // player wins
  l: number // computer wins
  d: number // draws
}
const EMPTY_RECORD: Record = { w: 0, l: 0, d: 0 }

interface LastDrop {
  row: number
  col: number
  key: number
}

// Fall keyframes are component-scoped so globals.css stays untouched. The
// per-disc start offset is passed via the `--c4-fall` custom property.
const DROP_STYLE = `
@keyframes c4-drop {
  0%   { transform: translateY(var(--c4-fall)); }
  55%  { transform: translateY(0); }
  70%  { transform: translateY(-9%); }
  85%  { transform: translateY(3%); }
  100% { transform: translateY(0); }
}`

const cols = Array.from({ length: COLS }, (_, i) => i)
const rows = Array.from({ length: ROWS }, (_, i) => i)

export function GameConnectFour({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<GameState | null>(null)
  const [record, setRecord] = useState<Record>(EMPTY_RECORD)
  const [difficulty, setDifficulty] = useState<Difficulty>('hard')
  const [thinking, setThinking] = useState(false)
  const [lastDrop, setLastDrop] = useState<LastDrop | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const recordRef = useRef<Record>(EMPTY_RECORD)
  const difficultyRef = useRef<Difficulty>('hard')
  const thinkingRef = useRef(false)
  const dropKeyRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  const commitState = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const bumpRecord = useCallback(
    (key: keyof Record) => {
      const next = { ...recordRef.current, [key]: recordRef.current[key] + 1 }
      recordRef.current = next
      setRecord(next)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // ignore storage failures (private mode, quota)
      }
    },
    [storageKey],
  )

  // Apply end-of-game side effects (sound + record). Returns true if terminal.
  const resolve = useCallback(
    (s: GameState): boolean => {
      const win = winner(s)
      if (win) {
        if (win.player === 'R') {
          play('win')
          bumpRecord('w')
        } else {
          play('lose')
          bumpRecord('l')
        }
        return true
      }
      if (isDraw(s)) {
        play('match')
        bumpRecord('d')
        return true
      }
      return false
    },
    [bumpRecord, play],
  )

  // Perform a single disc drop; returns whether it moved and whether it ended the game.
  const doDrop = useCallback(
    (col: number): { moved: boolean; over: boolean } => {
      const s = stateRef.current
      if (!s) return { moved: false, over: false }
      const row = lowestEmptyRow(s.board, col)
      const next = dropDisc(s, col)
      if (next === s) return { moved: false, over: false }
      play('move')
      setLastDrop({ row, col, key: ++dropKeyRef.current })
      commitState(next)
      return { moved: true, over: resolve(next) }
    },
    [commitState, play, resolve],
  )

  const scheduleCpu = useCallback(() => {
    clearTimer()
    const delay = reducedRef.current ? CPU_DELAY_REDUCED : CPU_DELAY
    timerRef.current = window.setTimeout(() => {
      const s = stateRef.current
      if (s && s.current === 'Y') {
        const col = aiMove(s, difficultyRef.current, Math.random)
        if (col >= 0) doDrop(col)
      }
      thinkingRef.current = false
      setThinking(false)
    }, delay)
  }, [clearTimer, doDrop, reducedRef])

  const onColumn = useCallback(
    (col: number) => {
      const s = stateRef.current
      if (!s || thinkingRef.current) return
      if (s.current !== 'R' || winner(s) || isDraw(s)) return
      const { moved, over } = doDrop(col)
      if (!moved || over) return
      thinkingRef.current = true
      setThinking(true)
      scheduleCpu()
    },
    [doDrop, scheduleCpu],
  )

  const restart = useCallback(() => {
    clearTimer()
    thinkingRef.current = false
    setThinking(false)
    setLastDrop(null)
    commitState(newGame())
  }, [clearTimer, commitState])

  // Init on client + hydrate the wins record.
  useEffect(() => {
    restart()
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record>
        const loaded: Record = {
          w: Number(parsed.w) || 0,
          l: Number(parsed.l) || 0,
          d: Number(parsed.d) || 0,
        }
        recordRef.current = loaded
        setRecord(loaded)
      }
    } catch {
      // ignore malformed storage
    }
    return clearTimer
  }, [restart, storageKey, clearTimer])

  useEffect(() => {
    difficultyRef.current = difficulty
  }, [difficulty])

  const win = state ? winner(state) : null
  const draw = state ? !win && isDraw(state) : false
  const over = !!win || draw
  const winSet = new Set(win ? win.cells.map(([r, c]) => `${r},${c}`) : [])

  const hint = over
    ? win?.player === 'R'
      ? 'You win! Start a new game.'
      : draw
        ? "It's a draw — the board is full."
        : 'Computer wins. Try again!'
    : thinking
      ? 'Computer is thinking…'
      : 'Your turn — tap a column to drop a red disc.'

  const difficultyToggle = (
    <div className="flex rounded-lg bg-surface p-0.5 text-sm" role="group" aria-label="Difficulty">
      {(['easy', 'hard'] as const).map((d) => (
        <button
          key={d}
          onClick={() => setDifficulty(d)}
          aria-pressed={difficulty === d}
          className={`btn-press rounded-md px-2.5 py-1 font-semibold capitalize ${
            difficulty === d ? 'bg-accent text-stone-900' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  )

  if (!state) {
    return (
      <GameShell
        stats={[{ label: 'You', value: 0 }]}
        headerExtra={difficultyToggle}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint="Tap a column to drop a red disc."
      >
        <div className="aspect-[7/6] w-full rounded-xl bg-surface" data-testid="c4-loading" />
      </GameShell>
    )
  }

  return (
    <GameShell
      stats={[
        { label: 'You', value: record.w, testId: 'c4-wins', float: true },
        { label: 'CPU', value: record.l },
        { label: 'Draw', value: record.d },
      ]}
      headerExtra={difficultyToggle}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-md"
    >
      <style>{DROP_STYLE}</style>
      <div className="anim-board-in relative select-none" data-testid="c4-board">
        {/* Drop arrows (column headers) */}
        <div className="grid grid-cols-7 gap-1.5 px-1.5">
          {cols.map((c) => {
            const disabled = over || thinking || state.current !== 'R' || state.board[0][c] !== null
            return (
              <button
                key={c}
                onClick={() => onColumn(c)}
                disabled={disabled}
                aria-label={`Drop a disc in column ${c + 1}`}
                className="btn-press flex items-center justify-center py-0.5 text-lg leading-none text-fg-muted transition-colors hover:text-red-500 disabled:pointer-events-none disabled:opacity-25"
              >
                <span aria-hidden="true">▼</span>
              </button>
            )
          })}
        </div>

        {/* Board frame */}
        <div className="grid grid-cols-7 gap-1.5 rounded-xl bg-surface p-1.5 shadow-inner">
          {cols.map((c) => {
            const colDisabled = over || thinking || state.current !== 'R' || state.board[0][c] !== null
            return (
              <button
                key={c}
                onClick={() => onColumn(c)}
                disabled={colDisabled}
                tabIndex={-1}
                aria-label={`Drop a disc in column ${c + 1}`}
                className="group flex flex-col gap-1.5 rounded-lg disabled:cursor-default"
              >
                {rows.map((r) => {
                  const cell = state.board[r][c]
                  const isWin = winSet.has(`${r},${c}`)
                  const isDropped = !!lastDrop && lastDrop.row === r && lastDrop.col === c && !reducedRef.current
                  return (
                    <div
                      key={r}
                      className="relative aspect-square rounded-full bg-bg/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] transition-colors group-enabled:group-hover:bg-bg/40"
                    >
                      {cell && (
                        <div
                          key={isDropped ? lastDrop.key : `${cell}`}
                          className={`absolute inset-[10%] rounded-full ${
                            cell === 'R'
                              ? 'bg-red-500 shadow-[0_2px_3px_rgba(0,0,0,0.35),inset_0_2px_2px_rgba(255,255,255,0.35)]'
                              : 'bg-yellow-400 shadow-[0_2px_3px_rgba(0,0,0,0.35),inset_0_2px_2px_rgba(255,255,255,0.45)]'
                          } ${
                            isWin
                              ? 'anim-pulse z-10 ring-2 ring-white ' +
                                (cell === 'R'
                                  ? 'shadow-[0_0_16px_rgba(239,68,68,0.9)]'
                                  : 'shadow-[0_0_16px_rgba(250,204,21,0.9)]')
                              : ''
                          }`}
                          style={
                            isDropped
                              ? ({
                                  animation: `c4-drop ${DROP_MS}ms cubic-bezier(0.34,1.2,0.64,1) both`,
                                  '--c4-fall': `-${(r + 1) * 118}%`,
                                } as React.CSSProperties)
                              : undefined
                          }
                        />
                      )}
                    </div>
                  )
                })}
              </button>
            )
          })}
        </div>

        <GameOverlay show={over && win?.player === 'R'} variant="win" title="You win!" testId="c4-result-win">
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>

        <GameOverlay show={over && win?.player === 'Y'} variant="lose" title="Computer wins" testId="c4-result-lose">
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>

        <GameOverlay show={draw} variant="lose" title="Draw" testId="c4-result-draw">
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
