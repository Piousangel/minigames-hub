/**
 * 홈 '4선반 색인'·'씨앗 도서관(All games)'의 계산값(계획서 2장 Shelf, D4·D5).
 *
 * - 선반 수는 항상 gamePages × gameMeta에서 센다(하드코딩 금지, D4). 합계 = gamePages.length를 테스트가 지킨다.
 * - 마스코트 ↔ 카테고리 1:1(D5): 말랑이 = Puzzle, 토리 = Arcade, 해씨 = Classic, 보미 = Skill.
 *   R6부터 원형 disc에 그 마스코트 idle 그림(`disc` = 바탕색 — 해씨만 하늘색, 갈색·크림 몸이 크림 UI에 묻히지 않게).
 * - registry를 import하지 않는다(서버 컴포넌트가 pages를 넘긴다) — 테스트에서 가짜 목록을 넣기 쉽게.
 */
import { CATEGORIES, DEFAULT_META, type GameCategory, type GameMeta } from '@/lib/games/gameMeta'

export type ShelfHost = 'mallang' | 'tori' | 'haessi' | 'bomi'

export type Shelf = {
  category: GameCategory
  /** /category/<slug> (실제 라우트: src/app/category/[slug]/page.tsx의 HUBS 키) */
  slug: 'puzzle' | 'arcade' | 'classic' | 'skill'
  count: number
  host: ShelfHost
  /** 선반 이름(무엇을 하고 싶은지) */
  name: string
  /** 한 줄 설명 */
  blurb: string
  /** 마스코트 disc 바탕색 — 없으면 카테고리 wash(CATEGORY_TINT). 해씨만 하늘색 */
  disc?: string
}

type ShelfStatic = Omit<Shelf, 'category' | 'count'>

const SHELF_BY_CATEGORY: Record<GameCategory, ShelfStatic> = {
  Puzzle: { slug: 'puzzle', host: 'mallang', name: 'Wake my brain', blurb: 'logic, words, numbers' },
  Arcade: { slug: 'arcade', host: 'tori', name: 'Busy hands', blurb: 'quick reflex rounds' },
  Classic: { slug: 'classic', host: 'haessi', name: 'Slow & classic', blurb: 'cards, boards, tiles', disc: '#bfe6ff' },
  Skill: { slug: 'skill', host: 'bomi', name: 'Steady aim', blurb: 'timing and touch' },
}

type PageLike = { slug: string }
type MetaTable = Record<string, GameMeta | undefined>

export const categoryOf = (slug: string, meta: MetaTable): GameCategory => (meta[slug] ?? DEFAULT_META).category

/** 4선반(Puzzle·Arcade·Classic·Skill 순서 고정). 수는 계산값. */
export function shelves(pages: readonly PageLike[], meta: MetaTable): Shelf[] {
  const counts = new Map<GameCategory, number>(CATEGORIES.map((c) => [c, 0]))
  for (const p of pages) {
    const c = categoryOf(p.slug, meta)
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return CATEGORIES.map((category) => ({ category, count: counts.get(category) ?? 0, ...SHELF_BY_CATEGORY[category] }))
}

/**
 * 씨앗 도서관 기본 순서: 카테고리를 돌아가며 한 개씩(Puzzle → Arcade → Classic → Skill → Puzzle …),
 * 각 카테고리 안은 registry 순서. 접힌 상태(앞 24개, 모바일 12개)에도 네 선반이 고르게 보이게 하려는 것.
 * 원소는 그대로 돌려준다(복사·누락 없음 — 길이·집합이 같음을 테스트가 지킨다).
 */
export function libraryOrder<T extends { category: GameCategory }>(items: readonly T[]): T[] {
  const queues = CATEGORIES.map((c) => items.filter((it) => it.category === c))
  const rest = items.filter((it) => !CATEGORIES.includes(it.category))
  const out: T[] = []
  for (let i = 0; out.length < items.length - rest.length; i++) {
    for (const q of queues) if (i < q.length) out.push(q[i])
  }
  return [...out, ...rest]
}

/** 접힌 상태에서 보이는 카드 수 — md(768px) 이상(나머지도 HTML에는 모두 있다). */
export const LIBRARY_PREVIEW = 24

/**
 * 접힌 상태에서 md 미만(모바일)에 보이는 카드 수(오너 11-20: 홈 390 높이 줄이기).
 * 13~24번째는 CSS(`max-md:hidden`)로만 숨긴다 — JS 분기가 없어 정적 HTML·하이드레이션이 폭과 무관하게 같다(CLS 0).
 * 카테고리 번갈아 순서라 12개 안에서도 네 카테고리가 3개씩.
 */
export const LIBRARY_PREVIEW_MOBILE = 12
