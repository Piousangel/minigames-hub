import type { Metadata } from 'next'
import Link from 'next/link'
import { COLLECTIONS, COLLECTION_SLUGS } from '@/lib/games/collections'
import { accentVar } from '@/lib/games/gameMeta'
import { siteConfig } from '@/lib/siteConfig'

const TITLE = 'Game Collections — Free Browser Games by Theme'
const META_DESC =
  'Browse free browser games by theme — games like Wordle, 2048 and Connections, plus word games, number games, 2 player games and logic puzzles. No download, no sign-up.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: META_DESC,
  alternates: { canonical: '/collections' },
  openGraph: { title: TITLE, description: META_DESC, url: '/collections', siteName: siteConfig.name, type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: META_DESC },
}

export default function CollectionsIndex() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Game Collections',
    description: META_DESC,
    url: `${siteConfig.url}/collections`,
    hasPart: COLLECTION_SLUGS.map((s) => ({
      '@type': 'CollectionPage',
      name: COLLECTIONS[s].h1,
      url: `${siteConfig.url}/collection/${s}`,
    })),
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-fg-muted">
        <Link href="/" className="hover:text-fg">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-fg">Collections</span>
      </nav>

      <h1 className="neon-text mb-4 text-3xl font-bold text-neon-cyan sm:text-4xl">Game Collections</h1>
      <p className="mb-8 max-w-3xl text-fg-muted">
        Hand-picked sets of our free browser games, grouped by what you are in the mood for — games
        like the daily puzzles you already love, or a whole shelf of word, number, two-player and
        logic games. Every game is free, loads instantly, and needs no download or account.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COLLECTION_SLUGS.map((s) => {
          const c = COLLECTIONS[s]
          return (
            <Link
              key={s}
              href={`/collection/${s}`}
              className="neon-box neon-box-hover group rounded-xl border border-border bg-surface/80 p-4 transition-colors"
              style={{ color: accentVar(c.accent) }}
            >
              <h2 className="neon-text text-lg font-bold">{c.h1}</h2>
              <p className="mt-1 text-sm text-fg-muted">{c.metaDescription}</p>
              <span className="mt-2 inline-block text-xs text-fg-muted">{c.games.length} games →</span>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
