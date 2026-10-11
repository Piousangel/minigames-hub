'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  createGame,
  dailySeed as engineDailySeed,
  reduce,
  type BearingAction,
  type BearingEvent,
  type BearingState,
  type DigResult,
  type Pos,
} from '@/lib/games/bearing/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak, loadStreak, saveStreak, type DailyStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeFewer, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'

/** Streak lives under its own key — best:<slug> holds a plain number for the leaderboard. */
const DAILY_KEY = 'bearing:daily'
/**
 * UTC date of the last daily board that reached an end (won OR lost). Only the first
 * finish of the day counts toward streak/best — a loss reveals the target, so a retry
 * (or a replay after a win) on the same seed is practice, not a record.
 */
const DAILY_DONE_KEY = 'bearing:daily-done'

function loadDailyDone(): string | null {
  try {
    return localStorage.getItem(DAILY_DONE_KEY)
  } catch {
    return null
  }
}

/**
 * Has the daily board dealt on `boardDate` already been finished? Saves from before
 * DAILY_DONE_KEY existed only know about a win through the streak's lastDate, so fall
 * back to that while the key is absent (once written, the key is authoritative — the
 * streak date can run a day ahead when a board is finished after UTC midnight).
 */
function isDailyDone(boardDate: string): boolean {
  const done = loadDailyDone()
  if (done !== null) return done >= boardDate
  return loadStreak(DAILY_KEY)?.lastDate === boardDate
}

function saveDailyDone(date: string): void {
  try {
    localStorage.setItem(DAILY_DONE_KEY, date)
  } catch {
    // ignore storage failures
  }
}

/** Practice-only fresh seed. Impure by design — never used for the daily board. */
function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

const SOUND: Record<BearingEvent, Parameters<ReturnType<typeof useGameSound>['play']>[0] | null> = {
  none: null,
  dig: 'move',
  'dig-repeat': null,
  found: 'win',
  illegal: 'error',
  lose: 'lose',
}

/** Rotation angle for the revealed-bearing arrow glyph. */
const ARROW_DEG: Record<Exclude<DigResult, 'found'>, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
}

function cellLabel(state: BearingState, x: number, y: number): string {
  const base = `Row ${y + 1}, Col ${x + 1}`
  const result = state.digGrid[y][x]
  if (result === 'found') return `${base}, treasure found here`
  if (result !== null) return `${base}, revealed ${result}`
  const outside = x < state.region.xMin || x > state.region.xMax || y < state.region.yMin || y > state.region.yMax
  return outside ? `${base}, ruled out` : `${base}, unknown`
}

export function GameBearing({ storageKey }: { storageKey: string }) {
  // SSR-safe: build the board only on the client.
  const [state, setState] = useState<BearingState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [isBest, setIsBest] = useState(false)
  const [streak, setStreak] = useState(0)
  /** True while playing a daily board that was already finished today (not counted). */
  const [dailyReplay, setDailyReplay] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<BearingState | null>(null)
  const modeRef = useRef<Mode>('daily')
  /** UTC date whose seed built the current daily board — a board started before midnight
   *  and finished after it still belongs to the day it was dealt. */
  const boardDateRef = useRef('')
  const prevOver = useRef(false)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])

  const commit = useCallback((next: BearingState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only). Default to the daily board.
  useEffect(() => {
    setBest(loadBest(storageKey))
    setStreak(currentStreak(loadStreak(DAILY_KEY)))
    modeRef.current = 'daily'
    const today = todayUTC()
    boardDateRef.current = today
    setDailyReplay(isDailyDone(today))
    const g = createGame(DAILY_CONFIG, engineDailySeed(today))
    prevOver.current = false
    commit(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(
    (nextMode: Mode, diff: Difficulty) => {
      modeRef.current = nextMode
      const today = todayUTC()
      if (nextMode === 'daily') boardDateRef.current = today
      setDailyReplay(nextMode === 'daily' && isDailyDone(today))
      const g =
        nextMode === 'daily'
          ? createGame(DAILY_CONFIG, engineDailySeed(today))
          : createGame(DIFFICULTIES[diff], freshSeed())
      prevOver.current = false
      setIsBest(false)
      commit(g)
    },
    [commit],
  )

  const persistOver = useCallback(
    (next: BearingState) => {
      if (modeRef.current === 'daily') {
        const boardDate = boardDateRef.current
        if (isDailyDone(boardDate)) {
          // Already finished today's daily — this run is practice: no best, no streak, and
          // no Win% entry (after a loss the target was revealed, so the retry is a sure win).
          setDailyReplay(true)
          setIsBest(false)
          return
        }
        saveDailyDone(boardDate)
      }
      const prevBest = loadBest(storageKey)
      const beatBest = next.score > 0 && next.score > prevBest
      setIsBest(beatBest)
      const nextBest = Math.max(prevBest, next.score)
      try {
        localStorage.setItem(storageKey, String(nextBest))
      } catch {
        // ignore storage failures
      }
      setBest(nextBest)
      if (next.status === 'won' && modeRef.current === 'daily') {
        const bumped: DailyStreak = bumpStreak(loadStreak(DAILY_KEY))
        saveStreak(DAILY_KEY, bumped)
        setStreak(bumped.streak)
      }
      recordResult(storageKey.replace(/^best:/, ''), { won: next.status === 'won' })
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: BearingAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      const over = next.status !== 'playing'
      if (over && !prevOver.current) persistOver(next)
      prevOver.current = over
    },
    [commit, play, persistOver],
  )

  // Keyboard: roving cursor + dig + new board.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          dispatch({ type: 'move', dx: 0, dy: -1 })
          break
        case 'ArrowDown':
          e.preventDefault()
          dispatch({ type: 'move', dx: 0, dy: 1 })
          break
        case 'ArrowLeft':
          e.preventDefault()
          dispatch({ type: 'move', dx: -1, dy: 0 })
          break
        case 'ArrowRight':
          e.preventDefault()
          dispatch({ type: 'move', dx: 1, dy: 0 })
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          dispatch({ type: 'dig', at: s.cursor })
          break
        case 'r':
        case 'R':
          e.preventDefault()
          startBoard(modeRef.current, difficulty)
          break
      }
    },
    [dispatch, difficulty, startBoard],
  )

  // Keep DOM focus in sync with the roving cursor.
  useEffect(() => {
    if (!state) return
    const idx = state.cursor.y * state.size + state.cursor.x
    cellRefs.current[idx]?.focus()
  }, [state])

  const onNewGame = useCallback(() => {
    // Daily replays go through startBoard so the "already finished today" flag refreshes.
    startBoard(mode, difficulty)
  }, [mode, difficulty, startBoard])

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m)
      startBoard(m, difficulty)
    },
    [difficulty, startBoard],
  )

  const switchDifficulty = useCallback(
    (d: Difficulty) => {
      setDifficulty(d)
      if (modeRef.current === 'practice') startBoard('practice', d)
    },
    [startBoard],
  )

  const onCellClick = useCallback(
    (at: Pos) => {
      dispatch({ type: 'dig', at })
    },
    [dispatch],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="bearing-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const size = state.size
  const won = state.status === 'won'
  const lost = state.status === 'lost'
  const over = won || lost

  const hint = won
    ? 'Found it!'
    : lost
      ? `Out of shovels — it was at row ${state.target.y + 1}, col ${state.target.x + 1}.`
      : dailyReplay && mode === 'daily'
        ? "Today's daily is done — this replay is practice and won't count."
        : 'Dig anywhere — the compass tells you which way to go, never how far.'

  const headerExtra = (
    <>
      <div className="flex overflow-hidden rounded-lg border border-border">
        <button
          onClick={() => switchMode('daily')}
          aria-pressed={mode === 'daily'}
          className={`px-2.5 py-1.5 text-sm font-semibold ${mode === 'daily' ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
        >
          Daily
        </button>
        <button
          onClick={() => switchMode('practice')}
          aria-pressed={mode === 'practice'}
          className={`px-2.5 py-1.5 text-sm font-semibold ${mode === 'practice' ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
        >
          Practice
        </button>
      </div>
      {mode === 'practice' && (
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => switchDifficulty(d)}
              aria-pressed={difficulty === d}
              className={`px-2.5 py-1.5 text-sm font-semibold capitalize ${difficulty === d ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Digs', value: state.digsUsed, testId: 'moves' },
        { label: 'Budget', value: state.digBudget },
        { label: 'Best', value: best, testId: 'score' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={won ? 'Play again' : lost ? 'Retry' : mode === 'daily' ? 'Replay Daily' : 'New Board'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <style>{`
        @keyframes brg-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
        @keyframes brg-pop { 0% { opacity: 0; transform: scale(.5) } 100% { opacity: 1; transform: scale(1) } }
      `}</style>
      <div
        role="group"
        aria-label="Bearing board"
        onKeyDown={onKeyDown}
        className="relative grid aspect-square w-full gap-1.5 rounded-xl bg-surface p-2"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          ...(reduced ? undefined : { animation: 'brg-board-in .3s ease-out both' }),
        }}
        data-testid="bearing-board"
      >
        {Array.from({ length: size * size }, (_, i) => {
          const x = i % size
          const y = Math.floor(i / size)
          const result = state.digGrid[y][x]
          const isCursor = state.cursor.x === x && state.cursor.y === y
          const outsideRegion =
            x < state.region.xMin || x > state.region.xMax || y < state.region.yMin || y > state.region.yMax
          const isFound = result === 'found'
          const isLastDig = state.lastDig != null && state.lastDig.at.x === x && state.lastDig.at.y === y

          let bg = 'bg-white/[0.04] hover:bg-white/[0.09]'
          if (isFound) bg = 'bg-neon-green/15'
          else if (result !== null) bg = 'bg-white/[0.10]'
          else if (outsideRegion && !over) bg = 'bg-white/[0.015]'

          return (
            <button
              key={i}
              ref={(el) => {
                cellRefs.current[i] = el
              }}
              type="button"
              data-testid="cell"
              data-x={x}
              data-y={y}
              tabIndex={isCursor ? 0 : -1}
              aria-label={cellLabel(state, x, y)}
              aria-pressed={isCursor}
              onClick={() => onCellClick({ x, y })}
              className={`btn-press relative flex aspect-square items-center justify-center overflow-hidden rounded-lg text-lg font-bold shadow-inner transition-[background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${bg} ${isCursor ? 'ring-2 ring-neon-cyan' : ''} ${outsideRegion && !over && result === null ? 'opacity-40' : ''}`}
            >
              {isFound ? (
                <span
                  aria-hidden="true"
                  className="text-xl text-neon-green"
                  style={{
                    animation: reduced || !isLastDig ? undefined : 'brg-pop 220ms ease-out',
                    filter: 'drop-shadow(0 0 6px var(--neon-green))',
                  }}
                >
                  ★
                </span>
              ) : result !== null ? (
                <span
                  aria-hidden="true"
                  className="text-neon-cyan"
                  style={{
                    display: 'inline-block',
                    transform: `rotate(${ARROW_DEG[result]}deg)`,
                    animation: reduced || !isLastDig ? undefined : 'brg-pop 180ms ease-out',
                  }}
                >
                  ▲
                </span>
              ) : null}
            </button>
          )
        })}

        <GameOverlay show={won} variant="win" title="Found it!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            {isBest && <p className="font-bold text-accent">New best score!</p>}
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Digs <span className="font-bold text-accent">{state.digsUsed}</span> / Par{' '}
              <span className="font-bold text-accent">{state.par}</span>
            </p>
            {mode === 'daily' && dailyReplay && (
              <p className="text-fg-muted">Replay — not counted toward streak, best or stats.</p>
            )}
            {mode === 'daily' && !dailyReplay && (
              <p>
                Streak <span className="font-bold text-accent">{streak}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {mode === 'daily' && !dailyReplay && (
              <DailyShareButton
                payload={() => {
                  const used = state.digsUsed
                  const par = state.par
                  const grade = gradeFewer(used, par)
                  const glyph = barGlyph(used, par, `${used} DIGS · PAR ${par}`)
                  return {
                    gameName: 'Bearing',
                    dateISO: todayUTC(),
                    accent: '#22d3ee',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/bearing`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Bearing',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      par,
                      `found the treasure in ${used} digs (par ${par})`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <GameOverlay show={lost} variant="lose" title="Out of shovels" testId="game-over">
          {isBest && <p className="text-sm font-bold text-accent">New best score!</p>}
          <p className="text-sm text-fg-muted">
            The treasure was at row <span className="font-bold text-accent">{state.target.y + 1}</span>, col{' '}
            <span className="font-bold text-accent">{state.target.x + 1}</span>.
          </p>
          <GameButton onClick={onNewGame}>Retry</GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
