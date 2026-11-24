import Link from 'next/link'
import { DEFAULT_META, gameMeta, type NeonAccent } from '@/lib/games/gameMeta'
import { gamePages } from '@/lib/games/registry'
import { GameIcon } from '@/components/icons/GameIcon'
import { FavoriteHeart } from '@/components/FavoriteHeart'
import { NewBadge } from '@/components/NewBadge'
import { Reveal } from '@/components/Reveal'

const MAX_RELATED = 6

/**
 * 게임 accent → 크림 위에서 읽히는 짙은 꽃색. globals.css `main[data-world='garden']`의 `--neon-*` 재매핑과 같은 값
 * (RelatedGames.test.ts가 대조). 정원 틀 밖(오리지널 방 garden-room)에서도 관련 게임 카드가 같은 색이 되도록 토큰 대신 값으로 둔다.
 */
export const GARDEN_ACCENT_INK: Record<NeonAccent, string> = {
  cyan: '#1d6a86',
  magenta: '#a2386a',
  lime: 'var(--garden-leaf-text)',
  amber: '#875300',
  purple: '#6a4aa5',
  blue: '#3a57b0',
  red: 'var(--garden-coral-text)',
  green: 'var(--garden-leaf-text)',
}

/** 작은 머리글자(R7 정원 틀의 '바깥 픽셀 폰트 → Figtree 굵게'와 같은 모양) */
const SMALL_CAPS = 'font-ui text-xs leading-[1.3] font-extrabold tracking-[0.12em]'

/**
 * 관련 게임 카드(정원) — 크림 면·2px ink 윤곽·판 그림자, 글자·아이콘은 게임 accent의 짙은 꽃색.
 * R8에서 네온 GameCard + SpotlightCard를 대신한다(정원 틀 게임 페이지에서 보이던 모양 그대로).
 * 누름 모션은 홈 씨앗 봉투와 같은 garden-jelly(예전 hover 발광·아이콘 회전은 뺐다 — 멈춘 화면은 같다).
 * 즐겨찾기 하트는 링크 밖 형제(앵커 안 <button> 금지).
 */
function RelatedGameCard({ slug, title, description }: { slug: string; title: string; description: string }) {
  const meta = gameMeta[slug] ?? DEFAULT_META
  return (
    <div className="group relative h-full">
      <Link
        href={`/${slug}`}
        style={{ color: GARDEN_ACCENT_INK[meta.accent] }}
        className="garden-jelly relative flex h-full flex-col gap-2 overflow-hidden rounded-xl border-2 border-garden-ink bg-garden-cream p-4 shadow-garden-seed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-garden-paper"
      >
        <span aria-hidden="true" className="relative z-[1] inline-flex">
          <GameIcon slug={slug} className="h-8 w-8 sm:h-9 sm:w-9" />
        </span>
        <h3 className="relative z-[1] text-base font-bold leading-tight sm:text-lg">{title}</h3>
        <p className="relative z-[1] text-xs leading-relaxed text-garden-ink-soft sm:text-sm">{description}</p>
        <span
          aria-hidden="true"
          className={`${SMALL_CAPS} relative z-[1] mt-1 text-garden-ink-soft transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100`}
        >
          PLAY ►
        </span>
      </Link>
      {/* 좌상단 뱃지 줄(NEW) — 하트(우상단)와 같은 코너 배치 체계, 본문·PLAY 줄은 안 가림 */}
      <div className="pointer-events-none absolute left-1.5 top-1.5 z-10 flex items-center gap-1">
        <NewBadge slug={slug} variant="corner" />
      </div>
      <FavoriteHeart slug={slug} title={title} variant="corner" />
    </div>
  )
}

/**
 * 인게임 하단 "관련 게임" 그리드.
 * 같은 카테고리 게임 우선, 부족하면 다른 게임으로 채움(결정론적 — SSR 안정).
 * 내부 링크(SEO 크롤링)·세션당 페이지뷰(광고 노출)를 늘리는 역할.
 */
export function RelatedGames({ currentSlug, room = false }: { currentSlug: string; room?: boolean }) {
  const category = (gameMeta[currentSlug] ?? DEFAULT_META).category
  const others = gamePages.filter((g) => g.slug !== currentSlug)
  const sameCategory = others.filter(
    (g) => (gameMeta[g.slug] ?? DEFAULT_META).category === category,
  )
  const rest = others.filter(
    (g) => (gameMeta[g.slug] ?? DEFAULT_META).category !== category,
  )
  const related = [...sameCategory, ...rest].slice(0, MAX_RELATED)
  if (related.length === 0) return null
  // 오리지널 방(어두운 바탕)에선 머리글을 방의 금빛으로(짙은 청록은 검은 바탕 위 대비 미달), 섹션을 body 줄무늬(z 40) 위로 —
  // 헤더·푸터·Plop 판과 같은 이유. 정원 틀 페이지는 예전 모양 그대로.
  const head = room ? 'var(--garden-gold)' : GARDEN_ACCENT_INK.cyan

  return (
    <section aria-labelledby="related-games" className={room ? 'relative z-[41] mt-14 font-ui' : 'mt-14 font-ui'}>
      <Reveal>
        <div className="mb-6 flex items-center gap-4">
          <h2 id="related-games" className={SMALL_CAPS} style={{ color: head }}>
            More games
          </h2>
          {/* 시작색은 인라인 color-mix — Tailwind 임의값은 빌드 때 oklab으로 미리 계산돼 예전 화면과 1단계씩 어긋난다 */}
          <span
            aria-hidden="true"
            className="h-px flex-1 bg-gradient-to-r to-transparent"
            style={{ ['--tw-gradient-from' as string]: `color-mix(in oklab, ${head} 50%, transparent)` }}
          />
        </div>
      </Reveal>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {related.map((g, i) => (
          <Reveal key={g.slug} delay={Math.min(i * 50, 250)}>
            <RelatedGameCard slug={g.slug} title={g.h1} description={g.shortDescription} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}
