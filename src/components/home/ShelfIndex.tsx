import Link from 'next/link'
import type { Shelf } from '@/lib/home/shelves'
import { Mascot } from '@/components/Mascot'
import { CATEGORY_TINT } from './SeedCard'
import { ChevronIcon } from './HomeIcons'

/**
 * 4선반 색인 "What kind of five minutes?"(리디자인 v2 R4, D4·D5). 서버 렌더.
 * 행(56px) → /category/<slug>. 수는 shelves()의 계산값. 왼쪽 원형 disc(40px)에 선반 주인(마스코트 idle, R6) —
 * 말랑이 Puzzle · 토리 Arcade · 해씨 Classic · 보미 Skill. 해씨는 갈색·크림이라 크림 바탕에 묻혀 disc를 하늘색으로(shelves.ts).
 * 네 disc는 한 묶음(`data-mascot-group`) — D6 '한 뷰포트 1마리'에서 1로 센다(DECISIONS 11-20 R6).
 */
export function ShelfIndex({ shelves }: { shelves: Shelf[] }) {
  return (
    <ul
      data-testid="shelf-index"
      data-mascot-group="shelf"
      className="mt-4 overflow-hidden rounded-2xl border-[3px] border-garden-ink bg-garden-cream shadow-[var(--garden-highlight),var(--garden-shadow-seed)]"
    >
      {shelves.map((s) => (
        <li key={s.slug} className="border-[#c4a27c] [&+&]:border-t">
          <Link
            href={`/category/${s.slug}`}
            data-testid={`shelf-${s.slug}`}
            data-host={s.host}
            className="flex h-14 items-center gap-3 pr-2 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-garden-ink"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-garden-ink"
              style={{ background: s.disc ?? CATEGORY_TINT[s.category].wash }}
            >
              <Mascot art={`${s.host}-idle`} size={34} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] leading-5 font-semibold">{s.name}</span>
              <span className="block truncate text-[12px] leading-4 text-garden-ink-soft">
                {s.category} · {s.blurb}
              </span>
            </span>
            <span className="font-display w-9 text-right text-[22px] leading-none font-semibold tabular-nums" data-testid="shelf-count">
              {s.count}
              <span className="sr-only"> games</span>
            </span>
            <ChevronIcon className="h-5 w-5 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
