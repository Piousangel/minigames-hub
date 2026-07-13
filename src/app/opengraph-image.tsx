import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/siteConfig'

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
          background: '#0f1115',
          color: '#e8eaed',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 72, height: 72, background: '#f59e0b', borderRadius: 16 }} />
          <div style={{ fontSize: 72, fontWeight: 700 }}>{siteConfig.name}</div>
        </div>
        <div style={{ fontSize: 32, color: '#9aa0a8', marginTop: 24 }}>
          Free online mini games — play instantly, no download
        </div>
      </div>
    ),
    size,
  )
}
