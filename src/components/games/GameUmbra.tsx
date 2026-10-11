'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LANES,
  isVisible,
  mulberry32,
  newGame,
  revealForLevel,
  soleLane,
  start,
  step,
  tap,
  type Grade,
  type Rng,
  type UmbraState,
} from '@/lib/games/umbra/engine'
import { trackCss } from '@/lib/games/umbra/layout'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordFinish } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeRatio, barGlyph, resultSnippet } from '@/lib/dailyShare'

const TICK_MS = 1000 / 60
/** Render-only: how many ticks of travel the streak trails behind the marble. */
const TRAIL_TICKS = 3
const LANE_KEYS = ['1', '2', '3'] as const

const GRADE_SOUND: Record<Grade, 'match' | 'move' | 'error' | 'mismatch'> = {
  perfect: 'match',
  good: 'move',
  blown: 'error',
  missed: 'mismatch',
}

const GRADE_COLOR: Record<Grade, string> = {
  perfect: 'var(--neon-lime)',
  good: 'var(--neon-cyan)',
  blown: 'var(--neon-red)',
  missed: 'var(--neon-red)',
}

interface Badge {
  seq: number
  lane: number
  text: string
  color: string
}

interface Flash {
  seq: number
  color: string
}

function loadBest(storageKey: string): number {
  try {
    const n = Number(localStorage.getItem(storageKey))
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

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function badgeText(grade: Grade, simul: number): string {
  if (grade === 'perfect') return simul > 1 ? `Perfect ×${simul}` : 'Perfect'
  if (grade === 'good') return simul > 1 ? `Good ×${simul}` : 'Good'
  if (grade === 'blown') return 'Blown'
  return 'Miss'
}

export function GameUmbra({ storageKey }: { storageKey: string }) {
  // SSR safety: the board is built on the client only (Decant pattern).
  const [state, setState] = useState<UmbraState | null>(null)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [badges, setBadges] = useState<Badge[]>([])
  const [flashes, setFlashes] = useState<(Flash | null)[]>(() => Array<Flash | null>(LANES).fill(null))

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const gameRef = useRef<UmbraState | null>(null)
  const rngRef = useRef<Rng>(mulberry32(1))
  const lastRef = useRef(0)
  const accRef = useRef(0)
  const rafRef = useRef(0)
  const bestRef = useRef(0)
  const newBestRef = useRef(false)
  const seqRef = useRef(0)

  const pushBadge = useCallback((lane: number, grade: Grade, simul: number) => {
    const seq = ++seqRef.current
    const color = GRADE_COLOR[grade]
    setBadges((b) => [...b, { seq, lane, text: badgeText(grade, simul), color }])
    setFlashes((f) => {
      const next = f.slice()
      next[lane] = { seq, color }
      return next
    })
  }, [])

  /** Drain one engine state's events into sound / badges / the new-record latch. */
  const consume = useCallback(
    (s: UmbraState) => {
      for (const j of s.events.judged) {
        play(GRADE_SOUND[j.grade])
        pushBadge(j.lane, j.grade, j.simul)
      }
      if (s.events.levelUp) play('merge')
      // Latch the record the instant it is broken — at game over `best` has
      // already been raised, so comparing there would always read false.
      if (s.score > bestRef.current) newBestRef.current = true
      if (s.events.over) {
        const record = newBestRef.current
        setNewBest(record)
        play(record ? 'win' : 'lose')
        if (s.score > bestRef.current) {
          bestRef.current = s.score
          setBest(s.score)
          saveBest(storageKey, s.score)
        }
        recordFinish(storageKey.replace(/^best:/, ''))
      }
    },
    [play, pushBadge, storageKey],
  )

  /** Advance the fixed-timestep engine up to `nowMs`. */
  const pump = useCallback(
    (nowMs: number) => {
      const g = gameRef.current
      if (!g) return
      let dt = nowMs - lastRef.current
      lastRef.current = nowMs
      if (dt > 250) dt = 250 // never spiral after a tab switch
      accRef.current += dt
      while (accRef.current >= TICK_MS) {
        const next = step(gameRef.current!, rngRef.current)
        gameRef.current = next
        accRef.current -= TICK_MS
        consume(next)
      }
    },
    [consume],
  )

  const newRun = useCallback(() => {
    rngRef.current = mulberry32(freshSeed())
    gameRef.current = newGame()
    newBestRef.current = false
    setNewBest(false)
    setBadges([])
    setFlashes(Array<Flash | null>(LANES).fill(null))
    lastRef.current = typeof performance !== 'undefined' ? performance.now() : 0
    accRef.current = 0
    setState(gameRef.current)
  }, [])

  const beginRun = useCallback(() => {
    const g = gameRef.current
    if (!g || g.phase !== 'ready') return
    lastRef.current = performance.now()
    accRef.current = 0
    gameRef.current = start(g)
    setState(gameRef.current)
  }, [])

  // Init + hydrate best (client only).
  useEffect(() => {
    const b = loadBest(storageKey)
    bestRef.current = b
    setBest(b)
    rngRef.current = mulberry32(freshSeed())
    gameRef.current = newGame()
    setState(gameRef.current)
  }, [storageKey])

  // rAF loop. Runs in every phase; the engine no-ops when it is not running.
  useEffect(() => {
    if (!state) return
    const frame = (ts: number) => {
      pump(ts)
      if (gameRef.current) setState(gameRef.current)
      rafRef.current = requestAnimationFrame(frame)
    }
    lastRef.current = performance.now()
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state === null, pump])

  // Returning to a background tab must not fast-forward the engine.
  useEffect(() => {
    const onVis = () => {
      lastRef.current = performance.now()
      accRef.current = 0
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  /**
   * Judge a lane. The engine is pumped to *now* first: without this the engine
   * tick can lag the input by up to a full tick, and with a ±2-tick PERFECT
   * window that bias would eat half the judgement.
   */
  const doTap = useCallback(
    (lane: number) => {
      const g = gameRef.current
      if (!g) return
      if (g.phase === 'ready') {
        beginRun()
        return
      }
      pump(performance.now())
      const next = tap(gameRef.current!, lane)
      gameRef.current = next
      consume(next)
      setState(next)
    },
    [beginRun, consume, pump],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      // Window-level now: never hijack browser shortcuts (Cmd/Ctrl+R reload, +S/+D/+A).
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const g = gameRef.current
      if (!g) return
      const k = e.key.toLowerCase()
      // Keys are window-wide, so outside a live run Enter/Space on a focused button or link
      // (Mute, New Run, Share, Play again) must activate it, not start or tap the run.
      // Lanes are excluded: their keyboard input is the game's.
      if (
        (k === ' ' || k === 'enter') &&
        g.phase !== 'running' &&
        e.target instanceof HTMLElement &&
        e.target.closest('button, a[href]') &&
        !e.target.closest('[data-testid="lane"]')
      ) {
        return
      }

      if (k === 'r') {
        e.preventDefault()
        newRun()
        return
      }
      if (g.phase === 'ready' && (k === ' ' || k === 'enter')) {
        e.preventDefault()
        beginRun()
        return
      }
      if (k === ' ') {
        e.preventDefault()
        // Space only routes when there is exactly one marble to mean.
        pump(performance.now())
        const lane = soleLane(gameRef.current!)
        if (lane !== null) doTap(lane)
        return
      }
      const idx = k === '1' || k === 'a' ? 0 : k === '2' || k === 's' ? 1 : k === '3' || k === 'd' ? 2 : -1
      if (idx >= 0) {
        e.preventDefault()
        doTap(idx)
      }
    },
    [beginRun, doTap, newRun, pump],
  )

  // Keys live on window, not the board: clicking Start unmounts the button and drops
  // focus to <body>, where a board-scoped onKeyDown would never see 1/2/3.
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-150 select-none">
        <div className="rounded-xl bg-surface p-4" data-testid="umbra-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const { phase, tick, level, score, lives, perfectStreak } = state
  const revealX = revealForLevel(level)

  const hint =
    phase === 'ready'
      ? "Read the marble's speed in the light — then tap the instant it reaches the marker. You will not see it arrive."
      : phase === 'running'
        ? 'Tap 1 / 2 / 3 (or the lane) at the exact arrival tick. Perfect ×N chains multiply.'
        : 'Blackout. R for a new run.'

  const headerExtra = (
    <>
      <span
        className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm"
        aria-label={`${lives} lives left`}
      >
        <span aria-hidden="true" className="tracking-widest text-neon-red">
          {'●'.repeat(lives)}
          <span className="opacity-30">{'○'.repeat(Math.max(0, 3 - lives))}</span>
        </span>
      </span>
      {perfectStreak >= 2 && (
        <span
          className="neon-box rounded-lg border border-current/50 px-3 py-1.5 text-sm font-bold"
          style={{ color: 'var(--neon-lime)' }}
        >
          Combo ×{perfectStreak}
        </span>
      )}
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Score', value: score, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Level', value: level, testId: 'level' },
      ]}
      headerExtra={headerExtra}
      onNewGame={newRun}
      newGameLabel={phase === 'over' ? 'Play again' : 'New Run'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-150"
    >
      <div
        data-testid="umbra-board"
        role="group"
        aria-label="Umbra board"
        tabIndex={0}
        className="relative rounded-xl bg-surface p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
        style={reduced ? undefined : { animation: 'um-board-in .3s ease-out both' }}
      >
        <div className="flex flex-col gap-3">
          {Array.from({ length: LANES }, (_, lane) => {
            const m = state.marbles.find((x) => x.lane === lane)
            const lit = m !== undefined && isVisible(m, tick)
            // Engine units; trackCss maps x = TRACK onto the exit-marker line (not the lane edge).
            const posX = m ? m.vx * (tick - m.spawnTick) : 0
            const trailX = m ? m.vx * TRAIL_TICKS : 0
            const flash = flashes[lane]
            return (
              <button
                key={lane}
                type="button"
                data-testid="lane"
                aria-label={`Lane ${lane + 1}, press ${LANE_KEYS[lane]}`}
                onPointerDown={(e) => {
                  e.preventDefault()
                  doTap(lane)
                }}
                // The window key handler owns the keyboard. Swallow Space/Enter here so
                // the button never synthesizes a second click on top of it.
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') e.preventDefault()
                }}
                className="um-lane relative h-18 w-full overflow-hidden rounded-lg border border-border"
              >
                {/* entrance — the lit stretch. Shrinks as the level climbs. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: trackCss(revealX, '100%'),
                    background:
                      'linear-gradient(90deg, color-mix(in srgb, var(--neon-cyan) 22%, transparent), transparent)',
                  }}
                />
                {/* exit marker */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center border-l-2 text-lg font-extrabold"
                  style={{
                    borderColor: flash ? flash.color : 'var(--neon-cyan)',
                    color: flash ? flash.color : 'var(--neon-cyan)',
                    background: 'color-mix(in srgb, var(--neon-cyan) 8%, transparent)',
                  }}
                >
                  {LANE_KEYS[lane]}
                </span>
                {flash && (
                  <span
                    key={flash.seq}
                    aria-hidden="true"
                    onAnimationEnd={() =>
                      setFlashes((f) => {
                        if (f[lane]?.seq !== flash.seq) return f
                        const next = f.slice()
                        next[lane] = null
                        return next
                      })
                    }
                    className="pointer-events-none absolute inset-y-0 right-0 w-9"
                    style={{
                      background: flash.color,
                      animation: `${reduced ? 'um-flash-flat' : 'um-flash'} .45s ease-out both`,
                    }}
                  />
                )}
                {/* the marble — only ever drawn inside the light */}
                {m && lit && (
                  <>
                    {!reduced && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-0 h-1.5 rounded-full"
                        style={{
                          // cqw, not %: a % in `transform` resolves against the
                          // element's own width, not the lane's.
                          width: trackCss(trailX),
                          transform: `translateX(${trackCss(posX - trailX)}) translateY(-50%)`,
                          background:
                            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--neon-cyan) 70%, transparent))',
                        }}
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="um-marble pointer-events-none absolute top-1/2 left-0 h-3.5 w-3.5 rounded-full"
                      style={{
                        transform: `translateX(${trackCss(posX)}) translate(-50%, -50%)`,
                        background: 'var(--neon-cyan)',
                      }}
                    />
                    {reduced && (
                      // The streak is the speed channel; with it off, say the
                      // number outright or the game becomes unplayable.
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1 left-0 text-xs font-bold tabular-nums"
                        style={{
                          color: 'var(--neon-cyan)',
                          transform: `translateX(${trackCss(posX)}) translateX(-50%)`,
                        }}
                      >
                        {m.vx}
                      </span>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>

        {badges.map((b) => (
          <span
            key={b.seq}
            data-testid="judgement"
            aria-hidden="true"
            onAnimationEnd={() => setBadges((cur) => cur.filter((x) => x.seq !== b.seq))}
            className="pointer-events-none absolute right-12 rounded-full border border-current/60 px-2.5 py-0.5 text-xs font-bold"
            style={{
              color: b.color,
              background: 'color-mix(in srgb, var(--bg) 70%, transparent)',
              top: `calc(1rem + ${b.lane} * (4.5rem + 0.75rem))`,
              // reduced still needs a real animation: onAnimationEnd is what
              // removes the badge, so a bare `undefined` would strand it here.
              animation: `${reduced ? 'um-badge-flat' : 'um-badge'} .9s ease-out both`,
            }}
          >
            {b.text}
          </span>
        ))}

        {phase === 'ready' && (
          <div
            data-testid="umbra-start"
            className="anim-backdrop-in absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/75"
          >
            <div
              style={{ color: 'var(--neon-cyan)' }}
              className="neon-box flex flex-col items-center gap-4 rounded-2xl border border-current/40 bg-bg-2/85 px-8 py-6 text-center"
            >
              <p className="neon-text-strong text-3xl font-extrabold tracking-tight">Umbra</p>
              <p className="max-w-72 text-sm text-fg-muted">
                The marble is lit only at the entrance. Time its arrival at the marker from memory —
                you will never see it land.
              </p>
              <GameButton onClick={beginRun}>Start</GameButton>
            </div>
          </div>
        )}

        <GameOverlay
          show={phase === 'over'}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Blackout'}
          testId="game-over"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{score}</span>
            </p>
            <p>
              Best <span className="font-bold text-accent">{best}</span>
            </p>
            <p>
              Perfects <span className="font-bold text-accent">{state.perfects}</span>
            </p>
            <p>
              Best chain <span className="font-bold text-accent">×{state.bestStreak}</span>
            </p>
            <p>
              Level <span className="font-bold text-accent">{level}</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <DailyShareButton
              payload={() => {
                const grade = gradeRatio(score, best, newBest)
                const glyph = level >= 1 ? barGlyph(level, undefined, `LEVEL ${level} · CHAIN ×${state.bestStreak}`) : undefined
                return {
                  gameName: 'Umbra',
                  dateISO: todayUTC(),
                  subtitle: todayUTC(),
                  accent: '#b06bff',
                  lines: [],
                  url: `${window.location.origin}/umbra`,
                  grade,
                  scoreLine: `${score} PTS`,
                  glyph,
                  textSnippet: resultSnippet('Umbra', todayUTC(), false, grade, glyph?.cells ?? [], undefined, `scored ${score} (level ${level})`),
                }
              }}
            />
            <GameButton onClick={newRun}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          .um-lane { container-type: inline-size; background: radial-gradient(120% 100% at 100% 50%, rgba(0,0,0,.55), rgba(0,0,0,.82)); }
          .um-marble { box-shadow: 0 0 10px var(--neon-cyan), 0 0 20px color-mix(in srgb, var(--neon-cyan) 50%, transparent); }
          @keyframes um-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes um-flash { 0% { opacity: .85; transform: scaleX(1) } 100% { opacity: 0; transform: scaleX(1.6) } }
          @keyframes um-flash-flat { 0% { opacity: .7 } 100% { opacity: 0 } }
          @keyframes um-badge {
            0% { transform: translateY(6px) scale(.7); opacity: 0 }
            25% { transform: translateY(0) scale(1.1); opacity: 1 }
            100% { transform: translateY(-14px) scale(1); opacity: 0 }
          }
          @keyframes um-badge-flat { 0% { opacity: 0 } 20% { opacity: 1 } 100% { opacity: 0 } }
        `}</style>
      </div>
    </GameShell>
  )
}
