import { GameCard } from '@/components/GameCard'
import type { BrowseItem } from '@/components/GameBrowser'

/**
 * 홈 최상단 "Featured" 레일 — 잘 만든/찾는 게임을 방문자가 처음 보는 자리에(첫인상=체류·전환).
 * 서버 렌더(정적)라 SSR HTML·첫 페인트에 바로 들어간다. 큐레이션 순서(범용 매력 우선).
 */
const FEATURED_ORDER = [
  'solitaire',
  'chess',
  '2048',
  'mahjong',
  'clusters',
  'minesweeper',
  'snake',
  'tetris',
  'quadle',
  'equate',
  'jigsaw',
  'reactor',
]

export function FeaturedGames({ items }: { items: BrowseItem[] }) {
  const bySlug = new Map(items.map((it) => [it.slug, it]))
  const games = FEATURED_ORDER.map((s) => bySlug.get(s)).filter((g): g is BrowseItem => Boolean(g))
  if (games.length === 0) return null

  return (
    <section aria-labelledby="featured" className="mb-12">
      <div className="mb-6 flex items-center gap-4">
        <h2 id="featured" className="font-pixel neon-text text-sm text-neon-amber sm:text-base">
          ★ Featured
        </h2>
        <span
          aria-hidden="true"
          className="h-px flex-1 bg-gradient-to-r from-neon-amber/50 to-transparent"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {games.map((g) => (
          <GameCard key={g.slug} slug={g.slug} title={g.title} description={g.description} />
        ))}
      </div>
    </section>
  )
}
