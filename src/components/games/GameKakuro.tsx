'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PUZZLES,
  DIFFICULTIES,
  createBoard,
  fill,
  erase,
  toggleNote,
  runState,
  findErrors,
  isSolved,
  remainingCells,
  combos,
  type Board,
  type Difficulty,
  type Puzzle,
  type Run,
} from '@/lib/games/kakuro/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' }

// Puzzles grouped by difficulty, preserving bank order (progressive within tier).
const BY_DIFF: Record<Difficulty, Puzzle[]> = DIFFICULTIES.reduce(
  (acc, d) => {
    acc[d] = PUZZLES.filter((p) => p.difficulty === d)
    return acc
  },
  {} as Record<Difficulty, Puzzle[]>,
)

const SLUG_OF = (storageKey: string) => storageKey.replace(/^best:/, '')
const TIMES_KEY = 'kakuro:times'

function fmtTime(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// -- best-time persistence (SEPARATE key; best:<slug> stays a plain number) ---
function loadTimes(): Record<string, number> {
  try {
    const raw = localStorage.getItem(TIMES_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (o && typeof o === 'object') return o as Record<string, number>
  } catch {
    /* ignore */
  }
  return {}
}

type CellAnim = { cls: string; key: number } | null

export function GameKakuro({ storageKey }: { storageKey: string }) {
  const slug = SLUG_OF(storageKey)

  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [puzzleIdx, setPuzzleIdx] = useState(0) // index within the difficulty
  const puzzle = BY_DIFF[difficulty][puzzleIdx] ?? BY_DIFF[difficulty][0]

  const [board, setBoard] = useState<Board>(() => createBoard(puzzle))
  const [sel, setSel] = useState<number | null>(null)
  const [pencil, setPencil] = useState(false)
  const [errorCheck, setErrorCheck] = useState(false)
  const [showCombos, setShowCombos] = useState(false)
  const [solved, setSolved] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [anims, setAnims] = useState<Record<number, CellAnim>>({})

  const [mounted, setMounted] = useState(false)
  const [times, setTimes] = useState<Record<string, number>>({})

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  // Refs for the latest values inside keyboard / timer handlers.
  const boardRef = useRef(board)
  const selRef = useRef(sel)
  const pencilRef = useRef(pencil)
  const solvedRef = useRef(false)
  const puzzleRef = useRef(puzzle)
  const startRef = useRef(0)
  const seqRef = useRef(0)

  const commitBoard = useCallback((b: Board) => {
    boardRef.current = b
    setBoard(b)
  }, [])
  const commitSel = useCallback((i: number | null) => {
    selRef.current = i
    setSel(i)
  }, [])

  // Hydrate persisted best times after mount (avoids SSR mismatch).
  useEffect(() => {
    setMounted(true)
    setTimes(loadTimes())
  }, [])

  // (Re)start whenever the puzzle changes.
  useEffect(() => {
    const p = BY_DIFF[difficulty][puzzleIdx] ?? BY_DIFF[difficulty][0]
    puzzleRef.current = p
    const fresh = createBoard(p)
    commitBoard(fresh)
    // Pre-select the first white cell so the across/down run highlight + guide
    // are visible immediately — the fastest way to teach a newcomer the layout.
    commitSel(p.whites[0] ?? null)
    setPencil(false)
    pencilRef.current = false
    setSolved(false)
    solvedRef.current = false
    setElapsed(0)
    setAnims({})
    startRef.current = Date.now()
  }, [difficulty, puzzleIdx, commitBoard, commitSel])

  // Count-up timer while unsolved.
  useEffect(() => {
    if (solved) return
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 250)
    return () => window.clearInterval(id)
  }, [solved, difficulty, puzzleIdx])

  const setAnim = useCallback(
    (updates: Array<[number, string]>) => {
      if (reducedRef.current) return
      setAnims((prev) => {
        const next = { ...prev }
        for (const [i, cls] of updates) next[i] = { cls, key: ++seqRef.current }
        return next
      })
    },
    [reducedRef],
  )

  // -- persistence on solve --------------------------------------------------
  const persistSolve = useCallback(
    (p: Puzzle, seconds: number) => {
      // best:<slug> = solved-count (plain NUMBER, higher-better, leaderboard-safe).
      try {
        const prev = Number(localStorage.getItem(storageKey)) || 0
        localStorage.setItem(storageKey, String(prev + 1))
      } catch {
        /* ignore */
      }
      // Per-puzzle best time lives in its OWN key (never JSON in best:<slug>).
      setTimes((prev) => {
        const cur = prev[p.id]
        if (cur !== undefined && cur <= seconds) return prev
        const next = { ...prev, [p.id]: seconds }
        try {
          localStorage.setItem(TIMES_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
      recordResult(slug, { won: true })
    },
    [storageKey, slug],
  )

  // -- core input ------------------------------------------------------------
  const inputDigit = useCallback(
    (d: number) => {
      const p = puzzleRef.current
      const b = boardRef.current
      const i = selRef.current
      if (i === null || solvedRef.current) return
      if (p.struct[i].kind !== 'white') return

      if (pencilRef.current) {
        const nb = toggleNote(p, b, i, d)
        if (nb !== b) {
          commitBoard(nb)
          play('flip')
        }
        return
      }

      const nb = fill(p, b, i, d)
      if (nb === b) return // no change (same digit / illegal)

      const ar = p.acrossRunOf[i]
      const dr = p.downRunOf[i]
      const beforeAcross = runState(b, p.runs[ar])
      const beforeDown = runState(b, p.runs[dr])
      commitBoard(nb)

      const afterAcross = runState(nb, p.runs[ar])
      const afterDown = runState(nb, p.runs[dr])
      const madeError = afterAcross === 'error' || afterDown === 'error'
      const completedRun =
        (afterAcross === 'complete' && beforeAcross !== 'complete') ||
        (afterDown === 'complete' && beforeDown !== 'complete')

      if (isSolved(p, nb)) {
        solvedRef.current = true
        setSolved(true)
        const secs = Math.floor((Date.now() - startRef.current) / 1000)
        setElapsed(secs)
        play('win')
        persistSolve(p, secs)
        return
      }

      if (madeError) {
        setAnim([[i, 'anim-shake']])
        play('error')
      } else if (completedRun) {
        // Flash the run(s) that just locked in correctly.
        const flash: Array<[number, string]> = []
        if (afterAcross === 'complete' && beforeAcross !== 'complete') for (const c of p.runs[ar].cells) flash.push([c, 'anim-pulse'])
        if (afterDown === 'complete' && beforeDown !== 'complete') for (const c of p.runs[dr].cells) flash.push([c, 'anim-pulse'])
        setAnim(flash)
        play('match')
      } else {
        setAnim([[i, 'anim-pop']])
        play('move')
      }
    },
    [commitBoard, play, persistSolve, setAnim],
  )

  const eraseSel = useCallback(() => {
    const p = puzzleRef.current
    const b = boardRef.current
    const i = selRef.current
    if (i === null || solvedRef.current) return
    const nb = erase(p, b, i)
    if (nb !== b) {
      commitBoard(nb)
      setAnim([[i, 'anim-pop']])
    }
  }, [commitBoard, setAnim])

  const moveSel = useCallback(
    (dr: number, dc: number) => {
      const p = puzzleRef.current
      const cur = selRef.current
      let r = cur === null ? 0 : Math.floor(cur / p.cols)
      let c = cur === null ? 0 : cur % p.cols
      // Step to the next WHITE cell in the given direction (skip walls).
      for (let step = 0; step < Math.max(p.rows, p.cols); step++) {
        r = Math.max(0, Math.min(p.rows - 1, r + dr))
        c = Math.max(0, Math.min(p.cols - 1, c + dc))
        const idx = r * p.cols + c
        if (p.struct[idx].kind === 'white') {
          commitSel(idx)
          return
        }
        if ((dr < 0 && r === 0) || (dr > 0 && r === p.rows - 1) || (dc < 0 && c === 0) || (dc > 0 && c === p.cols - 1)) break
      }
    },
    [commitSel],
  )

  // Physical keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const k = e.key
      if (k >= '1' && k <= '9') {
        e.preventDefault()
        inputDigit(Number(k))
      } else if (k === 'Backspace' || k === 'Delete' || k === '0') {
        e.preventDefault()
        eraseSel()
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
        setPencil((v) => {
          pencilRef.current = !v
          return !v
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inputDigit, eraseSel, moveSel])

  const togglePencil = useCallback(() => {
    setPencil((v) => {
      pencilRef.current = !v
      return !v
    })
  }, [])

  const startNewGame = useCallback(() => {
    // Advance to the next puzzle in this difficulty (wrapping).
    setPuzzleIdx((idx) => (idx + 1) % BY_DIFF[difficulty].length)
  }, [difficulty])

  const chooseDifficulty = useCallback((d: Difficulty) => {
    setDifficulty(d)
    setPuzzleIdx(0)
  }, [])

  // -- derived render data ---------------------------------------------------
  const errorSet = useMemo(() => (errorCheck ? findErrors(puzzle, board) : new Set<number>()), [errorCheck, puzzle, board])

  const selAcrossRun: Run | null = sel !== null && puzzle.struct[sel].kind === 'white' ? puzzle.runs[puzzle.acrossRunOf[sel]] : null
  const selDownRun: Run | null = sel !== null && puzzle.struct[sel].kind === 'white' ? puzzle.runs[puzzle.downRunOf[sel]] : null

  const acrossCells = useMemo(() => new Set(selAcrossRun?.cells ?? []), [selAcrossRun])
  const downCells = useMemo(() => new Set(selDownRun?.cells ?? []), [selDownRun])

  // Digits already used in the selected cell's runs — entering one would repeat,
  // so the pad dims them (teaches the no-repeat rule as you play).
  const usedInSel = useMemo(() => {
    const used = new Set<number>()
    if (sel === null) return used
    for (const run of [selAcrossRun, selDownRun]) {
      if (!run) continue
      for (const i of run.cells) {
        if (i !== sel && board.values[i] !== 0) used.add(board.values[i])
      }
    }
    return used
  }, [sel, selAcrossRun, selDownRun, board])

  // Feasible combos for a run, filtered by digits already placed in it.
  const feasibleCombos = useCallback(
    (run: Run | null): number[][] => {
      if (!run) return []
      const placed: number[] = []
      for (const i of run.cells) if (board.values[i] !== 0) placed.push(board.values[i])
      const placedSet = new Set(placed)
      return combos(run.clue, run.cells.length).filter((c) => placed.every((v) => c.includes(v)))
    },
    [board],
  )

  const remaining = remainingCells(puzzle, board)
  const bestTime = mounted ? times[puzzle.id] : undefined
  const solvedCount = mounted ? Number(localStorage.getItem(storageKey)) || 0 : 0

  // Number pad: how many of each digit remain unusable-signalling is per-run, so
  // we just show 1-9 always; disable when solved.
  const padDisabled = solved

  const difficultyBar = (
    <div className="mb-3 flex items-center justify-center gap-1.5" role="group" aria-label="Difficulty">
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          onClick={() => chooseDifficulty(d)}
          aria-pressed={difficulty === d}
          className={`btn-press rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
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
        {bestTime !== undefined ? fmtTime(bestTime) : '—'}
      </span>
    </div>
  )

  const hint = 'Fill white cells 1-9 so each run hits its clue sum — no digit repeats within a run.'

  const stats = [{ label: 'Left', value: remaining, testId: 'remaining' }]

  // Clue-cell renderer: SVG so the diagonal + two numbers scale crisply at any
  // grid size. Across sum = cyan (top-right); down sum = amber (bottom-left).
  const renderClue = (across: number | null, down: number | null, hlAcross: boolean, hlDown: boolean) => {
    const hasClue = across !== null || down !== null
    return (
      <svg viewBox="0 0 40 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {hasClue && <line x1="0.5" y1="0.5" x2="39.5" y2="39.5" stroke="rgba(226,232,255,0.35)" strokeWidth="1.4" />}
        {across !== null && (
          <text
            x="37"
            y="16"
            textAnchor="end"
            fontSize="15"
            fontWeight="700"
            fill={hlAcross ? '#67e8f9' : '#22d3ee'}
            style={hlAcross ? { filter: 'drop-shadow(0 0 3px rgba(34,211,238,0.9))' } : undefined}
          >
            {across}
          </text>
        )}
        {down !== null && (
          <text
            x="3.5"
            y="37"
            textAnchor="start"
            fontSize="15"
            fontWeight="700"
            fill={hlDown ? '#fcd34d' : '#fbbf24'}
            style={hlDown ? { filter: 'drop-shadow(0 0 3px rgba(251,191,36,0.9))' } : undefined}
          >
            {down}
          </text>
        )}
      </svg>
    )
  }

  const header = (
    <>
      {timeChip}
      {bestChip}
    </>
  )

  return (
    <GameShell
      stats={stats}
      headerExtra={header}
      onNewGame={startNewGame}
      newGameLabel="Next Puzzle"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      {difficultyBar}

      {/* puzzle label + solved count */}
      <div className="mb-2 flex items-center justify-between px-0.5 text-sm">
        <span className="font-semibold text-fg">
          {DIFF_LABEL[difficulty]} · {puzzle.name}{' '}
          <span className="text-fg-muted">
            #{puzzleIdx + 1}/{BY_DIFF[difficulty].length}
          </span>
        </span>
        <span className="text-fg-muted" data-testid="solved-count">
          Solved: <span className="font-bold text-accent">{solvedCount}</span>
        </span>
      </div>

      <div
        className="anim-board-in relative mx-auto grid w-full overflow-hidden rounded-xl border-2 border-white/25 bg-[#0c0c18]"
        style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))`, maxWidth: `${Math.min(100, puzzle.cols * 12)}%` }}
        data-testid="kakuro-board"
        role="grid"
        aria-label="Kakuro board"
      >
        {puzzle.struct.map((cell, i) => {
          const r = Math.floor(i / puzzle.cols)
          const c = i % puzzle.cols
          const rBorder = c !== puzzle.cols - 1 ? 'border-r border-r-white/12' : ''
          const bBorder = r !== puzzle.rows - 1 ? 'border-b border-b-white/12' : ''

          if (cell.kind === 'black') {
            const hlAcross = selAcrossRun?.clueIndex === i
            const hlDown = selDownRun?.clueIndex === i
            return (
              <div
                key={i}
                role="gridcell"
                data-testid="kakuro-cell"
                data-kind="black"
                className={`relative aspect-square ${rBorder} ${bBorder}`}
              >
                {renderClue(cell.across, cell.down, hlAcross, hlDown)}
              </div>
            )
          }

          const val = board.values[i]
          const cellNotes = board.notes[i]
          const isSel = sel === i
          const inAcross = acrossCells.has(i)
          const inDown = downCells.has(i)
          const isError = errorSet.has(i)
          const anim = anims[i]

          let bg = 'bg-[#14142a]'
          if (isError) bg = 'bg-red-500/30'
          else if (isSel) bg = 'bg-accent/40'
          else if (inAcross && inDown) bg = 'bg-accent/20'
          else if (inAcross) bg = 'bg-neon-cyan/15'
          else if (inDown) bg = 'bg-neon-amber/15'

          const textColor = isError ? 'text-red-300' : 'text-sky-200'

          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              data-testid="kakuro-cell"
              data-kind="white"
              aria-label={`row ${r + 1}, column ${c + 1}${val ? `, ${val}` : ', empty'}`}
              onClick={() => commitSel(i)}
              className={`relative flex aspect-square items-center justify-center outline-none transition-colors ${rBorder} ${bBorder} ${bg} ${textColor}`}
            >
              {val !== 0 ? (
                <span key={anim?.key ?? 'v'} className={`text-[1.15rem] font-bold sm:text-2xl ${anim?.cls ?? ''}`}>
                  {val}
                </span>
              ) : cellNotes.length > 0 ? (
                <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-[1px] text-[0.5rem] leading-none text-fg-muted">
                  {Array.from({ length: 9 }, (_, n) => (
                    <span key={n} className="flex items-center justify-center">
                      {cellNotes.includes(n + 1) ? n + 1 : ''}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          )
        })}

        <GameOverlay show={solved} variant="win" title="Solved!" testId="you-win">
          <p className="text-lg font-semibold text-fg">
            {DIFF_LABEL[difficulty]} · {puzzle.name} · {fmtTime(elapsed)}
          </p>
          <GameButton onClick={startNewGame} className="px-4 py-2">
            Next Puzzle
          </GameButton>
        </GameOverlay>
      </div>

      {/* Selected-cell run guide: which runs the cell belongs to + their sums. */}
      <div
        className="mx-auto mt-3 min-h-[2.75rem] max-w-100 rounded-lg border border-border bg-surface/70 px-3 py-2 text-sm"
        data-testid="run-guide"
      >
        {selAcrossRun || selDownRun ? (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {selAcrossRun && (
                <span className="text-neon-cyan">
                  ▸ Across sum <span className="font-bold">{selAcrossRun.clue}</span> in {selAcrossRun.cells.length}
                </span>
              )}
              {selDownRun && (
                <span className="text-neon-amber">
                  ▾ Down sum <span className="font-bold">{selDownRun.clue}</span> in {selDownRun.cells.length}
                </span>
              )}
            </div>
            {showCombos && (
              <div className="flex flex-col gap-0.5 text-xs text-fg-muted">
                {selAcrossRun && (
                  <span data-testid="combo-across">
                    <span className="text-neon-cyan">Across:</span>{' '}
                    {feasibleCombos(selAcrossRun)
                      .slice(0, 8)
                      .map((c) => c.join('+'))
                      .join('   ·   ') || '—'}
                  </span>
                )}
                {selDownRun && (
                  <span data-testid="combo-down">
                    <span className="text-neon-amber">Down:</span>{' '}
                    {feasibleCombos(selDownRun)
                      .slice(0, 8)
                      .map((c) => c.join('+'))
                      .join('   ·   ') || '—'}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-fg-muted">Tap a white cell to see its across ▸ and down ▾ target sums.</span>
        )}
      </div>

      {/* Number pad + controls. */}
      <div className="mx-auto mt-3 flex max-w-100 flex-col gap-2">
        <div className="grid grid-cols-9 gap-1" role="group" aria-label="Number pad">
          {Array.from({ length: 9 }, (_, n) => {
            const d = n + 1
            const used = !pencil && usedInSel.has(d) // would repeat in this run
            return (
              <button
                key={d}
                type="button"
                onClick={() => inputDigit(d)}
                disabled={padDisabled}
                aria-label={`Enter ${d}${used ? ' (already used in this run)' : ''}`}
                className={`btn-press flex h-12 items-center justify-center rounded-lg bg-surface text-xl font-bold hover:bg-white/10 disabled:opacity-50 ${
                  used ? 'text-fg-muted opacity-45 line-through decoration-neon-red/70' : 'text-fg'
                }`}
              >
                {d}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={togglePencil}
            aria-pressed={pencil}
            className={`btn-press rounded-lg px-3 py-2 text-sm font-semibold ${
              pencil ? 'bg-accent text-stone-900 shadow-sm' : 'bg-surface text-fg hover:bg-white/10'
            }`}
          >
            ✏️ Notes
          </button>
          <button
            type="button"
            onClick={eraseSel}
            disabled={padDisabled}
            aria-label="Erase"
            className="btn-press rounded-lg bg-surface px-3 py-2 text-sm font-semibold text-fg hover:bg-white/10 disabled:opacity-50"
          >
            ⌫ Erase
          </button>
          <button
            type="button"
            onClick={() => setErrorCheck((v) => !v)}
            aria-pressed={errorCheck}
            className={`btn-press rounded-lg px-3 py-2 text-sm font-semibold ${
              errorCheck ? 'bg-neon-red/80 text-stone-900 shadow-sm' : 'bg-surface text-fg hover:bg-white/10'
            }`}
          >
            🔍 Check
          </button>
          <button
            type="button"
            onClick={() => setShowCombos((v) => !v)}
            aria-pressed={showCombos}
            className={`btn-press rounded-lg px-3 py-2 text-sm font-semibold ${
              showCombos ? 'bg-neon-lime/80 text-stone-900 shadow-sm' : 'bg-surface text-fg hover:bg-white/10'
            }`}
          >
            💡 Combos
          </button>
        </div>
      </div>
    </GameShell>
  )
}
