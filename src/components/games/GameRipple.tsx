'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BUOY_R,
  FIELD_H,
  FIELD_W,
  MAX_DROWN,
  RING_MAX_R,
  RING_SPEED,
  mulberry32,
  newGame,
  previewSweep,
  step,
  type Point,
  type Rng,
  type RippleState,
} from '@/lib/games/ripple/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordFinish } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Phase = 'idle' | 'playing' | 'over'

// Neon palette for the 5 buoy colors (cyan / lime / magenta / amber / rose).
const BUOY_HUES = ['#22d3ee', '#a3e635', '#f472b6', '#fbbf24', '#fb7185'] as const

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number // 1 -> 0
  hue: string
}

interface Splash {
  x: number
  y: number
  r: number
  life: number // 1 -> 0
}

function seedFromUrl(): number | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('seed')
  if (raw == null) return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

export function GameRipple({ storageKey, seed }: { storageKey: string; seed?: number }) {
  const [best, setBest] = useState(0)
  const newBestRef = useRef(false)
  const [newBest, setNewBest] = useState(false)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_DROWN)
  const [phase, setPhase] = useState<Phase>('idle')
  const [ready, setReady] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<RippleState | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const rngRef = useRef<Rng>(() => 0)
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)

  const dropQueueRef = useRef<Point | null>(null)
  const previewRef = useRef<Point | null>(null)
  const pointerDownRef = useRef(false)
  const cursorRef = useRef<Point>({ x: FIELD_W / 2, y: FIELD_H / 2 })
  const keyboardAimRef = useRef(false)

  const shakeRef = useRef(0)
  const bloomRef = useRef(0)
  const swellFlashRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const splashesRef = useRef<Splash[]>([])
  const tRef = useRef(0) // ambient animation clock

  const cssSizeRef = useRef(FIELD_W)
  const bestRef = useRef(0)

  // ---- Draw ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const g = gameRef.current
    if (!canvas || !g) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const scale = (cssSizeRef.current / FIELD_W) * dpr
    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    const reduced = reducedRef.current
    ctx.clearRect(0, 0, FIELD_W, FIELD_H)

    ctx.save()
    if (!reduced && shakeRef.current > 0) {
      const m = shakeRef.current
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
    }

    // Pond — deep blue-violet radial gradient.
    const bg = ctx.createRadialGradient(FIELD_W / 2, FIELD_H / 2, 20, FIELD_W / 2, FIELD_H / 2, FIELD_W * 0.75)
    bg.addColorStop(0, '#141a3a')
    bg.addColorStop(1, '#05060f')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)

    // Subtle caustics (skipped when reduced).
    if (!reduced) {
      ctx.strokeStyle = 'rgba(120,150,255,0.05)'
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        const phaseOff = tRef.current * 0.4 + i * 1.3
        ctx.beginPath()
        ctx.arc(
          FIELD_W / 2 + Math.cos(phaseOff) * 60,
          FIELD_H / 2 + Math.sin(phaseOff * 0.8) * 60,
          40 + i * 26,
          0,
          Math.PI * 2,
        )
        ctx.stroke()
      }
    }

    // Swell warning band — brightness pulses as swellTimer approaches 0.
    const swellFrac = 1 - Math.min(1, g.swellTimer / 90) // ramps up in the last 90 frames
    const pulse = reduced ? 0.12 : 0.12 + swellFrac * 0.5 + swellFlashRef.current * 0.4
    if (pulse > 0.05) {
      const band = ctx.createLinearGradient(0, FIELD_H - 60, 0, FIELD_H)
      band.addColorStop(0, `rgba(80,120,255,0)`)
      band.addColorStop(1, `rgba(120,170,255,${Math.min(0.6, pulse)})`)
      ctx.fillStyle = band
      ctx.fillRect(0, FIELD_H - 60, FIELD_W, 60)
    }

    // Rings — stroked crests, brightness fading with radius.
    for (const r of g.rings) {
      const fade = 1 - r.radius / RING_MAX_R
      ctx.save()
      ctx.strokeStyle = `rgba(150,210,255,${0.15 + fade * 0.5})`
      ctx.lineWidth = 2
      if (!reduced) {
        ctx.shadowColor = 'rgba(120,200,255,0.7)'
        ctx.shadowBlur = 10
      }
      ctx.beginPath()
      ctx.arc(r.ox, r.oy, r.radius, 0, Math.PI * 2)
      ctx.stroke()
      // Bright crest edge.
      ctx.strokeStyle = `rgba(220,245,255,${0.3 + fade * 0.5})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(r.ox, r.oy, r.radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Ghost preview (press-hold / keyboard cursor).
    const origin = previewRef.current ?? (keyboardAimRef.current ? cursorRef.current : null)
    if (origin && phaseRef.current !== 'over') {
      ctx.save()
      ctx.setLineDash([5, 6])
      ctx.strokeStyle = 'rgba(190,220,255,0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(origin.x, origin.y, 26, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      // Highlight sweep order.
      const seq = previewSweep(origin, g.buoys)
      seq.forEach((entry, idx) => {
        const b = g.buoys.find((bb) => bb.id === entry.id)
        if (!b) return
        // Would a live ring co-cross this buoy soon? (predicted interference)
        const coCross = g.rings.some((r) => {
          const d = Math.hypot(r.ox - b.x, r.oy - b.y)
          return d > r.radius && d - r.radius < RING_SPEED * 6
        })
        ctx.strokeStyle = coCross ? 'rgba(255,220,120,0.95)' : 'rgba(190,220,255,0.7)'
        ctx.lineWidth = coCross ? 2 : 1
        ctx.beginPath()
        ctx.arc(b.x, b.y, BUOY_R + 4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = 'rgba(220,235,255,0.85)'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(idx + 1), b.x, b.y - BUOY_R - 10)
      })
      // Aim marker line from origin to first buoy.
      ctx.restore()
    }

    // Buoys — filled discs with neon rim.
    for (const b of g.buoys) {
      const hue = BUOY_HUES[b.colorIndex % BUOY_HUES.length]
      ctx.save()
      if (!reduced) {
        ctx.shadowColor = hue
        ctx.shadowBlur = 12
      }
      const grad = ctx.createRadialGradient(b.x - 3, b.y - 3, 2, b.x, b.y, BUOY_R)
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(1, hue)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(b.x, b.y, BUOY_R, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.strokeStyle = hue
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(b.x, b.y, BUOY_R, 0, Math.PI * 2)
      ctx.stroke()
      // About-to-drown warning: double outline.
      if (b.swellsLeft <= 1) {
        ctx.strokeStyle = 'rgba(255,120,120,0.9)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(b.x, b.y, BUOY_R + 4, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Splashes.
    for (const s of splashesRef.current) {
      ctx.strokeStyle = `rgba(200,230,255,${0.5 * s.life})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Particles.
    for (const p of particlesRef.current) {
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = p.hue
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    ctx.restore() // undo shake

    // Bloom flash overlay.
    if (bloomRef.current > 0) {
      ctx.fillStyle = `rgba(180,220,255,${0.35 * bloomRef.current})`
      ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    }

    // Combo meter (thin bar) with chain number.
    if (g.chain > 0) {
      const w = (FIELD_W - 40) * Math.max(0, Math.min(1, g.comboMeter))
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(20, 14, FIELD_W - 40, 5)
      ctx.fillStyle = 'rgba(120,220,255,0.9)'
      ctx.fillRect(20, 14, w, 5)
      ctx.fillStyle = 'rgba(220,240,255,0.95)'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(`Chain ${g.chain}`, 20, 24)
    }
  }, [reducedRef])

  const spawnPops = useCallback((s: RippleState) => {
    const reduced = reducedRef.current
    for (const pop of s.events.pops) {
      const hue = pop.interferenceMult >= 3 ? '#ffffff' : pop.interferenceMult === 2 ? '#f472b6' : '#22d3ee'
      const n = reduced ? 0 : 6 + pop.interferenceMult * 6
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const sp = 1.5 + Math.random() * 2
        particlesRef.current.push({
          x: pop.x,
          y: pop.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1,
          hue,
        })
      }
    }
  }, [reducedRef])

  // ---- Loop ----
  const frame = useCallback(
    (ts: number) => {
      const g = gameRef.current
      if (!g) {
        rafRef.current = requestAnimationFrame(frame)
        return
      }
      const last = lastTsRef.current || ts
      lastTsRef.current = ts
      let dt = (ts - last) / (1000 / 60)
      if (dt > 2.5) dt = 2.5

      tRef.current += dt * 0.03

      if (phaseRef.current === 'playing' && !g.over) {
        const drop = dropQueueRef.current
        dropQueueRef.current = null
        const s = step(g, { dt, drop }, rngRef.current)
        gameRef.current = s

        if (s.events.droppedRing) {
          play('move')
          splashesRef.current.push({ x: drop!.x, y: drop!.y, r: 0, life: 1 })
        }
        if (s.events.pops.length > 0) {
          spawnPops(s)
          let maxInterf = 1
          let milestone = false
          for (const pop of s.events.pops) {
            if (pop.interferenceMult > maxInterf) maxInterf = pop.interferenceMult
            if (pop.chain % 4 === 0) milestone = true
          }
          if (maxInterf >= 2) play('merge')
          else play('eat')
          if (milestone) play('match')
          if (maxInterf >= 3 && !reducedRef.current) {
            shakeRef.current = 8
            bloomRef.current = 1
          }
        }
        if (s.events.perfectSweeps > 0) {
          play('win')
          if (!reducedRef.current) bloomRef.current = Math.max(bloomRef.current, 1.2)
        }
        if (s.events.swell) {
          play('flag')
          if (!reducedRef.current) swellFlashRef.current = 1
        }
        if (s.events.drowns > 0) play('mismatch')

        if (s.score !== score) setScore(s.score)
        const newLives = MAX_DROWN - s.drowned
        if (newLives !== lives) setLives(newLives)
        if (s.score > bestRef.current) {
          bestRef.current = s.score
          setBest(s.score)
          localStorage.setItem(storageKey, String(s.score))
          newBestRef.current = true
        }

        if (s.events.over) {
          if (!reducedRef.current) shakeRef.current = 12
          setNewBest(newBestRef.current)
          play(newBestRef.current ? 'win' : 'lose')
          phaseRef.current = 'over'
          setPhase('over')
          recordFinish(storageKey.replace(/^best:/, ''))
        }
      }

      // Decay juice + advance visuals.
      if (shakeRef.current > 0) shakeRef.current = Math.max(0, shakeRef.current - 0.6 * dt)
      if (bloomRef.current > 0) bloomRef.current = Math.max(0, bloomRef.current - 0.05 * dt)
      if (swellFlashRef.current > 0) swellFlashRef.current = Math.max(0, swellFlashRef.current - 0.05 * dt)
      for (const s of splashesRef.current) {
        s.r += 3 * dt
        s.life -= 0.04 * dt
      }
      splashesRef.current = splashesRef.current.filter((s) => s.life > 0)
      for (const p of particlesRef.current) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 0.94
        p.vy *= 0.94
        p.life -= 0.03 * dt
      }
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0)

      draw()
      rafRef.current = requestAnimationFrame(frame)
    },
    [draw, play, spawnPops, reducedRef, score, lives, storageKey],
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

  const startIfIdle = useCallback(() => {
    if (phaseRef.current === 'idle') {
      phaseRef.current = 'playing'
      setPhase('playing')
    }
  }, [])

  const restart = useCallback(() => {
    gameRef.current = newGame(rngRef.current)
    dropQueueRef.current = null
    previewRef.current = null
    keyboardAimRef.current = false
    pointerDownRef.current = false
    shakeRef.current = 0
    bloomRef.current = 0
    swellFlashRef.current = 0
    particlesRef.current = []
    splashesRef.current = []
    lastTsRef.current = 0
    cursorRef.current = { x: FIELD_W / 2, y: FIELD_H / 2 }
    phaseRef.current = 'idle'
    newBestRef.current = false
    setNewBest(false)
    setScore(0)
    setLives(MAX_DROWN)
    setPhase('idle')
    draw()
  }, [draw])

  // ---- Init (client only, SSR-safe) ----
  useEffect(() => {
    setReady(true)
    rngRef.current = mulberry32(seed ?? seedFromUrl() ?? Date.now())
    gameRef.current = newGame(rngRef.current)
    const stored = Number(localStorage.getItem(storageKey))
    const b = Number.isFinite(stored) ? stored : 0
    bestRef.current = b
    setBest(b)
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

  // ---- Pointer → logical coords ----
  const toLogical = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_W
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_H
    return {
      x: Math.max(0, Math.min(FIELD_W, x)),
      y: Math.max(0, Math.min(FIELD_H, y)),
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (phaseRef.current === 'over') return
      startIfIdle()
      pointerDownRef.current = true
      keyboardAimRef.current = false
      previewRef.current = toLogical(e)
    },
    [startIfIdle, toLogical],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!pointerDownRef.current) return
      previewRef.current = toLogical(e)
    },
    [toLogical],
  )

  const onPointerUp = useCallback(() => {
    if (!pointerDownRef.current) return
    pointerDownRef.current = false
    if (phaseRef.current === 'playing' && previewRef.current) {
      dropQueueRef.current = previewRef.current
    }
    previewRef.current = null
  }, [])

  const onPointerCancel = useCallback(() => {
    pointerDownRef.current = false
    previewRef.current = null
  }, [])

  // ---- Keyboard (spatial cursor, a11y) ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const k = e.key.toLowerCase()
      const STEP = 12
      if (k === 'arrowleft' || k === 'a') {
        e.preventDefault()
        keyboardAimRef.current = true
        cursorRef.current = { ...cursorRef.current, x: Math.max(0, cursorRef.current.x - STEP) }
      } else if (k === 'arrowright' || k === 'd') {
        e.preventDefault()
        keyboardAimRef.current = true
        cursorRef.current = { ...cursorRef.current, x: Math.min(FIELD_W, cursorRef.current.x + STEP) }
      } else if (k === 'arrowup' || k === 'w') {
        e.preventDefault()
        keyboardAimRef.current = true
        cursorRef.current = { ...cursorRef.current, y: Math.max(0, cursorRef.current.y - STEP) }
      } else if (k === 'arrowdown' || k === 's') {
        e.preventDefault()
        keyboardAimRef.current = true
        cursorRef.current = { ...cursorRef.current, y: Math.min(FIELD_H, cursorRef.current.y + STEP) }
      } else if (k === ' ' || k === 'spacebar' || k === 'enter') {
        e.preventDefault()
        if (phaseRef.current === 'over') return
        startIfIdle()
        keyboardAimRef.current = true
        dropQueueRef.current = { ...cursorRef.current }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [startIfIdle])

  const hint =
    phase === 'over'
      ? 'The swell took too many. Press New Game to dive back in.'
      : phase === 'idle'
        ? 'Tap empty water (or aim with arrows + Space) — your ripple sweeps buoys in its path.'
        : "Time it: pop buoys as the ring's edge reaches them. Overlap rings for 2×/3× combos."

  return (
    <GameShell
      stats={[
        { label: 'Score', value: score, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Lives', value: lives },
      ]}
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
          data-testid="ripple-board"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className="block h-full w-full cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          style={{ touchAction: 'none' }}
          aria-label="Ripple pond — arrow keys to aim, Space to drop a ripple"
        />
        <GameOverlay
          show={phase === 'over'}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Drowned out'}
          testId="game-over"
        >
          <p className="text-fg-muted">
            Score: {score} · Best: {best}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
