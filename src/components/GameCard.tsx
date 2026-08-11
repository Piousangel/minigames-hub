import { accentVar, DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { GameIcon } from '@/components/icons/GameIcon'
import { SpotlightCard } from '@/components/SpotlightCard'
import { FavoriteHeart } from '@/components/FavoriteHeart'
import { NewBadge } from '@/components/NewBadge'

/**
 * 홈·검색·인게임 "관련 게임"에서 공유하는 네온 게임 카드.
 * 최소 props(slug/title/description)만 받아 클라이언트 페이로드를 가볍게 유지.
 *
 * 즐겨찾기 하트는 SpotlightCard(=Link) 바깥 sibling으로 얹는다(앵커에 <button> 중첩 불가).
 * relative+group 래퍼가 절대배치 좌표계와 hover 노출을 담당. favoritable=false로 끌 수 있다.
 */
export function GameCard({
  slug,
  title,
  description,
  favoritable = true,
}: {
  slug: string
  title: string
  description: string
  favoritable?: boolean
}) {
  const meta = gameMeta[slug] ?? DEFAULT_META
  return (
    <div className="group relative h-full">
      <SpotlightCard href={`/${slug}`} accent={accentVar(meta.accent)}>
        <span aria-hidden="true" className="card-icon neon-icon relative z-[1] inline-flex">
          <GameIcon slug={slug} className="h-8 w-8 sm:h-9 sm:w-9" />
        </span>
        <h3 className="card-title neon-text relative z-[1] text-base font-bold leading-tight sm:text-lg">
          {title}
        </h3>
        <p className="relative z-[1] text-xs leading-relaxed text-fg-muted sm:text-sm">
          {description}
        </p>
        <span
          aria-hidden="true"
          className="font-pixel relative z-[1] mt-1 text-[9px] tracking-[0.2em] text-fg-muted opacity-60 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100"
        >
          PLAY ►
        </span>
      </SpotlightCard>
      <NewBadge slug={slug} />
      {favoritable && <FavoriteHeart slug={slug} title={title} />}
    </div>
  )
}
