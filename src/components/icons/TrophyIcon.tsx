/**
 * 리더보드 트로피 — 헤더 내비게이션용. GameIcon 패밀리 규칙을 따른다
 * (viewBox 0 0 24 24, stroke 1.75, currentColor, 라운드 캡, aria-hidden).
 * 이모지 대신 쓰는 이유: 플랫폼마다 모양이 달라지지 않고 부모 네온 색을 상속한다.
 */
export function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* 컵 */}
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4Z" fill="currentColor" fillOpacity="0.12" />
      {/* 좌우 손잡이 */}
      <path d="M7.5 5.5H5A2.5 2.5 0 0 0 5 10.5h.6" />
      <path d="M16.5 5.5H19a2.5 2.5 0 0 1 0 5h-.6" />
      {/* 기둥과 받침 */}
      <path d="M12 13.5V17" />
      <path d="M8.5 20h7" />
      <path d="M10 17h4v3h-4z" fill="currentColor" fillOpacity="0.18" />
    </svg>
  )
}
