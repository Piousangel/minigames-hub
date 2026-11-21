import Link from 'next/link'
import { siteConfig } from '@/lib/siteConfig'
import { COLLECTIONS } from '@/lib/games/collections'
import { gardenChip } from '@/components/garden-hub/GardenHub'

/**
 * '정원 안내판'(리디자인 v2 R4) — 예전 홈 Explore 스트립(Daily·Collections·Unblocked·카테고리 4)의 링크를
 * 그대로 옮기고(홈 내부 링크 감소 0), 큐레이션 컬렉션 몇 개를 더했다. 서버 렌더, 칩 44px.
 * Unblocked는 예전처럼 siteConfig.thinPagesNoindex일 때 숨긴다(AdSense 심사 스위치).
 */
export const SIGNBOARD_COLLECTIONS = ['quick-games', 'brain-games', 'two-player-games', 'solitaire-games'] as const

export function signboardLinks(): { href: string; label: string }[] {
  return [
    { href: '/daily', label: 'Daily games' },
    { href: '/collection/original-games', label: 'Originals' },
    { href: '/leaderboards', label: 'Leaderboards' },
    { href: '/guides', label: 'Guides' },
    { href: '/collections', label: 'All collections' },
    ...(siteConfig.thinPagesNoindex ? [] : [{ href: '/unblocked', label: 'Unblocked' }]),
    { href: '/category/puzzle', label: 'Puzzle' },
    { href: '/category/arcade', label: 'Arcade' },
    { href: '/category/classic', label: 'Classic' },
    { href: '/category/skill', label: 'Skill' },
    ...SIGNBOARD_COLLECTIONS.filter((s) => COLLECTIONS[s]).map((s) => ({ href: `/collection/${s}`, label: COLLECTIONS[s].h1 })),
  ]
}

export function GardenSignboard() {
  return (
    <nav aria-label="Explore games" className="font-ui text-garden-ink" data-testid="garden-signboard">
      <p className="text-[12px] leading-4 font-semibold text-garden-coral-text">Garden signboard</p>
      <h2 className="font-display mt-1 text-[24px] leading-[30px] font-semibold tracking-[-0.015em]">
        Other paths <em className="font-display-italic italic">through the garden</em>
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {signboardLinks().map((l) => (
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
