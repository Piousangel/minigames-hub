'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LIVES,
  gapEffective,
  newGame,
  offbeatTick,
  pulseTick,
  step,
  tap,
  type Outcome,
  type OffbeatState,
} from '@/lib/games/offbeat/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const RING = 260 // svg viewBox px
const R = 104 // ring radius
const CX = RING / 2
const CY = RING / 2
const CIRCUMFERENCE = 2 * Math.PI * R
const COMBO_BADGE_MIN = 5

/** Every hit/fail outcome maps to one of the repo's fixed 10 SoundName values. */
const OUTCOME_SOUND: Record<Outcome, SoundName> = {
  perfect: 'match',
  good: 'move',
  early: 'mismatch',
  late: 'mismatch',
  onbeat: 'error',
  miss: 'flag',
}

const HIT_OUTCOMES = new Set<Outcome>(['perfect', 'good'])

interface Flash {
  seq: number
  kind: 'hit' | 'fail'
}

interface ComboBadge {
  seq: number
  combo: number
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey)
    const n = Number(raw)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

function saveBest(storageKey: string, score: number): void {
  try {
    localStorage.setItem(storageKey, String(Math.max(0, Math.floor(score))))
  } catch {
    // ignore storage failures (private mode, quota, ...)
  }
}

/** Small ♥/♡ readout — LIVES starts at 3, drained one at a time. */
function LivesHearts({ lives }: { lives: number }) {
  return (
    <span
      className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm"
      data-testid="lives"
      aria-label={`Lives: ${lives}`}
    >
      {'♥'.repeat(Math.max(0, lives))}
      {'♡'.repeat(Math.max(0, LIVES - lives))}
    </span>
  )
}

export function GameOffbeat({ storageKey }: { storageKey: string }) {
  // SSR safety: build the run only on the client (repo-wide template pattern).
  const [state, setState] = useState<OffbeatState | null>(null)
  const [best, setBest] = useState(0)
  const [flashes, setFlashes] = useState<Flash[]>([])
  const [badges, setBadges] = useState<ComboBadge[]>([])
  const [pulseBeat, setPulseBeat] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<OffbeatState | null>(null)
  const prevOverRef = useRef(false)
  const newBestRef = useRef(false)
  const flashSeq = useRef(0)
  const badgeSeq = useRef(0)
  const rafRef = useRef(0)

  const commit = useCallback((next: OffbeatState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const persistOver = useCallback(
    (next: OffbeatState) => {
      const prevBest = loadBest(storageKey)
      newBestRef.current = next.score > prevBest
      const merged = Math.max(prevBest, next.score)
      saveBest(storageKey, merged)
      setBest(merged)
      // Endless/survival game: no true "win" — a completed run is what counts
      // (matches flywheel/stackpot/turntile convention for this shape of game).
      recordResult(storageKey.replace(/^best:/, ''), { won: true })
    },
    [storageKey],
  )

  // Shared post-step/post-tap side effects: sound, flashes, pulse-ring beat, combo badge, persistence.
  const handleEvents = useCallback(
    (next: OffbeatState) => {
      const ev = next.events
      if (ev.outcome) {
        play(OUTCOME_SOUND[ev.outcome])
        const seq = ++flashSeq.current
        setFlashes((f) => [...f, { seq, kind: HIT_OUTCOMES.has(ev.outcome as Outcome) ? 'hit' : 'fail' }])
        if (HIT_OUTCOMES.has(ev.outcome as Outcome) && next.combo >= COMBO_BADGE_MIN) {
          const bseq = ++badgeSeq.current
          setBadges((b) => [...b, { seq: bseq, combo: next.combo }])
        }
      } else if (ev.cycleAdvanced) {
        play('flip') // soft metronome tick for a pulse that passed cleanly
      }
      if (ev.cycleAdvanced) setPulseBeat((b) => b + 1)
      if (ev.over) {
        if (!prevOverRef.current) persistOver(next)
        play(newBestRef.current ? 'win' : 'lose')
      }
      prevOverRef.current = next.over
    },
    [play, persistOver],
  )

  // ---- rAF loop: exactly one step() per frame while alive; halts on over. ----
  const loopStep = useCallback(() => {
    const cur = stateRef.current
    if (!cur || cur.over) return // no further scheduling — explicit halt on game over
    const next = step(cur)
    commit(next)
    handleEvents(next)
    rafRef.current = requestAnimationFrame(loopStep)
  }, [commit, handleEvents])

  const startLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loopStep)
  }, [loopStep])

  const startGame = useCallback(() => {
    prevOverRef.current = false
    setFlashes([])
    setBadges([])
    setPulseBeat(0)
    commit(newGame(freshSeed()))
    startLoop()
  }, [commit, startLoop])

  // Init (client only, SSR-safe) + hydrate best.
  useEffect(() => {
    setBest(loadBest(storageKey))
    startGame()
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const doTap = useCallback(() => {
    const cur = stateRef.current
    if (!cur) return
    const next = tap(cur)
    commit(next)
    handleEvents(next)
  }, [commit, handleEvents])

  // Keyboard: Space/Enter to tap, R for a fresh run.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault()
        doTap()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        startGame()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [doTap, startGame])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="offbeat-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const gap = gapEffective(state.cycle, state.schedule)
  const cycleStart = pulseTick(state.cycle, state.schedule)
  const mid = offbeatTick(state.cycle, state.schedule)
  const progress = Math.max(0, Math.min(1, (state.tick - cycleStart) / gap))
  const targetFrac = Math.max(0, Math.min(1, (mid - cycleStart) / gap))

  const angleFor = (frac: number) => -Math.PI / 2 + frac * Math.PI * 2
  const pointAt = (frac: number) => {
    const a = angleFor(frac)
    return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) }
  }
  const target = pointAt(targetFrac)

  const hint = state.over
    ? 'Missed the beat too many times — press New Game to try again.'
    : "Don't tap the beat — tap exactly halfway between two pulses, the silent gap."

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Combo', value: state.combo, testId: 'combo' },
      ]}
      headerExtra={<LivesHearts lives={state.lives} />}
      onNewGame={startGame}
      newGameLabel={state.over ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-100"
    >
      <div
        className="relative rounded-xl bg-surface p-4"
        style={reduced ? undefined : { animation: 'ob-board-in .3s ease-out both' }}
        data-testid="offbeat-board"
      >
        <button
          type="button"
          data-testid="pulse-ring"
          aria-label="Tap on the offbeat — the silent midpoint between pulses"
          onPointerDown={(e) => {
            e.preventDefault()
            doTap()
          }}
          disabled={state.over}
          className="mx-auto flex touch-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          style={{ width: '100%', maxWidth: RING, aspectRatio: '1 / 1' }}
        >
          <svg viewBox={`0 0 ${RING} ${RING}`} className="h-full w-full" aria-hidden="true">
            {/* track */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border, rgba(255,255,255,0.12))" strokeWidth={10} />
            {/* progress arc: fills clockwise from 12 o'clock as the next pulse approaches */}
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="var(--neon-cyan)"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              transform={`rotate(-90 ${CX} ${CY})`}
              opacity={0.85}
            />
            {/* offbeat target marker — the only safe tap moment, shown as a difficulty hint */}
            <circle cx={target.x} cy={target.y} r={5} fill="var(--neon-lime)" opacity={0.9} />
            {/* center pulse — "kongs" on every fresh beat */}
            <circle
              key={reduced ? undefined : pulseBeat}
              cx={CX}
              cy={CY}
              r={54}
              fill="rgba(255,255,255,0.04)"
              stroke="var(--neon-magenta)"
              strokeWidth={3}
              style={reduced ? undefined : { animation: 'ob-pulse .28s ease-out both', transformOrigin: `${CX}px ${CY}px` }}
            />
          </svg>
          <span className="pointer-events-none absolute text-center text-sm font-bold text-fg-muted">
            {state.over ? 'Game over' : 'Tap the silence'}
          </span>
        </button>

        {flashes.map((f) => (
          <div
            key={f.seq}
            aria-hidden="true"
            onAnimationEnd={() => setFlashes((cur) => cur.filter((x) => x.seq !== f.seq))}
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{
              boxShadow: `inset 0 0 60px ${f.kind === 'hit' ? 'var(--neon-green)' : 'var(--neon-red)'}`,
              animation: reduced ? 'ob-flash-static .2s ease-out both' : 'ob-flash .35s ease-out both',
            }}
          />
        ))}

        {badges.map((b) => (
          <span
            key={b.seq}
            data-testid="combo-badge"
            aria-hidden="true"
            onAnimationEnd={() => setBadges((cur) => cur.filter((x) => x.seq !== b.seq))}
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-sm font-bold text-accent"
            style={reduced ? undefined : { animation: 'ob-badge .9s ease-out both' }}
          >
            Combo ×{b.combo}
          </span>
        ))}

        <GameOverlay show={state.over} variant={newBestRef.current ? 'win' : 'lose'} title={newBestRef.current ? 'New best!' : 'Offbeat!'} testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Best combo <span className="font-bold text-accent">{state.bestCombo}</span>
            </p>
            <p>
              Hits <span className="font-bold text-accent">{state.hits}</span> · Perfects{' '}
              <span className="font-bold text-accent">{state.perfects}</span>
            </p>
            <p>
              Best <span className="font-bold text-accent">{best}</span>
            </p>
          </div>
          <GameButton onClick={startGame}>Play again</GameButton>
        </GameOverlay>

        <style>{`
          @keyframes ob-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes ob-pulse {
            0% { transform: scale(.82); opacity: .5 }
            60% { transform: scale(1.06); opacity: 1 }
            100% { transform: scale(1); opacity: 1 }
          }
          @keyframes ob-flash { 0% { opacity: .9 } 100% { opacity: 0 } }
          @keyframes ob-flash-static { 0% { opacity: .6 } 100% { opacity: 0 } }
          @keyframes ob-badge {
            0% { transform: translate(-50%, 6px) scale(.7); opacity: 0 }
            25% { transform: translate(-50%, 0) scale(1.12); opacity: 1 }
            100% { transform: translate(-50%, -14px) scale(1); opacity: 0 }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
