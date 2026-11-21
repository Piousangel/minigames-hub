/**
 * 네온 시절 클래스·토큰(리디자인 v2 이전) — 정원 페이지에서 0이어야 하는 것들.
 * 소스 검사(gardenHub.test.ts)와 렌더 검사(e2e/garden-hub.spec.ts)가 같은 패턴을 쓴다. R8(옛 네온 코드 삭제)의 안전망.
 * `g` 플래그 — match/matchAll로 쓴다(test()는 lastIndex가 남으니 쓰지 말 것).
 */
export const NEON_PATTERN =
  /(?<![\w-])(neon-(?:text|box|icon)[\w-]*|(?:text|bg|border|ring|from|to|decoration)-neon-[\w/-]+|(?:text|bg|border)-accent(?:\/\d+)?|bg-surface(?:-2)?(?:\/\d+)?|text-fg(?:-muted)?(?:\/\d+)?|border-border(?:\/\d+)?|font-pixel|spotlight-card|scanlines)(?![\w-])/g
