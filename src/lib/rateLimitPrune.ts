/**
 * comment_rate_limits 정리 정책 — passCooldown(worker/index.ts)이 키(댓글 IP, 'score:<ip>:<game>')
 * 마다 한 행씩 UPSERT하고 지우질 않아 테이블이 무한히 자랐다.
 *
 * 모든 쿨다운(댓글 30초, 점수 10초)보다 오래된 행은 "없는 행"과 판정이 같다(둘 다 통과).
 * 그래서 하루 넘은 행을 지워도 원자적 UPSERT 쿨다운 의미는 그대로다. D1 쓰기를 아끼려고
 * 쿨다운 통과 호출의 ~1%에서만 DELETE를 돌린다.
 */
export const RATE_LIMIT_PRUNE_AGE_MS = 24 * 60 * 60 * 1000
export const RATE_LIMIT_PRUNE_PROBABILITY = 0.01
/** 정리 1회에 지우는 최대 행 수 — 오래 쌓인 테이블의 첫 정리가 D1 한도에 걸리지 않게. */
export const RATE_LIMIT_PRUNE_BATCH = 500

/** 이 시각(ms)보다 last_at이 작은 행은 지워도 된다. */
export function rateLimitPruneCutoff(now: number): number {
  return now - RATE_LIMIT_PRUNE_AGE_MS
}

/** 이번 호출에서 정리할지(확률적). rng 주입은 테스트용. */
export function shouldPruneRateLimits(rng: () => number = Math.random): boolean {
  return rng() < RATE_LIMIT_PRUNE_PROBABILITY
}
