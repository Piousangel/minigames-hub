/**
 * 편집 콘텐츠(심화 공략·설계 노트·데이터 기사) 스키마. AdSense low-value-content 대응의 핵심 —
 * 템플릿 텍스트가 아니라 이 레포의 엔진 코드·시뮬레이션에서만 나올 수 있는 고유 내용.
 * 파일은 src/content/{guides,articles}/<slug>.ts, 목록 등록은 src/content/index.ts.
 */
export interface ContentSection {
  heading: string
  paragraphs: string[]
  list?: string[]
}

export interface ContentTable {
  caption: string
  columns: string[]
  rows: string[][]
}

/** 게임 하나의 심화 공략. slug = 게임 slug(→ /guides/<slug>, 게임 페이지에서 링크). */
export interface GameGuide {
  slug: string
  title: string
  description: string
  updated: string
  sections: ContentSection[]
  tables?: ContentTable[]
}

export interface Article {
  slug: string
  title: string
  description: string
  published: string
  kind: 'design-notes' | 'data'
  relatedGames: string[]
  sections: ContentSection[]
  tables?: ContentTable[]
}
