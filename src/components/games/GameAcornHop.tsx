'use client'

import { PlayZone, inPlayZone } from '@/components/game-shell/PlayZone'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AMMO_MAX,
  ISLAND_W,
  VIEW_H,
  W,
  cameraTop,
  createGame,
  dailySeedFor,
  heightM,
  isOver,
  objX,
  objectsInRange,
  previewPath,
  step,
  type HopState,
  type Side,
} from '@/lib/games/acornhop/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordFinish } from '@/lib/gameStats'
import { todayUTC } from '@/lib/dailyDate'
import { GameOverlay } from '@/components/game-shell'
import { roundFont } from '@/app/fonts'

type Mode = 'daily' | 'practice'
type Sprite = 'bg-sky' | 'cloud-a' | 'cloud-b' | 'star' | 'acorn' | 'bramble' | 'storm' | 'island' | 'tori-idle' | 'tori-aim' | 'tori-fire' | 'tori-happy' | 'tori-dizzy'
const SPRITES: Sprite[] = ['bg-sky', 'cloud-a', 'cloud-b', 'star', 'acorn', 'bramble', 'storm', 'island', 'tori-idle', 'tori-aim', 'tori-fire', 'tori-happy', 'tori-dizzy']
const TICK_MS = 1000 / 60
const QUEUE_MAX = 2
const END_TEXT: Record<'fell' | 'brambled' | 'stormed', string> = {
  fell: 'Fell back to the clouds',
  brambled: 'Tangled in the brambles',
  stormed: 'Zapped by a storm cloud',
}

function loadBest(key: string): number {
  try {
    const n = Number(localStorage.getItem(key) ?? 0)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}
function saveBest(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v))
  } catch {
    // ignore
  }
}
const seedForDay = (iso: string) => dailySeedFor(Number(iso.replace(/-/g, '')))
const freshSeed = () => (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0

interface Fx {
  kind: 'acorn' | 'puff' | 'spark' | 'flash' | 'trail'
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  rot: number
}

export function GameAcornHop({ storageKey }: { storageKey: string }) {
  const [state, setState] = useState<HopState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [ready, setReady] = useState(false)
  // 연타 중 죽으면 오버레이가 엄지 밑에 뜬다 — 마지막 탭이 '다음 게임' 링크를 누르지 않게 잠깐 터치를 막는다.
  const [armed, setArmed] = useState(true)
  const [flash, setFlash] = useState<{ side: Side; n: number } | null>(null)
  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<HopState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const queueRef = useRef<Side[]>([])
  const imgs = useRef<Partial<Record<Sprite, HTMLImageElement>>>({})
  const fx = useRef<Fx[]>([])
  const vis = useRef({ cam: 0, tapAt: -99, happyAt: -99, shake: 0, lastSide: 1 as Side, squash: 0, trailTick: -1 })
  const bestRef = useRef(0)
  const doneRef = useRef(false)

  const commit = useCallback((s: HopState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const deal = useCallback(
    (m: Mode) => {
      modeRef.current = m
      const seed = m === 'daily' ? seedForDay(todayUTC()) : freshSeed()
      queueRef.current = []
      fx.current = []
      vis.current = { cam: cameraTop({ minY: 0 }), tapAt: -99, happyAt: -99, shake: 0, lastSide: 1, squash: 0, trailTick: -1 }
      doneRef.current = false
      setArmed(true)
      setNewBest(false)
      setAnnounce('')
      commit(createGame(seed))
    },
    [commit],
  )

  // 스프라이트 로드 + 첫 판
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
    const b = loadBest(storageKey)
    bestRef.current = b
    setBest(b)
    deal('daily')
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const emit = useCallback(
    (s: HopState) => {
      const v = vis.current
      for (const e of s.events) {
        if (e === 'tap') {
          play('move')
          v.tapAt = s.tick
          v.squash = 1
          if (!reducedRef.current) {
            const dir = -v.lastSide
            fx.current.push({ kind: 'acorn', x: s.x, y: s.y + 8, vx: dir * 2.6, vy: 3.2, life: 0, max: 46, rot: 0 })
            fx.current.push({ kind: 'flash', x: s.x + dir * 12, y: s.y + 12, vx: 0, vy: 0, life: 0, max: 8, rot: dir })
            for (let i = 0; i < 4; i++) fx.current.push({ kind: 'puff', x: s.x + dir * 6, y: s.y + 10, vx: dir * (0.6 + i * 0.35), vy: 0.7 + i * 0.25, life: 0, max: 22 + i * 4, rot: 0 })
          }
        } else if (e === 'star') {
          play('eat')
          v.happyAt = s.tick
          if (!reducedRef.current) for (let i = 0; i < 7; i++) fx.current.push({ kind: 'spark', x: s.x, y: s.y, vx: Math.cos(i * 0.9) * 1.8, vy: Math.sin(i * 0.9) * 1.8 - 0.6, life: 0, max: 26, rot: 0 })
          setAnnounce(`${s.stars} stars`)
        } else if (e === 'acorn') {
          play('match')
          v.happyAt = s.tick
          setAnnounce('Acorns refilled')
        } else if (e === 'land') {
          play('flag')
          setAnnounce('Landed on a rest island')
        } else if (e === 'dry') play('error')
        else if (e === 'bounce') v.shake = Math.max(v.shake, reducedRef.current ? 0 : 3)
        else if (e === 'hit' || e === 'fall') {
          play('lose')
          v.shake = reducedRef.current ? 0 : 8
        }
      }
    },
    [play, reducedRef],
  )

  // 고정 60Hz 틱
  useEffect(() => {
    if (!ready) return
    let raf = 0
    let last: number | null = null
    let acc = 0
    const frame = (ts: number) => {
      if (last === null) last = ts
      acc += Math.min(ts - last, 100)
      last = ts
      let s = stateRef.current
      if (s && !isOver(s)) {
        let n = 0
        let changed = false
        while (acc >= TICK_MS && n < 4) {
          const side = queueRef.current.shift()
          s = step(s, side ? { tap: side } : null)
          acc -= TICK_MS
          n++
          changed = true
          if (s.events.length) emit(s)
          if (isOver(s)) break
        }
        if (n === 4) acc = Math.min(acc, TICK_MS)
        if (changed) {
          stateRef.current = s
          // 점수·탄 HUD는 상태로, 매 프레임 setState는 부담이라 틱마다만
          setState(s)
        }
      } else acc = 0
      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, emit])

  // 끝났을 때 1회: 기록
  const over = state ? isOver(state) : false
  useEffect(() => {
    const s = stateRef.current
    if (!s || !isOver(s) || doneRef.current) return
    doneRef.current = true
    setArmed(false)
    const t = setTimeout(() => setArmed(true), 800)
    recordFinish(storageKey.replace(/^best:/, ''))
    if (s.score > bestRef.current) {
      bestRef.current = s.score
      saveBest(storageKey, s.score)
      setBest(s.score)
      setNewBest(true)
    }
    return () => clearTimeout(t)
  }, [over, storageKey])

  const sideFromEvent = (clientX: number): Side => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return 1
    return clientX < r.left + r.width / 2 ? -1 : 1
  }
  const tap = useCallback((side: Side) => {
    const s = stateRef.current
    if (!s || isOver(s)) return
    vis.current.lastSide = side
    if (queueRef.current.length < QUEUE_MAX) queueRef.current.push(side)
    setFlash((f) => ({ side, n: (f?.n ?? 0) + 1 }))
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t !== e.currentTarget && t instanceof Element && t.closest('button, a, input, select, textarea, [role="button"]')) return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        tap(-1)
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        tap(1)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!e.repeat) tap(vis.current.lastSide)
      } else if (e.key === 'r' || e.key === 'R') deal(modeRef.current)
    },
    [tap, deal],
  )

  function draw() {
    const cv = canvasRef.current
    const s = stateRef.current
    if (!cv || !s) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cssW = cv.clientWidth
    if (!cssW) return
    const px = Math.round(cssW * dpr)
    if (cv.width !== px) {
      cv.width = px
      cv.height = Math.round(px * (VIEW_H / W))
    }
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const k = cv.width / W
    const v = vis.current
    const im = imgs.current
    const target = cameraTop(s)
    v.cam += (target - v.cam) * 0.18
    const cam = v.cam
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cv.width, cv.height)
    const sh = v.shake > 0.2 ? (Math.random() - 0.5) * v.shake : 0
    v.shake *= 0.85
    ctx.setTransform(k, 0, 0, k, sh * k, sh * k)
    const img = (n: Sprite) => {
      const i = im[n]
      return i && i.complete && i.naturalWidth ? i : null
    }
    const sky = img('bg-sky')
    if (sky) {
      // cover: 비율을 유지한 채 채우고, 위로 올라갈수록 아주 천천히 흘러내리는 시차
      const sc = Math.max(W / sky.naturalWidth, VIEW_H / sky.naturalHeight)
      const dw = sky.naturalWidth * sc
      const dh = sky.naturalHeight * sc
      const drift = Math.min(dh - VIEW_H, Math.max(0, -cam * 0.02))
      ctx.drawImage(sky, (W - dw) / 2, -drift, dw, dh)
      // 배경의 장식 별이 수집용 별과 섞이지 않게 한 겹 어둡게 눌러 뒤로 밀어 낸다
      ctx.fillStyle = 'rgba(20, 18, 58, 0.34)'
      ctx.fillRect(0, 0, W, VIEW_H)
    }
    else {
      ctx.fillStyle = '#1d1b4a'
      ctx.fillRect(0, 0, W, VIEW_H)
    }
    // 시차 구름(월드 좌표를 카메라에 곱해 천천히)
    const cloudLayer = (name: Sprite, f: number, count: number, size: number, alpha: number, salt: number) => {
      const c = img(name)
      if (!c) return
      ctx.globalAlpha = alpha
      const span = 760
      for (let i = 0; i < count; i++) {
        const bx = ((i * 137 + salt * 53) % 300) - 20
        const by = (i * (span / count) + salt * 71 - cam * f) % span
        const y = by < 0 ? by + span : by
        ctx.drawImage(c, bx, y - 80, size, size * (c.naturalHeight / c.naturalWidth))
      }
      ctx.globalAlpha = 1
    }
    cloudLayer('cloud-b', 0.22, 4, 70, 0.16, 3)
    cloudLayer('cloud-a', 0.4, 4, 100, 0.24, 1)

    const tNow = s.tick
    const objs = objectsInRange(s.seed, cam - 40, cam + VIEW_H + 40)
    for (const o of objs) {
      if (s.taken.includes(o.id)) continue
      const sy = o.y - cam
      if (sy < -60 || sy > VIEW_H + 60) continue
      const ox = objX(o, tNow)
      if (o.kind === 'island') {
        const i = img('island')
        if (i) {
          const w = ISLAND_W * 1.12
          const h = w * (i.naturalHeight / i.naturalWidth)
          ctx.drawImage(i, o.x - w / 2, sy - h * 0.27, w, h)
        }
      } else if (o.kind === 'star') {
        const i = img('star')
        if (i) {
          const bob = reduced ? 0 : Math.sin(tNow / 18 + o.x) * 2.5
          ctx.save()
          ctx.shadowColor = 'rgba(255, 214, 80, 0.95)'
          ctx.shadowBlur = reduced ? 6 : 8 + Math.sin(tNow / 14 + o.y) * 4
          ctx.drawImage(i, ox - 18, sy - 18 + bob, 36, 36)
          ctx.restore()
        }
      } else if (o.kind === 'acorn') {
        const i = img('acorn')
        if (i) {
          const bob = reduced ? 0 : Math.sin(tNow / 20 + o.y) * 2
          ctx.drawImage(i, ox - 15, sy - 15 + bob, 30, 30)
        }
      } else if (o.kind === 'bramble') {
        const i = img('bramble')
        if (i) {
          ctx.save()
          ctx.translate(ox, sy)
          if (!reduced) ctx.rotate(tNow / 160)
          ctx.drawImage(i, -27, -27, 54, 54)
          ctx.restore()
        }
      } else if (o.kind === 'storm') {
        const i = img('storm')
        if (i) ctx.drawImage(i, ox - 28, sy - 24, 56, 56)
      }
    }

    // 미리보기(준비 상태·쉼터 위에서만)
    if ((s.phase === 'ready' || s.grounded) && s.ammo > 0) {
      const pts = previewPath(s, v.lastSide, 36)
      ctx.fillStyle = 'rgba(255, 243, 220, 0.75)'
      pts.forEach((p, i) => {
        ctx.globalAlpha = 0.85 - i * 0.05
        ctx.beginPath()
        ctx.arc(p.x, p.y - cam, 2.2, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1
    }

    // 빠르게 움직일 때 잔상(속도감)
    if (!reduced && s.phase === 'flying' && !s.grounded && Math.hypot(s.vx, s.vy) > 1.6 && s.tick % 2 === 0 && v.trailTick !== s.tick) {
      v.trailTick = s.tick
      fx.current.push({ kind: 'trail', x: s.x, y: s.y + 6, vx: 0, vy: 0.2, life: 0, max: 16, rot: 0 })
    }
    // 토리
    const tapAge = tNow - v.tapAt
    const happyAge = tNow - v.happyAt
    const over = s.phase === 'over'
    const pose: Sprite = over ? 'tori-dizzy' : tapAge < 9 ? 'tori-fire' : happyAge < 26 ? 'tori-happy' : s.grounded || s.phase === 'ready' ? 'tori-idle' : 'tori-aim'
    const t = img(pose)
    if (t) {
      const size = 66
      const flip = pose === 'tori-fire' ? s.facing > 0 : s.facing < 0
      v.squash *= 0.86
      const sq = reduced ? 0 : v.squash
      const vyk = Math.max(-1, Math.min(1, -s.vy / 5))
      const sy2 = 1 + sq * -0.16 + vyk * 0.06 + (s.grounded && !reduced ? Math.sin(tNow / 22) * 0.02 : 0)
      const sx2 = 1 + sq * 0.14 - vyk * 0.04
      ctx.save()
      ctx.translate(s.x, s.y - cam + 4)
      ctx.rotate(reduced ? 0 : s.vx * 0.07)
      ctx.scale((flip ? -1 : 1) * sx2, sy2)
      ctx.drawImage(t, -size / 2, -size * 0.62, size, size)
      ctx.restore()
    }

    // 이펙트
    const list = fx.current
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i]
      f.life++
      if (f.life > f.max) {
        list.splice(i, 1)
        continue
      }
      f.x += f.vx
      f.y += f.vy
      if (f.kind === 'acorn') f.vy += 0.16
      if (f.kind === 'puff') {
        f.vx *= 0.94
        f.vy *= 0.94
      }
      const a = 1 - f.life / f.max
      const y = f.y - cam
      ctx.globalAlpha = Math.max(0, a)
      if (f.kind === 'acorn') {
        ctx.strokeStyle = 'rgba(255, 243, 220, 0.75)'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(f.x - f.vx * 4, y - f.vy * 4)
        ctx.lineTo(f.x, y)
        ctx.stroke()
        const i2 = img('acorn')
        f.rot += 0.3
        if (i2) {
          ctx.save()
          ctx.translate(f.x, y)
          ctx.rotate(f.rot)
          ctx.drawImage(i2, -7, -7, 14, 14)
          ctx.restore()
        }
      } else if (f.kind === 'flash') {
        const r = 7 + f.life * 1.6
        const g = ctx.createRadialGradient(f.x, y, 0, f.x, y, r)
        g.addColorStop(0, 'rgba(255,243,200,0.95)')
        g.addColorStop(0.5, 'rgba(255,170,60,0.65)')
        g.addColorStop(1, 'rgba(255,120,40,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(f.x, y, r, 0, Math.PI * 2)
        ctx.fill()
      } else if (f.kind === 'trail') {
        ctx.fillStyle = '#cfe9ff'
        ctx.beginPath()
        ctx.arc(f.x, y, 7 * a + 1, 0, Math.PI * 2)
        ctx.fill()
      } else if (f.kind === 'puff') {
        ctx.fillStyle = '#fff3dc'
        ctx.beginPath()
        ctx.arc(f.x, y, 3 + f.life * 0.18, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillStyle = '#ffc933'
        ctx.beginPath()
        ctx.arc(f.x, y, 2.4 * a + 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    // 도토리가 떨어지면 머리 위에 '빈 주머니' 말풍선(글자 없이 아이콘으로)
    if (!over && s.phase === 'flying' && s.ammo === 0 && !s.grounded) {
      const bx = Math.min(W - 22, Math.max(22, s.x))
      const by = s.y - cam - 46
      const pulse = reduced ? 1 : 1 + Math.sin(tNow / 5) * 0.08
      ctx.save()
      ctx.translate(bx, by)
      ctx.scale(pulse, pulse)
      ctx.fillStyle = '#fff3dc'
      ctx.strokeStyle = '#5b3a1e'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(0, 0, 15, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-4, 13)
      ctx.lineTo(0, 21)
      ctx.lineTo(4, 13)
      ctx.fill()
      const ac = img('acorn')
      if (ac) {
        ctx.globalAlpha = 0.5
        ctx.drawImage(ac, -9, -9, 18, 18)
        ctx.globalAlpha = 1
      }
      ctx.strokeStyle = '#d94a3d'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(-8, -8)
      ctx.lineTo(8, 8)
      ctx.moveTo(8, -8)
      ctx.lineTo(-8, 8)
      ctx.stroke()
      ctx.restore()
    }
    // 탄이 0일 때 화면 아래쪽 위험 안내(붉은 가장자리)
    if (!over && s.phase === 'flying' && s.ammo === 0 && !s.grounded) {
      const g = ctx.createLinearGradient(0, VIEW_H - 60, 0, VIEW_H)
      g.addColorStop(0, 'rgba(255,77,109,0)')
      g.addColorStop(1, 'rgba(255,77,109,0.35)')
      ctx.fillStyle = g
      ctx.fillRect(0, VIEW_H - 60, W, 60)
    }
  }

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="aspect-[2/3] rounded-xl bg-surface" data-testid="acornhop-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const s = state
  const m = heightM(s.minY)
  const low = !over && s.phase === 'flying' && s.ammo <= 1
  const playing = s.phase === 'flying' && !over
  const pill = 'whitespace-nowrap rounded-full border-[3px] border-[#5b3a1e] bg-[#fff3dc] px-2.5 py-0.5 text-xs font-bold text-[#5b3a1e] shadow-[0_2px_0_#3a2410]'
  const btn = 'btn-press flex h-11 min-w-11 items-center justify-center rounded-full border-[3px] border-[#5b3a1e] px-2 text-sm font-bold shadow-[0_3px_0_#3a2410] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc933]'

  return (
    <div className={`${roundFont.className} mx-auto w-full max-w-100 select-none`}>
      {/* 한 줄 컴팩트 헤더. 플레이 중엔 흐려져 수직 시야를 비워 준다(소리 버튼은 그대로). */}
      <div className="mb-2 flex items-center justify-between gap-2" onMouseDown={preventPointerFocus} onClick={blurAfterPointerClick}>
        <div className={`flex items-center gap-1.5 transition-opacity duration-300 ${playing ? 'opacity-25' : ''}`}>
          <span className={pill}>
            Score <b data-testid="score">{s.score}</b>
          </span>
          <span className={pill}>
            Best <b data-testid="best">{best}</b>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
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
          <button onClick={toggleMuted} aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted} className={`${btn} bg-[#fff3dc] text-[#5b3a1e]`}>
            <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
          </button>
          <button onClick={() => deal(modeRef.current)} aria-label={over ? 'Play again' : modeRef.current === 'daily' ? 'Replay the daily sky' : 'Start a new run'} className={`${btn} bg-[#ffc933] text-[#5b3a1e] transition-opacity duration-300 ${playing ? 'opacity-25' : ''}`}>
            <span aria-hidden="true">↻</span>
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        data-testid="acornhop-board"
        role="group"
        aria-label="Acorn Hop sky"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if (!inPlayZone(e)) return // 위·아래 스크롤 띠에서 시작한 터치는 게임 입력이 아니다
          if (e.pointerType === 'mouse' && e.button !== 0) return
          wrapRef.current?.focus({ preventScroll: true })
          tap(sideFromEvent(e.clientX))
        }}
        className="relative overflow-hidden rounded-2xl border-[4px] border-[#5b3a1e] bg-[#1d1b4a] shadow-[0_5px_0_#3a2410] outline-none focus-visible:ring-2 focus-visible:ring-[#ffc933]"
        style={{ aspectRatio: `${W} / ${VIEW_H}` }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />

        {/* 조작 구역: 위·아래 15%는 페이지 스크롤 띠(보드가 세로로 커서 필수). 핸들러는 보드 div에 두고 inPlayZone으로 거른다. */}
        <PlayZone top={0.15} bottom={0.15} className="cursor-pointer" />

        {/* 도토리 나무판 HUD: 높이·도토리 주머니·별. 탄이 1발 이하면 테두리가 붉게 깜빡인다. */}
        <div
          className={`pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between gap-2 rounded-2xl px-3 py-1 ${low && !reduced ? 'animate-pulse' : ''}`}
          style={{ background: 'linear-gradient(#fff3dc, #f3d9aa)', border: `3px solid ${low ? '#d94a3d' : '#5b3a1e'}`, boxShadow: '0 3px 0 #3a2410, inset 0 0 0 2px #fbeccc', color: '#5b3a1e' }}
        >
          <span className="min-w-12 text-lg font-bold tabular-nums" data-testid="acornhop-height">
            {m} m
          </span>
          <span className="flex items-center gap-px" aria-label={`${s.ammo} acorns left`} role="img" data-testid="acornhop-ammo">
            {Array.from({ length: AMMO_MAX }, (_, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src="/art/acorn.webp" alt="" width={18} height={18} draggable={false} style={i < s.ammo ? undefined : { filter: 'brightness(0)', opacity: 0.38 }} />
            ))}
          </span>
          <span className="min-w-12 text-right text-lg font-bold tabular-nums">★ {s.stars}</span>
        </div>

        {/* 첫 화면 조작 안내: 글자 대신 중앙 점선과 좌우 탭 아이콘. 첫 탭 뒤 사라진다. */}
        {s.phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden="true">
            <div className="absolute inset-y-0 left-1/2 w-0 border-l-[3px] border-dashed border-[#fff3dc]/35" />
            {([-1, 1] as Side[]).map((side) => (
              <div key={side} className={`absolute bottom-[14%] flex w-1/2 flex-col items-center gap-1 ${side < 0 ? 'left-0' : 'right-0'}`}>
                <span className={`text-4xl ${reduced ? '' : 'animate-bounce'}`} style={{ filter: 'drop-shadow(0 2px 0 #3a2410)' }}>
                  👆
                </span>
                <span className="rounded-full border-2 border-[#5b3a1e] bg-[#fff3dc] px-2.5 py-0.5 text-sm font-bold text-[#5b3a1e]">{side < 0 ? '↖ Tap' : 'Tap ↗'}</span>
              </div>
            ))}
          </div>
        )}

        {/* 탭한 쪽 가장자리가 0.2초 번쩍여 입력이 들어갔음을 알려 준다 */}
        {flash && !reduced && (
          <div
            key={flash.n}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 z-[4] w-1/3"
            style={{
              [flash.side < 0 ? 'left' : 'right']: 0,
              background: `linear-gradient(to ${flash.side < 0 ? 'right' : 'left'}, rgba(255, 243, 220, 0.38), rgba(255, 243, 220, 0))`,
              animation: 'ah-flash 0.22s ease-out forwards',
            }}
          />
        )}
        <style>{'@keyframes ah-flash { from { opacity: 1 } to { opacity: 0 } }'}</style>

        <p aria-live="polite" className="sr-only">
          {announce}
        </p>

        <div style={{ pointerEvents: armed ? 'auto' : 'none' }}>
          <GameOverlay show={over} variant="lose" title={s.endReason ? END_TEXT[s.endReason] : 'Run over'} testId="game-over" tone="cozy">
            <div className="flex flex-col items-center gap-1">
              <p className="text-5xl font-bold leading-none tabular-nums">
                {m}
                <span className="ml-1 text-2xl">m</span>
              </p>
              <p className="text-base font-semibold tabular-nums">
                ★ {s.stars} <span className="text-sm text-[#7a5230]">(+{s.stars * 15})</span>
              </p>
              {newBest ? (
                <p>
                  <span className="rounded-full border-2 border-[#5b3a1e] bg-[#ffc933] px-2.5 py-0.5 text-sm font-bold text-[#5b3a1e]">NEW BEST · {s.score} pts</span>
                </p>
              ) : (
                <p className="text-sm font-bold text-[#5b3a1e]">Score {s.score}</p>
              )}
              <p className="text-sm font-semibold text-[#5b3a1e]">Tip: rest islands refill your acorn pouch</p>
            </div>
            <button onClick={() => deal(modeRef.current)} className={`${btn} bg-[#ffc933] text-[#5b3a1e]`}>
              Play again
            </button>
          </GameOverlay>
        </div>
      </div>
      <p className="sr-only">Tap the left or right half of the sky. Tori fires an acorn down and rockets up toward that side. Arrow keys or A and D also work.</p>
    </div>
  )
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
