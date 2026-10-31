/**
 * "예고를 봤다" 기록 — 게임오버에서 예고한 스포트라이트 날짜(내일 날짜)를 하나만 저장한다.
 * 다음 날 홈 공개 카드가 "어제 예고됨" 표시를 할지 판단하는 데만 쓴다. 저장소 불가/손상은 전부 무시.
 */
export const SPOTLIGHT_SEEN_KEY = 'spotlight:seen'

export function markTeaserSeen(date: string): void {
  try {
    localStorage.setItem(SPOTLIGHT_SEEN_KEY, date)
  } catch {
    /* localStorage 불가 무시 */
  }
}

export function wasTeasedFor(date: string): boolean {
  try {
    return localStorage.getItem(SPOTLIGHT_SEEN_KEY) === date
  } catch {
    return false
  }
}
