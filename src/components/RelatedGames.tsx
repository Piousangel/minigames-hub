import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { gamePages } from '@/lib/games/registry'
import { GameCard } from '@/components/GameCard'
import { Reveal } from '@/components/Reveal'

const MAX_RELATED = 6

/**
 * 인게임 하단 "관련 게임" 그리드.
 * 같은 카테고리 게임 우선, 부족하면 다른 게임으로 채움(결정론적 — SSR 안정).
 * 내부 링크(SEO 크롤링)·세션당 페이지뷰(광고 노출)를 늘리는 역할.
 */
export function RelatedGames({ currentSlug }: { currentSlug: string }) {
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

  return (
    <section aria-labelledby="related-games" className="mt-14">
      <Reveal>
        <div className="mb-6 flex items-center gap-4">
          <h2
            id="related-games"
            className="font-pixel neon-text text-sm text-neon-cyan sm:text-base"
          >
            More games
          </h2>
          <span
            aria-hidden="true"
            className="h-px flex-1 bg-gradient-to-r from-neon-cyan/50 to-transparent"
          />
        </div>
      </Reveal>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {related.map((g, i) => (
          <Reveal key={g.slug} delay={Math.min(i * 50, 250)}>
            <GameCard page={g} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}
