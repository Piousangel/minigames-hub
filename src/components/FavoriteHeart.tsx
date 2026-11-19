'use client'

import { useEffect, useState } from 'react'
import { FAVORITES_EVENT, isFavorite, toggleFavorite } from '@/lib/favorites'
import { HeartIcon } from '@/components/home/HomeIcons'

/**
 * 게임 카드 코너에 얹는 즐겨찾기 하트. SpotlightCard(=Link) 안에 <button>을 중첩할 수 없어
 * GameCard의 relative 래퍼 위에 sibling으로 절대배치한다(앵커 바깥 → 유효 HTML).
 *
 * 하이드레이션 안전: 마운트 전엔 빈(비활성) 하트를 그려 SSR과 마크업을 맞추고, 마운트 후
 * localStorage를 읽어 상태를 채운다. 토글은 커스텀 이벤트로 다른 하트·홈 씨앗 도서관 'My games' 필터와 동기화.
 */
// 카드 우상단 모서리에 44×44 히트 영역(보이는 하트 20px). 카드 밖 간격으로 4px 넘쳐 제목 자리를 덜 먹는다.
const GARDEN_CLASS =
  'absolute -right-1 -top-1 z-10 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-cream'

export function FavoriteHeart({
  slug,
  title,
  variant = 'neon',
}: {
  slug: string
  title: string
  /** 'garden' = 홈 씨앗 봉투 카드(R4): 44px 히트(bugs Q2), 늘 보이는 크림/코랄 하트 */
  variant?: 'neon' | 'garden'
}) {
  const [fav, setFav] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => setFav(isFavorite(slug))
    sync()
    setReady(true)
    window.addEventListener(FAVORITES_EVENT, sync)
    return () => window.removeEventListener(FAVORITES_EVENT, sync)
  }, [slug])

  return (
    <button
      type="button"
      // 카드 링크 위에 떠 있으므로 클릭이 카드 이동으로 새지 않게 기본동작/전파를 막는다.
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setFav(toggleFavorite(slug))
      }}
      aria-pressed={ready ? fav : undefined}
      aria-label={fav ? `Remove ${title} from My Games` : `Add ${title} to My Games`}
      title={fav ? 'In My Games' : 'Add to My Games'}
      className={variant === 'garden' ? GARDEN_CLASS : `absolute right-1.5 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        fav
          ? 'text-neon-magenta opacity-100'
          : // 모바일(hover 없음)엔 항상 은은히 보여 탭 가능하게, 데스크톱(sm+)은 hover 시 노출.
            'text-fg-muted opacity-70 hover:text-neon-magenta focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
      }`}
    >
      {variant === 'garden' ? (
        <HeartIcon filled={fav} className="h-5 w-5" />
      ) : (
        <span aria-hidden="true">{fav ? '♥' : '♡'}</span>
      )}
    </button>
  )
}
