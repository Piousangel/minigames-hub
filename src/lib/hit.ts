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
 * 진입 이벤트의 유입 출처. URL의 `?ref=<tag>`(도전 링크 등 우리가 뿌린 링크)를 앞에 붙인다 —
 * 카톡·디스코드 등 메신저에서 연 링크는 document.referrer가 비어 있어서, 태그 없이는
 * analytics의 외부 유입 표에서 통째로 사라진다. 형식: "ref=share" 또는 "ref=share <referrer>".
 */
export function entryRef(search: string, referrer: string): string {
  let tag = ''
  try {
    const raw = new URLSearchParams(search).get('ref') ?? ''
    if (/^[a-z0-9_-]{1,20}$/i.test(raw)) tag = `ref=${raw.toLowerCase()}`
  } catch {
    // 잘못된 쿼리는 무시
  }
  return [tag, referrer].filter(Boolean).join(' ')
}

/**
 * 1st-party 분석 비콘 — 같은 오리진 /api/hit로 게임별 조회·체류를 논블로킹 전송.
 * 외부 스크립트/CSP/토큰 불필요(DOMAIN §7 Workers Analytics Engine). 실패는 조용히 무시.
 */
export function sendHit(slug: string, event: string, dwell?: number): void {
  try {
    const payload: Record<string, unknown> = { slug, event, vid: visitorId() }
    if (dwell != null) payload.dwell = Math.round(dwell)
    // referrer는 진입 이벤트에만 의미가 있다. 'pageview'(비게임 페이지)도 진입이므로
    // 포함해야 외부 유입 캠페인(커뮤니티 배포 등)의 referrer를 실제로 잡을 수 있다.
    if ((event === 'view' || event === 'pageview') && typeof document !== 'undefined') {
      const ref = entryRef(typeof location !== 'undefined' ? location.search : '', document.referrer)
      if (ref) payload.ref = ref
    }
    const body = JSON.stringify(payload)
    // sendBeacon은 언로드 중에도 살아남아 dwell 집계에 적합. 없으면 keepalive fetch.
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/hit', new Blob([body], { type: 'application/json' }))
    } else {
      // catch 필수 — 이 fetch는 sendBeacon 미지원 환경(구형 브라우저·jsdom)의 폴백이라
      // 실패가 흔하다. .catch() 없으면 async 거부가 try/catch를 우회해 unhandled
      // rejection이 된다(jsdom은 상대 URL을 못 풀어 항상 여기서 던진다).
      fetch('/api/hit', {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'content-type': 'application/json' },
      }).catch(() => {
        // 분석 실패가 UX를 막지 않게 삼킨다
      })
    }
  } catch {
    // 분석 실패가 UX를 막지 않게 삼킨다
  }
}
