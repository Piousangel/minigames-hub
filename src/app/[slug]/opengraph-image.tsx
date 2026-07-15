import { ImageResponse } from 'next/og'
import { ACCENT_HEX, OG_BG } from '@/lib/games/accentHex'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'

export const dynamic = 'force-static'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function generateStaticParams() {
  return gamePages.map(({ slug }) => ({ slug }))
}

// 게임별 네온 브랜드 OG 썸네일(공유/검색 미리보기).
export default function OgImage({ params }: { params: { slug: string } }) {
  const page = gamePages.find((g) => g.slug === params.slug)
  const meta = gameMeta[params.slug] ?? DEFAULT_META
  const accent = ACCENT_HEX[meta.accent]
  const title = page?.h1 ?? siteConfig.name

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
          backgroundColor: OG_BG,
          backgroundImage: `radial-gradient(1000px 500px at 50% 0%, ${accent}22, transparent)`,
          color: '#e9e9f5',
          border: `10px solid ${accent}`,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 140, lineHeight: 1 }}>{meta.icon}</div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: accent,
            marginTop: 24,
            textAlign: 'center',
            padding: '0 60px',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 34, color: '#9494b8', marginTop: 20 }}>
          {`Play free on ${siteConfig.name} — no download`}
        </div>
      </div>
    ),
    size,
  )
}
