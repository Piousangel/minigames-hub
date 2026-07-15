import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import type { GamePage } from '@/lib/games/registry'

export function GamePageLayout({ page, children }: { page: GamePage; children: React.ReactNode }) {
  const accent = (gameMeta[page.slug] ?? DEFAULT_META).accent
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1
        className="neon-text mb-4 text-center text-3xl font-bold"
        style={{ color: `var(--neon-${accent})` }}
      >
        {page.h1}
      </h1>
      {children}
      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">How to play</h2>
        <ul className="list-disc space-y-2 pl-5 text-fg-muted">
          {page.howToPlay.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">Strategy &amp; tips</h2>
        <ul className="list-disc space-y-2 pl-5 text-fg-muted">
          {page.strategy.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">FAQ</h2>
        <div className="space-y-4">
          {page.faq.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold">{q}</h3>
              <p className="text-fg-muted">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
