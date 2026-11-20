import type { Metadata } from 'next'
import Link from 'next/link'
import { Mascot } from '@/components/Mascot'
import { gardenChip } from '@/components/garden-hub/GardenHub'

// noindex는 Next가 404에 자동으로 넣는다
export const metadata: Metadata = {
  title: 'Page not found',
}


/**
 * 404(정적 export → out/404.html, wrangler `not_found_handling: "404-page"`). 리디자인 v2 R6:
 * 정원 paper 종이 위 크림 카드 + 어지러운 말랑이(mallang-dizzy, 기존 자산 320px → 128px 표시, 15KB) 1마리(D6).
 * 길 잃은 사람을 홈·전체 게임·데일리로 돌려보낸다. 광고 없음.
 */
export default function NotFound() {
  return (
    <main data-world="garden-hub" data-hub-page="not-found" className="font-ui bg-garden-paper px-4 py-12 text-garden-ink sm:py-16">
      <div className="mx-auto max-w-[560px] rounded-3xl border-[3px] border-garden-ink bg-garden-cream px-6 py-8 text-center shadow-[var(--garden-highlight),var(--garden-shadow-seed)] sm:px-10">
        <Mascot art="mallang-dizzy" size={128} loading="eager" className="mx-auto" />
        <p className="mt-4 text-[12px] leading-4 font-semibold text-garden-coral-text">404 · Page not found</p>
        <h1 className="font-display mt-1 text-[28px] leading-[34px] font-semibold tracking-[-0.015em]">
          This path isn’t <em className="font-display-italic italic">in the garden</em>
        </h1>
        <p className="mt-3 text-[16px] leading-[26px] text-garden-ink-deep">
          The page may have moved, or the link has a typo. Every game is still one tap away.
        </p>
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          <li>
            <Link href="/" className={gardenChip}>
              Back to the garden
            </Link>
          </li>
          <li>
            <Link href="/#all-games" className={gardenChip}>
              All games
            </Link>
          </li>
          <li>
            <Link href="/daily" className={gardenChip}>
              Daily games
            </Link>
          </li>
        </ul>
      </div>
    </main>
  )
}
