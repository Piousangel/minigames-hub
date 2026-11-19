import { siteConfig } from '@/lib/siteConfig'
import { AdSlot } from '@/components/ads/AdSlot'
import { AD_SLOTS, type HomeAdSlotName } from '@/components/ads/adSlots'

/**
 * 홈 광고 띠(D11, 리디자인 v2 R4): 고정 크기 슬롯 + 'Advertisement' 라벨 + 중립 종이(cream-2) 띠.
 * - 광고 비활성(siteConfig.adsenseEnabled false·클라이언트 ID 없음)이면 **DOM을 아예 그리지 않는다** — 빈 광고 박스 0.
 * - 활성이면 320×100 고정 크기 단위를 가운데 두고 그 높이를 min-height로 예약 — 광고가 늦게 와도 CLS 0,
 *   소재를 자르지 않는다. 마스코트는 이 띠 400px 안에 두지 않는다(D6).
 * - 슬롯 ID·크기는 `components/ads/adSlots.ts`(AD_SLOTS) 한 곳에서만 정한다.
 * - 홈 2곳: About 아래(home-about — R6에서 선반 아래에서 옮김), 푸터 앞(home-footer). 1440 첫 화면(히어로)에는 없다.
 * - 광고 바로 앞 블록에 `data-ad-after="<slot>"`을 단다 — 광고가 꺼져 DOM이 없어도 e2e가 그 아랫변(= 광고 띠 윗변 − 48px)으로
 *   마스코트와의 거리를 잰다(e2e/mascots.spec.ts).
 */
export function HomeAdBand({ slot, className }: { slot: HomeAdSlotName; className?: string }) {
  if (!siteConfig.adsenseEnabled || !siteConfig.adsenseClientId) return null
  const { height } = AD_SLOTS[slot].size
  return (
    <aside
      aria-label="Advertisement"
      data-testid="home-ad"
      className={`font-ui rounded-xl border border-garden-ink/20 bg-garden-cream-2 px-3 pt-1.5 pb-3 ${className ?? ''}`}
    >
      <p className="text-[11px] leading-[14px] font-medium text-garden-ink-soft">Advertisement</p>
      <div className="mt-1.5 text-center" style={{ minHeight: height }}>
        <AdSlot slot={slot} />
      </div>
    </aside>
  )
}
