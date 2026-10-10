import { ImageResponse } from 'next/og'
import { GameIconSvg } from '@/components/icons/GameIcon'
import { siteConfig } from '@/lib/siteConfig'

export const dynamic = 'force-static'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
// Next가 이 값을 og:image:alt / twitter:image:alt로 내보낸다. 공유 카드가 이미지를
// 못 불러오거나 스크린리더로 읽힐 때 쓰인다.
export const alt = 'Quick MiniGames — 100+ free mini games online, no download'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#08080f',
          backgroundImage: 'radial-gradient(1000px 500px at 50% 0%, #22d3ee22, transparent)',
          color: '#e9e9f5',
          border: '10px solid #22d3ee',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* 이모지 대신 SVG 조이스틱 — 빌드 중 외부 CDN 요청을 없앤다 */}
          <GameIconSvg slug="__default" size={96} color="#22d3ee" />
          <div style={{ fontSize: 84, fontWeight: 800, color: '#22d3ee' }}>{siteConfig.name}</div>
        </div>
        <div style={{ fontSize: 34, color: '#9494b8', marginTop: 24 }}>
          100+ free online mini games — play instantly, no download
        </div>
      </div>
    ),
    size,
  )
}
