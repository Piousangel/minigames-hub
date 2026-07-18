'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  advance,
  cycleProgress,
  laneSlots,
  msPerTick,
  mulberry32,
  newGame,
  SPAWN_LEAD_TICKS,
  tap,
  TICKS_PER_BEAT,
  TOLERANCE,
  type ClockKey,
  type PolytapEvent,
  type PolytapState,
  type Rng,
} from '@/lib/games/polytap/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'

type Phase = 'idle' | 'running' | 'over'

/** The only guard against a background tab dumping a huge dt into the engine. */
const MAX_FRAME_MS = 100
/** The NOW line sits here; slots approach it from the right. */
const NOW_PCT = 22
const RUNWAY_PCT = 78
const LANE_H = 96

const LANE: Record<ClockKey, { color: string; label: string; name: string }> = {
  f: { color: 'var(--neon-cyan)', label: 'F', name: 'F' },
  j: { color: 'var(--neon-magenta)', label: 'J', name: 'J' },
}

/** Engine seeds are the only place ambient entropy is allowed. */
function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

/** dueTick -> horizontal position, interpolated with the fractional tick. */
function xPct(dueTick: number, tickFloat: number): number {
  return NOW_PCT + ((dueTick - tickFloat) / SPAWN_LEAD_TICKS) * RUNWAY_PCT
}

const BAND_PCT = (TOLERANCE / SPAWN_LEAD_TICKS) * RUNWAY_PCT

export function GamePolytap({ storageKey }: { storageKey: string }) {
  const [run, setRun] = useState<PolytapState | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [tickView, setTickView] = useState(0)
  const [flash, setFlash] = useState(0)
  const [lockBadge, setLockBadge] = useState<{ seq: number; n: number } | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const runRef = useRef<PolytapState | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const rngRef = useRef<Rng>(mulberry32(1))
  const rafRef = useRef(0)
  const lastMsRef = useRef(0)
  const tickFloatRef = useRef(0) // fractional — for render interpolation ONLY
  const bestRef = useRef(0)
  const newBestRef = useRef(false)
  const badgeSeq = useRef(0)

  /**
   * Best is compared BEFORE it is updated. Checking `score >= best` at game
   * over would always be true, because best has already absorbed the score.
   */
  const persistBest = useCallback(
    (s: PolytapState) => {
      if (s.score > bestRef.current) {
        newBestRef.current = true
        bestRef.current = s.score
        setBest(s.score)
        try {
          localStorage.setItem(storageKey, String(s.score))
        } catch {
          /* ignore quota / privacy-mode errors */
        }
      }
    },
    [storageKey],
  )

  const react = useCallback(
    (ev: PolytapEvent) => {
      switch (ev.type) {
        case 'hit':
          play(ev.key === 'f' ? 'flip' : 'move')
          break
        case 'confluence':
          play(ev.locked ? 'merge' : 'match')
          if (ev.locked) {
            badgeSeq.current += 1
            setLockBadge({ seq: badgeSeq.current, n: ev.cycle })
          }
          break
        case 'stageUp':
        case 'clockJoin':
          play('match')
          break
        case 'stray':
        case 'miss':
          play('error')
          // A static red frame either way — it decays as a colour swap, not an
          // animated property, so it is honest under reduced motion too.
          setFlash(1)
          break
        default:
          break
      }
    },
    [play],
  )

  const flush = useCallback(
    (next: PolytapState) => {
      for (const ev of next.events) react(ev)
      runRef.current = next
      setRun(next)
      persistBest(next)
      if (next.over && phaseRef.current !== 'over') {
        phaseRef.current = 'over'
        setPhase('over')
        setNewBest(newBestRef.current)
        play(newBestRef.current ? 'win' : 'lose')
      }
    },
    [react, persistBest, play],
  )

  const frame = useCallback(
    (ts: number) => {
      const cur = runRef.current
      if (!cur || phaseRef.current !== 'running') return
      const last = lastMsRef.current || ts
      const dt = Math.min(ts - last, MAX_FRAME_MS)
      lastMsRef.current = ts
      tickFloatRef.current += dt / msPerTick(cur.bpm)
      const next = advance(cur, Math.floor(tickFloatRef.current), rngRef.current)
      flush(next)
      setTickView(tickFloatRef.current)
      setFlash((f) => (f > 0 ? Math.max(0, f - dt / 200) : 0))
      if (!next.over) rafRef.current = requestAnimationFrame(frame)
    },
    [flush],
  )

  const start = useCallback(() => {
    const seed = freshSeed()
    const g = newGame(seed)
    rngRef.current = mulberry32(seed)
    runRef.current = g
    tickFloatRef.current = 0
    lastMsRef.current = 0
    newBestRef.current = false
    badgeSeq.current = 0
    setNewBest(false)
    setLockBadge(null)
    setFlash(0)
    setRun(g)
    setTickView(0)
    phaseRef.current = 'running'
    setPhase('running')
    cancelAnimationFrame(rafRef.current)
    lastMsRef.current = typeof performance !== 'undefined' ? performance.now() : 0
    rafRef.current = requestAnimationFrame(frame)
  }, [frame])

  const doTap = useCallback(
    (key: ClockKey) => {
      if (phaseRef.current !== 'running') return
      const cur = runRef.current
      if (!cur) return
      // Advance to now FIRST, so an input arriving between frames is never
      // judged against a stale tick.
      const t = Math.floor(tickFloatRef.current)
      const advanced = advance(cur, t, rngRef.current)
      const tapped = tap(advanced, key)
      flush({ ...tapped, events: [...advanced.events, ...tapped.events] })
    },
    [flush],
  )

  // Init: hydrate best + build the board (client only — SSR safety).
  useEffect(() => {
    let stored = 0
    try {
      const raw = Number(localStorage.getItem(storageKey))
      stored = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0
    } catch {
      stored = 0
    }
    bestRef.current = stored
    setBest(stored)
    const g = newGame(freshSeed())
    runRef.current = g
    setRun(g)
    return () => cancelAnimationFrame(rafRef.current)
  }, [storageKey])

  // Background tab = pause. Only the wall-clock origin resets; tickFloat is
  // preserved so the grid never jumps and the engine stays pure.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current)
      } else if (phaseRef.current === 'running') {
        lastMsRef.current = performance.now()
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [frame])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.repeat) return // key-repeat would machine-gun strays
      const k = e.key
      if (k === 'f' || k === 'F') {
        e.preventDefault()
        doTap('f')
      } else if (k === 'j' || k === 'J') {
        e.preventDefault()
        doTap('j')
      } else if (k === ' ' || k === 'Spacebar') {
        e.preventDefault()
        if (phaseRef.current !== 'running') start()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [doTap, start])

  if (!run) {
    return (
      <div className="mx-auto w-full max-w-150 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="polytap-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const fClock = run.clocks.find((c) => c.key === 'f')
  const jClock = run.clocks.find((c) => c.key === 'j')
  const cycleBeats = run.cycleTicks / TICKS_PER_BEAT
  const prog = cycleProgress(run)
  const confluenceTicks = Array.from(
    new Set(run.slots.filter((s) => s.isConfluence).map((s) => s.dueTick)),
  )

  const hint =
    phase === 'idle'
      ? 'F is every 3 beats, J every 4 — keep both clocks alive. Where they collide, hit both at once. Space to start.'
      : phase === 'over'
        ? `${run.overReason === 'confluence' ? 'You dropped the collision.' : 'Out of lives.'} Space to run it back.`
        : run.stage === 0
          ? 'Warm-up: tap J on every 4th beat. A second clock joins soon.'
          : `Both clocks are live. The bright column every ${cycleBeats} beats needs F + J together — miss it and the run ends.`

  const renderLane = (key: ClockKey) => {
    const meta = LANE[key]
    const clock = key === 'f' ? fClock : jClock
    const slots = laneSlots(run, key)
    return (
      <div
        className="pt-lane relative overflow-hidden rounded-lg"
        style={{ height: LANE_H, borderColor: `color-mix(in srgb, ${meta.color} 35%, transparent)` }}
      >
        {/* judgement window — its width never changes, and you can see that */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0"
          style={{
            left: `${NOW_PCT - BAND_PCT}%`,
            width: `${BAND_PCT * 2}%`,
            background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
          }}
        />
        {/* NOW line */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0"
          style={{ left: `${NOW_PCT}%`, width: 2, background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
        />
        <span
          aria-hidden="true"
          className="absolute left-2 top-2 text-xs font-bold tracking-widest"
          style={{ color: meta.color }}
        >
          {meta.label}
          {clock ? ` ×${clock.periodBeats}` : ' —'}
        </span>

        {slots.map((s) => (
          <div
            key={s.id}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ transform: `translate3d(${xPct(s.dueTick, tickView)}%, 0, 0)` }}
          >
            <span
              className={`pt-dot ${s.isConfluence ? 'pt-conf' : ''} ${s.hit && !reduced ? 'pt-ring' : ''}`}
              style={{
                color: s.isConfluence ? 'var(--neon-amber)' : meta.color,
                borderColor: s.isConfluence ? 'var(--neon-amber)' : meta.color,
                background: s.hit
                  ? s.isConfluence
                    ? 'var(--neon-amber)'
                    : meta.color
                  : 'transparent',
                opacity: s.hit ? 1 : 0.85,
              }}
            />
          </div>
        ))}
      </div>
    )
  }

  const hearts = (
    <div
      className="flex items-center gap-1 rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm"
      aria-label={`${Math.max(0, run.lives)} lives left`}
    >
      <span className="text-fg-muted">Lives</span>
      <span aria-hidden="true" className="tracking-widest">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < run.lives ? 'text-red-400' : 'text-fg-muted/25'}>
            ♥
          </span>
        ))}
      </span>
    </div>
  )

  return (
    <GameShell
      stats={[
        { label: 'Score', value: run.score, testId: 'score', float: true },
        { label: 'Cycles', value: run.cyclesCleared, testId: 'cycles' },
        { label: 'Best', value: best },
      ]}
      headerExtra={
        <>
          {hearts}
          <span
            className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm font-bold tabular-nums"
            aria-label={
              fClock
                ? `Pattern: F every ${fClock.periodBeats} beats against J every ${jClock?.periodBeats} beats`
                : `Warm-up: J every ${jClock?.periodBeats} beats`
            }
          >
            <span style={{ color: 'var(--neon-cyan)' }}>{fClock ? fClock.periodBeats : '—'}</span>
            <span className="text-fg-muted"> : </span>
            <span style={{ color: 'var(--neon-magenta)' }}>{jClock?.periodBeats}</span>
          </span>
          <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm text-fg-muted">
            Stage <span className="font-bold text-accent">{run.stage}</span> · {run.bpm} BPM
          </span>
        </>
      }
      onNewGame={start}
      newGameLabel={phase === 'over' ? 'Play again' : 'Restart'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-150"
    >
      <div
        role="group"
        aria-label="Polytap board"
        className="relative overflow-hidden rounded-xl bg-surface p-4"
        style={{
          ...(reduced ? undefined : { animation: 'pt-board-in .3s ease-out both' }),
          boxShadow: flash > 0 ? `inset 0 0 0 2px var(--neon-red)` : undefined,
        }}
        data-testid="polytap-board"
      >
        <div className="relative flex flex-col gap-2">
          {renderLane('f')}
          {renderLane('j')}

          {/* Collision beams — the landmark that makes the pattern readable. */}
          {confluenceTicks.map((t) => (
            <div
              key={t}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ transform: `translate3d(${xPct(t, tickView)}%, 0, 0)` }}
            >
              <span className="pt-beam" />
            </div>
          ))}
        </div>

        {/* Cycle progress — scaleX only, never width. */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-2">
          <div
            aria-hidden="true"
            className="h-full origin-left rounded-full"
            style={{
              background: 'var(--neon-amber)',
              transform: `scaleX(${prog.total > 0 ? prog.done / prog.total : 0})`,
              transition: reduced ? undefined : 'transform .25s ease-out',
            }}
          />
        </div>
        <p className="mt-1 text-center text-xs text-fg-muted">
          Cycle {Math.min(prog.done + 1, prog.total)} / {prog.total} · next collision in{' '}
          {cycleBeats} beats
        </p>

        {lockBadge && (
          <span
            key={lockBadge.seq}
            data-testid="lock-badge"
            aria-hidden="true"
            onAnimationEnd={() => setLockBadge(null)}
            className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border px-3 py-1 text-sm font-bold"
            style={{
              color: 'var(--neon-amber)',
              borderColor: 'color-mix(in srgb, var(--neon-amber) 60%, transparent)',
              background: 'color-mix(in srgb, var(--neon-amber) 15%, transparent)',
              ...(reduced ? undefined : { animation: 'pt-badge .9s ease-out both' }),
            }}
          >
            LOCK ×{lockBadge.n}
          </span>
        )}

        <GameOverlay
          show={phase === 'over'}
          variant={newBest ? 'win' : 'lose'}
          title={
            newBest
              ? 'New best!'
              : run.overReason === 'confluence'
                ? 'Collision dropped'
                : 'Out of sync'
          }
          testId="game-over"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Cycles <span className="font-bold text-accent">{run.cyclesCleared}</span>
            </p>
            <p>
              Score <span className="font-bold text-accent">{run.score}</span> · Best{' '}
              <span className="font-bold text-accent">{best}</span>
            </p>
            <p className="text-fg-muted">
              Stage {run.stage} · Locks {run.locks}
              {run.bestSpread !== null && ` · Best sync ${run.bestSpread} ticks`}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <DailyShareButton
              payload={() => ({
                gameName: 'Polytap',
                dateISO: todayUTC(),
                subtitle: todayUTC(),
                accent: '#22d3ee',
                lines: [
                  { label: 'Score', value: String(run.score) },
                  { label: 'Cycles', value: String(run.cyclesCleared) },
                ],
                url: `${window.location.origin}/polytap`,
                textSnippet: `Polytap — scored ${run.score} (${run.cyclesCleared} cycles, stage ${run.stage})`,
              })}
            />
            <GameButton onClick={start}>Play again</GameButton>
          </div>
        </GameOverlay>

        {phase === 'idle' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/70">
            <p className="text-lg font-bold">Two clocks. One pair of hands.</p>
            <GameButton onClick={start}>Start</GameButton>
          </div>
        )}
      </div>

      {/* Tap pads */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {(['f', 'j'] as ClockKey[]).map((key) => {
          const meta = LANE[key]
          const clock = key === 'f' ? fClock : jClock
          return (
            <button
              key={key}
              type="button"
              data-testid={`pad-${key}`}
              tabIndex={-1}
              aria-label={`Tap ${meta.name} — every ${clock ? clock.periodBeats : 3} beats`}
              onPointerDown={(e) => {
                e.preventDefault()
                doTap(key)
              }}
              disabled={!clock}
              className="btn-press flex min-h-22 flex-col items-center justify-center rounded-xl border-2 font-bold disabled:opacity-30"
              style={{
                touchAction: 'manipulation',
                minWidth: 88,
                borderColor: `color-mix(in srgb, ${meta.color} 55%, transparent)`,
                background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
                color: meta.color,
              }}
            >
              <span className="text-2xl">{meta.label}</span>
              <span className="text-xs opacity-80">×{clock ? clock.periodBeats : '—'} beats</span>
            </button>
          )
        })}
      </div>

      <style>{`
        .pt-lane {
          border-width: 1px;
          border-style: solid;
          background: linear-gradient(90deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
        }
        .pt-dot {
          position: absolute;
          left: 0;
          top: 50%;
          width: 22px;
          height: 22px;
          margin: -11px 0 0 -11px;
          border-radius: 9999px;
          border-width: 2px;
          border-style: solid;
          transition: background-color .12s linear, opacity .12s linear;
        }
        .pt-conf {
          width: 44px;
          height: 44px;
          margin: -22px 0 0 -22px;
          border-radius: 6px;
          transform: rotate(45deg);
        }
        .pt-beam {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          margin-left: -1.5px;
          background: var(--neon-amber);
          opacity: .55;
          box-shadow: 0 0 12px var(--neon-amber);
        }
        @keyframes pt-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
        @keyframes pt-badge {
          0% { transform: translate(-50%, 6px) scale(.7); opacity: 0 }
          25% { transform: translate(-50%, 0) scale(1.1); opacity: 1 }
          100% { transform: translate(-50%, -14px) scale(1); opacity: 0 }
        }
        /* Hit ring: transform + opacity only — no layout or paint properties. */
        .pt-ring::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: inherit;
          border: 2px solid currentColor;
          animation: pt-ring-kf .3s ease-out both;
        }
        @keyframes pt-ring-kf {
          from { transform: scale(.7); opacity: .9 }
          to { transform: scale(1.9); opacity: 0 }
        }
        @media (prefers-reduced-motion: reduce) {
          .pt-ring::after { content: none; }
        }
      `}</style>
    </GameShell>
  )
}
