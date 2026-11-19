/**
 * 오늘의 정원 — 오리지널 3종의 '오늘' 완료 기록으로 홈 오늘 호 카드·헤더 pill·티켓 상태를 정한다(계획서 2장·D2).
 *
 * 순수 함수: 저장소(getItem만)와 날짜를 주입받는다. 정적 HTML은 늘 'first'(D2)이고,
 * 클라이언트가 마운트 뒤 이 함수로 바꾼다. 저장값이 깨져 있어도 던지지 않고 '안 핀 칸'으로 본다.
 *
 * 칸이 '핀(bloomed)' 근거 = 결과 시트(R5)가 남기는 날짜별 완료 기록 `garden:done:<날짜>:<slug>` 하나뿐(src/lib/daily/result.ts).
 * - slime-slide: 현지 날짜(todayLocal) 키 — 말랑은 현지 자정에 일일이 바뀐다(D3).
 * - plop-landing·acorn-hop: UTC 날짜(오늘 호) 키.
 * R3의 약한 신호(말랑 = 시도 1개 이상, 뿅·도토리 = 페이지를 연 기록 `quest:<UTC>`)는 **하위 호환으로도 읽지 않는다**:
 * '열었으면 핌'이 남아 있으면 끝내지 않은 게임이 핀 것으로 보여 카드·티켓의 'Bloomed · best N'이 거짓이 된다.
 * 배포 당일 이미 끝낸 사람은 게임 페이지를 다시 열면 말랑이 기록을 채운다(GameSlimeSlide 마운트 백필) — DECISIONS 11-20 R5.
 */
import { readDone, type DoneRecord } from '@/lib/daily/result'
import type { Edition } from './edition'

export const GARDEN_SLUGS = ['slime-slide', 'plop-landing', 'acorn-hop'] as const
export type GardenSlug = (typeof GARDEN_SLUGS)[number]
export type GardenState = 'first' | 'in-progress' | 'complete'
export type GardenSlot = { slug: GardenSlug; status: 'unplayed' | 'bloomed'; result?: DoneRecord }
export type Garden = { state: GardenState; slots: GardenSlot[] }

/** 정적 HTML·저장소 없음·첫 방문의 모양. */
export const FIRST_GARDEN: Garden = {
  state: 'first',
  slots: GARDEN_SLUGS.map((slug) => ({ slug, status: 'unplayed' })),
}

/** 그 게임의 '오늘' 날짜: 말랑 = 현지, 나머지 = UTC. */
export const gardenDay = (slug: GardenSlug, today: Edition, localDay: string): string => (slug === 'slime-slide' ? localDay : today.dateUTC)

/**
 * @param today 오늘 호(UTC). plop·acorn 판정 날짜.
 * @param localDay 말랑 미끄럼길의 '오늘'(현지 날짜, todayLocal). 생략하면 UTC 날짜.
 */
export function readGarden(storage: Pick<Storage, 'getItem'>, today: Edition, localDay: string = today.dateUTC): Garden {
  const slots: GardenSlot[] = GARDEN_SLUGS.map((slug) => {
    const result = readDone(storage, gardenDay(slug, today, localDay), slug) // 던지지 않는다
    return result ? { slug, status: 'bloomed', result } : { slug, status: 'unplayed' }
  })
  const n = slots.filter((s) => s.status === 'bloomed').length
  return { state: n === 0 ? 'first' : n === slots.length ? 'complete' : 'in-progress', slots }
}

export const bloomedCount = (g: Garden): number => g.slots.filter((s) => s.status === 'bloomed').length

/** 다음에 권할 칸: 순서(말랑 → 뿅 → 도토리)대로 아직 안 핀 첫 게임. 다 피었으면 null. */
export const nextSlot = (g: Garden): GardenSlug | null => g.slots.find((s) => s.status === 'unplayed')?.slug ?? null
