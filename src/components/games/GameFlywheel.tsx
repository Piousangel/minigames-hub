'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  arcHalf,
  hueForRpm,
  markerToCenter,
  MAX_DT,
  mulberry32,
  newGame,
  omega,
  PERFECT_FRAC,
  step,
  tap,
  type FlywheelState,
  type Rng,
} from '@/lib/games/flywheel/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Phase = 'idle' | 'playing' | 'over'

const FIELD = 400
const TAU = Math.PI * 2

export function GameFlywheel({ storageKey }: { storageKey: string }) {
  const [best, setBest] = useState(0)
  const newBestRef = useRef(false)
  const [newBest, setNewBest] = useState(false)
  const [score, setScore] = useState(Math.round(newGame().rpm))
  const [lives, setLives] = useState(newGame().lives)
  const [phase, setPhase] = useState<Phase>('idle')
  const [ready, setReady] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<FlywheelState>(newGame())
  const phaseRef = useRef<Phase>('idle')
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)
  const tapQueuedRef = useRef(false)
  const bestRef = useRef(0)
  const cssSizeRef = useRef(FIELD)
  const rngRef = useRef<Rng>(mulberry32(1))
  const ghostAngleRef = useRef(0) // decorative PB marker angle (turns)

  // Juice refs (all gated on reducedRef).
  const flashRef = useRef(0) // miss red flash (1 → 0)
  const shakeRef = useRef(0) // miss shake (px)
  const ringPulseRef = useRef(0) // perfect ring (1 → 0)
  const telegraphRef = useRef(0) // flutter pre-flash (1 → 0)
  const numPulseRef = useRef(0) // center number pop (1 → 0)

  const mutedRef = useRef(muted)
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // ---- Draw ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const g = gameRef.current
    if (!canvas || !g) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const scale = (cssSizeRef.current / FIELD) * dpr
    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    const reduced = reducedRef.current
    ctx.clearRect(0, 0, FIELD, FIELD)

    const cx = FIELD / 2
    const cy = FIELD / 2
    const R = 0.42 * FIELD
    const hue = hueForRpm(g.rpm)
    // Lightness rises 55→92% as rpm 40→220 (white-hot).
    const lightT = Math.max(0, Math.min(1, (g.rpm - 40) / (220 - 40)))
    const L = 55 + lightT * (92 - 55)

    ctx.save()
    if (!reduced && shakeRef.current > 0) {
      const m = shakeRef.current
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
    }

    // 1) Background radial gradient tinted by rpm.
    const bg = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.6)
    bg.addColorStop(0, `hsla(${hue}, 60%, 20%, 0.55)`)
    bg.addColorStop(1, 'rgba(6,10,26,0.6)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, FIELD, FIELD)

    // 2) Wheel rim.
    ctx.save()
    ctx.shadowColor = `hsl(${hue}, 90%, ${L}%)`
    ctx.shadowBlur = reduced ? 0 : 10 + lightT * 22
    ctx.strokeStyle = `hsl(${hue}, 90%, ${L}%)`
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, TAU)
    ctx.stroke()
    ctx.restore()

    // 3) Strike-zone arc at the top (centered at -90°).
    const half = arcHalf(g)
    const top = -Math.PI / 2
    const zoneA = top - half * TAU
    const zoneB = top + half * TAU
    ctx.save()
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(255,255,255,0.30)'
    ctx.lineWidth = 14
    ctx.beginPath()
    ctx.arc(cx, cy, R, zoneA, zoneB)
    ctx.stroke()
    // Perfect sub-band (brighter) so the shrinking sweet spot is visible.
    const pHalf = PERFECT_FRAC * g.arcWidth
    ctx.strokeStyle = `hsl(${hue}, 95%, 88%)`
    ctx.lineWidth = 14
    ctx.beginPath()
    ctx.arc(cx, cy, R, top - pHalf * TAU, top + pHalf * TAU)
    ctx.stroke()
    ctx.restore()

    // 4) Ghost / PB marker orbiting the rim at best-rpm pace.
    if (bestRef.current > 0) {
      const ga = top - ghostAngleRef.current * TAU
      const gx = cx + Math.cos(ga) * R
      const gy = cy + Math.sin(ga) * R
      ctx.fillStyle = 'rgba(180,200,255,0.45)'
      ctx.beginPath()
      ctx.arc(gx, gy, 5, 0, TAU)
      ctx.fill()
    }

    // 5) Marker(s). θ = -90° - markerToCenter·360° (approaches top clockwise).
    const telePulse = !reduced ? telegraphRef.current : 0
    const drawMarker = (angle: number) => {
      const mx = cx + Math.cos(angle) * R
      const my = cy + Math.sin(angle) * R
      ctx.save()
      ctx.shadowColor = `hsl(${hue}, 95%, 80%)`
      ctx.shadowBlur = reduced ? 0 : 12 + telePulse * 16
      ctx.fillStyle = `hsl(${hue}, 95%, ${Math.min(96, L + 20)}%)`
      ctx.beginPath()
      ctx.arc(mx, my, 9 + telePulse * 3, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
    const theta = top - markerToCenter(g) * TAU
    drawMarker(theta)
    if (g.isFlutter) drawMarker(theta + Math.PI)

    // 7) Perfect ring expanding from the top.
    if (!reduced && ringPulseRef.current > 0) {
      const rp = ringPulseRef.current
      const tx = cx + Math.cos(top) * R
      const ty = cy + Math.sin(top) * R
      ctx.strokeStyle = `hsla(${hue}, 95%, 85%, ${rp})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(tx, ty, (1 - rp) * 44 + 6, 0, TAU)
      ctx.stroke()
    }

    ctx.restore() // undo shake

    // 6) Center readout: big rpm number.
    const pop = !reduced ? 1 + numPulseRef.current * 0.18 : 1
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(pop, pop)
    ctx.fillStyle = `hsl(${hue}, 95%, ${Math.min(95, L + 15)}%)`
    ctx.font = 'bold 74px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(Math.round(g.rpm)), 0, -6)
    ctx.font = 'bold 20px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(220,230,255,0.7)'
    ctx.fillText('RPM', 0, 40)
    ctx.restore()

    // Miss red flash overlay.
    if (flashRef.current > 0) {
      ctx.fillStyle = `rgba(239,68,68,${0.4 * flashRef.current})`
      ctx.fillRect(0, 0, FIELD, FIELD)
    }
  }, [reducedRef])

  const persistBest = useCallback(
    (g: FlywheelState) => {
      const peak = Math.round(g.peakRpm)
      if (peak > bestRef.current) {
        bestRef.current = peak
        setBest(peak)
      }
      try {
        localStorage.setItem(storageKey, String(Math.max(bestRef.current, peak)))
      } catch {
        /* ignore quota / privacy-mode errors */
      }
    },
    [storageKey],
  )

  // ---- Loop ----
  const frame = useCallback(
    (ts: number) => {
      const last = lastTsRef.current || ts
      lastTsRef.current = ts
      let dt = (ts - last) / 1000
      if (dt > MAX_DT) dt = MAX_DT

      const g = gameRef.current
      if (phaseRef.current === 'playing' && g && !g.over) {
        if (tapQueuedRef.current) {
          tapQueuedRef.current = false
          const tapped = tap(g)
          gameRef.current = tapped
          const ev = tapped.events
          if (ev.grade === 'perfect') {
            play('match')
            ringPulseRef.current = 1
            numPulseRef.current = 1
            if (!mutedRef.current && typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(15)
            }
          } else if (ev.grade === 'good') {
            play('flip')
          } else if (ev.grade === 'early' || ev.grade === 'late') {
            play('mismatch')
          } else if (ev.whiff) {
            play('error')
          }
          if (ev.newPeak) play('eat')
        }

        const s = step(gameRef.current, dt, rngRef.current)
        gameRef.current = s

        if (s.events.missed) {
          play('error')
          flashRef.current = 1
          shakeRef.current = 8
        }
        if (s.events.flutterStarted) {
          play('flag')
          telegraphRef.current = 1
        }

        // Sync surfaced stats.
        setScore(Math.round(s.rpm))
        setLives(s.lives)
        if (Math.round(s.peakRpm) > bestRef.current) {
          bestRef.current = Math.round(s.peakRpm)
          setBest(bestRef.current)
          // over 시점엔 bestRef가 이미 peak와 같아져 비교가 무의미하다. 경신이 실제로
          // 일어나는 여기서 플래그를 세운다.
          newBestRef.current = true
        }

        // Advance the decorative ghost at best-rpm pace.
        if (!reducedRef.current && bestRef.current > 0) {
          ghostAngleRef.current += omega(bestRef.current) * dt
        }

        if (s.over) {
          phaseRef.current = 'over'
          setPhase('over')
          setNewBest(newBestRef.current)
          play(newBestRef.current ? 'win' : 'lose')
          flashRef.current = 1
          shakeRef.current = 10
          persistBest(s)
          recordResult(storageKey.replace(/^best:/, ''))
        }
      }

      // Decay juice.
      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - dt * 4)
      if (shakeRef.current > 0) shakeRef.current = Math.max(0, shakeRef.current - dt * 60)
      if (ringPulseRef.current > 0) ringPulseRef.current = Math.max(0, ringPulseRef.current - dt * 3)
      if (telegraphRef.current > 0)
        telegraphRef.current = Math.max(0, telegraphRef.current - dt * 1.5)
      if (numPulseRef.current > 0) numPulseRef.current = Math.max(0, numPulseRef.current - dt * 5)

      draw()
      rafRef.current = requestAnimationFrame(frame)
    },
    [draw, play, persistBest, reducedRef, storageKey],
  )

  // ---- Responsive canvas ----
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const cssW = wrap.clientWidth
    cssSizeRef.current = cssW
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssW * dpr)
    canvas.style.height = `${cssW}px`
    draw()
  }, [draw])

  // ---- Tap / start ----
  const doTap = useCallback(() => {
    if (phaseRef.current === 'over') return
    if (phaseRef.current === 'idle') {
      rngRef.current = mulberry32(Date.now() >>> 0)
      phaseRef.current = 'playing'
      setPhase('playing')
      return // starting tap does not grade
    }
    tapQueuedRef.current = true
  }, [])

  const restart = useCallback(() => {
    gameRef.current = newGame()
    tapQueuedRef.current = false
    flashRef.current = 0
    shakeRef.current = 0
    ringPulseRef.current = 0
    telegraphRef.current = 0
    numPulseRef.current = 0
    ghostAngleRef.current = 0
    lastTsRef.current = 0
    rngRef.current = mulberry32(1)
    phaseRef.current = 'idle'
    newBestRef.current = false
    setNewBest(false)
    setScore(Math.round(gameRef.current.rpm))
    setLives(gameRef.current.lives)
    setPhase('idle')
    draw()
  }, [draw])

  // ---- Init (client only, SSR-safe) ----
  useEffect(() => {
    setReady(true)
    gameRef.current = newGame()
    let stored = 0
    try {
      const raw = Number(localStorage.getItem(storageKey))
      stored = Number.isFinite(raw) ? raw : 0
    } catch {
      stored = 0
    }
    bestRef.current = stored
    setBest(stored)
    resize()
    rafRef.current = requestAnimationFrame(frame)
    const ro = new ResizeObserver(resize)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
    // Mount once. frame/resize are stable useCallbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Keyboard (Space / Enter) ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault()
        doTap()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [doTap])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      doTap()
    },
    [doTap],
  )

  const hint =
    phase === 'over'
      ? 'Press New Game to ride again.'
      : phase === 'idle'
        ? 'Tap / click / Space to start — then tap each time the marker hits the top.'
        : 'Tap dead-center for a Perfect. Perfects spin it faster.'

  const hearts = (
    <div
      className="flex items-center gap-1 rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm"
      aria-label={`Lives: ${lives}`}
    >
      <span className="text-fg-muted">Lives</span>
      <span aria-hidden="true" className="tracking-widest">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < lives ? 'text-red-400' : 'text-fg-muted/30'}>
            ♥
          </span>
        ))}
      </span>
    </div>
  )

  return (
    <GameShell
      stats={[
        { label: 'RPM', value: score, testId: 'score', float: false },
        { label: 'Best', value: best },
      ]}
      headerExtra={hearts}
      onNewGame={restart}
      newGameDisabled={!ready}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <div
        ref={wrapRef}
        className="anim-board-in relative aspect-square w-full touch-none overflow-hidden rounded-xl bg-surface"
      >
        <canvas
          ref={canvasRef}
          data-testid="flywheel-board"
          onPointerDown={onPointerDown}
          className="block h-full w-full cursor-pointer"
          style={{ touchAction: 'none' }}
          aria-label="Flywheel game board — tap or press Space on the beat"
        />
        <GameOverlay
          show={phase === 'over'}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Wheel stalled'}
          testId="game-over"
        >
          <p className="text-fg-muted">Peak RPM: {best}</p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
