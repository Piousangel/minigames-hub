import { accentVar, DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import type { GamePage } from '@/lib/games/registry'
import { GameIcon } from '@/components/icons/GameIcon'
import { SpotlightCard } from '@/components/SpotlightCard'

/**
 * 홈·인게임 "관련 게임"에서 공유하는 네온 게임 카드.
 * 아이콘/타이틀/설명/PLAY 마크업 + 게임별 네온 액센트(SpotlightCard).
 */
export function GameCard({ page }: { page: GamePage }) {
  const meta = gameMeta[page.slug] ?? DEFAULT_META
  return (
    <SpotlightCard href={`/${page.slug}`} accent={accentVar(meta.accent)}>
      <span aria-hidden="true" className="card-icon neon-icon relative z-[1] inline-flex">
        <GameIcon slug={page.slug} className="h-8 w-8 sm:h-9 sm:w-9" />
      </span>
      <h3 className="card-title neon-text relative z-[1] text-base font-bold leading-tight sm:text-lg">
        {page.h1}
      </h3>
      <p className="relative z-[1] text-xs leading-relaxed text-fg-muted sm:text-sm">
        {page.shortDescription}
      </p>
      <span
        aria-hidden="true"
        className="font-pixel relative z-[1] mt-1 text-[9px] tracking-[0.2em] text-fg-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        PLAY ►
      </span>
    </SpotlightCard>
  )
}
