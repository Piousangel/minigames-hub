'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BALL_R,
  BRICK_H,
  BRICK_W,
  FIELD_H,
  FIELD_W,
  launch,
  movePaddleBy,
  movePaddleTo,
  newGame,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  ROWS,
  step,
  type BreakoutState,
} from '@/lib/games/breakout/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number // 1 → 0
  hue: number
}

interface Trail {
  x: number
  y: number
}

// 행별 색상(위쪽=난색, 아래쪽=한색)으로 깊이감을 준다.
function rowHue(row: number): number {
  return 8 + (row / Math.max(1, ROWS - 1)) * 210 // 8°(주황) → 218°(파랑)
}

export function GameBreakout({ storageKey }: { storageKey: string }) {
  const [best, setBest] = useState(0)
  const [hud, setHud] = useState({ score: 0, lives: 0 })
  const [phase, setPhase] = useState<'idle' | 'playing' | 'won' | 'over'>('idle')
  const [ready, setReady] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<BreakoutState | null>(null)
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)
  const keysRef = useRef<Set<string>>(new Set())
  const particlesRef = useRef<Particle[]>([])
  const trailRef = useRef<Trail[]>([])
  const paddleFlashRef = useRef(0)
  const cssSizeRef = useRef(FIELD_W)

  // ---- HUD 동기화 (프레임마다 값이 바뀔 때만 리렌더) ----
  const syncHud = useCallback((s: BreakoutState) => {
    setHud((prev) => (prev.score === s.score && prev.lives === s.lives ? prev : { score: s.score, lives: s.lives }))
    if (s.over) setPhase((p) => (p === 'over' ? p : 'over'))
    else if (s.won) setPhase((p) => (p === 'won' ? p : 'won'))
    if (s.score > 0) {
      setBest((b) => {
        if (s.score <= b) return b
        localStorage.setItem(storageKey, String(s.score))
        return s.score
      })
    }
  }, [storageKey])

  const spawnParticles = useCallback((x: number, y: number, hue: number) => {
    if (reducedRef.current) return
    const arr = particlesRef.current
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.4
      const sp = 1.2 + Math.random() * 2.6
      arr.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue })
    }
  }, [reducedRef])

  // ---- 게임 루프 ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const g = gameRef.current
    if (!canvas || !g) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const scale = (cssSizeRef.current / FIELD_W) * dpr
    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    // 배경
    ctx.clearRect(0, 0, FIELD_W, FIELD_H)
    const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H)
    bg.addColorStop(0, 'rgba(255,255,255,0.03)')
    bg.addColorStop(1, 'rgba(0,0,0,0.10)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)

    // 벽돌
    for (const b of g.bricks) {
      if (!b.alive) continue
      const hue = rowHue(b.row)
      const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + BRICK_H)
      grad.addColorStop(0, `hsl(${hue} 78% 62%)`)
      grad.addColorStop(1, `hsl(${hue} 70% 46%)`)
      ctx.fillStyle = grad
      roundRect(ctx, b.x, b.y, BRICK_W, BRICK_H, 4)
      ctx.fill()
      // 윗면 하이라이트로 깊이감
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      roundRect(ctx, b.x + 2, b.y + 2, BRICK_W - 4, 4, 2)
      ctx.fill()
    }

    // 파티클
    const reduced = reducedRef.current
    if (!reduced) {
      for (const p of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.fillStyle = `hsl(${p.hue} 80% 60%)`
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.5 * p.life + 0.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // 볼 트레일
    if (!reduced) {
      const tr = trailRef.current
      for (let i = 0; i < tr.length; i++) {
        const a = (i / tr.length) * 0.35
        ctx.globalAlpha = a
        ctx.fillStyle = '#fbbf24'
        ctx.beginPath()
        ctx.arc(tr[i].x, tr[i].y, BALL_R * (0.4 + (i / tr.length) * 0.6), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // 패들
    const flash = paddleFlashRef.current > 0
    ctx.save()
    ctx.shadowColor = 'rgba(245,158,11,0.7)'
    ctx.shadowBlur = flash ? 22 : 12
    ctx.fillStyle = flash ? '#fde68a' : '#f59e0b'
    roundRect(ctx, g.paddleX - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 6)
    ctx.fill()
    ctx.restore()

    // 볼(글로우)
    ctx.save()
    ctx.shadowColor = 'rgba(255,255,255,0.9)'
    ctx.shadowBlur = 14
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(g.ball.x, g.ball.y, BALL_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, [reducedRef])

  const frame = useCallback((ts: number) => {
    const g = gameRef.current
    if (!g) return
    const last = lastTsRef.current || ts
    lastTsRef.current = ts
    let dt = (ts - last) / (1000 / 60)
    if (dt > 2.5) dt = 2.5 // 탭 복귀 등에서의 큰 점프 방지

    // 화살표 패들 이동
    let s = g
    const keys = keysRef.current
    if (keys.has('ArrowLeft')) s = movePaddleBy(s, -PADDLE_SPEED * dt)
    if (keys.has('ArrowRight')) s = movePaddleBy(s, PADDLE_SPEED * dt)

    const prevLives = s.lives
    s = step(s, { dt })
    gameRef.current = s

    // 이벤트 → 사운드/주스
    const ev = s.events
    if (ev.brokeBrick) {
      spawnParticles(ev.brokeBrick.x, ev.brokeBrick.y, rowHue(ev.brokeBrick.row))
      play('eat')
    }
    if (ev.paddleHit) {
      paddleFlashRef.current = 6
      play('flip')
    }
    if (ev.wallHit) play('move')
    if (ev.lostLife) {
      play('lose')
      trailRef.current = []
      if (s.lives > 0 && prevLives > s.lives) {
        // 생명은 남았고 다음 발사 대기 → phase는 playing 유지
      }
    }
    if (ev.won) play('win')

    // 트레일 갱신
    if (!reducedRef.current && s.launched && !s.over && !s.won) {
      const tr = trailRef.current
      tr.push({ x: s.ball.x, y: s.ball.y })
      if (tr.length > 10) tr.shift()
    }

    // 파티클 갱신
    if (!reducedRef.current) {
      const ps = particlesRef.current
      for (const p of ps) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 0.12 * dt
        p.life -= 0.045 * dt
      }
      particlesRef.current = ps.filter((p) => p.life > 0)
    }
    if (paddleFlashRef.current > 0) paddleFlashRef.current -= dt

    syncHud(s)
    draw()
    rafRef.current = requestAnimationFrame(frame)
  }, [draw, play, reducedRef, spawnParticles, syncHud])

  // ---- 캔버스 크기(반응형 + DPR) ----
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

  // ---- 초기화(클라이언트 전용) ----
  const restart = useCallback(() => {
    gameRef.current = newGame()
    particlesRef.current = []
    trailRef.current = []
    paddleFlashRef.current = 0
    lastTsRef.current = 0
    setHud({ score: 0, lives: gameRef.current.lives })
    setPhase('idle')
    draw()
  }, [draw])

  useEffect(() => {
    setReady(true)
    gameRef.current = newGame()
    setHud({ score: 0, lives: gameRef.current.lives })
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) ? stored : 0)
    resize()
    rafRef.current = requestAnimationFrame(frame)
    const ro = new ResizeObserver(resize)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
    // 마운트 시 1회. frame/resize는 안정적인 useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- 발사 ----
  const doLaunch = useCallback(() => {
    const g = gameRef.current
    if (!g || g.over || g.won) return
    if (!g.launched) {
      gameRef.current = launch(g, Math.random)
      setPhase('playing')
    }
  }, [])

  // ---- 포인터(마우스/터치)로 패들 조작 ----
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gameRef.current
    const canvas = canvasRef.current
    if (!g || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const fx = ((e.clientX - rect.left) / rect.width) * FIELD_W
    gameRef.current = movePaddleTo(g, fx)
  }, [])

  const onPointerDown = useCallback(() => doLaunch(), [doLaunch])

  // ---- 키보드 ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        keysRef.current.add(e.key)
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        doLaunch()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [doLaunch])

  const hint =
    phase === 'over'
      ? 'Press New Game to play again.'
      : phase === 'won'
        ? 'Cleared! Press New Game for another round.'
        : 'Move with your mouse or ← →. Space / click to launch.'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: hud.score, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Lives', value: hud.lives },
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
          data-testid="breakout-board"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          className="block h-full w-full cursor-pointer"
          style={{ touchAction: 'none' }}
          aria-label="Breakout game board"
        />
        <GameOverlay show={phase === 'won'} variant="win" title="You cleared it!" testId="game-over">
          <p className="text-fg-muted">Score: {hud.score}</p>
          <GameButton onClick={restart} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
        <GameOverlay show={phase === 'over'} variant="lose" title="Game over" testId="game-over">
          <p className="text-fg-muted">Score: {hud.score}</p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
