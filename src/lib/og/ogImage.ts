/**
 * 페이지가 metadata.openGraph를 직접 주면 Next가 루트 `opengraph-image`를 물려주지 않는다(11-20 실측: 가이드 22편·daily·
 * about 등 28쪽이 og:image 없이 나가 공유 미리보기가 빈 카드였다). 그런 페이지는 이 함수로 카드를 명시한다.
 * `scripts/check-seo.mjs`가 색인 대상 쪽의 og:image 누락을 막는다.
 *
 * @param gameSlug 게임 카드(`/<slug>/opengraph-image`)를 쓸 때. 없으면 홈 카드.
 */
import { gamePages } from '@/lib/games/registry'

// 카드를 다시 그릴 때 올린다 — SNS·카톡이 쿼리가 다른 URL을 새 그림으로 본다(파일 기반 카드는 Next가 해시를 붙임)
const OG_VERSION = 'g1'

export function ogImage(gameSlug?: string) {
  const title = gameSlug ? gamePages.find((g) => g.slug === gameSlug)?.h1 : undefined
  return [
    {
      url: `${gameSlug ? `/${gameSlug}/opengraph-image` : '/opengraph-image'}?v=${OG_VERSION}`,
      width: 1200,
      height: 630,
      type: 'image/png',
      alt: title ? `${title} — play free on Quick MiniGames` : 'Quick MiniGames — free online mini games',
    },
  ]
}
