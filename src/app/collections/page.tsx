import { ogImage } from '@/lib/og/ogImage'
import type { Metadata } from 'next'
import { COLLECTIONS, COLLECTION_SLUGS } from '@/lib/games/collections'
import { GardenHubHead, GardenHubPage, GardenLinkCard, flowerOf } from '@/components/garden-hub/GardenHub'
import { siteConfig, thinPageRobots } from '@/lib/siteConfig'

const TITLE = 'Game Collections — Free Browser Games by Theme'
const META_DESC =
  'Browse free browser games by theme — games like Wordle, 2048 and Connections, plus word games, number games, 2 player games and logic puzzles. No download, no sign-up.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: META_DESC,
  alternates: { canonical: '/collections' },
  robots: thinPageRobots,
  openGraph: { title: TITLE, description: META_DESC, url: '/collections', siteName: siteConfig.name, type: 'website', images: ogImage() },
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
    <GardenHubPage page="collections">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <GardenHubHead
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Collections' }]}
        kicker={`${COLLECTION_SLUGS.length} collections`}
        title="Game Collections"
      >
        <p>
          Hand-picked sets of our free browser games, grouped by what you are in the mood for — games
          like the daily puzzles you already love, or a whole shelf of word, number, two-player and
          logic games. Every game is free, loads instantly, and needs no download or account.
        </p>
      </GardenHubHead>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COLLECTION_SLUGS.map((s) => {
          const c = COLLECTIONS[s]
          return (
            <li key={s}>
              <GardenLinkCard
                href={`/collection/${s}`}
                title={c.h1}
                description={c.metaDescription}
                meta={`${c.games.length} games →`}
                flower={flowerOf(s)}
                headingLevel={2}
              />
            </li>
          )
        })}
      </ul>
    </GardenHubPage>
  )
}
