import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { COLLECTIONS, COLLECTION_SLUGS } from '@/lib/games/collections'
import { accentVar } from '@/lib/games/gameMeta'
import { GameCard } from '@/components/GameCard'
import { siteConfig } from '@/lib/siteConfig'

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
    openGraph: {
      title: c.title,
      description: c.metaDescription,
      url: `/collection/${slug}`,
      siteName: siteConfig.name,
      type: 'website',
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
  const color = accentVar(c.accent)

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
    <main className="mx-auto max-w-6xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-fg-muted">
        <Link href="/" className="hover:text-fg">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/collections" className="hover:text-fg">
          Collections
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-fg">{c.h1}</span>
      </nav>

      <h1 className="neon-text mb-4 text-3xl font-bold sm:text-4xl" style={{ color }}>
        {c.h1}
      </h1>
      <p className="mb-8 max-w-3xl text-fg-muted">{c.intro}</p>

      <section aria-label={`${c.h1} games`} className="mb-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((g) => (
            <GameCard key={g.slug} slug={g.slug} title={g.h1} description={g.shortDescription} />
          ))}
        </div>
      </section>

      <section aria-labelledby="collection-faq" className="mb-12 max-w-3xl">
        <h2
          id="collection-faq"
          className="neon-text mb-4 text-sm font-bold uppercase tracking-[0.15em]"
          style={{ color }}
        >
          FAQ
        </h2>
        <div className="space-y-4">
          {c.faq.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold">{q}</h3>
              <p className="text-fg-muted">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <nav aria-label="More collections" className="flex flex-wrap gap-3 text-sm">
        {COLLECTION_SLUGS.filter((s) => s !== slug).map((s) => (
          <Link
            key={s}
            href={`/collection/${s}`}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-fg-muted hover:text-fg"
          >
            {COLLECTIONS[s].h1}
          </Link>
        ))}
      </nav>
    </main>
  )
}
