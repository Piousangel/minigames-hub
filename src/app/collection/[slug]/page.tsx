import { ogImage } from '@/lib/og/ogImage'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { gamePages } from '@/lib/games/registry'
import { COLLECTIONS, COLLECTION_SLUGS } from '@/lib/games/collections'
import { GardenChipNav, GardenFaq, GardenGameGrid, GardenHubHead, GardenHubPage } from '@/components/garden-hub/GardenHub'
import { siteConfig, thinPageRobots } from '@/lib/siteConfig'

export const dynamicParams = false

export function generateStaticParams() {
  return COLLECTION_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const c = COLLECTIONS[slug]
  if (!c) return {}
  return {
    title: { absolute: c.title },
    description: c.metaDescription,
    alternates: { canonical: `/collection/${slug}` },
    robots: thinPageRobots,
    openGraph: {
      title: c.title,
      description: c.metaDescription,
      url: `/collection/${slug}`,
      siteName: siteConfig.name,
      type: 'website',
      images: ogImage(),
    },
    twitter: { card: 'summary_large_image', title: c.title, description: c.metaDescription },
  }
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = COLLECTIONS[slug]
  if (!c) notFound()

  const bySlug = new Map(gamePages.map((g) => [g.slug, g]))
  const games = c.games.map((s) => bySlug.get(s)).filter((g): g is NonNullable<typeof g> => Boolean(g))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: c.h1,
        description: c.metaDescription,
        url: `${siteConfig.url}/collection/${slug}`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Collections', item: `${siteConfig.url}/collections` },
          { '@type': 'ListItem', position: 3, name: c.h1, item: `${siteConfig.url}/collection/${slug}` },
        ],
      },
      {
        '@type': 'ItemList',
        itemListElement: games.map((g, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${siteConfig.url}/${g.slug}`,
          name: g.h1,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: c.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }

  return (
    <GardenHubPage page={`collection-${slug}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <GardenHubHead
        crumbs={[{ href: '/', label: 'Home' }, { href: '/collections', label: 'Collections' }, { label: c.h1 }]}
        kicker={`${games.length} games`}
        title={c.h1}
      >
        <p>{c.intro}</p>
      </GardenHubHead>

      <GardenGameGrid games={games} label={`${c.h1} games`} />

      <GardenFaq id="collection-faq" items={c.faq} />

      <GardenChipNav
        label="More collections"
        title="More collections"
        links={COLLECTION_SLUGS.filter((s) => s !== slug).map((s) => ({ href: `/collection/${s}`, label: COLLECTIONS[s].h1 }))}
      />
    </GardenHubPage>
  )
}
