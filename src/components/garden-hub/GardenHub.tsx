import Link from 'next/link'
import type { ReactNode } from 'react'
import { DEFAULT_META, gameMeta, type GameCategory } from '@/lib/games/gameMeta'
import { COLLECTION_SLUGS } from '@/lib/games/collections'
import { Mascot, type MascotArt } from '@/components/Mascot'
import { CATEGORY_TINT, SeedCard } from '@/components/home/SeedCard'

/**
 * 게임 밖 정원 페이지(리디자인 v2 R9) 공용 부품 — /category·/collection(s)·/guides·/daily·/about·/privacy·/terms·/unblocked·/contact.
 * /leaderboards(R6 이월)와 같은 방식: `main[data-world="garden-hub"]`(globals.css가 body 바탕 paper·신스웨이브·줄무늬를 끈다),
 * 토큰 재매핑 없이 크림 paper·ink 클래스로 직접 칠한다. 네온 클래스(neon-*·text-accent·bg-surface·text-fg-muted·font-pixel)는 쓰지 않는다 —
 * `gardenHub.test.ts`(소스)·`e2e/garden-hub.spec.ts`(렌더)가 0을 고정한다(R8 옛 코드 제거의 안전망).
 */

export const gardenRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-paper'

/** 정원 칩(안내판·404와 같은 모양) — 44px */
export const gardenChip = `flex h-11 items-center rounded-full border-2 border-garden-ink bg-garden-cream px-4 text-[14px] font-semibold hover:bg-garden-cream-2 ${gardenRing}`

/** 본문 안 링크 — ink 글자 + 산호색 밑줄(크림·paper 위 ink 10.6:1) */
export const gardenLink =
  'font-semibold text-garden-ink underline decoration-garden-coral-text/60 decoration-2 underline-offset-[3px] hover:text-garden-coral-text hover:decoration-garden-coral-text'

/** 해씨 disc 바탕(홈 선반과 같은 하늘색 — 갈색·크림 몸이 크림 UI에 묻히지 않게, shelves.ts) */
export const HAESSI_SKY = '#bfe6ff'

/** 주 행동(Play) — 해바라기 노랑은 Play·Share 전용(토큰 규칙), ink 윤곽 + 눌림 그림자 */
export const gardenPlayButton = `garden-jelly inline-flex h-11 items-center rounded-full border-2 border-garden-ink bg-garden-sun px-4 text-[15px] font-semibold text-garden-ink shadow-[var(--garden-shadow-button)] ${gardenRing}`

const card =
  'rounded-[18px] border-2 border-garden-ink bg-garden-cream shadow-[var(--garden-highlight),var(--garden-shadow-seed)]'

export function GardenHubPage({
  page,
  width = 'wide',
  children,
}: {
  /** e2e·검사용 페이지 이름(data-hub-page) */
  page: string
  /** wide = 카드 목록(1152px), prose = 글(680px — 한 줄 약 70자) */
  width?: 'wide' | 'prose'
  children: ReactNode
}) {
  return (
    <main data-world="garden-hub" data-hub-page={page} className="font-ui bg-garden-paper text-garden-ink">
      <div className={`mx-auto px-4 pt-5 pb-16 sm:px-6 sm:pt-8 ${width === 'prose' ? 'max-w-[728px]' : 'max-w-6xl'}`}>{children}</div>
    </main>
  )
}

export type Crumb = { href?: string; label: string }

export function GardenBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[14px] leading-5 text-garden-ink-soft">
      <ol className="flex flex-wrap items-center gap-x-1.5">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-x-1.5">
            {i > 0 && (
              <span aria-hidden="true" className="text-garden-ink-soft">
                /
              </span>
            )}
            {c.href ? (
              <Link href={c.href} className={`hit-44 rounded-sm underline decoration-garden-ink/30 underline-offset-[3px] hover:text-garden-ink ${gardenRing}`}>
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-garden-ink">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** 머리 오른쪽 그림: 역할에 맞는 마스코트 1마리(D5·D6). 바탕 disc = 카테고리 꽃색 wash.
 *  단순 SVG 아이콘 원은 쓰지 않는다(오너 11-20 '단순 SVG는 싸 보임') — 맞는 마스코트가 없으면 그림 없이 글 머리로. */
export type HubArt = { mascot: MascotArt; wash?: string }

function HeadArt({ art, compact }: { art: HubArt; compact: boolean }) {
  const box = compact ? 'h-[72px] w-[72px] sm:h-[104px] sm:w-[104px]' : 'h-[84px] w-[84px] sm:h-[136px] sm:w-[136px]'
  const img = compact ? 'h-[64px] w-[64px] sm:h-[92px] sm:w-[92px]' : 'h-[76px] w-[76px] sm:h-[120px] sm:w-[120px]'
  return (
    <div
      className={`relative flex shrink-0 items-end justify-center overflow-hidden rounded-full border-2 border-garden-ink shadow-[var(--garden-shadow-seed)] ${box}`}
      style={{ background: art.wash ?? 'var(--garden-cream-2)' }}
      data-hub-art="mascot"
    >
      {/* 첫 화면 안이라 eager. 192px 사본 → 64~120px 표시(CSS가 크기를 정하고 width/height가 자리를 먼저 잡는다) */}
      <Mascot art={art.mascot} size={120} loading="eager" className={`translate-y-1 sm:translate-y-1.5 ${img}`} />
    </div>
  )
}

/**
 * 정원 머리: 빵 부스러기 → (작은 머리글 + H1 + 소개) | 그림.
 * - 소개가 있으면: 390은 그림이 제목 옆·소개는 아래 전체 폭, 640+는 소개 칸(40rem ≈ 70자) 바로 옆에 그림이 제목+소개 높이 가운데.
 * - 소개가 없으면(글 페이지): 작은 그림을 H1과 세로 가운데 — 큰 원이 H1 아래 빈 띠를 만들지 않게.
 * H1·소개 문구는 예전 그대로 받는다(문구·SEO 불변) — 바뀌는 건 겉모습뿐.
 */
export function GardenHubHead({
  crumbs,
  kicker,
  title,
  art,
  children,
}: {
  crumbs?: Crumb[]
  kicker?: ReactNode
  title: ReactNode
  art?: HubArt
  /** 소개 문단(들) */
  children?: ReactNode
}) {
  const compact = !children
  return (
    <header className="pb-8 sm:pb-10">
      {crumbs && <GardenBreadcrumb items={crumbs} />}
      <div
        className={`grid gap-x-4 sm:gap-x-10 ${art ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-1'} ${art && !compact ? 'sm:grid-cols-[minmax(0,40rem)_auto]' : ''} ${compact ? 'items-center' : 'items-start'} ${crumbs ? 'mt-4 sm:mt-5' : ''}`}
      >
        <div className="min-w-0">
          {kicker && <p className="text-[12px] leading-4 font-semibold tracking-[0.02em] text-garden-coral-text">{kicker}</p>}
          <h1 className="font-display mt-1.5 text-[32px] leading-[38px] font-semibold tracking-[-0.02em] text-garden-ink sm:text-[44px] sm:leading-[50px]">
            {title}
          </h1>
        </div>
        {art && (
          <div className={`col-start-2 row-start-1 ${compact ? '' : 'sm:row-span-2 sm:self-center'}`}>
            <HeadArt art={art} compact={compact} />
          </div>
        )}
        {children && (
          <div className={`mt-4 max-w-[40rem] space-y-3 text-[16px] leading-[26px] text-garden-ink-deep sm:text-[17px] sm:leading-[28px] ${art ? 'col-span-2 sm:col-span-1' : ''}`}>
            {children}
          </div>
        )}
      </div>
    </header>
  )
}

type GridGame = { slug: string; h1: string; shortDescription: string }

/** 게임 목록 = 홈 씨앗 도서관과 같은 '씨앗 봉투' 카드(SeedCard, 카테고리 꽃색 4종) */
export function GardenGameGrid({ games, label }: { games: GridGame[]; label: string }) {
  return (
    <section aria-label={label}>
      {/* 카드 제목이 h3라 h1 → h3 건너뜀(axe heading-order)을 막는 화면 읽기용 h2 — 보이는 화면은 그대로 */}
      <h2 className="sr-only">{label}</h2>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {games.map((g) => (
          <li key={g.slug}>
            <SeedCard slug={g.slug} title={g.h1} description={g.shortDescription} category={categoryOf(g.slug)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function categoryOf(slug: string): GameCategory {
  return (gameMeta[slug] ?? DEFAULT_META).category
}

export const categoryWash = (c: GameCategory) => CATEGORY_TINT[c].wash

/** 링크 카드(컬렉션 목록·가이드 목록) — 크림 종이 + 윗단 꽃색 띠 */
export function GardenLinkCard({
  href,
  title,
  description,
  meta,
  flower,
  headingLevel = 3,
}: {
  href: string
  title: string
  description: string
  meta: ReactNode
  flower: string
  headingLevel?: 2 | 3
}) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <Link href={href} className={`garden-jelly relative flex h-full flex-col overflow-hidden px-4 pt-5 pb-4 ${card} ${gardenRing}`}>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 border-b-[1.5px] border-garden-ink" style={{ background: flower }} />
      <H className="font-display text-[19px] leading-[25px] font-semibold tracking-[-0.01em] text-garden-ink">{title}</H>
      <p className="mt-1.5 text-[14px] leading-[21px] text-garden-ink-deep">{description}</p>
      <p className="mt-auto pt-3 text-[13px] leading-[18px] font-semibold text-garden-ink-soft">{meta}</p>
    </Link>
  )
}

/** 꽃색 4종을 순서대로(컬렉션처럼 카테고리가 없는 목록) */
export const FLOWERS = ['var(--garden-lavender)', 'var(--garden-apricot)', 'var(--garden-clover)', 'var(--garden-sunflower)'] as const

/** 컬렉션 → 꽃색 하나(목록 카드·그 컬렉션 머리 disc가 같은 색). 목록 순서대로 4색을 돌려 이웃 카드가 겹치지 않게 */
export function flowerOf(slug: string): string {
  return FLOWERS[Math.max(0, COLLECTION_SLUGS.indexOf(slug)) % FLOWERS.length]
}

/** FAQ — 크림 카드 한 장 안에 질문·답(점선 구분). 제목 글자·id는 예전 그대로 받는다 */
export function GardenFaq({ id, title = 'FAQ', items }: { id: string; title?: string; items: { q: string; a: string }[] }) {
  return (
    <section aria-labelledby={id} className="mt-14 max-w-3xl">
      <h2 id={id} className="font-display text-[24px] leading-[30px] font-semibold tracking-[-0.015em] text-garden-ink">
        {title}
      </h2>
      <div className={`mt-4 px-5 sm:px-6 ${card}`}>
        {items.map(({ q, a }) => (
          <div key={q} className="border-b border-dashed border-garden-ink/30 py-4 last:border-b-0">
            <h3 className="text-[16px] leading-6 font-semibold text-garden-ink">{q}</h3>
            <p className="mt-1 text-[15px] leading-[24px] text-garden-ink-deep">{a}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/** 다른 길 칩 줄(다른 카테고리·컬렉션 등) */
export function GardenChipNav({ label, title, links, className = 'mt-12' }: { label: string; title?: string; links: { href: string; label: string }[]; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      {title && <p className="mb-3 text-[12px] leading-4 font-semibold text-garden-coral-text">{title}</p>}
      <ul className="flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={gardenChip}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * 글 본문 — 읽기 우선: 17px / 1.75 행간, ink-deep(paper 위 약 15:1), 한 줄 약 70자, 제목 Fraunces.
 * 본문 안 `<a>`·목록·`<strong>`은 여기서 한 번에 칠한다(페이지마다 클래스를 붙이지 않는다).
 */
export const gardenProse =
  'space-y-5 text-[17px] leading-[1.75] text-garden-ink-deep [&_h2]:font-display [&_h2]:!mt-12 [&_h2]:text-[24px] [&_h2]:leading-[30px] [&_h2]:font-semibold [&_h2]:tracking-[-0.015em] [&_h2]:text-garden-ink [&_strong]:font-semibold [&_strong]:text-garden-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_li]:pl-1 [&_li]:marker:text-garden-coral-text [&_a]:font-semibold [&_a]:text-garden-ink [&_a]:underline [&_a]:decoration-garden-coral-text/60 [&_a]:decoration-2 [&_a]:underline-offset-[3px] [&_a:hover]:text-garden-coral-text [&_a]:rounded-sm [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-garden-ink [&_a:focus-visible]:ring-offset-2 [&_a:focus-visible]:ring-offset-garden-paper'

export function GardenProse({ children }: { children: ReactNode }) {
  return <div className={gardenProse}>{children}</div>
}
