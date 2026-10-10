'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  drop,
  FIELD_W,
  newGame,
  step,
  type Block,
  type StackState,
} from '@/lib/games/towerstack/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// ---- View geometry (engine units; x maps 1:1 to FIELD_W) ----
const VIEW_H = 440 // board height in engine units (portrait board)
const BLOCK_H = 26 // pixel height of one stacked block
const ANCHOR_Y = VIEW_H * 0.3 // screen y where the moving block's top rests
const CAM_LERP = 0.16 // camera smoothing per frame (dt = 1)

type Phase = 'playing' | 'over'

interface Sliver {
  x: number
  width: number
  y: number // screen y at spawn
  vy: number
  vx: number
  life: number // 1 → 0
}

/** hsl neon hue for a given stack level. */
const hueFor = (level: number) => (level * 26 + 200) % 360

// World top-edge y for a stack level (0 = base). Up is negative.
const worldTopOf = (level: number) => -level * BLOCK_H

// Camera target keeps the moving block's level (tower.length) near ANCHOR_Y.
const cameraTargetFor = (g: StackState) => worldTopOf(g.tower.length) - ANCHOR_Y

export function GameTowerStack({ storageKey }: { storageKey: string }) {
  const [best, setBest] = useState(0)
  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<Phase>('playing')
  const [ready, setReady] = useState(false)
  const [newBest, setNewBest] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<StackState | null>(null)
  const phaseRef = useRef<Phase>('playing')
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)
  const cssWRef = useRef<number>(FIELD_W)

  const cameraRef = useRef<number>(0) // current world-top y mapped to screen 0
  const camTargetRef = useRef<number>(0)
  const sliversRef = useRef<Sliver[]>([])
  const flashRef = useRef<number>(0) // perfect-drop flash (1 → 0)
  const comboRef = useRef<number>(0) // consecutive perfect drops
  const shakeRef = useRef<number>(0) // miss screen-shake
  const bestRef = useRef<number>(0)
  const newBestRef = useRef<boolean>(false)

  // ---- Draw ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const g = gameRef.current
    if (!canvas || !g) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = reducedRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const scale = (cssWRef.current / FIELD_W) * dpr
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.clearRect(0, 0, FIELD_W, VIEW_H)

    ctx.save()
    if (!reduced && shakeRef.current > 0) {
      const m = shakeRef.current
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
    }

    // Background — deep neon night with a subtle vertical gradient.
    const bg = ctx.createLinearGradient(0, 0, 0, VIEW_H)
    bg.addColorStop(0, 'rgba(30,20,60,0.35)')
    bg.addColorStop(1, 'rgba(6,10,26,0.55)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, FIELD_W, VIEW_H)

    const cam = cameraRef.current
    const screenTop = (level: number) => worldTopOf(level) - cam

    const drawBlock = (b: Block, level: number, opts: { moving?: boolean } = {}) => {
      const yTop = screenTop(level)
      if (yTop + BLOCK_H < -4 || yTop > VIEW_H + 4) return
      const hue = hueFor(level)
      const grad = ctx.createLinearGradient(b.x, yTop, b.x, yTop + BLOCK_H)
      grad.addColorStop(0, `hsl(${hue} 90% 62%)`)
      grad.addColorStop(1, `hsl(${hue} 85% 46%)`)
      ctx.save()
      ctx.shadowColor = `hsl(${hue} 95% 60% / 0.75)`
      ctx.shadowBlur = reduced ? 0 : opts.moving ? 20 : 12
      ctx.fillStyle = grad
      roundRect(ctx, b.x, yTop, b.width, BLOCK_H - 3, 5)
      ctx.fill()
      // Bright top lip for a beveled, glassy read.
      ctx.shadowBlur = 0
      ctx.fillStyle = `hsl(${hue} 100% 78% / 0.9)`
      roundRect(ctx, b.x + 2, yTop + 2, Math.max(0, b.width - 4), 3, 2)
      ctx.fill()
      ctx.restore()
    }

    // Placed tower (base → top).
    g.tower.forEach((b, i) => drawBlock(b, i))

    // Moving block (one level above the top placed block).
    if (g.moving && !g.over) drawBlock(g.moving, g.tower.length, { moving: true })

    // Falling slivers.
    for (const s of sliversRef.current) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, s.life)
      ctx.fillStyle = 'hsl(0 0% 100% / 0.85)'
      ctx.shadowColor = 'rgba(255,255,255,0.6)'
      ctx.shadowBlur = reduced ? 0 : 8
      roundRect(ctx, s.x, s.y, s.width, BLOCK_H - 3, 4)
      ctx.fill()
      ctx.restore()
    }

    ctx.restore() // undo shake

    // Perfect-drop flash — a bright frame + combo tag.
    if (flashRef.current > 0) {
      const a = flashRef.current
      ctx.save()
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * a})`
      ctx.lineWidth = 6
      ctx.strokeRect(3, 3, FIELD_W - 6, VIEW_H - 6)
      if (comboRef.current > 1) {
        ctx.globalAlpha = a
        ctx.fillStyle = '#fef08a'
        ctx.font = 'bold 22px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.shadowColor = 'rgba(250,204,21,0.9)'
        ctx.shadowBlur = reduced ? 0 : 12
        ctx.fillText(`PERFECT ×${comboRef.current}`, FIELD_W / 2, 40)
      }
      ctx.restore()
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
      const reduced = reducedRef.current

      const cur = phaseRef.current === 'playing' && !g.over ? step(g, dt) : g
      gameRef.current = cur

      // Camera pan toward its target (snap when reduced motion).
      camTargetRef.current = cameraTargetFor(cur)
      if (reduced) {
        cameraRef.current = camTargetRef.current
      } else {
        cameraRef.current += (camTargetRef.current - cameraRef.current) * Math.min(1, CAM_LERP * dt)
      }

      // Integrate slivers.
      if (sliversRef.current.length > 0) {
        sliversRef.current = sliversRef.current
          .map((s) => ({
            ...s,
            x: s.x + s.vx * dt,
            y: s.y + s.vy * dt,
            vy: s.vy + 0.9 * dt,
            life: s.life - 0.02 * dt,
          }))
          .filter((s) => s.life > 0 && s.y < VIEW_H + 60)
      }

      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.05 * dt)
      if (shakeRef.current > 0) shakeRef.current = Math.max(0, shakeRef.current - 0.6 * dt)

      draw()
      rafRef.current = requestAnimationFrame(frame)
    },
    [draw, reducedRef],
  )

  // ---- Responsive canvas ----
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const cssW = wrap.clientWidth
    cssWRef.current = cssW
    const cssH = (cssW * VIEW_H) / FIELD_W
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.height = `${cssH}px`
    draw()
  }, [draw])

  // ---- Drop ----
  const doDrop = useCallback(() => {
    const g = gameRef.current
    if (!g || phaseRef.current !== 'playing' || g.over) return

    // Capture the moving block level before it is consumed (for slivers).
    const level = g.tower.length
    const next = drop(g)
    gameRef.current = next
    const ev = next.events

    const reduced = reducedRef.current
    const yTop = worldTopOf(level) - cameraRef.current

    if (ev.missed) {
      comboRef.current = 0
      shakeRef.current = 12
      if (!reduced) {
        for (const sl of ev.slices) {
          sliversRef.current.push({ x: sl.x, width: sl.width, y: yTop, vy: 1.5, vx: 0, life: 1 })
        }
      }
      phaseRef.current = 'over'
      setPhase('over')
      if (newBestRef.current) {
        setNewBest(true)
        play('win')
      } else {
        play('lose')
      }
      recordResult(storageKey.replace(/^best:/, ''))
      return
    }

    setScore(next.score)
    if (next.score > bestRef.current) {
      bestRef.current = next.score
      setBest(next.score)
      localStorage.setItem(storageKey, String(next.score))
      newBestRef.current = true
    }

    if (ev.perfect) {
      comboRef.current += 1
      flashRef.current = 1
      play('match')
    } else {
      comboRef.current = 0
      play('flip')
      if (!reduced) {
        for (const sl of ev.slices) {
          const toRight = sl.x > FIELD_W / 2
          sliversRef.current.push({
            x: sl.x,
            width: sl.width,
            y: yTop,
            vy: 1,
            vx: toRight ? 1.6 : -1.6,
            life: 1,
          })
        }
      }
    }
  }, [play, reducedRef, storageKey])

  const restart = useCallback(() => {
    const g = newGame()
    gameRef.current = g
    lastTsRef.current = 0
    sliversRef.current = []
    flashRef.current = 0
    shakeRef.current = 0
    comboRef.current = 0
    newBestRef.current = false
    cameraRef.current = cameraTargetFor(g)
    camTargetRef.current = cameraRef.current
    phaseRef.current = 'playing'
    setScore(0)
    setNewBest(false)
    setPhase('playing')
    draw()
  }, [draw])

  // ---- Init (client only, SSR-safe) ----
  useEffect(() => {
    setReady(true)
    const g = newGame()
    gameRef.current = g
    cameraRef.current = cameraTargetFor(g)
    camTargetRef.current = cameraRef.current
    const stored = Number(localStorage.getItem(storageKey))
    const b = Number.isFinite(stored) && stored > 0 ? stored : 0
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

  // ---- Keyboard (Space / Enter to drop) ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault()
        doDrop()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [doDrop])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      doDrop()
    },
    [doDrop],
  )

  const hint =
    phase === 'over'
      ? 'Press New Game to stack again.'
      : 'Tap, click, or press Space to drop the block. Line it up — perfect drops grow it back.'

  return (
    <GameShell
      stats={[
        { label: 'Height', value: score, testId: 'score', float: true },
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
        className="anim-board-in relative mx-auto w-full touch-none overflow-hidden rounded-xl bg-surface"
        style={{ aspectRatio: `${FIELD_W} / ${VIEW_H}` }}
      >
        <canvas
          ref={canvasRef}
          data-testid="stack-board"
          onPointerDown={onPointerDown}
          className="block h-full w-full cursor-pointer"
          style={{ touchAction: 'none' }}
          aria-label="Tower Stack board — tap or press Space to drop the moving block"
        />
        <GameOverlay
          show={phase === 'over'}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Game over'}
          testId="game-over"
        >
          <p className="text-fg-muted">
            Height: {score} · Best: {best}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Stack again
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
