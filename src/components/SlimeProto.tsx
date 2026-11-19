'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PlayZone, inPlayZone } from '@/components/game-shell/PlayZone'
import { useSlimeAudio } from '@/lib/sound/useSlimeAudio'
import { simulate } from '@/lib/games/slime/engine'
import { sendHit } from '@/lib/hit'
import { scoreOf } from '@/lib/games/slime/daily'
import { KO, type SlimeText } from '@/lib/games/slime/strings'
import { STAGE_HINTS } from '@/lib/games/slime/stages'
import { runLine, waypointsToRaw } from '@/lib/games/slime/solver'
import { drawBubble, drawFailMark, drawFlowerGoal, drawGoalGlow, drawIslandFloors, drawPoisonFlower, drawSky, drawStar, drawTerrain } from '@/lib/games/slime/draw'
import { Fx, starPath } from '@/lib/games/slime/fx'
import { SLIME_STAGES } from '@/lib/games/slime/stages'
import { capInk, dist, dropClose, polyLength, processStroke, segmentHitsSpawnBan } from '@/lib/games/slime/strokePipeline'
import { BOARD_H, BOARD_W, CONST, DEFAULT_PHYSICS, type Outcome, type Pt } from '@/lib/games/slime/types'

type Phase = 'draw' | 'run' | 'done'
interface Rec {
  stage: string
  outcome: Outcome
  acorns: number
  ink: number
  pts: number[][]
  ms: number
}

const TRACE_MS = 50 // 트레이스 한 칸 = 6스텝 = 50ms
const START_VIS_MS = 220 // 놓은 뒤 말랑이가 움직이기까지(엔진 시뮬의 0.5초 대기는 그대로, 화면만 앞당김). 그 사이 웅크리는 예비 동작
const clampPt = (p: Pt): Pt => ({ x: Math.max(18, Math.min(BOARD_W - 18, p.x)), y: Math.max(26, Math.min(BOARD_H - 34, p.y)) })

export interface SlimeBoardProps {
  text?: SlimeText
  /** 측정 슬러그. 시험판은 'slime-proto', 정식은 'slime-slide'. */
  slug?: string
  /** 일일처럼 한 스테이지만 플레이(스테이지 버튼·자동 다음 없음). */
  fixedStage?: number
  /** true면 더 그릴 수 없다(일일 시도 소진). */
  attemptsLocked?: boolean
  /** 한 번 재생이 끝날 때마다(도착·실패 모두) 호출. hint = 추천 길이 화면에 떠 있던 판인가. */
  onAttempt?: (a: { stageId: string; outcome: Outcome; stars: number; score: number; hint: boolean }) => void
  /** 플레이 기록 복사 버튼(시험판 전용). */
  devTools?: boolean
}

/** 그리기 → 시뮬 재생 → 결과. 시험판(/tools/slime-proto)과 정식 게임이 같이 쓴다. */
export function SlimeProto({ text: tx = KO, slug = 'slime-proto', fixedStage, attemptsLocked = false, onAttempt, devTools = true }: SlimeBoardProps = {}) {
  const SLUG = slug
  const onAttemptRef = useRef(onAttempt) // 콜백이 바뀌어도 렌더 루프(rAF)를 다시 만들지 않는다
  useEffect(() => {
    onAttemptRef.current = onAttempt
  }, [onAttempt])
  const [si, setSi] = useState(fixedStage ?? 0)
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
  const activePointer = useRef<number | null>(null) // 멀티터치: 처음 누른 손가락 하나만 선을 긋는다
  const downAt = useRef(0)
  const finished = useRef(false) // 한 번의 재생에서 결과 기록이 두 번 쌓이지 않게(rAF가 effect 정리 전에 또 돌 수 있다)
  const [, force] = useState(0)
  const img = useRef<HTMLImageElement | null>(null)
  const imgHappy = useRef<HTMLImageElement | null>(null)
  const imgDizzy = useRef<HTMLImageElement | null>(null)
  const imgBg = useRef<HTMLImageElement | null>(null)
  const imgIsland = useRef<HTMLImageElement | null>(null)
  const imgFlower = useRef<HTMLImageElement | null>(null)
  const imgStar = useRef<HTMLImageElement | null>(null)
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
  const ringFlash = useRef(0)
  const failStreak = useRef(0) // 현재 스테이지에서 연속 실패 수(2회 이상이면 추천 길 표시)
  const hintLine = useRef<Pt[] | null>(null)

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
    sendHit(SLUG, 'sl_view')
    setInKakao(/KAKAOTALK/i.test(navigator.userAgent))
    try {
      setMuted(localStorage.getItem('slime:muted') === '1')
    } catch {
      /* 저장소를 못 써도 소리는 켜진 채로 */
    }
  }, [SLUG])
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    // 한 화면 안에 보드+컨트롤이 들어오게 높이로도 제한(스크롤할 일을 줄여 그리다 스크롤하는 사고를 막는다). 위쪽 크롬(헤더·제목·잉크 막대) ≈ 200px, 아래 컨트롤 ≈ 130px
    const update = () => {
      // 폭을 최대한 채운다(오너: 화면이 꽉 안 참). 낮은 화면에서도 340px 아래로 줄이지 않고, 넓은 화면은 480px까지 키운다
      const byHeight = Math.max(340, Math.floor(((window.innerHeight - 250) * BOARD_W) / BOARD_H))
      setW(Math.max(260, Math.min(480, Math.floor(el.clientWidth), byHeight)))
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
    imgStar.current = load('/art/star.webp')
    let hiddenAt = 0
    const onVis = () => {
      if (document.hidden) hiddenAt = performance.now()
      else if (hiddenAt) {
        runStart.current += performance.now() - hiddenAt // 숨은 동안 재생이 흐르지 않은 것처럼 이어 본다
        hiddenAt = 0
      }
    }
    document.addEventListener('visibilitychange', onVis)
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    fx.current.calm = mq?.matches ?? false
    const onMq = () => {
      fx.current.calm = mq?.matches ?? false
    }
    mq?.addEventListener?.('change', onMq)
    return () => {
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      mq?.removeEventListener?.('change', onMq)
    }
  }, [])

  // 한 판의 연출 상태 초기화(reset·놓기에서 공통)
  const resetRunFx = useCallback(() => {
    gotAcorns.current = new Set()
    popAt.current = new Map()
    celebrateAt.current = 0
    failAt.current = 0
    fx.current.clear()
    vel.current = { x: 0, y: 0 }
    prevSpeed.current = 0
    squash.current = 0
  }, [])

  const reset = useCallback((next?: number) => {
    if (next !== undefined) {
      setSi(next)
      ghost.current = null // 다른 스테이지로 가면 이전 스테이지의 선을 남기지 않는다
      failStreak.current = 0
      hintLine.current = null
    }
    activePointer.current = null
    raw.current = []
    line.current = null
    trace.current = []
    result.current = null
    resetRunFx()
    setPhase('draw')
    setMsg('')
  }, [resetRunFx])

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
      const rf = ringFlash.current > t ? (ringFlash.current - t) / 400 : 0
      g.strokeStyle = rf > 0 ? `rgba(230,70,70,${0.5 + 0.5 * rf})` : 'rgba(91,58,30,0.45)'
      g.lineWidth = rf > 0 ? 4 : 2
      g.beginPath()
      g.arc(stage.spawn.x, stage.spawn.y, CONST.SPAWN_BAN_R, 0, Math.PI * 2)
      g.stroke()
      g.setLineDash([])
      // 꽃(목표, 도착하면 빛남)·밤송이·별
      const celebrate = celebrateAt.current ? Math.max(0, 1 - (t - celebrateAt.current) / 1600) : 0
      // 목표는 꽃 하나만(둥지 없음). 도착하면 꽃 주변이 빛난다
      drawGoalGlow(g, stage.nest, t, celebrate)
      drawFlowerGoal(g, imgFlower.current, stage.nest, t, celebrate)
      const alarm = failAt.current ? Math.max(0, 1 - (t - failAt.current) / 900) : 0
      stage.spikes.forEach((s, i) => drawPoisonFlower(g, imgFlower.current, s, t, i, result.current?.outcome === 'spiked' ? alarm : 0))
      stage.acorns.forEach((a, i) => {
        const pop = popAt.current.get(i)
        if (pop === undefined) drawStar(g, imgStar.current, a, t, i)
        else {
          const q = (t - pop) / 380 // 먹으면 커지며 사라진다
          if (q < 1) drawStar(g, imgStar.current, a, t, i, 1 + 0.9 * q, 1 - q)
        }
      })
      // 추천 길(두 번 연속 실패 후): 점선 + 말풍선
      if (hintLine.current && phase === 'draw' && !line.current && raw.current.length === 0) {
        g.save()
        g.setLineDash([2, 12])
        drawLine(g, hintLine.current, 'rgba(255,243,220,0.95)', 6)
        g.restore()
        drawBubble(g, tx.hintBubble, BOARD_W / 2, 52)
      }
      // 지난 시도(고스트)·내 선(분필: 은은한 빛 + 선명한 선)
      if (ghost.current && phase !== 'run') drawLine(g, ghost.current, 'rgba(91,58,30,0.28)', 5)
      const cur = line.current ?? (raw.current.length > 1 ? capInk(dropClose(raw.current), stage.ink) : null)
      if (cur) {
        drawLine(g, cur, '#5b3a1e', 10)
        drawLine(g, cur, '#fff3dc', 5.5)
      }
      // 첫 10초 안내: 첫 판 전, 첫 스테이지에서만 손가락이 선을 긋는 시범과 말풍선을 보여준다(디자이너·PM 검수)
      if (phase === 'draw' && si === 0 && recs.current.length === 0 && raw.current.length === 0 && !line.current) {
        const q = Math.min(1, (t % 3200) / 2400)
        const A = { x: 54, y: 152 }
        const B = { x: 312, y: 484 }
        const hx = A.x + (B.x - A.x) * q
        const hy = A.y + (B.y - A.y) * q
        g.save()
        g.setLineDash([9, 9])
        g.strokeStyle = 'rgba(255,243,220,0.9)'
        g.lineWidth = 5
        g.beginPath()
        g.moveTo(A.x, A.y)
        g.lineTo(hx, hy)
        g.stroke()
        g.setLineDash([])
        g.font = '30px sans-serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('👆', hx + 6, hy + 14)
        g.restore()
        drawBubble(g, tx.startBubble, BOARD_W / 2, 52)
      }
      // 말랑이
      let sp: Pt = stage.spawn
      let moving = false
      if (phase === 'run' || phase === 'done') {
        const tr = trace.current
        const el = Math.max(0, t - runStart.current - START_VIS_MS) / TRACE_MS
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
      const failedNow = phase === 'done' && result.current !== null && result.current.outcome !== 'nest'
      if (failedNow) {
        sp = clampPt(sp) // 보드 밖으로 떨어져도 어지러운 얼굴과 ✕가 보이게 가장자리에 남긴다
        if (failAt.current && t - failAt.current < 2400) {
          drawFailMark(g, { x: sp.x, y: sp.y + 4 }, (t - failAt.current) / 1000)
          drawBubble(g, tx.failBubble[result.current?.outcome ?? 'fell'], Math.max(80, Math.min(BOARD_W - 80, sp.x)), Math.max(30, sp.y - 54), 200)
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
      if (moving && speed > 140 && !fx.current.calm) fx.current.trail(sp.x, sp.y + 4)
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
      if (happy && celebrateAt.current && !fx.current.calm) {
        const q = (t - celebrateAt.current) / 1000
        hop = Math.abs(Math.sin(q * 9)) * 16 * Math.exp(-q * 2.2) // 통통 튄다
      }
      if (dizzy && failAt.current) wob = Math.sin((t - failAt.current) / 90) * 0.2 * Math.max(0, 1 - (t - failAt.current) / 1500)
      g.save()
      g.translate(p.x, p.y - hop)
      const calm = fx.current.calm
      // 놓은 직후 웅크렸다 튀어 나가는 예비 동작(디자이너 검수: 대기 0.5초가 길고 맥이 없다)
      if (phase === 'run' && !moving && !calm) {
        const c = Math.sin(Math.min(1, Math.max(0, (t - runStart.current) / START_VIS_MS)) * Math.PI)
        g.scale(1 + 0.14 * c, 1 - 0.24 * c)
      }
      const stretch = moving && !calm ? Math.min(0.32, speed / 2200) : 0
      if (moving && !calm && speed > 30) {
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
        fx.current.text(stage.nest.x, stage.nest.y - 46, r.acorns === 3 ? tx.perfect : tx.win, '#ffe27a', 24, 1.3)
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
        void tx
        void ty
      }
      const ink = line.current ? polyLength(line.current) : 0
      recs.current.push({ stage: stage.id, outcome: r.outcome, acorns: r.acorns, ink: Math.round(ink), pts: (line.current ?? []).map((p) => [Math.round(p.x * 2), Math.round(p.y * 2)]), ms: Math.round(performance.now() - downAt.current) })
      const inkBonus = Math.round((100 * (stage.ink - ink)) / stage.ink)
      setMsg(r.outcome === 'nest' ? tx.scoreLine(r.acorns, r.acorns * 100, inkBonus, r.acorns * 100 + inkBonus) : tx.outcome[r.outcome])
      sendHit(SLUG, r.outcome === 'nest' ? `sl_win_s${si + 1}` : `sl_f_${r.outcome}_s${si + 1}`)
      onAttemptRef.current?.({ stageId: stage.id, outcome: r.outcome, stars: r.acorns, score: scoreOf(r.outcome, r.acorns, ink, stage.ink), hint: hintLine.current !== null })
      if (r.outcome === 'nest') {
        failStreak.current = 0
        hintLine.current = null
      } else {
        failStreak.current += 1
        if (failStreak.current >= 2 && !hintLine.current && STAGE_HINTS[stage.id]) {
          hintLine.current = runLine(stage, waypointsToRaw(STAGE_HINTS[stage.id]))?.line ?? null
          if (hintLine.current) sendHit(SLUG, `sl_hint_s${si + 1}`)
        }
      }
      force((n) => n + 1)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [w, stage, phase, play, si, tx, SLUG])

  const pt = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * BOARD_W, y: ((e.clientY - r.top) / r.height) * BOARD_H }
  }
  const onDown = (e: React.PointerEvent) => {
    if (phase !== 'draw' || attemptsLocked || !inPlayZone(e) || activePointer.current !== null) return
    const p = pt(e)
    if (dist(p, stage.spawn) < CONST.SPAWN_BAN_R) {
      ringFlash.current = performance.now() + 400
      setMsg(tx.banNear)
      return
    }
    unlock()
    play('draw')
    lockScroll(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    raw.current = [p]
    line.current = null
    activePointer.current = e.pointerId
    downAt.current = performance.now()
    sendHit(SLUG, 'sl_draw_start')
    setMsg('')
  }
  const onMove = (e: React.PointerEvent) => {
    if (phase !== 'draw' || !raw.current.length || e.pointerId !== activePointer.current) return
    const p = pt(e)
    // 스폰 금지 반경: 점이 안이거나 직전 점과의 선분이 원을 지나가도 못 긋는다(빠른 선이 점 사이를 건너뛰는 경우 포함)
    if (segmentHitsSpawnBan(raw.current[raw.current.length - 1], p, stage.spawn)) return
    if (polyLength(raw.current) >= stage.ink) return // 잉크 한도에서 멈춤
    raw.current.push(p)
    force((n) => n + 1)
  }
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current) return // 다른 손가락을 뗀 것은 무시
    activePointer.current = null
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
      sendHit(SLUG, 'sl_cancel_scroll')
      setMsg(tx.scrollNote)
      force((n) => n + 1)
      return
    }
    const l = processStroke(raw.current, stage.ink)
    if (!l) {
      raw.current = []
      play('invalid')
      sendHit(SLUG, 'sl_cancel_short')
      setMsg(tx.tooShort)
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
    resetRunFx()
    play('release')
    sendHit(SLUG, 'sl_run')
    setPhase('run')
  }
  const onCancel = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current) return
    activePointer.current = null
    sendHit(SLUG, 'sl_pointercancel')
    lockScroll(false)
    raw.current = [] // 취소는 취소(스크롤이 시작되면 브라우저가 보낸다)
    force((n) => n + 1)
  }

  const copy = async () => {
    sendHit(SLUG, 'sl_copy')
    const payload = JSON.stringify({ v: 1, canvasW: w, dpr: window.devicePixelRatio, touch: navigator.maxTouchPoints, vp: [window.innerWidth, window.innerHeight], recs: recs.current })
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(tx.copied(recs.current.length))
    } catch {
      setCopied(tx.copyFail)
    }
  }

  const used = line.current ? polyLength(line.current) : polyLength(capInk(dropClose(raw.current), stage.ink))
  const left = Math.max(0, Math.round(100 * (1 - used / stage.ink)))
  const success = phase === 'done' && result.current?.outcome === 'nest'
  // 도착하면 축하를 보여 준 뒤 3.2초 후 자동으로 다음 스테이지(버튼으로 바로 넘길 수도 있다). 마지막 스테이지는 넘기지 않는다
  useEffect(() => {
    if (fixedStage !== undefined || !success || si + 1 >= SLIME_STAGES.length) return
    const id = window.setTimeout(() => {
      sendHit(SLUG, 'sl_auto_next')
      reset(si + 1)
    }, 3200)
    return () => window.clearTimeout(id)
  }, [success, si, reset, fixedStage, SLUG])
  return (
    <div ref={wrap} className="mx-auto w-full max-w-[480px]">
      {inKakao && (
        <p role="note" className="mb-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-xs text-fg-muted" data-testid="slime-kakao-note">
          {tx.kakaoNote}<b>{tx.kakaoBold}</b>{tx.kakaoTail}
        </p>
      )}
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5" role="group" aria-label={tx.stageGroup} hidden={fixedStage !== undefined}>
          {SLIME_STAGES.map((st, i) => (
            <button
              key={st.id}
              type="button"
              aria-label={tx.stageLabel(i + 1)}
              aria-current={i === si ? 'true' : undefined}
              disabled={phase === 'run'}
              onClick={() => {
                sendHit(SLUG, 'sl_pick_stage')
                reset(i)
              }}
              className={`h-11 w-11 rounded-full border-2 text-sm font-bold ${i === si ? 'border-[#5b3a1e] bg-[#fff3dc] text-[#5b3a1e]' : 'border-white/20 text-fg-muted'}`}
            >
              {i + 1}
            </button>
          ))}
        </span>
        <span className="flex items-center gap-3 text-fg-muted">
          {tx.ink(left)}
          <button
            type="button"
            aria-label={muted ? tx.soundOn : tx.soundOff}
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
        <canvas ref={canvas} style={{ width: w, height: Math.round(w * (BOARD_H / BOARD_W)), touchAction: 'pan-y' }} className="garden-frame block" role="img" aria-label={tx.canvasLabel} data-testid="slime-canvas" />
        {/* 그리기 구역: 가로 90%·세로 84%. 스크롤용 띠는 위·아래 8%·좌우 5%만 남긴다(오너 11-19: 띠가 넓어 선이 안 그려지는 곳이 많았음). 위로 빠르게 쓸어올리는 스크롤 손짓은 onUp 필터가 선으로 세지 않는다 */}
        <PlayZone top={0.08} bottom={0.08} left={0.05} right={0.05} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} data-testid="slime-zone" />
      </div>
      <p role="status" aria-live="polite" className="mt-6 min-h-6 text-center text-sm font-semibold">{msg || (phase === 'draw' ? tx.startStatus : phase === 'run' ? tx.running : '')}</p>
      <div className="mt-2 flex items-center justify-center gap-2 text-sm">
        <button type="button" className="min-h-11 rounded-lg border border-white/15 px-4 py-2" onClick={() => {
            sendHit(SLUG, 'sl_retry')
            reset()
          }} disabled={phase === 'run' || attemptsLocked}>{tx.retry}</button>
        {fixedStage === undefined && success && si + 1 < SLIME_STAGES.length && <button type="button" className="min-h-11 rounded-lg bg-accent px-4 py-2 font-semibold text-black" onClick={() => {
            sendHit(SLUG, 'sl_next')
            reset(si + 1)
          }}>{tx.next}</button>}
        {fixedStage === undefined && success && si + 1 === SLIME_STAGES.length && <span className="font-semibold">{tx.allClear}</span>}
      </div>
      {devTools && (
        <div className="mt-5 text-center text-xs text-fg-muted">
          <button type="button" className="min-h-11 rounded-lg border border-white/15 px-4 py-2" onClick={copy}>{tx.copy(recs.current.length)}</button>
          <p className="mt-1">{copied}</p>
        </div>
      )}
    </div>
  )
}
