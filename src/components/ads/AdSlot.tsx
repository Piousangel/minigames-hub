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
}: {
  slot: string
  className?: string
  minHeight?: number
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
      className={`adsbygoogle block ${className ?? ''}`}
      style={{ display: 'block', minHeight }}
      data-ad-client={clientId}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}
