'use client'

import Link from 'next/link'
import { BudIcon, FlowerIcon } from '@/components/site-chrome/GardenIcons'
import { ChevronIcon } from './HomeIcons'
import type { GardenSlug } from '@/lib/home/garden'
import { useTodayGarden } from '@/lib/home/useTodayGarden'

export type TocGame = { slug: Exclude<GardenSlug, 'slime-slide'>; title: string }

// 각 섬의 하늘(세계관: 게임별 '방'의 시간대 — 계획서 0장)과 한 판 길이(TodayCard COPY와 같은 값)
// 썸네일은 장식(alt="") — 링크 이름은 제목·상태 글자가 맡는다.
const TOC_META: Record<TocGame['slug'], { sky: string; minutes: number }> = {
  'plop-landing': { sky: 'Dawn sky', minutes: 1 },
  'acorn-hop': { sky: 'Night sky', minutes: 3 },
}

/**
 * Originals 목차 "The rest of today's sky"(리디자인 v2 R4). 오늘 호의 나머지 두 섬(Slime Slide는 히어로 카드).
 * 상태 단어(Bloomed / Unplayed)는 R3 readGarden 그대로(useTodayGarden) — 정적 HTML은 Unplayed(D2),
 * 상태 칸 폭을 고정해 바뀌어도 줄이 흔들리지 않는다. 출시 예정(Soon) 행은 출시 1주 전에만(지금은 없음).
 */
export function OriginalsToc({ games }: { games: TocGame[] }) {
  const { garden } = useTodayGarden()
  return (
    <ul className="mt-4 border-t-2 border-garden-ink" data-testid="originals-toc">
      {games.map((g) => {
        const meta = TOC_META[g.slug]
        const bloomed = garden.slots.find((s) => s.slug === g.slug)?.status === 'bloomed'
        return (
          <li key={g.slug} className="border-b border-[#c4a27c]">
            <Link
              href={`/${g.slug}?ref=home-toc`}
              className="flex h-[76px] items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-paper min-[360px]:gap-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/art/thumb-${g.slug}-144.webp`}
                srcSet={`/art/thumb-${g.slug}-144.webp 144w, /art/thumb-${g.slug}.webp 512w`}
                sizes="64px"
                alt=""
                width={64}
                height={64}
                loading="lazy"
                decoding="async"
                className="h-16 w-16 shrink-0 rounded-[14px] border-2 border-garden-ink bg-garden-sea object-cover"
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-display truncate text-[19px] leading-6 font-semibold tracking-[-0.01em]">{g.title}</h3>
                <p className="truncate text-[13px] leading-[18px] text-garden-ink-soft">
                  {meta.sky} · {meta.minutes} min
                </p>
              </div>
              <span
                className={`flex w-[92px] shrink-0 items-center justify-end gap-1.5 text-[13px] leading-[18px] font-semibold ${bloomed ? 'text-garden-leaf-text' : 'text-garden-ink'}`}
                data-testid={`toc-status-${g.slug}`}
              >
                {bloomed ? <FlowerIcon className="h-4 w-4" /> : <BudIcon className="h-4 w-4" />}
                {bloomed ? 'Bloomed' : 'Unplayed'}
              </span>
              <ChevronIcon className="h-5 w-5 shrink-0 max-[359px]:hidden" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
