'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  advance,
  BLOCK_H,
  currentScore,
  FIELD_H,
  FIELD_W,
  LANE_W,
  LANES,
  live,
  MARKER_CY,
  MARKER_H,
  MARKER_W,
  meterPct,
  newSession,
  type AdvanceInput,
  type Session,
} from '@/lib/games/backspace/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Phase = 'idle' | 'playing' | 'over'

const MS_PER_TICK = 1000 / 60
const MILESTONE = 500 // distance between survival ticks

function laneCenterX(lane: number): number {
  return lane * LANE_W + LANE_W / 2
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

function ClutchBadge({ mult }: { mult: number }) {
  return (
    <div
      key={mult}
      className="anim-clutch-pop rounded-lg border border-neon-cyan/60 bg-surface/80 px-3 py-1.5 text-sm font-bold text-neon-cyan shadow-[0_0_12px_rgba(56,189,248,0.5)]"
    >
      <span className="text-fg-muted">Clutch</span> ×{mult}
    </div>
  )
}

export function GameBackspace({ storageKey }: { storageKey: string }) {
  const [best, setBest] = useState(0)
  const [score, setScore] = useState(0)
  const [clutchMult, setClutchMult] = useState(1)
  const newBestRef = useRef(false)
  const [newBest, setNewBest] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [ready, setReady] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)
  const accRef = useRef<number>(0)

  // Input
  const pendingMoveRef = useRef<-1 | 0 | 1>(0)
  const spaceHeldRef = useRef(false)
  const buttonHeldRef = useRef(false)
  const boardPointersRef = useRef<Set<number>>(new Set())

  // Juice
  const flashRef = useRef(0) // death flash 1 -> 0
  const shakeRef = useRef(0) // screen-shake frames
  const clutchFlashRef = useRef(0) // clutch chime flash 1 -> 0
  const ghostLaneRef = useRef(2) // marker lane left behind on rewind
  const ghostAlphaRef = useRef(0) // ghost-trail fade 1 -> 0
  const markerXRef = useRef(laneCenterX(2)) // lerped marker x (visual)
  const rewindGlowRef = useRef(0) // scrub tint 0..1

  // Bookkeeping
  const cssSizeRef = useRef(FIELD_W)
  const bestRef = useRef(0)
  const prevMeterEmptyRef = useRef(false)
  const milestoneRef = useRef(0)

  // ---- Draw ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const session = sessionRef.current
    if (!canvas || !session) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const scale = (cssSizeRef.current / FIELD_W) * dpr
    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    const reduced = reducedRef.current
    const t = live(session)
    ctx.clearRect(0, 0, FIELD_W, FIELD_H)

    ctx.save()
    if (!reduced && shakeRef.current > 0) {
      const m = shakeRef.current
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
    }

    // 1. Background + lane grid.
    const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H)
    bg.addColorStop(0, 'rgba(28,18,54,0.4)')
    bg.addColorStop(1, 'rgba(6,10,26,0.6)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(120,120,220,0.12)'
    ctx.beginPath()
    for (let l = 0; l <= LANES; l++) {
      const x = l * LANE_W
      ctx.moveTo(x, 0)
      ctx.lineTo(x, FIELD_H)
    }
    ctx.stroke()

    // 2. Obstacle rows (neon-red blocks).
    for (const row of t.rows) {
      for (let lane = 0; lane < LANES; lane++) {
        if (!((row.blocked >> lane) & 1)) continue
        const x = lane * LANE_W
        ctx.save()
        ctx.shadowColor = 'rgba(244,63,94,0.7)'
        ctx.shadowBlur = reduced ? 0 : 14
        const grad = ctx.createLinearGradient(x, row.y, x, row.y + BLOCK_H)
        grad.addColorStop(0, '#fb7185')
        grad.addColorStop(1, '#e11d48')
        ctx.fillStyle = grad
        roundRect(ctx, x + 4, row.y + 4, LANE_W - 8, BLOCK_H - 8, 8)
        ctx.fill()
        ctx.restore()
      }
    }

    // 3. Ghost trail — where the marker was before rewinding (readability at speed).
    if (!reduced && ghostAlphaRef.current > 0.01) {
      const gx = laneCenterX(ghostLaneRef.current)
      ctx.save()
      ctx.globalAlpha = ghostAlphaRef.current * 0.5
      ctx.setLineDash([6, 5])
      ctx.lineWidth = 2
      ctx.strokeStyle = '#38bdf8'
      roundRect(ctx, gx - MARKER_W / 2, MARKER_CY - MARKER_H / 2, MARKER_W, MARKER_H, 10)
      ctx.stroke()
      ctx.restore()
    }

    // 4. Marker (neon-cyan), lerped between lanes for smoothness.
    const target = laneCenterX(t.markerLane)
    if (reduced) markerXRef.current = target
    else markerXRef.current += (target - markerXRef.current) * 0.35
    const mx = markerXRef.current
    ctx.save()
    ctx.shadowColor = 'rgba(56,189,248,0.9)'
    ctx.shadowBlur = reduced ? 6 : 18
    const body = ctx.createLinearGradient(0, MARKER_CY - MARKER_H / 2, 0, MARKER_CY + MARKER_H / 2)
    body.addColorStop(0, '#e0f2fe')
    body.addColorStop(1, '#38bdf8')
    ctx.fillStyle = body
    roundRect(ctx, mx - MARKER_W / 2, MARKER_CY - MARKER_H / 2, MARKER_W, MARKER_H, 10)
    ctx.fill()
    ctx.restore()

    ctx.restore() // undo shake

    // 5. Rewind overlay tint (time running backward).
    if (!reduced && rewindGlowRef.current > 0.01) {
      const a = rewindGlowRef.current
      const vg = ctx.createRadialGradient(FIELD_W / 2, FIELD_H / 2, 60, FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.7)
      vg.addColorStop(0, 'rgba(56,189,248,0)')
      vg.addColorStop(1, `rgba(56,189,248,${0.22 * a})`)
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, FIELD_W, FIELD_H)
      ctx.strokeStyle = `rgba(224,242,254,${0.06 * a})`
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let y = 0; y < FIELD_H; y += 4) {
        ctx.moveTo(0, y)
        ctx.lineTo(FIELD_W, y)
      }
      ctx.stroke()
    }

    // 6. Fuel meter — prominent bar across the top.
    const pct = meterPct(session)
    const barH = 12
    const barY = 8
    const barX = 10
    const barW = FIELD_W - 20
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    roundRect(ctx, barX, barY, barW, barH, 6)
    ctx.fill()
    const low = pct < 0.2
    const pulse = low && !reduced ? 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 120)) : 1
    const fill = pct > 0.5 ? '#22d3ee' : pct > 0.2 ? '#f59e0b' : '#f43f5e'
    ctx.save()
    ctx.globalAlpha = low ? pulse : 1
    ctx.shadowColor = fill
    ctx.shadowBlur = reduced ? 0 : 10
    ctx.fillStyle = fill
    roundRect(ctx, barX, barY, Math.max(0, barW * pct), barH, 6)
    ctx.fill()
    ctx.restore()

    // 7. Clutch flash.
    if (clutchFlashRef.current > 0.01) {
      ctx.fillStyle = `rgba(56,189,248,${0.28 * clutchFlashRef.current})`
      ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    }

    // 8. Death flash.
    if (flashRef.current > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${0.6 * flashRef.current})`
      ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    }

    // Idle prompt.
    if (phaseRef.current === 'idle') {
      ctx.fillStyle = 'rgba(224,242,254,0.85)'
      ctx.font = '600 18px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Tap a side to start', FIELD_W / 2, MARKER_CY - 70)
    }
  }, [reducedRef])

  // ---- Fixed-timestep loop ----
  const frame = useCallback(
    (ts: number) => {
      const session = sessionRef.current
      if (!session) {
        rafRef.current = requestAnimationFrame(frame)
        return
      }

      if (phaseRef.current === 'playing') {
        const last = lastTsRef.current || ts
        lastTsRef.current = ts
        accRef.current += ts - last
        if (accRef.current > 5 * MS_PER_TICK) accRef.current = 5 * MS_PER_TICK

        let cur = session
        while (accRef.current >= MS_PER_TICK) {
          accRef.current -= MS_PER_TICK
          const move = pendingMoveRef.current
          pendingMoveRef.current = 0
          const rewind =
            spaceHeldRef.current || buttonHeldRef.current || boardPointersRef.current.size >= 2
          const input: AdvanceInput = { move, rewind }

          const prevMode = cur.mode
          const prevLane = live(cur).markerLane
          const next = advance(cur, input)
          cur = next
          sessionRef.current = next
          const ev = next.events

          // Sounds.
          if (ev.moved) play('move')
          if (prevMode !== 'rewinding' && next.mode === 'rewinding') play('flip')
          if (ev.clutch) play('match')
          if (ev.banked) play('merge')
          if (ev.autoSaved) play('flag')
          if (ev.meterEmpty && !prevMeterEmptyRef.current) play('error')
          prevMeterEmptyRef.current = ev.meterEmpty

          // Juice.
          if (ev.rewound || ev.autoSaved || ev.meterEmpty) {
            rewindGlowRef.current = 1
            ghostLaneRef.current = prevLane
            ghostAlphaRef.current = 1
          }
          if (ev.clutch || ev.banked) clutchFlashRef.current = 1

          // Score + best.
          const s = currentScore(next)
          setScore(s)
          if (s > bestRef.current) {
            bestRef.current = s
            setBest(s)
            try {
              localStorage.setItem(storageKey, String(s))
            } catch {
              /* storage unavailable — non-fatal */
            }
            // 여기는 60fps 틱 루프다. 점수가 매 틱 오르므로 여기서 축하음을 내면
            // 첫 판 내내 초당 60번 울린다. 플래그만 세우고 축하는 게임오버에서 한 번.
            newBestRef.current = true
          }
          setClutchMult(next.clutchMult)

          // Survival milestone tick.
          const lane = live(next)
          const mstone = Math.floor(lane.scoreDistance / MILESTONE)
          if (!next.over && mstone > milestoneRef.current) {
            milestoneRef.current = mstone
            play('eat')
          }

          if (ev.crashed) {
            play('lose')
            flashRef.current = 1
            shakeRef.current = 12
          }

          if (next.over) {
            phaseRef.current = 'over'
            setPhase('over')
            // 축하는 여기서 한 번만. ev.crashed의 'lose'는 충돌 자체에 대한 피드백이라
            // 치명타가 아닐 때도 울리므로 그대로 둔다.
            if (newBestRef.current) {
              setNewBest(true)
              play('win')
            }
            recordResult(storageKey.replace(/^best:/, ''))
            break
          }
        }
      } else {
        lastTsRef.current = ts
      }

      // Decay juice timers once per animation frame.
      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.05)
      if (shakeRef.current > 0) shakeRef.current = Math.max(0, shakeRef.current - 0.6)
      if (clutchFlashRef.current > 0) clutchFlashRef.current = Math.max(0, clutchFlashRef.current - 0.06)
      if (ghostAlphaRef.current > 0) ghostAlphaRef.current = Math.max(0, ghostAlphaRef.current - 0.05)
      // Rewind glow tracks whether we are currently scrubbing.
      const scrubbing = sessionRef.current?.mode === 'rewinding'
      if (scrubbing) rewindGlowRef.current = Math.min(1, rewindGlowRef.current + 0.2)
      else if (rewindGlowRef.current > 0) rewindGlowRef.current = Math.max(0, rewindGlowRef.current - 0.12)

      draw()
      rafRef.current = requestAnimationFrame(frame)
    },
    [draw, play, storageKey],
  )

  // ---- Responsive canvas ----
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const cssW = wrap.clientWidth
    cssSizeRef.current = cssW
    const cssH = cssW * (FIELD_H / FIELD_W)
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.height = `${cssH}px`
    draw()
  }, [draw])

  const startIfIdle = useCallback(() => {
    if (phaseRef.current === 'idle') {
      phaseRef.current = 'playing'
      lastTsRef.current = 0
      accRef.current = 0
      setPhase('playing')
    }
  }, [])

  const restart = useCallback(() => {
    sessionRef.current = newSession(Date.now() >>> 0)
    pendingMoveRef.current = 0
    spaceHeldRef.current = false
    buttonHeldRef.current = false
    boardPointersRef.current.clear()
    flashRef.current = 0
    shakeRef.current = 0
    clutchFlashRef.current = 0
    ghostAlphaRef.current = 0
    rewindGlowRef.current = 0
    markerXRef.current = laneCenterX(2)
    prevMeterEmptyRef.current = false
    milestoneRef.current = 0
    newBestRef.current = false
    setNewBest(false)
    lastTsRef.current = 0
    accRef.current = 0
    phaseRef.current = 'idle'
    setScore(0)
    setClutchMult(1)
    setPhase('idle')
    draw()
  }, [draw])

  // ---- Init (client only) ----
  useEffect(() => {
    setReady(true)
    sessionRef.current = newSession(Date.now() >>> 0)
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

  // ---- Keyboard ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        e.preventDefault()
        if (!e.repeat) {
          pendingMoveRef.current = -1
          startIfIdle()
        }
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        e.preventDefault()
        if (!e.repeat) {
          pendingMoveRef.current = 1
          startIfIdle()
        }
      } else if (k === ' ' || k === 'Spacebar') {
        e.preventDefault()
        spaceHeldRef.current = true
        startIfIdle()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') spaceHeldRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [startIfIdle])

  // ---- Board pointers (lane taps + 2-finger rewind) ----
  const onBoardPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (phaseRef.current === 'over') return
      boardPointersRef.current.add(e.pointerId)
      startIfIdle()
      // Only the first finger taps a lane; extra fingers are for scrubbing.
      if (boardPointersRef.current.size === 1) {
        const rect = e.currentTarget.getBoundingClientRect()
        const mid = rect.left + rect.width / 2
        pendingMoveRef.current = e.clientX < mid ? -1 : 1
      }
    },
    [startIfIdle],
  )
  const onBoardPointerEnd = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    boardPointersRef.current.delete(e.pointerId)
  }, [])

  const onButtonDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      buttonHeldRef.current = true
      startIfIdle()
    },
    [startIfIdle],
  )
  const onButtonUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    buttonHeldRef.current = false
  }, [])

  const hint =
    phase === 'over'
      ? 'Press New Game to run again.'
      : phase === 'idle'
        ? 'Arrows/A·D or tap a side to change lanes. Hold Space (or the BACKSPACE button) to rewind time.'
        : 'Thread the gaps. Hold Space to scrub backward and re-pick your lane — but the meter drains!'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: score, testId: 'score', float: true },
        { label: 'Best', value: best },
      ]}
      headerExtra={clutchMult > 1 ? <ClutchBadge mult={clutchMult} /> : undefined}
      onNewGame={restart}
      newGameDisabled={!ready}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <div
        ref={wrapRef}
        className="anim-board-in relative aspect-[5/7] w-full touch-none overflow-hidden rounded-xl bg-surface"
      >
        <canvas
          ref={canvasRef}
          data-testid="backspace-board"
          onPointerDown={onBoardPointerDown}
          onPointerUp={onBoardPointerEnd}
          onPointerCancel={onBoardPointerEnd}
          onPointerLeave={onBoardPointerEnd}
          className="block w-full cursor-pointer"
          style={{ touchAction: 'none' }}
          aria-label="Backspace game board — arrow keys or tap to change lanes, hold Space to rewind"
        />
        <button
          type="button"
          onPointerDown={onButtonDown}
          onPointerUp={onButtonUp}
          onPointerCancel={onButtonUp}
          onPointerLeave={onButtonUp}
          aria-label="Hold to rewind time"
          className="btn-press absolute bottom-3 left-1/2 -translate-x-1/2 touch-none rounded-full border border-neon-cyan/60 bg-surface/85 px-6 py-2.5 text-sm font-bold text-neon-cyan shadow-[0_0_14px_rgba(56,189,248,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          style={{ touchAction: 'none' }}
        >
          ⌫ BACKSPACE
        </button>
        <GameOverlay
          show={phase === 'over'}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Game over'}
          testId="game-over"
        >
          <p className="text-fg-muted">
            Distance: {score} · Best: {best}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
      <style>{`
        @keyframes clutch-pop {
          0% {
            transform: scale(0.7);
            opacity: 0;
          }
          50% {
            transform: scale(1.12);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .anim-clutch-pop {
          animation: clutch-pop 0.32s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .anim-clutch-pop {
            animation: none;
          }
        }
      `}</style>
    </GameShell>
  )
}
