'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildTargets, strokeStats, type Sample, type StrokeStats } from '@/lib/strokeSample'

type Done = { id: string; samples: Sample[]; stats: StrokeStats }
const ASPECT = 1.25

/** 임시 수집 도구(오너 폰 전용): 점선 경로를 손가락으로 따라 그리면 흔들림·속도·시작/끝 오차를 기록한다. 서버로 보내지 않고, 끝나면 JSON을 복사한다. */
export function StrokeSampler() {
  const targets = useMemo(() => buildTargets(), [])
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [w, setW] = useState(340)
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState<Done[]>([])
  const cur = useRef<Sample[]>([])
  const [msg, setMsg] = useState('')
  const finished = idx >= targets.length

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const update = () => setW(Math.max(240, Math.min(380, Math.floor(el.clientWidth))))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const draw = useCallback(() => {
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const h = Math.round(w * ASPECT)
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
    const g = c.getContext('2d')
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const t = targets[Math.min(idx, targets.length - 1)]
    if (!t) return
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.setLineDash([6, 8])
    g.strokeStyle = 'rgba(160,170,200,0.7)'
    g.lineWidth = 3
    g.beginPath()
    t.pts.forEach((p, i) => (i ? g.lineTo(p.x * w, p.y * w) : g.moveTo(p.x * w, p.y * w)))
    g.stroke()
    g.setLineDash([])
    const a = t.pts[0]
    const b = t.pts[t.pts.length - 1]
    g.fillStyle = '#3ddc97'
    g.beginPath()
    g.arc(a.x * w, a.y * w, 9, 0, 7)
    g.fill()
    g.fillStyle = '#ff6b6b'
    g.beginPath()
    g.arc(b.x * w, b.y * w, 9, 0, 7)
    g.fill()
    const s = cur.current
    if (s.length > 1) {
      g.strokeStyle = '#ffd166'
      g.lineWidth = 4
      g.beginPath()
      s.forEach((p, i) => (i ? g.lineTo(p.x * w, p.y * w) : g.moveTo(p.x * w, p.y * w)))
      g.stroke()
    }
  }, [w, idx, targets])
  useEffect(draw, [draw])

  const pos = (e: React.PointerEvent): Sample => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / w, y: (e.clientY - r.top) / w, t: Math.round(e.timeStamp) }
  }
  const onDown = (e: React.PointerEvent) => {
    if (finished) return
    e.currentTarget.setPointerCapture(e.pointerId)
    cur.current = [pos(e)]
    draw()
  }
  const onMove = (e: React.PointerEvent) => {
    if (!cur.current.length) return
    const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? []
    const r = canvas.current!.getBoundingClientRect()
    if (evs.length > 1) for (const ce of evs) cur.current.push({ x: (ce.clientX - r.left) / w, y: (ce.clientY - r.top) / w, t: Math.round(ce.timeStamp) })
    else cur.current.push(pos(e))
    draw()
  }
  const onUp = (e: React.PointerEvent) => {
    const s = cur.current
    cur.current = []
    if (s.length < 5) return draw() // 탭·너무 짧은 획은 무시
    s.push(pos(e))
    const stats = strokeStats(s, targets[idx].pts, w)
    setDone((d) => [...d, { id: targets[idx].id, samples: s, stats }])
    setIdx((i) => i + 1)
  }
  const onCancel = () => {
    cur.current = [] // 취소는 취소: 획을 저장하지 않는다
    draw()
  }
  const undo = () => {
    if (!done.length) return
    setDone((d) => d.slice(0, -1))
    setIdx((i) => i - 1)
  }

  const summary = useMemo(() => {
    if (!done.length) return null
    const rms = done.map((d) => d.stats.rms).sort((a, b) => a - b)
    const med = rms[Math.floor(rms.length / 2)]
    const mean = (f: (s: StrokeStats) => number) => done.reduce((s, d) => s + f(d.stats), 0) / done.length
    return { med, startErr: mean((s) => s.startErr), endErr: mean((s) => s.endErr), speed: mean((s) => s.meanSpeed) }
  }, [done])

  const payload = () =>
    JSON.stringify({
      v: 1,
      canvasW: w,
      aspect: ASPECT,
      dpr: window.devicePixelRatio || 1,
      viewport: [window.innerWidth, window.innerHeight],
      touch: navigator.maxTouchPoints,
      strokes: done.map((d) => ({ id: d.id, stats: d.stats, pts: d.samples.map((s) => [Math.round(s.x * 1000), Math.round(s.y * 1000), s.t - d.samples[0].t]) })),
    })
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload())
      setMsg('복사됐어요. 채팅창에 붙여넣어 주세요.')
    } catch {
      setMsg('복사에 실패했어요. 아래 상자를 길게 눌러 전체 선택 후 복사해 주세요.')
    }
  }

  const t = targets[Math.min(idx, targets.length - 1)]
  return (
    <div ref={wrap} className="mx-auto w-full max-w-[380px]">
      <p className="mb-1 text-center text-sm text-fg-muted">
        {finished ? '20개 완료!' : `${idx + 1} / ${targets.length} · ${t.label}`}
      </p>
      <p className="mb-2 text-center text-xs text-fg-muted">초록 점에서 시작해 점선을 따라 빨간 점까지, 한 번에 그어 주세요. 평소 게임하듯 편한 속도로.</p>
      <canvas
        ref={canvas}
        style={{ width: w, height: Math.round(w * ASPECT), touchAction: 'none' }}
        className="mx-auto block rounded-xl border border-white/15 bg-surface"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        data-testid="stroke-canvas"
      />
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <button type="button" className="rounded-lg border border-white/15 px-3 py-2" onClick={undo} disabled={!done.length}>
          방금 획 취소
        </button>
        <span className="text-xs text-fg-muted">{done.length}획 기록</span>
      </div>
      {summary && (
        <p className="mt-3 text-xs text-fg-muted" data-testid="stroke-summary">
          중앙 오차 {summary.med.toFixed(1)}px · 시작 오차 평균 {summary.startErr.toFixed(1)}px · 끝 {summary.endErr.toFixed(1)}px · 속도 {Math.round(summary.speed)}px/s
        </p>
      )}
      {finished && (
        <div className="mt-4">
          <button type="button" className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-black" onClick={copy}>
            결과 복사하기
          </button>
          <p role="status" className="mt-2 text-xs text-fg-muted">{msg}</p>
          <textarea readOnly className="mt-2 h-24 w-full rounded-lg border border-white/15 bg-surface p-2 text-[10px]" value={payload()} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </div>
  )
}
