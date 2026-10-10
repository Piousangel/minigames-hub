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
import { isEndless } from './games/gameMeta'

export interface GameStats {
  plays: number // 완료한 판 수
  // 그중 승리 수. endless 게임(gameMeta.endless)은 승리 개념이 없어 새로 쌓이지 않는다 —
  // 단, 이 변경 전에 won:true로 기록된 레거시 값이 남아 있을 수 있으니 endless 게임의
  // wins는 읽는 쪽(GameStats 패널·achievements)에서 아예 무시한다.
  wins: number
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

function persistResult(slug: string, won: boolean, bucket: number | string | undefined): GameStats {
  const s = loadStats(slug)
  const next: GameStats = {
    plays: s.plays + 1,
    wins: s.wins + (won ? 1 : 0),
    ...(s.dist ? { dist: { ...s.dist } } : {}),
  }
  if (bucket != null) {
    const dist = next.dist ?? {}
    const k = String(bucket)
    dist[k] = (dist[k] ?? 0) + 1
    next.dist = dist
  }
  try {
    localStorage.setItem(statsKey(slug), JSON.stringify(next))
  } catch {
    // 저장 실패 무시
  }
  return next
}

/**
 * 승패가 있는 게임의 게임오버 1회당 호출. plays++/wins(+승리)/dist[bucket]++. bucket은 게임이
 * 정하는 결과 카테고리(예: Clusters의 실수 개수 0~4). `won`은 필수 — 빠뜨리면 컴파일 에러.
 * endless 게임(gameMeta.endless)은 recordFinish를 쓴다. 실수로 여기로 오면 won을 무시하고
 * 중립 완주로 기록한다(승수 부풀림 방지 안전망 — 일치 여부는 gameStats.consistency.test가 지킨다).
 */
export function recordResult(slug: string, r: { won: boolean; bucket?: number | string }): GameStats {
  const endless = isEndless(slug)
  const won = !endless && r.won
  const next = persistResult(slug, won, r.bucket)
  // 완주 퍼널 비콘(1st-party) — 게임별 완주율 신호. sendHit은 실패를 삼키므로 부작용 무해.
  sendHit(slug, endless ? 'finish' : won ? 'win' : 'lose')
  return next
}

/**
 * endless 게임(승리 조건 없이 런이 끝나기만 함)의 런 종료 1회당 호출. plays++(wins 불변),
 * 분석 이벤트는 중립 'finish'. gameMeta에 endless: true가 있는 게임만 부른다.
 */
export function recordFinish(slug: string, r: { bucket?: number | string } = {}): GameStats {
  const next = persistResult(slug, false, r.bucket)
  sendHit(slug, 'finish')
  return next
}

/** 승률 정수 퍼센트(plays 0이면 0). 표시용. */
export function winRate(s: GameStats): number {
  return s.plays > 0 ? Math.round((s.wins / s.plays) * 100) : 0
}
