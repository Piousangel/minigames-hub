import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/siteConfig'

export const dynamic = 'force-static'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

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
          <div style={{ fontSize: 88 }}>🕹️</div>
          <div style={{ fontSize: 84, fontWeight: 800, color: '#22d3ee' }}>{siteConfig.name}</div>
        </div>
        <div style={{ fontSize: 34, color: '#9494b8', marginTop: 24 }}>
          Free online mini games — play instantly, no download
        </div>
      </div>
    ),
    size,
  )
}
