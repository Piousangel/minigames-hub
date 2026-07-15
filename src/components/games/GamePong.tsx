'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BALL_R,
  clampPaddle,
  cpuTrack,
  FIELD_H,
  FIELD_W,
  newGame,
  PADDLE_LEN,
  PADDLE_THICK,
  PLAYER_X,
  step,
  WIN_SCORE,
  type Difficulty,
  type PongState,
} from '@/lib/games/pong/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

interface Trail {
  x: number
  y: number
}

const KEY_PADDLE_SPEED = 9 // 화살표 한 프레임당 패들 이동량(논리 단위)

export function GamePong({ storageKey }: { storageKey: string }) {
  const [best, setBest] = useState(0)
  const [hud, setHud] = useState({ player: 0, cpu: 0 })
  const [phase, setPhase] = useState<'playing' | 'won' | 'lost'>('playing')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [ready, setReady] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<PongState | null>(null)
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)
  const keysRef = useRef<Set<string>>(new Set())
  const trailRef = useRef<Trail[]>([])
  const playerFlashRef = useRef(0)
  const cpuFlashRef = useRef(0)
  const cssSizeRef = useRef(FIELD_W)
  const difficultyRef = useRef<Difficulty>('easy')
  const playerTargetRef = useRef(FIELD_H / 2) // 마우스/키보드가 갱신하는 목표 y

  // ---- HUD 동기화 (값이 바뀔 때만 리렌더) ----
  const syncHud = useCallback((s: PongState) => {
    setHud((prev) =>
      prev.player === s.playerScore && prev.cpu === s.cpuScore ? prev : { player: s.playerScore, cpu: s.cpuScore },
    )
    if (s.over) {
      if (s.winner === 'player') {
        setPhase((p) => (p === 'won' ? p : 'won'))
        setBest((b) => {
          const next = b + 1
          localStorage.setItem(storageKey, String(next))
          return next
        })
      } else {
        setPhase((p) => (p === 'lost' ? p : 'lost'))
      }
    }
  }, [storageKey])

  // ---- 그리기 ----
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

    // 센터 네트(점선)
    ctx.strokeStyle = 'rgba(140,220,255,0.25)'
    ctx.lineWidth = 3
    ctx.setLineDash([10, 12])
    ctx.beginPath()
    ctx.moveTo(FIELD_W / 2, 8)
    ctx.lineTo(FIELD_W / 2, FIELD_H - 8)
    ctx.stroke()
    ctx.setLineDash([])

    const reduced = reducedRef.current

    // 볼 트레일(네온)
    if (!reduced) {
      const tr = trailRef.current
      for (let i = 0; i < tr.length; i++) {
        const a = (i / tr.length) * 0.4
        ctx.globalAlpha = a
        ctx.fillStyle = '#22d3ee'
        ctx.beginPath()
        ctx.arc(tr[i].x, tr[i].y, BALL_R * (0.35 + (i / tr.length) * 0.65), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // 패들
    drawPaddle(ctx, PLAYER_X, g.playerY, 'rgba(56,189,248,0.75)', playerFlashRef.current > 0 ? '#bae6fd' : '#38bdf8')
    drawPaddle(
      ctx,
      FIELD_W - PLAYER_X - PADDLE_THICK,
      g.cpuY,
      'rgba(244,114,182,0.7)',
      cpuFlashRef.current > 0 ? '#fbcfe8' : '#f472b6',
    )

    // 볼(글로우)
    ctx.save()
    ctx.shadowColor = 'rgba(255,255,255,0.9)'
    ctx.shadowBlur = 16
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(g.ball.x, g.ball.y, BALL_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, [reducedRef])

  // ---- 게임 루프 ----
  const frame = useCallback((ts: number) => {
    const g = gameRef.current
    if (!g) {
      rafRef.current = requestAnimationFrame(frame)
      return
    }
    const last = lastTsRef.current || ts
    lastTsRef.current = ts
    let dt = (ts - last) / (1000 / 60)
    if (dt > 2.5) dt = 2.5 // 탭 복귀 등 큰 점프 방지

    if (!g.over) {
      // 화살표로 목표 y 갱신
      const keys = keysRef.current
      if (keys.has('ArrowUp')) playerTargetRef.current = clampPaddle(playerTargetRef.current - KEY_PADDLE_SPEED * dt)
      if (keys.has('ArrowDown')) playerTargetRef.current = clampPaddle(playerTargetRef.current + KEY_PADDLE_SPEED * dt)

      let s = cpuTrack(g, dt, difficultyRef.current)
      s = step(s, { dt, playerPaddleY: playerTargetRef.current })
      gameRef.current = s

      const ev = s.events
      if (ev.wallHit) play('move')
      if (ev.paddleHit) {
        play('flip')
        if (s.ball.vx > 0) playerFlashRef.current = 6
        else cpuFlashRef.current = 6
      }
      if (ev.scored) {
        trailRef.current = []
        if (!s.over) play(ev.scored === 'player' ? 'eat' : 'error')
      }
      if (s.over) play(s.winner === 'player' ? 'win' : 'lose')

      // 트레일 갱신
      if (!reducedRef.current && !s.over) {
        const tr = trailRef.current
        tr.push({ x: s.ball.x, y: s.ball.y })
        if (tr.length > 12) tr.shift()
      }
      if (playerFlashRef.current > 0) playerFlashRef.current -= dt
      if (cpuFlashRef.current > 0) cpuFlashRef.current -= dt

      syncHud(s)
    }

    draw()
    rafRef.current = requestAnimationFrame(frame)
  }, [draw, play, reducedRef, syncHud])

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

  // ---- New Game ----
  const restart = useCallback(() => {
    gameRef.current = newGame(Math.random)
    trailRef.current = []
    playerFlashRef.current = 0
    cpuFlashRef.current = 0
    playerTargetRef.current = FIELD_H / 2
    lastTsRef.current = 0
    setHud({ player: 0, cpu: 0 })
    setPhase('playing')
    draw()
  }, [draw])

  // ---- 초기화(클라이언트 전용) ----
  useEffect(() => {
    setReady(true)
    gameRef.current = newGame(Math.random)
    playerTargetRef.current = FIELD_H / 2
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

  // ---- 포인터(마우스/터치)로 패들 조작 ----
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const fy = ((e.clientY - rect.top) / rect.height) * FIELD_H
    playerTargetRef.current = clampPaddle(fy)
  }, [])

  // ---- 키보드 ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
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

  const setDiff = useCallback((d: Difficulty) => {
    difficultyRef.current = d
    setDifficulty(d)
  }, [])

  const hint =
    phase === 'won'
      ? 'You win! Press New Game to play again.'
      : phase === 'lost'
        ? 'CPU wins. Press New Game to try again.'
        : `Move with your mouse or ↑ ↓. First to ${WIN_SCORE} wins.`

  return (
    <GameShell
      stats={[
        { label: 'You', value: hud.player, testId: 'score', float: true },
        { label: 'CPU', value: hud.cpu },
        { label: 'Wins', value: best },
      ]}
      headerExtra={
        <div
          role="group"
          aria-label="CPU difficulty"
          className="flex items-center gap-1 rounded-lg border border-border bg-surface/80 p-0.5"
        >
          {(['easy', 'hard'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDiff(d)}
              aria-pressed={difficulty === d}
              className={`btn-press rounded-md px-2 py-1 text-xs font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
                difficulty === d ? 'bg-accent/20 text-accent' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      }
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
          data-testid="pong-board"
          onPointerMove={onPointerMove}
          className="block h-full w-full cursor-pointer"
          style={{ touchAction: 'none' }}
          aria-label="Pong game board"
        />
        <GameOverlay show={phase === 'won'} variant="win" title="You win!" testId="game-over">
          <p className="text-fg-muted">
            {hud.player} – {hud.cpu}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
        <GameOverlay show={phase === 'lost'} variant="lose" title="CPU wins" testId="game-over">
          <p className="text-fg-muted">
            {hud.player} – {hud.cpu}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}

function drawPaddle(ctx: CanvasRenderingContext2D, x: number, cy: number, glow: string, fill: string) {
  ctx.save()
  ctx.shadowColor = glow
  ctx.shadowBlur = 14
  ctx.fillStyle = fill
  roundRect(ctx, x, cy - PADDLE_LEN / 2, PADDLE_THICK, PADDLE_LEN, 6)
  ctx.fill()
  ctx.restore()
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
