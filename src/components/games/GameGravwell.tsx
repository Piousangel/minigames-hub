'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  GRAZE_MULT,
  MAX_TICKS_PER_ATTEMPT,
  SCALE,
  createGame,
  reduce,
  simulatePreview,
  type Difficulty,
  type GravwellAction,
  type GravwellConfig,
  type GravwellEvent,
  type GravwellState,
  type Vec,
} from '@/lib/games/gravwell/engine'
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

interface GravwellSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

/** Dedicated key for the daily streak; `best:<slug>` stays a bare number so the
 * weekly leaderboard (which reads it with Number()) never sees JSON. */
const DAILY_KEY = 'gravwell:daily'

function loadDaily(): GravwellSave['daily'] {
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

function loadSave(storageKey: string): GravwellSave {
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

function saveAll(storageKey: string, save: GravwellSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

const SOUND: Record<GravwellEvent, SoundName | null> = {
  none: null,
  aim: null,
  launch: 'move',
  tick: null,
  graze: 'match',
  crash: 'error',
  oob: 'mismatch',
  timeout: 'mismatch',
  win: 'win',
  lose: 'lose',
  reset: null,
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

// -- Board layout --------------------------------------------------------------

const TICKS_PER_FRAME = 3 // paces a 900-tick max flight to ~5s at 60fps
const PREVIEW_TICKS = 260
const DRAG_WU_PER_POWER = 0.22 // world-units of drag per power unit
const GHOST_OPACITIES = [0.12, 0.2, 0.32] // oldest -> newest (length == GHOST_LIMIT)

/** mu -> world-unit, for rendering (viewBox is in world-units). */
function wu(v: number): number {
  return v / SCALE
}
function wuPt(p: Vec): { x: number; y: number } {
  return { x: p.x / SCALE, y: p.y / SCALE }
}

function polyPoints(path: Vec[]): string {
  return path.map((p) => `${wu(p.x)},${wu(p.y)}`).join(' ')
}

function planetFill(mass: number, massRange: [number, number]): string {
  const [m0, m1] = massRange
  const t = m1 > m0 ? Math.max(0, Math.min(1, (mass - m0) / (m1 - m0))) : 0.5
  // Light rocky (cyan) -> heavy dense (purple), darkening slightly with mass.
  const hue = 260 - t * 80
  const light = 62 - t * 16
  return `hsl(${hue} 70% ${light}%)`
}

interface Badge {
  seq: number
  kind: 'graze' | 'crash' | 'win'
}

interface DragState {
  pointerId: number
}

export function GameGravwell({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<GravwellState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState<Badge[]>([])

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<GravwellState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevPhaseRef = useRef<GravwellState['phase']>('aiming')
  const badgeSeq = useRef(0)
  const rafRef = useRef<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const commit = useCallback((next: GravwellState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const persistWin = useCallback(
    (next: GravwellState) => {
      const save = loadSave(storageKey)
      let nextSave: GravwellSave = { ...save, score: Math.max(save.score, next.score) }
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
    (action: GravwellAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastEvent === 'graze') {
        const seq = ++badgeSeq.current
        setBadges((b) => [...b, { seq, kind: 'graze' }])
      } else if (next.phase !== prevPhaseRef.current) {
        if (next.phase === 'won') {
          const seq = ++badgeSeq.current
          setBadges((b) => [...b, { seq, kind: 'win' }])
        } else if (next.lastEvent === 'crash') {
          const seq = ++badgeSeq.current
          setBadges((b) => [...b, { seq, kind: 'crash' }])
        }
      }

      if (next.phase !== prevPhaseRef.current) {
        if (next.phase === 'won') persistWin(next)
        else if (next.phase === 'lost') recordResult(storageKey.replace(/^best:/, ''), { won: false })
      }
      prevPhaseRef.current = next.phase
    },
    [commit, play, persistWin, storageKey],
  )

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(currentStreak(save.daily))
    const g = createGame(DAILY_CONFIG, dailySeed(new Date()))
    prevPhaseRef.current = 'aiming'
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
      prevPhaseRef.current = 'aiming'
      setBadges([])
      commit(g)
    },
    [commit],
  )

  // Flight loop: advance ticks each frame while flying. Under reduced motion,
  // fast-forward synchronously to the outcome instead of animating it.
  useEffect(() => {
    if (!state || state.phase !== 'flying') return

    if (reducedRef.current) {
      let guard = 0
      while (stateRef.current?.phase === 'flying' && guard < MAX_TICKS_PER_ATTEMPT + 5) {
        dispatch({ type: 'tick' })
        guard++
      }
      return
    }

    const frame = () => {
      for (let i = 0; i < TICKS_PER_FRAME; i++) {
        if (stateRef.current?.phase !== 'flying') break
        dispatch({ type: 'tick' })
      }
      if (stateRef.current?.phase === 'flying') {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase])

  // Keyboard controls.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const step = e.shiftKey ? 5 : 1
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          dispatch({ type: 'nudgeAngle', delta: -step })
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          dispatch({ type: 'nudgeAngle', delta: step })
          break
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault()
          dispatch({ type: 'nudgePower', delta: step })
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault()
          dispatch({ type: 'nudgePower', delta: -step })
          break
        case ' ':
        case 'Enter':
          e.preventDefault()
          if (s.phase === 'aiming') dispatch({ type: 'launch' })
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

  // Drag-to-aim from the launch pad.
  const updateAimFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      const s = stateRef.current
      if (!svg || !s) return
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const local = pt.matrixTransform(ctm.inverse())
      const padWU = wuPt(s.pad)
      const dx = local.x - padWU.x
      const dy = local.y - padWU.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const angle = (Math.atan2(-dy, dx) * 180) / Math.PI
      const power = dist / DRAG_WU_PER_POWER
      dispatch({ type: 'aim', angle, power })
    },
    [dispatch],
  )

  const onPadPointerDown = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      const s = stateRef.current
      if (!s || s.phase !== 'aiming') return
      ;(e.target as Element).setPointerCapture(e.pointerId)
      dragRef.current = { pointerId: e.pointerId }
      updateAimFromPointer(e.clientX, e.clientY)
    },
    [updateAimFromPointer],
  )
  const onPadPointerMove = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
      updateAimFromPointer(e.clientX, e.clientY)
    },
    [updateAimFromPointer],
  )
  const onPadPointerUp = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    dragRef.current = null
    // Drop does NOT auto-launch -- avoids misfires; Launch/Space commits the shot.
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
        <div className="rounded-xl bg-surface p-6" data-testid="gravwell-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.phase === 'won'
  const lost = state.phase === 'lost'
  const aiming = state.phase === 'aiming'
  const cfg: GravwellConfig = state.config
  const preview = aiming && !reduced ? simulatePreview(state, PREVIEW_TICKS) : null
  const probePos = state.probe ? { x: state.probe.x, y: state.probe.y } : state.pad
  const probeWU = wuPt(probePos)
  const padWU = wuPt(state.pad)

  const hint = won
    ? 'Locked into the ring!'
    : lost
      ? 'Out of probes — press New Board.'
      : aiming
        ? 'Drag the pad, or use the steppers, then hit Launch. One shot, then gravity takes over.'
        : 'In flight — gravity is steering. Nothing left to do but watch.'

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
        { label: 'Shots', value: state.attemptsUsed, testId: 'shots' },
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
        aria-label="Gravwell board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative overflow-hidden rounded-xl p-3"
        style={{
          ...(reduced ? undefined : { animation: 'gw-board-in .3s ease-out both' }),
          backgroundColor: 'var(--bg-2)',
          backgroundImage: [
            'radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,0.55) 1px, transparent 0)',
            'radial-gradient(1px 1px at 68% 8%, rgba(255,255,255,0.4) 1px, transparent 0)',
            'radial-gradient(1.5px 1.5px at 40% 62%, rgba(255,255,255,0.5) 1px, transparent 0)',
            'radial-gradient(1px 1px at 85% 48%, rgba(255,255,255,0.35) 1px, transparent 0)',
            'radial-gradient(1px 1px at 25% 85%, rgba(255,255,255,0.4) 1px, transparent 0)',
            'radial-gradient(38% 46% at 18% 30%, color-mix(in srgb, var(--neon-purple) 22%, transparent), transparent 70%)',
            'radial-gradient(40% 48% at 85% 70%, color-mix(in srgb, var(--neon-blue) 18%, transparent), transparent 72%)',
          ].join(', '),
          backgroundSize: '160px 160px, 160px 160px, 160px 160px, 160px 160px, 160px 160px, 100% 100%, 100% 100%',
          backgroundRepeat: 'repeat, repeat, repeat, repeat, repeat, no-repeat, no-repeat',
        }}
        data-testid="gravwell-board"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${cfg.worldW} ${cfg.worldH}`}
          className="mx-auto block w-full max-w-175 touch-none"
          style={{ aspectRatio: `${cfg.worldW}/${cfg.worldH}` }}
          role="img"
          aria-label={`Gravwell board, ${state.planets.length} planets, shot ${state.attemptsUsed} of ${cfg.maxAttempts}`}
        >
          {/* Ghost trails from earlier failed attempts */}
          {state.previousPaths.map((p, i) => (
            <polyline
              key={i}
              points={polyPoints(p)}
              fill="none"
              stroke="var(--fg-muted)"
              strokeWidth={0.3}
              strokeLinecap="round"
              opacity={GHOST_OPACITIES[GHOST_OPACITIES.length - state.previousPaths.length + i] ?? 0.12}
            />
          ))}

          {/* Predicted trajectory while aiming */}
          {preview && preview.length > 1 && (
            <polyline
              points={polyPoints(preview)}
              fill="none"
              stroke="var(--neon-lime)"
              strokeWidth={0.3}
              strokeDasharray="1.2 1"
              opacity={0.55}
            />
          )}

          {/* Current attempt's flown trajectory */}
          {state.path.length > 1 && (
            <polyline
              points={polyPoints(state.path)}
              fill="none"
              stroke="var(--neon-cyan)"
              strokeWidth={0.4}
              strokeLinecap="round"
              opacity={0.85}
            />
          )}

          {/* Target ring */}
          <circle
            cx={wu(state.target.x)}
            cy={wu(state.target.y)}
            r={wu((state.target.innerRadius + state.target.outerRadius) / 2)}
            fill="none"
            stroke="var(--neon-lime)"
            strokeOpacity={won ? 0.95 : 0.65}
            strokeWidth={wu(state.target.outerRadius - state.target.innerRadius)}
            data-testid="target-ring"
          />
          <circle cx={wu(state.target.x)} cy={wu(state.target.y)} r={0.6} fill="var(--neon-lime)" />

          {/* Planets */}
          {state.planets.map((p) => {
            const grazed = state.grazedPlanetIds.includes(p.id)
            return (
              <g key={p.id} data-testid="planet">
                <circle
                  cx={wu(p.x)}
                  cy={wu(p.y)}
                  r={wu(p.radius) * GRAZE_MULT}
                  fill="none"
                  stroke="var(--neon-amber)"
                  strokeOpacity={grazed ? 0.35 : 0.12}
                  strokeWidth={0.15}
                  strokeDasharray="0.6 0.5"
                />
                <circle
                  cx={wu(p.x)}
                  cy={wu(p.y)}
                  r={wu(p.radius)}
                  fill={planetFill(p.mass, cfg.massRange)}
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={0.2}
                />
              </g>
            )
          })}

          {/* Launch pad */}
          <circle
            cx={padWU.x}
            cy={padWU.y}
            r={1.4}
            fill="none"
            stroke="var(--neon-cyan)"
            strokeOpacity={aiming ? 0.9 : 0.35}
            strokeWidth={0.3}
            strokeDasharray="0.5 0.4"
            style={{ cursor: aiming ? 'grab' : 'default', touchAction: 'none' }}
            onPointerDown={onPadPointerDown}
            onPointerMove={onPadPointerMove}
            onPointerUp={onPadPointerUp}
            onPointerCancel={onPadPointerUp}
            data-testid="pad"
          />
          {aiming && (
            <line
              x1={padWU.x}
              y1={padWU.y}
              x2={padWU.x + Math.cos((state.angle * Math.PI) / 180) * (1.5 + state.power * 0.03)}
              y2={padWU.y - Math.sin((state.angle * Math.PI) / 180) * (1.5 + state.power * 0.03)}
              stroke="var(--neon-cyan)"
              strokeWidth={0.3}
              strokeLinecap="round"
              opacity={0.9}
              aria-hidden="true"
            />
          )}

          {/* Probe */}
          <circle
            cx={probeWU.x}
            cy={probeWU.y}
            r={0.9}
            fill={won ? 'var(--neon-lime)' : lost ? 'var(--neon-red)' : 'var(--neon-amber)'}
            data-testid="probe"
          />
        </svg>

        {/* Event badges */}
        {badges.map((b) => (
          <span
            key={b.seq}
            data-testid={b.kind === 'graze' ? 'graze-badge' : undefined}
            aria-hidden="true"
            onAnimationEnd={() => setBadges((cur) => cur.filter((x) => x.seq !== b.seq))}
            className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border px-3 py-1 text-sm font-bold ${
              b.kind === 'graze'
                ? 'border-neon-amber/60 bg-neon-amber/15 text-neon-amber'
                : b.kind === 'crash'
                  ? 'border-neon-red/60 bg-neon-red/15 text-neon-red'
                  : 'border-neon-lime/60 bg-neon-lime/15 text-neon-lime'
            }`}
            style={reduced ? undefined : { animation: 'gw-badge .9s ease-out both' }}
          >
            {b.kind === 'graze' ? 'Graze! +' + 20 : b.kind === 'crash' ? 'Crash' : 'In the ring!'}
          </span>
        ))}

        {/* Steppers: precision fallback for touch/keyboard-shy players */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/80 px-2 py-1.5">
            <span className="text-xs text-fg-muted">Angle</span>
            {[-5, -1, 1, 5].map((d) => (
              <GameButton
                key={d}
                variant="ghost"
                className="min-w-11 px-2 py-1.5"
                disabled={!aiming}
                onClick={() => dispatch({ type: 'nudgeAngle', delta: d })}
                aria-label={`Angle ${d > 0 ? '+' : ''}${d}`}
              >
                {d > 0 ? `+${d}` : d}
              </GameButton>
            ))}
            <span data-testid="angle" className="w-12 text-center text-sm font-bold tabular-nums text-accent">
              {state.angle}°
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/80 px-2 py-1.5">
            <span className="text-xs text-fg-muted">Power</span>
            {[-5, -1, 1, 5].map((d) => (
              <GameButton
                key={d}
                variant="ghost"
                className="min-w-11 px-2 py-1.5"
                disabled={!aiming}
                onClick={() => dispatch({ type: 'nudgePower', delta: d })}
                aria-label={`Power ${d > 0 ? '+' : ''}${d}`}
              >
                {d > 0 ? `+${d}` : d}
              </GameButton>
            ))}
            <span data-testid="power" className="w-10 text-center text-sm font-bold tabular-nums text-accent">
              {state.power}
            </span>
          </div>
          <GameButton onClick={() => dispatch({ type: 'launch' })} disabled={!aiming} data-testid="launch">
            Launch
          </GameButton>
        </div>

        <GameOverlay
          show={won}
          variant="win"
          title="Locked in!"
          testId="you-win"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Shots <span className="font-bold text-accent">{state.attemptsUsed}</span> / Par{' '}
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
                  const used = state.attemptsUsed
                  const par = state.config.par
                  const grade = gradeFewer(used, par)
                  const glyph = barGlyph(used, par, `${used} SHOTS · PAR ${par}`)
                  return {
                    gameName: 'Gravwell',
                    dateISO: todayUTC(),
                    accent: '#a3e635',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/gravwell`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Gravwell',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      par,
                      `locked in with ${used} shots (par ${par})`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <GameOverlay show={lost} variant="lose" title="Out of probes" testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Final score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p className="text-fg-muted">
              {state.attemptsUsed} / {state.config.maxAttempts} shots used
            </p>
          </div>
          <GameButton onClick={onNewGame}>Try again</GameButton>
        </GameOverlay>

        <style>{`
          @keyframes gw-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes gw-badge {
            0% { transform: translate(-50%, 6px) scale(.7); opacity: 0 }
            25% { transform: translate(-50%, 0) scale(1.1); opacity: 1 }
            100% { transform: translate(-50%, -14px) scale(1); opacity: 0 }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
