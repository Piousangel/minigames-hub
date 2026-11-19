/**
 * 홈 본문(R4) 아이콘 — 시안 docs/design/redesign-v2/hub-v2.html의 <symbol>(c-bell·c-star·c-clover·c-sun·chev·seed·sprout)
 * 을 옮겼다(새싹 sprout은 출시 예정 행이 생길 때 다시). 카테고리 꽃 4종은 R6에서 선반 disc가 마스코트 그림으로 바뀌며 뺐다. 색은 정원 팔레트 고정값. 모두 장식(aria-hidden) — 이름은 감싼 링크·버튼이 갖는다.
 */

type IconProps = { className?: string }
const svgProps = { 'aria-hidden': true, focusable: false } as const
const INK = '#5b3a1e'

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <path d="M9.5 6l6 6-6 6" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 씨앗(랜덤 '씨앗 던지기') */
export function SeedIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <path
        d="M12 3.5c3 2.4 5 5.6 5 9a5 5 0 0 1-10 0c0-3.4 2-6.6 5-9z"
        fill="#ffd966"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 9v8" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** 즐겨찾기 하트(정원판): 채움 여부만 다르다 */
export function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <path
        d="M12 20.2s-7.6-4.6-7.6-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.6 2.5c0 5.5-7.6 10.1-7.6 10.1z"
        fill={filled ? '#e8643f' : '#fff3dc'}
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}
