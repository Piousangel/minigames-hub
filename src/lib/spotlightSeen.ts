/**
 * "예고를 봤다" 기록 — 게임 페이지에서 예고한 스포트라이트 날짜(그날의 "내일")를 최근 몇 개만 저장한다.
 * 다음 날 홈 공개 카드가 "어제 예고됨" 표시를 할지 판단하는 데만 쓴다. 저장소 불가/손상은 전부 무시.
 *
 * 하나만 저장하면 안 된다: 다음 날 첫 방문이 게임 페이지이면 그 날의 "내일" 예고가 먼저 기록돼
 * 어제 기록을 덮어쓰고, 이어서 홈에 가도 배지가 사라진다.
 */
export const SPOTLIGHT_SEEN_KEY = 'spotlight:seen'
const MAXIMUM_REMEMBERED_DATES = 3

function loadTeasedDates(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SPOTLIGHT_SEEN_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}

export function markTeaserSeen(date: string): void {
  try {
    const teasedDates = loadTeasedDates()
    if (teasedDates.includes(date)) return
    const recentDates = [...teasedDates, date].slice(-MAXIMUM_REMEMBERED_DATES)
    localStorage.setItem(SPOTLIGHT_SEEN_KEY, JSON.stringify(recentDates))
  } catch {
    /* localStorage 불가 무시 */
  }
}

export function wasTeasedFor(date: string): boolean {
  return loadTeasedDates().includes(date)
}
