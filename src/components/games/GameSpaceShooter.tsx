'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BULLET_H,
  BULLET_W,
  ENEMY_BULLET_H,
  ENEMY_BULLET_W,
  ENEMY_H,
  ENEMY_ROWS,
  ENEMY_W,
  FIELD_H,
  FIELD_W,
  newGame,
  PLAYER_CY,
  PLAYER_H,
  PLAYER_SPEED,
  PLAYER_W,
  step,
  type SpaceState,
} from '@/lib/games/spaceshooter/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordFinish } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number // 1 → 0
  hue: number
}

interface Star {
  x: number
  y: number
  z: number // 0..1 (깊이 → 밝기/속도)
}

// 행별 색상(위쪽=난색, 아래쪽=한색)으로 깊이감을 준다.
function rowHue(row: number): number {
  return 320 - (row / Math.max(1, ENEMY_ROWS - 1)) * 190 // 320°(마젠타) → 130°(그린)
}

export function GameSpaceShooter({ storageKey }: { storageKey: string }) {
  const [best, setBest] = useState(0)
  const [hud, setHud] = useState({ score: 0, lives: 0, wave: 1 })
  const [phase, setPhase] = useState<'playing' | 'over'>('playing')
  const [isBest, setIsBest] = useState(false)
  const [ready, setReady] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<SpaceState | null>(null)
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)
  const keysRef = useRef<Set<string>>(new Set())
  const pointerRef = useRef<{ active: boolean; x: number }>({ active: false, x: FIELD_W / 2 })
  const autoFireRef = useRef(false)
  const particlesRef = useRef<Particle[]>([])
  const starsRef = useRef<Star[]>([])
  const shakeRef = useRef(0)
  const cssSizeRef = useRef(FIELD_W)
  const bestRef = useRef(0)

  // ---- HUD 동기화 (값이 바뀔 때만 리렌더) ----
  const syncHud = useCallback(
    (s: SpaceState) => {
      setHud((prev) =>
        prev.score === s.score && prev.lives === s.lives && prev.wave === s.wave
          ? prev
          : { score: s.score, lives: s.lives, wave: s.wave },
      )
      if (s.over) setPhase((p) => (p === 'over' ? p : 'over'))
      if (s.score > 0 && s.score > bestRef.current) {
        bestRef.current = s.score
        localStorage.setItem(storageKey, String(s.score))
        setBest(s.score)
      }
    },
    [storageKey],
  )

  const spawnExplosion = useCallback(
    (x: number, y: number, hue: number) => {
      if (reducedRef.current) return
      const arr = particlesRef.current
      const n = 12
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.5
        const sp = 1.4 + Math.random() * 3.2
        arr.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue })
      }
    },
    [reducedRef],
  )

  const seedStars = useCallback(() => {
    const stars: Star[] = []
    for (let i = 0; i < 70; i++) {
      stars.push({ x: Math.random() * FIELD_W, y: Math.random() * FIELD_H, z: Math.random() })
    }
    starsRef.current = stars
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

    const reduced = reducedRef.current

    // 화면 흔들림
    let sx = 0
    let sy = 0
    if (!reduced && shakeRef.current > 0) {
      const m = shakeRef.current
      sx = (Math.random() - 0.5) * m
      sy = (Math.random() - 0.5) * m
    }
    ctx.save()
    ctx.translate(sx, sy)

    // 배경
    ctx.clearRect(-4, -4, FIELD_W + 8, FIELD_H + 8)
    const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H)
    bg.addColorStop(0, 'rgba(10,6,24,0.45)')
    bg.addColorStop(1, 'rgba(2,2,10,0.65)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)

    // 스타필드
    if (!reduced) {
      for (const s of starsRef.current) {
        ctx.globalAlpha = 0.25 + s.z * 0.6
        ctx.fillStyle = '#cbd5ff'
        const r = 0.5 + s.z * 1.4
        ctx.fillRect(s.x, s.y, r, r)
      }
      ctx.globalAlpha = 1
    }

    // 적
    for (const e of g.enemies) {
      if (!e.alive) continue
      const hue = rowHue(e.row)
      ctx.save()
      ctx.shadowColor = `hsl(${hue} 90% 60%)`
      ctx.shadowBlur = reduced ? 0 : 10
      ctx.fillStyle = `hsl(${hue} 85% 60%)`
      drawInvader(ctx, e.x, e.y, ENEMY_W, ENEMY_H)
      ctx.restore()
    }

    // 파티클(폭발)
    if (!reduced) {
      for (const p of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.fillStyle = `hsl(${p.hue} 90% 62%)`
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.6 * p.life + 0.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // 플레이어 탄(레이저 글로우)
    ctx.save()
    ctx.shadowColor = 'rgba(56,189,248,0.9)'
    ctx.shadowBlur = reduced ? 0 : 12
    ctx.fillStyle = '#7dd3fc'
    for (const b of g.bullets) {
      roundRect(ctx, b.x - BULLET_W / 2, b.y - BULLET_H / 2, BULLET_W, BULLET_H, 2)
      ctx.fill()
    }
    ctx.restore()

    // 적 탄
    ctx.save()
    ctx.shadowColor = 'rgba(248,113,113,0.9)'
    ctx.shadowBlur = reduced ? 0 : 10
    ctx.fillStyle = '#fca5a5'
    for (const b of g.enemyBullets) {
      roundRect(ctx, b.x - ENEMY_BULLET_W / 2, b.y - ENEMY_BULLET_H / 2, ENEMY_BULLET_W, ENEMY_BULLET_H, 2)
      ctx.fill()
    }
    ctx.restore()

    // 플레이어 함선
    ctx.save()
    ctx.shadowColor = 'rgba(94,234,212,0.85)'
    ctx.shadowBlur = reduced ? 0 : 14
    ctx.fillStyle = '#5eead4'
    drawShip(ctx, g.playerX, PLAYER_CY)
    ctx.restore()

    ctx.restore()
  }, [reducedRef])

  const frame = useCallback(
    (ts: number) => {
      const g = gameRef.current
      if (!g) return
      const last = lastTsRef.current || ts
      lastTsRef.current = ts
      let dt = (ts - last) / (1000 / 60)
      if (dt > 2.5) dt = 2.5 // 탭 복귀 등 큰 점프 방지

      const reduced = reducedRef.current

      if (!g.over) {
        const keys = keysRef.current

        // 포인터 드래그가 우선: 함선을 목표점으로 부드럽게 스냅하고 엔진 이동은 끔.
        let cur = g
        let moveDir: -1 | 0 | 1 = 0
        if (pointerRef.current.active) {
          cur = { ...g, playerX: snapToward(g.playerX, pointerRef.current.x, PLAYER_SPEED * dt * 2) }
        } else {
          if (keys.has('ArrowLeft')) moveDir = -1
          if (keys.has('ArrowRight')) moveDir = 1
        }

        const fire = keys.has(' ') || keys.has('Spacebar') || autoFireRef.current

        const s = step(cur, { dt, moveDir, fire }, Math.random)
        gameRef.current = s

        // 이벤트 → 사운드/주스
        const ev = s.events
        if (ev.fired) play(Math.random() < 0.5 ? 'flip' : 'move')
        if (ev.kills.length > 0) {
          for (const k of ev.kills) spawnExplosion(k.x, k.y, rowHue(k.row))
          play(ev.kills.length > 1 ? 'merge' : 'eat')
          if (!reduced) shakeRef.current = Math.min(shakeRef.current + 1.5, 5)
        }
        if (ev.lostLife) {
          play('lose')
          if (!reduced) shakeRef.current = 10
        }
        if (ev.waveCleared) {
          play('win')
          if (!reduced) shakeRef.current = 6
        }
        if (ev.over) {
          play('lose')
          setIsBest(s.score > 0 && s.score >= bestRef.current)
          recordFinish(storageKey.replace(/^best:/, ''))
        }

        syncHud(s)
      }

      // 파티클 갱신
      if (!reduced) {
        const ps = particlesRef.current
        for (const p of ps) {
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.vy += 0.06 * dt
          p.life -= 0.03 * dt
        }
        particlesRef.current = ps.filter((p) => p.life > 0)

        // 스타필드 스크롤
        for (const s of starsRef.current) {
          s.y += (0.3 + s.z * 1.1) * dt
          if (s.y > FIELD_H) {
            s.y = 0
            s.x = Math.random() * FIELD_W
          }
        }
        if (shakeRef.current > 0) shakeRef.current = Math.max(0, shakeRef.current - 0.5 * dt)
      }

      draw()
      rafRef.current = requestAnimationFrame(frame)
    },
    [draw, play, reducedRef, spawnExplosion, syncHud, storageKey],
  )

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
    gameRef.current = newGame()
    particlesRef.current = []
    shakeRef.current = 0
    lastTsRef.current = 0
    autoFireRef.current = false
    pointerRef.current.active = false
    seedStars()
    setHud({ score: 0, lives: gameRef.current.lives, wave: 1 })
    setIsBest(false)
    setPhase('playing')
    draw()
  }, [draw, seedStars])

  // ---- 초기화(클라이언트 전용) ----
  useEffect(() => {
    setReady(true)
    gameRef.current = newGame()
    setHud({ score: 0, lives: gameRef.current.lives, wave: 1 })
    const stored = Number(localStorage.getItem(storageKey))
    const b = Number.isFinite(stored) ? stored : 0
    bestRef.current = b
    setBest(b)
    seedStars()
    resize()
    rafRef.current = requestAnimationFrame(frame)
    const ro = new ResizeObserver(resize)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
    // 마운트 시 1회. frame/resize/seedStars는 안정적 useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- 포인터(마우스/터치 드래그) ----
  const pointerX = useCallback((clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return FIELD_W / 2
    const rect = canvas.getBoundingClientRect()
    return ((clientX - rect.left) / rect.width) * FIELD_W
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const g = gameRef.current
      if (!g || g.over) return
      pointerRef.current = { active: true, x: pointerX(e.clientX) }
      autoFireRef.current = true // 누르는 동안 자동 발사
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [pointerX],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!pointerRef.current.active) return
      pointerRef.current.x = pointerX(e.clientX)
    },
    [pointerX],
  )

  const endPointer = useCallback(() => {
    pointerRef.current.active = false
    autoFireRef.current = false
  }, [])

  // ---- 키보드 ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        keysRef.current.add(e.key)
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
  }, [])

  const hint =
    phase === 'over'
      ? 'Press New Game to play again.'
      : 'Move with ← → or drag. Space / hold to fire. Clear the waves!'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: hud.score, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Lives', value: hud.lives },
        { label: 'Wave', value: hud.wave },
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
          data-testid="space-board"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          className="block h-full w-full cursor-pointer"
          style={{ touchAction: 'none' }}
          aria-label="Space Shooter game board"
        />
        <GameOverlay
          show={phase === 'over'}
          variant={isBest ? 'win' : 'lose'}
          title={isBest ? 'New best!' : 'Game over'}
          testId="game-over"
        >
          <p className="text-fg-muted">
            Score: {hud.score} · Wave {hud.wave}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}

// 드래그 목표를 향해 부드럽게 이동(과도 이동 방지).
function snapToward(cur: number, target: number, maxStep: number): number {
  const clamped = Math.max(PLAYER_W / 2, Math.min(FIELD_W - PLAYER_W / 2, target))
  const diff = clamped - cur
  if (Math.abs(diff) <= maxStep) return clamped
  return cur + Math.sign(diff) * maxStep
}

// 플레이어 삼각 함선.
function drawShip(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const hw = PLAYER_W / 2
  const hh = PLAYER_H / 2
  ctx.beginPath()
  ctx.moveTo(cx, cy - hh) // 코
  ctx.lineTo(cx + hw, cy + hh)
  ctx.lineTo(cx + hw * 0.4, cy + hh)
  ctx.lineTo(cx, cy + hh * 0.4)
  ctx.lineTo(cx - hw * 0.4, cy + hh)
  ctx.lineTo(cx - hw, cy + hh)
  ctx.closePath()
  ctx.fill()
}

// 인베이더 실루엣(둥근 몸통 + 다리).
function drawInvader(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  const x = cx - w / 2
  const y = cy - h / 2
  roundRect(ctx, x + w * 0.12, y, w * 0.76, h * 0.62, 5)
  ctx.fill()
  // 눈
  ctx.save()
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  const eye = w * 0.11
  ctx.fillRect(cx - w * 0.22, y + h * 0.2, eye, eye)
  ctx.fillRect(cx + w * 0.11, y + h * 0.2, eye, eye)
  ctx.restore()
  // 다리
  ctx.fillRect(x + w * 0.16, y + h * 0.6, w * 0.16, h * 0.28)
  ctx.fillRect(x + w * 0.68, y + h * 0.6, w * 0.16, h * 0.28)
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
