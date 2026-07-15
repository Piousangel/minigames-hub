'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  checkSelection,
  foundCount,
  isComplete,
  lineBetween,
  newGame,
  type Cell,
  type WordSearchState,
} from '@/lib/games/wordsearch/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function loadBest(storageKey: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const n = Number(JSON.parse(raw))
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

// A distinct neon hue per found word so overlapping highlights stay legible.
const FOUND_HUES = [150, 190, 275, 330, 45, 220, 15, 100]

const cellKey = (cell: Cell) => `${cell.r},${cell.c}`

// Component-scoped keyframes — no globals.css edits. Prefixed to avoid clashes.
const SCOPED_CSS = `
@keyframes ws-pop { 0% { transform: scale(1); } 45% { transform: scale(1.28); } 100% { transform: scale(1); } }
@keyframes ws-flash { 0%,100% { filter: brightness(1); } 40% { filter: brightness(1.85); } }
@keyframes ws-strike { from { width: 0; } to { width: 100%; } }
.ws-cell-pop { animation: ws-pop 0.32s ease-out; }
.ws-solved-flash { animation: ws-flash 0.55s ease-in-out; }
.ws-strike-line { animation: ws-strike 0.28s ease-out forwards; }
@media (prefers-reduced-motion: reduce) {
  .ws-cell-pop, .ws-solved-flash { animation: none; }
  .ws-strike-line { animation: none; width: 100%; }
}
`

export function GameWordSearch({ storageKey }: { storageKey: string }) {
  // SSR-safe: the board is generated on the client only, after mount.
  const [state, setState] = useState<WordSearchState | null>(null)
  const [solved, setSolved] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [best, setBest] = useState<number | null>(null)
  const [genKey, setGenKey] = useState(0)

  // Live drag selection (ordered line of cells) and the last-popped word cells.
  const [selection, setSelection] = useState<Cell[]>([])
  const [popCells, setPopCells] = useState<Set<string>>(new Set())
  const [popKey, setPopKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  // Refs for reading the latest values inside pointer handlers.
  const stateRef = useRef<WordSearchState | null>(null)
  const solvedRef = useRef(false)
  const startRef = useRef(0)
  const draggingRef = useRef(false)
  const anchorRef = useRef<Cell | null>(null)
  const lastPlayedLenRef = useRef(0)
  const boardRef = useRef<HTMLDivElement | null>(null)

  const commit = useCallback((next: WordSearchState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Load persisted best time once.
  useEffect(() => {
    setBest(loadBest(storageKey))
  }, [storageKey])

  // Generate a board on the client whenever New Game is pressed.
  useEffect(() => {
    setState(null)
    stateRef.current = null
    let cancelled = false
    const id = window.setTimeout(() => {
      if (cancelled) return
      const g = newGame(Math.random)
      startRef.current = Date.now()
      solvedRef.current = false
      commit(g)
      setSolved(false)
      setElapsed(0)
      setSelection([])
      setPopCells(new Set())
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [genKey, commit])

  // Wall-clock timer, counting up while unsolved.
  useEffect(() => {
    if (!state || solved) return
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 250)
    return () => window.clearInterval(id)
  }, [state, solved])

  const startNewGame = useCallback(() => setGenKey((k) => k + 1), [])

  // Map a pointer position to a grid cell via the DOM (works for mouse + touch).
  const cellFromPoint = useCallback((x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-r][data-c]')
    if (!el) return null
    const r = Number(el.dataset.r)
    const c = Number(el.dataset.c)
    if (Number.isNaN(r) || Number.isNaN(c)) return null
    return { r, c }
  }, [])

  const updateSelection = useCallback((end: Cell) => {
    const anchor = anchorRef.current
    if (!anchor) return
    const line = lineBetween(anchor, end)
    const next = line ?? [anchor]
    setSelection(next)
    // Play a soft tick as the selection grows in length.
    if (next.length !== lastPlayedLenRef.current) {
      if (next.length > lastPlayedLenRef.current) play('flip')
      lastPlayedLenRef.current = next.length
    }
  }, [play])

  const onCellPointerDown = useCallback(
    (e: React.PointerEvent, r: number, c: number) => {
      if (!stateRef.current || solvedRef.current) return
      e.preventDefault()
      draggingRef.current = true
      anchorRef.current = { r, c }
      lastPlayedLenRef.current = 1
      setSelection([{ r, c }])
      try {
        boardRef.current?.setPointerCapture(e.pointerId)
      } catch {
        /* setPointerCapture can throw on some browsers — drag still works via move */
      }
    },
    [],
  )

  const onBoardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return
      const cell = cellFromPoint(e.clientX, e.clientY)
      if (cell) updateSelection(cell)
    },
    [cellFromPoint, updateSelection],
  )

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return
      draggingRef.current = false
      try {
        boardRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const cells = selection
      anchorRef.current = null
      setSelection([])
      lastPlayedLenRef.current = 0

      const s = stateRef.current
      if (!s || solvedRef.current || cells.length < 2) return

      const { state: next, matched } = checkSelection(s, cells)
      if (!matched) {
        play('error')
        return
      }
      commit(next)
      play(foundCount(next) % 2 === 0 ? 'match' : 'eat')
      if (!reducedRef.current) {
        setPopCells(new Set(matched.cells.map(cellKey)))
        setPopKey((k) => k + 1)
      }
      if (isComplete(next)) {
        solvedRef.current = true
        setSolved(true)
        const finalTime = Math.floor((Date.now() - startRef.current) / 1000)
        setElapsed(finalTime)
        play('win')
      }
    },
    [selection, play, commit, reducedRef],
  )

  // Persist best time on solve.
  useEffect(() => {
    if (!solved) return
    setBest((prev) => {
      if (prev !== null && prev <= elapsed) return prev
      try {
        localStorage.setItem(storageKey, JSON.stringify(elapsed))
      } catch {
        /* ignore quota errors */
      }
      return elapsed
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved])

  const selectionSet = useMemo(() => new Set(selection.map(cellKey)), [selection])

  // Map each cell to the hue of the (first) found word covering it.
  const foundCellHue = useMemo(() => {
    const map = new Map<string, number>()
    if (!state) return map
    state.words.forEach((w, wi) => {
      if (!w.found) return
      const hue = FOUND_HUES[wi % FOUND_HUES.length]
      for (const cell of w.cells) {
        if (!map.has(cellKey(cell))) map.set(cellKey(cell), hue)
      }
    })
    return map
  }, [state])

  const found = state ? foundCount(state) : 0
  const total = state ? state.words.length : 0
  const stats = [{ label: 'Found', value: found, testId: 'found' }]

  const timeChip = (
    <div className="rounded-lg bg-surface px-3 py-1.5 text-sm">
      Time{' '}
      <span className="font-bold tabular-nums" data-testid="time">
        {fmtTime(elapsed)}
      </span>
    </div>
  )
  const bestChip = (
    <div className="rounded-lg bg-surface px-3 py-1.5 text-sm">
      Best{' '}
      <span className="font-bold tabular-nums" data-testid="best-time">
        {best !== null ? fmtTime(best) : '—'}
      </span>
    </div>
  )

  const hint = 'Drag across letters — horizontal, vertical, or diagonal, in either direction — to find every hidden word.'

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
        maxWidthClassName="max-w-[34rem]"
      >
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="wordsearch-loading" />
      </GameShell>
    )
  }

  const size = state.size

  return (
    <GameShell
      stats={stats}
      headerExtra={
        <>
          <div className="rounded-lg bg-surface px-3 py-1.5 text-sm">
            of <span className="font-bold tabular-nums">{total}</span>
          </div>
          {timeChip}
          {bestChip}
        </>
      }
      onNewGame={startNewGame}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-[34rem]"
    >
      <style>{SCOPED_CSS}</style>

      <div
        ref={boardRef}
        data-testid="wordsearch-board"
        role="grid"
        aria-label="Word search board"
        onPointerMove={onBoardPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`anim-board-in relative mx-auto grid w-full touch-none select-none rounded-xl border-2 border-white/25 bg-surface p-1.5 ${
          solved && !reducedRef.current ? 'ws-solved-flash' : ''
        }`}
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {state.grid.map((row, r) =>
          row.map((letter, c) => {
            const key = `${r},${c}`
            const inSelection = selectionSet.has(key)
            const hue = foundCellHue.get(key)
            const isPopped = popCells.has(key)

            let bg = 'bg-white/[0.03] text-fg'
            const style: React.CSSProperties = {}
            if (inSelection) {
              bg = 'text-stone-900 font-bold'
              style.background = 'var(--accent, #fbbf24)'
              style.boxShadow = '0 0 10px rgba(251,191,36,0.6)'
            } else if (hue !== undefined) {
              bg = 'font-bold'
              style.background = `hsl(${hue} 70% 45% / 0.55)`
              style.color = '#fff'
            }

            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                data-r={r}
                data-c={c}
                data-testid="wordsearch-cell"
                aria-label={`row ${r + 1}, column ${c + 1}: ${letter}`}
                onPointerDown={(e) => onCellPointerDown(e, r, c)}
                style={style}
                className={`relative flex aspect-square items-center justify-center rounded-[3px] text-[clamp(0.7rem,2.6vw,1.05rem)] font-semibold uppercase outline-none transition-colors ${bg}`}
              >
                <span
                  key={isPopped ? popKey : 'v'}
                  className={isPopped && !reducedRef.current ? 'ws-cell-pop block' : 'block'}
                >
                  {letter}
                </span>
              </button>
            )
          }),
        )}

        <GameOverlay show={solved} variant="win" title="Solved!" testId="wordsearch-win">
          <p className="text-lg font-semibold text-fg">
            All {total} words · {fmtTime(elapsed)}
          </p>
          <GameButton onClick={startNewGame} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>
      </div>

      {/* Word list — strike through found words. */}
      <ul
        className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5"
        data-testid="wordsearch-wordlist"
        aria-label="Words to find"
      >
        {state.words.map((w, wi) => {
          const hue = FOUND_HUES[wi % FOUND_HUES.length]
          return (
            <li
              key={w.word}
              data-testid="wordsearch-word"
              data-found={w.found ? 'true' : 'false'}
              className={`relative text-sm font-bold uppercase tracking-wide transition-colors ${
                w.found ? 'text-fg-muted' : 'text-fg'
              }`}
              style={w.found ? { color: `hsl(${hue} 70% 62%)` } : undefined}
            >
              <span className="relative inline-block">
                {w.word}
                {w.found && (
                  <span
                    aria-hidden="true"
                    className="ws-strike-line absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded"
                    style={{ background: `hsl(${hue} 70% 62%)` }}
                  />
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </GameShell>
  )
}
