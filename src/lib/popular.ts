// 홈 "Featured" 레일을 실제 인기(Analytics Engine)로 정렬하는 공유 순수 로직.
// 워커(/api/popular)와 클라이언트(FeaturedRail)가 같이 쓴다 — 워커 번들을 위해 레지스트리 import 금지.
//
// 신호 = "몰입한 순 플레이어 수": 최근 POPULAR_WINDOW_DAYS일 동안 한 게임에서 dwell >= POPULAR_MIN_DWELL_SEC초를
// 기록한 서로 다른 방문자(vid) 수. 조회수(hits)는 자동화 방문자 1명이 수백 건을 찍을 수 있어(실측: 'reactor'
// ~900건) 쓰지 않는다 — distinct vid는 그런 스파이크를 1로 눌러준다.

import { isValidGameSlug } from './slug'

export interface PopularEntry {
  slug: string
  players: number
}

export interface PopularResponse {
  games: PopularEntry[]
  updated?: string
}

export const POPULAR_WINDOW_DAYS = 14
export const POPULAR_MIN_DWELL_SEC = 15
/** 이 이상 순 플레이어가 있어야 "인기"로 친다 — 1명(봇·개발자 본인 등) 스파이크 차단. */
export const MIN_PLAYERS = 2
export const POPULAR_SQL_LIMIT = 200

/** AE SQL 빌더(순수). 숫자 인자는 정수로 강제해 SQL에 문자열이 섞일 여지를 없앤다. */
export function buildPopularSql(
  days = POPULAR_WINDOW_DAYS,
  minDwellSec = POPULAR_MIN_DWELL_SEC,
  limit = POPULAR_SQL_LIMIT,
): string {
  const d = Math.max(1, Math.floor(days))
  const s = Math.max(0, Math.floor(minDwellSec))
  const l = Math.max(1, Math.floor(limit))
  return (
    'SELECT index1 AS slug, COUNT(DISTINCT blob4) AS players FROM mg_events ' +
    `WHERE blob1 = 'dwell' AND double1 >= ${s} AND blob4 != '' ` +
    `AND timestamp > NOW() - INTERVAL '${d}' DAY ` +
    `GROUP BY slug ORDER BY players DESC LIMIT ${l} FORMAT JSON`
  )
}

/** AE SQL 응답({ data: [{slug, players}] }, 숫자가 문자열일 수 있음)을 검증·정렬된 목록으로. */
export function parsePopularRows(body: unknown): PopularEntry[] {
  const data = (body as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return []
  const out: PopularEntry[] = []
  for (const row of data) {
    const r = row as { slug?: unknown; players?: unknown }
    const slug = String(r?.slug ?? '')
    const players = Number(r?.players)
    if (!isValidGameSlug(slug) || !Number.isFinite(players) || players <= 0) continue
    out.push({ slug, players: Math.floor(players) })
  }
  return out.sort((a, b) => b.players - a.players)
}

export interface RankOptions {
  /** 레지스트리에 있는 슬러그 집합 — 여기 없는 슬러그(삭제된 게임·쓰레기 index)는 버린다. */
  known: ReadonlySet<string>
  minPlayers?: number
}

export interface RankedFeatured {
  /** 레일에 그릴 슬러그 순서. 길이는 항상 curated(중 known)와 같다. */
  order: string[]
  /** 인기 기준을 넘겨 앞으로 올라온 슬러그("🔥 Popular" 뱃지 대상). */
  popular: Set<string>
}

/**
 * 레일 정렬 정책:
 *  1) players >= minPlayers인 게임을 players 내림차순으로 앞에(동률이면 큐레이션 순서, 큐레이션 밖이면 그 뒤·슬러그순).
 *  2) 나머지 자리는 큐레이션 순서대로 채운다.
 *  3) 레일 길이는 큐레이션 목록 길이로 고정 — 큐레이션 밖 인기 게임도 들어올 수 있고, 그만큼
 *     큐레이션 끝쪽 게임이 밀려난다(진짜 인기작을 첫 화면에 보이는 게 목적이고, 카드 수가 같아야
 *     SSR 큐레이션 렌더와 레이아웃이 어긋나지 않는다).
 * 데이터가 없거나 기준 미달이면 정확히 큐레이션 순서 그대로.
 */
export function rankFeatured(
  curated: readonly string[],
  popular: readonly PopularEntry[],
  opts: RankOptions,
): RankedFeatured {
  const min = opts.minPlayers ?? MIN_PLAYERS
  const base = curated.filter((s) => opts.known.has(s))
  const curatedIdx = new Map(base.map((s, i) => [s, i]))

  const best = new Map<string, number>()
  for (const p of popular) {
    if (!opts.known.has(p.slug) || !(p.players >= min)) continue
    best.set(p.slug, Math.max(best.get(p.slug) ?? 0, p.players))
  }

  const hot = [...best.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      const ia = curatedIdx.get(a[0]) ?? Infinity
      const ib = curatedIdx.get(b[0]) ?? Infinity
      if (ia !== ib) return ia - ib
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
    })
    .map(([s]) => s)
    .slice(0, base.length)

  const hotSet = new Set(hot)
  const order = [...hot, ...base.filter((s) => !hotSet.has(s))].slice(0, base.length)
  return { order, popular: hotSet }
}
