/**
 * AdSense 광고 단위 표 — 슬롯 이름(코드가 쓰는 자리 이름) → AdSense 슬롯 ID·크기. 이 파일 한 곳에서만 매핑한다.
 * 근거·단위 이름은 docs/team/adsense-units.md(오너 11-20 "만들자"). 슬롯 ID는 페이지 HTML에 공개되는 값이라 비밀이 아니다.
 *
 * - `size`가 있으면 AdSense 고정 크기 단위(inline-block + width·height, data-ad-format 없음 — D11, CLS 0·자르지 않음).
 * - `null` = 아직 AdSense에 단위가 없는 자리. 광고를 켜도 AdSlot이 아무것도 그리지 않는다
 *   (예전엔 이름 문자열을 data-ad-slot에 그대로 넣어 잘못된 요청이 나갈 수 있었다).
 * - 광고 게재 자체는 siteConfig.adsenseEnabled(승인 전 false)가 막는다 — 여기 ID를 채워도 화면·DOM 변화 0.
 */
export type AdUnit = { id: string; size?: { width: number; height: number } }

export const AD_SLOTS = {
  /** 홈 About 아래(R6) — qmg-home-shelf-320x100 */
  'home-about': { id: '3366937812', size: { width: 320, height: 100 } },
  /** 홈 푸터 앞 — qmg-home-footer-320x100 */
  'home-footer': { id: '5373706948', size: { width: 320, height: 100 } },
  /** 게임 페이지 본문(GamePageLayout) — 단위 미생성 */
  'game-incontent': null,
} as const satisfies Record<string, AdUnit | null>

export type AdSlotName = keyof typeof AD_SLOTS
/** 고정 크기(size)가 있는 단위의 자리 이름 — 홈 광고 띠(HomeAdBand)가 받는다. 표에서 계산(손으로 적지 않음). */
export type HomeAdSlotName = {
  [K in AdSlotName]: (typeof AD_SLOTS)[K] extends { size: object } ? K : never
}[AdSlotName]

export function adUnit(slot: AdSlotName): AdUnit | null {
  return AD_SLOTS[slot]
}
