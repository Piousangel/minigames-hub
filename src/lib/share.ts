/**
 * 공유 링크 빌더(순수 함수). 외부 SDK·스크립트 없이 웹 공유 URL과 시스템 공유창만 쓴다(사이트 원칙: 외부 JS·추적기 금지).
 *
 * - Threads·Facebook: 공식 웹 공유 링크가 있어 새 창으로 연다.
 * - KakaoTalk·Instagram: 웹에서 글을 바로 올리는 공식 링크가 없다(카카오 링크는 JS SDK+앱 키+등록 도메인 필요, 인스타그램은 웹 공유 API 없음).
 *   → 모바일은 시스템 공유창(navigator.share, 여기에 카카오톡·인스타그램이 뜬다), 지원 안 하는 환경은 링크 복사로 처리한다.
 * - 유입 측정: 링크마다 `?ref=share-<채널>`을 붙인다(hit.ts의 entryTag 규칙 [a-z0-9_-]{1,20}).
 */
export type ShareChannel = 'threads' | 'facebook' | 'kakao' | 'instagram' | 'native' | 'copy'

/** 기존 쿼리를 보존하면서 ref=share-<채널>을 붙인다(이미 ref가 있으면 바꾼다). */
export function tagShareUrl(url: string, channel: ShareChannel): string {
  try {
    const u = new URL(url)
    u.searchParams.set('ref', `share-${channel}`)
    return u.toString()
  } catch {
    return url
  }
}

/** Threads 웹 공유(글 작성 화면에 텍스트+링크가 채워진 채로 열린다). */
export function threadsIntentUrl(text: string, url: string): string {
  return `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`.trim())}`
}

/** Facebook 공유 대화상자(링크 미리보기는 페이지의 OG 메타를 쓴다). */
export function facebookSharerUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
}

/** 공유 본문(Threads·복사용). 길이 제한을 넘지 않게 자른다(Threads 500자). */
export function shareText(title: string, description: string): string {
  const base = description ? `${title} — ${description}` : title
  const chars = Array.from(base) // 코드포인트 단위로 잘라 이모지(서로게이트 쌍)가 깨지지 않게
  return chars.length > 220 ? `${chars.slice(0, 217).join('')}…` : base
}
