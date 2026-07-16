/**
 * Quick MiniGames 로고마크 — 네온 아케이드 캐비닛 화면 + 플레이 삼각형.
 * currentColor 기반이라 부모 색으로 발광. 헤더/파비콘 브랜드 통일.
 */
export function Logo({ className }: { className?: string }) {
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
      {/* 아케이드 화면(캐비닛) */}
      <rect x="3" y="4" width="18" height="14" rx="3" />
      {/* 스캔라인 힌트 */}
      <path d="M3 8h18" opacity="0.35" />
      {/* 플레이 삼각형(빠른 실행) */}
      <path d="M10 9.5l4.5 3-4.5 3z" fill="currentColor" stroke="none" />
      {/* 코인 슬롯 / 받침 */}
      <path d="M9 21h6" />
      <path d="M12 18v3" opacity="0.6" />
    </svg>
  )
}
