// 홈 "Featured" 레일을 실제 인기(Analytics Engine)로 정렬하는 공유 순수 로직.
// 워커(/api/popular)와 클라이언트(FeaturedRail)가 같이 쓴다 — 워커 번들을 위해 레지스트리 import 금지.
//
// 신호 = "몰입한 순 플레이어 수": 최근 POPULAR_WINDOW_DAYS일 동안 한 게임에서 dwell >= POPULAR_MIN_DWELL_SEC초를
// 기록한 서로 다른 방문자(vid) 수. 조회수(hits)는 자동화 방문자 1명이 수백 건을 찍을 수 있어(실측: 'reactor'
// ~900건) 쓰지 않는다 — distinct vid는 그런 스파이크를 1로 눌러준다.

export interface PopularEntry {
  slug: string
  players: number
}

export interface PopularResponse {
  games: PopularEntry[]
}

export const POPULAR_WINDOW_DAYS = 14
export const POPULAR_MIN_DWELL_SEC = 15
/** 이 이상 순 플레이어가 있어야 "인기"로 친다 — 1~2명(봇·개발자 본인 등) 스파이크 차단. */
export const MIN_PLAYERS = 3
export const POPULAR_SQL_LIMIT = 200

/**
 * AE SQL 빌더(순수). 숫자 인자는 정수로 강제해 SQL에 문자열이 섞일 여지를 없앤다.
 * - vid ''(구버전 행)와 'anon'(localStorage 차단 시 src/lib/hit.ts 폴백 — 여러 사람이 한 id로 뭉침)은 제외.
 * - AE는 표본 추출(sampling)을 하므로 COUNT(DISTINCT blob4)는 근사치다. SUM(_sample_interval)처럼 보정할
 *   방법이 없지만, 현재 트래픽(월 수십 명)에선 표본 추출이 거의 일어나지 않고 "순서"만 쓰므로 허용 범위.
 */
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
    `WHERE blob1 = 'dwell' AND double1 >= ${s} AND blob4 != '' AND blob4 != 'anon' ` +
    `AND timestamp > NOW() - INTERVAL '${d}' DAY ` +
    `GROUP BY slug ORDER BY players DESC LIMIT ${l} FORMAT JSON`
  )
}

/**
 * AE SQL 응답({ data: [{slug, players}] }, 숫자가 문자열일 수 있음)을 형태만 맞춘 목록으로.
 * 슬러그 검증·임계·정렬은 rankFeatured 한 곳에서만 한다.
 */
export function parsePopularRows(body: unknown): PopularEntry[] {
  const data = (body as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return []
  const out: PopularEntry[] = []
  for (const row of data) {
    const r = row as { slug?: unknown; players?: unknown } | null
    if (typeof r?.slug !== 'string') continue
    const players = Number(r.players)
    if (!Number.isFinite(players)) continue
    out.push({ slug: r.slug, players })
  }
  return out
}

export interface RankOptions {
  /** 레지스트리에 있는 슬러그 집합 — 여기 없는 슬러그(삭제된 게임 등)는 버린다. */
  known: ReadonlySet<string>
  minPlayers?: number
}

export interface RankedFeatured {
  /** 레일에 그릴 슬러그 순서 — 항상 curated(중 known)의 순열(같은 집합·같은 길이). */
  order: string[]
  /** 인기 기준을 넘겨 앞으로 올라온 슬러그("🔥 Popular" 뱃지 대상). */
  popular: Set<string>
}

/**
 * 레일 정렬 정책:
 *  1) 큐레이션 게임 중 players >= minPlayers인 것을 players 내림차순으로 앞에(동률이면 큐레이션 순서).
 *  2) 나머지는 큐레이션 순서대로.
 *  3) 인기 데이터는 큐레이션 레일을 "재정렬"만 한다 — 큐레이션 밖 게임은 절대 들어오지 않는다.
 *     이유: vid는 클라이언트가 만들고 /api/hit는 무인증이라, 누구나 가짜 vid로 임의 게임을 밀어 올릴 수
 *     있다. 큐레이션 집합으로 제한하면 조작해도 "이미 엄선한 게임의 순서"만 바뀐다(잔여 위험 — 수용).
 *     카드 수·집합이 SSR 큐레이션 렌더와 같아 레이아웃도 어긋나지 않는다.
 * 데이터가 없거나 기준 미달이면 정확히 큐레이션 순서 그대로.
 */
export function rankFeatured(
  curated: readonly string[],
  popular: readonly PopularEntry[],
  opts: RankOptions,
): RankedFeatured {
  const min = opts.minPlayers ?? MIN_PLAYERS
  const base = [...new Set(curated.filter((s) => opts.known.has(s)))]
  const curatedIdx = new Map(base.map((s, i) => [s, i]))

  const best = new Map<string, number>()
  for (const p of popular) {
    if (!curatedIdx.has(p.slug) || !(p.players >= min)) continue
    best.set(p.slug, Math.max(best.get(p.slug) ?? 0, p.players))
  }

  const hot = [...best.entries()]
    .sort((a, b) => b[1] - a[1] || curatedIdx.get(a[0])! - curatedIdx.get(b[0])!)
    .map(([s]) => s)

  const hotSet = new Set(hot)
  return { order: [...hot, ...base.filter((s) => !hotSet.has(s))], popular: hotSet }
}

/**
 * 워커 isolate 메모리 캐시 + in-flight 공유. caches.default가 no-op인 *.workers.dev에서도 AE 조회를
 * 제한하고, 캐시 미스가 동시에 몰려도(stampede) AE 쿼리는 하나만 나가게 한다.
 * loader는 { value, ttlMs }를 돌려준다(성공 6시간 / 실패 5분처럼 결과별 TTL).
 */
export function createTtlCache<T>(
  loader: () => Promise<{ value: T; ttlMs: number }>,
  clock: () => number = Date.now,
) {
  let cached: { value: T; expires: number } | null = null
  let inflight: Promise<T> | null = null
  return function get(): Promise<T> {
    if (cached && clock() < cached.expires) return Promise.resolve(cached.value)
    if (inflight) return inflight
    inflight = loader()
      .then(({ value, ttlMs }) => {
        cached = { value, expires: clock() + ttlMs }
        return value
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  }
}
