'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  createGame,
  isStranded,
  reduce,
  type DeepdiveAction,
  type DeepdiveConfig,
  type DeepdiveEvent,
  type DeepdiveState,
  type Dir,
} from '@/lib/games/deepdive/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeRatio, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'

interface DeepdiveSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

/**
 * 일일 연속 기록 전용 키. best:<slug>에는 숫자만 넣는다 — 주간 리더보드가
 * 그 키를 Number()로 읽으므로(모든 게임 공통 규약) JSON을 넣으면 점수를 못 읽는다.
 */
const DAILY_KEY = 'deepdive:daily'

const SOUND: Record<DeepdiveEvent, SoundName | null> = {
  none: null,
  move: 'move',
  collect: 'eat',
  jackpot: 'match',
  bank: 'merge',
  drown: 'lose',
  clear: 'win',
  illegal: 'error',
  retire: 'flip',
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadDaily(): DeepdiveSave['daily'] {
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

function loadSave(storageKey: string): DeepdiveSave {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { score: 0 }
    const n = Number(raw)
    if (Number.isFinite(n)) return { score: Math.max(0, Math.floor(n)), daily: loadDaily() }
  } catch {
    // corrupt / legacy -> reset
  }
  return { score: 0 }
}

function saveAll(storageKey: string, save: DeepdiveSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

/** Depth-banded HSL, cool → warm as the shaft deepens (legible light + dark). */
function depthColor(row: number, rows: number): string {
  if (row === 0) return 'hsl(196 70% 46%)' // waterline cyan
  const t = rows <= 2 ? 0 : (row - 1) / (rows - 2) // 0..1
  const hue = Math.round(210 - t * 190) // 210 (blue) -> 20 (amber-red)
  const light = Math.round(26 - t * 10) // deeper = darker
  return `hsl(${hue} 55% ${light}%)`
}

const CELL = 44
const GAP = 4
const STEP = CELL + GAP

interface Badge {
  seq: number
  gain: number
}

export function GameDeepdive({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<DeepdiveState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState<Badge[]>([])

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<DeepdiveState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const bestRef = useRef(0)
  const prevOver = useRef(false)
  const badgeSeq = useRef(0)
  const boardRef = useRef<HTMLDivElement | null>(null)

  const commit = useCallback((next: DeepdiveState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    bestRef.current = save.score
    setStreak(currentStreak(save.daily))
    const g = createGame(DAILY_CONFIG, dailySeed(new Date()))
    prevOver.current = false
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
      prevOver.current = false
      setBadges([])
      commit(g)
    },
    [commit],
  )

  const persist = useCallback(
    (next: DeepdiveState) => {
      const save = loadSave(storageKey)
      const nextScore = Math.max(save.score, next.banked)
      let nextSave: DeepdiveSave = { ...save, score: nextScore }
      // streak bumps only when the daily shaft is fully cleared.
      if (next.won && modeRef.current === 'daily') {
        const bumped = bumpStreak(save.daily)
        nextSave = { ...nextSave, daily: bumped }
        setStreak(bumped.streak)
      }
      bestRef.current = nextScore
      setBest(nextScore)
      saveAll(storageKey, nextSave)
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: DeepdiveAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastEvent === 'jackpot' && next.lastGain > 0) {
        const seq = ++badgeSeq.current
        setBadges((b) => [...b, { seq, gain: next.lastGain }])
      }

      // Live Best update whenever locked score grows; persist run end too.
      if (next.banked > bestRef.current || (next.over && !prevOver.current)) persist(next)
      if (next.over && !prevOver.current) {
        recordResult(storageKey.replace(/^best:/, ''), { won: next.won })
      }
      prevOver.current = next.over
    },
    [commit, play, persist, storageKey],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const move = (dir: Dir) => {
        e.preventDefault()
        dispatch({ type: 'move', dir })
      }
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          move('up')
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          move('down')
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          move('left')
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          move('right')
          break
        case 'Escape':
          e.preventDefault()
          dispatch({ type: 'retire' })
          break
        case 'r':
        case 'R':
          e.preventDefault()
          if (modeRef.current === 'daily') dispatch({ type: 'reset' })
          else startBoard('practice', difficulty)
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
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="deepdive-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const cfg: DeepdiveConfig = state.config
  const { rows, cols, capacity } = cfg
  const over = state.over
  const stranded = isStranded(state)
  const lowAir = !over && state.air <= Math.ceil(capacity * 0.25)

  const hint = state.won
    ? 'Shaft cleared — every treasure banked.'
    : state.drowned
      ? 'Drowned. The unbanked haul is gone — dive again.'
      : stranded
        ? 'No breath left to dive. Press Esc (or Retire) to surface for good.'
        : 'Tap an adjacent cell to descend and grab treasure. Touch the surface to bank it — surface before your air runs out.'

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
      <GameButton
        variant="ghost"
        onClick={() => dispatch({ type: 'retire' })}
        disabled={over || state.pos.row !== 0}
      >
        Retire
      </GameButton>
    </>
  )

  const boardW = cols * CELL + (cols - 1) * GAP
  const boardH = rows * CELL + (rows - 1) * GAP

  return (
    <GameShell
      stats={[
        { label: 'Air', value: state.air },
        { label: 'Haul', value: state.haul, float: true },
        { label: 'Depth', value: state.deepest },
        { label: 'Best', value: best, testId: 'score', float: true },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={over ? 'Play again' : mode === 'daily' ? 'Replay Daily' : 'New Shaft'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-100"
    >
      <div
        role="group"
        aria-label="Deepdive board"
        onKeyDown={onKeyDown}
        tabIndex={0}
        className={`relative overflow-auto rounded-xl bg-surface p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          lowAir ? 'dd-low' : ''
        }`}
        style={
          lowAir && !reduced
            ? { animation: 'dd-lowpulse 1s ease-in-out infinite' }
            : lowAir
              ? { boxShadow: 'inset 0 0 0 2px var(--neon-red)' }
              : undefined
        }
        data-testid="deepdive-board"
      >
        <div className="mx-auto" style={{ width: boardW }}>
          <div
            role="grid"
            aria-label={`Shaft, ${cols} columns by ${rows} rows`}
            aria-live="polite"
            className="relative"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
              gap: GAP,
              width: boardW,
              height: boardH,
            }}
          >
            {state.grid.map((rowCells, r) =>
              rowCells.map((cell, cc) => {
                const isSurface = r === 0
                const isDiver = state.pos.row === r && state.pos.col === cc
                // Direction from diver to this cell (null if not orthogonally adjacent).
                let dir: Dir | null = null
                if (r === state.pos.row - 1 && cc === state.pos.col) dir = 'up'
                else if (r === state.pos.row + 1 && cc === state.pos.col) dir = 'down'
                else if (r === state.pos.row && cc === state.pos.col - 1) dir = 'left'
                else if (r === state.pos.row && cc === state.pos.col + 1) dir = 'right'
                const adjacent = dir !== null
                const affordable = adjacent && state.air >= cell.cost
                const dim = adjacent && !affordable

                const label = isSurface
                  ? isDiver
                    ? `Surface, column ${cc + 1}, diver here`
                    : `Surface, column ${cc + 1}`
                  : `Depth ${r}, column ${cc + 1}, cost ${cell.cost}, treasure ${cell.treasure}`

                return (
                  <button
                    key={`${r}-${cc}`}
                    type="button"
                    role="gridcell"
                    data-testid="cell"
                    aria-label={label}
                    aria-disabled={dim || undefined}
                    disabled={over}
                    onClick={() => {
                      if (dir) dispatch({ type: 'move', dir })
                    }}
                    className={`relative flex flex-col items-center justify-center rounded-md text-center transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      affordable ? 'dd-afford' : ''
                    }`}
                    style={{
                      width: CELL,
                      height: CELL,
                      background: depthColor(r, rows),
                      opacity: dim ? 0.4 : 1,
                      border: affordable
                        ? '2px solid var(--neon-cyan)'
                        : isSurface
                          ? '1px solid color-mix(in srgb, var(--neon-cyan) 55%, transparent)'
                          : '1px solid rgba(0,0,0,0.35)',
                      boxShadow: affordable
                        ? '0 0 10px color-mix(in srgb, var(--neon-cyan) 55%, transparent)'
                        : undefined,
                    }}
                  >
                    {isSurface ? (
                      <span aria-hidden="true" className="text-[10px] font-bold tracking-widest text-cyan-100/80">
                        ≈≈≈
                      </span>
                    ) : (
                      <>
                        {cell.treasure > 0 && (
                          <span
                            aria-hidden="true"
                            className="text-sm font-extrabold leading-none tabular-nums"
                            style={{
                              color: cell.treasure >= 60 ? 'var(--neon-lime)' : 'var(--neon-cyan)',
                              textShadow: '0 0 6px currentColor',
                            }}
                          >
                            {cell.treasure}
                          </span>
                        )}
                        <span
                          aria-hidden="true"
                          className="mt-0.5 text-[9px] font-bold leading-none tabular-nums"
                          style={{ color: 'var(--neon-amber)', opacity: 0.9 }}
                        >
                          −{cell.cost}
                        </span>
                      </>
                    )}
                  </button>
                )
              }),
            )}

            {/* Diver token overlaid on the grid, animated across cells. */}
            <span
              data-testid="diver"
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 flex items-center justify-center rounded-full"
              style={{
                width: CELL,
                height: CELL,
                transform: `translate(${state.pos.col * STEP}px, ${state.pos.row * STEP}px)`,
                transition: reduced ? undefined : 'transform .18s ease-out',
              }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-base"
                style={{
                  background: 'radial-gradient(circle at 35% 30%, #fff6, var(--neon-magenta))',
                  boxShadow: '0 0 12px var(--neon-magenta)',
                }}
              >
                🤿
              </span>
            </span>
          </div>
        </div>

        {badges.map((b) => (
          <span
            key={b.seq}
            data-testid="jackpot"
            aria-hidden="true"
            onAnimationEnd={() => setBadges((cur) => cur.filter((x) => x.seq !== b.seq))}
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-neon-lime/60 bg-neon-lime/15 px-3 py-1 text-sm font-bold"
            style={{
              color: 'var(--neon-lime)',
              ...(reduced ? {} : { animation: 'dd-badge .9s ease-out both' }),
            }}
          >
            Jackpot +{b.gain}
          </span>
        ))}

        <GameOverlay
          show={over}
          variant={state.won ? 'win' : 'lose'}
          title={state.won ? 'Shaft cleared!' : state.drowned ? 'Drowned!' : 'Surfaced'}
          testId="game-over"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Banked <span className="font-bold text-accent">{state.banked}</span>
            </p>
            {state.drowned && state.drownedHaul > 0 && (
              <p>
                Lost haul <span className="font-bold text-neon-red">{state.drownedHaul}</span>
              </p>
            )}
            <p>
              Deepest <span className="font-bold text-accent">{state.deepest}</span>
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
                  const isNewBest = state.banked >= best
                  const grade = gradeRatio(state.banked, best, isNewBest)
                  const glyph = barGlyph(state.deepest, undefined, `DEPTH ${state.deepest}`)
                  return {
                    gameName: 'Deepdive',
                    dateISO: todayUTC(),
                    accent: '#22d3ee',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/deepdive`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.banked} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Deepdive',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      undefined,
                      `banked ${state.banked} (depth ${state.deepest})`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes dd-badge {
            0% { transform: translate(-50%, 6px) scale(.7); opacity: 0 }
            25% { transform: translate(-50%, 0) scale(1.12); opacity: 1 }
            100% { transform: translate(-50%, -16px) scale(1); opacity: 0 }
          }
          @keyframes dd-lowpulse {
            0%, 100% { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--neon-red) 45%, transparent) }
            50% { box-shadow: inset 0 0 14px 2px var(--neon-red) }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
