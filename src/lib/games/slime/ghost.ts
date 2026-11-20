/**
 * 기억 고스트 ✕ 위치(스펙 2026-11-20 §4-4). 앞 스테이지에서 내가 그은 선을 이 스테이지에 그대로 놓으면 어디서 막히는가.
 * ① 금지 구역(banZones)에 처음 닿는 선분 → 그 선분의 시작점(구역 진입 직전 지점. 진입점 계산 대신 단순·결정적인 쪽을 택함).
 *    판정은 서버 검증(verify.checkLine)과 같은 `segmentInServerZone`(여유 ZONE_SLACK 적용) — 서버가 받아 주는 선에는 ✕를 찍지 않는다.
 * ② 아니면 그 선 하나로 시뮬해 둥지에 못 가면 궤적 마지막 점(보드 안으로 clamp). 독꽃·추락·멈춤·시간초과 모두 같다.
 * 둥지에 가면 null. '지형 선분 D0 안' 방식은 땅을 따라 깔린 선마다 ✕가 찍혀 쓰지 않는다.
 */
import { simulate } from './engine'
import { segmentInServerZone } from './multiline'
import { BOARD_H, BOARD_W, DEFAULT_PHYSICS, type Pt, type Stage } from './types'

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

export function ghostMark(stage: Stage, line: Pt[]): Pt | null {
  if (line.length < 2) return null
  if (stage.banZones) {
    for (let i = 1; i < line.length; i++) if (segmentInServerZone(line[i - 1], line[i], stage)) return { ...line[i - 1] }
  }
  const trace: Pt[] = []
  const res = simulate(stage, [line], DEFAULT_PHYSICS, trace)
  if (res.outcome === 'nest') return null
  const last = trace[trace.length - 1] ?? stage.spawn // 출발 전에 끝나면 궤적이 비어 있다
  return { x: clamp(last.x, 0, BOARD_W), y: clamp(last.y, 0, BOARD_H) }
}
