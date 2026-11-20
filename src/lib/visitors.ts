/**
 * 오늘 방문자 수(오너 11-20 "today 방문자 나왔으면 좋겠어") — 워커 + D1 일별 고유 방문자 카운터.
 *
 * 왜 이 방식인가(DECISIONS 11-20 '오늘 방문자'):
 * - 존 트래픽 uniques는 봇이 섞여 하루 수백(페이지뷰와 거의 같다) — 공개 숫자로 쓰면 부풀린 숫자가 된다.
 * - AE(mg_events) vid 집계는 워커 시크릿 CF_ANALYTICS_TOKEN이 아직 없어 쓸 수 없고(/api/popular가 빈 목록), 표본 추출·vid 위조 여지가 있다.
 * - 그래서 사람이 연 페이지만 보내는 /api/hit 'pageview' 비콘을 받을 때 워커가 직접 센다.
 *
 * 개인정보: IP 원문은 저장하지 않는다. 하루마다 새로 뽑은 무작위 솔트(+ 선택 시크릿 RATE_SALT)로 HMAC한 값만
 * visit_seen에 그날 하루 둔다. 날이 바뀌면 지난 날의 해시 행을 지우고 솔트를 NULL로 바꿔 숫자(visit_days.visitors)만 남긴다.
 * IPv6는 /64 앞부분만 쓴다(한 집·한 기기가 주소를 돌려도 한 명으로 — 부풀리지 않는 쪽).
 * 기준 시간대는 UTC(자정 리셋) — 마스트헤드 '오늘 호'와 같은 기준.
 */

export const VISIT_TZ = 'UTC'

/** UTC 날짜 'YYYY-MM-DD'. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** 'YYYY-MM-DD'의 하루 전(UTC). */
export function prevDay(day: string): string {
  return utcDay(Date.parse(`${day}T00:00:00Z`) - 86_400_000)
}

// 크롤러·미리보기 봇·헤드리스·스크립트 클라이언트. 사람 브라우저 UA에는 이 낱말들이 없다.
const BOT_UA =
  /bot|crawl|spider|slurp|scrape|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|quora link|whatsapp|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|undici|httpclient|libwww|postman|insomnia|playwright|puppeteer|phantom|selenium/i

/** 봇·스크립트 UA면 true. UA가 비어 있어도 사람이 아니라고 본다. */
export function isBotUA(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 20) return true
  return BOT_UA.test(ua)
}

/** 셀 단위: IPv4는 주소 그대로, IPv6는 앞 4블록(/64). 빈 값은 ''. */
export function ipBucket(ip: string | null | undefined): string {
  const s = (ip ?? '').trim().toLowerCase()
  if (!s) return ''
  if (!s.includes(':')) return s
  // IPv4-mapped IPv6(::ffff:1.2.3.4)는 뒤의 IPv4로
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return mapped[1]
  // '::' 축약을 펼친 뒤 앞 4블록
  const [head, tail] = s.split('::')
  const h = head ? head.split(':') : []
  const t = tail !== undefined ? (tail ? tail.split(':') : []) : []
  const full = tail !== undefined ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h
  return full
    .slice(0, 4)
    .map((x) => x.replace(/^0+(?=.)/, ''))
    .join(':') + '::/64'
}

/** HMAC-SHA256(key = secret|salt, ip 셀) 앞 16바이트 hex. 같은 날·같은 셀 → 같은 값, 다른 날 → 다른 값. */
export async function visitorHash(bucket: string, daySalt: string, secret = ''): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(`${secret}|${daySalt}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(bucket)))
  return Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
}

// D1 최소 타입(워커와 테스트의 node:sqlite 어댑터가 함께 맞춘다)
export interface VisitStmt {
  bind(...vals: unknown[]): VisitStmt
  all<T = unknown>(): Promise<{ results: T[] }>
  run(): Promise<{ meta?: { changes?: number } }>
}
export interface VisitDb {
  prepare(query: string): VisitStmt
}

/** 지난 날 해시 행을 한 번에 지우는 상한(D1 한 문장 한도 회피). 남은 행은 다음 정리 때. */
export const PRUNE_BATCH = 5000

// isolate당 오늘 솔트 캐시 — 같은 날이면 D1을 다시 읽지 않는다.
let saltCache: { day: string; salt: string } | null = null
/** 테스트용: isolate 캐시 비우기 */
export function resetVisitCache(): void {
  saltCache = null
}

async function daySalt(db: VisitDb, day: string, defer: (p: Promise<unknown>) => void): Promise<string | null> {
  if (saltCache?.day === day) return saltCache.salt
  const created = await db
    .prepare('INSERT OR IGNORE INTO visit_days (day, visitors, salt) VALUES (?, 0, ?)')
    .bind(day, randomSalt())
    .run()
  // 오늘 행을 처음 만든 요청이 지난 날 해시를 정리한다(응답 뒤). 실패해도 다음 날 정리가 day < 오늘로 다시 잡는다.
  if ((created.meta?.changes ?? 0) > 0) defer(pruneBefore(db, day))
  const { results } = await db.prepare('SELECT salt FROM visit_days WHERE day = ?').bind(day).all<{ salt: string | null }>()
  const salt = results[0]?.salt ?? null
  // 솔트가 NULL = 이미 정리된 지난 날(자정 직후 늦게 도착한 요청). 다시 채우면 같은 IP를 또 세므로 세지 않는다.
  if (!salt) return null
  saltCache = { day, salt }
  return salt
}

/** 오늘보다 앞선 날의 솔트 NULL(먼저 — 이것만 돼도 지난 해시는 되돌릴 수 없다) + 해시 행 삭제(숫자만 보존). 따로 실패한다. */
export async function pruneBefore(db: VisitDb, day: string): Promise<void> {
  try {
    await db.prepare('UPDATE visit_days SET salt = NULL WHERE day < ? AND salt IS NOT NULL').bind(day).run()
  } catch (e) {
    console.warn('visit salt prune failed', e)
  }
  try {
    await db
      .prepare('DELETE FROM visit_seen WHERE rowid IN (SELECT rowid FROM visit_seen WHERE day < ? LIMIT ?)')
      .bind(day, PRUNE_BATCH)
      .run()
  } catch (e) {
    console.warn('visit prune failed', e)
  }
}

export type VisitResult = 'counted' | 'seen' | 'bot' | 'no-ip' | 'cross-site' | 'stale'

/**
 * 같은 사이트 페이지가 보낸 요청인가. 브라우저 sendBeacon/fetch는 Sec-Fetch-Site(현대 브라우저) 또는 Origin을 붙인다.
 * 둘 다 없거나 다른 사이트면 세지 않는다(curl 한 줄로 숫자를 올리는 문턱 — 위조는 가능하지만 기본 거름).
 */
export function isSameSite(headers: { get(name: string): string | null }, host: string): boolean {
  const sfs = headers.get('sec-fetch-site')
  if (sfs) return sfs === 'same-origin'
  const origin = headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * 방문 1건 기록. 같은 날·같은 IP 셀은 한 번만 센다(visit_seen PK). 봇 UA·IP 없음·다른 사이트 요청은 세지 않는다.
 * 증가는 INSERT가 실제로 들어간 경우에만 — 중간 실패는 덜 세는 쪽으로만 틀린다(부풀리지 않는다).
 */
export async function recordVisit(
  db: VisitDb,
  opts: {
    ip: string | null
    ua: string | null
    now: number
    secret?: string
    defer?: (p: Promise<unknown>) => void
    /** 같은 사이트 요청 여부(isSameSite). 생략하면 검사하지 않는다(단위 테스트용). */
    sameSite?: boolean
  },
): Promise<VisitResult> {
  if (isBotUA(opts.ua)) return 'bot'
  if (opts.sameSite === false) return 'cross-site'
  const bucket = ipBucket(opts.ip)
  if (!bucket) return 'no-ip'
  const defer = opts.defer ?? ((p) => void p)
  const day = utcDay(opts.now)
  const salt = await daySalt(db, day, defer)
  if (!salt) return 'stale'
  const h = await visitorHash(bucket, salt, opts.secret)
  const ins = await db.prepare('INSERT OR IGNORE INTO visit_seen (day, h) VALUES (?, ?)').bind(day, h).run()
  if ((ins.meta?.changes ?? 0) === 0) return 'seen'
  await db.prepare('UPDATE visit_days SET visitors = visitors + 1 WHERE day = ?').bind(day).run()
  return 'counted'
}

export interface VisitorsPayload {
  tz: typeof VISIT_TZ
  day: string
  today: number | null
  yesterday: number | null
}

/** 오늘·어제 숫자. 표가 없거나(마이그레이션 전) 실패하면 null — 화면은 줄을 숨긴다. */
export async function readVisitors(db: VisitDb, now: number): Promise<VisitorsPayload> {
  const day = utcDay(now)
  const y = prevDay(day)
  try {
    const { results } = await db
      .prepare('SELECT day, visitors FROM visit_days WHERE day IN (?, ?)')
      .bind(day, y)
      .all<{ day: string; visitors: number }>()
    const get = (d: string) => {
      const r = results.find((x) => x.day === d)
      return r ? Number(r.visitors) : 0
    }
    return { tz: VISIT_TZ, day, today: get(day), yesterday: get(y) }
  } catch (e) {
    console.warn('visitors read failed', e)
    return { tz: VISIT_TZ, day, today: null, yesterday: null }
  }
}

/** 이 숫자 아래로는 숫자 대신 문장으로(작은 숫자가 어색하지 않게, 거짓 없이). */
export const SMALL_VISITORS = 10

/** 응답의 day가 지금 UTC 날짜가 아니면(자정 직후 캐시된 어제 응답) 쓰지 않는다. */
export function todayFromPayload(j: { day?: string; today?: number | null } | null | undefined, now: number): number | null {
  if (!j || j.day !== utcDay(now) || typeof j.today !== 'number') return null
  return j.today
}

/** 홈 한 줄 문구. null이면 줄을 숨긴다. */
export function visitorsLine(today: number | null | undefined): string | null {
  // 0이면 줄을 비운다(높이는 그대로) — '방문자가 있다'고 말할 수 없다
  if (today == null || !Number.isFinite(today) || today <= 0) return null
  if (today < SMALL_VISITORS) return 'A few visitors in the garden today'
  return `Today in the garden: ${today.toLocaleString('en-US')} visitors`
}
