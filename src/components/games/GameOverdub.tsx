'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LOOP_MICRO,
  STEPS,
  STEP_MICRO,
  TICK_SECONDS,
  createGame,
  headStep,
  noteCount,
  reduce,
  type OverdubState,
} from '@/lib/games/overdub/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordFinish } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const STEP_DEG = 360 / STEPS // 22.5
/** Half a step: centers the sweeping head over a cell at the step's midpoint. */
const HEAD_LEAD = STEP_DEG / 2

/** Ring geometry lives in CSS vars so the board scales without JS. */
const RADIUS = 'var(--ov-r)'

/** Static cell transforms — computed once, transform-only, no layout props. */
const CELL_TRANSFORM = Array.from({ length: STEPS }, (_, i) => {
  const a = i * STEP_DEG
  return `translate(-50%,-50%) rotate(${a}deg) translateY(calc(-1 * ${RADIUS})) rotate(${-a}deg)`
})

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

/**
 * best:<slug> holds a BARE NUMBER — the weekly leaderboard reads that key with
 * Number(), so JSON there would silently zero the score (shared convention).
 */
function loadBest(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return 0
    const n = Number(raw)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, Math.floor(n))
  } catch {
    return 0
  }
}

function saveBest(storageKey: string, value: number): void {
  try {
    localStorage.setItem(storageKey, String(value))
  } catch {
    // ignore quota / privacy-mode errors
  }
}

interface Gain {
  seq: number
  amount: number
  mult: number
}

/** Ring marker for the step the head is on (moved imperatively from the rAF). */
function headCellTransform(step: number): string {
  const a = step * STEP_DEG
  return `translate(-50%,-50%) rotate(${a}deg) translateY(calc(-1 * ${RADIUS})) rotate(${-a}deg)`
}

export function GameOverdub({ storageKey }: { storageKey: string }) {
  // SSR safety: the loop is built on the client only (Date/Math.random).
  const [state, setState] = useState<OverdubState | null>(null)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [gains, setGains] = useState<Gain[]>([])
  /**
   * Per-cell placement multiplier — render metadata only. Deliberately NOT in
   * engine state: it is cosmetic and would bloat the golden snapshots.
   */
  const [mults, setMults] = useState<number[]>(() => Array<number>(STEPS).fill(0))

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<OverdubState | null>(null)
  const bestRef = useRef(0)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)
  const accRef = useRef(0)
  const gainSeq = useRef(0)
  const headRef = useRef<HTMLDivElement | null>(null)
  const headCellRef = useRef<HTMLDivElement | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const commit = useCallback((next: OverdubState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const persistBest = useCallback(
    (score: number) => {
      if (score <= bestRef.current) return false
      bestRef.current = score
      setBest(score)
      saveBest(storageKey, score)
      return true
    },
    [storageKey],
  )

  const startRun = useCallback(() => {
    const g = createGame(freshSeed())
    accRef.current = 0
    lastTsRef.current = 0
    setGains([])
    setMults(Array<number>(STEPS).fill(0))
    setNewBest(false)
    commit(g)
  }, [commit])

  // ---- Init (client only) ----
  useEffect(() => {
    const stored = loadBest(storageKey)
    bestRef.current = stored
    setBest(stored)
    commit(createGame(freshSeed()))
    // Mount once; storageKey is stable per route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // ---- Driver loop: fixed-step accumulator, ref-driven ----
  const frame = useCallback(
    (ts: number) => {
      const last = lastTsRef.current || ts
      lastTsRef.current = ts

      let s = stateRef.current
      if (s && !s.over) {
        accRef.current += Math.min((ts - last) / 1000, 0.1) // clamp tab-away
        let prevStep = headStep(s)
        let wrapped = false
        while (accRef.current >= TICK_SECONDS) {
          accRef.current -= TICK_SECONDS
          s = reduce(s, { type: 'tick' })
          const st = headStep(s)
          if (st !== prevStep) {
            // Metronome. `play` already no-ops when muted; motion prefs are
            // irrelevant to audio, so this is NOT gated on `reduced`.
            play('flag')
            prevStep = st
          }
          if (s.event === 'wrap') wrapped = true
        }
        stateRef.current = s
        // A wrap is only every 1-3 s, so surfacing it to React is cheap; a
        // per-tick setState at 60 Hz would not be.
        if (wrapped) setState(s)
      }

      if (s) {
        const reducedNow = reducedRef.current
        if (headRef.current) {
          const deg = reducedNow
            ? Math.floor(s.headMicro / STEP_MICRO) * STEP_DEG
            : (s.headMicro / LOOP_MICRO) * 360 - HEAD_LEAD
          headRef.current.style.transform = `rotate(${deg}deg)`
        }
        if (headCellRef.current) {
          headCellRef.current.style.transform = headCellTransform(headStep(s))
        }
      }

      rafRef.current = requestAnimationFrame(frame)
    },
    [play, reducedRef],
  )

  useEffect(() => {
    rafRef.current = requestAnimationFrame(frame)
    const timers = timersRef.current
    return () => {
      cancelAnimationFrame(rafRef.current)
      for (const t of timers) clearTimeout(t)
    }
  }, [frame])

  // ---- Tap ----
  const doTap = useCallback(() => {
    const prev = stateRef.current
    if (!prev || prev.over) return
    const next = reduce(prev, { type: 'tap' })
    commit(next)

    if (next.event === 'out') {
      // persistBest가 갱신 여부를 알려주므로 그것으로 사운드를 결정한다(순서 중요:
      // 예전엔 play('lose')가 persistBest보다 먼저라 신기록에도 lose가 났다).
      const isNew = persistBest(next.score)
      setNewBest(isNew)
      play(isNew ? 'win' : 'lose')
      recordFinish(storageKey.replace(/^best:/, ''))
      return
    }

    // place / bonus / clear are all placements.
    const step = next.lastStep
    if (step !== null) {
      setMults((m) => {
        const copy = m.slice()
        copy[step] = next.lastMult
        return copy
      })
    }
    const seq = ++gainSeq.current
    setGains((g) => [...g, { seq, amount: next.lastGain, mult: next.lastMult }])
    if (reducedRef.current) {
      // No animation => no `animationend` => the badge would leak forever.
      // Unmount it on a timer instead.
      const t = setTimeout(() => setGains((g) => g.filter((x) => x.seq !== seq)), 1000)
      timersRef.current.push(t)
    }

    if (next.event === 'clear') {
      play('win')
      setMults(Array<number>(STEPS).fill(0))
      persistBest(next.score)
    } else if (next.event === 'bonus') {
      play('merge')
    } else {
      play('move')
    }
  }, [commit, play, persistBest, reducedRef, storageKey])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      boardRef.current?.focus()
      doTap()
    },
    [doTap],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      if (e.repeat) return // holding Space must not machine-gun taps
      switch (e.key) {
        case ' ':
        case 'Spacebar':
        case 'Enter':
        case 'ArrowDown':
        case 'j':
        case 'J':
          e.preventDefault()
          doTap()
          break
        case 'r':
        case 'R':
          e.preventDefault()
          startRun()
          break
      }
    },
    [doTap, startRun],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="aspect-square rounded-xl bg-surface" data-testid="overdub-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const count = noteCount(state.notes)
  const hint = state.over
    ? 'You stamped on your own note. R to run it back.'
    : count >= 12
      ? 'Loop is crowded. Fill all 16 to clear it.'
      : 'Tap to stamp a note where the head is. Land beside a note for ×2 — land on one and you’re out.'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Lap', value: state.lap + 1 },
      ]}
      headerExtra={
        <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          Chain <b className="text-accent">×{state.chain}</b>
        </span>
      }
      onNewGame={startRun}
      newGameLabel={state.over ? 'Play again' : 'New Loop'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <div
        ref={boardRef}
        role="application"
        tabIndex={0}
        aria-label="Overdub loop — tap to stamp a note on the playhead step"
        data-testid="overdub-board"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="ov-board relative aspect-square w-full overflow-hidden rounded-xl bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        style={{ touchAction: 'manipulation' }}
      >
        {/* Entry + out-shake live on a stage so the board's own transform is free. */}
        <div
          className="absolute inset-0"
          style={{
            animation: reduced
              ? undefined
              : state.over
                ? 'ov-shake .22s ease-in-out 1'
                : 'ov-board-in .3s ease-out both',
          }}
        >
        {/* Ring guide */}
        <div className="ov-ring pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true" />

        {/* Playhead spoke — rotated straight from the rAF, no React re-render. */}
        <div ref={headRef} className="ov-head pointer-events-none" aria-hidden="true" />

        {/* Marker for the step the head is on. */}
        <div ref={headCellRef} className="ov-headcell pointer-events-none" aria-hidden="true" />

        {/* Steps */}
        {Array.from({ length: STEPS }, (_, i) => {
          const filled = state.notes[i]
          const ghost = state.ghosts[i]
          const fatal = state.over && state.lastStep === i
          let bg = 'transparent'
          let border = 'color-mix(in srgb, var(--neon-blue) 35%, transparent)'
          if (fatal) {
            bg = 'var(--neon-red)'
            border = 'var(--neon-red)'
          } else if (ghost) {
            bg = 'var(--neon-purple)'
            border = 'var(--neon-purple)'
          } else if (filled) {
            const hot = mults[i] > 1
            bg = hot ? 'var(--neon-lime)' : 'var(--neon-cyan)'
            border = bg
          }
          return (
            <div
              key={i}
              aria-hidden="true"
              data-testid={filled ? 'note' : undefined}
              className="ov-cell pointer-events-none absolute left-1/2 top-1/2"
              style={{ transform: CELL_TRANSFORM[i] }}
            >
              {/* Inner dot carries the pop: the outer cell's transform is its
                  ring position and must never be animated over. */}
              <div
                className="ov-dot"
                style={{
                  background: bg,
                  borderColor: border,
                  boxShadow: filled ? `0 0 10px ${bg}` : undefined,
                  animation:
                    reduced || !filled || state.lastStep !== i || state.over
                      ? undefined
                      : 'ov-stamp .22s ease-out both',
                }}
              />
            </div>
          )
        })}

        {/* Center readout */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="neon-text text-4xl font-extrabold tabular-nums text-accent">{state.score}</p>
          <p className="text-xs text-fg-muted">
            {count}/{STEPS} steps
          </p>
          {gains.map((g) => (
            <span
              key={g.seq}
              aria-hidden="true"
              onAnimationEnd={
                reduced ? undefined : () => setGains((cur) => cur.filter((x) => x.seq !== g.seq))
              }
              className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-sm font-bold text-accent"
              style={reduced ? undefined : { animation: 'ov-gain .9s ease-out both' }}
            >
              +{g.amount}
              {g.mult > 1 && <b className="ml-1 text-neon-lime">×{g.mult}</b>}
            </span>
          ))}
        </div>

        <GameOverlay show={state.over} variant={newBest ? 'win' : 'lose'} title={newBest ? 'New best!' : 'Overdubbed'} testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Notes <span className="font-bold text-accent">{state.placed}</span> · Best chain{' '}
              <span className="font-bold text-accent">×{state.bestChain}</span>
            </p>
            <p>
              Laps cleared <span className="font-bold text-accent">{state.lap}</span>
            </p>
          </div>
          <GameButton onClick={startRun}>Play again</GameButton>
        </GameOverlay>

        <style>{`
          /* cqw (not %) — a percentage inside translateY() would resolve against
             the CELL's own height, collapsing the ring. cqw resolves against the
             board and is valid inside transforms. */
          .ov-board {
            container-type: size;
            --ov-r: clamp(88px, 34cqw, 150px);
            --ov-cell: clamp(18px, 7cqw, 28px);
          }
          .ov-ring {
            width: calc(2 * var(--ov-r)); height: calc(2 * var(--ov-r));
            transform: translate(-50%, -50%);
            border-radius: 9999px;
            border: 1px dashed color-mix(in srgb, var(--neon-blue) 22%, transparent);
          }
          .ov-cell { width: var(--ov-cell); height: var(--ov-cell); }
          .ov-dot {
            width: 100%; height: 100%;
            border-radius: 9999px; border-width: 2px; border-style: solid;
          }
          .ov-headcell {
            position: absolute; left: 50%; top: 50%;
            width: calc(var(--ov-cell) + 10px); height: calc(var(--ov-cell) + 10px);
            border-radius: 9999px;
            border: 2px solid var(--neon-amber);
            box-shadow: 0 0 12px var(--neon-amber);
            will-change: transform;
          }
          .ov-head {
            position: absolute;
            left: calc(50% - 1.5px);
            top: calc(50% - var(--ov-r));
            width: 3px; height: var(--ov-r);
            transform-origin: bottom center;
            border-radius: 9999px;
            background: linear-gradient(to top, transparent, var(--neon-amber));
            box-shadow: 0 0 10px var(--neon-amber);
            will-change: transform;
          }
          @keyframes ov-board-in { from { opacity: 0; transform: scale(.97) } to { opacity: 1; transform: none } }
          @keyframes ov-stamp {
            0% { transform: scale(.25); opacity: .35 }
            60% { transform: scale(1.35); opacity: 1 }
            100% { transform: none; opacity: 1 }
          }
          @keyframes ov-gain {
            0% { transform: translate(-50%, 8px) scale(.7); opacity: 0 }
            25% { transform: translate(-50%, 0) scale(1.1); opacity: 1 }
            100% { transform: translate(-50%, -26px) scale(1); opacity: 0 }
          }
          @keyframes ov-shake {
            0%, 100% { transform: translateX(0) }
            25% { transform: translateX(-5px) }
            75% { transform: translateX(5px) }
          }
        `}</style>
        </div>
      </div>
    </GameShell>
  )
}
