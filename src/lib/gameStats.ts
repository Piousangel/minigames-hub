/**
 * 게임별 개인 기록('트로피 케이스') — 재방문 훅(DOMAIN §3: Wordle 스탯모달 84% 익일복귀 근거).
 * 무계정이라 전부 localStorage. `stats:<slug>`에 완료 판수/승수/결과 분포를 누적한다.
 *
 * 승/패 신호는 게임마다 달라 제네릭하지 않다 — 각 게임이 게임오버 시 recordResult를 호출해야
 * 채워진다(RecordPlay는 '방문'만 앎). 데이터가 없으면 패널은 그냥 안 뜬다(SSR/SEO 무해).
 *
 * best:<slug>(점수)·<streakKey>(데일리 스트릭)는 별도 키라 여기서 안 건드린다.
 */
import { sendHit } from './hit'

export interface GameStats {
  plays: number // 완료한 판 수
  wins: number // 그중 승리 수
  dist?: Record<string, number> // 결과 분포(게임 정의 버킷 → 횟수). 예: Clusters 실수 0~4
}

export function statsKey(slug: string): string {
  return `stats:${slug}`
}

export function loadStats(slug: string): GameStats {
  try {
    const raw = localStorage.getItem(statsKey(slug))
    if (raw) {
      const o = JSON.parse(raw) as Partial<GameStats>
      if (typeof o?.plays === 'number' && typeof o?.wins === 'number') {
        return {
          plays: o.plays,
          wins: o.wins,
          ...(o.dist && typeof o.dist === 'object' ? { dist: o.dist } : {}),
        }
      }
    }
  } catch {
    // 손상/부재 → 빈 기록
  }
  return { plays: 0, wins: 0 }
}

/**
 * 게임오버 1회당 호출. plays++/wins(+승리)/dist[bucket]++. bucket은 게임이 정하는
 * 결과 카테고리(예: Clusters의 실수 개수 0~4). 새 GameStats 반환(호출부 즉시 갱신용).
 */
export function recordResult(slug: string, r: { won: boolean; bucket?: number | string }): GameStats {
  const s = loadStats(slug)
  const next: GameStats = {
    plays: s.plays + 1,
    wins: s.wins + (r.won ? 1 : 0),
    ...(s.dist ? { dist: { ...s.dist } } : {}),
  }
  if (r.bucket != null) {
    const dist = next.dist ?? {}
    const k = String(r.bucket)
    dist[k] = (dist[k] ?? 0) + 1
    next.dist = dist
  }
  try {
    localStorage.setItem(statsKey(slug), JSON.stringify(next))
  } catch {
    // 저장 실패 무시
  }
  // 승/패 퍼널 비콘(1st-party) — 게임별 완주율 신호. recordResult를 부르는 모든 게임에
  // per-game 추가 배선 없이 자동 적용. sendHit은 실패를 삼키므로 여기 부작용은 무해.
  sendHit(slug, r.won ? 'win' : 'lose')
  return next
}

/** 승률 정수 퍼센트(plays 0이면 0). 표시용. */
export function winRate(s: GameStats): number {
  return s.plays > 0 ? Math.round((s.wins / s.plays) * 100) : 0
}
