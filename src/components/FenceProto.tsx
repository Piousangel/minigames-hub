'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  HOP_PROTO_PUZZLES,
  applyMove,
  cellSides,
  edgeCount,
  edgeSegment,
  hitEdge,
  hitStats,
  hopGoal,
  initialState,
  mulberry32,
  reachable,
  regions,
  solveHop,
  type EdgeId,
  type HopMove,
  type HopState,
  type Tap,
} from '@/lib/games/fencegarden/engine'

/**
 * 꽃담 정원(가칭) G1 터치 프로토 — 비공개(/tools/fence-proto, noindex).
 * ① 탭 시험: 빛나는 울타리를 누른다. 누른 점·뗀 점을 칸 단위로 기록해 판정 방식(strip·nearest)별 적중률을 계산.
 * ② 퍼즐 v2: 뛰고(0~2칸) → 선 칸의 한 변에 울타리. 울타리 방향은 말랑이 기준 상하좌우 큰 영역으로 고른다.
 * 서버로 아무것도 보내지 않는다. 결과는 JSON 복사.
 */

const ROUND = 20
const C = {
  board: '#2b2350',
  grid: 'rgba(255,255,255,0.14)',
  dot: 'rgba(255,255,255,0.45)',
  fence: '#f6c177',
  fixed: '#c9b79c',
  target: '#7ee0ff',
  preview: '#ffe08a',
  wrong: '#ff7a7a',
  mine: 'rgba(255,170,90,0.20)',
  reach: 'rgba(126,224,255,0.22)',
}

function useBoardPointer(n: number) {
  const ref = useRef<SVGSVGElement>(null)
  /** 화면 좌표 → 칸 단위(판 테두리 = 0..n). viewBox에 여백 0.5칸이 있어 판 밖 반 칸까지 잡힌다. */
  const toCell = useCallback(
    (clientX: number, clientY: number) => {
      const r = ref.current!.getBoundingClientRect()
      const span = n + 1 // viewBox -0.5 .. n+0.5
      return { x: ((clientX - r.left) / r.width) * span - 0.5, y: ((clientY - r.top) / r.height) * span - 0.5, px: r.width / span }
    },
    [n],
  )
  // 누르는 동안 스크롤·당겨 새로고침 막기(인앱 브라우저 대비 passive:false).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const stop = (e: TouchEvent) => e.cancelable && e.preventDefault()
    el.addEventListener('touchstart', stop, { passive: false })
    el.addEventListener('touchmove', stop, { passive: false })
    return () => {
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('touchmove', stop)
    }
  }, [])
  return { ref, toCell }
}

function Grid({ n }: { n: number }) {
  const lines = []
  for (let i = 0; i <= n; i++) {
    lines.push(<line key={`h${i}`} x1={0} y1={i} x2={n} y2={i} stroke={C.grid} strokeWidth={0.03} />)
    lines.push(<line key={`v${i}`} x1={i} y1={0} x2={i} y2={n} stroke={C.grid} strokeWidth={0.03} />)
  }
  const dots = []
  for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) dots.push(<circle key={`d${r}-${c}`} cx={c} cy={r} r={0.06} fill={C.dot} />)
  return (
    <g>
      <rect x={0} y={0} width={n} height={n} rx={0.15} fill={C.board} />
      {lines}
      {dots}
    </g>
  )
}

function Edge({ n, e, color, w = 0.14, dash }: { n: number; e: EdgeId; color: string; w?: number; dash?: string }) {
  const s = edgeSegment(n, e)
  return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash} />
}

// ---------------------------------------------------------------------------
// ① 탭 시험
// ---------------------------------------------------------------------------

type Variant = 'tap' | 'press'
type Rec = Tap & { up: { x: number; y: number }; chosen: EdgeId | null; variant: Variant; cellPx: number }

function TapTest() {
  const [n, setN] = useState(5)
  const [variant, setVariant] = useState<Variant>('press')
  const [round, setRound] = useState(0)
  const [i, setI] = useState(0)
  const [recs, setRecs] = useState<Rec[]>([])
  const [preview, setPreview] = useState<EdgeId | null>(null)
  const [flash, setFlash] = useState<{ e: EdgeId; ok: boolean } | null>(null)
  const down = useRef<{ x: number; y: number; t: number; id: number } | null>(null)
  const { ref, toCell } = useBoardPointer(n)

  const targets = useMemo(() => {
    const rnd = mulberry32(2026 + n * 7 + round * 101)
    return Array.from({ length: ROUND }, () => Math.floor(rnd() * edgeCount(n)))
  }, [n, round])
  const done = i >= ROUND
  const target = targets[Math.min(i, ROUND - 1)]

  const reset = (nextN = n, nextV = variant) => {
    setN(nextN)
    setVariant(nextV)
    setI(0)
    setRound((r) => r + 1)
    setPreview(null)
  }

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (done || down.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toCell(e.clientX, e.clientY)
    down.current = { x: p.x, y: p.y, t: e.timeStamp, id: e.pointerId }
    if (variant === 'press') setPreview(hitEdge(n, p.x, p.y, { kind: 'nearest' }))
  }
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!down.current || down.current.id !== e.pointerId || variant !== 'press') return
    const p = toCell(e.clientX, e.clientY)
    setPreview(hitEdge(n, p.x, p.y, { kind: 'nearest' }))
  }
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = down.current
    if (!d || d.id !== e.pointerId) return
    down.current = null
    setPreview(null)
    const p = toCell(e.clientX, e.clientY)
    // tap: 누른 점으로 결정 / press: 뗀 점으로 결정(누른 채 밀어 고칠 수 있음)
    const at = variant === 'tap' ? d : p
    const chosen = hitEdge(n, at.x, at.y, { kind: 'nearest' })
    const rec: Rec = { n, target, x: d.x, y: d.y, ms: Math.round(e.timeStamp - d.t), up: { x: p.x, y: p.y }, chosen, variant, cellPx: p.px }
    setRecs((rs) => [...rs, rec])
    if (chosen !== null) setFlash({ e: chosen, ok: chosen === target })
    setI((k) => k + 1)
  }
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 260)
    return () => clearTimeout(t)
  }, [flash])

  const summary = useMemo(() => {
    const groups = new Map<string, Rec[]>()
    for (const r of recs) {
      const k = `${r.n}×${r.n} ${r.variant}`
      groups.set(k, [...(groups.get(k) ?? []), r])
    }
    return [...groups.entries()].map(([k, rs]) => {
      const near = hitStats(rs, { kind: 'nearest' })
      const strip = hitStats(rs, { kind: 'strip', tol: 0.2 })
      const committed = rs.filter((r) => r.chosen === r.target).length
      const ms = [...rs.map((r) => r.ms)].sort((a, b) => a - b)[Math.floor(rs.length / 2)]
      return { k, taps: rs.length, committed, near, strip, ms }
    })
  }, [recs])

  const copy = async () => {
    const json = JSON.stringify({ tool: 'fence-proto', v: 1, ua: navigator.userAgent, w: window.innerWidth, recs })
    try {
      await navigator.clipboard.writeText(json)
    } catch {
      window.prompt('복사해 주세요', json)
    }
  }

  return (
    <section aria-label="탭 시험">
      <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-sm">
        {[5, 7].map((k) => (
          <button key={k} type="button" onClick={() => reset(k)} className={`min-h-11 rounded-full px-4 ${n === k ? 'bg-amber-300 text-black' : 'bg-surface'}`}>
            {k}×{k}
          </button>
        ))}
        {(['tap', 'press'] as Variant[]).map((v) => (
          <button key={v} type="button" onClick={() => reset(n, v)} className={`min-h-11 rounded-full px-4 ${variant === v ? 'bg-sky-300 text-black' : 'bg-surface'}`}>
            {v === 'tap' ? '누르면 바로' : '누른 채 고르고 떼기'}
          </button>
        ))}
      </div>
      <p className="mb-2 text-center text-sm" aria-live="polite">
        {done ? '이 판 끝! 판 크기·방식을 바꿔 한 번 더 해 주세요.' : `하늘색으로 빛나는 울타리를 누르세요 (${i + 1}/${ROUND})`}
      </p>
      <svg
        ref={ref}
        viewBox={`-0.5 -0.5 ${n + 1} ${n + 1}`}
        className="mx-auto block w-full max-w-[380px] touch-none select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => ((down.current = null), setPreview(null))}
        role="img"
        aria-label={`${n}×${n} 정원 판`}
      >
        <Grid n={n} />
        {!done && <Edge n={n} e={target} color={C.target} w={0.18} dash="0.25 0.12" />}
        {preview !== null && <Edge n={n} e={preview} color={C.preview} w={0.2} />}
        {flash && <Edge n={n} e={flash.e} color={flash.ok ? C.fence : C.wrong} w={0.22} />}
      </svg>
      <div className="mt-3 overflow-x-auto">
        <table className="mx-auto text-xs">
          <thead>
            <tr className="text-fg-muted">
              <th className="px-2 text-left">판·방식</th>
              <th className="px-2">탭</th>
              <th className="px-2">맞게 놓임</th>
              <th className="px-2">nearest(누른 점)</th>
              <th className="px-2">strip .2 헛탭</th>
              <th className="px-2">중앙 ms</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.k}>
                <td className="px-2">{s.k}</td>
                <td className="px-2 text-center">{s.taps}</td>
                <td className="px-2 text-center">{Math.round((100 * s.committed) / s.taps)}%</td>
                <td className="px-2 text-center">{Math.round(100 * s.near.rate)}%</td>
                <td className="px-2 text-center">{s.strip.miss}</td>
                <td className="px-2 text-center">{s.ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-center">
        <button type="button" onClick={copy} disabled={!recs.length} className="min-h-11 rounded-full bg-surface px-5 text-sm disabled:opacity-60">
          기록 JSON 복사 ({recs.length})
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// ② 퍼즐 v2 — 뛰고 담 치기
// ---------------------------------------------------------------------------

const SIDE_NAMES = ['위', '오른쪽', '아래', '왼쪽'] as const

/** 말랑이 칸 중심 기준 방향(상하좌우 큰 영역). 없는 변·이미 막힌 변이면 null. */
function sideFromPoint(n: number, s: HopState, x: number, y: number): number | null {
  const cx = (s.pos % n) + 0.5
  const cy = Math.floor(s.pos / n) + 0.5
  const dx = x - cx
  const dy = y - cy
  if (Math.hypot(dx, dy) < 0.25) return null // 말랑이 몸 한가운데는 판정 안 함
  const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0
  const e = cellSides(n, s.pos)[side]
  return e === null || s.fences.has(e) ? null : side
}

function HopPuzzleView() {
  const [pi, setPi] = useState(0)
  const p = HOP_PROTO_PUZZLES[pi]
  const n = p.n
  const best = useMemo(() => solveHop(p).min, [p])
  const [hist, setHist] = useState<HopState[]>(() => [initialState(p)])
  /** 뛴 칸(울타리를 놓기 전). null이면 뛸 칸을 고르는 단계. */
  const [pending, setPending] = useState<number | null>(null)
  const phase = pending === null ? 'hop' : 'fence'
  const [preview, setPreview] = useState<number | null>(null)
  const [log, setLog] = useState<{ puzzle: string; moves: HopMove[]; cleared: boolean; turns: number; undo: number }[]>([])
  const undoCount = useRef(0)
  const moves = useRef<HopMove[]>([])
  const pressing = useRef<number | null>(null)
  const { ref, toCell } = useBoardPointer(n)

  const committed = hist[hist.length - 1]
  const s: HopState = useMemo(() => (pending === null ? committed : { pos: pending, fences: committed.fences }), [pending, committed])
  const turnsUsed = hist.length - 1
  const cleared = hopGoal(p, s) && turnsUsed > 0
  const outOfTurns = !cleared && turnsUsed >= p.turns
  const reach = useMemo(() => (phase === 'hop' ? new Set(reachable(p, s)) : new Set<number>()), [p, s, phase])
  const reg = useMemo(() => regions(n, s.fences), [n, s])

  const load = (k: number) => {
    const q = HOP_PROTO_PUZZLES[k]
    setPi(k)
    setHist([initialState(q)])
    setPending(null)
    moves.current = []
    undoCount.current = 0
  }
  useEffect(() => {
    if (cleared || outOfTurns) setLog((l) => [...l, { puzzle: p.id, moves: [...moves.current], cleared, turns: turnsUsed, undo: undoCount.current }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleared, outOfTurns])

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (cleared || outOfTurns || pressing.current !== null) return
    const pt = toCell(e.clientX, e.clientY)
    if (phase === 'hop') {
      const c = Math.floor(pt.x)
      const r = Math.floor(pt.y)
      if (c < 0 || r < 0 || c >= n || r >= n) return
      const cell = r * n + c
      if (!reach.has(cell)) return
      // 울타리를 놓아야 턴이 끝난다
      setPending(cell)
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    pressing.current = e.pointerId
    setPreview(sideFromPoint(n, s, pt.x, pt.y))
  }
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pressing.current !== e.pointerId) return
    const pt = toCell(e.clientX, e.clientY)
    setPreview(sideFromPoint(n, s, pt.x, pt.y))
  }
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pressing.current !== e.pointerId) return
    pressing.current = null
    const pt = toCell(e.clientX, e.clientY)
    const side = sideFromPoint(n, s, pt.x, pt.y)
    setPreview(null)
    if (side === null) return
    const e2 = cellSides(n, s.pos)[side]!
    const m: HopMove = { to: s.pos, fence: e2 }
    moves.current.push(m)
    setHist((h) => [...h, applyMove(committed, m)])
    setPending(null)
  }
  const undo = () => {
    undoCount.current++
    if (pending !== null) {
      setPending(null)
      return
    }
    if (hist.length > 1) {
      moves.current.pop()
      setHist((h) => h.slice(0, -1))
    }
  }

  const stars = cleared && best !== null ? (turnsUsed <= best ? 3 : turnsUsed <= best + 1 ? 2 : 1) : 0
  const sides = phase === 'fence' ? cellSides(n, s.pos) : []
  const px = (s.pos % n) + 0.5
  const py = Math.floor(s.pos / n) + 0.5

  return (
    <section aria-label="퍼즐 v2">
      <div className="mb-2 flex flex-wrap justify-center gap-2 text-sm">
        {HOP_PROTO_PUZZLES.map((q, k) => (
          <button key={q.id} type="button" onClick={() => load(k)} className={`min-h-11 min-w-11 rounded-full px-3 ${k === pi ? 'bg-amber-300 text-black' : 'bg-surface'}`}>
            {k + 1}
          </button>
        ))}
      </div>
      <p className="mb-1 text-center text-sm" aria-live="polite">
        {cleared
          ? `정원 완성! ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} (${turnsUsed}턴 · 최소 ${best}턴)`
          : outOfTurns
            ? '턴을 다 썼어요. 되돌리기나 다시 하기.'
            : phase === 'hop'
              ? `① 뛸 칸을 누르세요 (0~2칸, 제자리도 OK) · 턴 ${turnsUsed + 1}/${p.turns}`
              : '② 말랑이 주변을 누른 채 방향을 고르고 떼면 그쪽 변에 담이 생겨요'}
      </p>
      <p className="mb-2 text-center text-xs text-fg-muted">목표: 말랑이(🟠) 쪽에 꽃(🌸) 전부, 잡초(🌿)는 하나도 없게.</p>
      <svg
        ref={ref}
        viewBox={`-0.5 -0.5 ${n + 1} ${n + 1}`}
        className="mx-auto block w-full max-w-[380px] touch-none select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => ((pressing.current = null), setPreview(null))}
        role="img"
        aria-label="뛰고 담 치기 판"
      >
        <Grid n={n} />
        {Array.from({ length: n * n }, (_, cell) =>
          reg[cell] === reg[s.pos] ? <rect key={`m${cell}`} x={cell % n} y={Math.floor(cell / n)} width={1} height={1} fill={C.mine} /> : null,
        )}
        {[...reach].map((cell) => (
          <rect key={`r${cell}`} x={(cell % n) + 0.08} y={Math.floor(cell / n) + 0.08} width={0.84} height={0.84} rx={0.12} fill={C.reach} />
        ))}
        {p.fixed.map((e) => (
          <Edge key={`f${e}`} n={n} e={e} color={C.fixed} />
        ))}
        {[...s.fences].filter((e) => !p.fixed.includes(e)).map((e) => (
          <Edge key={`p${e}`} n={n} e={e} color={C.fence} />
        ))}
        {sides.map((e, k) =>
          e !== null && !s.fences.has(e) ? <Edge key={`s${k}`} n={n} e={e} color={k === preview ? C.preview : 'rgba(255,224,138,0.35)'} w={k === preview ? 0.24 : 0.1} dash={k === preview ? undefined : '0.15 0.1'} /> : null,
        )}
        {p.flowers.map((f) => (
          <text key={`fl${f}`} x={(f % n) + 0.5} y={Math.floor(f / n) + 0.68} fontSize={0.5} textAnchor="middle">🌸</text>
        ))}
        {p.weeds.map((w) => (
          <text key={`w${w}`} x={(w % n) + 0.5} y={Math.floor(w / n) + 0.68} fontSize={0.5} textAnchor="middle">🌿</text>
        ))}
        <circle cx={px} cy={py} r={0.3} fill="#ff9f5a" stroke="#5a2d12" strokeWidth={0.05} />
        <circle cx={px - 0.09} cy={py - 0.05} r={0.04} fill="#2a1408" />
        <circle cx={px + 0.09} cy={py - 0.05} r={0.04} fill="#2a1408" />
      </svg>
      <p className="mt-1 text-center text-xs text-fg-muted">{preview !== null ? `${SIDE_NAMES[preview]} 변` : ' '}</p>
      <div className="mt-2 flex justify-center gap-2 text-sm">
        <button type="button" onClick={undo} disabled={hist.length <= 1 && phase === 'hop'} className="min-h-11 rounded-full bg-surface px-4 disabled:opacity-60">
          되돌리기
        </button>
        <button type="button" onClick={() => load(pi)} className="min-h-11 rounded-full bg-surface px-4">
          다시 하기
        </button>
        <button
          type="button"
          onClick={async () => {
            const json = JSON.stringify({ tool: 'fence-proto-hop', v: 1, log })
            try {
              await navigator.clipboard.writeText(json)
            } catch {
              window.prompt('복사해 주세요', json)
            }
          }}
          disabled={!log.length}
          className="min-h-11 rounded-full bg-surface px-4 disabled:opacity-60"
        >
          기록 복사 ({log.length})
        </button>
      </div>
    </section>
  )
}

export function FenceProto() {
  const [tab, setTab] = useState<'puzzle' | 'tap'>('puzzle')
  return (
    <div>
      <div role="tablist" className="mb-3 flex justify-center gap-2">
        {(
          [
            ['puzzle', '퍼즐 v2'],
            ['tap', '탭 정확도 시험'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${tab === k ? 'bg-fg text-bg' : 'bg-surface'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'puzzle' ? <HopPuzzleView /> : <TapTest />}
    </div>
  )
}
