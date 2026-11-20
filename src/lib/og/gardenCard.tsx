/**
 * 정원 공유 카드(OG 1200×630) — 홈·게임 페이지 `opengraph-image.tsx`가 함께 쓴다.
 *
 * 왜 여기 따로: 리디자인 v2로 사이트는 크림 정원이 됐는데 공유 미리보기(Threads·Bluesky·카톡·검색)는 옛 네온 카드였다.
 * 첫 유입(공유 링크)이 보는 그림과 들어와서 보는 사이트가 달랐다(specs/2026-11-20-share-preview-garden.md).
 *
 * Satori 제약(빌드 시 정적 생성, `dynamic = 'force-static'`):
 * - webp를 못 읽는다(실측: "u2 is not iterable") → 그림은 `assets/`의 JPEG·PNG 사본(public/art 원본에서 sharp로 만든 것).
 * - woff2를 못 읽고 가변 글꼴 축을 고르지 못한다 → `assets/`의 정적·Latin 부분집합 TTF(src/app/fonts 원본에서 fontTools로).
 * - CSS 변수를 못 읽는다 → 색은 아래 G 리터럴(globals.css --garden-* 값과 같음, 테스트가 대조).
 * 그림을 바꾸면 `assets/README.md`의 재생성 명령을 다시 돌린다.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { GameCategory } from '@/lib/games/gameMeta'
import { GardenLogoMark } from '@/components/site-chrome/GardenIcons'

export const OG_SIZE = { width: 1200, height: 630 }

/** globals.css :root --garden-* 와 같은 값(gardenCard.test.ts가 대조). */
export const G = {
  paper: '#fffaf0',
  cream: '#fff3dc',
  cream2: '#fbeccc',
  ink: '#5b3a1e',
  inkSoft: '#7a5636',
  inkDeep: '#3a2410',
  coralText: '#b3431f',
  sun: '#ffc933',
} as const

/** 카테고리 꽃색(면 전용) — Puzzle·Arcade·Classic·Skill = lavender·apricot·clover·sunflower(globals.css). */
export const CATEGORY_FLOWER: Record<GameCategory, string> = {
  Puzzle: '#c9b6f2',
  Arcade: '#ffb27a',
  Classic: '#a8d98f',
  Skill: '#ffd966',
}

/** 계획서 D5: 마스코트 ↔ 카테고리 1:1(말랑 = Puzzle, 토리 = Arcade, 해씨 = Classic, 보미 = Skill). */
export const CATEGORY_MASCOT: Record<GameCategory, 'mallang' | 'tori' | 'haessi' | 'bomi'> = {
  Puzzle: 'mallang',
  Arcade: 'tori',
  Classic: 'haessi',
  Skill: 'bomi',
}

/** 표지 그림(gameMeta.cover)이 있는 게임 — assets/cover-<slug>.jpg 사본이 있어야 한다(테스트가 대조). */
export const COVER_SLUGS = ['acorn-hop', 'slime-slide', 'plop-landing', 'shadowfit', 'slosh', 'polarity'] as const

const ASSETS = path.join(process.cwd(), 'src/lib/og/assets')
const cache = new Map<string, Buffer>()
const file = (name: string): Buffer => {
  let b = cache.get(name)
  if (!b) {
    b = readFileSync(path.join(ASSETS, name))
    cache.set(name, b)
  }
  return b
}
export const assetDataUrl = (name: string): string =>
  `data:${name.endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${file(name).toString('base64')}`

export function ogFonts() {
  return [
    { name: 'Fraunces', data: file('Fraunces-600.ttf'), weight: 600 as const, style: 'normal' as const },
    { name: 'Figtree', data: file('Figtree-600.ttf'), weight: 600 as const, style: 'normal' as const },
    { name: 'Figtree', data: file('Figtree-800.ttf'), weight: 800 as const, style: 'normal' as const },
  ]
}

/** 제목 길이 → 글자 크기(20자까지 72px 이상 — 작은 썸네일에서 읽히는 하한, 리서치 2). 긴 제목은 두 줄까지. */
export function titleSize(title: string): number {
  const n = title.length
  if (n <= 10) return 104
  if (n <= 16) return 88
  if (n <= 20) return 72
  return 62 // 21자 이상(지금은 없음): 가운데 630px·두 줄 안에 두려고 한 단계 더 줄인다(리뷰)
}

/** 브랜드 줄: 헤더와 같은 로고 마크 + 이름. */
function BrandMark() {
  const color = G.ink
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <GardenLogoMark size={48} />
      <div style={{ display: 'flex', fontFamily: 'Figtree', fontWeight: 800, fontSize: 32, color }}>Quick MiniGames</div>
    </div>
  )
}

export function HomeCard({ gameCount }: { gameCount: number }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: '#f8806a' }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={assetDataUrl('home-bg.jpg')} width={1200} height={630} style={{ position: 'absolute', left: 0, top: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', padding: '64px 0 0 72px', width: 640 }}>
        <BrandMark />
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40, fontFamily: 'Fraunces', fontWeight: 600, fontSize: 84, lineHeight: 1.02, color: G.inkDeep, letterSpacing: -1.5 }}>
          <span>Free online</span>
          <span>mini games</span>
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontFamily: 'Figtree', fontWeight: 600, fontSize: 30, lineHeight: 1.3, color: G.inkDeep }}>
          A small garden that blooms daily.
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 34,
            alignSelf: 'flex-start',
            padding: '12px 26px',
            borderRadius: 999,
            border: `4px solid ${G.ink}`,
            backgroundColor: G.cream,
            fontFamily: 'Figtree',
            fontWeight: 800,
            fontSize: 28,
            color: G.ink,
          }}
        >
          {`${gameCount} games · no download · no sign-up`}
        </div>
      </div>
    </div>
  )
}

export type GameCardInput = { slug: string; title: string; category: GameCategory; daily: boolean }

/** 표지 그림이 있는 오리지널: 그림을 그대로 깔고 아래 크림 띠에 카테고리·제목(가운데 — 정사각 크롭에서도 남게, 리뷰). */
function CoverGameCard({ slug, title, category, daily }: GameCardInput) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: G.paper }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={assetDataUrl(`cover-${slug}.jpg`)} width={1200} height={630} style={{ position: 'absolute', left: 0, top: 0 }} />
      <div
        style={{
          position: 'absolute',
          left: 28,
          top: 26,
          display: 'flex',
          padding: '8px 22px 8px 14px',
          borderRadius: 999,
          border: `4px solid ${G.ink}`,
          backgroundColor: G.cream,
        }}
      >
        <BrandMark />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 270,
          right: 270,
          bottom: 34,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '18px 24px 22px',
          borderRadius: 32,
          border: `5px solid ${G.ink}`,
          backgroundColor: G.cream,
          boxShadow: `0 8px 0 ${G.inkDeep}`,
        }}
      >
        <div style={{ display: 'flex', fontFamily: 'Figtree', fontWeight: 800, fontSize: 24, color: G.coralText, letterSpacing: 1.5 }}>
          {(daily ? `${category} · daily challenge` : `${category} · original game`).toUpperCase()}
        </div>
        <div style={{ display: 'flex', fontFamily: 'Fraunces', fontWeight: 600, fontSize: 72, lineHeight: 1.05, color: G.inkDeep, letterSpacing: -1 }}>{title}</div>
      </div>
    </div>
  )
}

/**
 * 일반 게임 카드. 가운데 정렬(리서치 2): Threads·iMessage·Slack 작은 썸네일은 가운데 정사각으로 자르므로
 * 아이콘·제목을 가운데 630px 안에 둔다. 작은 꼬리 문구(설명 한 줄)는 썸네일에서 안 읽혀 넣지 않는다.
 */
export function GameCard(input: GameCardInput & { icon: React.ReactNode }) {
  if ((COVER_SLUGS as readonly string[]).includes(input.slug)) return <CoverGameCard {...input} />
  const { title, category, icon, daily } = input
  const flower = CATEGORY_FLOWER[category]
  const mascot = CATEGORY_MASCOT[category]
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        backgroundColor: G.paper,
        // 노을 하늘(위) — 홈 히어로와 같은 세계라는 표시
        backgroundImage: 'linear-gradient(180deg, #ff9d7a 0px, #ffc6a0 120px, #fffaf0 260px)',
        paddingTop: 48,
      }}
    >
      <div
        style={{
          width: 216,
          height: 216,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 52,
          border: `6px solid ${G.ink}`,
          backgroundColor: flower,
          boxShadow: `0 10px 0 ${G.inkDeep}`,
        }}
      >
        {icon}
      </div>
      <div style={{ display: 'flex', marginTop: 30, fontFamily: 'Figtree', fontWeight: 800, fontSize: 28, color: G.coralText, letterSpacing: 2 }}>
        {(daily ? `${category} · daily challenge` : `${category} · free online game`).toUpperCase()}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 6,
          padding: '0 60px',
          textAlign: 'center',
          fontFamily: 'Fraunces',
          fontWeight: 600,
          fontSize: titleSize(title),
          lineHeight: 1.02,
          color: G.inkDeep,
          letterSpacing: -1.5,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTop: `5px solid ${G.ink}`,
          backgroundColor: G.cream,
        }}
      >
        <BrandMark />
      </div>
      {/* 카테고리 마스코트 한 마리(D5·D6) — 바닥 띠에 걸터앉게. 정사각 크롭에선 잘려도 되는 장식 */}
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={assetDataUrl(`${mascot}.png`)} width={180} height={180} style={{ position: 'absolute', right: 56, bottom: 30 }} />
    </div>
  )
}
