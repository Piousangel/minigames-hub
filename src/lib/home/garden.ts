/**
 * 오늘의 정원 — 오리지널 3종의 '오늘' 기록으로 홈 오늘 호 카드·헤더 pill 상태를 정한다(계획서 2장·D2).
 *
 * 순수 함수: 저장소(getItem만)와 날짜를 주입받는다. 정적 HTML은 늘 'first'(D2)이고,
 * 클라이언트가 마운트 뒤 이 함수로 바꾼다. 저장값이 깨져 있어도 던지지 않고 '안 핀 칸'으로 본다.
 *
 * 칸마다 '핀(bloomed)' 판정 근거(지금 저장소에 실제로 있는 것만 읽는다 — 게임 코드는 건드리지 않음):
 * - slime-slide: 그 게임의 일일 기록 `slime:daily2:<현지 날짜>`(D3: 말랑은 현지 자정)에 시도가 1개 이상.
 * - plop-landing·acorn-hop: 두 게임은 날짜별 완료 기록이 없다. 그래서 오늘(UTC) 그 게임을 연 기록
 *   `quest:<UTC 날짜>`(RecordPlay가 모든 게임 페이지에서 남김)에 slug가 있으면 핀 것으로 본다.
 *   → R5(결과 시트 DailyResult)가 날짜별 완료 기록을 남기면 그 키로 바꾼다(DECISIONS 11-19 R3).
 */
import { slimeDayKey } from '@/lib/games/slime/daily'
import type { Edition } from './edition'

// today.ts의 questKey와 같은 키. today.ts는 registry 전체를 import해서 헤더(전 페이지)에 싣지 않으려고 복사했다 —
// 같은지는 garden.test.ts가 지킨다.
export const questKey = (dateUTC: string): string => `quest:${dateUTC}`

export const GARDEN_SLUGS = ['slime-slide', 'plop-landing', 'acorn-hop'] as const
export type GardenSlug = (typeof GARDEN_SLUGS)[number]
export type GardenState = 'first' | 'in-progress' | 'complete'
export type GardenSlot = { slug: GardenSlug; status: 'unplayed' | 'bloomed' }
export type Garden = { state: GardenState; slots: GardenSlot[] }

/** 정적 HTML·저장소 없음·첫 방문의 모양. */
export const FIRST_GARDEN: Garden = {
  state: 'first',
  slots: GARDEN_SLUGS.map((slug) => ({ slug, status: 'unplayed' })),
}

function parse(raw: string | null): unknown {
  if (raw == null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function slimeBloomed(storage: Pick<Storage, 'getItem'>, localDay: string): boolean {
  const v = parse(storage.getItem(slimeDayKey(localDay)))
  return Array.isArray(v) && v.some((stage) => Array.isArray(stage) && stage.length > 0)
}

function openedToday(storage: Pick<Storage, 'getItem'>, dateUTC: string): Set<string> {
  const v = parse(storage.getItem(questKey(dateUTC)))
  return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
}

/**
 * @param today 오늘 호(UTC). plop·acorn 판정 날짜.
 * @param localDay 말랑 미끄럼길의 '오늘'(현지 날짜, todayLocal). 생략하면 UTC 날짜.
 */
export function readGarden(storage: Pick<Storage, 'getItem'>, today: Edition, localDay: string = today.dateUTC): Garden {
  let slots: GardenSlot[]
  try {
    const opened = openedToday(storage, today.dateUTC)
    slots = GARDEN_SLUGS.map((slug) => ({
      slug,
      status: (slug === 'slime-slide' ? slimeBloomed(storage, localDay) : opened.has(slug)) ? 'bloomed' : 'unplayed',
    }))
  } catch {
    return FIRST_GARDEN // getItem 자체가 던지는 환경(사파리 비공개 모드 등)
  }
  const n = slots.filter((s) => s.status === 'bloomed').length
  return { state: n === 0 ? 'first' : n === slots.length ? 'complete' : 'in-progress', slots }
}

export const bloomedCount = (g: Garden): number => g.slots.filter((s) => s.status === 'bloomed').length

/** 다음에 권할 칸: 순서(말랑 → 뿅 → 도토리)대로 아직 안 핀 첫 게임. 다 피었으면 null. */
export const nextSlot = (g: Garden): GardenSlug | null => g.slots.find((s) => s.status === 'unplayed')?.slug ?? null
