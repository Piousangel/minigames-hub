import { ogImage } from '@/lib/og/ogImage'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { allContent, contentBySlug, readingMinutes } from '@/content'
import { ContentBody } from '@/components/ContentBody'
import { GardenHubHead, GardenHubPage, gardenLink, gardenPlayButton } from '@/components/garden-hub/GardenHub'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'

export const dynamicParams = false

export function generateStaticParams() {
  return allContent().map((c) => ({ slug: c.entry.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const c = contentBySlug(slug)
  if (!c) return {}
  const { title, description } = c.entry
  return {
    title: { absolute: `${title} — ${siteConfig.name}` },
    description,
    alternates: { canonical: `/guides/${slug}` },
    // 공략·기사는 다루는 게임의 카드(공략 = 그 게임, 기사 = 첫 관련 게임), 없으면 홈 카드
    openGraph: { title, description, url: `/guides/${slug}`, siteName: siteConfig.name, type: 'article', images: ogImage(gamePages.find((g) => g.slug === (c.type === 'guide' ? c.entry.slug : c.entry.relatedGames?.[0]))?.slug) },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const KIND_LABEL = { guide: 'Strategy guide', 'design-notes': "Designer's notes", data: 'Data deep-dive' } as const

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = contentBySlug(slug)
  if (!c) notFound()

  const { entry } = c
  const date = c.type === 'guide' ? c.entry.updated : c.entry.published
  const gameSlugs = c.type === 'guide' ? [c.entry.slug] : c.entry.relatedGames
  const games = gameSlugs
    .map((s) => gamePages.find((g) => g.slug === s))
    .filter((g): g is NonNullable<typeof g> => Boolean(g))
  const label = c.type === 'guide' ? KIND_LABEL.guide : KIND_LABEL[c.entry.kind]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: entry.title,
    description: entry.description,
    datePublished: date,
    dateModified: date,
    author: { '@type': 'Person', name: siteConfig.author },
    publisher: { '@type': 'Organization', name: siteConfig.name },
    mainEntityOfPage: `${siteConfig.url}/guides/${slug}`,
  }

  return (
    <GardenHubPage page="guide-article" width="prose">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <GardenHubHead crumbs={[{ href: '/guides', label: 'Guides' }, { label }]} title={entry.title}>
        <p className="text-garden-ink">{entry.description}</p>
        <p className="text-[13px] leading-5 text-garden-ink-soft sm:text-[14px]">
          By {siteConfig.author} · {c.type === 'guide' ? 'Updated' : 'Published'} {date} · {readingMinutes(entry)} min read
        </p>
        {games.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {games.map((g) => (
              <Link key={g.slug} href={`/${g.slug}`} className={gardenPlayButton}>
                ▶ Play {g.h1}
              </Link>
            ))}
          </div>
        )}
      </GardenHubHead>
      <ContentBody sections={entry.sections} tables={entry.tables} />
      <p className="mt-14 border-t-2 border-dashed border-garden-ink/30 pt-6 text-[15px] leading-[24px] text-garden-ink-soft">
        Every number on this page comes from the game&apos;s own code or from simulations run against it. Spotted
        something that doesn&apos;t match how the game plays?{' '}
        <Link href="/contact" className={gardenLink}>
          Let me know
        </Link>
        .
      </p>
    </GardenHubPage>
  )
}
