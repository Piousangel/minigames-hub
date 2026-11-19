import type { GardenState } from '@/lib/home/garden'

/**
 * 크롬 공용 값 중 클라이언트 섬(TodayPill 등)이 쓰는 것. registry를 import하지 않는다 —
 * chromeLinks.ts는 'All games (N)' 때문에 registry 전체를 싣는데, 이 파일은 전 페이지 클라이언트 번들에 들어가므로 가볍게 둔다.
 */

// 크롬 공통 포커스 링: 크림 위 ink 2px + 크림 오프셋(대비 9:1 이상). outline 대신 ring이라 모서리를 따른다.
export const chromeFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-cream'

/** 오늘 pill — /daily. 정적 HTML은 첫 방문 문구(D2). */
export const TODAY_PILL = { href: '/daily', label: '3 free daily puzzles', short: 'Daily puzzles', tiny: 'Daily' }

/** label = 보이는 전체 문구, name = 접근 이름(보이는 글자로 시작 — WCAG 2.5.3) */
export type TodayPillText = { label: string; name: string; short?: string; tiny?: string }

/**
 * 오늘의 정원 상태 → pill 문구(R3). 첫 방문은 R2 문구(폭별 짧은 형태 포함),
 * 진행 중 "Today 2/3", 완료 "Garden full" — 둘 다 320px 헤더에도 한 줄로 들어가는 길이라 짧은 형태가 없다.
 */
export function todayPillText(state: GardenState, bloomed: number): TodayPillText {
  if (state === 'complete') return { label: 'Garden full', name: 'Garden full: all 3 daily puzzles bloomed' }
  if (state === 'in-progress') return { label: `Today ${bloomed}/3`, name: `Today ${bloomed}/3 daily puzzles bloomed` }
  return { label: TODAY_PILL.label, name: TODAY_PILL.label, short: TODAY_PILL.short, tiny: TODAY_PILL.tiny }
}
