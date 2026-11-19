import { siteConfig } from '@/lib/siteConfig'
import { AdSlot } from '@/components/ads/AdSlot'

/**
 * 홈 광고 띠(D11, 리디자인 v2 R4): 고정 크기 슬롯 + 'Advertisement' 라벨 + 중립 종이(cream-2) 띠.
 * - 광고 비활성(siteConfig.adsenseEnabled false·클라이언트 ID 없음)이면 **DOM을 아예 그리지 않는다** — 빈 광고 박스 0.
 * - 활성이면 높이 100px을 미리 예약해 광고가 늦게 와도 CLS 0. 마스코트는 이 띠 400px 안에 두지 않는다(D6).
 * - 홈 2곳: 선반 아래(home-shelves), 푸터 앞(home-footer). 1440 첫 화면(히어로)에는 없다.
 */
export const HOME_AD_HEIGHT = 100

export function HomeAdBand({ slot, className }: { slot: string; className?: string }) {
  if (!siteConfig.adsenseEnabled || !siteConfig.adsenseClientId) return null
  return (
    <aside
      aria-label="Advertisement"
      data-testid="home-ad"
      className={`font-ui rounded-xl border border-garden-ink/20 bg-garden-cream-2 px-3 pt-1.5 pb-3 ${className ?? ''}`}
    >
      <p className="text-[11px] leading-[14px] font-medium text-garden-ink-soft">Advertisement</p>
      <div className="mt-1.5 overflow-hidden" style={{ height: HOME_AD_HEIGHT }}>
        <AdSlot slot={slot} fixedHeight={HOME_AD_HEIGHT} />
      </div>
    </aside>
  )
}
