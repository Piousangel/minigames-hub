import { MAX_SCORE, cleanName } from './leaderboard'

/**
 * 1:1 도전 링크 — "같은 판(시드)에서 내 점수를 넘어봐"를 URL 하나에 담는다.
 * 서버·D1 없이 동작(포털 빌드로도 이식 가능). 형식:
 *   /<slug>?vs=<seed36>-<score36>-<chk36>&n=<name>&ref=share
 *
 * chk는 서명이 아니다 — 정적 사이트라 키를 숨길 곳이 없다. 잘린 URL·오타를 걸러내는
 * 체크섬일 뿐이고, 위조돼도 피해는 링크를 받은 친구 한 명뿐이라 감수한다.
 * ref=share는 hit.ts가 유입 출처로 기록한다(메신저 링크는 referrer가 비어 있어서).
 */
export interface Challenge {
  seed: number
  score: number
  name: string
}

export type ChallengeOutcome =
  | { kind: 'win'; diff: number }
  | { kind: 'tie'; diff: 0 }
  | { kind: 'lose'; diff: number; pct: number }

const MAX_SEED = 0xffffffff

/** cleanName의 16자 slice가 이모지를 반으로 자르면 외톨이 서로게이트가 남는데,
 *  URLSearchParams는 그걸 U+FFFD로 바꿔 보낸다 → 받는 쪽 체크섬이 안 맞는다.
 *  해시하기 전에 같은 치환을 먼저 해서 송수신 양쪽이 같은 문자열을 보게 한다. */
function linkName(raw: unknown): string {
  return cleanName(raw).replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
}

// FNV-1a 32bit → base36 3자리(36^3 = 46656가지). 오타 검출용으로 충분.
function checksum(seed: number, score: number, name: string): string {
  let h = 0x811c9dc5
  const s = `${seed}|${score}|${name}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return ((h >>> 0) % 46656).toString(36).padStart(3, '0')
}

/** 도전 쿼리스트링(앞의 '?' 없음). */
export function challengeQuery(c: Challenge): string {
  const name = linkName(c.name)
  const seed = c.seed >>> 0
  // 파서와 같은 범위로 클램프 — 범위 밖 점수로 만든 링크는 받는 쪽에서 조용히 버려진다.
  const score = Math.min(MAX_SCORE, Math.max(0, Math.floor(c.score)))
  const vs = `${seed.toString(36)}-${score.toString(36)}-${checksum(seed, score, name)}`
  return new URLSearchParams({ vs, n: name, ref: 'share' }).toString()
}

export function challengeUrl(origin: string, slug: string, c: Challenge): string {
  return `${origin}/${slug}?${challengeQuery(c)}`
}

/** location.search에서 도전을 읽는다. 없거나 깨졌으면 null(일반 플레이로 폴백). */
export function parseChallenge(search: string): Challenge | null {
  const params = new URLSearchParams(search)
  const vs = params.get('vs')
  if (!vs) return null
  const m = /^([0-9a-z]{1,7})-([0-9a-z]{1,6})-([0-9a-z]{3})$/.exec(vs)
  if (!m) return null
  const seed = parseInt(m[1], 36)
  const score = parseInt(m[2], 36)
  if (!Number.isFinite(seed) || seed > MAX_SEED) return null
  if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) return null
  const name = linkName(params.get('n'))
  if (checksum(seed, score, name) !== m[3]) return null
  return { seed, score, name }
}

/** 내 점수 vs 도전자 점수. lose일 땐 니어미스 표시용 달성률(%)도 준다. */
export function compareChallenge(mine: number, theirs: number): ChallengeOutcome {
  if (mine > theirs) return { kind: 'win', diff: mine - theirs }
  if (mine === theirs) return { kind: 'tie', diff: 0 }
  return { kind: 'lose', diff: theirs - mine, pct: Math.floor((mine / theirs) * 100) }
}
