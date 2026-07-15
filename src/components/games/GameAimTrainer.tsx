'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  accuracy as accuracyOf,
  DEFAULT_TARGET_COUNT,
  isComplete,
  newGame,
  nextTarget,
  registerHit,
  registerMiss,
  targetsPerSecond,
  type AimState,
  type Target,
} from '@/lib/games/aim/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Status = 'idle' | 'running' | 'done'

interface Burst {
  id: number
  x: number
  y: number
}

interface Result {
  timeMs: number
  accuracy: number
  tps: number
}

// Component-scoped keyframes so globals.css stays untouched.
const AIM_STYLE = `
@keyframes aim-spawn {
  0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
  70%  { transform: translate(-50%, -50%) scale(1.12); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}
@keyframes aim-burst {
  0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0.9; }
  100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
}`

const round1 = (n: number) => Math.round(n * 10) / 10

export function GameAimTrainer({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<AimState | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [bursts, setBursts] = useState<Burst[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [best, setBest] = useState(0) // best targets-per-second (higher is better); 0 = none
  const [newBest, setNewBest] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<AimState | null>(null)
  const statusRef = useRef<Status>('idle')
  const startRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const bestRef = useRef(0)
  const burstSeq = useRef(0)
  // Read reduced-motion inside handlers without re-subscribing.
  const reducedMotionRef = useRef(reduced)
  reducedMotionRef.current = reduced

  const setStatusBoth = useCallback((s: Status) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const commit = useCallback((s: AimState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  // Live timer: runs only while playing, driven by performance.now() in the effect layer.
  const loop = useCallback(() => {
    if (statusRef.current !== 'running') return
    setElapsed(performance.now() - startRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const reset = useCallback(() => {
    stopLoop()
    setStatusBoth('idle')
    setNewBest(false)
    setResult(null)
    setElapsed(0)
    setBursts([])
    setTarget(null)
    commit(newGame(DEFAULT_TARGET_COUNT))
  }, [commit, setStatusBoth, stopLoop])

  useEffect(() => {
    reset()
    const stored = Number(localStorage.getItem(storageKey))
    const value = Number.isFinite(stored) && stored > 0 ? stored : 0
    bestRef.current = value
    setBest(value)
  }, [reset, storageKey])

  useEffect(() => () => stopLoop(), [stopLoop])

  const start = useCallback(() => {
    const fresh = newGame(DEFAULT_TARGET_COUNT)
    commit(fresh)
    setResult(null)
    setNewBest(false)
    setBursts([])
    setElapsed(0)
    setTarget(nextTarget(fresh, Math.random))
    startRef.current = performance.now()
    setStatusBoth('running')
    stopLoop()
    rafRef.current = requestAnimationFrame(loop)
    play('flip')
  }, [commit, loop, play, setStatusBoth, stopLoop])

  const finish = useCallback(
    (finalState: AimState) => {
      stopLoop()
      const timeMs = performance.now() - startRef.current
      setElapsed(timeMs)
      const tps = targetsPerSecond(finalState, timeMs)
      const res: Result = { timeMs, accuracy: accuracyOf(finalState), tps }
      setResult(res)
      setStatusBoth('done')
      setTarget(null)
      if (bestRef.current === 0 || tps > bestRef.current) {
        bestRef.current = tps
        setBest(tps)
        localStorage.setItem(storageKey, String(tps))
        setNewBest(true)
      }
      play('win')
    },
    [play, setStatusBoth, stopLoop, storageKey],
  )

  const addBurst = useCallback((t: Target) => {
    if (reducedMotionRef.current) return
    const id = ++burstSeq.current
    setBursts((b) => [...b, { id, x: t.x, y: t.y }])
  }, [])

  const onHitTarget = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation() // a hit must never also count as an empty-space miss
      if (statusRef.current !== 'running') return
      const cur = stateRef.current
      const hitAt = target
      if (!cur || !hitAt) return
      const next = registerHit(cur)
      commit(next)
      addBurst(hitAt)
      if (isComplete(next)) {
        finish(next)
      } else {
        setTarget(nextTarget(next, Math.random))
        play('flip')
      }
    },
    [addBurst, commit, finish, play, target],
  )

  const onMiss = useCallback(() => {
    if (statusRef.current !== 'running') return
    const cur = stateRef.current
    if (!cur) return
    commit(registerMiss(cur))
    play('error')
  }, [commit, play])

  const hits = state?.hits ?? 0
  const accuracy = state ? accuracyOf(state) : 0
  const seconds = round1(elapsed / 1000)

  const hint =
    status === 'running'
      ? 'Click the targets as fast as you can.'
      : status === 'done'
        ? 'Run complete — start again to beat your best.'
        : `Hit ${DEFAULT_TARGET_COUNT} targets as fast and accurately as you can.`

  const targetPx = 'clamp(2.5rem, 11vw, 3.5rem)'

  return (
    <GameShell
      stats={[
        { label: 'Hits', value: hits, testId: 'hits' },
        { label: 'Accuracy', value: accuracy, testId: 'accuracy' },
        { label: 'Best t/s', value: round1(best), testId: 'best' },
      ]}
      headerExtra={
        <div className="rounded-lg bg-surface px-3 py-1.5 text-sm tabular-nums" aria-live="off">
          Time <span data-testid="time" className="font-bold">{seconds.toFixed(1)}s</span>
        </div>
      }
      onNewGame={status === 'idle' ? start : reset}
      newGameLabel={status === 'idle' ? 'Start' : 'Reset'}
      newGameDisabled={!state}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{AIM_STYLE}</style>
      <div className="anim-board-in relative">
        <div
          data-testid="aim-area"
          onClick={onMiss}
          className="relative aspect-[4/3] w-full touch-manipulation overflow-hidden rounded-xl bg-surface"
          style={{ cursor: status === 'running' ? 'crosshair' : 'default' }}
        >
          {bursts.map((b) => (
            <span
              key={b.id}
              aria-hidden="true"
              onAnimationEnd={() => setBursts((cur) => cur.filter((x) => x.id !== b.id))}
              className="pointer-events-none absolute rounded-full border-2 border-accent"
              style={{
                left: `${b.x * 100}%`,
                top: `${b.y * 100}%`,
                width: targetPx,
                height: targetPx,
                animation: 'aim-burst 320ms ease-out forwards',
              }}
            />
          ))}

          {status === 'running' && target && (
            <button
              type="button"
              onClick={onHitTarget}
              data-testid="aim-target"
              aria-label="Target — click it"
              className="absolute rounded-full bg-accent shadow-lg ring-2 ring-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{
                left: `${target.x * 100}%`,
                top: `${target.y * 100}%`,
                width: targetPx,
                height: targetPx,
                transform: 'translate(-50%, -50%)',
                cursor: 'crosshair',
                ...(reduced ? {} : { animation: 'aim-spawn 160ms ease-out' }),
              }}
            >
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80"
              />
            </button>
          )}

          {status === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-2xl font-extrabold sm:text-3xl">Aim Trainer</p>
              <p className="text-sm text-fg-muted">Hit {DEFAULT_TARGET_COUNT} targets — fast & accurate</p>
              <GameButton onClick={start} className="px-4 py-2">
                Start
              </GameButton>
            </div>
          )}
        </div>

        <GameOverlay
          show={status === 'done' && result !== null}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Complete!'}
          testId="aim-results"
        >
          {result && (
            <div className="flex flex-col items-center gap-1 text-fg">
              <p className="text-3xl font-extrabold tabular-nums" data-testid="result-time">
                {round1(result.timeMs / 1000).toFixed(1)}s
              </p>
              <p className="text-sm text-fg-muted tabular-nums">
                {result.accuracy}% accuracy · {round1(result.tps).toFixed(1)} targets/sec
              </p>
            </div>
          )}
          <GameButton onClick={start} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
