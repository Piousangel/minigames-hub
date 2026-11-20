import { ImageResponse } from 'next/og'
import { GardenLogoMark } from '@/components/site-chrome/GardenIcons'

/**
 * 파비콘·애플·PWA 설치 아이콘(96/180/192/512 PNG) 공유 렌더러. 리디자인 v2 헤더 로고 마크(해 + 떠 있는 섬)를
 * 크림 바탕 가운데 ~64%에 둔다 → maskable(원형·스퀴클 크롭, 안전 영역 지름 80%) 안에 들어간다. 배경 풀블리드.
 * (11-20 전까지는 네온 아케이드 화면+재생 로고 — 사이트는 정원인데 검색 결과·홈 화면 아이콘만 네온이었다.)
 * `_logo`는 언더스코어 프리픽스라 라우팅되지 않는다(route.tsx들이 import만 함).
 */
export const ICON_BG = '#fff3dc' // --garden-cream

/** @param fill 로고가 차지할 폭 비율. maskable(PWA) 0.64, 파비콘은 잘리지 않으니 0.86(16px에서도 읽히게). */
export function iconImage(px: number, fill = 0.64): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: ICON_BG }}>
        <GardenLogoMark size={Math.round(px * fill)} />
      </div>
    ),
    { width: px, height: px },
  )
}
