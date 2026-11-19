'use client'

import Link from 'next/link'
import { bloomedCount } from '@/lib/home/garden'
import { useTodayGarden } from '@/lib/home/useTodayGarden'
import { TODAY_PILL, chromeFocus, todayPillText } from './chromeBase'
import { FlowerIcon, SunIcon } from './GardenIcons'

/**
 * 헤더 오늘 pill(/daily). 정적 HTML·첫 렌더 = 첫 방문 문구(D2). 마운트 뒤 오늘의 정원 상태로
 * "Today 2/3" / "Garden full". 알약 40px · 터치 영역(링크) 44px 고정 — 상태가 바뀌어도 높이 불변.
 */
export function TodayPill() {
  const { garden } = useTodayGarden()
  const t = todayPillText(garden.state, bloomedCount(garden))
  return (
    <Link
      href={TODAY_PILL.href}
      aria-label={t.name}
      data-testid="today-pill"
      data-state={garden.state}
      className={`group flex h-11 items-center rounded-full ${chromeFocus}`}
    >
      <span className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-garden-ink bg-garden-cream pl-2 pr-3 text-[14px] leading-none font-semibold text-garden-ink tabular-nums transition-colors group-hover:bg-garden-cream-2">
        {garden.state === 'first' ? <SunIcon className="h-[18px] w-[18px] shrink-0" /> : <FlowerIcon className="h-[18px] w-[18px] shrink-0" />}
        {t.short ? (
          <>
            {/* 첫 방문: 폭에 따라 'Daily' → 'Daily puzzles' → 전체 문구(R2). 보이는 글자는 늘 접근 이름의 일부 */}
            <span className="min-[380px]:hidden">{t.tiny}</span>
            <span className="hidden min-[380px]:inline sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </>
        ) : (
          <span>{t.label}</span>
        )}
      </span>
    </Link>
  )
}
