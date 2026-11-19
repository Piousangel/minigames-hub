'use client'

import Link from 'next/link'
import { sendHit } from '@/lib/hit'
import { HeroPlayButton } from '@/components/HeroPlayButton'
import { BudIcon, FlowerIcon, PlayIcon } from '@/components/site-chrome/GardenIcons'
import { bloomedCount, nextSlot, type Garden, type GardenSlug } from '@/lib/home/garden'
import { useTodayGarden } from '@/lib/home/useTodayGarden'

export type TodayCardGame = { slug: GardenSlug; title: string }

// 카드 문구(게임 제목은 서버가 registry에서 넘긴다 — 클라이언트에 registry를 싣지 않으려고).
const COPY: Record<GardenSlug, { tagline: string; minutes: number }> = {
  'slime-slide': { tagline: 'One line, one jelly, one flower.', minutes: 2 },
  'plop-landing': { tagline: 'Charge, boing, land on the flower.', minutes: 1 },
  'acorn-hop': { tagline: 'Fire an acorn down, fly up.', minutes: 3 },
}

type View = {
  kicker: string
  kickerWide?: string // 360 이상에서만 붙는 꼬리(320에서 한 줄 유지)
  title: string
  tagline: string
  thumb: string | null // 확장자 없는 경로
  cta: string
  href: string
}

/** 상태 → 카드 문구. 세 상태 모두 같은 칸(높이 고정)을 채운다. 테스트도 이 함수의 결과를 본다. */
export function todayCardView(g: Garden, games: TodayCardGame[]): View {
  const title = (slug: GardenSlug) => games.find((x) => x.slug === slug)?.title ?? slug
  if (g.state === 'complete') {
    return {
      kicker: 'Today’s garden is full',
      title: 'All three bloomed',
      tagline: 'New puzzles bloom tomorrow.', // 시각은 쓰지 않는다: 말랑은 현지 자정, 나머지는 UTC 자정(D3)
      thumb: null,
      cta: 'Play more daily games',
      href: '/daily',
    }
  }
  const slug = g.state === 'first' ? 'slime-slide' : (nextSlot(g) ?? 'slime-slide')
  const { tagline, minutes } = COPY[slug]
  return {
    kicker: g.state === 'first' ? `Today’s puzzle · ${minutes} min` : `Next in today’s garden · ${minutes} min`,
    kickerWide: g.state === 'first' ? ' · no sign-up' : undefined,
    title: title(slug),
    tagline,
    thumb: `/art/thumb-${slug}`, // + '-144.webp'(72px 2x, 약 5KB) / '.webp'(512 원본, 3x 기기용)
    cta: `Play today’s ${title(slug)}`,
    href: `/${slug}`,
  }
}

/**
 * 홈 히어로 '오늘 호' 카드(D2). 정적 HTML = first(Slime Slide, 꽃 3칸 빈칸, 노란 Play 하나).
 * 마운트 뒤 오리지널 3종의 오늘 기록으로 in-progress / complete로 바뀐다. 칸 높이는 전부 고정값이라
 * 상태가 바뀌어도 카드 높이는 그대로(CLS 0). 노란색(sun)은 이 카드의 Play 버튼 하나만 쓴다.
 */
export function TodayCard({ games }: { games: TodayCardGame[] }) {
  const { garden } = useTodayGarden()
  const v = todayCardView(garden, games)
  const n = bloomedCount(garden)
  return (
    <section
      aria-labelledby="today-card-title"
      data-testid="today-card"
      data-state={garden.state}
      className="today-card font-ui relative rounded-3xl border-4 border-garden-ink bg-garden-cream p-3 text-garden-ink shadow-[inset_0_2px_0_#fff8ea,0_6px_0_var(--garden-ink-deep)] min-[360px]:p-4"
    >
      <div className="flex h-5 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[12px] leading-4 font-semibold text-garden-coral-text">
          {v.kicker}
          {v.kickerWide && <span className="max-[359px]:hidden">{v.kickerWide}</span>}
        </p>
        <p role="img" className="flex shrink-0 items-center gap-0.5 text-[13px] leading-none font-bold" aria-label={`Today's garden: ${n} of 3 bloomed`}>
          {garden.slots.map((s) =>
            s.status === 'bloomed' ? (
              <FlowerIcon key={s.slug} className="h-[18px] w-[18px]" />
            ) : (
              <BudIcon key={s.slug} className="h-[18px] w-[18px]" />
            ),
          )}
          <b aria-hidden="true" className="ml-1.5 tabular-nums">
            {n}/3
          </b>
        </p>
      </div>

      <div className="mt-3 flex h-[72px] items-center gap-3 min-[360px]:gap-4">
        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border-2 border-garden-ink bg-garden-cream-2">
          {v.thumb ? (
            // 정적 export(이미지 최적화 없음), 크기 고정. fetchPriority low: React가 이 썸네일에 preload를 걸어
            // 히어로 키아트(LCP)와 다투지 않게
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${v.thumb}-144.webp`} srcSet={`${v.thumb}-144.webp 144w, ${v.thumb}.webp 512w`} sizes="72px" alt="" width={72} height={72} decoding="async" fetchPriority="low" className="block h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <FlowerIcon className="h-10 w-10" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h2 id="today-card-title" className="font-display truncate text-[24px] leading-8 font-semibold tracking-[-0.015em] min-[360px]:text-[28px]">{v.title}</h2>
          <p className="font-display-italic mt-0.5 truncate text-[13px] leading-5 min-[360px]:text-[15px] text-garden-ink-soft italic">{v.tagline}</p>
        </div>
      </div>

      <Link
        // ?ref=hero-today: 히어로 1차 CTA 유입 코호트(예전 HeroPlayButton의 ?ref=hero와 구분). 링크 수 집계엔 영향 없음
        href={`${v.href}?ref=hero-today`}
        onClick={() => sendHit(v.href.slice(1), 'hero_today')}
        data-testid="today-play"
        className="garden-jelly mt-4 flex h-[52px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border-[3px] border-garden-ink bg-garden-sun px-3 text-[15px] leading-none font-bold text-garden-ink shadow-garden-button min-[360px]:gap-2.5 min-[360px]:text-[17px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-cream"
      >
        <PlayIcon className="h-[22px] w-[22px] shrink-0" />
        <span className="truncate">{v.cta}</span>
      </Link>

      <div className="mt-1 flex h-11 items-center justify-center">
        <HeroPlayButton className="flex h-11 items-center px-2 text-[13px] font-semibold text-garden-ink-soft underline decoration-dotted decoration-2 underline-offset-4 hover:text-garden-coral-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink rounded-md" />
      </div>
    </section>
  )
}
