import { describe, expect, it } from 'vitest'
import { canonLines } from './canon'
import { simulate } from './engine'
import {
  type DrawState,
  type DrawAction,
  RESTORE_MS,
  START_SETTLE_MS,
  initialDraw,
  inkCap,
  inkLeft,
  inkUsed,
  lineBanned,
  lineSetHash,
  maxLinesOf,
  minLinesOf,
  manualStartOf,
  segmentHitsRect,
  shrinkRect,
  startBlock,
  step,
} from './multiline'
import { SLIME_STAGES, STAGE_HINTS } from './stages'
import { dist, polyLength, processStroke } from './strokePipeline'
import { CONST, type Pt, type Rect, type Stage } from './types'
import { BAN_SLACK, INK_SLACK, checkLine } from './verify'

let seed = 98765
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648

/** 시험용 다중 선 스테이지: 1스테이지 지형에 강(금지 기둥)·선 2개·시작 버튼. 출시 스테이지가 아니다(데이터 불변). */
const RIVER: Rect = { x0: 170, y0: 220, x1: 230, y1: 560 }
const MULTI: Stage = { ...SLIME_STAGES[0], id: 'test-multi', maxLines: 2, minLines: 2, manualStart: true, banZones: [RIVER] }

/** 액션 열을 차례로 적용하고 마지막 상태·이벤트 목록. */
function run(stage: Stage, acts: DrawAction[], s0: DrawState = initialDraw()) {
  let s = s0
  const evs: string[] = []
  for (const a of acts) {
    const o = step(stage, s, a)
    s = o.s
    if (o.ev) evs.push(o.ev.kind)
  }
  return { s, evs }
}
/** 점 열을 손으로 그은 것처럼 down→move…→up. */
const stroke = (pts: Pt[], t: number): DrawAction[] => [{ type: 'down', p: pts[0], t }, ...pts.slice(1).map((p) => ({ type: 'move' as const, p })), { type: 'up', t: t + 100 }]
const hline = (x0: number, x1: number, y: number, stepPx = 4): Pt[] => Array.from({ length: Math.floor((x1 - x0) / stepPx) + 1 }, (_, i) => ({ x: x0 + i * stepPx, y }))

describe('기본값: 필드 없는 기존 스테이지는 지금 규칙 그대로', () => {
  it('선 1개·최소 1개·손 떼면 출발', () => {
    for (const s of SLIME_STAGES) {
      expect(maxLinesOf(s)).toBe(1)
      expect(minLinesOf(s)).toBe(1)
      expect(manualStartOf(s)).toBe(false)
      expect(s.banZones).toBeUndefined()
      expect(inkCap(s, 0, 1)).toBe(s.ink) // 예약 없음
    }
  })
  it('1선 스테이지는 새 선이 앞 선을 대신하고, 업 직후 바로 시작할 수 있다(+400ms·같은 집합 검사 없음)', () => {
    const st = SLIME_STAGES[0]
    const a = run(st, stroke(hline(120, 300, 300), 0))
    expect(a.s.lines.length).toBe(1)
    const b = run(st, stroke(hline(120, 300, 320), 200), a.s)
    expect(b.s.lines.length).toBe(1)
    expect(b.s.lines[0][0].y).toBe(320)
    expect(startBlock(st, b.s, { t: 300, attemptsLeft: 1, dayOk: true })).toBeNull()
  })
  it('min/max 값 방어: minLines > maxLines면 maxLines로, 0 이하면 1로', () => {
    expect(minLinesOf({ ...MULTI, minLines: 5 })).toBe(2)
    expect(maxLinesOf({ ...MULTI, maxLines: 0 })).toBe(1)
  })
})

describe('금지 판정(제곱·클리핑, hypot 없음)', () => {
  it('segmentHitsRect: 안·관통·모서리 접촉·빗나감·점', () => {
    const r: Rect = { x0: 0, y0: 0, x1: 10, y1: 10 }
    expect(segmentHitsRect({ x: 2, y: 2 }, { x: 3, y: 3 }, r)).toBe(true)
    expect(segmentHitsRect({ x: -5, y: 5 }, { x: 15, y: 5 }, r)).toBe(true)
    expect(segmentHitsRect({ x: -5, y: 10 }, { x: 15, y: 10 }, r)).toBe(true) // 경계 포함
    expect(segmentHitsRect({ x: -5, y: 11 }, { x: 15, y: 11 }, r)).toBe(false)
    expect(segmentHitsRect({ x: -1, y: 12 }, { x: 12, y: -1 }, r)).toBe(true) // 대각선이 모서리를 자른다
    expect(segmentHitsRect({ x: -1, y: 30 }, { x: 30, y: -1 }, r)).toBe(false)
    expect(segmentHitsRect({ x: 5, y: 5 }, { x: 5, y: 5 }, r)).toBe(true)
    expect(segmentHitsRect({ x: 50, y: 5 }, { x: 50, y: 5 }, r)).toBe(false)
  })
  it('segmentHitsRect = 촘촘한 표본 판정(무작위 20,000선분)', () => {
    const r: Rect = { x0: 100, y0: 100, x1: 160, y1: 220 }
    let disagree = 0
    for (let i = 0; i < 20000; i++) {
      const a = { x: rnd() * 300, y: rnd() * 320 }
      const b = { x: a.x + (rnd() - 0.5) * 120, y: a.y + (rnd() - 0.5) * 120 }
      let sampled = false
      for (let k = 0; k <= 400 && !sampled; k++) {
        const t = k / 400
        const x = a.x + (b.x - a.x) * t
        const y = a.y + (b.y - a.y) * t
        sampled = x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1
      }
      // 표본이 닿으면 해석해도 반드시 닿는다. 반대로 해석만 닿는 것은 모서리 스침(표본 간격보다 얇음)뿐이라 드물다
      if (sampled && !segmentHitsRect(a, b, r)) disagree += 100
      else if (!sampled && segmentHitsRect(a, b, r)) disagree++
    }
    expect(disagree).toBeLessThan(40)
  })
  it('shrinkRect: 줄이고, 뒤집히면 null', () => {
    expect(shrinkRect({ x0: 0, y0: 0, x1: 20, y1: 20 }, 6)).toEqual({ x0: 6, y0: 6, x1: 14, y1: 14 })
    expect(shrinkRect({ x0: 0, y0: 0, x1: 10, y1: 10 }, 6)).toBeNull()
  })
})

describe('그리기: 금지 구역 우회 불가(D-6)', () => {
  it('구역 안에서 시작하면 거부, 스폰 원 안도 거부', () => {
    expect(run(MULTI, [{ type: 'down', p: { x: 200, y: 400 }, t: 0 }]).evs).toEqual(['ban'])
    expect(run(MULTI, [{ type: 'down', p: { x: MULTI.spawn.x + 5, y: MULTI.spawn.y }, t: 0 }]).evs).toEqual(['ban'])
  })
  it('강을 가로지르는 손가락: 건너편 점은 버려지고 선은 강 앞에서 멈춘다', () => {
    const { s } = run(MULTI, stroke(hline(100, 300, 400, 6), 0))
    expect(s.lines.length).toBe(1)
    const l = s.lines[0]
    expect(Math.max(...l.map((p) => p.x))).toBeLessThan(RIVER.x0)
    expect(lineBanned(l, MULTI)).toBe(false)
  })
  it('같은 쪽으로 돌아오면 이어서 긋는다', () => {
    const go = hline(100, 200, 400, 5) // 강 안으로 들어갔다가
    const back = hline(100, 165, 380, 5).reverse() // 강 밖 같은 쪽으로 돌아옴
    const { s } = run(MULTI, stroke([...go, ...back], 0))
    expect(s.lines.length).toBe(1)
    expect(Math.min(...s.lines[0].map((p) => p.y))).toBeLessThan(390)
  })
  it('퍼즈 3,000획: 손가락이 구역을 건너뛰어도 확정된 선은 서버 검사를 통과하고(여유 BAN_SLACK) 원점은 구역에 닿지 않는다', () => {
    let n = 0
    for (let i = 0; i < 3000; i++) {
      let s = initialDraw()
      const p0 = { x: 20 + rnd() * 350, y: 120 + rnd() * 420 }
      s = step(MULTI, s, { type: 'down', p: p0, t: 0 }).s
      if (!s.draft) continue
      let x = p0.x
      let y = p0.y
      let ang = rnd() * 6.283
      const steps = 20 + Math.floor(rnd() * 120)
      for (let k = 0; k < steps; k++) {
        ang += (rnd() - 0.5) * 1.2
        const sp = rnd() < 0.08 ? 40 + rnd() * 120 : 1 + rnd() * 18 // 가끔 큰 점프(빠른 손가락·점 건너뛰기)
        x += Math.cos(ang) * sp
        y += Math.sin(ang) * sp
        s = step(MULTI, s, { type: 'move', p: { x, y } }).s
      }
      const raw = s.draft!
      expect(lineBanned(raw, MULTI)).toBe(false)
      s = step(MULTI, s, { type: 'up', t: 50 }).s
      if (!s.lines.length) continue
      n++
      expect(checkLine(s.lines[0], MULTI)).toBeNull()
    }
    expect(n).toBeGreaterThan(1500)
  })
})

describe('강가 따라 긋기: 평활이 모서리를 깎아도 서버가 거부하지 않는다(리뷰 11-20)', () => {
  it('강 윗변·왼쪽 둑을 L자로 따라 그은 선(L=40~160): 확정되면 언제나 checkLine 통과', () => {
    for (const L of [40, 60, 80, 100, 130, 160]) {
      const pts: Pt[] = []
      for (let x = RIVER.x1 + L; x >= RIVER.x0 - 2; x -= 4) pts.push({ x: Math.min(x, 385), y: RIVER.y0 - 2 }) // 강 윗변 바로 위를 따라 왼쪽으로
      for (let y = RIVER.y0 - 2; y <= RIVER.y0 - 2 + L; y += 4) pts.push({ x: RIVER.x0 - 2, y }) // 왼쪽 둑을 따라 아래로
      const { s } = run(MULTI, stroke(pts, 0))
      expect(s.lines.length).toBe(1) // 헛통과 방지: 잘려도 선은 확정된다
      expect(checkLine(s.lines[0], MULTI)).toBeNull()
    }
  })
  it('얇은 금지 벽(폭 8px)도 서버가 검사한다(줄이면 뒤집히는 구역은 원래 크기)', () => {
    const thin: Stage = { ...MULTI, banZones: [{ x0: 200, y0: 150, x1: 208, y1: 560 }] }
    const cross = processStroke(hline(120, 300, 450, 4), 400)!
    expect(checkLine(cross, thin)).toBe('ban zone')
  })
  it('손 떼면 출발하는 다중 선 스테이지는 선이 가득 차면 지우지 않고 거부한다', () => {
    const auto: Stage = { ...MULTI, manualStart: false, banZones: undefined }
    const s = run(auto, [...stroke(hline(100, 160, 300), 0), ...stroke(hline(240, 360, 300), 1000)]).s
    expect(step(auto, s, { type: 'down', p: { x: 100, y: 450 }, t: 5000 }).ev).toEqual({ kind: 'full' })
  })
})

describe('잉크: 합계 한도 하나 + 남은 필수 선 예약(D-5)', () => {
  it('첫 선은 MIN_LINE만큼 남기고, 둘째 선은 나머지 전부', () => {
    expect(inkCap(MULTI, 0, 1)).toBe(MULTI.ink - CONST.MIN_LINE)
    expect(inkCap(MULTI, 100, 2)).toBe(MULTI.ink - 100)
    expect(inkCap(MULTI, MULTI.ink + 50, 2)).toBe(0)
  })
  it('첫 선을 잉크 끝까지 그어도 둘째 선(≥40px)을 그을 수 있다 → 시작 가능', () => {
    // 강 왼쪽에서 지그재그로 아주 길게
    const zig: Pt[] = []
    for (let row = 0; row < 12; row++) for (const p of hline(20, 160, 150 + row * 30, 4)) zig.push(row % 2 ? { x: 180 - p.x, y: p.y } : p)
    const a = run(MULTI, stroke(zig, 0))
    expect(a.s.lines.length).toBe(1)
    expect(polyLength(a.s.lines[0])).toBeLessThanOrEqual(MULTI.ink - CONST.MIN_LINE + INK_SLACK)
    expect(inkLeft(MULTI, a.s)).toBeGreaterThanOrEqual(CONST.MIN_LINE)
    const b = run(MULTI, stroke(hline(240, 380, 300, 4), 1000), a.s)
    expect(b.s.lines.length).toBe(2)
    expect(inkUsed(b.s.lines)).toBeLessThanOrEqual(MULTI.ink + INK_SLACK * 2)
    expect(startBlock(MULTI, b.s, { t: 1100 + START_SETTLE_MS, attemptsLeft: 3, dayOk: true })).toBeNull()
  })
  it('퍼즈 1,000쌍: 두 선 합계는 언제나 ink + 여유 이하, 둘째 선이 막히지 않는다', () => {
    let both = 0
    for (let i = 0; i < 1000; i++) {
      let s = initialDraw()
      for (let k = 0; k < 2; k++) {
        const x0 = k === 0 ? 20 + rnd() * 120 : 240 + rnd() * 120
        const pts: Pt[] = [{ x: x0, y: 140 + rnd() * 380 }]
        const steps = 30 + Math.floor(rnd() * 200)
        for (let j = 0; j < steps; j++) pts.push({ x: pts[j].x + (rnd() - 0.5) * 16, y: pts[j].y + (rnd() - 0.5) * 16 })
        s = run(MULTI, stroke(pts, k * 1000), s).s
      }
      expect(inkUsed(s.lines)).toBeLessThanOrEqual(MULTI.ink + INK_SLACK * s.lines.length)
      if (s.lines.length === 2) both++
    }
    expect(both).toBeGreaterThan(600)
  })
})

describe('정준 정렬·집합 해시: 그린 순서와 무관(D-2·D-13 ③)', () => {
  const randLine = (): Pt[] => {
    const n = 2 + Math.floor(rnd() * 30)
    const out: Pt[] = [{ x: Math.round(rnd() * 780) / 2, y: Math.round(rnd() * 1120) / 2 }]
    for (let i = 1; i < n; i++) out.push({ x: Math.round((out[i - 1].x + (rnd() - 0.5) * 16) * 2) / 2, y: Math.round((out[i - 1].y + (rnd() - 0.5) * 16) * 2) / 2 })
    return out
  }
  it('5,000쌍: canonLines·해시가 순서 교환에 불변, 다른 집합은 해시가 다르다', () => {
    const seen = new Map<string, string>()
    let collide = 0
    for (let i = 0; i < 5000; i++) {
      const a = randLine()
      const b = rnd() < 0.05 ? a.map((p) => ({ ...p })) : randLine() // 가끔 같은 선 두 개(겹침 허용)
      expect(canonLines([a, b])).toEqual(canonLines([b, a]))
      const h = lineSetHash([a, b])
      expect(lineSetHash([b, a])).toBe(h)
      const key = JSON.stringify(canonLines([a, b]))
      const prev = seen.get(h)
      if (prev !== undefined && prev !== key) collide++
      seen.set(h, key)
    }
    expect(collide).toBe(0)
  })
  it('500쌍: 실제 시뮬 결과가 순서 교환에 비트 동일(교차·겹침 포함)', () => {
    const st = SLIME_STAGES[0]
    for (let i = 0; i < 500; i++) {
      const a = randLine()
      const b = rnd() < 0.3 ? a.map((p) => ({ x: p.x + (rnd() - 0.5) * 20, y: p.y })) : randLine()
      expect(simulate(st, canonLines([a, b]))).toEqual(simulate(st, canonLines([b, a])))
    }
  })
  it('선 1개면 canonLines가 아무것도 바꾸지 않는다(기존 일일 결과 불변)', () => {
    const wp = STAGE_HINTS[SLIME_STAGES[0].id]
    const raw: Pt[] = [wp[0]]
    for (let k = 1; k < wp.length; k++) {
      const n = Math.max(1, Math.ceil(dist(wp[k - 1], wp[k]) / 4))
      for (let m = 1; m <= n; m++) raw.push({ x: wp[k - 1].x + ((wp[k].x - wp[k - 1].x) * m) / n, y: wp[k - 1].y + ((wp[k].y - wp[k - 1].y) * m) / n })
    }
    const l = processStroke(raw, SLIME_STAGES[0].ink)!
    expect(canonLines([l])).toEqual([l])
    expect(simulate(SLIME_STAGES[0], canonLines([l]))).toEqual(simulate(SLIME_STAGES[0], [l]))
  })
})

describe('Undo·삭제·Clear·Restore(D-12)', () => {
  const two = () => run(MULTI, [...stroke(hline(100, 160, 300), 0), ...stroke(hline(240, 360, 300), 1000)]).s
  it('Undo는 마지막으로 그린 선을 지운다(정렬 순서가 아니라 그린 순서)', () => {
    const s = two()
    const u = step(MULTI, s, { type: 'undo', t: 2000 })
    expect(u.ev).toEqual({ kind: 'removed', count: 1 })
    expect(u.s.lines).toEqual([s.lines[0]])
  })
  it('핍 삭제 → Restore로 원래 자리에 복구, Undo가 다시 같은 선을 지운다', () => {
    const s = two()
    const r = run(MULTI, [{ type: 'remove', index: 0, t: 2000 }, { type: 'restore', t: 2000 + RESTORE_MS - 1 }], s)
    expect(r.evs).toEqual(['removed', 'restored'])
    expect(r.s.lines).toEqual(s.lines)
    expect(step(MULTI, r.s, { type: 'undo', t: 9000 }).s.lines).toEqual([s.lines[0]])
  })
  it('Clear는 전부 지우고 Restore는 전부 되살린다', () => {
    const s = two()
    const r = run(MULTI, [{ type: 'clear', t: 2000 }], s)
    expect(r.s.lines).toEqual([])
    expect(run(MULTI, [{ type: 'restore', t: 2500 }], r.s).s.lines).toEqual(s.lines)
  })
  it('3초가 지나면, 또는 새 선을 긋기 시작하면 Restore는 사라진다', () => {
    const s = two()
    const c = step(MULTI, s, { type: 'clear', t: 2000 }).s
    const late = step(MULTI, c, { type: 'restore', t: 2000 + RESTORE_MS })
    expect(late.ev).toBeNull()
    expect(late.s.lines).toEqual([])
    expect(late.s.restore).toBeNull()
    const drew = step(MULTI, c, { type: 'down', p: { x: 100, y: 300 }, t: 2100 }).s
    expect(drew.restore).toBeNull()
  })
  it('빈 상태 Undo·Clear는 아무 일도 없다(Restore도 만들지 않음)', () => {
    const u = step(MULTI, initialDraw(), { type: 'undo', t: 0 })
    expect(u.ev).toBeNull()
    expect(u.s.restore).toBeNull()
  })
  it('재생 중에는 그리기·편집이 잠긴다', () => {
    const s = { ...two(), running: true }
    for (const a of [{ type: 'down', p: { x: 100, y: 300 }, t: 0 }, { type: 'undo', t: 0 }, { type: 'remove', index: 0, t: 0 }, { type: 'clear', t: 0 }] as DrawAction[]) {
      const o = step(MULTI, s, a)
      expect(o.ev).toEqual({ kind: 'locked' })
      expect(o.s).toBe(s)
    }
  })
  it('선 수 상한이면 더 긋지 못한다(시작 버튼 스테이지)', () => {
    expect(step(MULTI, two(), { type: 'down', p: { x: 100, y: 450 }, t: 5000 }).ev).toEqual({ kind: 'full' })
  })
  it('다른 손가락(그리는 중 down)은 무시, 40px 미만은 확정 안 됨', () => {
    const s = run(MULTI, [{ type: 'down', p: { x: 100, y: 300 }, t: 0 }, { type: 'move', p: { x: 110, y: 300 } }]).s
    expect(step(MULTI, s, { type: 'down', p: { x: 300, y: 300 }, t: 10 }).s).toBe(s)
    const u = step(MULTI, s, { type: 'up', t: 20 })
    expect(u.ev).toEqual({ kind: 'too-short' })
    expect(u.s.lines).toEqual([])
    expect(u.s.lastUpAt).toBe(20)
  })
})

describe('시작 버튼 활성 조건(D-13)', () => {
  const ctx = (t: number) => ({ t, attemptsLeft: 3, dayOk: true })
  it('선 부족 → 업 +400ms 전 → 가능 → 시작 → 같은 집합 막힘 → 하나 바꾸면 다시 가능', () => {
    let s = run(MULTI, stroke(hline(100, 160, 300), 0)).s
    expect(startBlock(MULTI, s, ctx(5000))).toBe('lines')
    s = run(MULTI, stroke(hline(240, 360, 300), 1000), s).s // 업 t=1100
    expect(startBlock(MULTI, s, ctx(1100 + START_SETTLE_MS - 1))).toBe('settle')
    expect(startBlock(MULTI, s, ctx(1100 + START_SETTLE_MS))).toBeNull()
    const st = step(MULTI, s, { type: 'start', ...ctx(2000) })
    expect(st.ev?.kind).toBe('start')
    if (st.ev?.kind === 'start') {
      expect(st.ev.lines).toEqual(canonLines(s.lines))
      expect(st.ev.hash).toBe(lineSetHash(s.lines))
    }
    expect(startBlock(MULTI, st.s, ctx(2100))).toBe('running')
    s = step(MULTI, st.s, { type: 'finish' }).s
    expect(startBlock(MULTI, s, ctx(9000))).toBe('same')
    // 같은 두 선을 반대 순서로 다시 그어도 같은 집합
    const re = run(MULTI, [{ type: 'clear', t: 9000 }, ...stroke(hline(240, 360, 300), 9100), ...stroke(hline(100, 160, 300), 9300)], s).s
    expect(startBlock(MULTI, re, ctx(20000))).toBe('same')
    const changed = run(MULTI, [{ type: 'undo', t: 20000 }, ...stroke(hline(100, 160, 310), 20100)], re).s
    expect(startBlock(MULTI, changed, ctx(30000))).toBeNull()
  })
  it('시도 소진·날짜 바뀜·그리는 중은 막힌다(이유 순서: running > attempts > day > drawing)', () => {
    const s = run(MULTI, [...stroke(hline(100, 160, 300), 0), ...stroke(hline(240, 360, 300), 1000)]).s
    expect(startBlock(MULTI, s, { t: 9999, attemptsLeft: 0, dayOk: true })).toBe('attempts')
    expect(startBlock(MULTI, s, { t: 9999, attemptsLeft: 2, dayOk: false })).toBe('day')
    const drawing = step(MULTI, s, { type: 'undo', t: 3000 }).s
    const d2 = step(MULTI, drawing, { type: 'down', p: { x: 250, y: 300 }, t: 3100 }).s
    expect(startBlock(MULTI, d2, { t: 9999, attemptsLeft: 2, dayOk: true })).toBe('drawing')
  })
  it('막힌 시작은 상태를 바꾸지 않고 이유를 돌려준다', () => {
    const s = initialDraw()
    const o = step(MULTI, s, { type: 'start', ...ctx(0) })
    expect(o.ev).toEqual({ kind: 'start-blocked', reason: 'lines' })
    expect(o.s).toBe(s)
  })
})

describe('서버 검사(checkLine)의 금지 구역', () => {
  it('강을 가로지르는 선은 거부, 강을 비켜 간 선은 통과', () => {
    const cross = processStroke(hline(120, 300, 450, 4), 400)!
    expect(checkLine(cross, MULTI)).toBe('ban zone')
    const left = processStroke(hline(100, 168 - BAN_SLACK + 6, 450, 4), 400)!
    expect(checkLine(left, MULTI)).toBeNull()
  })
})
