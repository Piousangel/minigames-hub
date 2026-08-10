// 게임별 익명 댓글(design doc Approach A, 2026-08-10 — 리액션 반응 검증을 기다리지 않고
// 바로 진행하기로 함: "우리는 그 댓글 보고 추후 뭘 도모하던지 하지"). UGC라 리더보드보다
// 스팸·악성 콘텐츠 위험이 크다 — 즉시공개(모더레이션 큐 없음, 솔로 개발자 운영 부담 회피)
// 대신 여러 방어선을 겹친다: 허니팟 + 링크 차단(이름·본문 둘 다) + 길이 제한 + IP 레이트리밋.

export const MAX_COMMENT_LEN = 240
export const COMMENT_RATE_LIMIT_MS = 30_000 // 같은 IP에서 30초 내 재작성 차단

// 제어문자 제거(코드포인트 0-31·127) 후 트림·길이 컷 — leaderboard.ts의 cleanName과 같은
// 목적. 정규식 문자 클래스 대신 코드포인트 필터를 쓰는 이유: 이스케이프 시퀀스가 툴 호출
// JSON 인코딩 단계에서 실제 제어문자 바이트로 조기 디코딩되는 사고가 있었다(재현 방지).
export function cleanCommentText(raw: unknown): string {
  const s = String(raw ?? '')
  const out: string[] = []
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    if (code > 31 && code !== 127) out.push(ch)
  }
  const trimmed = out.join('').trim()
  // 코드포인트(문자) 단위로 자른다 — UTF-16 코드유닛 단위 slice()는 서로게이트 페어를
  // 절반만 남길 수 있다(예: 이모지가 정확히 길이 제한 경계에 걸리면 깨진 문자가 저장됨).
  return [...trimmed].slice(0, MAX_COMMENT_LEN).join('')
}

// 링크 포함 텍스트 차단 — 스팸·피싱 방어 1차선. 도메인 화이트리스트 없이 http(s)/www 패턴만
// 걸러도 자동화 스팸의 대다수(피싱 링크, SEO 스팸)를 막는다. 이름 필드에도 반드시 적용할 것
// — 본문만 검사하면 이름 필드로 우회된다(리뷰에서 발견된 실제 우회 경로).
const LINK_RE = /(https?:\/\/|www\.)/i
export function containsLink(text: string): boolean {
  return LINK_RE.test(text)
}

// 허니팟 판정 — 순수 함수로 분리해 워커 인라인 로직 없이 직접 테스트 가능하게 한다.
export function isHoneypotTripped(hp: unknown): boolean {
  return String(hp ?? '').length > 0
}

export interface CommentRow {
  slug: string
  name: string
  text: string
  createdAt: number
}
