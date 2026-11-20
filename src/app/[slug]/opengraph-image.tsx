import { ImageResponse } from 'next/og'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'
import { GameIconSvg } from '@/components/icons/GameIcon'
import { G, GameCard, OG_SIZE, ogFonts } from '@/lib/og/gardenCard'

export const dynamic = 'force-static'
export const size = OG_SIZE
export const contentType = 'image/png'

// Next가 이 값을 og:image:alt / twitter:image:alt로 내보낸다.
// 게임별 문구를 넣으려면 generateImageMetadata를 써야 하는데, 그건 [__metadata_id__]
// 동적 세그먼트를 만들어 output:'export'와 충돌한다(빌드 실패로 확인). 정적 문구로 간다.
export const alt = `Play this free mini game online at ${siteConfig.name} — no download, no sign-up`

export function generateStaticParams() {
  return gamePages.map(({ slug }) => ({ slug }))
}

// 게임별 정원 공유 카드(공유·검색 미리보기). 표지 그림이 있는 오리지널은 그림 + 크림 띠, 나머지는
// 크림 종이 + 카테고리 꽃색 아이콘 칸 + 제목 + 카테고리 마스코트(src/lib/og/gardenCard.tsx).
export default function OgImage({ params }: { params: { slug: string } }) {
  const page = gamePages.find((g) => g.slug === params.slug)
  const meta = gameMeta[params.slug] ?? DEFAULT_META
  const title = page?.h1 ?? siteConfig.name
  // 이모지(meta.icon) 대신 커스텀 SVG — 이모지는 next/og가 빌드 중 CDN에서 받아와, 110개 중
  // 하나만 타임아웃돼도 빌드 전체가 실패했다(Vercel 빌드 ETIMEDOUT, 2026-10-10).
  const icon = <GameIconSvg slug={params.slug} size={150} color={G.inkDeep} />
  return new ImageResponse(
    <GameCard slug={params.slug} title={title} category={meta.category} daily={!!meta.daily} icon={icon} />,
    { ...size, fonts: ogFonts() },
  )
}
