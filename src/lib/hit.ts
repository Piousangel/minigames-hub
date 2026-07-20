/**
 * 1st-party 분석 비콘 — 같은 오리진 /api/hit로 게임별 조회·체류를 논블로킹 전송.
 * 외부 스크립트/CSP/토큰 불필요(DOMAIN §7 Workers Analytics Engine). 실패는 조용히 무시.
 */
export function sendHit(slug: string, event: string, dwell?: number): void {
  try {
    const payload: Record<string, unknown> = { slug, event }
    if (dwell != null) payload.dwell = Math.round(dwell)
    if (event === 'view' && typeof document !== 'undefined' && document.referrer) {
      payload.ref = document.referrer
    }
    const body = JSON.stringify(payload)
    // sendBeacon은 언로드 중에도 살아남아 dwell 집계에 적합. 없으면 keepalive fetch.
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/hit', new Blob([body], { type: 'application/json' }))
    } else {
      void fetch('/api/hit', {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'content-type': 'application/json' },
      })
    }
  } catch {
    // 분석 실패가 UX를 막지 않게 삼킨다
  }
}
