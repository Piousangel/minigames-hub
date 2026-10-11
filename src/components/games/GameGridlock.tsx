'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_CONFIG,
  createGame,
  isUrgent,
  reduce,
  type GridlockConfig,
  type GridlockState,
  type Lane,
  type Vehicle,
} from '@/lib/games/gridlock/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordFinish } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const STEP_MS = 40 // master loop granularity
const TICK_INTERVAL_MS = 150 // fixed tick cadence (45-tick timeout ≈ 6.75s to react)
const MAX_CATCHUP = 8 // guard against spiral-of-death per step

const LANE_NAME: Record<Lane, string> = { N: 'North', S: 'South', E: 'East', W: 'West' }

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

function saveBest(storageKey: string, score: number): void {
  try {
    localStorage.setItem(storageKey, String(score))
  } catch {
    // ignore storage failures
  }
}

/**
 * Visual cell order for a lane's track, farthest-from-center to nearest or
 * vice versa depending on which side of the intersection the lane sits on —
 * so the track always reads "far edge → stop line → center" in DOM order.
 */
function laneCellOrder(cfg: GridlockConfig, lane: Lane): number[] {
  const distances = Array.from({ length: cfg.laneLength }, (_, i) => i + 1) // [1..laneLength]
  return lane === 'N' || lane === 'W' ? distances.reverse() : distances
}

function vehicleState(v: Vehicle, lane: Lane, activeLane: Lane, cfg: GridlockConfig): 'active' | 'waiting' | 'urgent' | 'approach' {
  if (isUrgent(v, cfg)) return 'urgent'
  if (v.distance === 1 && lane !== activeLane) return 'waiting'
  if (lane === activeLane) return 'active'
  return 'approach'
}

function VehicleBox({ v, lane, state, reduced }: { v: Vehicle; lane: Lane; state: GridlockState; reduced: boolean }) {
  const dataState = vehicleState(v, lane, state.activeLane, state.config)
  return (
    <div
      data-testid="gridlock-vehicle"
      data-state={dataState}
      aria-hidden="true"
      className={`gl-car gl-cell flex items-center justify-center rounded-md border ${
        !reduced && dataState === 'urgent' ? 'gl-pulse' : ''
      }`}
    >
      🚗
    </div>
  )
}

function CenterCell({ state, reduced }: { state: GridlockState; reduced: boolean }) {
  const crashed = state.gameOver && state.failCause === 'crash'
  return (
    <div
      data-testid="gridlock-intersection"
      aria-hidden="true"
      data-occupied={state.occupant ? true : undefined}
      data-crash={crashed || undefined}
      className={`gl-center gl-cell flex items-center justify-center rounded-md border ${
        !reduced && crashed ? 'gl-pulse' : ''
      }`}
    >
      {state.occupant ? '🚗' : crashed ? '💥' : ''}
    </div>
  )
}

function LaneSlot({
  lane,
  state,
  reduced,
  onSetLane,
}: {
  lane: Lane
  state: GridlockState
  reduced: boolean
  onSetLane: (lane: Lane) => void
}) {
  const vertical = lane === 'N' || lane === 'S'
  const labelFirst = lane === 'N' || lane === 'W'
  const cells = laneCellOrder(state.config, lane)
  const v = state.vehicles[lane]
  const isActive = state.activeLane === lane
  const isFailLane = state.gameOver && state.failLane === lane

  const label = (
    <span className={`gl-label ${isActive ? 'gl-label-active' : ''}`} aria-hidden="true">
      {lane}
    </span>
  )
  const track = (
    <button
      type="button"
      onClick={() => onSetLane(lane)}
      disabled={state.gameOver}
      aria-pressed={isActive}
      aria-label={`Give right of way to ${LANE_NAME[lane]}`}
      data-testid={`gridlock-lane-${lane}`}
      data-active={isActive || undefined}
      data-fail={isFailLane || undefined}
      className={`gl-track flex items-center gap-0.5 rounded-lg border p-1 ${vertical ? 'flex-col' : 'flex-row'}`}
    >
      {cells.map((d) => (
        <div key={d} className="gl-cell flex items-center justify-center">
          {v && v.distance === d ? (
            <VehicleBox v={v} lane={lane} state={state} reduced={reduced} />
          ) : (
            <div className="gl-slot h-2 w-2 rounded-full" />
          )}
        </div>
      ))}
    </button>
  )

  return (
    <div className={`flex items-center gap-0.5 ${vertical ? 'flex-col' : 'flex-row'}`}>
      {labelFirst ? (
        <>
          {label}
          {track}
        </>
      ) : (
        <>
          {track}
          {label}
        </>
      )}
    </div>
  )
}

export function GameGridlock({ storageKey }: { storageKey: string }) {
  // SSR safety: build the game only on the client (freshSeed touches Date/Math.random).
  const [state, setState] = useState<GridlockState | null>(null)
  // 'ready' = waiting for the first input (the clock doesn't run yet),
  // 'paused' = tab was hidden mid-run; resumes on the next input.
  const [phase, setPhase] = useState<'ready' | 'running' | 'paused'>('ready')
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const nextTickAt = useRef(0)
  const prevOver = useRef(false)

  const over = state?.gameOver ?? false
  const running = phase === 'running'
  // Live mirrors for the window-level listeners (visibility/keyboard) so they
  // never read a stale first-render closure.
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const overRef = useRef(over)
  overRef.current = over

  const start = useCallback(() => {
    const g = createGame(DEFAULT_CONFIG, freshSeed())
    setState(g)
    setNewBest(false)
    prevOver.current = false
    setPhase('ready')
  }, [])

  // First input after a fresh game / pause starts the clock from "now".
  const resume = useCallback(() => {
    if (overRef.current || phaseRef.current === 'running') return
    nextTickAt.current = performance.now() + TICK_INTERVAL_MS
    phaseRef.current = 'running'
    setPhase('running')
  }, [])

  // Init + load best (client only).
  useEffect(() => {
    setBest(loadBest(storageKey))
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Master loop: single deadline-driven interval, catch-up capped (slotter pattern).
  useEffect(() => {
    if (!running || over) return
    const id = setInterval(() => {
      const now = performance.now()
      setState((s) => {
        if (!s || s.gameOver) return s
        let next = s
        let iterations = 0
        while (now >= nextTickAt.current && iterations < MAX_CATCHUP) {
          next = reduce(next, { type: 'tick' })
          if (next.lastEvent === 'cross') play('match')
          else if (next.lastEvent === 'crash' || next.lastEvent === 'timeout') play('error')
          nextTickAt.current += TICK_INTERVAL_MS
          iterations++
          if (next.gameOver) break
        }
        return next
      })
    }, STEP_MS)
    return () => clearInterval(id)
  }, [running, over, play])

  // Pause when the tab is hidden so the deadline doesn't burn in the
  // background. Reads phase via ref (a [] closure over `state` used to stay
  // null forever, so the game never resumed). Coming back shows a Paused
  // overlay; the next lane input / Resume restarts the clock.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === 'running' && !overRef.current) {
        phaseRef.current = 'paused'
        setPhase('paused')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Game-over effect: persist best + stats (sound already fired for
  // crash/timeout at the moment it happened, inside the tick loop above).
  useEffect(() => {
    if (!state) return
    if (state.gameOver && !prevOver.current) {
      const beatBest = state.score > best
      if (beatBest) {
        setBest(state.score)
        saveBest(storageKey, state.score)
      }
      setNewBest(beatBest)
      if (beatBest) play('win')
      recordFinish(storageKey.replace(/^best:/, ''))
    }
    prevOver.current = state.gameOver
  }, [state, best, storageKey, play])

  const setLane = useCallback(
    (lane: Lane) => {
      resume()
      setState((s) => {
        if (!s) return s
        const next = reduce(s, { type: 'setLane', lane })
        if (next.lastEvent === 'switch') play('move')
        return next
      })
    },
    [play, resume],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault()
          setLane('N')
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault()
          setLane('S')
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          setLane('E')
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          setLane('W')
          break
        case 'r':
        case 'R':
          e.preventDefault()
          start()
          break
      }
    },
    [setLane, start],
  )

  // Window-level keys: the hint promises Arrows/WASD work right away, even
  // before the board has focus (page load leaves focus on <body>).
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="gridlock-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const hint = state.gameOver
    ? 'Game over — press Play again.'
    : phase === 'ready'
      ? 'Press an arrow key / WASD or tap a lane to start. Cars waiting at the stop line turn amber, then red — switch to them before they time out.'
      : 'Arrows/WASD pick the green lane. Cars waiting at the stop line turn amber, then red — switch to them before they time out.'

  const failText =
    state.failCause === 'crash'
      ? `Crash — ${LANE_NAME[state.failLane as Lane]} entered the intersection while it was occupied.`
      : state.failCause === 'timeout'
        ? `Timeout — a car in ${LANE_NAME[state.failLane as Lane]} waited too long for a green light.`
        : ''

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      onNewGame={() => start()}
      newGameLabel={state.gameOver ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <div
        className="relative rounded-xl bg-surface p-2 sm:p-4"
        data-testid="gridlock-board"
        style={reduced ? undefined : { animation: 'gl-board-in .3s ease-out both' }}
      >
        <div
          role="group"
          aria-label="Gridlock intersection"
          tabIndex={0}
          className="gl-grid mx-auto grid w-fit grid-cols-3 grid-rows-3 place-items-center gap-1 rounded-lg p-1 sm:gap-2 sm:p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <div aria-hidden="true" />
          <LaneSlot lane="N" state={state} reduced={reduced} onSetLane={setLane} />
          <div aria-hidden="true" />

          <LaneSlot lane="W" state={state} reduced={reduced} onSetLane={setLane} />
          <CenterCell state={state} reduced={reduced} />
          <LaneSlot lane="E" state={state} reduced={reduced} onSetLane={setLane} />

          <div aria-hidden="true" />
          <LaneSlot lane="S" state={state} reduced={reduced} onSetLane={setLane} />
          <div aria-hidden="true" />
        </div>

        {!state.gameOver && phase !== 'running' && (
          <div
            data-testid={phase === 'paused' ? 'gridlock-paused' : 'gridlock-ready'}
            className="pointer-events-none absolute inset-x-0 top-1 flex justify-center"
          >
            {phase === 'paused' ? (
              <button
                type="button"
                onClick={resume}
                className="pointer-events-auto rounded-full border border-neon-amber/60 bg-bg-2/90 px-3 py-1 text-xs font-bold text-neon-amber"
              >
                Paused — tap to resume
              </button>
            ) : (
              <span className="rounded-full border border-neon-green/50 bg-bg-2/90 px-3 py-1 text-xs font-bold text-neon-green">
                Press an arrow or tap a lane to start
              </span>
            )}
          </div>
        )}

        <GameOverlay show={state.gameOver} variant={newBest ? 'win' : 'lose'} title={newBest ? 'New best!' : 'Gridlock!'} testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            {failText && <p className="text-fg-muted">{failText}</p>}
          </div>
          <GameButton onClick={() => start()}>Try again</GameButton>
        </GameOverlay>

        <style>{`
          @keyframes gl-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes gl-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
          .gl-grid {
            /* 390px: 11 cells + chrome (~7.6rem) must fit in ~358px. */
            --gl-cell: clamp(1.125rem, calc((100vw - 10rem) / 11), 2rem);
          }
          .gl-cell {
            width: var(--gl-cell); height: var(--gl-cell);
            font-size: calc(var(--gl-cell) * 0.45);
          }
          .gl-track {
            background: rgba(255,255,255,0.03);
            border-color: var(--border, rgba(255,255,255,0.14));
            transition: border-color .15s ease, box-shadow .15s ease;
          }
          .gl-track:not(:disabled):hover { border-color: var(--neon-cyan); }
          .gl-track[data-active] {
            border-color: var(--neon-green);
            box-shadow: 0 0 0 1px var(--neon-green), 0 0 14px rgba(52,227,155,0.35);
          }
          .gl-track[data-fail] {
            border-color: var(--neon-red);
            box-shadow: 0 0 0 1px var(--neon-red), 0 0 14px rgba(255,77,109,0.45);
          }
          .gl-track:disabled { cursor: default; }
          .gl-label {
            display: flex; align-items: center; justify-content: center;
            width: 1rem; height: 1rem; font-size: .65rem; font-weight: 800;
            color: var(--fg-muted, #9ca3af);
          }
          .gl-label-active { color: var(--neon-green); }
          .gl-slot { background: rgba(255,255,255,0.1); }
          .gl-car {
            background: rgba(255,255,255,0.05);
            border-color: rgba(255,255,255,0.16);
            transition: background-color .15s ease, border-color .15s ease;
          }
          .gl-car[data-state='active'] { border-color: var(--neon-green); background: rgba(52,227,155,0.15); }
          .gl-car[data-state='waiting'] { border-color: var(--neon-amber); background: rgba(251,191,36,0.18); }
          .gl-car[data-state='urgent'] { border-color: var(--neon-red); background: rgba(255,77,109,0.25); }
          .gl-car.gl-pulse { animation: gl-pulse .5s ease-in-out infinite; }
          .gl-center {
            background: rgba(255,255,255,0.04);
            border-color: rgba(255,255,255,0.16);
            transition: background-color .15s ease, border-color .15s ease;
          }
          .gl-center[data-occupied] { border-color: var(--neon-cyan); background: rgba(34,211,238,0.2); }
          .gl-center[data-crash] { border-color: var(--neon-red); background: rgba(255,77,109,0.3); }
          .gl-center.gl-pulse { animation: gl-pulse .4s ease-in-out infinite; }
        `}</style>
      </div>
    </GameShell>
  )
}
