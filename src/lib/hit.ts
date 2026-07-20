const VID_KEY = 'vid'

/**
 * 익명 방문자 id — 재방문·방문당 플레이 수 계산에 필요(같은 vid의 distinct day = 재방문,
 * 세션당 view 수 = 방문당 플레이). PII 아님(랜덤), 무계정 컨벤션과 일치. 없으면 생성.
 * crypto.randomUUID가 없으면 시간·난수 조합으로 폴백(결정론 불필요, 유일성만 충족).
 */
function visitorId(): string {
  try {
    let v = localStorage.getItem(VID_KEY)
    if (!v) {
      v =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(VID_KEY, v)
    }
    return v
  } catch {
    return 'anon'
  }
}

/**
 * 1st-party 분석 비콘 — 같은 오리진 /api/hit로 게임별 조회·체류를 논블로킹 전송.
 * 외부 스크립트/CSP/토큰 불필요(DOMAIN §7 Workers Analytics Engine). 실패는 조용히 무시.
 */
export function sendHit(slug: string, event: string, dwell?: number): void {
  try {
    const payload: Record<string, unknown> = { slug, event, vid: visitorId() }
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
