'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BOB_R,
  FIELD_H,
  FIELD_W,
  GLINT_R,
  isDanger,
  mulberry32,
  newGame,
  PEG_R,
  reachablePeg,
  step,
  type LatchState,
  type Rng,
} from '@/lib/games/latch/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Phase = 'idle' | 'playing' | 'over'

interface GlintPop {
  x: number
  y: number
  t: number // 1 -> 0
}

function ComboBadge({ mult }: { mult: number }) {
  return (
    <span
      key={mult}
      className="latch-combo-flash rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-sm font-bold text-accent"
    >
      ×{mult}
    </span>
  )
}

function newSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 32)) >>> 0
}

export function GameLatch({ storageKey }: { storageKey: string }) {
  const [best, setBest] = useState(0)
  const [score, setScore] = useState(0)
  const [pegs, setPegs] = useState(0)
  const [mult, setMult] = useState(1)
  const [phase, setPhase] = useState<Phase>('idle')
  const [ready, setReady] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<LatchState | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)
  const holdingRef = useRef(false)
  const bestRef = useRef(0)
  const cssSizeRef = useRef(FIELD_W)
  const seedRef = useRef(0)
  const rngRef = useRef<Rng>(() => 0)
  // Juice.
  const flashRef = useRef(0)
  const shakeRef = useRef(0)
  const slowmoRef = useRef(0) // frames remaining
  const dangerActiveRef = useRef(false) // edge-detect enteredDanger
  const glintPopRef = useRef<GlintPop[]>([])
  const lastMilestoneRef = useRef(0)
  // Throttle setState churn.
  const lastScoreRef = useRef(0)
  const lastPegsRef = useRef(0)
  const lastMultRef = useRef(1)
  // Expose for the hidden E2E probe.
  const [probe, setProbe] = useState('')

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
    const cam = g.cameraX
    ctx.clearRect(0, 0, FIELD_W, FIELD_H)

    ctx.save()
    if (!reduced && shakeRef.current > 0) {
      const m = shakeRef.current
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
    }

    // Background — night neon gradient.
    const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H)
    bg.addColorStop(0, 'rgba(28,18,58,0.45)')
    bg.addColorStop(1, 'rgba(6,10,26,0.6)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)

    // Parallax grid, offset by cameraX (disabled when reduced).
    if (!reduced) {
      const gridStep = 40
      const off = cam % gridStep
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(120,120,220,0.09)'
      ctx.beginPath()
      for (let x = -off; x <= FIELD_W; x += gridStep) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, FIELD_H)
      }
      for (let y = 0; y <= FIELD_H; y += gridStep) {
        ctx.moveTo(0, y)
        ctx.lineTo(FIELD_W, y)
      }
      ctx.stroke()
    }

    // Pit fog at the bottom.
    const fog = ctx.createLinearGradient(0, FIELD_H - 90, 0, FIELD_H)
    fog.addColorStop(0, 'rgba(120,40,90,0)')
    fog.addColorStop(1, 'rgba(160,40,80,0.28)')
    ctx.fillStyle = fog
    ctx.fillRect(0, FIELD_H - 90, FIELD_W, 90)

    const reach = reachablePeg(g)

    // Glints — pulsing 4-point sparkles (uncollected only; collected fade via pop layer).
    for (const gl of g.glints) {
      if (gl.collected) continue
      const sx = gl.x - cam
      if (sx < -GLINT_R || sx > FIELD_W + GLINT_R) continue
      const pulse = reduced ? 1 : 0.8 + 0.2 * Math.sin(gl.x * 0.05 + cam * 0.02)
      ctx.save()
      ctx.translate(sx, gl.y)
      ctx.rotate(Math.PI / 4)
      ctx.shadowColor = 'rgba(250,204,21,0.9)'
      ctx.shadowBlur = reduced ? 0 : 12
      ctx.fillStyle = '#fde68a'
      const r = GLINT_R * 0.5 * pulse
      ctx.beginPath()
      // A 4-point star drawn as two crossed diamonds.
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2
        const ox = Math.cos(a) * r
        const oy = Math.sin(a) * r
        if (k === 0) ctx.moveTo(ox, oy)
        else ctx.lineTo(ox, oy)
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // Pegs — glowing rings; the reachable one gets a bright ring.
    for (const p of g.pegs) {
      const sx = p.x - cam
      if (sx < -PEG_R * 3 || sx > FIELD_W + PEG_R * 3) continue
      const isReach = reach && p.id === reach.id
      ctx.save()
      ctx.shadowColor = isReach ? 'rgba(56,189,248,0.95)' : 'rgba(99,102,241,0.55)'
      ctx.shadowBlur = reduced ? 0 : isReach ? 16 : 8
      ctx.lineWidth = isReach ? 3 : 2
      ctx.strokeStyle = isReach ? '#7dd3fc' : p.used ? 'rgba(148,163,184,0.6)' : '#818cf8'
      ctx.beginPath()
      ctx.arc(sx, p.y, PEG_R, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.fillStyle = isReach ? 'rgba(125,211,252,0.35)' : 'rgba(99,102,241,0.18)'
      ctx.beginPath()
      ctx.arc(sx, p.y, PEG_R - 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const bx = g.bobX - cam
    const by = g.bobY

    // Tether while swinging.
    if (g.mode === 'swinging') {
      ctx.strokeStyle = 'rgba(226,232,240,0.55)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(g.pivotX - cam, g.pivotY)
      ctx.lineTo(bx, by)
      ctx.stroke()
    }

    // Ideal-arc dotted guide toward the next reachable peg while flying.
    if (g.mode === 'flying' && reach) {
      ctx.save()
      ctx.setLineDash([3, 6])
      ctx.strokeStyle = 'rgba(125,211,252,0.28)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(reach.x - cam, reach.y)
      ctx.stroke()
      ctx.restore()
    }

    // Bob — radial-gradient disc with a motion tilt.
    let tilt: number
    if (g.mode === 'flying') tilt = Math.atan2(g.vy, g.vx)
    else tilt = g.theta // tangent-ish lean while swinging
    ctx.save()
    ctx.translate(bx, by)
    ctx.rotate(tilt * 0.4)
    ctx.shadowColor = 'rgba(56,189,248,0.9)'
    ctx.shadowBlur = reduced ? 6 : 18
    const body = ctx.createRadialGradient(-3, -3, 2, 0, 0, BOB_R + 2)
    body.addColorStop(0, '#e0f2fe')
    body.addColorStop(1, '#38bdf8')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, BOB_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#0b1120'
    ctx.beginPath()
    ctx.arc(BOB_R * 0.35, -BOB_R * 0.25, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Glint collection pops.
    for (const pop of glintPopRef.current) {
      const sx = pop.x - cam
      const s = 1 + (1 - pop.t) * 0.6
      ctx.save()
      ctx.globalAlpha = pop.t
      ctx.translate(sx, pop.y)
      ctx.scale(s, s)
      ctx.strokeStyle = 'rgba(253,230,138,0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, GLINT_R * 0.7, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore() // undo shake

    // Danger vignette during slow-mo.
    if (!reduced && slowmoRef.current > 0) {
      const vig = ctx.createRadialGradient(FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.3, FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.7)
      vig.addColorStop(0, 'rgba(220,38,38,0)')
      vig.addColorStop(1, 'rgba(220,38,38,0.35)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    }

    // Death flash.
    if (flashRef.current > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.55 * flashRef.current})`
      ctx.fillRect(0, 0, FIELD_W, FIELD_H)
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

      if (phaseRef.current === 'playing' && !g.over) {
        // Slow-mo on the fatal near-miss grab.
        if (slowmoRef.current > 0 && !reducedRef.current) {
          dt *= 0.35
          slowmoRef.current -= 1
        } else if (slowmoRef.current > 0) {
          slowmoRef.current = 0
        }

        const s = step(g, { dt, holding: holdingRef.current }, rngRef.current)
        gameRef.current = s
        const ev = s.events

        if (ev.released) play('flip')
        if (ev.caught) play('match')
        if (ev.collectedGlint) {
          play('eat')
          // Push a pop for each freshly collected glint (best-effort at bob pos).
          glintPopRef.current.push({ x: s.bobX, y: s.bobY, t: 1 })
        }
        if (ev.tierUp) play('merge')
        if (ev.comboBroken) play('mismatch')

        // Edge-detected danger -> slow-mo whoosh (once per danger entry).
        const danger = isDanger(s)
        if (danger && !dangerActiveRef.current) {
          if (!reducedRef.current) slowmoRef.current = 22
          play('move')
        }
        dangerActiveRef.current = danger

        // Scoring / best.
        if (s.score !== lastScoreRef.current) {
          lastScoreRef.current = s.score
          setScore(s.score)
          if (s.score > bestRef.current) {
            bestRef.current = s.score
            setBest(s.score)
            localStorage.setItem(storageKey, String(s.score))
            // Milestone chime every +50 to avoid spam.
            const milestone = Math.floor(s.score / 50)
            if (milestone > lastMilestoneRef.current) {
              lastMilestoneRef.current = milestone
              play('win')
            }
          }
        }
        if (s.pegsChained !== lastPegsRef.current) {
          lastPegsRef.current = s.pegsChained
          setPegs(s.pegsChained)
        }
        if (s.multiplier !== lastMultRef.current) {
          lastMultRef.current = s.multiplier
          setMult(s.multiplier)
        }

        if (ev.over) {
          play('lose')
          flashRef.current = 1
          shakeRef.current = 10
          phaseRef.current = 'over'
          setPhase('over')
        }

        // E2E probe (deterministic per frame).
        setProbe(
          JSON.stringify({
            mode: s.mode,
            pegsChained: s.pegsChained,
            score: s.score,
            over: s.over,
            reachablePegId: reachablePeg(s)?.id ?? null,
            caught: ev.caught,
          }),
        )
      }

      // Decay juice.
      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.06 * dt)
      if (shakeRef.current > 0) shakeRef.current = Math.max(0, shakeRef.current - 0.6 * dt)
      const pops = glintPopRef.current
      if (pops.length) {
        for (const p of pops) p.t -= 0.05 * dt
        glintPopRef.current = pops.filter((p) => p.t > 0)
      }

      draw()
      rafRef.current = requestAnimationFrame(frame)
    },
    [draw, play, storageKey, reducedRef],
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

  const beginIfIdle = useCallback(() => {
    if (phaseRef.current === 'idle') {
      phaseRef.current = 'playing'
      setPhase('playing')
    }
  }, [])

  const restart = useCallback(() => {
    const seed = newSeed()
    seedRef.current = seed
    rngRef.current = mulberry32(seed)
    gameRef.current = newGame(rngRef.current)
    holdingRef.current = false
    flashRef.current = 0
    shakeRef.current = 0
    slowmoRef.current = 0
    dangerActiveRef.current = false
    glintPopRef.current = []
    lastTsRef.current = 0
    lastMilestoneRef.current = 0
    lastScoreRef.current = 0
    lastPegsRef.current = 0
    lastMultRef.current = 1
    phaseRef.current = 'idle'
    setScore(0)
    setPegs(0)
    setMult(1)
    setPhase('idle')
    draw()
  }, [draw])

  // ---- Init (client only, SSR-safe) ----
  useEffect(() => {
    setReady(true)
    const seed = newSeed()
    seedRef.current = seed
    rngRef.current = mulberry32(seed)
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

  // ---- Keyboard (hold/release) ----
  useEffect(() => {
    const keys = new Set([' ', 'Spacebar', 'ArrowUp'])
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (!keys.has(e.key)) return
      e.preventDefault()
      if (e.repeat) return
      if (phaseRef.current === 'over') return
      beginIfIdle()
      holdingRef.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (!keys.has(e.key)) return
      holdingRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [beginIfIdle])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (phaseRef.current === 'over') return
      e.currentTarget.setPointerCapture?.(e.pointerId)
      beginIfIdle()
      holdingRef.current = true
    },
    [beginIfIdle],
  )
  const releaseHold = useCallback(() => {
    holdingRef.current = false
  }, [])

  const hint =
    phase === 'over'
      ? 'Press New Game to swing again.'
      : phase === 'idle'
        ? 'Hold Space / touch to swing, release to launch.'
        : 'Release at the bottom of the swing to fly far. Grab glints for combo.'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: score, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Pegs', value: pegs, testId: 'pegs' },
      ]}
      headerExtra={mult > 1 ? <ComboBadge mult={mult} /> : null}
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
          data-testid="latch-board"
          onPointerDown={onPointerDown}
          onPointerUp={releaseHold}
          onPointerCancel={releaseHold}
          onPointerLeave={releaseHold}
          className="block h-full w-full cursor-pointer touch-none"
          style={{ touchAction: 'none' }}
          aria-label="Latch game board — hold to swing, release to launch"
        />
        <div data-testid="latch-status" className="sr-only" aria-hidden="true">
          {probe}
        </div>
        <GameOverlay show={phase === 'over'} variant="lose" title="Dropped" testId="game-over">
          <p className="text-fg-muted">
            Score: {score} · Pegs: {pegs} · Best: {best}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
      <style>{`
        @keyframes latch-glint-pop { from { transform: scale(1); opacity: 1 } to { transform: scale(1.6); opacity: 0 } }
        @keyframes latch-combo-flash { 0% { transform: scale(1) } 40% { transform: scale(1.35) } 100% { transform: scale(1) } }
        @keyframes latch-danger-vignette { 0%,100% { opacity: .5 } 50% { opacity: 1 } }
        .latch-combo-flash { animation: latch-combo-flash .4s ease-out }
        @media (prefers-reduced-motion: reduce) {
          .latch-combo-flash { animation: none }
        }
      `}</style>
    </GameShell>
  )
}
