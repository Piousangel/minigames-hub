import { COLLECTIONS } from '@/lib/games/collections'
import { DEFAULT_META, gameMeta, type GameMeta } from '@/lib/games/gameMeta'

/**
 * 종료 후 '다음 게임' 추천 규칙(순수 함수 — 렌더 중 Math.random 없음, 같은 입력 → 같은 결과).
 * 설계: docs/team/specs/2026-11-18-next-game-rail.md. 같은 장르 1 + 다른 입력 1, 오리지널 우선.
 */

/** 컬렉션 'original-games'(우리가 만든 게임) + 그 뒤 출시된 오리지널(컬렉션 미반영분). */
const EXTRA_ORIGINALS = [
  'recoil', 'lagline', 'hunch', 'fizzbeat', 'siteswap', 'shadowfit', 'slosh', 'polarity',
  'bisect', 'plop-landing', 'acorn-hop',
]
export const ORIGINAL_SLUGS: ReadonlySet<string> = new Set([
  ...(COLLECTIONS['original-games']?.games ?? []),
  ...EXTRA_ORIGINALS,
])

export interface NextPick {
  slug: string
  /** 카드 한 줄 이유(자동 생성). */
  reason: string
  original: boolean
}
export interface NextPicks {
  same: NextPick | null
  diff: NextPick | null
}

export interface PickInput {
  current: string
  /** 후보 slug 전체(registry 순서). */
  all: readonly string[]
  /** 오늘 한 게임 + 최근 게임(제외 대상). */
  exclude: readonly string[]
  run: number
  meta?: Record<string, GameMeta>
  originals?: ReadonlySet<string>
}

export const NEXT_EVENTS = ['next_show', 'next_seen', 'next_ovl', 'next_same', 'next_diff'] as const

const CONTROL_LABEL: Record<string, string> = {
  arrows: 'Arrow keys', tap: 'Tap', type: 'Typing', drag: 'Drag', point: 'Pointer',
}

function tier(slug: string, meta: Record<string, GameMeta>, originals: ReadonlySet<string>): number {
  if (originals.has(slug)) return 0
  if (meta[slug]?.featured) return 1
  return 2
}

/** 계층(오리지널>featured>나머지) 순으로 정렬한 뒤 최상위 계층 안에서 run으로 회전해 하나를 고른다. */
function choose(
  list: readonly string[],
  run: number,
  meta: Record<string, GameMeta>,
  originals: ReadonlySet<string>,
  rank: (s: string) => number = (s) => tier(s, meta, originals),
): string | null {
  if (list.length === 0) return null
  const best = Math.min(...list.map(rank))
  const top = list.filter((s) => rank(s) === best)
  return top[Math.abs(run) % top.length]
}

export function pickNextGames(input: PickInput): NextPicks {
  const meta = input.meta ?? gameMeta
  const originals = input.originals ?? ORIGINAL_SLUGS
  const { current, run } = input
  const cur = meta[current] ?? DEFAULT_META
  const known = input.all.filter((s) => s !== current)
  const ex = new Set(input.exclude)
  // 후보가 모자라면 '최근/오늘' 제외를 풀고 현재만 제외한다(빈 추천 방지).
  const fresh = known.filter((s) => !ex.has(s))

  const sameOf = (pool: readonly string[]) =>
    pool.filter((s) => (meta[s] ?? DEFAULT_META).category === cur.category)
  const curCtl = cur.controls?.[0]
  const diffOf = (pool: readonly string[]) =>
    pool.filter((s) => {
      const c = meta[s]?.controls?.[0]
      return c != null && c !== curCtl
    })

  const sameSlug = choose(sameOf(fresh).length ? sameOf(fresh) : sameOf(known), run, meta, originals)

  const diffPool = (pool: readonly string[]) => diffOf(pool).filter((s) => s !== sameSlug)
  let diffCands = diffPool(fresh)
  if (diffCands.length === 0) diffCands = diffPool(known)
  // 다른 카테고리면 가산: 있으면 그쪽만.
  const otherCat = diffCands.filter((s) => (meta[s] ?? DEFAULT_META).category !== cur.category)
  // 리서치 2(가정2 약화): 낯선 게임만 2장 주지 않는다 — 같은 장르 카드가 오리지널이면
  // 다른 입력 카드는 익숙한 featured 클래식을 먼저(오리지널은 그 다음), 아니면 오리지널 우선.
  const sameIsOriginal = sameSlug != null && originals.has(sameSlug)
  const diffRank = (s: string) =>
    sameIsOriginal ? (meta[s]?.featured && !originals.has(s) ? 0 : originals.has(s) ? 1 : 2) : tier(s, meta, originals)
  const diffSlug = choose(otherCat.length ? otherCat : diffCands, run, meta, originals, diffRank)

  const mk = (slug: string | null, kind: 'same' | 'diff'): NextPick | null => {
    if (!slug) return null
    const m = meta[slug] ?? DEFAULT_META
    const ctl = m.controls?.[0]
    const reason =
      kind === 'same'
        ? `More ${m.category}`
        : ctl
          ? curCtl && curCtl !== ctl
            ? `${CONTROL_LABEL[ctl]} instead of ${CONTROL_LABEL[curCtl].toLowerCase()}`
            : `Try ${CONTROL_LABEL[ctl].toLowerCase()} controls`
          : `Something different`
    return { slug, reason, original: originals.has(slug) }
  }
  return { same: mk(sameSlug, 'same'), diff: mk(diffSlug, 'diff') }
}
