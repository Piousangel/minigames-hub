import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/siteConfig'

export const dynamic = 'force-static'

// PWA manifest — "홈 화면에 추가"(설치) 지원 → 재방문/리텐션.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: 'MiniGames',
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#08080f',
    theme_color: '#08080f',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      // Android/Chrome 설치 기준: 192·512 PNG 필수. maskable로 적응형 아이콘도 대응.
      { src: '/icons/pwa-192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/pwa-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/pwa-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
