/**
 * 오늘 호(Edition) — 홈 마스트헤드 "No. N · Thu, Nov 19"의 숫자와 날짜(계획서 2장·D3).
 *
 * 하루 경계는 사이트 데일리 리셋과 같은 **UTC 자정**(src/lib/dailyDate.ts todayUTC). 순수 함수라
 * 날짜를 주입받는다 — `new Date()`는 컴포넌트 층(클라이언트 마운트 뒤)에서만 읽는다. 정적 export
 * HTML에 빌드 시각의 날짜가 굳지 않게 하려는 것(리뷰 B9).
 *
 * No.1 기준일 = 2026-07-18(UTC). 이날 dailyDate.ts(todayUTC)가 생겨 데일리 게임 7종의 "오늘"이
 * 하나의 UTC 자정으로 묶였다(커밋 87c09c7) — 사이트 전체가 같은 순간에 같은 판을 '발행'한 첫날.
 * 그 전에는 게임마다 로컬/UTC 자정이 섞여 '오늘 호'라고 부를 단일한 하루가 없었다. DECISIONS 11-19 R3.
 * 바꾸면 모든 호수가 한꺼번에 바뀌므로 바꾸지 않는다.
 */
export const EDITION_EPOCH_UTC = '2026-07-18'

export type Edition = { no: number; dateUTC: string /* YYYY-MM-DD */; label: string /* "Thu, Nov 19" */ }

const DAY_MS = 86_400_000
const EPOCH_MS = Date.parse(`${EDITION_EPOCH_UTC}T00:00:00Z`)

// en-US 고정 + UTC — 방문자 로캘·시간대와 무관하게 같은 순간엔 같은 문구.
const LABEL = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

export function editionFor(d: Date): Edition {
  const dateUTC = d.toISOString().slice(0, 10)
  const dayMs = Date.parse(`${dateUTC}T00:00:00Z`)
  // 기준일 이전(시계가 틀린 기기 등)은 No.1로 묶는다 — 0·음수 호수는 보여 주지 않는다.
  const no = Math.max(1, Math.floor((dayMs - EPOCH_MS) / DAY_MS) + 1)
  return { no, dateUTC, label: LABEL.format(d) }
}

/** 마스트헤드 한 줄. 화면·테스트가 같은 문자열을 쓴다. */
export const editionLine = (e: Edition): string => `No. ${e.no} · ${e.label}`
