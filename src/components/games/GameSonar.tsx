'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  createGame,
  dailySeed as engineDailySeed,
  reduce,
  type Pos,
  type SonarAction,
  type SonarEvent,
  type SonarState,
} from '@/lib/games/sonar/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak, loadStreak, saveStreak, type DailyStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeFewer, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'
type Interaction = 'ping' | 'mark'

/** Streak lives under its own key — best:<slug> holds a plain number for the leaderboard. */
const DAILY_KEY = 'sonar:daily'

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

const SOUND: Record<SonarEvent, Parameters<ReturnType<typeof useGameSound>['play']>[0] | null> = {
  none: null,
  ping: 'flip',
  'ping-repeat': null,
  capture: 'eat',
  deduce: 'match',
  miss: 'error',
  illegal: 'error',
  win: 'win',
  lose: 'lose',
}

/** Blue(cold, far) -> red(hot, near) hue for a revealed Manhattan distance. */
function warmthColor(distance: number, size: number): string {
  const maxD = Math.max(1, 2 * (size - 1))
  const t = Math.min(1, Math.max(0, distance / maxD)) // 0 hot .. 1 cold
  const hue = 210 * t // 0 = red, 210 = blue
  return `hsl(${hue}, 88%, 60%)`
}

function cellLabel(state: SonarState, r: number, c: number): string {
  const cell = state.grid[r][c]
  const base = `Cell row ${r + 1} col ${c + 1}`
  if (cell.captured) return `${base}, target found`
  if (cell.miss) return `${base}, empty (wrong mark)`
  if (cell.ping !== null) return `${base}, pinged: distance ${cell.ping}`
  if (cell.cleared) return `${base}, empty`
  return `${base}, unknown`
}

export function GameSonar({ storageKey }: { storageKey: string }) {
  // SSR-safe: build the board only on the client.
  const [state, setState] = useState<SonarState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [interaction, setInteraction] = useState<Interaction>('ping')
  const [best, setBest] = useState(0)
  const [isBest, setIsBest] = useState(false)
  const [streak, setStreak] = useState(0)
  const [pingKey, setPingKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<SonarState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const interactionRef = useRef<Interaction>('ping')
  const prevOver = useRef(false)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])

  const commit = useCallback((next: SonarState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only). Default to the daily board.
  useEffect(() => {
    setBest(loadBest(storageKey))
    setStreak(currentStreak(loadStreak(DAILY_KEY)))
    modeRef.current = 'daily'
    const g = createGame(DAILY_CONFIG, engineDailySeed(todayUTC()))
    prevOver.current = false
    commit(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(
    (nextMode: Mode, diff: Difficulty) => {
      modeRef.current = nextMode
      const g =
        nextMode === 'daily'
          ? createGame(DAILY_CONFIG, engineDailySeed(todayUTC()))
          : createGame(DIFFICULTIES[diff], freshSeed())
      prevOver.current = false
      setPingKey(0)
      setIsBest(false)
      commit(g)
    },
    [commit],
  )

  const persistOver = useCallback(
    (next: SonarState) => {
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
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: SonarAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastPing && next.lastPing !== prev.lastPing) setPingKey((k) => k + 1)

      const over = next.status !== 'playing'
      if (over && !prevOver.current) persistOver(next)
      prevOver.current = over
    },
    [commit, play, persistOver],
  )

  const act = useCallback(
    (at: Pos) => {
      const kind = interactionRef.current
      dispatch({ type: kind === 'ping' ? 'ping' : 'claim', at })
    },
    [dispatch],
  )

  // Keyboard: roving cursor + ping/mark + new board.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          dispatch({ type: 'move', dRow: -1, dCol: 0 })
          break
        case 'ArrowDown':
          e.preventDefault()
          dispatch({ type: 'move', dRow: 1, dCol: 0 })
          break
        case 'ArrowLeft':
          e.preventDefault()
          dispatch({ type: 'move', dRow: 0, dCol: -1 })
          break
        case 'ArrowRight':
          e.preventDefault()
          dispatch({ type: 'move', dRow: 0, dCol: 1 })
          break
        case 'Enter':
          e.preventDefault()
          if (e.shiftKey) dispatch({ type: 'claim', at: s.cursor })
          else act(s.cursor)
          break
        case ' ':
          e.preventDefault()
          dispatch({ type: 'ping', at: s.cursor })
          break
        case 'f':
        case 'F':
        case 'm':
        case 'M':
          e.preventDefault()
          dispatch({ type: 'claim', at: s.cursor })
          break
        case 'r':
        case 'R':
          e.preventDefault()
          startBoard(modeRef.current, difficulty)
          break
      }
    },
    [dispatch, act, difficulty, startBoard],
  )

  // Keep DOM focus in sync with the roving cursor.
  useEffect(() => {
    if (!state) return
    const idx = state.cursor.row * state.size + state.cursor.col
    cellRefs.current[idx]?.focus()
  }, [state])

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

  const setInteractionMode = useCallback((i: Interaction) => {
    interactionRef.current = i
    setInteraction(i)
  }, [])

  const onCellClick = useCallback(
    (e: React.MouseEvent, at: Pos) => {
      if (e.shiftKey) dispatch({ type: 'claim', at })
      else act(at)
    },
    [dispatch, act],
  )

  const onCellContextMenu = useCallback(
    (e: React.MouseEvent, at: Pos) => {
      e.preventDefault()
      dispatch({ type: 'claim', at })
    },
    [dispatch],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="sonar-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const size = state.size
  const T = state.config.targets
  const foundCount = state.captured.length
  const won = state.status === 'won'
  const lost = state.status === 'lost'
  const over = won || lost
  const deduceCount = state.claims.filter((c) => c.hit).length

  const hint = won
    ? 'All contacts found! Every target located.'
    : lost
      ? 'Signal lost — too many wrong marks. Retry the board.'
      : interaction === 'mark'
        ? 'Mark mode: tap a cell you are sure hides a target to deduce it (no ping). A wrong mark costs a life.'
        : 'Ping any cell to read the Manhattan distance to the nearest target. Cross the distance rings, then switch to Mark to claim a target with no ping.'

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
      <div className="flex overflow-hidden rounded-lg border border-border" data-testid="sonar-mode">
        <button
          onClick={() => setInteractionMode('ping')}
          aria-pressed={interaction === 'ping'}
          className={`px-2.5 py-1.5 text-sm font-semibold ${interaction === 'ping' ? 'bg-neon-cyan text-stone-900' : 'bg-surface text-fg-muted'}`}
        >
          Ping
        </button>
        <button
          onClick={() => setInteractionMode('mark')}
          aria-pressed={interaction === 'mark'}
          className={`px-2.5 py-1.5 text-sm font-semibold ${interaction === 'mark' ? 'bg-neon-magenta text-stone-900' : 'bg-surface text-fg-muted'}`}
        >
          Mark
        </button>
      </div>
      <span
        className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm"
        aria-label={`${state.lives} lives remaining`}
        data-testid="lives"
      >
        <span aria-hidden="true" className="text-neon-red">
          {'♥'.repeat(Math.max(0, state.lives))}
          <span className="text-fg-muted/40">
            {'♥'.repeat(Math.max(0, state.config.lives - state.lives))}
          </span>
        </span>
      </span>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm" data-testid="found">
        Found <span className="font-bold text-accent">{foundCount}</span>/{T}
      </span>
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Pings', value: state.pingCount, testId: 'moves' },
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Best', value: best, testId: 'best' },
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
        @keyframes so-ring {
          0% { opacity: .55; transform: translate(-50%, -50%) scale(.15); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes so-pop {
          0% { opacity: 0; transform: scale(.6); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes so-pulse {
          0% { transform: scale(.5); }
          55% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        @keyframes so-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .so-anim { animation: none !important; }
        }
      `}</style>
      <div
        role="group"
        aria-label="Sonar board"
        onKeyDown={onKeyDown}
        className="relative grid aspect-square w-full gap-1.5 rounded-xl bg-surface p-2"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        data-testid="sonar-board"
      >
        {Array.from({ length: size * size }, (_, i) => {
          const r = Math.floor(i / size)
          const c = i % size
          const cell = state.grid[r][c]
          const isCursor = state.cursor.row === r && state.cursor.col === c
          const isLastPing = state.lastPing != null && state.lastPing.at.row === r && state.lastPing.at.col === c
          const pinged = cell.ping !== null && !cell.captured
          const showRing = isLastPing && !reduced && !over

          let bg = 'bg-white/[0.04] hover:bg-white/[0.09]'
          if (cell.captured) bg = 'bg-neon-green/15'
          else if (cell.miss) bg = 'bg-neon-red/15'
          else if (pinged) bg = 'bg-white/[0.10]'
          else if (cell.cleared) bg = 'bg-white/[0.015]'

          return (
            <button
              key={i}
              ref={(el) => {
                cellRefs.current[i] = el
              }}
              type="button"
              data-testid="cell"
              data-row={r}
              data-col={c}
              tabIndex={isCursor ? 0 : -1}
              aria-label={cellLabel(state, r, c)}
              aria-pressed={isCursor}
              onClick={(e) => onCellClick(e, { row: r, col: c })}
              onContextMenu={(e) => onCellContextMenu(e, { row: r, col: c })}
              className={`btn-press relative flex aspect-square items-center justify-center overflow-hidden rounded-lg text-base font-bold tabular-nums shadow-inner transition-[background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${bg} ${isCursor ? 'ring-2 ring-neon-cyan' : ''}`}
            >
              {cell.captured ? (
                <span
                  aria-hidden="true"
                  className="so-anim text-lg text-neon-green"
                  style={{
                    animation: reduced ? undefined : 'so-pulse 320ms ease-out',
                    filter: 'drop-shadow(0 0 6px var(--neon-green))',
                  }}
                >
                  ⊙
                </span>
              ) : cell.miss ? (
                <span
                  aria-hidden="true"
                  className="so-anim text-lg text-neon-red"
                  style={{ animation: reduced ? undefined : 'so-shake 240ms ease-out' }}
                >
                  ✕
                </span>
              ) : pinged ? (
                <span
                  key={`${i}:${cell.ping}:${pingKey}`}
                  aria-hidden="true"
                  className="so-anim"
                  style={{
                    color: warmthColor(cell.ping as number, size),
                    textShadow: `0 0 6px ${warmthColor(cell.ping as number, size)}66`,
                    animation: reduced ? undefined : 'so-pop 180ms ease-out',
                  }}
                >
                  {cell.ping}
                </span>
              ) : null}

              {showRing && (
                <span
                  key={`ring:${pingKey}`}
                  aria-hidden="true"
                  onAnimationEnd={(e) => e.stopPropagation()}
                  className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border-2 border-neon-cyan"
                  style={{ width: size * 44, height: size * 44, animation: 'so-ring 620ms ease-out both' }}
                />
              )}
            </button>
          )
        })}

        <GameOverlay show={won} variant="win" title="All contacts found!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            {isBest && <p className="font-bold text-accent">New best score!</p>}
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Pings <span className="font-bold text-accent">{state.pingCount}</span> / Par{' '}
              <span className="font-bold text-accent">{state.par}</span>
            </p>
            <p>
              Deduced <span className="font-bold text-accent">{deduceCount}</span>/{T}
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
                  const used = state.pingCount
                  const par = state.par
                  const grade = gradeFewer(used, par)
                  const glyph = barGlyph(used, par, `${used} PINGS · PAR ${par}`)
                  return {
                    gameName: 'Sonar',
                    dateISO: todayUTC(),
                    accent: '#4d7cff',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/sonar`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Sonar',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      par,
                      `found ${T} in ${used} pings (par ${par})`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <GameOverlay show={lost} variant="lose" title="Signal lost" testId="game-over">
          {isBest && <p className="text-sm font-bold text-accent">New best score!</p>}
          <p className="text-sm text-fg-muted">
            Found <span className="font-bold text-accent">{foundCount}</span> of {T} before the sonar went dark.
          </p>
          <GameButton onClick={onNewGame}>Retry</GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
