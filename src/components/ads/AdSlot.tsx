'use client'

import { useEffect, useRef } from 'react'
import { siteConfig } from '@/lib/siteConfig'
import { adUnit, type AdSlotName } from '@/components/ads/adSlots'

/**
 * AdSense 광고 슬롯. siteConfig.adsenseEnabled 가 false면 아무것도 렌더하지 않음
 * (현재 상태 — 승인 대기 중이라 zero 비주얼/성능 영향). 승인 후 adsenseEnabled 를 true로 바꾸면 활성화.
 * - `slot`은 자리 이름이고, 실제 AdSense 슬롯 ID·크기는 `adSlots.ts`(AD_SLOTS) 한 곳에서 찾는다.
 *   표에 단위가 없는 자리(null)는 광고를 켜도 그리지 않는다.
 * - 고정 크기 단위(D11, 홈 R4): AdSense 고정 크기 방식(inline-block + width·height, data-ad-format 없음)이라
 *   소재가 예약보다 커지지 않는다(CLS 0, 잘라 내기 없음 — 광고를 가리거나 자르면 정책 위반).
 *   크기가 없는 단위는 min-height + auto(반응형).
 */
export function AdSlot({ slot, className, minHeight = 90 }: { slot: AdSlotName; className?: string; minHeight?: number }) {
  const ref = useRef<HTMLModElement>(null)
  const unit = adUnit(slot)
  const clientId = siteConfig.adsenseEnabled && unit ? siteConfig.adsenseClientId : ''

  useEffect(() => {
    if (!clientId) return
    try {
      // @ts-expect-error adsbygoogle는 로더 스크립트가 주입하는 전역
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // 광고 차단 등 — 조용히 무시
    }
  }, [clientId])

  if (!clientId || !unit) return null
  const fixedSize = unit.size

  return (
    <ins
      ref={ref}
      className={`adsbygoogle ${fixedSize ? '' : 'block'} ${className ?? ''}`}
      style={fixedSize ? { display: 'inline-block', width: fixedSize.width, height: fixedSize.height } : { display: 'block', minHeight }}
      data-ad-client={clientId}
      data-ad-slot={unit.id}
      {...(fixedSize ? {} : { 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' })}
    />
  )
}
