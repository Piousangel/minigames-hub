'use client'

import { useEffect, useRef } from 'react'

const COLORS = ['#f59e0b', '#fbbf24', '#f97316', '#e8eaed', '#38bdf8', '#a78bfa']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rot: number
  vr: number
}

/**
 * Canvas confetti burst — drawn procedurally, no image assets.
 * Renders nothing under prefers-reduced-motion (respects the constraint while
 * keeping the win state itself visible via the overlay).
 */
export function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const count = 120
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.35,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * -9 - 3,
      size: Math.random() * 6 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    }))

    const gravity = 0.28
    const drag = 0.99
    let raf = 0
    const start = performance.now()

    const frame = (now: number) => {
      const elapsed = now - start
      ctx.clearRect(0, 0, w, h)
      let alive = false
      for (const p of particles) {
        p.vy += gravity
        p.vx *= drag
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        if (p.y < h + 20) alive = true
        const fade = Math.max(0, 1 - elapsed / 2200)
        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
      if (alive && elapsed < 2400) {
        raf = requestAnimationFrame(frame)
      } else {
        ctx.clearRect(0, 0, w, h)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [active])

  if (!active) return null
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
