'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BANKSHOT_DIFFICULTIES,
  BOARD_H,
  BOARD_W,
  DAILY_CONFIG,
  FP,
  LAUNCH_POINT,
  TARGET_R,
  createGame,
  reduce,
  type BankshotAction,
  type BankshotState,
  type ShotEvent,
  type ShotResult,
} from '@/lib/games/bankshot/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeFewer, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'

interface BankshotSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

/** Dedicated key for the daily streak; `best:<slug>` stays a bare number so the
 * weekly leaderboard (which reads it with Number()) never sees JSON. */
const DAILY_KEY = 'bankshot:daily'

function loadDaily(): BankshotSave['daily'] {
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

function loadSave(storageKey: string): BankshotSave {
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

function saveAll(storageKey: string, save: BankshotSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

const SOUND: Record<ShotEvent, SoundName | null> = {
  none: null,
  win: 'win',
  // Restrained, not punishing -- a shot that simply didn't land.
  miss: 'mismatch',
  illegal: 'error',
  undo: 'move',
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

// -- Board layout ------------------------------------------------------------

const ANIM_DURATION_MS = 1300 // fixed wall-clock duration for replaying a precomputed path
const GHOST_LIMIT = 3
const GHOST_OPACITIES = [0.12, 0.2, 0.32] // oldest -> newest (length == GHOST_LIMIT)
const DRAG_WU_PER_POWER = 1.4 // world-units of drag per power unit

/** Engine fixed-point (FP=1000) -> world-unit, for rendering (viewBox is in world-units). */
function wu(v: number): number {
  return v / FP
}
function wuPt(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x / FP, y: p.y / FP }
}
function polyPoints(path: { x: number; y: number }[]): string {
  return path.map((p) => `${wu(p.x)},${wu(p.y)}`).join(' ')
}

interface DragState {
  pointerId: number
}

export function GameBankshot({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<BankshotState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)

  // Ghost trails + current-shot animation live in component state -- the
  // engine only ever remembers the single most recent shot (`lastShot`);
  // history for the fading ghost trails is a presentation-only concern.
  const [ghosts, setGhosts] = useState<{ x: number; y: number }[][]>([])
  const [animShot, setAnimShot] = useState<ShotResult | null>(null)
  const [animProgress, setAnimProgress] = useState(1)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<BankshotState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevWonRef = useRef(false)
  const animatedShotRef = useRef<ShotResult | null>(null)
  const rafRef = useRef<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const commit = useCallback((next: BankshotState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const persistWin = useCallback(
    (next: BankshotState) => {
      const save = loadSave(storageKey)
      let nextSave: BankshotSave = { ...save, score: Math.max(save.score, next.score) }
      if (modeRef.current === 'daily') {
        const bumped = bumpStreak(save.daily)
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
    (action: BankshotAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.won && !prevWonRef.current) persistWin(next)
      prevWonRef.current = next.won
    },
    [commit, play, persistWin],
  )

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(currentStreak(save.daily))
    const g = createGame(DAILY_CONFIG, dailySeed(new Date()), LAUNCH_POINT.normal)
    prevWonRef.current = false
    animatedShotRef.current = null
    setGhosts([])
    setAnimShot(null)
    setAnimProgress(1)
    commit(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(
    (nextMode: Mode, diff: Difficulty) => {
      modeRef.current = nextMode
      const g =
        nextMode === 'daily'
          ? createGame(DAILY_CONFIG, dailySeed(new Date()), LAUNCH_POINT.normal)
          : createGame(BANKSHOT_DIFFICULTIES[diff], freshSeed(), LAUNCH_POINT[diff])
      prevWonRef.current = false
      animatedShotRef.current = null
      setGhosts([])
      setAnimShot(null)
      setAnimProgress(1)
      commit(g)
    },
    [commit],
  )

  // Replay the just-fired shot's precomputed path over a fixed wall-clock
  // duration -- simulateShot() already ran the entire physics simulation
  // synchronously, so this is pure animation, never re-simulation. Undo is
  // deliberately excluded (its reverted lastShot snaps in immediately).
  useEffect(() => {
    if (!state) return
    if (state.lastEvent !== 'win' && state.lastEvent !== 'miss') return
    const shot = state.lastShot
    if (!shot || shot === animatedShotRef.current) return
    animatedShotRef.current = shot

    setGhosts((g) => {
      const prevShot = animShot
      if (!prevShot || prevShot.path.length < 2) return g
      return [...g, prevShot.path].slice(-GHOST_LIMIT)
    })

    if (reducedRef.current || shot.path.length <= 1) {
      setAnimShot(shot)
      setAnimProgress(1)
      return
    }
    setAnimShot(shot)
    setAnimProgress(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // On undo, snap the displayed ball straight to the reverted shot (or the
  // launch point) with no animation, and drop the most recent ghost -- we are
  // walking history backwards, not firing a new shot.
  useEffect(() => {
    if (!state) return
    if (state.lastEvent !== 'undo') return
    animatedShotRef.current = state.lastShot
    setAnimShot(state.lastShot)
    setAnimProgress(1)
    setGhosts((g) => (g.length > 0 ? g.slice(0, -1) : g))
  }, [state])

  // rAF loop driving animProgress from 0 -> 1 over ANIM_DURATION_MS.
  useEffect(() => {
    if (animShot === null || animProgress >= 1) return
    const t0 = performance.now()
    const frame = (t: number) => {
      const p = Math.min(1, (t - t0) / ANIM_DURATION_MS)
      setAnimProgress(p)
      if (p < 1) rafRef.current = requestAnimationFrame(frame)
      else rafRef.current = null
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animShot])

  // Keyboard controls.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const step = e.shiftKey ? 10 : 1
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          dispatch({ type: 'setAngle', deg: s.aimDeg - step })
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          dispatch({ type: 'setAngle', deg: s.aimDeg + step })
          break
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault()
          dispatch({ type: 'setPower', power: s.power + step })
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault()
          dispatch({ type: 'setPower', power: s.power - step })
          break
        case ' ':
        case 'Enter':
          e.preventDefault()
          if (!s.won) dispatch({ type: 'fire' })
          break
        case 'u':
        case 'U':
          e.preventDefault()
          if (s.undosLeft > 0 && s.undoStack.length > 0) dispatch({ type: 'undo' })
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

  // Drag-to-aim from the launch point: angle from the drag vector, power from
  // drag distance (same pattern as Gravwell's pad drag).
  const updateAimFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      const s = stateRef.current
      if (!svg || !s || s.won) return
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const local = pt.matrixTransform(ctm.inverse())
      const launchWU = wuPt(s.level.launch)
      const dx = local.x - launchWU.x
      const dy = local.y - launchWU.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      const power = dist / DRAG_WU_PER_POWER
      dispatch({ type: 'setAngle', deg: angle })
      dispatch({ type: 'setPower', power })
    },
    [dispatch],
  )

  const onLaunchPointerDown = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      const s = stateRef.current
      if (!s || s.won) return
      ;(e.target as Element).setPointerCapture(e.pointerId)
      dragRef.current = { pointerId: e.pointerId }
      updateAimFromPointer(e.clientX, e.clientY)
    },
    [updateAimFromPointer],
  )
  const onLaunchPointerMove = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
      updateAimFromPointer(e.clientX, e.clientY)
    },
    [updateAimFromPointer],
  )
  const onLaunchPointerUp = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    dragRef.current = null
    // Drop does NOT auto-fire -- avoids misfires; the Fire button/Space commits the shot.
  }, [])

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
      <div className="mx-auto w-full max-w-150 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="bankshot-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.won
  const canAct = !won
  const animating = animShot !== null && animProgress < 1 && !reduced
  const canUndo = state.undosLeft > 0 && state.undoStack.length > 0

  const launchWU = wuPt(state.level.launch)
  const displayPath = animShot?.path ?? null
  const pathIdx = displayPath ? Math.min(displayPath.length - 1, Math.floor(animProgress * (displayPath.length - 1))) : 0
  const ballFP = displayPath ? displayPath[pathIdx] : state.level.launch
  const ballWU = wuPt(ballFP)

  const hint = won
    ? 'Sunk it! Locked into the target.'
    : 'Drag from the ball, or use the steppers, to aim + set power, then Fire. Walls bounce the ball -- use the cushions.'

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
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Shots', value: state.shots, testId: 'shots' },
        { label: 'Par', value: state.config.par },
        { label: 'Best', value: best, testId: 'score', float: true },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={won ? 'Play again' : mode === 'daily' ? 'Replay Daily' : 'New Board'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-150"
    >
      <div
        role="group"
        aria-label="Bankshot board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative overflow-hidden rounded-xl bg-surface p-3"
        style={reduced ? undefined : { animation: 'bs-board-in .3s ease-out both' }}
        data-testid="bankshot-board"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${BOARD_W / FP} ${BOARD_H / FP}`}
          className="mx-auto block w-full max-w-175 touch-none"
          style={{ aspectRatio: `${BOARD_W / FP}/${BOARD_H / FP}`, background: 'var(--bg-2)' }}
          role="img"
          aria-label={`Bankshot board, shot ${state.shots}, par ${state.config.par}`}
        >
          {/* Ghost trails from earlier shots this board */}
          {ghosts.map((p, i) => (
            <polyline
              key={i}
              points={polyPoints(p)}
              fill="none"
              stroke="var(--fg-muted)"
              strokeWidth={0.5}
              strokeLinecap="round"
              opacity={GHOST_OPACITIES[GHOST_OPACITIES.length - ghosts.length + i] ?? 0.12}
            />
          ))}

          {/* Current/most-recent shot's flown trajectory (progressively revealed while animating) */}
          {displayPath && pathIdx > 0 && (
            <polyline
              points={polyPoints(displayPath.slice(0, pathIdx + 1))}
              fill="none"
              stroke="var(--neon-cyan)"
              strokeWidth={0.7}
              strokeLinecap="round"
              opacity={0.85}
            />
          )}

          {/* Walls */}
          {state.level.walls.map((w, i) => (
            <rect
              key={i}
              data-testid="wall"
              x={wu(w.x0)}
              y={wu(w.y0)}
              width={wu(w.x1 - w.x0)}
              height={wu(w.y1 - w.y0)}
              fill="var(--fg-muted)"
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={0.3}
              rx={0.6}
            />
          ))}

          {/* Target */}
          <circle
            data-testid="target"
            cx={wu(state.level.target.x)}
            cy={wu(state.level.target.y)}
            r={wu(TARGET_R)}
            fill={won ? 'var(--neon-lime)' : 'none'}
            fillOpacity={won ? 0.35 : 0}
            stroke="var(--neon-lime)"
            strokeOpacity={won ? 0.95 : 0.65}
            strokeWidth={0.6}
          />
          <circle cx={wu(state.level.target.x)} cy={wu(state.level.target.y)} r={0.6} fill="var(--neon-lime)" />

          {/* Aim line + launch point (drag target) */}
          {!won && (
            <line
              x1={launchWU.x}
              y1={launchWU.y}
              x2={launchWU.x + Math.cos((state.aimDeg * Math.PI) / 180) * (4 + state.power * 0.12)}
              y2={launchWU.y + Math.sin((state.aimDeg * Math.PI) / 180) * (4 + state.power * 0.12)}
              stroke="var(--neon-cyan)"
              strokeWidth={0.4}
              strokeLinecap="round"
              opacity={0.9}
              aria-hidden="true"
            />
          )}
          <circle
            data-testid="launch-point"
            cx={launchWU.x}
            cy={launchWU.y}
            r={1.6}
            fill="none"
            stroke="var(--neon-cyan)"
            strokeOpacity={won ? 0.35 : 0.9}
            strokeWidth={0.35}
            strokeDasharray="0.6 0.5"
            style={{ cursor: won ? 'default' : 'grab', touchAction: 'none' }}
            onPointerDown={onLaunchPointerDown}
            onPointerMove={onLaunchPointerMove}
            onPointerUp={onLaunchPointerUp}
            onPointerCancel={onLaunchPointerUp}
          />

          {/* Ball */}
          <circle
            data-testid="ball"
            cx={ballWU.x}
            cy={ballWU.y}
            r={wu(6 * FP)}
            fill={won ? 'var(--neon-lime)' : 'var(--neon-amber)'}
          />
        </svg>

        {/* Steppers: precision fallback for touch/keyboard-shy players */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/80 px-2 py-1.5">
            <span className="text-xs text-fg-muted">Angle</span>
            {[-10, -1, 1, 10].map((d) => (
              <GameButton
                key={d}
                variant="ghost"
                className="min-w-11 px-2 py-1.5"
                disabled={!canAct}
                onClick={() => dispatch({ type: 'setAngle', deg: state.aimDeg + d })}
                aria-label={`Angle ${d > 0 ? '+' : ''}${d}`}
              >
                {d > 0 ? `+${d}` : d}
              </GameButton>
            ))}
            <span data-testid="angle" className="w-14 text-center text-sm font-bold tabular-nums text-accent">
              {Math.round(state.aimDeg)}°
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/80 px-2 py-1.5">
            <span className="text-xs text-fg-muted">Power</span>
            {[-5, -1, 1, 5].map((d) => (
              <GameButton
                key={d}
                variant="ghost"
                className="min-w-11 px-2 py-1.5"
                disabled={!canAct}
                onClick={() => dispatch({ type: 'setPower', power: state.power + d })}
                aria-label={`Power ${d > 0 ? '+' : ''}${d}`}
              >
                {d > 0 ? `+${d}` : d}
              </GameButton>
            ))}
            <span data-testid="power" className="w-10 text-center text-sm font-bold tabular-nums text-accent">
              {state.power}
            </span>
          </div>
          <GameButton onClick={() => dispatch({ type: 'fire' })} disabled={!canAct || animating} data-testid="fire">
            Fire
          </GameButton>
          <GameButton
            variant="ghost"
            onClick={() => dispatch({ type: 'undo' })}
            disabled={!canUndo}
            data-testid="undo"
          >
            Undo ({state.undosLeft} left)
          </GameButton>
        </div>

        <GameOverlay show={won} variant="win" title="Sunk it!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Shots <span className="font-bold text-accent">{state.shots}</span> / Par{' '}
              <span className="font-bold text-accent">{state.config.par}</span>
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
                  const shots = state.shots
                  const par = state.config.par
                  const grade = gradeFewer(shots, par)
                  const glyph = barGlyph(shots, par, `${shots} SHOTS · PAR ${par}`)
                  return {
                    gameName: 'Bankshot',
                    dateISO: todayUTC(),
                    accent: '#fbbf24',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/bankshot`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Bankshot',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      par,
                      `sank it in ${shots} shots (par ${par})`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes bs-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
        `}</style>
      </div>
    </GameShell>
  )
}
