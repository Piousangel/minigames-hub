/**
 * 말랑 미끄럼길 서버 재생 검증(v3 스펙 PR-11, D-17~D-21의 현행 구조판). 워커와 테스트가 같이 쓰는 순수 로직(DOM·시계 없음).
 *
 * 클라이언트 점수를 믿지 않는다: 하루 진행(스테이지별 시도와 그은 선)을 받아, 서버가 스테이지 순서·시도 규칙·선 모양을 검사하고
 * 결정적 엔진 `simulate`로 결과를 다시 계산해 점수를 낸다. 엔진은 + − × ÷ sqrt만 써서 Node·Workers·브라우저 결과가 같다.
 *
 * 한계(엔지니어 보고 1-6): 조작된 숫자는 막지만, 솔버로 만든 '유효한 선'은 막지 못한다(막지 않기로 함).
 */
import { canonLines, decodeLine } from './canon'
import { DAILY_ATTEMPTS, attemptScore } from './daily'
import { simulate } from './engine'
import { ZONE_SLACK, maxLinesOf, minLinesOf, segmentInServerZone } from './multiline'
import { SLIME_STAGES, STAGE_HINTS } from './stages'
import { polyLength } from './strokePipeline'
import { BOARD_H, BOARD_W, CONST, type Outcome, type Pt, type Stage } from './types'

/** 본문 상한(바이트). 5스테이지×3시도×선 1개(점 ≤~80) ≈ 10KB. 다중 선이 들어와도 넉넉하다. */
export const SUBMIT_MAX_BYTES = 32_768
/** 파이프라인 8px 재샘플 + 0.5 격자 스냅(점당 최대 0.354px) → 인접 점 간격 이론 최대 ≈ 8.71. */
export const MAX_GAP = 8.75
/** 잉크 허용 오차(px). capInk 뒤 Chaikin은 길이를 줄이고 스냅만 조금 늘린다(검증 테스트의 퍼즈가 실측으로 지킨다). */
export const INK_SLACK = 2
/** 스폰 금지 판정 여유(px). 클라는 손으로 그은 원점을 판정하고, 서버는 부드럽게 다듬은 선을 보므로 안쪽으로 조금 파고들 수 있다. */
export const BAN_SLACK = 6
if (BAN_SLACK !== ZONE_SLACK) throw new Error('BAN_SLACK must equal multiline ZONE_SLACK')
/** 첫 점 허용 오차(px). 선은 보드 위를 눌러야 시작되므로 첫 점은 보드 안이다(스냅·평활 오차만 허용).
 * 나머지 점은 자르지 않는다: 포인터 캡처 중에는 손가락이 보드 밖으로 나가도 점이 찍히고, 길이는 잉크 검사가 묶는다. */
export const START_SLACK = 1
/** 선 1개의 최대 점 수(잉크 최대 ~600px ÷ 8px + 여유). */
export const MAX_POINTS = 200

export interface SubmittedAttempt {
  lines: unknown
}
export type VerifiedAttempt = { outcome: Outcome; stars: number; score: number; hint: boolean }
export type VerifyResult =
  | { ok: true; total: number; cleared: number; hints: number; attempts: number; stages: VerifiedAttempt[][] }
  | { ok: false; error: string }

/** 시간대 UTC−12~+14 중 어딘가에서 지금이 `day`인가(+30분 유예: 자정을 넘겨 탭을 연 채 제출). 형식이 틀리면 false. */
export function dayAcceptable(day: string, nowMs: number, graceMs = 30 * 60_000): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const start = Date.parse(day + 'T00:00:00Z')
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== day) return false
  const H = 3_600_000
  return nowMs >= start - 14 * H && nowMs < start + 24 * H + 12 * H + graceMs
}

/** 그날의 스테이지 순서. 지금은 고정 풀(일일 = 전 스테이지 순차 해금). v3 슬롯제가 오면 날짜로 계산한다(클라와 같은 함수). */
export const planForDay = (_day: string): Stage[] => SLIME_STAGES

function segDist2(a: Pt, b: Pt, c: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2))
  const ex = a.x + t * dx - c.x
  const ey = a.y + t * dy - c.y
  return ex * ex + ey * ey // hypot 대신 제곱 비교(엔진과 같은 연산만, 스펙 A-3 4번)
}

/** 선 하나가 클라 파이프라인이 만들 수 있는 모양인가. 틀리면 이유 문자열. */
export function checkLine(pts: Pt[], stage: Stage): string | null {
  const R = CONST.SPAWN_BAN_R - BAN_SLACK
  const p0 = pts[0]
  if (p0.x < -START_SLACK || p0.x > BOARD_W + START_SLACK || p0.y < -START_SLACK || p0.y > BOARD_H + START_SLACK) return 'out of board'
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x
    const dy = pts[i].y - pts[i - 1].y
    if (dx * dx + dy * dy > MAX_GAP * MAX_GAP) return 'gap'
    if (segDist2(pts[i - 1], pts[i], stage.spawn) < R * R) return 'spawn ban'
  }
  // 금지 구역: 클라 확정 직전 검사와 같은 함수(여유 ZONE_SLACK = BAN_SLACK, 얇은 구역은 줄이지 않음)
  if (stage.banZones) for (let i = 1; i < pts.length; i++) if (segmentInServerZone(pts[i - 1], pts[i], stage)) return 'ban zone'
  const len = polyLength(pts)
  if (len < CONST.MIN_LINE - 0.5) return 'too short'
  if (len > stage.ink + INK_SLACK) return 'ink'
  return null
}

/** 그 스테이지에서 힌트가 보였어야 하는가: 바로 앞 두 시도가 연속 실패(클라 SlimeProto와 같은 규칙, 깨면 끝이라 그 사이 성공은 없다). */
const hintShown = (prev: VerifiedAttempt[], stage: Stage): boolean =>
  prev.length >= 2 && prev[prev.length - 1].outcome !== 'nest' && prev[prev.length - 2].outcome !== 'nest' && !!STAGE_HINTS[stage.id]

/**
 * 하루 제출 검증. `stages[i]` = i번째 스테이지의 시도 목록(그린 순서). 클라가 보낸 점수·별·hint 플래그는 쓰지 않는다
 * (hint는 앞 시도 결과로 서버가 계산한다 — 플래그를 거짓으로 보내 별 상한을 피하는 것 방지).
 */
export function verifyDay(day: string, stagesRaw: unknown): VerifyResult {
  const plan = planForDay(day)
  if (!Array.isArray(stagesRaw) || stagesRaw.length > plan.length) return { ok: false, error: 'bad stages' }
  const out: VerifiedAttempt[][] = []
  let total = 0
  let cleared = 0
  let hints = 0
  let attempts = 0
  let open = true // 앞 스테이지를 지나갔는가(깼거나 3번 소진)
  for (let i = 0; i < stagesRaw.length; i++) {
    const list = stagesRaw[i]
    if (!Array.isArray(list) || list.length > DAILY_ATTEMPTS) return { ok: false, error: `bad attempts @${i + 1}` }
    if (list.length > 0 && !open) return { ok: false, error: `locked @${i + 1}` }
    const stage = plan[i]
    const res: VerifiedAttempt[] = []
    for (let k = 0; k < list.length; k++) {
      if (res.some((a) => a.outcome === 'nest')) return { ok: false, error: `after clear @${i + 1}` }
      const a = list[k] as SubmittedAttempt | null
      const linesRaw = a && Array.isArray(a.lines) ? a.lines : null
      // 선 수: 0개·상한 초과는 거부. 1 ≤ 선 수 < minLines는 거부가 아니라 실패 시도(D-18, 시뮬 없이 0점)
      if (!linesRaw || linesRaw.length < 1 || linesRaw.length > maxLinesOf(stage)) return { ok: false, error: `bad lines @${i + 1}.${k + 1}` }
      const lines: Pt[][] = []
      for (const lr of linesRaw) {
        const pts = decodeLine(lr, MAX_POINTS)
        if (!pts) return { ok: false, error: `bad line @${i + 1}.${k + 1}` }
        const why = checkLine(pts, stage)
        if (why) return { ok: false, error: `${why} @${i + 1}.${k + 1}` }
        lines.push(pts)
      }
      // 잉크는 선 전체 합계 한도 하나(D-5). 선 1개면 위 선별 검사와 같다
      if (lines.length > 1 && lines.reduce((sum, l) => sum + polyLength(l), 0) > stage.ink + INK_SLACK * lines.length) return { ok: false, error: `ink @${i + 1}.${k + 1}` }
      const hint = hintShown(res, stage)
      if (lines.length < minLinesOf(stage)) {
        res.push({ outcome: 'stalled', stars: 0, score: 0, hint })
        if (hint) hints++
        continue
      }
      const r = simulate(stage, canonLines(lines))
      const inkUsed = lines.reduce((s, l) => s + polyLength(l), 0)
      res.push({ outcome: r.outcome, stars: r.acorns, score: attemptScore(r.outcome, r.acorns, inkUsed, stage.ink, hint), hint })
      if (hint) hints++
    }
    attempts += res.length
    const best = res.reduce((m, a) => Math.max(m, a.score), 0)
    const won = res.some((a) => a.outcome === 'nest')
    if (won) cleared++
    total += best
    open = won || res.length >= DAILY_ATTEMPTS
    out.push(res)
  }
  return { ok: true, total, cleared, hints, attempts, stages: out }
}
