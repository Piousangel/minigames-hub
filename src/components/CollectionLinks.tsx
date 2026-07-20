import Link from 'next/link'
import { collectionsForGame } from '@/lib/games/collections'
import { accentVar } from '@/lib/games/gameMeta'

/**
 * 게임 페이지 → 컬렉션 역링크(팀결정 ⑥). 66개 게임 페이지에서 소속 컬렉션으로 내부링크
 * 권위를 흘려 롱테일 컬렉션 랜딩의 색인·랭킹을 돕고, 유저에겐 "비슷한 게임 묶음" 발견 경로를 준다.
 * 서버 렌더(정적) → SSR HTML·SEO에 그대로. 소속 컬렉션이 없으면 안 그림.
 */
export function CollectionLinks({ slug }: { slug: string }) {
  const collections = collectionsForGame(slug)
  if (collections.length === 0) return null
  return (
    <nav aria-label="Collections with this game" className="mt-8 flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-fg-muted">Also in</span>
      {collections.map((c) => (
        <Link
          key={c.slug}
          href={`/collection/${c.slug}`}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
          style={{ color: accentVar(c.accent) }}
        >
          {c.h1}
        </Link>
      ))}
    </nav>
  )
}
