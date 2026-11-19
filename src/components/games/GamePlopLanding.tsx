'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ShareButtons } from '@/components/ShareButtons'
import { sendHit } from '@/lib/hit'
import {
  STAR_BONUS,
  CANCEL_DRAG_PX,
  cancelCharge,
  dailySeedFor,
  drainEvents,
  ensureIslands,
  flightPos,
  inputLocked,
  newGame,
  pingOf,
  powerAt,
  press,
  previewFracOf,
  previewPoints,
  rangeMax,
  release,
  tick,
  tintOf,
  type EndReason,
  type Island,
  type PlopEvent,
  type PlopState,
} from '@/lib/games/plop/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { usePlopAudio } from '@/lib/sound/usePlopAudio'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordFinish } from '@/lib/gameStats'
import { todayUTC } from '@/lib/dailyDate'
import { GameOverlay } from '@/components/game-shell'
import { OverlayScoreSubmit } from '@/components/game-shell/OverlayScoreSubmit'
import { DailyResultSheet } from '@/components/daily/DailyResultSheet'
import { recordDoneInBrowser, type DailyResult } from '@/lib/daily/result'
import { hasLeaderboard } from '@/lib/leaderboard'
import { roundFont } from '@/app/roundFont'
import { siteConfig } from '@/lib/siteConfig'

type Mode = 'daily' | 'practice'
type Sprite = 'star' | 'plop-bg' | 'plop-island-wide' | 'plop-island-small' | 'plop-flower' | 'plop-flag' | 'mallang-idle' | 'mallang-happy' | 'mallang-dizzy'
const SPRITES: Sprite[] = ['star', 'plop-bg', 'plop-island-wide', 'plop-island-small', 'plop-flower', 'plop-flag', 'mallang-idle', 'mallang-happy', 'mallang-dizzy']

/** 논리 해상도(캔버스는 이 좌표계로 그리고 DPR로 확대). */
const VW = 390
const VH = 640
const SURF_Y = 380 // 섬 윗면의 화면 y
const CHAR_X = 0.2 * VW // 서 있는 캐릭터의 화면 x
const CHAR_S = 78 // 캐릭터 스프라이트 크기
const TOP_FRAC = { wide: 0.15, small: 0.13 }
const END_TEXT: Record<Exclude<EndReason, null>, string> = {
  short: 'Splash! Too short',
  long: 'Splash! Too far',
  sunk: 'The island sank',
}
const TINT_FILL = ['', '#d4e2ff', '#7a78b4'] as const // 0 노을(없음) 1 새벽 2 밤
const TINT_NAME = ['Sunset', 'Dawn', 'Night'] as const

/** 스프라이트에 갈색 외곽선을 둘러 섬과 같은 톤으로 맞춘 캔버스(한 번만 만든다). */
const outlineCache = new Map<HTMLImageElement, { cv: HTMLCanvasElement; pad: number }>()
function outlined(img: HTMLImageElement): { cv: HTMLCanvasElement; pad: number } | null {
  if (!img.complete || !img.naturalWidth) return null
  const hit = outlineCache.get(img)
  if (hit) return hit
  const pad = 14
  const w = img.naturalWidth
  const h = img.naturalHeight
  const sil = document.createElement('canvas')
  sil.width = w
  sil.height = h
  const sc = sil.getContext('2d')
  const out = document.createElement('canvas')
  out.width = w + pad * 2
  out.height = h + pad * 2
  const oc = out.getContext('2d')
  if (!sc || !oc) return null
  sc.drawImage(img, 0, 0)
  sc.globalCompositeOperation = 'source-in'
  sc.fillStyle = '#5b3a1e'
  sc.fillRect(0, 0, w, h)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    oc.drawImage(sil, pad + Math.cos(a) * 11, pad + Math.sin(a) * 11)
  }
  oc.drawImage(img, pad, pad)
  const res = { cv: out, pad }
  outlineCache.set(img, res)
  return res
}
const seedForDay = (iso: string) => dailySeedFor(Number(iso.replace(/-/g, '')))
const freshSeed = () => (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
/** 일일 번호(2026-11-18 = #1). */
const dailyNumber = (iso: string) => Math.max(1, Math.floor((Date.parse(iso + 'T00:00:00Z') - Date.UTC(2026, 10, 17)) / 86_400_000))

function loadNum(key: string): number {
  try {
    const n = Number(localStorage.getItem(key) ?? 0)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}
function saveNum(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v))
  } catch {
    // ignore
  }
}

interface Fx {
  kind: 'ripple' | 'spark' | 'pop' | 'splash'
  x: number // 세계 x
  y: number // 세계 y(위가 +)
  vx: number
  vy: number
  born: number
  life: number
  text?: string
  color?: string
}

interface Ui {
  phase: PlopState['phase']
  score: number
  landed: number
  perfects: number
  streak: number
  reason: EndReason
}
const uiOf = (s: PlopState): Ui => ({ phase: s.phase, score: s.score, landed: s.landed, perfects: s.perfects, streak: s.streak, reason: s.endReason })

export function GamePlopLanding({ storageKey }: { storageKey: string }) {
  const [ui, setUi] = useState<Ui | null>(null)
  const [mode, setMode] = useState<Mode>('practice')
  const [firstDone, setFirstDone] = useState(true)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [armed, setArmed] = useState(true)
  const [ready, setReady] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [showShare, setShowShare] = useState(false)
  // Daily 판의 결과 시트(R5). 연습 판은 예전 오버레이 그대로.
  const [daily, setDaily] = useState<DailyResult | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { muted, toggleMuted } = useGameSound()
  const { play, unlock, startBgm } = usePlopAudio(muted)
  const { reduced, reducedRef } = useReducedMotion()

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stRef = useRef<PlopState | null>(null)
  const modeRef = useRef<Mode>('practice')
  const dayRef = useRef('')
  const imgs = useRef<Partial<Record<Sprite, HTMLImageElement>>>({})
  const fx = useRef<Fx[]>([])
  const vis = useRef({ cam: 0, landAt: -1e9, happyUntil: 0, overAt: -1e9, sinkTotal: 0, lastTickP: 0 })
  const input = useRef({ id: -1, downY: 0, cancel: false, keyDown: false })
  const bestRef = useRef(0)
  const doneRef = useRef(false)
  const playedRef = useRef(false)
  const lastScore = useRef(0)

  const deal = useCallback((m: Mode) => {
    modeRef.current = m
    dayRef.current = todayUTC()
    const seed = m === 'daily' ? seedForDay(dayRef.current) : freshSeed()
    const st = newGame(seed)
    ensureIslands(st, 6)
    stRef.current = st
    startBgm(tintOf(seed)) // 첫 입력(unlock) 전이면 틴트만 기억한다
    fx.current = []
    vis.current = { cam: -CHAR_X, landAt: -1e9, happyUntil: 0, overAt: -1e9, sinkTotal: 0, lastTickP: 0 }
    input.current = { id: -1, downY: 0, cancel: false, keyDown: false }
    doneRef.current = false
    lastScore.current = 0
    setArmed(true)
    setNewBest(false)
    setShowShare(false)
    setDaily(null)
    setSheetOpen(false)
    setAnnounce('')
    setUi(uiOf(st))
  }, [startBgm])

  // 스프라이트 로드 + 첫 판(처음 방문이면 연습 고정, 데일리는 첫 판 뒤에 열린다)
  useEffect(() => {
    let alive = true
    let left = SPRITES.length
    for (const n of SPRITES) {
      const im = new Image()
      im.onload = im.onerror = () => {
        if (--left === 0 && alive) setReady(true)
      }
      im.src = `/art/${n}.webp`
      imgs.current[n] = im
    }
    const b = loadNum(storageKey)
    bestRef.current = b
    setBest(b)
    let played = false
    try {
      played = localStorage.getItem('plop:played') === '1'
    } catch {
      // ignore
    }
    playedRef.current = played
    setFirstDone(played)
    const m: Mode = played ? 'daily' : 'practice'
    setMode(m)
    deal(m)
    return () => {
      alive = false
    }
  }, [storageKey, deal])

  const handle = useCallback(
    (events: PlopEvent[], s: PlopState, now: number) => {
      const v = vis.current
      const f = s.flight
      for (const e of events) {
        if (e === 'cancel') play('cancel')
        else if (e === 'launch') {
          play('launch')
          if (f?.starTry) sendHit('plop-landing', 'star_try')
        }
        else if (e === 'warn') play('warn')
        else if (e === 'sunk') {
          play('sunk')
          v.overAt = now
        } else if (e === 'perfect' || e === 'good') {
          const perfect = e === 'perfect'
          play(perfect ? 'perfect' : 'good')
          v.landAt = now
          v.happyUntil = perfect ? now + 650 : 0
          v.sinkTotal = s.sinkLeftMs
          if (f && !reducedRef.current) {
            fx.current.push({ kind: 'ripple', x: f.landX, y: 0, vx: 0, vy: 0, born: now, life: 650 })
            if (perfect) for (let i = 0; i < 9; i++) fx.current.push({ kind: 'spark', x: f.landX, y: 24, vx: Math.cos(i * 0.7) * 90, vy: 60 + Math.sin(i * 0.7) * 90, born: now, life: 700 })
          }
          if (f) fx.current.push({ kind: 'pop', x: f.landX, y: 118, vx: 0, vy: 40, born: now, life: 900, text: perfect ? `Perfect +${s.score - (lastScore.current) - (f?.starBonus ?? 0)}` : '+1', color: perfect ? '#ffc933' : '#fff3dc' })
          setAnnounce(perfect ? `Perfect, ${s.score} points` : `Landed, ${s.score} points`)
          lastScore.current = s.score
        } else if (e === 'star') {
          // 착지음(good/perfect)은 같은 틱에 이미 재생됐다 — 겹쳐 울리지 않게 별 전용 소리는 따로 없다
          sendHit('plop-landing', 'star_hit')
          if (f) {
            fx.current.push({ kind: 'pop', x: f.landX, y: 168, vx: 0, vy: 40, born: now, life: 1100, text: `⭐ Star +${STAR_BONUS}` })
            if (!reducedRef.current) for (let i = 0; i < 12; i++) fx.current.push({ kind: 'spark', x: f.landX, y: 40, vx: Math.cos(i * 0.52) * 120, vy: 70 + Math.sin(i * 0.52) * 110, born: now, life: 800 })
          }
          setAnnounce(`Star island! Plus ${STAR_BONUS}, ${s.score} points`)
        } else if (e === 'miss') {
          play('splash')
          v.overAt = now
          if (f && !reducedRef.current) fx.current.push({ kind: 'splash', x: f.landX, y: 0, vx: 0, vy: 0, born: now, life: 700 })
        }
      }
      setUi(uiOf(s))
    },
    [play, reducedRef],
  )

  // ── 그리기 ──
  const draw = useCallback(
    (now: number) => {
      const cv = canvasRef.current
      const st = stRef.current
      if (!cv || !st) return
      const ctx = cv.getContext('2d')
      if (!ctx) return
      const k = cv.width / VW
      ctx.setTransform(k, 0, 0, k, 0, 0)
      const v = vis.current
      const im = imgs.current
      const f = st.flight

      // 캐릭터 위치(세계 좌표)
      const cur = st.islands[st.cur]
      let cx = cur.cx
      let cy = 0
      let fly = false
      if (st.phase === 'flying' && f) {
        const p = flightPos(f.fromX, f.p, f.wind, f.tMs)
        cx = p.x
        cy = p.y
        fly = true
      } else if (st.phase === 'over' && f) {
        const t = Math.max(0, (now - v.overAt) / 1000)
        cx = f.landX
        cy = -520 * t * t - 20 * t
        if (st.endReason === 'sunk') {
          cx = cur.cx
          cy = -420 * t * t
        }
      }
      // 카메라: 캐릭터를 왼쪽 20%에 두고 앞을 약간 본다
      const lead = st.phase === 'ready' || st.phase === 'charging' ? 36 : 0
      const target = cx - CHAR_X + lead
      const ease = 1 - Math.exp(-16 / 180)
      v.cam += (target - v.cam) * ease
      const cam = v.cam
      const sx = (x: number) => x - cam
      const sy = (y: number) => SURF_Y - y

      // 배경 + 시간대 틴트
      const bg = im['plop-bg']
      if (bg?.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0, VW, VH)
      else {
        ctx.fillStyle = '#ff9d7a'
        ctx.fillRect(0, 0, VW, VH)
      }
      const tint = tintOf(st.seed)
      if (tint > 0) {
        ctx.save()
        ctx.globalCompositeOperation = 'multiply'
        ctx.fillStyle = TINT_FILL[tint]
        ctx.fillRect(0, 0, VW, VH)
        ctx.restore()
      }

      // 섬
      const sunkT = st.phase === 'over' && st.endReason === 'sunk' ? Math.max(0, (now - v.overAt) / 1000) : 0
      for (let i = Math.max(0, st.cur - 1); i <= st.cur + 4 && i < st.islands.length; i++) {
        const isl = st.islands[i]
        const x = sx(isl.cx)
        if (x < -260 || x > VW + 260) continue
        const dip = i === st.cur ? 300 * sunkT * sunkT : 0
        drawIsland(ctx, im, isl, x, SURF_Y + dip)
        if (isl.star && i > st.cur) {
          // 별 섬 표시: 섬 위에 떠서 살짝 오르내리는 별(건너뛰기 보너스 +4)
          const sp = im['star']
          const sz = 38
          const bob = reducedRef.current ? 0 : Math.sin(now / 380 + i) * 3
          if (sp?.complete && sp.naturalWidth) ctx.drawImage(sp, x - sz / 2, SURF_Y - 112 + bob, sz, sz)
          else {
            // 이미지가 아직/끝내 안 왔어도 별 표시는 사라지지 않게 글자로 대체
            ctx.font = `${sz}px sans-serif`
            ctx.textAlign = 'center'
            ctx.fillText('⭐', x, SURF_Y - 80 + bob)
          }
        }
        if (i >= 1) {
          const fl = im['plop-flower']
          if (fl?.complete && fl.naturalWidth) {
            const h = 56
            const w = (fl.naturalWidth / fl.naturalHeight) * h
            if (i === st.cur + 1 && st.phase !== 'over') {
              // 다음 섬의 꽃: 노란 후광이 숨 쉬듯 번져 '여기가 목표'임을 알려 준다
              const pulse = reducedRef.current ? 0.5 : 0.5 + 0.5 * Math.sin(now / 420)
              const gr = ctx.createRadialGradient(x, SURF_Y + dip - h * 0.55, 4, x, SURF_Y + dip - h * 0.55, 46 + 8 * pulse)
              gr.addColorStop(0, 'rgba(255,236,150,0.85)')
              gr.addColorStop(1, 'rgba(255,236,150,0)')
              ctx.fillStyle = gr
              ctx.fillRect(x - 70, SURF_Y + dip - h - 40, 140, h + 80)
            }
            const sway = reducedRef.current ? 0 : Math.sin(now / 500 + i) * 0.05
            ctx.save()
            ctx.translate(x, SURF_Y + dip + 3)
            ctx.rotate(sway)
            ctx.drawImage(fl, -w / 2, -h, w, h)
            ctx.restore()
          }
        }
      }
      // 바람 깃발: 다음 섬 오른쪽 가장자리(바람이 있을 때만)
      const nxt = st.islands[st.cur + 1]
      if (nxt && nxt.wind !== 0 && st.phase !== 'over') drawFlag(ctx, im, nxt, sx(nxt.cx - nxt.halfW * 0.5), SURF_Y, now, reducedRef.current)

      // 가라앉는 섬 링
      if (st.cur >= 1 && st.sinkLeftMs > 0 && (st.phase === 'ready' || st.phase === 'charging')) {
        const total = Math.max(1, v.sinkTotal || st.sinkLeftMs)
        const ratio = Math.min(1, st.sinkLeftMs / total)
        const urgent = st.sinkLeftMs <= 1000
        const x = sx(cur.cx)
        ctx.save()
        ctx.lineWidth = 5
        ctx.lineCap = 'round'
        ctx.strokeStyle = 'rgba(40,20,60,0.35)'
        ctx.beginPath()
        ctx.ellipse(x, SURF_Y + 4, cur.halfW + 14, 15, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = urgent ? (Math.floor(now / 160) % 2 ? '#ff5a4a' : '#ffb0a0') : '#fff3dc'
        ctx.beginPath()
        ctx.ellipse(x, SURF_Y + 4, cur.halfW + 14, 15, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio)
        ctx.stroke()
        ctx.restore()
      }

      // 첫 화면 안내: 다음 섬 꽃까지 이어지는 점선이 반짝이며 '목표 지점'을 보여 준다(첫 점프 전까지)
      if (st.phase === 'ready' && st.holds.length === 0 && st.landed === 0 && nxt && !reducedRef.current) {
        const pStar = Math.min(1, (nxt.cx - cur.cx) / rangeMax(nxt.wind))
        const pts = previewPoints(cur.cx, pStar, nxt.wind, 1, 22)
        pts.forEach((pt, i) => {
          if (i === 0 || i === pts.length - 1) return
          const wave = 0.35 + 0.65 * Math.max(0, Math.sin(now / 260 - i * 0.55))
          ctx.globalAlpha = 0.95 * wave
          ctx.fillStyle = '#fff3dc'
          ctx.strokeStyle = '#5b3a1e'
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.arc(sx(pt.x), sy(pt.y + 30), 5.4, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        })
        ctx.globalAlpha = 1
      }

      // 점선 미리보기(충전 중: 바람 반영 궤적의 앞 40%)
      const holding = st.phase === 'charging'
      const pNow = holding ? powerAt(now - st.chargeStartMs, pingOf(st.cur + 1)) : 0
      if (holding && nxt && !input.current.cancel && pNow > 0.05) {
        const pts = previewPoints(cur.cx, pNow, nxt.wind, previewFracOf(st.cur + 1), 10)
        pts.forEach((pt, i) => {
          if (i === 0) return
          const wave = reducedRef.current ? 1 : 0.6 + 0.4 * Math.sin(now / 120 - i * 0.9)
          ctx.globalAlpha = Math.max(0.35, 1 - i / 16) * wave
          ctx.lineWidth = 3
          ctx.strokeStyle = '#5b3a1e'
          ctx.fillStyle = '#fff3dc'
          ctx.beginPath()
          ctx.arc(sx(pt.x), sy(pt.y + 30), 6.2 - i * 0.14, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        })
        ctx.globalAlpha = 1
        if (pNow - v.lastTickP > 0.2 || pNow < v.lastTickP) {
          v.lastTickP = pNow
          play('charge', pNow)
        }
      }

      // 캐릭터
      let sprite: Sprite = 'mallang-idle'
      let sqx = 1
      let sqy = 1
      let rot = 0
      if (st.phase === 'over') sprite = 'mallang-dizzy'
      else if (now < v.happyUntil) sprite = 'mallang-happy'
      if (holding) {
        const sq = input.current.cancel ? 0 : pNow
        sqy = 1 - 0.38 * sq
        sqx = 1 + 0.26 * sq
      } else if (fly && f) {
        const t = f.tMs / f.durMs
        sqy = t < 0.5 ? 1.1 : 0.96
        sqx = t < 0.5 ? 0.93 : 1.04
        rot = (t - 0.5) * 0.5
      } else if (st.phase === 'ready' && !reducedRef.current) {
        const tl = now - v.landAt
        if (tl < 600) {
          const a = Math.exp(-tl / 140) * Math.sin(tl / 38) * 0.28
          sqy = 1 - a
          sqx = 1 + a
        } else {
          const b = Math.sin(now / 420) * 0.025
          sqy = 1 + b
          sqx = 1 - b
        }
      }
      const spr = im[sprite]
      if (spr?.complete && spr.naturalWidth) {
        ctx.save()
        ctx.translate(sx(cx), sy(cy) + 4)
        ctx.rotate(rot)
        ctx.scale(sqx, sqy)
        const o = outlined(spr)
        if (o) {
          const sc = CHAR_S / spr.naturalWidth
          const padPx = o.pad * sc
          ctx.drawImage(o.cv, -CHAR_S / 2 - padPx, -CHAR_S * 0.96 - padPx, o.cv.width * sc, o.cv.height * sc)
        } else ctx.drawImage(spr, -CHAR_S / 2, -CHAR_S * 0.96, CHAR_S, CHAR_S)
        ctx.restore()
      }

      // 사망 고스트: 착지 지점 표시 + 퍼센트
      if (st.phase === 'over' && f && f.kind === 'miss') {
        const gx = sx(f.landX)
        ctx.save()
        ctx.strokeStyle = '#fff3dc'
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(gx - 8, SURF_Y + 14)
        ctx.lineTo(gx + 8, SURF_Y + 30)
        ctx.moveTo(gx + 8, SURF_Y + 14)
        ctx.lineTo(gx - 8, SURF_Y + 30)
        ctx.stroke()
        const pct = Math.max(1, Math.round((Math.abs(f.dx) / rangeMax(f.wind)) * 100))
        ctx.font = `700 15px ${getComputedStyle(cv).fontFamily}`
        ctx.textAlign = 'center'
        ctx.fillStyle = '#fff3dc'
        ctx.strokeStyle = 'rgba(70,35,60,0.7)'
        ctx.lineWidth = 4
        const label = `${pct}% ${f.dx < 0 ? 'too short' : 'too far'}`
        ctx.strokeText(label, gx, SURF_Y + 52)
        ctx.fillText(label, gx, SURF_Y + 52)
        ctx.restore()
      }

      // FX
      const keep: Fx[] = []
      for (const e of fx.current) {
        const t = now - e.born
        if (t > e.life) continue
        keep.push(e)
        const a = e.kind === 'pop' ? (t / e.life < 0.6 ? 1 : 1 - (t / e.life - 0.6) / 0.4) : 1 - t / e.life
        const x0 = sx(e.x + e.vx * (t / 1000))
        const x = e.kind === 'pop' ? Math.min(VW - 70, Math.max(70, x0)) : x0
        const y = sy(e.y + e.vy * (t / 1000) - (e.kind === 'spark' ? 220 * (t / 1000) ** 2 : 0))
        ctx.save()
        ctx.globalAlpha = Math.max(0, a)
        if (e.kind === 'ripple' || e.kind === 'splash') {
          ctx.strokeStyle = e.kind === 'ripple' ? '#fff3dc' : '#ffe0f0'
          ctx.lineWidth = 3
          ctx.beginPath()
          const r = 10 + (1 - a) * (e.kind === 'ripple' ? 70 : 45)
          ctx.ellipse(x, SURF_Y + 6, r, r * 0.28, 0, 0, Math.PI * 2)
          ctx.stroke()
        } else if (e.kind === 'spark') {
          ctx.fillStyle = '#ffd95a'
          ctx.beginPath()
          ctx.arc(x, y, 3.4 * a + 1, 0, Math.PI * 2)
          ctx.fill()
        } else if (e.kind === 'pop' && e.text) {
          ctx.font = `700 25px ${getComputedStyle(cv).fontFamily}`
          ctx.textAlign = 'center'
          ctx.lineWidth = 6
          ctx.lineJoin = 'round'
          ctx.strokeStyle = '#7a3b24'
          ctx.fillStyle = e.color ?? '#fff3dc'
          ctx.strokeText(e.text, x, y)
          ctx.fillText(e.text, x, y)
        }
        ctx.restore()
      }
      fx.current = keep

      // 충전 게이지: 젤리 둘레에 링으로 표시해 시선이 한곳에 머문다. 취소 구역이면 회색.
      if (st.phase === 'ready' || st.phase === 'charging') {
        const gx = sx(cur.cx)
        const gy = SURF_Y - 40
        const cancel = input.current.cancel
        ctx.save()
        ctx.lineCap = 'round'
        if (holding) {
          ctx.lineWidth = 13
          ctx.strokeStyle = 'rgba(91,58,30,0.85)'
          ctx.beginPath()
          ctx.arc(gx, gy, 58, 0, Math.PI * 2)
          ctx.stroke()
          ctx.lineWidth = 8
          ctx.strokeStyle = cancel ? '#b8b0c0' : pNow > 0.92 ? '#fff27a' : '#ffd23f'
          ctx.beginPath()
          ctx.arc(gx, gy, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, pNow))
          ctx.stroke()
          if (cancel) {
            ctx.font = `700 26px ${getComputedStyle(cv).fontFamily}`
            ctx.textAlign = 'center'
            ctx.fillStyle = '#fff3dc'
            ctx.fillText('✕', gx, gy - 56)
          }
        } else if (!reducedRef.current) {
          ctx.strokeStyle = `rgba(255,243,220,${0.4 + 0.35 * Math.sin(now / 380)})`
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(gx, gy, 60, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      }
    },
    [play, reducedRef],
  )

  // 프레임 루프
  useEffect(() => {
    if (!ready) return
    let raf = 0
    let last: number | null = null
    const frame = (ts: number) => {
      if (last === null) last = ts
      const dt = Math.min(ts - last, 100)
      last = ts
      const st = stRef.current
      if (st) {
        tick(st, dt)
        const ev = drainEvents(st)
        if (ev.length) handle(ev, st, ts)
        draw(ts)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    const onHide = () => {
      const st = stRef.current
      if (document.hidden && st && st.phase === 'charging') {
        cancelCharge(st)
        drainEvents(st)
        input.current.cancel = false
      }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onHide)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onHide)
    }
  }, [ready, handle, draw])

  // 캔버스 크기(DPR)
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !ready) return
    const fit = () => {
      const r = cv.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(r.width * dpr)
      cv.height = Math.round((r.width * VH * dpr) / VW)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(cv)
    return () => ro.disconnect()
  }, [ready])

  // 끝났을 때 1회: 기록
  const over = ui?.phase === 'over'
  useEffect(() => {
    const s = stRef.current
    if (!s || s.phase !== 'over' || doneRef.current) return
    doneRef.current = true
    setArmed(false)
    const t = setTimeout(() => setArmed(true), 800)
    recordFinish(storageKey.replace(/^best:/, ''))
    if (!playedRef.current) {
      playedRef.current = true
      setFirstDone(true)
      try {
        localStorage.setItem('plop:played', '1')
      } catch {
        // ignore
      }
    }
    if (s.score > bestRef.current) {
      bestRef.current = s.score
      saveNum(storageKey, s.score)
      setBest(s.score)
      setNewBest(true)
    }
    // Daily 한 판이 끝남 = 오늘의 정원 완료(R5). 날짜 = 그 판을 받은 UTC 날짜. 시트는 첨벙 뒤 잠깐 있다 올린다(마지막 탭 오입력 방지 — 옛 armed 800ms와 같은 몫)
    let open: ReturnType<typeof setTimeout> | undefined
    if (modeRef.current === 'daily' && dayRef.current) {
      setDaily(recordDoneInBrowser({ slug: 'plop-landing', day: dayRef.current, primary: { label: 'points', value: s.score }, secondary: { label: 'islands', value: String(s.landed) } }))
      open = setTimeout(() => setSheetOpen(true), 800)
    }
    return () => {
      clearTimeout(t)
      clearTimeout(open)
    }
  }, [over, storageKey])

  // ── 입력 ──
  const startCharge = useCallback(
    (ts: number) => {
      const s = stRef.current
      if (!s || inputLocked(s)) return false
      unlock(tintOf(s.seed)) // 첫 사용자 입력에서 오디오 시작(자동재생 정책)
      return press(s, ts)
    },
    [unlock],
  )
  const endCharge = useCallback((ts: number, cancel: boolean) => {
    const s = stRef.current
    if (!s || s.phase !== 'charging') return
    if (cancel) cancelCharge(s)
    else release(s, ts)
    input.current.cancel = false
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t !== e.currentTarget && t instanceof Element && t.closest('button, a, input, select, textarea, [role="button"]')) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!e.repeat && !input.current.keyDown && startCharge(e.timeStamp)) input.current.keyDown = true
      } else if (e.key === 'Escape') {
        endCharge(e.timeStamp, true)
        input.current.keyDown = false
      } else if (e.key === 'r' || e.key === 'R') deal(modeRef.current)
    },
    [startCharge, endCharge, deal],
  )
  const onKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.key === ' ' || e.key === 'Enter') && input.current.keyDown) {
        input.current.keyDown = false
        endCharge(e.timeStamp, false)
      }
    },
    [endCharge],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (input.current.id !== -1 || !e.isPrimary) return
      wrapRef.current?.focus({ preventScroll: true })
      if (startCharge(e.timeStamp)) {
        input.current = { id: e.pointerId, downY: e.clientY, cancel: false, keyDown: false }
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // ignore
        }
      }
    },
    [startCharge],
  )
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== input.current.id) return
    const r = wrapRef.current?.getBoundingClientRect()
    const scale = r ? r.width / VW : 1
    input.current.cancel = input.current.downY - e.clientY >= CANCEL_DRAG_PX * scale
  }, [])
  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== input.current.id) return
      const cancel = input.current.cancel
      input.current.id = -1
      endCharge(e.timeStamp, cancel)
    },
    [endCharge],
  )
  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== input.current.id) return
      input.current.id = -1
      endCharge(e.timeStamp, true) // 시스템이 가져간 제스처는 발사가 아니라 취소
    },
    [endCharge],
  )

  // 결과 문구(링크 제외) — 채널 줄과 시스템 공유가 같은 문구를 쓴다
  const resultText = useCallback(() => {
    const s = stRef.current
    if (!s) return ''
    const daily = modeRef.current === 'daily'
    const head = daily ? `Plop Landing #${dailyNumber(dayRef.current)}` : 'Plop Landing'
    return `${head} ✅${s.landed} 🌸${s.perfects}`
  }, [])
  const share = useCallback(async () => {
    const text = resultText()
    if (!text) return
    // 터치 기기는 시스템 공유창(카카오톡·인스타그램 등 설치된 앱이 뜬다). 마우스 환경(데스크톱)의 공유창엔
    // 보통 Threads·Facebook·카카오톡이 없어서 채널 줄을 펼친다.
    const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    if (touch && typeof navigator.share === 'function') {
      sendHit('plop-landing', 'share_native') // 채널 줄과 같은 계측 체계(share_<채널>)
      try {
        await navigator.share({ text: `${text}\n${siteConfig.url}/plop-landing?ref=share-native` })
        return
      } catch (e) {
        // 공유창을 닫은 경우(AbortError)만 조용히 끝낸다. 그 밖의 실패(인앱 브라우저 등)는 채널 줄로 넘긴다.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    setShowShare((v) => !v)
  }, [resultText])

  if (!ui || !ready) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="rounded-xl bg-surface" style={{ aspectRatio: `${VW} / ${VH}` }} data-testid="plop-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const st = stRef.current!
  const playing = ui.phase === 'charging' || ui.phase === 'flying'
  const pill = 'whitespace-nowrap rounded-full border-[3px] border-[#5b3a1e] bg-[#fff3dc] px-2.5 py-0.5 text-xs font-bold text-[#5b3a1e] shadow-[0_2px_0_#3a2410]'
  const btn = 'btn-press flex h-11 min-w-11 items-center justify-center rounded-full border-[3px] border-[#5b3a1e] px-2 text-sm font-bold shadow-[0_3px_0_#3a2410] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc933]'
  const combo = 1 + 0.25 * Math.max(0, ui.streak - 1)
  const tint = tintOf(st.seed)

  return (
    <div className={`${roundFont.className} mx-auto w-full max-w-100 select-none`}>
      <div className="mb-2 flex items-center justify-between gap-2" onMouseDown={preventPointerFocus} onClick={blurAfterPointerClick}>
        <div className={`flex items-center gap-1.5 transition-opacity duration-300 ${playing ? 'opacity-25' : ''}`}>
          <span className={pill}>
            Score <b data-testid="score">{ui.score}</b>
          </span>
          <span className={pill}>
            Best <b data-testid="best">{best}</b>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {firstDone && (
            <div className={`flex overflow-hidden rounded-full border-[3px] border-[#5b3a1e] shadow-[0_3px_0_#3a2410] transition-opacity duration-300 ${playing ? 'opacity-25' : ''}`}>
              {(['daily', 'practice'] as Mode[]).map((x) => (
                <button
                  key={x}
                  onClick={() => {
                    setMode(x)
                    deal(x)
                  }}
                  aria-pressed={mode === x}
                  className={`h-11 px-3 text-xs font-bold capitalize ${mode === x ? 'bg-[#ffc933] text-[#5b3a1e]' : 'bg-[#fff3dc] text-[#8a6a44]'}`}
                >
                  {x}
                </button>
              ))}
            </div>
          )}
          <button onClick={toggleMuted} aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted} className={`${btn} bg-[#fff3dc] text-[#5b3a1e]`}>
            <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
          </button>
          <button onClick={() => deal(modeRef.current)} aria-label={over ? 'Play again' : 'Restart'} className={`${btn} bg-[#ffc933] text-[#5b3a1e] transition-opacity duration-300 ${playing ? 'opacity-25' : ''}`}>
            <span aria-hidden="true">↻</span>
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        data-testid="plop-board"
        role="group"
        aria-label="Plop Landing islands. Press and hold to charge, release to jump."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        className="relative z-[41] select-none overflow-hidden rounded-2xl border-[4px] border-[#5b3a1e] bg-[#ff9d7a] shadow-[0_5px_0_#3a2410] outline-none focus-visible:ring-2 focus-visible:ring-[#ffc933] [-webkit-touch-callout:none] [-webkit-user-select:none]"
        // 컨테이너는 touch-action을 제한하지 않는다: 가운데 게임 구역만 none(조작 전용), 위·아래 가장자리 띠는 pan-y라 손가락을 얹고 세로로 밀면 페이지가 스크롤된다.
        // (touch-action은 조상과의 교집합이라 자식이 부모의 none을 풀 수 없어 구조를 이렇게 나눴다. 스크롤이 시작되면 브라우저가 pointercancel을 보내 충전은 취소 처리된다.)
        style={{ aspectRatio: `${VW} / ${VH}`, width: 'min(100%, calc(80svh * 0.609))', marginInline: 'auto' }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" style={{ touchAction: 'pan-y' }} aria-hidden="true" />
        {/* 게임 조작 구역(가운데): 여기서는 스크롤을 막고 누르기·끌기를 게임이 받는다. 위 14%·아래 16%는 비워 둬 스크롤 띠가 된다. */}
        <div className="absolute inset-x-0 z-[3]" style={{ top: '14%', bottom: '16%', touchAction: 'none' }} aria-hidden="true" data-testid="plop-play-zone" />

        {/* 단순 HUD: 착지 수, 콤보, 시간대 */}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between gap-2 rounded-2xl px-3 py-1" style={{ background: 'linear-gradient(#fff3dc, #f3d9aa)', border: '3px solid #5b3a1e', boxShadow: '0 3px 0 #3a2410, inset 0 0 0 2px #fbeccc', color: '#5b3a1e' }}>
          <span className="flex min-w-16 items-baseline gap-1 text-lg font-bold tabular-nums" data-testid="plop-landed" aria-label={`${ui.landed} islands`}>
            🏝 {ui.landed}
            <span className="text-xs font-bold uppercase tracking-wide text-[#6b4a28]">islands</span>
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-sm font-bold tabular-nums transition-colors ${combo > 1 ? 'bg-[#ffc933] text-[#5b3a1e]' : 'text-[#8a6a44]'}`}
            aria-label={`Combo ${combo}`}
          >
            ×{combo.toFixed(2).replace(/\.?0+$/, '')}
          </span>
          <span className="min-w-16 text-right text-xs font-bold uppercase tracking-wide text-[#6b4a28]">{TINT_NAME[tint]}</span>
        </div>

        {/* 첫 화면 조작 안내: 글자 없이 손가락 아이콘만(첫 누름 뒤 사라진다) */}
        {ui.phase === 'ready' && ui.landed === 0 && st.holds.length === 0 && (
          <div className="pointer-events-none absolute z-[5] -translate-x-1/2" style={{ left: `${(CHAR_X / VW) * 100}%`, top: '30%' }} aria-hidden="true">
            <div className="flex flex-col items-center gap-0.5">
              <span className="whitespace-nowrap rounded-full border-2 border-[#5b3a1e] bg-[#fff3dc] px-2.5 py-0.5 text-xs font-bold text-[#5b3a1e]">Hold, then let go</span>
              <span className={`text-3xl ${reduced ? '' : 'animate-bounce'}`} style={{ filter: 'drop-shadow(0 2px 0 #3a2410)' }}>
                👇
              </span>
            </div>
          </div>
        )}

        <p aria-live="polite" className="sr-only">
          {announce}
        </p>

        <div style={{ pointerEvents: armed ? 'auto' : 'none' }}>
          <GameOverlay show={over && !daily} variant="lose" title={ui.reason ? END_TEXT[ui.reason] : 'Run over'} testId="game-over" tone="cozy">
            <div className="flex flex-col items-center gap-1">
              <p className="text-6xl font-bold leading-none tabular-nums" style={{ color: '#e8643f', textShadow: '0 3px 0 #fff3dc, 0 5px 0 rgba(91,58,30,0.25)' }}>
                {ui.landed}
                <span className="ml-1 text-2xl" style={{ color: '#5b3a1e', textShadow: 'none' }}>
                  islands
                </span>
              </p>
              <p className="text-base font-semibold tabular-nums">🌸 {ui.perfects} perfect</p>
              {newBest ? (
                <p>
                  <span className="rounded-full border-2 border-[#5b3a1e] bg-[#ffc933] px-2.5 py-0.5 text-sm font-bold text-[#5b3a1e]">NEW BEST · {ui.score} pts</span>
                </p>
              ) : (
                <p className="text-sm font-bold text-[#5b3a1e]">Score {ui.score}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => deal(modeRef.current)} className={`${btn} bg-[#ffc933] text-[#5b3a1e]`}>
                Play again
              </button>
              <button
                onClick={share}
                className={`${btn} bg-[#fff3dc] text-[#5b3a1e]`}
                data-testid="plop-share"
                aria-expanded={showShare}
              >
                {showShare ? 'Hide share' : 'Share'}
              </button>
            </div>
            {showShare && <ShareButtons compact slug="plop-landing" title="Plop Landing" text={resultText()} />}
          </GameOverlay>
        </div>
      </div>
      {over && daily && !sheetOpen && (
        <div className="mt-3 flex items-center justify-center gap-2" data-testid="plop-daily-done">
          <button onClick={() => setSheetOpen(true)} className={`${btn} bg-[#fff3dc] px-4 text-[#5b3a1e]`} data-testid="open-result-sheet">
            Today’s result
          </button>
          <button onClick={() => deal('daily')} className={`${btn} bg-[#fff3dc] px-4 text-[#5b3a1e]`}>
            Play again
          </button>
        </div>
      )}
      {daily && (
        <DailyResultSheet open={sheetOpen} onClose={() => setSheetOpen(false)} slug="plop-landing" gameTitle="Plop Landing" result={daily} shareText={resultText()}>
          {newBest && <p className="rounded-full border-2 border-[#5b3a1e] bg-[#fff3dc] px-2.5 py-0.5 text-sm font-bold text-[#5b3a1e]">NEW BEST · {ui.score} pts</p>}
          {hasLeaderboard('plop-landing') && <OverlayScoreSubmit slug="plop-landing" show={sheetOpen} tone="garden" />}
        </DailyResultSheet>
      )}
      <p className="sr-only">Press and hold anywhere to charge the gauge, then release to hop to the next island. Drag up before releasing to cancel. Space also works. Aim for the flower in the middle of each island.</p>
    </div>
  )
}

function drawIsland(ctx: CanvasRenderingContext2D, im: Partial<Record<Sprite, HTMLImageElement>>, isl: Island, x: number, surfY: number) {
  const small = isl.halfW < 70
  const spr = im[small ? 'plop-island-small' : 'plop-island-wide']
  if (!spr?.complete || !spr.naturalWidth) {
    ctx.fillStyle = '#7cc26a'
    ctx.fillRect(x - isl.halfW, surfY - 6, isl.halfW * 2, 30)
    return
  }
  const topW = small ? 0.86 : 0.93
  const w = (isl.halfW * 2) / topW
  const h = (spr.naturalHeight / spr.naturalWidth) * w
  const top = (small ? TOP_FRAC.small : TOP_FRAC.wide) * h
  ctx.drawImage(spr, x - w / 2, surfY - top, w, h)
}

function drawFlag(ctx: CanvasRenderingContext2D, im: Partial<Record<Sprite, HTMLImageElement>>, isl: Island, x: number, surfY: number, now: number, reduced: boolean) {
  const spr = im['plop-flag']
  if (!spr?.complete || !spr.naturalWidth) return
  const strength = Math.min(1, Math.abs(isl.wind) / 0.15)
  const size = 64 + 12 * strength
  const dir = isl.wind > 0 ? 1 : -1 // 순풍(+)이면 오른쪽으로 펄럭
  const sway = reduced ? 0 : Math.sin(now / (260 - 120 * strength)) * (0.06 + 0.08 * strength)
  ctx.save()
  ctx.translate(x, surfY + 2)
  ctx.scale(dir, 1)
  ctx.rotate(sway)
  const o = outlined(spr)
  if (o) {
    const sc = size / spr.naturalWidth
    const padPx = o.pad * sc
    ctx.drawImage(o.cv, -size * 0.18 - padPx, -size - padPx, o.cv.width * sc, o.cv.height * sc)
  } else ctx.drawImage(spr, -size * 0.18, -size, size, size)
  ctx.restore()
  // 바람 줄(세기 1~3)
  ctx.save()
  ctx.strokeStyle = '#fff3dc'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  const n = strength > 0.66 ? 3 : strength > 0.33 ? 2 : 1
  for (let i = 0; i < n; i++) {
    const yy = surfY - 70 - i * 10
    const off = reduced ? 0 : ((now / 6 + i * 20) % 30) - 15
    ctx.beginPath()
    ctx.moveTo(x - dir * 4 + off * dir, yy)
    ctx.lineTo(x - dir * 4 + off * dir + dir * 22, yy)
    ctx.stroke()
  }
  ctx.restore()
}

function preventPointerFocus(e: React.MouseEvent<HTMLDivElement>) {
  const b = e.target instanceof Element ? e.target.closest('button') : null
  if (e.button === 0 && b instanceof HTMLElement && e.currentTarget.contains(b)) e.preventDefault()
}
function blurAfterPointerClick(e: React.MouseEvent<HTMLDivElement>) {
  if (e.detail > 0) {
    const b = e.target instanceof Element ? e.target.closest('button') : null
    if (b instanceof HTMLElement) b.blur()
  }
}
