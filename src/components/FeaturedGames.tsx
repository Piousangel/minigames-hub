import { FeaturedRail } from '@/components/FeaturedRail'
import type { BrowseItem } from '@/components/GameBrowser'

/**
 * 홈 최상단 "Featured" 레일 — 잘 만든/찾는 게임을 방문자가 처음 보는 자리에(첫인상=체류·전환).
 * 서버 렌더(정적)라 SSR HTML·첫 페인트에 바로 들어간다. 큐레이션 순서(범용 매력 우선).
 * 마운트 후 FeaturedRail이 /api/popular(최근 14일 몰입 순 플레이어 수)로 같은 카드 집합을
 * 재정렬한다 — 데이터가 없거나 기준 미달이면 이 순서 그대로(정책: src/lib/popular.ts).
 */
const FEATURED_ORDER = [
  'solitaire',
  'chess',
  '2048',
  'flow',
  'unblock',
  'mahjong',
  'yahtzee',
  'mancala',
  'battleship',
  'beatline',
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
  const curated = FEATURED_ORDER.filter((s) => bySlug.has(s))
  if (curated.length === 0) return null

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
      {/* 인기 데이터는 큐레이션 집합만 재정렬하므로 큐레이션 카드만 넘긴다(클라이언트 페이로드 최소) */}
      <FeaturedRail curated={curated} items={curated.map((s) => bySlug.get(s)!)} />
    </section>
  )
}
