'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BIRD_R,
  BIRD_X,
  FIELD_H,
  FIELD_W,
  GAP,
  newGame,
  PIPE_W,
  step,
  type FlappyState,
} from '@/lib/games/flappy/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Phase = 'idle' | 'playing' | 'over'

export function GameFlappy({ storageKey }: { storageKey: string }) {
  const [best, setBest] = useState(0)
  const [score, setScore] = useState(0)
  const newBestRef = useRef(false)
  const [newBest, setNewBest] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [ready, setReady] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<FlappyState | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)
  const flapQueuedRef = useRef(false)
  const wingRef = useRef(0) // flap wing-flutter timer (frames)
  const flashRef = useRef(0) // white death-flash intensity (1 → 0)
  const shakeRef = useRef(0) // screen-shake timer (frames)
  const scrollRef = useRef(0) // parallax scroll offset
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

    // Optional screen shake on impact.
    ctx.save()
    if (!reduced && shakeRef.current > 0) {
      const m = shakeRef.current
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
    }

    // Background gradient (night neon sky).
    const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H)
    bg.addColorStop(0, 'rgba(30,20,60,0.35)')
    bg.addColorStop(1, 'rgba(6,10,26,0.55)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)

    // Parallax grid — decorative, dialed back for reduced motion.
    const gridStep = 40
    const off = reduced ? 0 : scrollRef.current % gridStep
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(120,120,220,0.10)'
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

    // Pipes (neon columns with a bright lip at the gap).
    for (const p of g.pipes) {
      const gapTop = p.gapY
      const gapBot = p.gapY + GAP
      const grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0)
      grad.addColorStop(0, 'rgba(16,185,129,0.35)')
      grad.addColorStop(0.5, '#10b981')
      grad.addColorStop(1, 'rgba(16,185,129,0.35)')
      ctx.save()
      ctx.shadowColor = 'rgba(16,185,129,0.7)'
      ctx.shadowBlur = reduced ? 0 : 14
      ctx.fillStyle = grad
      roundRect(ctx, p.x, -6, PIPE_W, gapTop + 6, 6)
      ctx.fill()
      roundRect(ctx, p.x, gapBot, PIPE_W, FIELD_H - gapBot + 6, 6)
      ctx.fill()
      // Bright lips framing the gap.
      ctx.fillStyle = '#6ee7b7'
      roundRect(ctx, p.x - 3, gapTop - 12, PIPE_W + 6, 12, 4)
      ctx.fill()
      roundRect(ctx, p.x - 3, gapBot, PIPE_W + 6, 12, 4)
      ctx.fill()
      ctx.restore()
    }

    // Ground line.
    ctx.strokeStyle = 'rgba(140,220,255,0.25)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, FIELD_H - 1)
    ctx.lineTo(FIELD_W, FIELD_H - 1)
    ctx.stroke()

    // Bird — neon glow, tilt from velocity, wing flutter after a flap.
    const tilt = Math.max(-0.5, Math.min(1.1, g.vy / 12))
    ctx.save()
    ctx.translate(BIRD_X, g.y)
    ctx.rotate(tilt)
    ctx.shadowColor = 'rgba(56,189,248,0.9)'
    ctx.shadowBlur = reduced ? 6 : 18
    const body = ctx.createRadialGradient(-3, -3, 2, 0, 0, BIRD_R + 2)
    body.addColorStop(0, '#e0f2fe')
    body.addColorStop(1, '#38bdf8')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2)
    ctx.fill()
    // Wing.
    const wing = wingRef.current > 0 ? -0.6 : 0.3
    ctx.shadowBlur = 0
    ctx.fillStyle = '#0ea5e9'
    ctx.beginPath()
    ctx.ellipse(-2, 2, BIRD_R * 0.6, BIRD_R * 0.36, wing, 0, Math.PI * 2)
    ctx.fill()
    // Eye + beak.
    ctx.fillStyle = '#0b1120'
    ctx.beginPath()
    ctx.arc(BIRD_R * 0.42, -BIRD_R * 0.28, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f59e0b'
    ctx.beginPath()
    ctx.moveTo(BIRD_R * 0.7, 0)
    ctx.lineTo(BIRD_R * 1.25, -3)
    ctx.lineTo(BIRD_R * 1.25, 4)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    ctx.restore() // undo shake transform

    // Death flash overlay.
    if (flashRef.current > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.6 * flashRef.current})`
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
      if (dt > 2.5) dt = 2.5 // avoid huge jumps after a tab returns

      if (phaseRef.current === 'playing' && !g.over) {
        const flap = flapQueuedRef.current
        flapQueuedRef.current = false
        if (flap) {
          wingRef.current = 8
          play('flip')
        }
        const s = step(g, { dt, flap }, Math.random)
        gameRef.current = s

        if (s.events.scored) {
          play('eat')
          setScore(s.score)
          if (s.score > bestRef.current) {
            bestRef.current = s.score
            setBest(s.score)
            localStorage.setItem(storageKey, String(s.score))
            // 파이프를 지날 때마다 축하음을 내면 첫 판 내내 울린다. 플래그만 세우고
            // 축하는 게임오버에서 한 번.
            newBestRef.current = true
          }
        }
        if (s.events.crashed) {
          play(newBestRef.current ? 'win' : 'lose')
          setNewBest(newBestRef.current)
          flashRef.current = 1
          shakeRef.current = 10
          phaseRef.current = 'over'
          setPhase('over')
        }

        scrollRef.current += 2.6 * dt
        if (wingRef.current > 0) wingRef.current -= dt
      }

      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.06 * dt)
      if (shakeRef.current > 0) shakeRef.current = Math.max(0, shakeRef.current - 0.6 * dt)

      draw()
      rafRef.current = requestAnimationFrame(frame)
    },
    [draw, play, storageKey],
  )

  // ---- Responsive canvas (DPR + ResizeObserver) ----
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

  // ---- Flap / start ----
  const doFlap = useCallback(() => {
    const g = gameRef.current
    if (!g) return
    if (phaseRef.current === 'over') return
    if (phaseRef.current === 'idle') {
      phaseRef.current = 'playing'
      setPhase('playing')
    }
    flapQueuedRef.current = true
  }, [])

  const restart = useCallback(() => {
    gameRef.current = newGame()
    flapQueuedRef.current = false
    wingRef.current = 0
    flashRef.current = 0
    shakeRef.current = 0
    lastTsRef.current = 0
    phaseRef.current = 'idle'
    newBestRef.current = false
    setNewBest(false)
    setScore(0)
    setPhase('idle')
    draw()
  }, [draw])

  // ---- Init (client only, SSR-safe) ----
  useEffect(() => {
    setReady(true)
    gameRef.current = newGame()
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

  // ---- Keyboard (Space) ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp') {
        e.preventDefault()
        doFlap()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [doFlap])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      doFlap()
    },
    [doFlap],
  )

  const hint =
    phase === 'over'
      ? 'Press New Game to fly again.'
      : phase === 'idle'
        ? 'Tap, click, or press Space to flap and take off.'
        : 'Tap / click / Space to flap. Thread the gaps!'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: score, testId: 'score', float: true },
        { label: 'Best', value: best },
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
          data-testid="flappy-board"
          onPointerDown={onPointerDown}
          className="block h-full w-full cursor-pointer"
          style={{ touchAction: 'none' }}
          aria-label="Flappy game board — tap or press Space to flap"
        />
        <GameOverlay
          show={phase === 'over'}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Game over'}
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
