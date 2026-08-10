'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  createGame,
  reduce,
  type Axis,
  type Color,
  type LoopgridAction,
  type LoopgridEvent,
  type LoopgridState,
} from '@/lib/games/loopgrid/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeFewer, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'

interface LoopgridSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

/**
 * 일일 연속 기록 전용 키. best:<slug>에는 숫자만 넣는다 — 주간 리더보드가
 * 그 키를 Number()로 읽으므로(모든 게임 공통 규약) JSON을 넣으면 점수를 못 읽는다.
 */
const DAILY_KEY = 'loopgrid:daily'

function loadDaily(): LoopgridSave['daily'] {
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

const SOUND: Record<LoopgridEvent, Parameters<ReturnType<typeof useGameSound>['play']>[0] | null> = {
  none: null,
  cycle: 'move',
  rowComplete: 'match',
  combo: 'match',
  undo: 'flip',
  win: 'win',
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadSave(storageKey: string): LoopgridSave {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { score: 0 }

    const n = Number(raw)
    if (Number.isFinite(n)) return { score: Math.max(0, Math.floor(n)), daily: loadDaily() }

    // 레거시: best 키에 {score, daily} JSON을 넣던 시절의 데이터를 옮겨 온다.
    const o = JSON.parse(raw) as Record<string, unknown>
    const score =
      typeof o?.score === 'number' && Number.isFinite(o.score) ? Math.max(0, Math.floor(o.score)) : 0
    let daily: LoopgridSave['daily']
    const dd = o?.daily as Record<string, unknown> | undefined
    if (typeof dd?.lastDate === 'string' && typeof dd?.streak === 'number') {
      daily = { lastDate: dd.lastDate, streak: dd.streak }
    }
    saveAll(storageKey, { score, daily })
    return { score, daily }
  } catch {
    // corrupt / legacy -> reset
  }
  return { score: 0 }
}

function saveAll(storageKey: string, save: LoopgridSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

/** Fixed HSL hue per answer-row color so the target pattern is legible in light + dark. */
function bandColor(color: Color, n: number): { bg: string; fg: string } {
  const hue = n <= 1 ? 200 : Math.round(((color - 1) * 300) / (n - 1))
  return {
    bg: `hsl(${hue} 62% 52%)`,
    fg: `hsl(${hue} 70% 12%)`,
  }
}

interface Badge {
  seq: number
  text: string
}

export function GameLoopgrid({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client (ZeroHour pattern).
  const [state, setState] = useState<LoopgridState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState<Badge[]>([])
  const [pulse, setPulse] = useState<{ axis: Axis; index: number; seq: number } | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<LoopgridState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevWon = useRef(false)
  const badgeSeq = useRef(0)
  const pulseSeq = useRef(0)

  const commit = useCallback((next: LoopgridState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(currentStreak(save.daily)) // 끊긴 streak은 0으로 (죽은 기록을 살아있는 척 안 함)
    const g = createGame(DAILY_CONFIG, dailySeed(new Date()))
    prevWon.current = false
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
      prevWon.current = false
      setBadges([])
      setPulse(null)
      commit(g)
    },
    [commit],
  )

  const persistWin = useCallback(
    (next: LoopgridState) => {
      const save = loadSave(storageKey)
      let nextSave: LoopgridSave = { ...save, score: Math.max(save.score, next.score) }
      if (modeRef.current === 'daily') {
        const bumped = bumpStreak(save.daily) // 어제 완료면 +1, 아니면 1, 오늘 중복은 멱등
        nextSave = { ...nextSave, daily: bumped }
        setStreak(bumped.streak)
      }
      setBest(nextSave.score)
      saveAll(storageKey, nextSave)
      recordResult(storageKey.replace(/^best:/, ''), { won: true })
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: LoopgridAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (action.type === 'cycle' && next.lastEvent !== 'none') {
        pulseSeq.current += 1
        setPulse({ axis: action.axis, index: action.index, seq: pulseSeq.current })
      }

      if (next.lastNewlyCompleted.length > 0) {
        const seq = ++badgeSeq.current
        const text =
          next.lastNewlyCompleted.length === 1
            ? `Row ${next.lastNewlyCompleted[0] + 1} locked!`
            : `${next.lastNewlyCompleted.length} rows locked!`
        setBadges((b) => [...b, { seq, text }])
      }

      if (next.won && !prevWon.current) persistWin(next)
      prevWon.current = next.won
    },
    [commit, play, persistWin],
  )

  // Board-level shortcuts: undo (u) + new game (r). Arrow controls are native
  // buttons, so no custom roving focus is needed for reachability.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      switch (e.key) {
        case 'u':
        case 'U':
          e.preventDefault()
          dispatch({ type: 'undo' })
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

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-140 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="loopgrid-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const n = state.config.n
  const won = state.won
  const undoDisabled = !state.lastMove || won

  const hint = won
    ? 'Aligned! Every row is one color.'
    : state.moves === 0
      ? 'Cycle rows and columns to sort each row into its own color. Tap any arrow to shift that line.'
      : 'Now tap any arrow to keep going.'

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
      <GameButton variant="ghost" onClick={() => dispatch({ type: 'undo' })} disabled={undoDisabled}>
        Undo
      </GameButton>
    </>
  )

  const cellPx = n >= 6 ? 40 : n >= 5 ? 46 : 52
  const arrowPx = 36

  const arrowBtnClass =
    'btn-press flex items-center justify-center rounded-md border border-border bg-surface text-sm font-bold text-fg-muted hover:border-neon-cyan/60 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:opacity-40'

  function rowPulsing(r: number): boolean {
    return !reduced && !!pulse && pulse.axis === 'row' && pulse.index === r
  }
  function colPulsing(c: number): boolean {
    return !reduced && !!pulse && pulse.axis === 'col' && pulse.index === c
  }

  return (
    <GameShell
      stats={[
        { label: 'Moves', value: state.moves, testId: 'moves' },
        { label: 'Par', value: state.par },
        { label: 'Best', value: best, testId: 'score' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={won ? 'Play again' : mode === 'daily' ? 'Replay Daily' : 'New Board'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-140"
    >
      <div
        role="group"
        aria-label="Loopgrid board"
        onKeyDown={onKeyDown}
        className="relative overflow-x-auto rounded-xl bg-surface p-4"
        style={reduced ? undefined : { animation: 'lg-board-in .3s ease-out both' }}
        data-testid="loopgrid-board"
      >
        <div className="mx-auto inline-flex flex-col items-center gap-1">
          {/* top: column-up arrows */}
          <div className="flex items-center gap-1" style={{ paddingLeft: arrowPx + 4, paddingRight: arrowPx + 4 }}>
            {Array.from({ length: n }, (_, c) => (
              <button
                key={c}
                type="button"
                onClick={() => dispatch({ type: 'cycle', axis: 'col', index: c, dir: -1 })}
                disabled={won}
                aria-label={`Shift column ${c + 1} up`}
                className={arrowBtnClass}
                style={{ width: cellPx, height: arrowPx }}
              >
                ▲
              </button>
            ))}
          </div>

          {state.grid.map((row, r) => (
            <div key={r} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => dispatch({ type: 'cycle', axis: 'row', index: r, dir: -1 })}
                disabled={won}
                aria-label={`Shift row ${r + 1} left`}
                className={arrowBtnClass}
                style={{ width: arrowPx, height: cellPx }}
              >
                ◀
              </button>
              <div
                className="flex items-center gap-1 rounded-md"
                style={
                  rowPulsing(r)
                    ? { animation: 'lg-pulse .15s ease-out both' }
                    : undefined
                }
              >
                {row.map((color, c) => {
                  const { bg, fg } = bandColor(color, n)
                  const locked = state.completedRows[r]
                  return (
                    <div
                      key={c}
                      data-testid="loopgrid-cell"
                      aria-hidden="true"
                      className="flex items-center justify-center rounded-md text-sm font-bold tabular-nums"
                      style={{
                        width: cellPx,
                        height: cellPx,
                        background: bg,
                        color: fg,
                        boxShadow: locked
                          ? '0 0 0 3px var(--neon-lime, #a3e635) inset, 0 0 10px rgba(163,230,53,.45)'
                          : colPulsing(c)
                            ? 'inset 0 0 0 2px rgba(255,255,255,.5)'
                            : undefined,
                        animation: colPulsing(c) ? 'lg-pulse .15s ease-out both' : undefined,
                      }}
                    >
                      {color}
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'cycle', axis: 'row', index: r, dir: 1 })}
                disabled={won}
                aria-label={`Shift row ${r + 1} right`}
                className={arrowBtnClass}
                style={{ width: arrowPx, height: cellPx }}
              >
                ▶
              </button>
            </div>
          ))}

          {/* bottom: column-down arrows */}
          <div className="flex items-center gap-1" style={{ paddingLeft: arrowPx + 4, paddingRight: arrowPx + 4 }}>
            {Array.from({ length: n }, (_, c) => (
              <button
                key={c}
                type="button"
                onClick={() => dispatch({ type: 'cycle', axis: 'col', index: c, dir: 1 })}
                disabled={won}
                aria-label={`Shift column ${c + 1} down`}
                className={arrowBtnClass}
                style={{ width: cellPx, height: arrowPx }}
              >
                ▼
              </button>
            ))}
          </div>
        </div>

        {badges.map((b) => (
          <span
            key={b.seq}
            data-testid="row-complete"
            aria-hidden="true"
            onAnimationEnd={() => setBadges((cur) => cur.filter((x) => x.seq !== b.seq))}
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-sm font-bold text-accent"
            style={
              reduced
                ? undefined
                : { animation: 'lg-badge .9s ease-out both' }
            }
          >
            {b.text}
          </span>
        ))}

        <GameOverlay show={won} variant="win" title="Aligned!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Moves <span className="font-bold text-accent">{state.moves}</span> / Par{' '}
              <span className="font-bold text-accent">{state.par}</span>
            </p>
            {mode === 'daily' && (
              <p>
                Streak <span className="font-bold text-accent">{streak}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {mode === 'daily' && (
              <DailyShareButton
                payload={() => {
                  const used = state.moves
                  const par = state.par
                  const grade = gradeFewer(used, par)
                  const glyph = barGlyph(used, par, `${used} MOVES · PAR ${par}`)
                  return {
                    gameName: 'Loopgrid',
                    dateISO: todayUTC(),
                    accent: '#a3e635',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/loopgrid`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Loopgrid',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      par,
                      `solved in ${used} moves (par ${par})`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes lg-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes lg-pulse { 0% { transform: scale(.97); opacity: .85 } 100% { transform: scale(1); opacity: 1 } }
          @keyframes lg-badge {
            0% { transform: translate(-50%, 6px) scale(.7); opacity: 0 }
            25% { transform: translate(-50%, 0) scale(1.12); opacity: 1 }
            100% { transform: translate(-50%, -14px) scale(1); opacity: 0 }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
