'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PlayZone, inPlayZone } from '@/components/game-shell/PlayZone'
import { useSlimeAudio } from '@/lib/sound/useSlimeAudio'
import { simulate } from '@/lib/games/slime/engine'
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
    const im = new Image()
    im.src = '/art/mallang-idle.webp'
    img.current = im
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
      const k = (w / BOARD_W) * (window.devicePixelRatio || 1)
      g.setTransform(k, 0, 0, k, 0, 0)
      const grd = g.createLinearGradient(0, 0, 0, BOARD_H)
      grd.addColorStop(0, '#2b2250')
      grd.addColorStop(1, '#4a3a7a')
      g.fillStyle = grd
      g.fillRect(0, 0, BOARD_W, BOARD_H)
      g.lineCap = 'round'
      g.lineJoin = 'round'
      // 지형
      g.strokeStyle = '#a07040'
      g.lineWidth = 8
      for (const s of stage.terrain) {
        g.beginPath()
        g.moveTo(s.a.x, s.a.y)
        g.lineTo(s.b.x, s.b.y)
        g.stroke()
      }
      // 스폰 금지 링
      g.setLineDash([4, 6])
      g.strokeStyle = 'rgba(255,255,255,0.35)'
      g.lineWidth = 2
      g.beginPath()
      g.arc(stage.spawn.x, stage.spawn.y, CONST.SPAWN_BAN_R, 0, Math.PI * 2)
      g.stroke()
      g.setLineDash([])
      // 둥지·도토리·밤송이
      g.font = '26px sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('🪺', stage.nest.x, stage.nest.y)
      for (const a of stage.acorns) g.fillText('🌰', a.x, a.y)
      for (const s of stage.spikes) g.fillText('🌵', s.x, s.y)
      // 지난 시도(고스트)
      if (ghost.current && phase !== 'run') drawLine(g, ghost.current, 'rgba(255,255,255,0.18)', 5)
      // 내 선
      const cur = line.current ?? (raw.current.length > 1 ? capInk(dropClose(raw.current), stage.ink) : null)
      if (cur) drawLine(g, cur, '#f4f0ff', 5)
      // 말랑이
      let sp: Pt = stage.spawn
      if (phase === 'run' || phase === 'done') {
        const tr = trace.current
        const el = Math.max(0, t - runStart.current - 500) / TRACE_MS
        if (tr.length) {
          const i = Math.min(tr.length - 1, Math.floor(el))
          const j = Math.min(tr.length - 1, i + 1)
          const f = Math.min(1, el - i)
          sp = phase === 'done' ? tr[tr.length - 1] : { x: tr[i].x + (tr[j].x - tr[i].x) * f, y: tr[i].y + (tr[j].y - tr[i].y) * f }
          if (phase === 'run' && el >= tr.length - 1 && result.current) finish()
        }
      }
      if (phase === 'run') {
        stage.acorns.forEach((a, i) => {
          if (!gotAcorns.current.has(i) && dist(sp, a) < CONST.ACORN_R) {
            gotAcorns.current.add(i)
            play('acorn', gotAcorns.current.size)
          }
        })
      }
      const im = img.current
      if (im?.complete && im.naturalWidth) g.drawImage(im, sp.x - 22, sp.y - 26, 44, 44)
      else {
        g.fillStyle = '#5fe0e8'
        g.beginPath()
        g.arc(sp.x, sp.y, CONST.R, 0, Math.PI * 2)
        g.fill()
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
