'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  findConflicts,
  isSolved,
  newGame,
  setCell,
  SIZE,
  type Difficulty,
  type Grid,
  type SudokuGame,
} from '@/lib/games/sudoku/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

type CellAnim = { cls: string; key: number } | null

const idxOf = (r: number, c: number) => r * SIZE + c

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

/** True if the 9 given cells form a complete, correct (dup-free) unit. */
function unitComplete(grid: Grid, cells: Array<[number, number]>): boolean {
  const seen = new Set<number>()
  for (const [r, c] of cells) {
    const v = grid[r][c]
    if (v === 0 || seen.has(v)) return false
    seen.add(v)
  }
  return seen.size === SIZE
}

function rowCells(r: number): Array<[number, number]> {
  return Array.from({ length: SIZE }, (_, c) => [r, c] as [number, number])
}
function colCells(c: number): Array<[number, number]> {
  return Array.from({ length: SIZE }, (_, r) => [r, c] as [number, number])
}
function boxCells(r: number, c: number): Array<[number, number]> {
  const br = r - (r % 3)
  const bc = c - (c % 3)
  const out: Array<[number, number]> = []
  for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++) out.push([rr, cc])
  return out
}

export function GameSudoku({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 퍼즐 생성은 클라이언트 effect에서만 (생성이 다소 무거워 로딩 표시 후 진행)
  const [game, setGame] = useState<SudokuGame | null>(null)
  const [grid, setGrid] = useState<Grid | null>(null)
  const [givens, setGivens] = useState<boolean[][] | null>(null)
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null)
  const [notes, setNotes] = useState<number[][]>([]) // length 81, each a list of pencil digits
  const [pencil, setPencil] = useState(false)
  const [mistakes, setMistakes] = useState(0)
  const [solved, setSolved] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [anims, setAnims] = useState<CellAnim[]>([])

  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [genKey, setGenKey] = useState(0) // bump → regenerate a puzzle
  const [best, setBest] = useState<BestTimes>({})

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  // Refs for reading latest values inside keyboard / timer handlers.
  const gridRef = useRef<Grid | null>(null)
  const notesRef = useRef<number[][]>([])
  const selRef = useRef<{ r: number; c: number } | null>(null)
  const pencilRef = useRef(false)
  const solvedRef = useRef(false)
  const gameRef = useRef<SudokuGame | null>(null)
  const givensRef = useRef<boolean[][] | null>(null)
  const startRef = useRef<number>(0)
  const seqRef = useRef(0)

  const commitGrid = useCallback((g: Grid) => {
    gridRef.current = g
    setGrid(g)
  }, [])
  const commitNotes = useCallback((n: number[][]) => {
    notesRef.current = n
    setNotes(n)
  }, [])
  const commitSel = useCallback((s: { r: number; c: number } | null) => {
    selRef.current = s
    setSel(s)
  }, [])

  // Load persisted best times once.
  useEffect(() => {
    setBest(loadBest(storageKey))
  }, [storageKey])

  // Generate the puzzle on the client whenever difficulty or genKey changes.
  useEffect(() => {
    setGame(null)
    setGrid(null)
    gridRef.current = null
    let cancelled = false
    const id = window.setTimeout(() => {
      if (cancelled) return
      const g = newGame(difficulty, Math.random)
      const mask = g.puzzle.map((row) => row.map((v) => v !== 0))
      gameRef.current = g
      givensRef.current = mask
      startRef.current = Date.now()
      solvedRef.current = false
      pencilRef.current = false
      setGame(g)
      setGivens(mask)
      commitGrid(g.puzzle.map((row) => [...row]))
      commitNotes(Array.from({ length: SIZE * SIZE }, () => []))
      commitSel(null)
      setPencil(false)
      setMistakes(0)
      setSolved(false)
      setElapsed(0)
      setAnims(Array.from({ length: SIZE * SIZE }, () => null))
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [difficulty, genKey, commitGrid, commitNotes, commitSel])

  // Wall-clock timer, counting up while the game is unsolved.
  useEffect(() => {
    if (!game || solved) return
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 250)
    return () => window.clearInterval(id)
  }, [game, solved])

  const setAnimFor = useCallback(
    (updates: Array<[number, string]>) => {
      if (reducedRef.current) return
      setAnims((prev) => {
        const next = [...prev]
        for (const [i, cls] of updates) next[i] = { cls, key: ++seqRef.current }
        return next
      })
    },
    [reducedRef],
  )

  const startNewGame = useCallback(() => setGenKey((k) => k + 1), [])
  const chooseDifficulty = useCallback((d: Difficulty) => setDifficulty(d), [])

  // Core entry: place a digit into the selected (non-given) cell.
  const inputDigit = useCallback(
    (d: number) => {
      const g = gridRef.current
      const gm = gameRef.current
      const gv = givensRef.current
      const s = selRef.current
      if (!g || !gm || !gv || !s || solvedRef.current) return
      const { r, c } = s
      if (gv[r][c]) return // givens are immutable
      const i = idxOf(r, c)

      if (pencilRef.current) {
        const nn = notesRef.current.map((arr, k) => (k === i ? [...arr] : arr))
        const at = nn[i].indexOf(d)
        if (at >= 0) nn[i].splice(at, 1)
        else nn[i].push(d)
        commitNotes(nn)
        play('flip')
        return
      }

      if (g[r][c] === d) return // no change

      // Which units were already complete before the move?
      const beforeRow = unitComplete(g, rowCells(r))
      const beforeCol = unitComplete(g, colCells(c))
      const beforeBox = unitComplete(g, boxCells(r, c))

      const next = setCell(g, r, c, d)
      // Clear any pencil notes in this cell.
      if (notesRef.current[i]?.length) {
        const nn = notesRef.current.map((arr, k) => (k === i ? [] : arr))
        commitNotes(nn)
      }
      commitGrid(next)

      const correct = d === gm.solution[r][c]
      if (!correct) {
        setMistakes((m) => m + 1)
        setAnimFor([[i, 'anim-shake']])
        play('error')
      } else {
        setAnimFor([[i, 'anim-pop']])
        play('move')
      }

      // Flash newly-completed correct units.
      const flashIdx = new Set<number>()
      const addUnit = (before: boolean, cells: Array<[number, number]>) => {
        if (!before && unitComplete(next, cells)) for (const [rr, cc] of cells) flashIdx.add(idxOf(rr, cc))
      }
      addUnit(beforeRow, rowCells(r))
      addUnit(beforeCol, colCells(c))
      addUnit(beforeBox, boxCells(r, c))
      if (flashIdx.size) setAnimFor([...flashIdx].map((k) => [k, 'anim-pulse'] as [number, string]))

      if (isSolved(next)) {
        solvedRef.current = true
        setSolved(true)
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
        play('win')
        // 개인 기록: 완료 판수 누적(스도쿠는 패배 없음 → 항상 승) → 스탯 패널이 읽는다.
        recordResult(storageKey.replace(/^best:/, ''), { won: true })
      }
    },
    [commitGrid, commitNotes, play, setAnimFor],
  )

  const eraseCell = useCallback(() => {
    const g = gridRef.current
    const gv = givensRef.current
    const s = selRef.current
    if (!g || !gv || !s || solvedRef.current) return
    const { r, c } = s
    if (gv[r][c]) return
    const i = idxOf(r, c)
    const hadNotes = notesRef.current[i]?.length
    if (g[r][c] === 0 && !hadNotes) return
    if (g[r][c] !== 0) {
      commitGrid(setCell(g, r, c, 0))
      setAnimFor([[i, 'anim-pop']])
    }
    if (hadNotes) commitNotes(notesRef.current.map((arr, k) => (k === i ? [] : arr)))
  }, [commitGrid, commitNotes, setAnimFor])

  const moveSel = useCallback(
    (dr: number, dc: number) => {
      const s = selRef.current ?? { r: 0, c: 0 }
      const r = Math.max(0, Math.min(SIZE - 1, s.r + dr))
      const c = Math.max(0, Math.min(SIZE - 1, s.c + dc))
      commitSel({ r, c })
    },
    [commitSel],
  )

  // Physical keyboard support (guarded so it never fights real inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (!gameRef.current) return
      const k = e.key
      if (k >= '1' && k <= '9') {
        e.preventDefault()
        inputDigit(Number(k))
      } else if (k === 'Backspace' || k === 'Delete' || k === '0') {
        e.preventDefault()
        eraseCell()
      } else if (k === 'ArrowLeft') {
        e.preventDefault()
        moveSel(0, -1)
      } else if (k === 'ArrowRight') {
        e.preventDefault()
        moveSel(0, 1)
      } else if (k === 'ArrowUp') {
        e.preventDefault()
        moveSel(-1, 0)
      } else if (k === 'ArrowDown') {
        e.preventDefault()
        moveSel(1, 0)
      } else if (k === 'n' || k === 'N') {
        e.preventDefault()
        setPencil((p) => {
          pencilRef.current = !p
          return !p
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inputDigit, eraseCell, moveSel])

  const togglePencil = useCallback(() => {
    setPencil((p) => {
      pencilRef.current = !p
      return !p
    })
  }, [])

  // Persist best time on solve.
  useEffect(() => {
    if (!solved || !game) return
    setBest((prev) => {
      const current = prev[game.difficulty]
      if (current !== undefined && current <= elapsed) return prev
      const next = { ...prev, [game.difficulty]: elapsed }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* ignore quota errors */
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved])

  const conflicts = useMemo(() => (grid ? findConflicts(grid) : new Set<string>()), [grid])

  // Per-digit remaining counts (for fading finished digits on the number pad).
  const digitCounts = useMemo(() => {
    const counts = new Array(10).fill(0)
    if (grid) for (const row of grid) for (const v of row) counts[v]++
    return counts
  }, [grid])

  const selValue = sel && grid ? grid[sel.r][sel.c] : 0

  const bestForDifficulty = best[difficulty]

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

  const hint = 'Select a cell, then type 1-9 (or use the pad). ✏️ toggles notes, ⌫ erases.'

  const stats = [{ label: 'Mistakes', value: mistakes, testId: 'mistakes' }]

  if (!grid || !givens || !game) {
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
      >
        {difficultyBar}
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="sudoku-loading" />
      </GameShell>
    )
  }

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
    >
      {difficultyBar}

      <div
        className="anim-board-in relative mx-auto grid aspect-square w-full grid-cols-9 overflow-hidden rounded-xl border-2 border-white/30 bg-surface"
        data-testid="sudoku-board"
        role="grid"
        aria-label="Sudoku board"
      >
        {grid.map((row, r) =>
          row.map((val, c) => {
            const i = idxOf(r, c)
            const given = givens[r][c]
            const isSel = sel?.r === r && sel?.c === c
            const inPeer =
              !!sel &&
              (sel.r === r ||
                sel.c === c ||
                (Math.floor(sel.r / 3) === Math.floor(r / 3) && Math.floor(sel.c / 3) === Math.floor(c / 3)))
            const sameNumber = selValue !== 0 && val === selValue
            const conflict = conflicts.has(`${r},${c}`)
            const cellNotes = notes[i] ?? []
            const anim = anims[i]

            // Bold 3×3 box separators.
            const rBorder = c % 3 === 2 && c !== 8 ? 'border-r-2 border-r-white/30' : 'border-r border-r-white/10'
            const bBorder = r % 3 === 2 && r !== 8 ? 'border-b-2 border-b-white/30' : 'border-b border-b-white/10'

            let bg = 'bg-transparent'
            if (conflict) bg = 'bg-red-500/25'
            else if (isSel) bg = 'bg-accent/35'
            else if (sameNumber) bg = 'bg-accent/15'
            else if (inPeer) bg = 'bg-white/[0.06]'

            const textColor = conflict
              ? 'text-red-300'
              : given
                ? 'text-fg font-bold'
                : 'text-sky-300 font-semibold'

            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                aria-label={`row ${r + 1}, column ${c + 1}${val ? `, ${val}` : ', empty'}${given ? ', given' : ''}`}
                data-testid="sudoku-cell"
                data-given={given}
                onClick={() => commitSel({ r, c })}
                className={`relative flex aspect-square items-center justify-center text-xl outline-none transition-colors ${rBorder} ${bBorder} ${bg} ${textColor}`}
              >
                {val !== 0 ? (
                  <span key={anim?.key ?? 'v'} className={anim?.cls ?? ''}>
                    {val}
                  </span>
                ) : cellNotes.length > 0 ? (
                  <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-0.5 text-[0.5rem] leading-none text-fg-muted">
                    {Array.from({ length: 9 }, (_, n) => (
                      <span key={n} className="flex items-center justify-center">
                        {cellNotes.includes(n + 1) ? n + 1 : ''}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            )
          }),
        )}

        <GameOverlay show={solved} variant="win" title="Solved!" testId="you-win">
          <p className="text-lg font-semibold text-fg">
            {DIFF_LABEL[game.difficulty]} · {fmtTime(elapsed)}
          </p>
          <GameButton onClick={startNewGame} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>
      </div>

      {/* Number pad — essential for touch, mirrors the keyboard. */}
      <div className="mx-auto mt-3 flex max-w-100 flex-col gap-2">
        <div className="grid grid-cols-5 gap-1" role="group" aria-label="Number pad">
          {Array.from({ length: 9 }, (_, n) => {
            const d = n + 1
            const done = digitCounts[d] >= 9
            return (
              <button
                key={d}
                type="button"
                onClick={() => inputDigit(d)}
                disabled={solved}
                aria-label={`Enter ${d}`}
                className={`btn-press flex aspect-square items-center justify-center rounded-lg bg-surface text-lg font-bold hover:bg-white/10 disabled:opacity-50 ${
                  done ? 'text-fg-muted opacity-50' : 'text-fg'
                }`}
              >
                {d}
              </button>
            )
          })}
        </div>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={togglePencil}
            aria-pressed={pencil}
            className={`btn-press rounded-lg px-4 py-2 text-sm font-semibold ${
              pencil ? 'bg-accent text-stone-900 shadow-sm' : 'bg-surface text-fg hover:bg-white/10'
            }`}
          >
            ✏️ Notes
          </button>
          <button
            type="button"
            onClick={eraseCell}
            disabled={solved}
            aria-label="Erase"
            className="btn-press rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-fg hover:bg-white/10 disabled:opacity-50"
          >
            ⌫ Erase
          </button>
        </div>
      </div>
    </GameShell>
  )
}
