import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Free Online Mini Games</h1>
      <p className="mb-8 text-fg-muted">{siteConfig.description}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {gamePages.map((g) => (
          <Link
            key={g.slug}
            href={`/${g.slug}`}
            className="rounded-xl bg-surface p-4 transition hover:bg-white/10"
          >
            <h2 className="font-semibold">{g.h1}</h2>
            <p className="mt-1 text-sm text-fg-muted">{g.shortDescription}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
