/**
 * 말랑 미끄럼길 다중 선 입력의 순수 로직(v3 스펙 PR-5, 규칙 D-3~D-13). DOM·시계·난수 없음 — 시각은 호출자가 `t`(ms)로 넘긴다.
 * UI(PR-6)는 포인터 이벤트를 액션으로 바꿔 `step`에 넣고, 돌아온 이벤트로 소리·안내를 낸다. 서버 검증·솔버도 같은 판정 함수를 쓴다.
 *
 * 엔진은 이 파일을 모른다: 시뮬 입력은 언제나 `canonLines(state.lines)`(그린 순서 무관). 선 1개 스테이지(필드 없음)는 지금과 같은 규칙이다.
 */
import { canonLines, encodeLine } from './canon'
import { polyLength, processStroke, segmentHitsSpawnBan } from './strokePipeline'
import { CONST, type Pt, type Rect, type Stage } from './types'

/** 마지막 포인터 업 뒤 시작 버튼이 켜지기까지(D-13 ②). 손 떼자마자 실수로 누르는 것 방지. */
export const START_SETTLE_MS = 400
/** 삭제·Clear 뒤 되돌리기(Restore)가 살아 있는 시간(D-12). */
export const RESTORE_MS = 3000

export const maxLinesOf = (s: Stage): number => Math.max(1, s.maxLines ?? 1)
export const minLinesOf = (s: Stage): number => Math.min(maxLinesOf(s), Math.max(1, s.minLines ?? 1))
export const manualStartOf = (s: Stage): boolean => s.manualStart ?? false

// ── 금지 판정(+ − × ÷ 비교만, hypot 없음) ─────────────────────────────────────────

/** 선분 a→b가 직사각형(경계 포함)에 닿는가. Liang–Barsky 클리핑. a=b면 점 포함 판정. */
export function segmentHitsRect(a: Pt, b: Pt, r: Rect): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const p = [-dx, dx, -dy, dy]
  const q = [a.x - r.x0, r.x1 - a.x, a.y - r.y0, r.y1 - a.y]
  let t0 = 0
  let t1 = 1
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false // 평행하고 바깥
      continue
    }
    const t = q[i] / p[i]
    if (p[i] < 0) {
      if (t > t1) return false
      if (t > t0) t0 = t
    } else {
      if (t < t0) return false
      if (t < t1) t1 = t
    }
  }
  return true
}

/** 직사각형을 사방으로 `d`만큼 줄인다(서버 여유: 평활된 선이 모서리를 조금 파고드는 것 허용). 뒤집히면 null. */
export function shrinkRect(r: Rect, d: number): Rect | null {
  const out = { x0: r.x0 + d, y0: r.y0 + d, x1: r.x1 - d, y1: r.y1 - d }
  return out.x0 <= out.x1 && out.y0 <= out.y1 ? out : null
}

/** 선분이 스폰 금지 원 또는 금지 구역에 닿는가(D-6: 모든 선에 같은 규칙). */
export function segmentBanned(a: Pt, b: Pt, stage: Stage): boolean {
  if (segmentHitsSpawnBan(a, b, stage.spawn)) return true
  const zones = stage.banZones
  if (zones) for (const z of zones) if (segmentHitsRect(a, b, z)) return true
  return false
}

/** 서버가 금지 구역에 주는 여유(px). verify.ts BAN_SLACK과 같은 값(순환 import를 피해 여기 둔다). */
export const ZONE_SLACK = 6

/** 서버 판정용 구역: 여유만큼 줄인 직사각형. 너무 얇아 뒤집히면 원래 직사각형(얇은 벽을 건너는 위조 방지). */
export const serverZone = (z: Rect): Rect => shrinkRect(z, ZONE_SLACK) ?? z

/** 서버 규칙의 금지 구역 판정(선분). 클라는 확정 직전에 같은 함수로 다듬은 선을 검사한다 → 클라가 받은 선을 서버가 거부하는 일이 없다. */
export function segmentInServerZone(a: Pt, b: Pt, stage: Stage): boolean {
  const zones = stage.banZones
  if (zones) for (const z of zones) if (segmentHitsRect(a, b, serverZone(z))) return true
  return false
}

export const pointBanned = (p: Pt, stage: Stage): boolean => segmentBanned(p, p, stage)

export function lineBanned(pts: Pt[], stage: Stage): boolean {
  if (pts.length === 1) return pointBanned(pts[0], stage)
  for (let i = 1; i < pts.length; i++) if (segmentBanned(pts[i - 1], pts[i], stage)) return true
  return false
}

// ── 잉크 ─────────────────────────────────────────────────────────────────────

export const inkUsed = (lines: Pt[][]): number => lines.reduce((s, l) => s + polyLength(l), 0)

/**
 * k번째(1부터) 선을 그리는 동안의 잉크 상한(D-5): `ink − 이미 쓴 합 − MIN_LINE × max(0, minLines − k)`.
 * 남은 필수 선이 최소 길이를 그을 잉크를 남겨 둔다 → 잉크를 다 써서 시작 못 하는 막다른 상태가 없다.
 */
export function inkCap(stage: Stage, usedByOthers: number, k: number): number {
  const reserve = CONST.MIN_LINE * Math.max(0, minLinesOf(stage) - k)
  return Math.max(0, stage.ink - usedByOthers - reserve)
}

// ── 선 집합 해시(D-13 ③: 직전 시작과 같은 선 집합이면 시작 비활성) ─────────────────────

/** 정준 정렬 후 전송 형식 정수로 FNV-1a 32비트 → 8자리 16진. 그린 순서가 달라도 같은 집합이면 같은 값. */
export function lineSetHash(lines: Pt[][]): string {
  let h = 0x811c9dc5
  const mix = (n: number) => {
    // 정수(부호 포함)를 4바이트로
    for (let s = 0; s < 32; s += 8) {
      h ^= (n >>> s) & 0xff
      h = Math.imul(h, 0x01000193) >>> 0
    }
  }
  for (const line of canonLines(lines)) {
    mix(line.length)
    for (const [x, y] of encodeLine(line)) {
      mix(x)
      mix(y)
    }
  }
  return h.toString(16).padStart(8, '0')
}

// ── 그리기 상태 기계 ────────────────────────────────────────────────────────────

export interface DrawState {
  /** 확정된 선(파이프라인 후), **그린 순서**. 시뮬에 넣을 때는 canonLines. */
  lines: Pt[][]
  /** 그리는 중인 원점(손가락 경로, 금지 점은 이미 빠짐). 없으면 null. */
  draft: Pt[] | null
  draftLen: number
  /** 마지막 포인터 업 시각(ms). */
  lastUpAt: number
  /** 직전 삭제 1건(Undo·핍 삭제·Clear)의 복구 정보. 새 선을 긋는 순간 사라진다. */
  restore: { removed: { at: number; line: Pt[] }[]; until: number } | null
  /** 직전 시작의 선 집합 해시. */
  lastStartHash: string | null
  running: boolean
}

export const initialDraw = (): DrawState => ({ lines: [], draft: null, draftLen: 0, lastUpAt: -Infinity, restore: null, lastStartHash: null, running: false })

export type StartBlock = 'running' | 'attempts' | 'day' | 'drawing' | 'lines' | 'settle' | 'same'
export interface StartCtx {
  t: number
  attemptsLeft: number
  /** 날짜가 로드 때와 같은가(시작 직전·visibilitychange마다 호출자가 확인). */
  dayOk: boolean
}

/**
 * 시작 버튼 활성 조건(D-13). 막혔으면 이유(탭 시 안내용), 되면 null.
 * 손 떼면 출발하는 스테이지(manualStart=false)는 업 순간이 곧 시작이라 ②(+400ms)·③(같은 집합)을 보지 않는다.
 */
export function startBlock(stage: Stage, s: DrawState, ctx: StartCtx): StartBlock | null {
  if (s.running) return 'running'
  if (ctx.attemptsLeft <= 0) return 'attempts'
  if (!ctx.dayOk) return 'day'
  if (s.draft) return 'drawing'
  if (s.lines.length < minLinesOf(stage)) return 'lines'
  if (!manualStartOf(stage)) return null
  if (ctx.t - s.lastUpAt < START_SETTLE_MS) return 'settle'
  if (s.lastStartHash !== null && lineSetHash(s.lines) === s.lastStartHash) return 'same'
  return null
}

export type DrawAction =
  | { type: 'down'; p: Pt; t: number }
  | { type: 'move'; p: Pt }
  | { type: 'up'; t: number }
  | { type: 'cancel' }
  | { type: 'undo'; t: number }
  | { type: 'remove'; index: number; t: number }
  | { type: 'clear'; t: number }
  | { type: 'restore'; t: number }
  | ({ type: 'start' } & StartCtx)
  | { type: 'finish' }

export type DrawEvent =
  | { kind: 'ban' } // 금지 구역(스폰 원·banZones) 안에서 시작 → 거부 + 링 깜빡임
  | { kind: 'full' } // 선 수 상한(manualStart 스테이지)
  | { kind: 'locked' } // 재생 중 — 편집 비활성
  | { kind: 'draw' } // 선 긋기 시작
  | { kind: 'ink-out' } // 잉크 상한에 닿아 점을 버림
  | { kind: 'too-short' } // 업했는데 40px 미만
  | { kind: 'set'; index: number } // 선 확정(lines[index])
  | { kind: 'removed'; count: number }
  | { kind: 'restored'; count: number }
  | { kind: 'start'; lines: Pt[][]; hash: string } // 시작: lines = 정준 정렬된 시뮬 입력
  | { kind: 'start-blocked'; reason: StartBlock }

export interface StepOut {
  s: DrawState
  ev: DrawEvent | null
}

const keep = (s: DrawState): StepOut => ({ s, ev: null })

function removeAt(s: DrawState, idx: number[], t: number): StepOut {
  const set = new Set(idx)
  const removed = s.lines.map((line, at) => ({ at, line })).filter((r) => set.has(r.at))
  if (!removed.length) return keep(s)
  return {
    s: { ...s, lines: s.lines.filter((_, i) => !set.has(i)), restore: { removed, until: t + RESTORE_MS } },
    ev: { kind: 'removed', count: removed.length },
  }
}

/** 상태 전이 한 번. 원본 상태는 바꾸지 않는다(새 객체). */
export function step(stage: Stage, s: DrawState, a: DrawAction): StepOut {
  switch (a.type) {
    case 'down': {
      if (s.running) return { s, ev: { kind: 'locked' } }
      if (s.draft) return keep(s) // 다른 손가락(D-3)
      if (pointBanned(a.p, stage)) return { s, ev: { kind: 'ban' } }
      let lines = s.lines
      if (lines.length >= maxLinesOf(stage)) {
        // 손 떼면 출발하는 1선 스테이지는 새 선이 앞 선을 대신한다(현행 흐름). 다중 선 스테이지는 지워야 더 긋는다.
        if (manualStartOf(stage) || maxLinesOf(stage) > 1) return { s, ev: { kind: 'full' } }
        lines = []
      }
      return { s: { ...s, lines, draft: [a.p], draftLen: 0, restore: null }, ev: { kind: 'draw' } }
    }
    case 'move': {
      const d = s.draft
      if (!d || s.running) return keep(s)
      const last = d[d.length - 1]
      // 직전 유효 점과의 선분이 금지에 닿으면 그 점은 버린다 → 구역 건너편으로 점프 불가, 같은 쪽으로 돌아오면 이어서(D-6)
      if (segmentBanned(last, a.p, stage)) return keep(s)
      const cap = inkCap(stage, inkUsed(s.lines), s.lines.length + 1)
      if (s.draftLen >= cap) return { s, ev: { kind: 'ink-out' } }
      const dx = a.p.x - last.x
      const dy = a.p.y - last.y
      return { s: { ...s, draft: d.concat([a.p]), draftLen: s.draftLen + Math.sqrt(dx * dx + dy * dy) }, ev: null }
    }
    case 'up': {
      const d = s.draft
      if (!d) return keep(s)
      const base = { ...s, draft: null, draftLen: 0, lastUpAt: a.t }
      const cap = inkCap(stage, inkUsed(s.lines), s.lines.length + 1)
      let l = processStroke(d, cap)
      // 평활(RDP+Chaikin)은 긴 직선 구간의 모서리를 깎아 강가를 따라 그은 선을 구역 안으로 당길 수 있다(리뷰 11-20).
      // 서버와 같은 판정으로 다듬은 선을 검사해, 처음 닿는 선분 앞에서 자른다. 금지 구역이 없는 스테이지는 그대로(비트 동일).
      if (l && stage.banZones) {
        for (let i = 1; i < l.length; i++)
          if (segmentInServerZone(l[i - 1], l[i], stage)) {
            l = l.slice(0, i)
            break
          }
        if (polyLength(l) < CONST.MIN_LINE) l = null
      }
      if (!l) return { s: base, ev: { kind: 'too-short' } }
      const lines = s.lines.concat([l])
      return { s: { ...base, lines }, ev: { kind: 'set', index: lines.length - 1 } }
    }
    case 'cancel':
      return s.draft ? keep({ ...s, draft: null, draftLen: 0 }) : keep(s)
    case 'undo':
      if (s.running) return { s, ev: { kind: 'locked' } }
      return removeAt(s, [s.lines.length - 1], a.t)
    case 'remove':
      if (s.running) return { s, ev: { kind: 'locked' } }
      return removeAt(s, [a.index], a.t)
    case 'clear':
      if (s.running) return { s, ev: { kind: 'locked' } }
      return removeAt(
        s,
        s.lines.map((_, i) => i),
        a.t,
      )
    case 'restore': {
      const r = s.restore
      if (s.running || s.draft || !r || a.t >= r.until) return keep(s.restore && a.t >= s.restore.until ? { ...s, restore: null } : s)
      if (s.lines.length + r.removed.length > maxLinesOf(stage)) return keep({ ...s, restore: null })
      // 원래 자리로 끼워 넣는다(그린 순서 보존 → Undo가 다시 같은 선을 지운다)
      const lines = s.lines.slice()
      for (const { at, line } of r.removed.slice().sort((x, y) => x.at - y.at)) lines.splice(Math.min(at, lines.length), 0, line)
      return { s: { ...s, lines, restore: null }, ev: { kind: 'restored', count: r.removed.length } }
    }
    case 'start': {
      const why = startBlock(stage, s, a)
      if (why) return { s, ev: { kind: 'start-blocked', reason: why } }
      const hash = lineSetHash(s.lines)
      return { s: { ...s, running: true, lastStartHash: hash, restore: null }, ev: { kind: 'start', lines: canonLines(s.lines), hash } }
    }
    case 'finish':
      return keep({ ...s, running: false })
  }
}

/** 화면 잉크 막대용: 남은 잉크(px). 그리는 중인 선 포함. */
export const inkLeft = (stage: Stage, s: DrawState): number => Math.max(0, stage.ink - inkUsed(s.lines) - s.draftLen)
