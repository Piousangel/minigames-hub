'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AXES,
  DAILY_CONFIG,
  DIFFICULTIES,
  EFFICIENCY_BONUS_MAX,
  createGame,
  layerKey,
  reduce,
  sliceAt,
  type Axis,
  type StrataAction,
  type StrataConfig,
  type StrataEvent,
  type StrataState,
} from '@/lib/games/strata/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { barGlyph, gradeRatio, resultSnippet } from '@/lib/dailyShare'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'

interface StrataSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

/** 데일리 연속기록 전용 키 — best:<slug>는 Number()로만 읽으므로 JSON을 절대 안 넣는다. */
const DAILY_KEY = 'strata:daily'

function loadDaily(): StrataSave['daily'] {
  try {
    const raw = localStorage.getItem(DAILY_KEY)
    if (!raw) return undefined
    const o = JSON.parse(raw) as Record<string, unknown>
    if (typeof o?.lastDate === 'string' && typeof o?.streak === 'number') {
      return { lastDate: o.lastDate, streak: o.streak }
    }
  } catch {
    // corrupt -> no streak
  }
  return undefined
}

const SOUND: Record<StrataEvent, SoundName | null> = {
  none: null,
  query: 'move',
  'query-repeat': 'flip',
  illegal: 'error',
  toggle: 'flip',
  layer: null,
  'submit-wrong': 'error',
  win: 'win',
  lose: 'lose',
}

/**
 * Seed of the last daily board that was finished (win OR loss). A loss reveals the full answer,
 * so any later finish of the same daily seed is a replay: it never touches the streak, best or
 * stats. Keyed by the board's seed, not the finish date, so finishing yesterday's board after
 * UTC midnight can't burn today's daily.
 */
const DAILY_DONE_KEY = 'strata:daily-done'

function loadDailyDone(): string | null {
  try {
    return localStorage.getItem(DAILY_DONE_KEY)
  } catch {
    return null
  }
}

function saveDailyDone(seed: string): void {
  try {
    localStorage.setItem(DAILY_DONE_KEY, seed)
  } catch {
    // ignore storage failures
  }
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadSave(storageKey: string): StrataSave {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { score: 0 }
    const n = Number(raw)
    if (Number.isFinite(n)) return { score: Math.max(0, Math.floor(n)), daily: loadDaily() }
  } catch {
    // corrupt -> reset
  }
  return { score: 0 }
}

function saveAll(storageKey: string, save: StrataSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

/** Inverse of engine's sliceAt row/col mapping (spec §3): (axis, layerIndex, row, col) -> (x,y,z). */
function cellToVoxel(axis: Axis, layerIndex: number, row: number, col: number): { x: number; y: number; z: number } {
  if (axis === 'z') return { x: col, y: row, z: layerIndex }
  if (axis === 'y') return { x: col, y: layerIndex, z: row }
  return { x: layerIndex, y: col, z: row }
}

const AXIS_LABEL: Record<Axis, string> = { x: 'X', y: 'Y', z: 'Z' }

/** Compact static preview of the full solved shape, one z-layer at a time — used on the lose overlay. */
function AnswerPreview({ voxels, size }: { voxels: boolean[]; size: number }) {
  return (
    <div className="flex max-w-full gap-2 overflow-x-auto pb-1" data-testid="answer-preview">
      {Array.from({ length: size }, (_, z) => {
        const grid = sliceAt(voxels, size, 'z', z)
        return (
          <div key={z} className="flex flex-shrink-0 flex-col items-center gap-1">
            <span className="text-[10px] text-fg-muted">z{z}</span>
            <div
              className="grid gap-px rounded border border-border bg-border p-px"
              style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
            >
              {grid.map((row, r) =>
                row.map((v, c) => (
                  <span
                    key={`${r}-${c}`}
                    className="block h-3 w-3"
                    style={{ background: v ? 'var(--neon-cyan)' : 'transparent' }}
                  />
                )),
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function GameStrata({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<StrataState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [guessFocus, setGuessFocus] = useState({ row: 0, col: 0 })
  const [shakeSeq, setShakeSeq] = useState(0)
  // True when the finished board was a repeat of an already-finished daily (doesn't count).
  const [dailyReplay, setDailyReplay] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<StrataState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevResult = useRef<StrataState['result']>('playing')
  const prevBestRef = useRef(0)
  const guessCellRefs = useRef<(HTMLButtonElement | null)[]>([])

  const commit = useCallback((next: StrataState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    prevBestRef.current = save.score
    setStreak(currentStreak(save.daily))
    const g = createGame(DAILY_CONFIG, dailySeed(new Date()))
    prevResult.current = 'playing'
    commit(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(
    (nextMode: Mode, diff: Difficulty) => {
      modeRef.current = nextMode
      const g =
        nextMode === 'daily'
          ? createGame(DAILY_CONFIG, dailySeed(new Date()))
          : createGame(DIFFICULTIES[diff], freshSeed())
      prevResult.current = 'playing'
      setGuessFocus({ row: 0, col: 0 })
      commit(g)
    },
    [commit],
  )

  const persistEnd = useCallback(
    (next: StrataState) => {
      if (modeRef.current === 'daily') {
        const boardSeed = String(next.seed)
        if (loadDailyDone() === boardSeed) {
          setDailyReplay(true)
          return
        }
        saveDailyDone(boardSeed)
      }
      setDailyReplay(false)
      const save = loadSave(storageKey)
      prevBestRef.current = save.score
      let nextSave: StrataSave = { ...save, score: Math.max(save.score, next.score) }
      if (modeRef.current === 'daily' && next.result === 'won') {
        const bumped = bumpStreak(save.daily)
        nextSave = { ...nextSave, daily: bumped }
        setStreak(bumped.streak)
      }
      setBest(nextSave.score)
      saveAll(storageKey, nextSave)
      recordResult(storageKey.replace(/^best:/, ''), { won: next.result === 'won' })
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: StrataAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastEvent === 'submit-wrong') setShakeSeq((n) => n + 1)

      if (next.result !== 'playing' && prevResult.current === 'playing') {
        persistEnd(next)
      }
      prevResult.current = next.result
    },
    [commit, play, persistEnd],
  )

  const onNewGame = useCallback(() => {
    if (mode === 'daily') dispatch({ type: 'reset' })
    else startBoard('practice', difficulty)
  }, [mode, difficulty, dispatch, startBoard])

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

  // Global shortcuts: [ ] layer step, 1/2/3 axis, g query, s submit, r new game.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      switch (e.key) {
        case '[': {
          e.preventDefault()
          const idx = s.activeLayer.index - 1
          if (idx >= 0) dispatch({ type: 'setLayer', axis: s.activeLayer.axis, index: idx })
          break
        }
        case ']': {
          e.preventDefault()
          const idx = s.activeLayer.index + 1
          if (idx < s.size) dispatch({ type: 'setLayer', axis: s.activeLayer.axis, index: idx })
          break
        }
        case '1':
          e.preventDefault()
          dispatch({ type: 'setLayer', axis: 'x', index: s.activeLayer.index })
          break
        case '2':
          e.preventDefault()
          dispatch({ type: 'setLayer', axis: 'y', index: s.activeLayer.index })
          break
        case '3':
          e.preventDefault()
          dispatch({ type: 'setLayer', axis: 'z', index: s.activeLayer.index })
          break
        case 'g':
        case 'G':
          e.preventDefault()
          dispatch({ type: 'query', axis: s.activeLayer.axis, index: s.activeLayer.index })
          break
        case 's':
        case 'S':
          e.preventDefault()
          dispatch({ type: 'submit' })
          break
        case 'r':
        case 'R':
          e.preventDefault()
          onNewGame()
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch, onNewGame])

  // Roving focus inside the guess grid: arrow keys move, native Enter/Space activates.
  const onGuessGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const s = stateRef.current
      if (!s) return
      const size = s.size
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setGuessFocus((f) => ({ ...f, col: (f.col - 1 + size) % size }))
          break
        case 'ArrowRight':
          e.preventDefault()
          setGuessFocus((f) => ({ ...f, col: (f.col + 1) % size }))
          break
        case 'ArrowUp':
          e.preventDefault()
          setGuessFocus((f) => ({ ...f, row: (f.row - 1 + size) % size }))
          break
        case 'ArrowDown':
          e.preventDefault()
          setGuessFocus((f) => ({ ...f, row: (f.row + 1) % size }))
          break
      }
    },
    [],
  )

  useEffect(() => {
    if (!state) return
    const i = guessFocus.row * state.size + guessFocus.col
    guessCellRefs.current[i]?.focus()
  }, [guessFocus, state])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-150 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="strata-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const size = state.size
  const won = state.result === 'won'
  const lost = state.result === 'lost'
  const canAct = state.result === 'playing'

  const hint = won
    ? 'Solved! Your guess matched the hidden shape exactly.'
    : lost
      ? 'Out of attempts — the shape is revealed below.'
      : 'Query slices to reveal cross-sections, paint your guess layer by layer, then submit when confident.'

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
      {mode === 'daily' ? (
        <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          Streak <span className="font-bold text-accent">{streak}</span>
        </span>
      ) : (
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
      <GameButton variant="ghost" onClick={() => dispatch({ type: 'giveUp' })} disabled={!canAct}>
        Give Up
      </GameButton>
    </>
  )

  const efficiencyBonus = Math.round(EFFICIENCY_BONUS_MAX * (state.queriesLeft / state.config.querySlices))

  return (
    <GameShell
      stats={[
        { label: 'Queries', value: state.queriesLeft, testId: 'queries' },
        { label: 'Submits', value: state.submitsLeft, testId: 'submits' },
        { label: 'Best', value: best, testId: 'score' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={won || lost ? 'Play again' : mode === 'daily' ? 'Replay Daily' : 'New Shape'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-150"
    >
      <div
        className="relative rounded-xl bg-surface p-4"
        style={reduced ? undefined : { animation: 'st-board-in .3s ease-out both' }}
        data-testid="strata-board"
      >
        <div className="flex flex-col gap-4 md:flex-row">
          {/* Query panel */}
          <div role="group" aria-label="Slice queries" className="flex-1 rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Slice queries</p>
            <div className="flex flex-col gap-2">
              {AXES.map((axis) => (
                <div key={axis} className="flex items-center gap-1.5">
                  <span className="w-4 text-xs font-bold text-fg-muted">{AXIS_LABEL[axis]}</span>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: size }, (_, i) => {
                      const revealed = layerKey(axis, i) in state.revealed
                      const disabled = !revealed && state.queriesLeft <= 0
                      return (
                        <button
                          key={i}
                          type="button"
                          data-testid="query-cell"
                          aria-label={`${AXIS_LABEL[axis]} slice ${i}${revealed ? ', revealed' : ''}`}
                          disabled={disabled}
                          onClick={() => dispatch({ type: 'query', axis, index: i })}
                          className={`flex h-7 w-7 items-center justify-center rounded border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-30 ${
                            revealed
                              ? 'border-accent/70 bg-accent/15 text-accent'
                              : 'border-border bg-bg-2/60 text-fg-muted hover:border-accent/40'
                          }`}
                        >
                          {revealed ? '✓' : i}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Guess panel */}
          <div role="group" aria-label="Your guess" className="flex-1 rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex overflow-hidden rounded-lg border border-border">
                {AXES.map((axis) => (
                  <button
                    key={axis}
                    type="button"
                    onClick={() => dispatch({ type: 'setLayer', axis, index: state.activeLayer.index })}
                    aria-pressed={state.activeLayer.axis === axis}
                    className={`px-2 py-1 text-xs font-semibold ${
                      state.activeLayer.axis === axis ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'
                    }`}
                  >
                    {AXIS_LABEL[axis]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Previous layer"
                  disabled={state.activeLayer.index <= 0}
                  onClick={() =>
                    dispatch({ type: 'setLayer', axis: state.activeLayer.axis, index: state.activeLayer.index - 1 })
                  }
                  className="rounded border border-border px-1.5 py-0.5 text-xs disabled:opacity-30"
                >
                  ‹
                </button>
                <span className="text-xs tabular-nums text-fg-muted" data-testid="active-layer">
                  {state.activeLayer.index + 1}/{size}
                </span>
                <button
                  type="button"
                  aria-label="Next layer"
                  disabled={state.activeLayer.index >= size - 1}
                  onClick={() =>
                    dispatch({ type: 'setLayer', axis: state.activeLayer.axis, index: state.activeLayer.index + 1 })
                  }
                  className="rounded border border-border px-1.5 py-0.5 text-xs disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            </div>

            {(() => {
              const key = layerKey(state.activeLayer.axis, state.activeLayer.index)
              const overlay = state.revealed[key]
              return (
                <div
                  onKeyDown={onGuessGridKeyDown}
                  className="relative mx-auto grid w-fit gap-1 rounded bg-bg-2/40 p-2"
                  style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
                >
                  {Array.from({ length: size }, (_, row) =>
                    Array.from({ length: size }, (_, col) => {
                      const { x, y, z } = cellToVoxel(state.activeLayer.axis, state.activeLayer.index, row, col)
                      const on = state.guess[x + y * size + z * size * size]
                      const answerOn = overlay?.[row]?.[col] ?? false
                      const i = row * size + col
                      const focused = guessFocus.row === row && guessFocus.col === col
                      return (
                        <button
                          key={i}
                          ref={(el) => {
                            guessCellRefs.current[i] = el
                          }}
                          type="button"
                          data-testid="guess-cell"
                          aria-pressed={on}
                          aria-label={`Cell row ${row + 1} column ${col + 1}${on ? ', filled' : ', empty'}`}
                          tabIndex={focused ? 0 : -1}
                          onFocus={() => setGuessFocus({ row, col })}
                          onClick={() => dispatch({ type: 'toggleVoxel', x, y, z })}
                          disabled={!canAct}
                          className="relative flex h-8 w-8 items-center justify-center rounded border border-border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed"
                          style={{
                            background: on ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.04)',
                            animation: reduced || !on ? undefined : 'st-cell-pulse .15s ease-out both',
                          }}
                        >
                          {overlay && (
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0.5 rounded-sm"
                              style={{
                                background: answerOn ? 'var(--neon-amber)' : 'transparent',
                                opacity: 0.35,
                              }}
                            />
                          )}
                        </button>
                      )
                    }),
                  )}
                </div>
              )
            })()}

            <button
              type="button"
              onClick={() => dispatch({ type: 'query', axis: state.activeLayer.axis, index: state.activeLayer.index })}
              disabled={!canAct}
              className="mt-2 w-full rounded border border-border bg-bg-2/60 py-1 text-xs font-semibold text-fg-muted hover:border-accent/50 disabled:opacity-40"
            >
              Check this layer
            </button>
          </div>
        </div>

        {/* Actions */}
        <div
          className="mt-3 flex flex-col items-center gap-1"
          style={shakeSeq > 0 && !reduced ? { animation: 'st-shake .3s ease-in-out' } : undefined}
          key={shakeSeq}
        >
          <GameButton
            data-testid="submit-guess"
            onClick={() => dispatch({ type: 'submit' })}
            disabled={!canAct}
          >
            Submit ({state.submitsLeft} left)
          </GameButton>
          {state.lastSubmit && (
            <p className="text-xs text-fg-muted" data-testid="submit-feedback">
              {state.lastSubmit.matches}/{state.lastSubmit.total} cells match (IoU {state.lastSubmit.iou.toFixed(2)})
            </p>
          )}
        </div>

        <GameOverlay show={won} variant="win" title="Shape found!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Efficiency bonus <span className="font-bold text-accent">+{efficiencyBonus}</span>
            </p>
            <p>
              Queries used <span className="font-bold text-accent">{state.queriesUsed}</span> · Submits used{' '}
              <span className="font-bold text-accent">{state.submitsUsed}</span>
            </p>
            {mode === 'daily' && (
              <p>
                Streak <span className="font-bold text-accent">{streak}</span>
              </p>
            )}
            {mode === 'daily' && dailyReplay && (
              <p className="text-xs text-fg-muted" data-testid="daily-replay-note">
                Replay — today&apos;s daily already counted, so this doesn&apos;t change your streak or best.
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {mode === 'daily' && !dailyReplay && (
              <DailyShareButton
                payload={() => {
                  const grade = gradeRatio(state.score, prevBestRef.current, state.score > prevBestRef.current)
                  const glyph = barGlyph(state.queriesUsed, state.config.querySlices, 'QUERIES USED')
                  return {
                    gameName: 'Strata',
                    dateISO: todayUTC(),
                    accent: '#22d3ee',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/strata`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Strata',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      state.config.querySlices,
                      `solved with ${state.queriesUsed} queries used`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <GameOverlay show={lost} variant="lose" title="Out of attempts" testId="game-over">
          <div className="flex flex-col items-center gap-2 text-sm">
            <p>
              Final score <span className="font-bold text-accent">{state.score}</span>
            </p>
            {state.lastSubmit && (
              <p className="text-xs text-fg-muted">
                Your guess matched {state.lastSubmit.matches}/{state.lastSubmit.total} cells (IoU{' '}
                {state.lastSubmit.iou.toFixed(2)})
              </p>
            )}
            <AnswerPreview voxels={state.voxels} size={size} />
          </div>
          <GameButton onClick={onNewGame}>Play again</GameButton>
        </GameOverlay>

        <style>{`
          @keyframes st-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes st-cell-pulse { from { transform: scale(.85) } to { transform: scale(1) } }
          @keyframes st-shake {
            0%, 100% { transform: translateX(0) }
            25% { transform: translateX(-4px) }
            75% { transform: translateX(4px) }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
