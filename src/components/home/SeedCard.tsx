import Link from 'next/link'
import type { GameCategory } from '@/lib/games/gameMeta'
import { GameIcon } from '@/components/icons/GameIcon'
import { FavoriteHeart } from '@/components/FavoriteHeart'
import { NewBadge } from '@/components/NewBadge'

/**
 * '씨앗 봉투' 게임 카드(리디자인 v2 R4) — 홈 Continue 줄·씨앗 도서관(All games)이 쓴다.
 * 문법(계획서·시안): 크림 종이 면, 2px ink 윤곽, 판 그림자 4px(--garden-shadow-seed), 제목 Figtree 15/600,
 * 색은 카테고리 꽃색 4종만(윗단 띠 + 아이콘 disc 바탕). 예전 네온 카드의 랜덤 9색 accent는 쓰지 않는다.
 * 아이콘은 기존 GameIcon(선 아이콘, currentColor) — ink로 칠한다.
 *
 * 즐겨찾기 하트는 링크 밖 형제(앵커 안 <button> 금지), 44px 히트(bugs Q2).
 */
export const CATEGORY_TINT: Record<GameCategory, { flower: string; wash: string }> = {
  Puzzle: { flower: 'var(--garden-lavender)', wash: '#f1eafd' },
  Arcade: { flower: 'var(--garden-apricot)', wash: '#ffeedd' },
  Classic: { flower: 'var(--garden-clover)', wash: '#eef7e6' },
  Skill: { flower: 'var(--garden-sunflower)', wash: '#fff5d6' },
}

export function SeedCard({
  slug,
  title,
  description,
  category,
  favoritable = true,
  href,
  showDescription = true,
}: {
  slug: string
  title: string
  description: string
  category: GameCategory
  favoritable?: boolean
  /** 기본 /<slug>. 유입 태그(?ref=…)를 붙일 때만 */
  href?: string
  /** 640 이상에서 한 줄 설명. 390에선 늘 숨겨 카드 높이를 낮춘다(HTML에는 남는다) */
  showDescription?: boolean
}) {
  const tint = CATEGORY_TINT[category]
  return (
    <div className="relative h-full">
      <Link
        href={href ?? `/${slug}`}
        className="garden-jelly font-ui relative flex h-full min-h-[68px] items-center gap-2 overflow-hidden sm:gap-2.5 rounded-[14px] border-2 border-garden-ink bg-garden-cream py-2.5 pr-8 pl-2 sm:pr-9 sm:pl-2.5 text-garden-ink shadow-[var(--garden-highlight),var(--garden-shadow-seed)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-paper sm:items-start sm:pt-4"
      >
        {/* 봉투 윗단 꽃색 띠 */}
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 border-b-[1.5px] border-garden-ink" style={{ background: tint.flower }} />
        <span
          aria-hidden="true"
          className="mt-1 flex h-8 w-8 shrink-0 max-[359px]:hidden sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 border-garden-ink sm:mt-0"
          style={{ background: tint.wash }}
        >
          <GameIcon slug={slug} className="h-5 w-5" />
        </span>
        {/* 긴 한 단어 제목(Minesweeper 등)은 쪼개지 않는다 — 넘쳐도 오른쪽 여백(하트 아래 칸) 안에서 끝난다 */}
        <div className="mt-1 min-w-0 flex-1 sm:mt-0">
          <h3 className="text-[15px] leading-5 font-semibold hyphens-auto">{title}</h3>
          {showDescription && (
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-[18px] text-garden-ink-soft max-sm:hidden">{description}</p>
          )}
        </div>
      </Link>
      <span className="pointer-events-none absolute bottom-1.5 right-2 z-10">
        <NewBadge slug={slug} variant="garden" />
      </span>
      {favoritable && <FavoriteHeart slug={slug} title={title} variant="garden" />}
    </div>
  )
}
