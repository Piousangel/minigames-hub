import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { accentVar, DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { isNew, latestSlugs } from '@/lib/newGames'
import { GameIcon } from '@/components/icons/GameIcon'

/** 홈에 보여 줄 최신 출시 최대 개수(오너 지시: 최대 3개). */
export const LATEST_COUNT = 3

/**
 * 홈 최상단 '최신 출시'(히어로 바로 아래). addedDate가 가장 최근인 게임을 큰 카드로, 신작 기간 안의 그다음 게임을 최대 2개까지 작은 카드로 보여 준다.
 * 서버 렌더라 레이아웃이 흔들리지 않고, 새 게임을 추가하면(addedDate) 코드 수정 없이 자동으로 밀려 갱신된다.
 * 큰 카드는 커버(gameMeta.cover)가 있으면 이미지, 없으면 아이콘 그라데이션.
 */
export function LatestRelease() {
  const items = latestSlugs(LATEST_COUNT)
    .map((slug) => ({ slug, page: gamePages.find((g) => g.slug === slug) }))
    .filter((x): x is { slug: string; page: NonNullable<typeof x.page> } => Boolean(x.page))
  if (items.length === 0) return null
  // 큰 카드(가장 최근작)는 항상 보이고, 작은 카드는 신작 기간(NEW_WINDOW_DAYS) 안의 게임만 — 오래된 게임으로 자리를 채우지 않는다.
  // 정적 export라 빌드 시각 기준이며, 매일 배포되므로 하루 이상 어긋나지 않는다.
  const now = Date.now()
  const [main, ...older] = items
  const rest = older.filter(({ slug }) => isNew(gameMeta[slug]?.addedDate, now))
  const meta = gameMeta[main.slug] ?? DEFAULT_META
  const accent = accentVar(meta.accent)
  return (
    <section aria-labelledby="latest-release" data-testid="latest-release" className="mx-auto mb-10 max-w-3xl">
      <Link
        href={`/${main.slug}`}
        data-testid="latest-release-link"
        style={{ borderColor: accent }}
        className="group relative block overflow-hidden rounded-2xl border-2 bg-surface shadow-[0_0_24px_rgba(251,191,36,0.18)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {meta.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meta.cover} alt="" width={1200} height={670} fetchPriority="high" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-surface-2 to-bg-2" style={{ color: accent }}>
            <GameIcon slug={main.slug} className="h-24 w-24" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b16]/90 via-[#0b0b16]/25 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 sm:p-6">
          <span className="font-pixel w-fit rounded-full bg-neon-amber px-2.5 py-1 text-[9px] tracking-[0.2em] text-stone-900 sm:text-[10px]">NEW · LATEST RELEASE</span>
          <h2 id="latest-release" className="neon-text-strong text-2xl font-extrabold leading-tight sm:text-3xl">
            {main.page.h1}
          </h2>
          <p className="max-w-xl text-sm leading-snug text-fg sm:text-base">{main.page.shortDescription}</p>
          <span className="font-pixel mt-1 w-fit text-[10px] tracking-[0.2em] text-neon-amber sm:text-xs">PLAY NOW ►</span>
        </div>
      </Link>

      {rest.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="More recent releases">
          {rest.map(({ slug, page }) => {
            const m = gameMeta[slug] ?? DEFAULT_META
            return (
              <li key={slug}>
                <Link
                  href={`/${slug}`}
                  data-testid="latest-release-more"
                  style={{ borderColor: accentVar(m.accent) }}
                  className="group flex h-full items-center gap-3 rounded-xl border bg-surface/80 p-3 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  <span aria-hidden="true" className="neon-icon inline-flex shrink-0" style={{ color: accentVar(m.accent) }}>
                    <GameIcon slug={slug} className="h-10 w-10" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-bold text-fg">{page.h1}</span>
                    <span className="line-clamp-2 text-xs leading-snug text-fg-muted">{page.shortDescription}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
