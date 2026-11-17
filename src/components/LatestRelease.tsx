import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { accentVar, DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { latestSlug } from '@/lib/newGames'
import { GameIcon } from '@/components/icons/GameIcon'

/**
 * 홈 최상단 '최신 출시' 카드(히어로 바로 아래). 가장 최근에 추가된 게임을 항상 하나 크게 보여 준다.
 * 서버 렌더라 레이아웃이 흔들리지 않고, 새 게임을 추가하면(addedDate) 코드 수정 없이 자동으로 바뀐다.
 * 커버(gameMeta.cover)가 있으면 이미지, 없으면 아이콘 그라데이션.
 */
export function LatestRelease() {
  const slug = latestSlug()
  const page = slug ? gamePages.find((g) => g.slug === slug) : undefined
  if (!slug || !page) return null
  const meta = gameMeta[slug] ?? DEFAULT_META
  const accent = accentVar(meta.accent)
  return (
    <section aria-labelledby="latest-release" data-testid="latest-release" className="mx-auto mb-10 max-w-3xl">
      <Link
        href={`/${slug}`}
        data-testid="latest-release-link"
        style={{ borderColor: accent }}
        className="group relative block overflow-hidden rounded-2xl border-2 bg-surface shadow-[0_0_24px_rgba(251,191,36,0.18)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {meta.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meta.cover} alt="" width={1200} height={670} fetchPriority="high" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-surface-2 to-bg-2" style={{ color: accent }}>
            <GameIcon slug={slug} className="h-24 w-24" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b16]/90 via-[#0b0b16]/25 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 sm:p-6">
          <span className="font-pixel w-fit rounded-full bg-neon-amber px-2.5 py-1 text-[9px] tracking-[0.2em] text-stone-900 sm:text-[10px]">NEW · LATEST RELEASE</span>
          <h2 id="latest-release" className="neon-text-strong text-2xl font-extrabold leading-tight sm:text-3xl">
            {page.h1}
          </h2>
          <p className="max-w-xl text-sm leading-snug text-fg sm:text-base">{page.shortDescription}</p>
          <span className="font-pixel mt-1 w-fit text-[10px] tracking-[0.2em] text-neon-amber sm:text-xs">PLAY NOW ►</span>
        </div>
      </Link>
    </section>
  )
}
