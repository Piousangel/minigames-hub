/**
 * 말랑 미끄럼길 선 증거의 정준형(v3 스펙 D-2·D-17). 클라·솔버·봇·서버가 같은 함수를 쓴다.
 * - 저장·전송 형식: 보드 좌표 ×2 정수 `[x2, y2][]`(파이프라인이 0.5 격자로 스냅하므로 손실 없음).
 * - 다중 선 스테이지는 그린 순서와 무관하게 같은 결과가 나오도록 시뮬 입력을 정렬한다.
 *   정렬: 첫 점 x → 첫 점 y → 점 수 → 전체 좌표 사전식. 선 1개 스테이지는 그대로다.
 */
import type { Pt } from './types'

export type WireLine = number[][]

export const encodeLine = (pts: Pt[]): WireLine => pts.map((p) => [Math.round(p.x * 2), Math.round(p.y * 2)])

/** 전송 형식 → 보드 좌표. 형식이 틀리면(정수 쌍이 아님) null. */
export function decodeLine(raw: unknown, maxPoints = 400): Pt[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > maxPoints) return null
  const out: Pt[] = []
  for (const q of raw) {
    if (!Array.isArray(q) || q.length !== 2) return null
    const [x, y] = q
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null
    out.push({ x: x / 2, y: y / 2 })
  }
  return out
}

function cmpLine(a: Pt[], b: Pt[]): number {
  if (a[0].x !== b[0].x) return a[0].x - b[0].x
  if (a[0].y !== b[0].y) return a[0].y - b[0].y
  if (a.length !== b.length) return a.length - b.length
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x) return a[i].x - b[i].x
    if (a[i].y !== b[i].y) return a[i].y - b[i].y
  }
  return 0
}

/** 시뮬 입력용 정준 정렬(원본은 바꾸지 않는다). 빈 선은 정렬 앞에 제외한다. */
export const canonLines = (lines: Pt[][]): Pt[][] => lines.filter((l) => l.length > 0).slice().sort(cmpLine)
