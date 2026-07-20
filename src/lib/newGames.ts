import { gameMeta } from './games/gameMeta'

/**
 * '홈 신선함'(DOMAIN §3) — 최근 추가 게임을 NEW로 표시해 복귀 유저에게 홈이 죽은 격자로
 * 안 보이게 한다. addedDate 기준 자동 만료(재빌드 없이 클라이언트 now로 판정).
 */
export const NEW_WINDOW_DAYS = 21

const DAY = 86_400_000

/** addedDate가 now로부터 NEW_WINDOW_DAYS 이내면 true(미래 날짜는 하루 여유). */
export function isNew(addedDate: string | undefined, nowMs: number): boolean {
  if (!addedDate) return false
  const t = Date.parse(addedDate + 'T00:00:00Z')
  if (!Number.isFinite(t)) return false
  const age = nowMs - t
  return age >= -DAY && age < NEW_WINDOW_DAYS * DAY
}

/** 최근 추가 게임 slug, 최신순. */
export function newSlugs(nowMs: number): string[] {
  return Object.entries(gameMeta)
    .filter(([, m]) => isNew(m.addedDate, nowMs))
    .sort((a, b) => ((b[1].addedDate ?? '') < (a[1].addedDate ?? '') ? -1 : 1))
    .map(([slug]) => slug)
}
