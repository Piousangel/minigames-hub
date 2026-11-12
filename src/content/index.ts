import type { Article, ContentSection, ContentTable, GameGuide } from './types'
import { article as designingMorseRelay } from './articles/designing-morse-relay'
import { article as designingPolytap } from './articles/designing-polytap'
import { article as designingPinwheel } from './articles/designing-pinwheel'
import { guide as guideMinesweeper } from './guides/minesweeper'
import { guide as guideMorseRelay } from './guides/morse-relay'
import { guide as guideReactor } from './guides/reactor'
import { guide as guideSudoku } from './guides/sudoku'
import { guide as guideUnblock } from './guides/unblock'
import { guide as guide2048 } from './guides/2048'
import { guide as guideBeatline } from './guides/beatline'
import { guide as guideFlow } from './guides/flow'
import { guide as guideMahjong } from './guides/mahjong'
import { guide as guideQuarry } from './guides/quarry'
import { article as connectFourFirstPlayerVsOurAi } from './articles/connect-four-first-player-vs-our-ai'
import { article as wordGuessBestOpeningWords } from './articles/word-guess-best-opening-words'
import { article as yahtzee300000GamesThreeStrategies } from './articles/yahtzee-300000-games-three-strategies'
import { guide as guideBattleship } from './guides/battleship'
import { guide as guideBisect } from './guides/bisect'
import { guide as guideClusters } from './guides/clusters'
import { guide as guideOverfold } from './guides/overfold'
import { guide as guidePrismbox } from './guides/prismbox'
import { guide as guideTetris } from './guides/tetris'

// 새 공략/기사는 여기에 등록해야 /guides·sitemap·게임 페이지 링크에 나타난다.
export const GUIDES: GameGuide[] = [
  guideMinesweeper,
  guideMorseRelay,
  guideReactor,
  guideSudoku,
  guideUnblock,
  guide2048,
  guideBeatline,
  guideFlow,
  guideMahjong,
  guideQuarry,
  guideBisect,
  guideClusters,
  guideOverfold,
  guidePrismbox,
  guideTetris,
  guideBattleship,
]

export const ARTICLES: Article[] = [
  designingMorseRelay,
  designingPolytap,
  designingPinwheel,
  connectFourFirstPlayerVsOurAi,
  wordGuessBestOpeningWords,
  yahtzee300000GamesThreeStrategies,
]

export type ContentEntry =
  | { type: 'guide'; entry: GameGuide }
  | { type: 'article'; entry: Article }

export function allContent(): ContentEntry[] {
  return [
    ...GUIDES.map((entry) => ({ type: 'guide' as const, entry })),
    ...ARTICLES.map((entry) => ({ type: 'article' as const, entry })),
  ]
}

export function contentBySlug(slug: string): ContentEntry | undefined {
  return allContent().find((c) => c.entry.slug === slug)
}

export function guideForGame(gameSlug: string): GameGuide | undefined {
  return GUIDES.find((g) => g.slug === gameSlug)
}

export function articlesForGame(gameSlug: string): Article[] {
  return ARTICLES.filter((a) => a.relatedGames.includes(gameSlug))
}

/** 대략적 읽기 시간(분) — 영어 기준 230 wpm. 표(캡션·셀)도 읽는 분량에 포함. */
export function readingMinutes(entry: { sections: ContentSection[]; tables?: ContentTable[] }): number {
  const words = [
    ...entry.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.list ?? [])]),
    ...(entry.tables ?? []).flatMap((t) => [t.caption, ...t.columns, ...t.rows.flat()]),
  ]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(words / 230))
}
