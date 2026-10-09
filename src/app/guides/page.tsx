import type { Metadata } from 'next'
import Link from 'next/link'
import { ARTICLES, GUIDES, readingMinutes } from '@/content'
import { siteConfig } from '@/lib/siteConfig'

const TITLE = 'Game Guides, Designer Notes & Data'
const DESCRIPTION =
  'In-depth strategy guides, designer notes on our original games, and data from simulating our own game engines.'

export const metadata: Metadata = {
  title: { absolute: `${TITLE} — ${siteConfig.name}` },
  description: DESCRIPTION,
  alternates: { canonical: '/guides' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/guides', siteName: siteConfig.name, type: 'website' },
}

function Card({ href, title, description, meta }: { href: string; title: string; description: string; meta: string }) {
  return (
    <li>
      <Link href={href} className="block rounded-xl border border-border bg-surface/60 p-4 transition-colors hover:border-accent/60">
        <h3 className="font-semibold text-fg">{title}</h3>
        <p className="mt-1 text-sm text-fg-muted">{description}</p>
        <p className="mt-2 text-xs text-fg-muted">{meta}</p>
      </Link>
    </li>
  )
}

export default function GuidesHub() {
  const design = ARTICLES.filter((a) => a.kind === 'design-notes')
  const data = ARTICLES.filter((a) => a.kind === 'data')
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-3 text-3xl font-bold">{TITLE}</h1>
      <p className="mb-8 leading-relaxed text-fg-muted">
        Every game on {siteConfig.name} runs on a rules engine we wrote ourselves, which means we can read the exact
        scoring formulas and run thousands of simulated games to see what actually works. These pages are where that
        goes: strategy guides grounded in the real rules, notes on how our original games were designed and changed,
        and numbers you won&apos;t find anywhere else.
      </p>

      {GUIDES.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Strategy guides</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {GUIDES.map((g) => (
              <Card key={g.slug} href={`/guides/${g.slug}`} title={g.title} description={g.description} meta={`${readingMinutes(g)} min read`} />
            ))}
          </ul>
        </section>
      )}

      {data.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Data deep-dives</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.map((a) => (
              <Card key={a.slug} href={`/guides/${a.slug}`} title={a.title} description={a.description} meta={`${a.published} · ${readingMinutes(a)} min read`} />
            ))}
          </ul>
        </section>
      )}

      {design.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Designer&apos;s notes</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {design.map((a) => (
              <Card key={a.slug} href={`/guides/${a.slug}`} title={a.title} description={a.description} meta={`${a.published} · ${readingMinutes(a)} min read`} />
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
