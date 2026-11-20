import { ImageResponse } from 'next/og'
import { gamePages } from '@/lib/games/registry'
import { HomeCard, OG_SIZE, ogFonts } from '@/lib/og/gardenCard'

export const dynamic = 'force-static'
export const size = OG_SIZE
export const contentType = 'image/png'
// Next가 이 값을 og:image:alt / twitter:image:alt로 내보낸다. 공유 카드가 이미지를
// 못 불러오거나 스크린리더로 읽힐 때 쓰인다.
export const alt = 'Quick MiniGames — free online mini games, a small garden that blooms daily'

// 홈 공유 카드: 노을 키아트(hub-og-bg) + 왼쪽 문구. 정원 카드 공용 모듈 src/lib/og/gardenCard.tsx.
export default function OgImage() {
  return new ImageResponse(<HomeCard gameCount={gamePages.length} />, { ...size, fonts: ogFonts() })
}
