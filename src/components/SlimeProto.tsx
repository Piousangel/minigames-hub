'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PlayZone, inPlayZone } from '@/components/game-shell/PlayZone'
import { useSlimeAudio } from '@/lib/sound/useSlimeAudio'
import { simulate } from '@/lib/games/slime/engine'
import { drawAcorn, drawBurr, drawFlowerGoal, drawIslandFloors, drawNest, drawSky, drawTerrain } from '@/lib/games/slime/draw'
import { Fx, starPath } from '@/lib/games/slime/fx'
import { SLIME_STAGES } from '@/lib/games/slime/stages'
import { capInk, dist, dropClose, polyLength, processStroke } from '@/lib/games/slime/strokePipeline'
import { BOARD_H, BOARD_W, CONST, DEFAULT_PHYSICS, type Outcome, type Pt } from '@/lib/games/slime/types'

type Phase = 'draw' | 'run' | 'done'
interface Rec {
  stage: string
  outcome: Outcome | 'cancel'
  acorns: number
  ink: number
  pts: number[][]
  ms: number
}

const OUTCOME_TEXT: Record<Outcome, string> = {
  nest: '도착!',
  spiked: '밤송이에 닿았어요',
  fell: '떨어졌어요',
  stalled: '멈췄어요',
  timeout: '시간이 다 됐어요',
}
const TRACE_MS = 50 // 트레이스 한 칸 = 6스텝 = 50ms

/** 비공개 시험판: 그리기 → 시뮬 재생 → 결과. 사이트에 연결하지 않았고, 플레이 기록을 복사해 난이도 조정에 쓴다. */
export function SlimeProto() {
  const [si, setSi] = useState(0)
  const stage = SLIME_STAGES[si]
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [w, setW] = useState(360)
  const [phase, setPhase] = useState<Phase>('draw')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState('')
  const [muted, setMuted] = useState(false)
  const [inKakao, setInKakao] = useState(false)
  const { unlock, play } = useSlimeAudio(muted)
  const gotAcorns = useRef<Set<number>>(new Set())
  const lockScroll = useCallback((on: boolean) => {
    const root = document.documentElement
    root.style.overflow = on ? 'hidden' : ''
    root.style.overscrollBehavior = on ? 'none' : ''
  }, [])
  const raw = useRef<Pt[]>([])
  const line = useRef<Pt[] | null>(null)
  const ghost = useRef<Pt[] | null>(null)
  const trace = useRef<Pt[]>([])
  const runStart = useRef(0)
  const result = useRef<{ outcome: Outcome; acorns: number } | null>(null)
  const recs = useRef<Rec[]>([])
  const drawStart = useRef(0)
  const downAt = useRef(0)
  const finished = useRef(false) // 한 번의 재생에서 결과 기록이 두 번 쌓이지 않게(rAF가 effect 정리 전에 또 돌 수 있다)
  const [, force] = useState(0)
  const img = useRef<HTMLImageElement | null>(null)
  const imgHappy = useRef<HTMLImageElement | null>(null)
  const imgDizzy = useRef<HTMLImageElement | null>(null)
  const imgBg = useRef<HTMLImageElement | null>(null)
  const imgIsland = useRef<HTMLImageElement | null>(null)
  const imgFlower = useRef<HTMLImageElement | null>(null)
  const fx = useRef(new Fx())
  const lastT = useRef(0)
  const popAt = useRef<Map<number, number>>(new Map())
  const celebrateAt = useRef(0)
  const failAt = useRef(0)
  const shakeUntil = useRef(0)
  const flashUntil = useRef(0)
  const vel = useRef<Pt>({ x: 0, y: 0 })
  const prevSpeed = useRef(0)
  const squash = useRef(0)

  // 카카오톡 같은 인앱 브라우저는 touch-action을 무시해 그리는 중에 화면이 스크롤되거나 당겨진다 →
  // 그리기 구역의 touchstart/touchmove를 passive:false로 취소하고, 그리는 동안 페이지 스크롤을 잠근다(스크롤 띠는 구역 밖이라 영향 없음).
  useEffect(() => {
    const zone = wrap.current?.querySelector<HTMLElement>('[data-play-zone]')
    if (!zone) return
    const stop = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault()
    }
    zone.addEventListener('touchstart', stop, { passive: false })
    zone.addEventListener('touchmove', stop, { passive: false })
    return () => {
      zone.removeEventListener('touchstart', stop)
      zone.removeEventListener('touchmove', stop)
      lockScroll(false)
    }
  }, [lockScroll, w])
  useEffect(() => {
    setInKakao(/KAKAOTALK/i.test(navigator.userAgent))
    try {
      setMuted(localStorage.getItem('slime:muted') === '1')
    } catch {
      /* 저장소를 못 써도 소리는 켜진 채로 */
    }
  }, [])
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    // 한 화면 안에 보드+컨트롤이 들어오게 높이로도 제한(스크롤할 일을 줄여 그리다 스크롤하는 사고를 막는다). 위쪽 크롬(헤더·제목·잉크 막대) ≈ 200px, 아래 컨트롤 ≈ 130px
    const update = () => {
      const byHeight = Math.floor(((window.innerHeight - 330) * BOARD_W) / BOARD_H)
      setW(Math.max(260, Math.min(BOARD_W, Math.floor(el.clientWidth), byHeight)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    const load = (src: string) => {
      const im = new Image()
      im.src = src
      return im
    }
    img.current = load('/art/mallang-idle.webp')
    imgHappy.current = load('/art/mallang-happy.webp')
    imgDizzy.current = load('/art/mallang-dizzy.webp')
    // 뿅 착지 에셋 재사용(같은 세계관): 노을 하늘·풀 섬·꽃
    imgBg.current = load('/art/plop-bg.webp')
    imgIsland.current = load('/art/plop-island-wide.webp')
    imgFlower.current = load('/art/plop-flower.webp')
    fx.current.calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    return () => ro.disconnect()
  }, [])

  const reset = useCallback((next?: number) => {
    if (next !== undefined) {
      setSi(next)
      ghost.current = null // 다른 스테이지로 가면 이전 스테이지의 선을 남기지 않는다
    }
    raw.current = []
    line.current = null
    trace.current = []
    result.current = null
    gotAcorns.current = new Set()
    popAt.current = new Map()
    celebrateAt.current = 0
    failAt.current = 0
    fx.current.clear()
    setPhase('draw')
    setMsg('')
  }, [])

  // 렌더 루프
  useEffect(() => {
    let raf = 0
    const c = canvas.current
    if (!c) return
    const loop = (t: number) => {
      const dpr = window.devicePixelRatio || 1
      const bw = Math.round(w * dpr)
      const bh = Math.round(w * (BOARD_H / BOARD_W) * dpr)
      if (c.width !== bw) c.width = bw
      if (c.height !== bh) c.height = bh
      const g = c.getContext('2d')
      if (g) paint(g, t)
      raf = requestAnimationFrame(loop)
    }
    const paint = (g: CanvasRenderingContext2D, t: number) => {
      const dt = Math.min(0.05, Math.max(0, (t - lastT.current) / 1000))
      lastT.current = t
      fx.current.update(dt)
      const k = (w / BOARD_W) * (window.devicePixelRatio || 1)
      g.setTransform(k, 0, 0, k, 0, 0)
      // 부딪히면 화면이 살짝 흔들린다(움직임 줄이기 설정이면 생략)
      const shake = shakeUntil.current > t && !fx.current.calm ? ((shakeUntil.current - t) / 350) * 5 : 0
      if (shake > 0) g.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2)
      drawSky(g, imgBg.current, t, BOARD_W, BOARD_H)
      g.lineCap = 'round'
      g.lineJoin = 'round'
      const islandsOk = drawIslandFloors(g, imgIsland.current, stage.terrain) // 바닥 = 풀 섬 그림
      drawTerrain(g, stage.terrain, islandsOk) // 벽 = 바위 기둥(그림이 아직 없으면 바닥도 선으로)
      // 스폰 금지 링
      g.setLineDash([4, 6])
      g.strokeStyle = 'rgba(91,58,30,0.45)'
      g.lineWidth = 2
      g.beginPath()
      g.arc(stage.spawn.x, stage.spawn.y, CONST.SPAWN_BAN_R, 0, Math.PI * 2)
      g.stroke()
      g.setLineDash([])
      // 둥지(도착하면 빛남)·밤송이·도토리
      const celebrate = celebrateAt.current ? Math.max(0, 1 - (t - celebrateAt.current) / 1600) : 0
      if (!drawFlowerGoal(g, imgFlower.current, stage.nest, t, celebrate)) drawNest(g, stage.nest, t, celebrate)
      if (celebrate > 0) drawNest(g, stage.nest, t, celebrate) // 도착하면 꽃 주변이 따뜻하게 빛난다
      const alarm = failAt.current ? Math.max(0, 1 - (t - failAt.current) / 900) : 0
      stage.spikes.forEach((s, i) => drawBurr(g, s, t, i, result.current?.outcome === 'spiked' ? alarm : 0))
      stage.acorns.forEach((a, i) => {
        const pop = popAt.current.get(i)
        if (pop === undefined) drawAcorn(g, a, t, i)
        else {
          const q = (t - pop) / 380 // 먹으면 커지며 사라진다
          if (q < 1) drawAcorn(g, a, t, i, 1 + 0.9 * q, 1 - q)
        }
      })
      // 지난 시도(고스트)·내 선(분필: 은은한 빛 + 선명한 선)
      if (ghost.current && phase !== 'run') drawLine(g, ghost.current, 'rgba(91,58,30,0.28)', 5)
      const cur = line.current ?? (raw.current.length > 1 ? capInk(dropClose(raw.current), stage.ink) : null)
      if (cur) {
        drawLine(g, cur, '#5b3a1e', 10)
        drawLine(g, cur, '#fff3dc', 5.5)
      }
      // 말랑이
      let sp: Pt = stage.spawn
      let moving = false
      if (phase === 'run' || phase === 'done') {
        const tr = trace.current
        const el = Math.max(0, t - runStart.current - 500) / TRACE_MS
        if (tr.length) {
          const i = Math.min(tr.length - 1, Math.floor(el))
          const j = Math.min(tr.length - 1, i + 1)
          const f = Math.min(1, el - i)
          sp = phase === 'done' ? tr[tr.length - 1] : { x: tr[i].x + (tr[j].x - tr[i].x) * f, y: tr[i].y + (tr[j].y - tr[i].y) * f }
          if (phase === 'run' && j > i) {
            vel.current = { x: (tr[j].x - tr[i].x) / (TRACE_MS / 1000), y: (tr[j].y - tr[i].y) / (TRACE_MS / 1000) }
            moving = true
          }
          if (phase === 'run' && el >= tr.length - 1 && result.current) finish()
        }
      }
      if (phase === 'run') {
        stage.acorns.forEach((a, i) => {
          if (!gotAcorns.current.has(i) && dist(sp, a) < CONST.ACORN_R) {
            gotAcorns.current.add(i)
            popAt.current.set(i, t)
            play('acorn', gotAcorns.current.size)
            fx.current.sparks(a.x, a.y, 14, '#ffd86b', 150, 0.6)
            fx.current.ring(a.x, a.y, '#ffe9a0', 34, 0.45)
            fx.current.text(a.x, a.y - 16, '+100', '#ffe27a', 20, 0.9)
            if (typeof navigator !== 'undefined') navigator.vibrate?.(12)
          }
        })
      }
      const speed = Math.sqrt(vel.current.x ** 2 + vel.current.y ** 2)
      if (moving && speed > 140) fx.current.trail(sp.x, sp.y + 4)
      if (prevSpeed.current - speed > 160) squash.current = 1 // 부딪히거나 확 느려지면 찌그러진다
      squash.current *= 0.86
      prevSpeed.current = moving ? speed : 0
      drawSlime(g, sp, t, moving, speed)
      fx.current.draw(g)
      if (flashUntil.current > t && !fx.current.calm) {
        g.fillStyle = `rgba(255,70,70,${0.28 * ((flashUntil.current - t) / 300)})`
        g.fillRect(0, 0, BOARD_W, BOARD_H)
      }
    }
    const drawSlime = (g: CanvasRenderingContext2D, p: Pt, t: number, moving: boolean, speed: number) => {
      const out = phase === 'done' ? result.current?.outcome : undefined
      const happy = out === 'nest'
      const dizzy = phase === 'done' && !happy
      const im = (happy ? imgHappy.current : dizzy ? imgDizzy.current : img.current) ?? img.current
      let hop = 0
      let wob = 0
      if (happy && celebrateAt.current) {
        const q = (t - celebrateAt.current) / 1000
        hop = Math.abs(Math.sin(q * 9)) * 16 * Math.exp(-q * 2.2) // 통통 튄다
      }
      if (dizzy && failAt.current) wob = Math.sin((t - failAt.current) / 90) * 0.2 * Math.max(0, 1 - (t - failAt.current) / 1500)
      g.save()
      g.translate(p.x, p.y - hop)
      const stretch = moving ? Math.min(0.32, speed / 2200) : 0
      if (moving && speed > 30) {
        const ang = Math.atan2(vel.current.y, vel.current.x)
        g.rotate(ang)
        g.scale(1 + stretch, 1 / (1 + stretch)) // 빠를수록 진행 방향으로 늘어난다
        g.rotate(-ang)
        g.rotate(Math.max(-0.4, Math.min(0.4, vel.current.x / 500))) // 굴러가듯 기울어진다
      }
      g.rotate(wob)
      const sq = squash.current
      g.scale(1 + sq * 0.28, 1 - sq * 0.28)
      if (!moving && phase !== 'done') g.scale(1 + Math.sin(t / 380) * 0.025, 1 - Math.sin(t / 380) * 0.025) // 대기 중 숨쉬듯 말랑
      if (im?.complete && im.naturalWidth) g.drawImage(im, -22, -26, 44, 44)
      else {
        g.fillStyle = '#5fe0e8'
        g.beginPath()
        g.arc(0, 0, CONST.R, 0, Math.PI * 2)
        g.fill()
      }
      g.restore()
      if (dizzy && failAt.current && t - failAt.current < 1800) {
        // 어지러워서 머리 위에 별이 돈다
        g.fillStyle = '#ffe27a'
        for (let q = 0; q < 3; q++) {
          const a = t / 260 + (q * Math.PI * 2) / 3
          starPath(g, p.x + Math.cos(a) * 17, p.y - 26 + Math.sin(a) * 5, 4.2, a)
          g.fill()
        }
      }
    }
    const drawLine = (g: CanvasRenderingContext2D, pts: Pt[], col: string, wd: number) => {
      if (pts.length < 2) return
      g.strokeStyle = col
      g.lineWidth = wd
      g.beginPath()
      pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)))
      g.stroke()
    }
    const finish = () => {
      const r = result.current
      if (!r || phase !== 'run' || finished.current) return
      finished.current = true
      setPhase('done')
      play(r.outcome === 'nest' ? 'nest' : r.outcome === 'timeout' ? 'stalled' : r.outcome)
      const now = performance.now()
      const last = trace.current[trace.current.length - 1] ?? stage.spawn
      if (r.outcome === 'nest') {
        celebrateAt.current = now
        fx.current.confetti(stage.nest.x, stage.nest.y - 10, 48)
        fx.current.stars(stage.nest.x, stage.nest.y - 10, 10)
        fx.current.ring(stage.nest.x, stage.nest.y, '#ffd86b', 72, 0.75)
        fx.current.text(stage.nest.x, stage.nest.y - 46, r.acorns === 3 ? '완벽해요!' : '도착!', '#ffe27a', 24, 1.3)
        if (typeof navigator !== 'undefined') navigator.vibrate?.([20, 40, 30])
      } else {
        failAt.current = now
        const tx = Math.max(30, Math.min(BOARD_W - 30, last.x))
        const ty = Math.max(30, Math.min(BOARD_H - 40, last.y - 30))
        if (r.outcome === 'spiked') {
          shakeUntil.current = now + 350
          flashUntil.current = now + 300
          fx.current.sparks(last.x, last.y, 12, '#ff8a8a', 150, 0.5)
          if (typeof navigator !== 'undefined') navigator.vibrate?.(60)
        }
        fx.current.text(tx, ty, r.outcome === 'stalled' || r.outcome === 'timeout' ? '…' : '앗!', '#ffffff', 22, 1)
      }
      const ink = line.current ? polyLength(line.current) : 0
      recs.current.push({ stage: stage.id, outcome: r.outcome, acorns: r.acorns, ink: Math.round(ink), pts: (line.current ?? []).map((p) => [Math.round(p.x * 2), Math.round(p.y * 2)]), ms: Math.round(performance.now() - drawStart.current) })
      setMsg(r.outcome === 'nest' ? `${OUTCOME_TEXT.nest} 🌰 ${r.acorns}/3 · 점수 ${r.acorns * 100 + Math.round((100 * (stage.ink - ink)) / stage.ink)}` : OUTCOME_TEXT[r.outcome])
      force((n) => n + 1)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [w, stage, phase, play])

  const pt = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * BOARD_W, y: ((e.clientY - r.top) / r.height) * BOARD_H }
  }
  const onDown = (e: React.PointerEvent) => {
    if (phase !== 'draw' || !inPlayZone(e)) return
    const p = pt(e)
    if (dist(p, stage.spawn) < CONST.SPAWN_BAN_R) return
    unlock()
    play('draw')
    lockScroll(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    raw.current = [p]
    line.current = null
    drawStart.current = performance.now()
    downAt.current = performance.now()
    setMsg('')
  }
  const onMove = (e: React.PointerEvent) => {
    if (phase !== 'draw' || !raw.current.length) return
    const p = pt(e)
    if (dist(p, stage.spawn) < CONST.SPAWN_BAN_R) return // 스폰 금지 반경 안으로는 못 긋는다
    if (polyLength(raw.current) >= stage.ink) return // 잉크 한도에서 멈춤
    raw.current.push(p)
    force((n) => n + 1)
  }
  const onUp = () => {
    lockScroll(false)
    if (phase !== 'draw' || !raw.current.length) return
    // 스크롤 제스처 판별: 빠르게(0.45초 안) 위로 길게 쓸어올린 거의 수직 동작은 선이 아니라 '아래로 스크롤'하려는 손짓이다.
    // 선을 그을 때는 보통 아래·옆으로 천천히 그으므로(위로 급하게 긋는 선은 거의 의도되지 않음) 시도로 세지 않고 안내만 한다.
    const r0 = raw.current[0]
    const r1 = raw.current[raw.current.length - 1]
    const dx = r1.x - r0.x
    const dy = r1.y - r0.y
    if (dy < -60 && Math.abs(dy) > 2 * Math.abs(dx) && performance.now() - downAt.current < 450) {
      raw.current = []
      setMsg('스크롤은 보드 바깥(위·아래·옆 띠)에서 해요')
      force((n) => n + 1)
      return
    }
    const l = processStroke(raw.current, stage.ink)
    if (!l) {
      raw.current = []
      play('invalid')
      setMsg('선이 너무 짧아요(40px 이상)')
      return
    }
    line.current = l
    const tr: Pt[] = []
    const res = simulate(stage, [l], DEFAULT_PHYSICS, tr)
    trace.current = tr.length ? tr : [stage.spawn]
    result.current = { outcome: res.outcome, acorns: res.acorns }
    runStart.current = performance.now()
    ghost.current = l
    finished.current = false
    gotAcorns.current = new Set()
    popAt.current = new Map()
    celebrateAt.current = 0
    failAt.current = 0
    fx.current.clear()
    vel.current = { x: 0, y: 0 }
    prevSpeed.current = 0
    squash.current = 0
    play('release')
    setPhase('run')
  }
  const onCancel = () => {
    lockScroll(false)
    raw.current = [] // 취소는 취소(스크롤이 시작되면 브라우저가 보낸다)
    force((n) => n + 1)
  }

  const copy = async () => {
    const payload = JSON.stringify({ v: 1, canvasW: w, dpr: window.devicePixelRatio, touch: navigator.maxTouchPoints, vp: [window.innerWidth, window.innerHeight], recs: recs.current })
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(`${recs.current.length}판 기록을 복사했어요`)
    } catch {
      setCopied('복사 실패 — 아래 상자를 길게 눌러 복사해 주세요')
    }
  }

  const used = line.current ? polyLength(line.current) : polyLength(capInk(dropClose(raw.current), stage.ink))
  const left = Math.max(0, Math.round(100 * (1 - used / stage.ink)))
  const success = phase === 'done' && result.current?.outcome === 'nest'
  return (
    <div ref={wrap} className="mx-auto w-full max-w-[390px]">
      {inKakao && (
        <p role="note" className="mb-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-xs text-fg-muted" data-testid="slime-kakao-note">
          카카오톡 안에서는 화면이 움직일 수 있어요. 오른쪽 아래 ⋮(또는 공유) → <b>다른 브라우저로 열기</b>를 쓰면 더 잘 그려져요.
        </p>
      )}
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold">스테이지 {si + 1}/{SLIME_STAGES.length}</span>
        <span className="flex items-center gap-3 text-fg-muted">
          잉크 {left}%
          <button
            type="button"
            aria-label={muted ? '소리 켜기' : '소리 끄기'}
            aria-pressed={muted}
            className="rounded-lg border border-white/15 px-2 py-1 text-base"
            onClick={() => {
              const m = !muted
              setMuted(m)
              try {
                localStorage.setItem('slime:muted', m ? '1' : '0')
              } catch {
                /* 무시 */
              }
              if (!m) unlock()
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div className="h-full rounded-full bg-[#f4f0ff] transition-[width]" style={{ width: `${left}%` }} />
      </div>
      <div className="relative" style={{ width: w, height: Math.round(w * (BOARD_H / BOARD_W)) }}>
        <canvas ref={canvas} style={{ width: w, height: Math.round(w * (BOARD_H / BOARD_W)), touchAction: 'pan-y' }} className="block rounded-xl border border-white/15" data-testid="slime-canvas" />
        {/* 그리기 구역: 가로 76%·세로 68% (위·아래 16%·좌우 12% 띠는 스크롤용 — 11-19 오너 피드백으로 확대) */}
        <PlayZone top={0.16} bottom={0.16} left={0.12} right={0.12} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} data-testid="slime-zone" />
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-center text-sm font-semibold">{msg || (phase === 'draw' ? '말랑이 아래에서 시작해 둥지까지 선을 그어요' : phase === 'run' ? '미끄러지는 중…' : '')}</p>
      <div className="mt-2 flex items-center justify-center gap-2 text-sm">
        <button type="button" className="rounded-lg border border-white/15 px-3 py-2" onClick={() => reset()} disabled={phase === 'run'}>다시 그리기</button>
        {success && si + 1 < SLIME_STAGES.length && <button type="button" className="rounded-lg bg-accent px-3 py-2 font-semibold text-black" onClick={() => reset(si + 1)}>다음 스테이지</button>}
        {success && si + 1 === SLIME_STAGES.length && <span className="font-semibold">모두 클리어! 🎉</span>}
      </div>
      <div className="mt-5 text-center text-xs text-fg-muted">
        <button type="button" className="rounded-lg border border-white/15 px-3 py-2" onClick={copy}>플레이 기록 복사 ({recs.current.length}판)</button>
        <p className="mt-1">{copied}</p>
      </div>
    </div>
  )
}
