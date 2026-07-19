import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { DEFAULT_META, gameMeta, type GameCategory } from '@/lib/games/gameMeta'
import { GameCard } from '@/components/GameCard'
import { siteConfig } from '@/lib/siteConfig'

export const dynamicParams = false

interface Hub {
  category: GameCategory
  h1: string
  title: string
  metaDescription: string
  intro: string
  faq: { q: string; a: string }[]
}

// 장르/의도 허브 — 개별 게임 페이지만으로는 못 먹는 롱테일 검색("free puzzle games",
// "unblocked games")을 각각의 URL로 잡는다. 기존 gameMeta.category 재사용, 순수 SSG.
const HUBS: Record<string, Hub> = {
  puzzle: {
    category: 'Puzzle',
    h1: 'Free Puzzle Games',
    title: 'Free Puzzle Games — Play Online Unblocked, No Download',
    metaDescription:
      'Play free puzzle games online — Sudoku, 2048, minesweeper, nonogram, sliding puzzles and more. No download, no sign-up, unblocked in your browser.',
    intro:
      'Free online puzzle games you can play right now in your browser — no download, no sign-up, and unblocked anywhere. From classics like Sudoku, minesweeper, and 2048 to original brain-teasers you will not find anywhere else, every game runs instantly and works on phone or desktop. Many have a daily puzzle and a weekly leaderboard, so there is always a reason to come back.',
    faq: [
      { q: 'Are these puzzle games really free?', a: 'Yes. Every game plays free in your browser with no download and no account. Ad-supported, so the games stay free.' },
      { q: 'Can I play these unblocked at school or work?', a: 'They run in any modern browser with nothing to install, so they work wherever the browser does.' },
      { q: 'Do my scores and daily streaks save?', a: 'Yes, in your browser. Daily puzzles and best scores are stored locally, and many games have a weekly online leaderboard.' },
    ],
  },
  arcade: {
    category: 'Arcade',
    h1: 'Free Arcade Games',
    title: 'Free Arcade Games — Play Online Unblocked, No Download',
    metaDescription:
      'Play free arcade games online — snake, tetris, breakout, flappy, space shooter and more retro action. No download, no sign-up, unblocked in your browser.',
    intro:
      'Fast, free arcade games that load instantly in your browser — no download, no sign-up, unblocked anywhere. Chase a high score in snake, tetris, breakout, flappy and a whole shelf of original neon arcade games, all playable on phone or desktop. Beat your best, then push for the weekly leaderboard.',
    faq: [
      { q: 'Are these arcade games free?', a: 'Yes. Every game is free to play in the browser with no download and no account.' },
      { q: 'Do they work on mobile?', a: 'Yes. The arcade games support touch controls and work on phones and tablets as well as desktop.' },
      { q: 'Is there a high-score board?', a: 'Many arcade games have a weekly online leaderboard, and your personal best always saves in your browser.' },
    ],
  },
  classic: {
    category: 'Classic',
    h1: 'Free Classic Games',
    title: 'Free Classic Games — Play Online Unblocked, No Download',
    metaDescription:
      'Play free classic games online — tic-tac-toe, connect four, checkers, reversi, dots and boxes. Beat the computer in your browser. No download, no sign-up.',
    intro:
      'The timeless classics, free and instant in your browser — tic-tac-toe, connect four, checkers, reversi, dots and boxes and more, all against a computer opponent. No download, no sign-up, unblocked anywhere, and playable on any device. Perfect for a quick game whenever you have a minute.',
    faq: [
      { q: 'Are these board and classic games free?', a: 'Yes. Every classic game plays free in your browser with no download and no account.' },
      { q: 'Do I play against a computer?', a: 'Yes. These are single-player versions where you play against a built-in computer opponent at your chosen difficulty.' },
      { q: 'Can I play unblocked anywhere?', a: 'They run in any modern browser with nothing to install, so they work wherever the browser does.' },
    ],
  },
  skill: {
    category: 'Skill',
    h1: 'Free Skill Games',
    title: 'Free Skill Games — Reaction, Aim & Memory Games Online',
    metaDescription:
      'Play free skill games online — reaction time, aim trainer, memory, typing test and more. Train your brain and reflexes in your browser. No download, no sign-up.',
    intro:
      'Free skill games to sharpen your reflexes and memory, right in your browser — reaction time, aim trainer, memory games, typing tests and original timing challenges. No download, no sign-up, unblocked anywhere, and playable on phone or desktop. Track your best and see how far you can push it.',
    faq: [
      { q: 'Are these skill games free?', a: 'Yes. Every game is free to play in the browser with no download and no account.' },
      { q: 'What do skill games measure?', a: 'Reflexes, timing, memory and accuracy — things like reaction speed, aim, and how many numbers you can recall.' },
      { q: 'Do my results save?', a: 'Yes. Your best results save in your browser, and many games have a weekly online leaderboard.' },
    ],
  },
}

export function generateStaticParams() {
  return Object.keys(HUBS).map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const hub = HUBS[slug]
  if (!hub) return {}
  return {
    title: { absolute: hub.title },
    description: hub.metaDescription,
    alternates: { canonical: `/category/${slug}` },
    openGraph: {
      title: hub.title,
      description: hub.metaDescription,
      url: `/category/${slug}`,
      siteName: siteConfig.name,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: hub.title, description: hub.metaDescription },
  }
}

export default async function CategoryHub({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const hub = HUBS[slug]
  if (!hub) notFound()

  const games = gamePages.filter((g) => (gameMeta[g.slug] ?? DEFAULT_META).category === hub.category)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: hub.h1,
        description: hub.metaDescription,
        url: `${siteConfig.url}/category/${slug}`,
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
        mainEntity: hub.faq.map((f) => ({
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
        <span className="text-fg">{hub.category}</span>
      </nav>

      <h1 className="neon-text mb-4 text-3xl font-bold text-neon-cyan sm:text-4xl">{hub.h1}</h1>
      <p className="mb-8 max-w-3xl text-fg-muted">{hub.intro}</p>

      <section aria-label={`${hub.category} games`} className="mb-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((g) => (
            <GameCard key={g.slug} slug={g.slug} title={g.h1} description={g.shortDescription} />
          ))}
        </div>
      </section>

      <section aria-labelledby="hub-faq" className="mb-12 max-w-3xl">
        <h2 id="hub-faq" className="neon-text mb-4 text-sm font-bold uppercase tracking-[0.15em] text-neon-cyan">
          FAQ
        </h2>
        <div className="space-y-4">
          {hub.faq.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold">{q}</h3>
              <p className="text-fg-muted">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <nav aria-label="Other categories" className="flex flex-wrap gap-3 text-sm">
        {Object.entries(HUBS)
          .filter(([s]) => s !== slug)
          .map(([s, h]) => (
            <Link
              key={s}
              href={`/category/${s}`}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-fg-muted hover:text-fg"
            >
              {h.category} games
            </Link>
          ))}
      </nav>
    </main>
  )
}
