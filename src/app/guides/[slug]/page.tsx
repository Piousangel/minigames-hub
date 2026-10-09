import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { allContent, contentBySlug, readingMinutes } from '@/content'
import { ContentBody } from '@/components/ContentBody'
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
    openGraph: { title, description, url: `/guides/${slug}`, siteName: siteConfig.name, type: 'article' },
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
    author: { '@type': 'Person', name: 'Pious Angel' },
    publisher: { '@type': 'Organization', name: siteConfig.name },
    mainEntityOfPage: `${siteConfig.url}/guides/${slug}`,
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-4 text-sm text-fg-muted" aria-label="Breadcrumb">
        <Link href="/guides" className="hover:text-fg">
          Guides
        </Link>{' '}
        / <span>{label}</span>
      </nav>
      <h1 className="mb-3 text-3xl font-bold">{entry.title}</h1>
      <p className="mb-2 text-fg-muted">{entry.description}</p>
      <p className="mb-6 text-xs text-fg-muted">
        By Pious Angel · {c.type === 'guide' ? 'Updated' : 'Published'} {date} · {readingMinutes(entry.sections)} min read
      </p>
      {games.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {games.map((g) => (
            <Link
              key={g.slug}
              href={`/${g.slug}`}
              className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent/20"
            >
              ▶ Play {g.h1}
            </Link>
          ))}
        </div>
      )}
      <ContentBody sections={entry.sections} tables={entry.tables} />
      <p className="mt-12 border-t border-border pt-6 text-sm text-fg-muted">
        Every number on this page comes from the game&apos;s own code or from simulations run against it. Spotted
        something that doesn&apos;t match how the game plays?{' '}
        <Link href="/contact" className="text-accent">
          Let us know
        </Link>
        .
      </p>
    </main>
  )
}
