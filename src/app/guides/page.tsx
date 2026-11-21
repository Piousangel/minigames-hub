import { ogImage } from '@/lib/og/ogImage'
import type { Metadata } from 'next'
import { GardenHubHead, GardenHubPage, GardenLinkCard, HAESSI_SKY } from '@/components/garden-hub/GardenHub'
import { ARTICLES, GUIDES, readingMinutes } from '@/content'
import { siteConfig } from '@/lib/siteConfig'

const TITLE = 'Game Guides, Designer Notes & Data'
const DESCRIPTION =
  'In-depth strategy guides, designer notes on original games, and data from simulating this site\'s own game engines.'

export const metadata: Metadata = {
  title: { absolute: `${TITLE} — ${siteConfig.name}` },
  description: DESCRIPTION,
  alternates: { canonical: '/guides' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/guides', siteName: siteConfig.name, type: 'website', images: ogImage() },
}

const SECTION_FLOWER = {
  guides: 'var(--garden-clover)',
  data: 'var(--garden-lavender)',
  design: 'var(--garden-apricot)',
} as const

function Shelf({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 first:mt-0">
      <h2 id={id} className="font-display text-[24px] leading-[30px] font-semibold tracking-[-0.015em] text-garden-ink">
        {title}
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">{children}</ul>
    </section>
  )
}

export default function GuidesHub() {
  const design = ARTICLES.filter((a) => a.kind === 'design-notes')
  const data = ARTICLES.filter((a) => a.kind === 'data')
  return (
    <GardenHubPage page="guides">
      {/* 안내 = 해씨(D5), 생각하는 포즈(기존 160px 사본) */}
      <GardenHubHead kicker={`${GUIDES.length + ARTICLES.length} guides and articles`} title={TITLE} art={{ mascot: 'haessi-think', wash: HAESSI_SKY }}>
        <p>
          Every game on {siteConfig.name} runs on a rules engine I wrote myself, which means I can read the exact
          scoring formulas and run thousands of simulated games to see what actually works. These pages are where that
          goes: strategy guides grounded in the real rules, notes on how the site&apos;s original games were designed and
          changed, and numbers you won&apos;t find anywhere else.
        </p>
      </GardenHubHead>

      <div className="max-w-4xl">
        {GUIDES.length > 0 && (
          <Shelf id="guides-strategy" title="Strategy guides">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <GardenLinkCard href={`/guides/${g.slug}`} title={g.title} description={g.description} meta={`${readingMinutes(g)} min read`} flower={SECTION_FLOWER.guides} />
              </li>
            ))}
          </Shelf>
        )}

        {data.length > 0 && (
          <Shelf id="guides-data" title="Data deep-dives">
            {data.map((a) => (
              <li key={a.slug}>
                <GardenLinkCard href={`/guides/${a.slug}`} title={a.title} description={a.description} meta={`${a.published} · ${readingMinutes(a)} min read`} flower={SECTION_FLOWER.data} />
              </li>
            ))}
          </Shelf>
        )}

        {design.length > 0 && (
          <Shelf id="guides-design" title={"Designer's notes"}>
            {design.map((a) => (
              <li key={a.slug}>
                <GardenLinkCard href={`/guides/${a.slug}`} title={a.title} description={a.description} meta={`${a.published} · ${readingMinutes(a)} min read`} flower={SECTION_FLOWER.design} />
              </li>
            ))}
          </Shelf>
        )}
      </div>
    </GardenHubPage>
  )
}
