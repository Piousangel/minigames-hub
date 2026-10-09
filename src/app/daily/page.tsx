import type { Metadata } from 'next'
import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { GameCard } from '@/components/GameCard'
import { DailyCountdown } from '@/components/DailyCountdown'
import { siteConfig } from '@/lib/siteConfig'

// 데일리 허브 — "daily puzzle games / daily word game" 같은 고의도·습관성 검색을 잡는 SEO
// 랜딩이자 데일리 스위트(streak·카운트다운)를 묶는 재방문 허브. 순수 SSG(gameMeta.daily 재사용).

const H1 = 'Free Daily Puzzle Games'
const TITLE = 'Daily Puzzle Games — A New Puzzle Every Day, Free Online'
const META_DESC =
  'Play a new puzzle every day — daily word, logic and number games, free in your browser. Build a streak, beat the daily challenge, and share your spoiler-free result. No download, no sign-up.'
const INTRO =
  'A fresh set of puzzles, every single day — free in your browser with no download and no sign-up. Everyone gets the same daily board, so you and your friends can compare how you did, and each solve builds a day streak you will not want to break. From daily word games and grouping puzzles to logic and number challenges, there is a new reason to come back every morning. Your streak, best scores and stats all save right in your browser, and a countdown ticks down to the next day’s puzzle. Miss a single day? A streak freeze, if you have earned one, keeps your streak alive. Solve today’s, share the spoiler-free grid, and come back tomorrow for the next one.'

const FAQ: { q: string; a: string }[] = [
  { q: 'What is a daily game?', a: 'A daily game gives everyone the same puzzle for that calendar day, generated from the date. You get one board per day per game — solve it, then come back tomorrow for a fresh one.' },
  { q: 'Do my streaks and stats save?', a: 'Yes, in your browser. Every daily solve extends your day streak, and your win rate, best score and longest streak are kept locally — no account needed.' },
  { q: 'What happens if I miss a day?', a: 'A streak freeze can bridge a single missed day so your streak survives. You earn one each time your streak reaches a multiple of five days, and you can hold up to two. Miss two days in a row and the streak starts over.' },
  { q: 'Can I share my result without spoiling it?', a: 'Yes. Daily games make a spoiler-free result card — a grid of colored squares that shows how you did without revealing the answer.' },
  { q: 'Is there a new puzzle every day?', a: 'Yes. Each daily game rolls over to a new board at midnight UTC, and a countdown on the home page shows the time until the next one.' },
]

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: META_DESC,
  alternates: { canonical: '/daily' },
  openGraph: {
    title: TITLE,
    description: META_DESC,
    url: '/daily',
    siteName: siteConfig.name,
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: META_DESC },
}

export default function DailyHub() {
  const games = gamePages.filter((g) => (gameMeta[g.slug] ?? DEFAULT_META).daily)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: H1,
        description: META_DESC,
        url: `${siteConfig.url}/daily`,
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
        mainEntity: FAQ.map((f) => ({
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
        <span className="text-fg">Daily</span>
      </nav>

      <h1 className="neon-text mb-4 text-3xl font-bold text-neon-amber sm:text-4xl">{H1}</h1>
      <p className="mb-4 max-w-3xl text-fg-muted">{INTRO}</p>
      <DailyCountdown />

      <section aria-label="Daily games" className="mb-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((g) => (
            <GameCard key={g.slug} slug={g.slug} title={g.h1} description={g.shortDescription} />
          ))}
        </div>
      </section>

      <section aria-labelledby="daily-faq" className="mb-12 max-w-3xl">
        <h2 id="daily-faq" className="neon-text mb-4 text-sm font-bold uppercase tracking-[0.15em] text-neon-amber">
          FAQ
        </h2>
        <div className="space-y-4">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold">{q}</h3>
              <p className="text-fg-muted">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <nav aria-label="Browse by category" className="flex flex-wrap gap-3 text-sm">
        {['puzzle', 'arcade', 'classic', 'skill'].map((c) => (
          <Link
            key={c}
            href={`/category/${c}`}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 capitalize text-fg-muted hover:text-fg"
          >
            {c} games
          </Link>
        ))}
      </nav>
    </main>
  )
}
