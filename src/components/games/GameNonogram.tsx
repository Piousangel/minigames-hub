'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clueEquals,
  colFilledClue,
  EMPTY,
  FILLED,
  findMistakes,
  isSolved,
  MARKED,
  newGame,
  rowFilledClue,
  setCell,
  SIZES,
  type Cell,
  type Difficulty,
  type NonogramState,
} from '@/lib/games/nonogram/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const DIFFICULTIES: Difficulty[] = ['easy', 'hard']
const DIFF_LABEL: Record<Difficulty, string> = { easy: `Easy ${SIZES.easy}×${SIZES.easy}`, hard: `Hard ${SIZES.hard}×${SIZES.hard}` }

type Mode = 'fill' | 'mark'

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

type BestTimes = Partial<Record<Difficulty, number>>

function loadBest(storageKey: string): BestTimes {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') return parsed as BestTimes
  } catch {
    /* ignore malformed storage */
  }
  return {}
}

// Component-scoped keyframes (no globals.css edits). Prefixed to avoid clashes.
const SCOPED_CSS = `
@keyframes nono-pop { 0% { transform: scale(0.55); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes nono-flash { 0%,100% { filter: brightness(1); } 40% { filter: brightness(1.8); } }
.nono-cell-fill { animation: nono-pop 0.18s ease-out; }
.nono-solved-flash { animation: nono-flash 0.5s ease-in-out; }
@media (prefers-reduced-motion: reduce) {
  .nono-cell-fill, .nono-solved-flash { animation: none; }
}
`

export function GameNonogram({ storageKey }: { storageKey: string }) {
  // SSR-safe: puzzle is generated on the client only, after mount.
  const [state, setState] = useState<NonogramState | null>(null)
  const [mode, setMode] = useState<Mode>('fill')
  const [solved, setSolved] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null)

  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [genKey, setGenKey] = useState(0)
  const [best, setBest] = useState<BestTimes>({})

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  // Refs for reading latest values inside pointer handlers.
  const stateRef = useRef<NonogramState | null>(null)
  const modeRef = useRef<Mode>('fill')
  const solvedRef = useRef(false)
  const startRef = useRef(0)
  const draggingRef = useRef(false)
  const dragValueRef = useRef<Cell>(EMPTY)
  const boardRef = useRef<HTMLDivElement | null>(null)

  const commit = useCallback((next: NonogramState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Load persisted best times once.
  useEffect(() => {
    setBest(loadBest(storageKey))
  }, [storageKey])

  // Generate a puzzle on the client whenever difficulty or genKey changes.
  useEffect(() => {
    setState(null)
    stateRef.current = null
    let cancelled = false
    const id = window.setTimeout(() => {
      if (cancelled) return
      const g = newGame(Math.random, difficulty)
      startRef.current = Date.now()
      solvedRef.current = false
      commit(g)
      setSolved(false)
      setElapsed(0)
      setHover(null)
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [difficulty, genKey, commit])

  // Wall-clock timer, counting up while unsolved.
  useEffect(() => {
    if (!state || solved) return
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 250)
    return () => window.clearInterval(id)
  }, [state, solved])

  const startNewGame = useCallback(() => setGenKey((k) => k + 1), [])
  const chooseDifficulty = useCallback((d: Difficulty) => setDifficulty(d), [])
  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next = m === 'fill' ? 'mark' : 'fill'
      modeRef.current = next
      return next
    })
  }, [])

  // Track the most-recently-filled cell to play the pop animation once.
  const [popKey, setPopKey] = useState(0)
  const popCellRef = useRef<string | null>(null)

  // Paint a single cell to an explicit value (used by click and drag).
  const paintCell = useCallback(
    (r: number, c: number, value: Cell) => {
      const s = stateRef.current
      if (!s || solvedRef.current) return
      if (s.grid[r][c] === value) return
      const next = setCell(s, r, c, value)
      commit(next)

      if (value === FILLED) {
        play('move')
        if (!reducedRef.current) {
          popCellRef.current = `${r},${c}`
          setPopKey((k) => k + 1)
        }
      } else if (value === MARKED) {
        play('flag')
      } else {
        play('flip')
      }

      if (isSolved(next)) {
        solvedRef.current = true
        setSolved(true)
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
        play('win')
      }
    },
    [commit, play, reducedRef],
  )

  // The value a click should produce, given the current cell + mode.
  const actionValue = useCallback((current: Cell): Cell => {
    if (modeRef.current === 'fill') return current === FILLED ? EMPTY : FILLED
    return current === MARKED ? EMPTY : MARKED
  }, [])

  const onCellPointerDown = useCallback(
    (e: React.PointerEvent, r: number, c: number) => {
      const s = stateRef.current
      if (!s || solvedRef.current) return
      e.preventDefault()
      const value = actionValue(s.grid[r][c])
      dragValueRef.current = value
      draggingRef.current = true
      // Capture on the board so we keep receiving move/up (incl. touch).
      try {
        boardRef.current?.setPointerCapture(e.pointerId)
      } catch {
        /* setPointerCapture can throw on some browsers — drag still works via move */
      }
      paintCell(r, c, value)
    },
    [actionValue, paintCell],
  )

  // Drag-fill: while a pointer is down, paint any cell it passes over.
  const onBoardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const cell = el?.closest<HTMLElement>('[data-r][data-c]')
      if (!cell) return
      const r = Number(cell.dataset.r)
      const c = Number(cell.dataset.c)
      if (Number.isNaN(r) || Number.isNaN(c)) return
      setHover({ r, c })
      paintCell(r, c, dragValueRef.current)
    },
    [paintCell],
  )

  const endDrag = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false
    try {
      boardRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const mistakeCount = useMemo(() => (state ? findMistakes(state).length : 0), [state])

  // Which row/column clues are satisfied by the current fills (for dimming).
  const rowDone = useMemo(() => {
    if (!state) return [] as boolean[]
    return state.rowClues.map((clue, r) => clueEquals(rowFilledClue(state, r), clue))
  }, [state])
  const colDone = useMemo(() => {
    if (!state) return [] as boolean[]
    return state.colClues.map((clue, c) => clueEquals(colFilledClue(state, c), clue))
  }, [state])

  const bestForDifficulty = best[difficulty]

  // Persist best time on solve.
  useEffect(() => {
    if (!solved || !state) return
    setBest((prev) => {
      const current = prev[state.difficulty]
      if (current !== undefined && current <= elapsed) return prev
      const next = { ...prev, [state.difficulty]: elapsed }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* ignore quota errors */
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved])

  const difficultyBar = (
    <div className="mb-3 flex items-center justify-center gap-2" role="group" aria-label="Difficulty">
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          onClick={() => chooseDifficulty(d)}
          aria-pressed={difficulty === d}
          className={`btn-press rounded-lg px-3 py-1.5 text-sm font-semibold ${
            difficulty === d ? 'bg-accent text-stone-900 shadow-sm' : 'bg-surface text-fg hover:bg-white/10'
          }`}
        >
          {DIFF_LABEL[d]}
        </button>
      ))}
    </div>
  )

  const timeChip = (
    <div className="rounded-lg bg-surface px-3 py-1.5">
      Time{' '}
      <span className="font-bold tabular-nums" data-testid="time">
        {fmtTime(elapsed)}
      </span>
    </div>
  )
  const bestChip = (
    <div className="rounded-lg bg-surface px-3 py-1.5">
      Best{' '}
      <span className="font-bold tabular-nums" data-testid="best-time">
        {bestForDifficulty !== undefined ? fmtTime(bestForDifficulty) : '—'}
      </span>
    </div>
  )

  const hint =
    mode === 'fill'
      ? 'The numbers on each row and column are the lengths of filled runs — read them, then tap or drag to paint. Switch to Mark to X out blanks.'
      : 'Mark mode: tap or drag to X out cells you know are blank.'

  const stats = [{ label: 'Mistakes', value: mistakeCount, testId: 'mistakes' }]

  const boardWidth = difficulty === 'hard' ? 'max-w-[34rem]' : 'max-w-[22rem]'

  if (!state) {
    return (
      <GameShell
        stats={stats}
        headerExtra={
          <>
            {timeChip}
            {bestChip}
          </>
        }
        onNewGame={startNewGame}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
        maxWidthClassName={boardWidth}
      >
        {difficultyBar}
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="nonogram-loading" />
      </GameShell>
    )
  }

  const size = state.size
  const maxRowClue = Math.max(1, ...state.rowClues.map((c) => c.length))
  const maxColClue = Math.max(1, ...state.colClues.map((c) => c.length))

  // A single CSS grid: a clue gutter on the left/top, then the size×size board.
  const gridTemplateColumns = `minmax(2rem, auto) repeat(${size}, minmax(0, 1fr))`
  const gridTemplateRows = `minmax(2rem, auto) repeat(${size}, minmax(0, 1fr))`

  return (
    <GameShell
      stats={stats}
      headerExtra={
        <>
          {timeChip}
          {bestChip}
        </>
      }
      onNewGame={startNewGame}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName={boardWidth}
    >
      <style>{SCOPED_CSS}</style>
      {difficultyBar}

      <div className="mb-3 flex justify-center">
        <div className="inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Paint mode">
          <button
            type="button"
            onClick={() => {
              setMode('fill')
              modeRef.current = 'fill'
            }}
            aria-pressed={mode === 'fill'}
            className={`btn-press px-4 py-1.5 text-sm font-semibold ${
              mode === 'fill' ? 'bg-accent text-stone-900' : 'bg-surface text-fg hover:bg-white/10'
            }`}
          >
            ■ Fill
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('mark')
              modeRef.current = 'mark'
            }}
            aria-pressed={mode === 'mark'}
            className={`btn-press px-4 py-1.5 text-sm font-semibold ${
              mode === 'mark' ? 'bg-accent text-stone-900' : 'bg-surface text-fg hover:bg-white/10'
            }`}
          >
            ✕ Mark
          </button>
        </div>
      </div>

      <div
        ref={boardRef}
        data-testid="nonogram-board"
        role="grid"
        aria-label="Nonogram board"
        onPointerMove={onBoardPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHover(null)}
        className={`anim-board-in relative mx-auto grid w-full touch-none select-none rounded-xl border-2 border-white/25 bg-surface p-1 ${solved && !reducedRef.current ? 'nono-solved-flash' : ''}`}
        style={{ gridTemplateColumns, gridTemplateRows }}
      >
        {/* Corner spacer */}
        <div className="bg-transparent" aria-hidden="true" />

        {/* Column clues (top gutter) */}
        {Array.from({ length: size }, (_, c) => {
          const clue = state.colClues[c]
          const done = colDone[c]
          const hot = hover?.c === c
          return (
            <div
              key={`cc-${c}`}
              className={`flex min-h-8 flex-col items-center justify-end gap-0.5 pb-1 text-xs font-bold tabular-nums transition-colors ${
                hot ? 'bg-accent/10' : ''
              } ${done ? 'text-fg-muted/45' : 'text-fg'}`}
              style={{ minHeight: `${maxColClue * 1.05 + 0.5}rem` }}
            >
              {clue.map((n, i) => (
                <span key={i}>{n}</span>
              ))}
            </div>
          )
        })}

        {/* Rows: a left clue gutter + the cells */}
        {Array.from({ length: size }, (_, r) => {
          const rClue = state.rowClues[r]
          const rDone = rowDone[r]
          const rHot = hover?.r === r
          return (
            <RowFragment key={`row-${r}`}>
              <div
                className={`flex items-center justify-end gap-1 pr-1.5 text-xs font-bold tabular-nums transition-colors ${
                  rHot ? 'bg-accent/10' : ''
                } ${rDone ? 'text-fg-muted/45' : 'text-fg'}`}
                style={{ minWidth: `${maxRowClue * 0.85 + 0.5}rem` }}
              >
                {rClue.map((n, i) => (
                  <span key={i}>{n}</span>
                ))}
              </div>

              {Array.from({ length: size }, (_, c) => {
                const v = state.grid[r][c]
                const inHoverLine = hover && (hover.r === r || hover.c === c)
                const isPopped = popCellRef.current === `${r},${c}`
                // Bold 5-cell separators for readability on the 10×10 board.
                const rSep = (c + 1) % 5 === 0 && c !== size - 1 ? 'border-r-2 border-r-white/25' : 'border-r border-r-white/10'
                const bSep = (r + 1) % 5 === 0 && r !== size - 1 ? 'border-b-2 border-b-white/25' : 'border-b border-b-white/10'

                let bg = 'bg-white/[0.03]'
                if (v === FILLED) bg = 'bg-accent'
                else if (inHoverLine) bg = 'bg-accent/10'

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    role="gridcell"
                    data-r={r}
                    data-c={c}
                    data-testid="nonogram-cell"
                    data-value={v === FILLED ? 'filled' : v === MARKED ? 'marked' : 'empty'}
                    aria-label={`row ${r + 1}, column ${c + 1}: ${v === FILLED ? 'filled' : v === MARKED ? 'marked' : 'empty'}`}
                    onPointerDown={(e) => onCellPointerDown(e, r, c)}
                    onPointerEnter={() => setHover({ r, c })}
                    className={`relative flex aspect-square items-center justify-center text-sm outline-none ${rSep} ${bSep} ${bg}`}
                  >
                    <span
                      key={isPopped ? popKey : 'v'}
                      className={`${v === FILLED && isPopped ? 'nono-cell-fill block h-full w-full' : ''}`}
                    >
                      {v === MARKED ? <span className="text-fg-muted">✕</span> : null}
                    </span>
                  </button>
                )
              })}
            </RowFragment>
          )
        })}

        <GameOverlay show={solved} variant="win" title="Solved!" testId="you-win">
          <p className="text-lg font-semibold text-fg">
            {DIFF_LABEL[state.difficulty]} · {fmtTime(elapsed)}
          </p>
          <GameButton onClick={startNewGame} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}

// Fragment wrapper so each row's clue + cells sit as direct grid children.
function RowFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
