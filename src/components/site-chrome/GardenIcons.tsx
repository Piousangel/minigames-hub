/**
 * 리디자인 v2 크롬(헤더·푸터) 아이콘 — 시안 docs/design/redesign-v2/hub-v2.html의 <symbol>을 그대로 옮겼다.
 * 색은 정원 팔레트 고정값(ink #5b3a1e 윤곽 + 꽃색 면). 장식이라 모두 aria-hidden — 이름은 감싼 링크가 갖는다.
 */
type IconProps = { className?: string }

const svgProps = { 'aria-hidden': true, focusable: false } as const

/** Originals: 꽃 한 송이가 핀 섬(시안 #isle). */
export function IsleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <path
        d="M3.5 12.5c0-1.6 3.8-2.8 8.5-2.8s8.5 1.2 8.5 2.8c0 .9-1 1.5-2.4 1.9L13.2 20.6c-.6.8-1.8.8-2.4 0L5.9 14.4C4.5 14 3.5 13.4 3.5 12.5z"
        fill="#7cc26a"
        stroke="#5b3a1e"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 9.7V5.2" stroke="#4f8a3c" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="4.6" r="2" fill="#ffd966" stroke="#5b3a1e" strokeWidth="1.5" />
    </svg>
  )
}

/** All games: 씨앗 봉투(시안 #packet, '씨앗 도서관'). */
export function PacketIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <path
        d="M5 7.5l1.75-2 1.75 2 1.75-2 1.75 2 1.75-2 1.75 2 1.75-2L19 7.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19z"
        fill="#fff3dc"
        stroke="#5b3a1e"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 17.5v-4" stroke="#4f8a3c" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.2" fill="#ffd966" stroke="#5b3a1e" strokeWidth="1.4" />
    </svg>
  )
}

/** Leaderboards: 별이 뜬 소원 우물(시안 #well). */
export function WellIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <path
        d="M12 2.8l1.2 2.5 2.7.3-2 1.8.6 2.6L12 8.7l-2.5 1.3.6-2.6-2-1.8 2.7-.3z"
        fill="#ffd966"
        stroke="#5b3a1e"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 13h13v5.5a2.5 2.5 0 0 1-2.5 2.5H8a2.5 2.5 0 0 1-2.5-2.5z"
        fill="#fff3dc"
        stroke="#5b3a1e"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M5.5 16.5h13" stroke="#5b3a1e" strokeWidth="1.5" />
    </svg>
  )
}

/** 오늘 pill: 해(시안 #sunI). */
export function SunIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <g stroke="#5b3a1e" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" />
      </g>
      <circle cx="12" cy="12" r="4.6" fill="#ffd966" stroke="#5b3a1e" strokeWidth="1.8" />
    </svg>
  )
}

/** 검색: 시안에 없어 같은 규칙(ink 1.8 윤곽, 라운드)으로 그린 돋보기. */
export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...svgProps}>
      <circle cx="10.5" cy="10.5" r="6" fill="#fff3dc" stroke="#5b3a1e" strokeWidth="2" />
      <path d="M15 15l5 5" stroke="#5b3a1e" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

/** 오늘의 정원: 핀 꽃(시안 #flower). R3 오늘 호 카드·pill. */
export function FlowerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <g stroke="#5b3a1e" strokeWidth="1.6" fill="#ffd966">
        <circle cx="12" cy="5.5" r="3.6" />
        <circle cx="18.2" cy="10" r="3.6" />
        <circle cx="15.8" cy="17.3" r="3.6" />
        <circle cx="8.2" cy="17.3" r="3.6" />
        <circle cx="5.8" cy="10" r="3.6" />
      </g>
      <circle cx="12" cy="12" r="3.4" fill="#8a5a2b" stroke="#5b3a1e" strokeWidth="1.6" />
    </svg>
  )
}

/** 오늘의 정원: 아직 안 핀 칸 — 점선 원 안 새싹(시안 #bud). */
export function BudIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="#7a5636" strokeWidth="1.6" strokeDasharray="2.6 2.6" />
      <path d="M12 16.5v-5" stroke="#4f8a3c" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M12 12.5c-2.6 0-3.6-1.6-3.6-3.4 2.4 0 3.6 1.2 3.6 3.4zM12 11.5c2.4 0 3.4-1.4 3.4-3 -2.2 0-3.4 1-3.4 3z"
        fill="#7cc26a"
        stroke="#4f8a3c"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 재생 삼각형(시안 #play). 노란 Play 버튼 전용. */
export function PlayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <path d="M8 5.6c0-1 1.1-1.6 2-1.1l9.2 6.4c.8.5.8 1.7 0 2.2L10 19.5c-.9.5-2-.1-2-1.1z" fill="#5b3a1e" />
    </svg>
  )
}
