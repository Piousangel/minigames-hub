'use client'

import { useEffect, useRef } from 'react'
import { siteConfig } from '@/lib/siteConfig'

/**
 * AdSense 광고 슬롯. siteConfig.adsenseEnabled 가 false면 아무것도 렌더하지 않음
 * (현재 상태 — 승인 대기 중이라 zero 비주얼/성능 영향). 승인 후 실제 슬롯 ID로
 * 교체하고 adsenseEnabled 를 true로 바꾸면 활성화.
 * CLS 방지: 광고가 활성일 때만 최소 높이를 예약(비활성이면 DOM 자체가 없음).
 */
export function AdSlot({
  slot,
  className,
  minHeight = 90,
  fixedSize,
}: {
  slot: string
  className?: string
  minHeight?: number
  /**
   * 고정 크기 광고 단위(D11, 홈 R4): AdSense 고정 크기 방식(inline-block + width·height, data-ad-format 없음)이라
   * 소재가 예약보다 커지지 않는다(CLS 0, 잘라 내기 없음 — 광고를 가리거나 자르면 정책 위반). 생략하면 예전처럼 min-height + auto.
   */
  fixedSize?: { width: number; height: number }
}) {
  const ref = useRef<HTMLModElement>(null)
  const clientId = siteConfig.adsenseEnabled ? siteConfig.adsenseClientId : ''

  useEffect(() => {
    if (!clientId) return
    try {
      // @ts-expect-error adsbygoogle는 로더 스크립트가 주입하는 전역
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // 광고 차단 등 — 조용히 무시
    }
  }, [clientId])

  if (!clientId) return null

  return (
    <ins
      ref={ref}
      className={`adsbygoogle ${fixedSize ? '' : 'block'} ${className ?? ''}`}
      style={fixedSize ? { display: 'inline-block', width: fixedSize.width, height: fixedSize.height } : { display: 'block', minHeight }}
      data-ad-client={clientId}
      data-ad-slot={slot}
      {...(fixedSize ? {} : { 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' })}
    />
  )
}
