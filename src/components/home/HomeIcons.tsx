/**
 * 홈 본문(R4) 아이콘 — 시안 docs/design/redesign-v2/hub-v2.html의 <symbol>(c-bell·c-star·c-clover·c-sun·chev·seed·sprout)
 * 을 옮겼다. 색은 정원 팔레트 고정값. 모두 장식(aria-hidden) — 이름은 감싼 링크·버튼이 갖는다.
 */
import type { ShelfIcon } from '@/lib/home/shelves'

type IconProps = { className?: string }
const svgProps = { 'aria-hidden': true, focusable: false } as const
const INK = '#5b3a1e'

/** Puzzle: 벨꽃(라벤더) */
export function BellFlowerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <path d="M12 3v2.2" stroke="#4f8a3c" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M7.4 9.2C7.4 6.8 9.4 5.2 12 5.2s4.6 1.6 4.6 4v4.6l1.9 3.2c-1 .9-2 .9-3 0-.9.9-2 .9-3 0-.9.9-2 .9-3 0-.9.9-2 .9-3 0l1.9-3.2z"
        fill="#c9b6f2"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 17.4v3" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** Arcade: 별꽃(살구) */
export function StarFlowerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <path
        d="M12 3.6l2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.3 7 19l1-5.6-4.1-3.9 5.6-.7z"
        fill="#ffb27a"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11.8" r="1.8" fill={INK} />
    </svg>
  )
}

/** Classic: 클로버 */
export function CloverIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <path d="M12 13.2c1 3 2.4 5.4 4.6 7.2" fill="none" stroke="#4f8a3c" strokeWidth="1.8" strokeLinecap="round" />
      <g fill="#a8d98f" stroke={INK} strokeWidth="1.8">
        <circle cx="12" cy="7.4" r="3.6" />
        <circle cx="7.6" cy="12.6" r="3.6" />
        <circle cx="16.4" cy="12.6" r="3.6" />
      </g>
      <circle cx="12" cy="11" r="1.4" fill={INK} />
    </svg>
  )
}

/** Skill: 해(해바라기색) */
export function SunFlowerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <g stroke={INK} strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" />
      </g>
      <circle cx="12" cy="12" r="4.6" fill="#ffd966" stroke={INK} strokeWidth="1.8" />
    </svg>
  )
}

export function CategoryIcon({ icon, className }: { icon: ShelfIcon; className?: string }) {
  if (icon === 'bell') return <BellFlowerIcon className={className} />
  if (icon === 'star') return <StarFlowerIcon className={className} />
  if (icon === 'clover') return <CloverIcon className={className} />
  return <SunFlowerIcon className={className} />
}

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

/** 새싹(빈 상태·안내판) */
export function SproutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...svgProps}>
      <path d="M12 20v-7" stroke="#4f8a3c" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M12 13.5c-4 0-5.6-2.4-5.6-5.4 3.8 0 5.6 2 5.6 5.4zM12 12c3.6 0 5.2-2.2 5.2-4.8-3.4 0-5.2 1.8-5.2 4.8z"
        fill="#7cc26a"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
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
