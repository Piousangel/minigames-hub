/**
 * 리더보드 허브 정렬(순수 함수). 오너 방향: 최신 게임 순, 점수가 있는 보드를 먼저(빈 보드는 접어 둔다).
 * 날짜가 같으면 gameMeta에서 나중에 선언된 쪽이 앞(= latestSlugs와 같은 규칙). addedDate가 없는 게임은 맨 뒤(선언 순).
 */
export function orderBoards(
  slugs: string[],
  boards: Record<string, unknown[]> | null,
  meta: Record<string, { addedDate?: string }>,
): { active: string[]; empty: string[] } {
  const rank = new Map(slugs.map((s, i) => [s, i]))
  const sorted = [...slugs].sort((a, b) => {
    const da = meta[a]?.addedDate ?? ''
    const db = meta[b]?.addedDate ?? ''
    if (da !== db) return da < db ? 1 : -1 // 날짜 내림차순(빈 문자열 = 가장 뒤)
    return (rank.get(b) ?? 0) - (rank.get(a) ?? 0)
  })
  const has = (s: string) => (boards?.[s]?.length ?? 0) > 0
  return { active: sorted.filter(has), empty: sorted.filter((s) => !has(s)) }
}

/** 내 순위 → '상위 P%'(최소 1). 동점은 같은 순위. */
export function topPercent(rank: number, total: number): number {
  if (total <= 0 || rank <= 0) return 100
  return Math.min(100, Math.max(1, Math.ceil((rank / total) * 100)))
}

export type RankInfo = { rank: number; total: number; topPercent: number }

/** 서버 응답에서 순위 정보를 안전하게 꺼낸다(옛 응답·이상값이면 null). */
export function parseRankInfo(d: unknown): RankInfo | null {
  const o = d as { rank?: unknown; total?: unknown; topPercent?: unknown } | null
  if (!o || !Number.isInteger(o.rank) || !Number.isInteger(o.total)) return null
  const rank = o.rank as number
  const total = o.total as number
  if (rank < 1 || total < 1 || rank > total) return null
  return { rank, total, topPercent: topPercent(rank, total) }
}

/** 제출 직후 한 줄 문구. */
export function rankLine(r: RankInfo): string {
  if (r.total === 1) return "You're #1 so far — first on this week's board!"
  if (r.rank === 1) return `#1 of ${r.total} scores this week — top of the board!`
  return `#${r.rank} of ${r.total} scores this week · top ${r.topPercent}%`
}
