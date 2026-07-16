/**
 * 랜덤 게임 주사위 — GameIcon 패밀리 규칙을 따른다
 * (viewBox 0 0 24 24, stroke 1.75, currentColor, 라운드 캡, aria-hidden).
 * 이모지 대신 쓰는 이유: 플랫폼마다 모양이 달라지지 않고 부모 네온 색을 상속한다.
 */
export function DiceIcon({ className }: { className?: string }) {
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
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="currentColor" fillOpacity="0.12" />
      {/* 5핀(주사위 눈) */}
      <circle cx="8.5" cy="8.5" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  )
}
