'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BUBBLE_R,
  DEATH_ROW,
  FIELD_H,
  FIELD_W,
  MAX_ROWS,
  SHOOTER,
  cellX,
  cellY,
  colsInRow,
  newGame,
  shoot,
  traceShot,
  type BubbleState,
  type ColoredCell,
} from '@/lib/games/bubbleshooter/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { updateBestScore } from '@/lib/bestScore'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// 네온 팔레트(색 인덱스 0..4). 채움/글로우 모두 여기서 파생한다.
const COLORS = ['#22d3ee', '#f472b6', '#facc15', '#4ade80', '#a78bfa']
const GLOW = ['rgba(34,211,238,0.75)', 'rgba(244,114,182,0.75)', 'rgba(250,204,21,0.75)', 'rgba(74,222,128,0.75)', 'rgba(167,139,250,0.75)']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number // 1 → 0
  color: string
}

interface Shot {
  path: { x: number; y: number }[]
  color: number
  i: number // 현재 경로 인덱스
  angle: number
}

const SHOT_SPEED = 7 // 프레임당 진행할 경로 인덱스 수(경로 간격 2px → ≈14px/frame)

export function GameBubbleShooter({ storageKey }: { storageKey: string }) {
  const [best, setBest] = useState(0)
  const [isBest, setIsBest] = useState(false)
  const [hud, setHud] = useState({ score: 0 })
  const [phase, setPhase] = useState<'playing' | 'won' | 'over'>('playing')
  const [ready, setReady] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<BubbleState | null>(null)
  const rafRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const shotRef = useRef<Shot | null>(null)
  const aimAngleRef = useRef(0) // 수직 기준(우측 +)
  const guidePathRef = useRef<{ x: number; y: number }[]>([])
  const cssSizeRef = useRef(FIELD_W)
  const bestRef = useRef(0)

  // ---- HUD/Best 동기화 ----
  const syncHud = useCallback(
    (s: BubbleState) => {
      setHud((prev) => (prev.score === s.score ? prev : { score: s.score }))
      return updateBestScore(s.score, bestRef, storageKey, setBest)
    },
    [storageKey],
  )

  const spawnPops = useCallback(
    (cells: ColoredCell[]) => {
      if (reducedRef.current) return
      const arr = particlesRef.current
      for (const c of cells) {
        const cx = cellX(c.row, c.col)
        const cy = cellY(c.row)
        const color = COLORS[c.color] ?? '#fff'
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 * i) / 8 + Math.random() * 0.5
          const sp = 1.5 + Math.random() * 3
          arr.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color })
        }
      }
    },
    [reducedRef],
  )

  // ---- 조준선 갱신(포인터 이동 시) ----
  const updateGuide = useCallback(() => {
    const g = gameRef.current
    if (!g || g.over || g.cleared) {
      guidePathRef.current = []
      return
    }
    guidePathRef.current = traceShot(g, aimAngleRef.current).path
  }, [])

  // ---- 렌더 ----
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
    bg.addColorStop(1, 'rgba(0,0,0,0.12)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)

    // 바닥선(위험선)
    const deathY = cellY(DEATH_ROW)
    ctx.save()
    ctx.strokeStyle = 'rgba(248,113,113,0.35)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 8])
    ctx.beginPath()
    ctx.moveTo(0, deathY)
    ctx.lineTo(FIELD_W, deathY)
    ctx.stroke()
    ctx.restore()

    const reduced = reducedRef.current
    const active = !g.over && !g.cleared

    // 조준선(점선) — 발사 중이 아닐 때만
    if (active && !shotRef.current && guidePathRef.current.length > 1) {
      const gp = guidePathRef.current
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 2
      ctx.setLineDash([2, 10])
      ctx.beginPath()
      ctx.moveTo(gp[0].x, gp[0].y)
      for (let i = 1; i < gp.length; i += 3) ctx.lineTo(gp[i].x, gp[i].y)
      ctx.stroke()
      ctx.restore()
    }

    // 그리드 버블
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < colsInRow(r); c++) {
        const color = g.grid[r][c]
        if (color === null) continue
        drawBubble(ctx, cellX(r, c), cellY(r), COLORS[color], GLOW[color], reduced)
      }
    }

    // 파티클
    if (!reduced) {
      for (const p of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3 * p.life + 0.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // 발사대 & 대기 버블
    const shot = shotRef.current
    if (active || shot) {
      // 다음 버블 미리보기(우측)
      drawBubble(ctx, SHOOTER.x + BUBBLE_R * 2.2, SHOOTER.y, COLORS[g.next], GLOW[g.next], reduced, 0.7)
      // 발사대 링
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(SHOOTER.x, SHOOTER.y, BUBBLE_R + 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // 날아가는 버블 / 대기 중인 현재 버블
    if (shot) {
      const p = shot.path[Math.min(shot.i, shot.path.length - 1)]
      drawBubble(ctx, p.x, p.y, COLORS[shot.color], GLOW[shot.color], reduced)
    } else if (active) {
      drawBubble(ctx, SHOOTER.x, SHOOTER.y, COLORS[g.current], GLOW[g.current], reduced)
    }
  }, [reducedRef])

  // ---- 발사 착지 처리 ----
  const land = useCallback(() => {
    const g = gameRef.current
    const shot = shotRef.current
    if (!g || !shot) return
    const res = shoot(g, shot.angle, Math.random)
    gameRef.current = res
    shotRef.current = null

    if (res.events.popped.length) {
      spawnPops(res.events.popped)
      spawnPops(res.events.dropped)
      play('eat')
    } else {
      play('move')
    }

    const beat = syncHud(res)
    if (res.cleared) {
      setPhase('won')
      play('win')
      recordResult(storageKey.replace(/^best:/, ''), { won: true })
    } else if (res.over) {
      setPhase('over')
      setIsBest((v) => v || beat)
      play('lose')
      recordResult(storageKey.replace(/^best:/, ''), { won: false })
    }
    updateGuide()
  }, [play, spawnPops, syncHud, updateGuide, storageKey])

  // ---- 게임 루프 ----
  const frame = useCallback(() => {
    const g = gameRef.current
    if (g) {
      // 투사체 전진
      const shot = shotRef.current
      if (shot) {
        shot.i += SHOT_SPEED
        if (shot.i >= shot.path.length - 1) land()
      }
      // 파티클 갱신
      if (!reducedRef.current) {
        const ps = particlesRef.current
        for (const p of ps) {
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.14
          p.life -= 0.03
        }
        particlesRef.current = ps.filter((p) => p.life > 0)
      }
      draw()
    }
    rafRef.current = requestAnimationFrame(frame)
  }, [draw, land, reducedRef])

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

  // ---- 새 게임 ----
  const restart = useCallback(() => {
    gameRef.current = newGame(Math.random)
    particlesRef.current = []
    shotRef.current = null
    aimAngleRef.current = 0
    setHud({ score: 0 })
    setPhase('playing')
    setIsBest(false)
    updateGuide()
    draw()
  }, [draw, updateGuide])

  // ---- 초기화(클라이언트 전용) ----
  useEffect(() => {
    setReady(true)
    gameRef.current = newGame(Math.random)
    const stored = Number(localStorage.getItem(storageKey))
    const b = Number.isFinite(stored) ? stored : 0
    bestRef.current = b
    setBest(b)
    resize()
    updateGuide()
    rafRef.current = requestAnimationFrame(frame)
    const ro = new ResizeObserver(resize)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
    // 마운트 시 1회. frame/resize/updateGuide는 안정적인 useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- 조준(포인터) ----
  const aimTo = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const px = ((clientX - rect.left) / rect.width) * FIELD_W
      const py = ((clientY - rect.top) / rect.height) * FIELD_H
      const dx = px - SHOOTER.x
      const dy = py - SHOOTER.y
      // 수직(위) 기준 각도. 위쪽 방향만 허용.
      aimAngleRef.current = Math.atan2(dx, -dy)
      updateGuide()
    },
    [updateGuide],
  )

  const doShoot = useCallback(() => {
    const g = gameRef.current
    if (!g || g.over || g.cleared || shotRef.current) return
    const trace = traceShot(g, aimAngleRef.current)
    if (!trace.cell || trace.path.length < 2) return
    shotRef.current = { path: trace.path, color: g.current, i: 0, angle: aimAngleRef.current }
    guidePathRef.current = []
    play('flip')
  }, [play])

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => aimTo(e.clientX, e.clientY),
    [aimTo],
  )
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      aimTo(e.clientX, e.clientY)
      doShoot()
    },
    [aimTo, doShoot],
  )

  // ---- 키보드(Space 발사) ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        doShoot()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [doShoot])

  const hint =
    phase === 'over'
      ? 'The bubbles reached the line. Press New Game to try again.'
      : phase === 'won'
        ? 'Board cleared! Press New Game for another round.'
        : 'Aim with your mouse or finger. Click / tap / Space to shoot. Match 3+ to pop.'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: hud.score, testId: 'score', float: true },
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
          data-testid="bubble-board"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          className="block h-full w-full cursor-crosshair"
          style={{ touchAction: 'none' }}
          aria-label="Bubble Shooter game board"
        />
        <GameOverlay show={phase === 'won'} variant="win" title="Board cleared!" testId="game-over">
          <p className="text-fg-muted">Score: {hud.score}</p>
          <GameButton onClick={restart} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
        <GameOverlay show={phase === 'over'} variant={isBest ? 'win' : 'lose'} title={isBest ? 'New best!' : 'Game over'} testId="game-over">
          <p className="text-fg-muted">Score: {hud.score}</p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  glow: string,
  reduced: boolean,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  if (!reduced) {
    ctx.shadowColor = glow
    ctx.shadowBlur = 12
  }
  const grad = ctx.createRadialGradient(x - BUBBLE_R * 0.3, y - BUBBLE_R * 0.35, BUBBLE_R * 0.2, x, y, BUBBLE_R)
  grad.addColorStop(0, 'rgba(255,255,255,0.85)')
  grad.addColorStop(0.35, color)
  grad.addColorStop(1, color)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, BUBBLE_R - 1.5, 0, Math.PI * 2)
  ctx.fill()
  // 테두리
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1
  ctx.stroke()
  // 하이라이트
  ctx.globalAlpha = alpha * 0.5
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.beginPath()
  ctx.arc(x - BUBBLE_R * 0.32, y - BUBBLE_R * 0.35, BUBBLE_R * 0.22, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
