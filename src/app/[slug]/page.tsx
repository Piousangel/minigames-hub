import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GamePageLayout } from '@/components/GamePageLayout'
import { GameRenderer } from '@/components/GameRenderer'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'

export const dynamicParams = false

export function generateStaticParams() {
  return gamePages.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = gamePages.find((g) => g.slug === slug)
  if (!page) return {}
  return {
    title: { absolute: page.title },
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      url: `/${page.slug}`,
      siteName: siteConfig.name,
      type: 'website',
    },
  }
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = gamePages.find((g) => g.slug === slug)
  if (!page) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: page.h1,
    url: `${siteConfig.url}/${page.slug}`,
    description: page.metaDescription,
    playMode: 'SinglePlayer',
    applicationCategory: 'Game',
    gamePlatform: 'Web browser',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />
      <GamePageLayout page={page}>
        <GameRenderer page={page} />
      </GamePageLayout>
    </>
  )
}
