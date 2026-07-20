import type { Metadata } from 'next'
import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { GameCard } from '@/components/GameCard'
import { siteConfig } from '@/lib/siteConfig'

// "unblocked games" 랜딩 — 브라우저 게임 최대 검색 의도 중 하나(학교/직장 무설치, DOMAIN §1).
// 우리 전 게임이 무설치 브라우저 실행 = 정직하게 unblocked. 순수 SSG.

const H1 = 'Unblocked Games'
const TITLE = 'Unblocked Games — Free to Play Online, No Download at School or Work'
const META_DESC =
  'Play unblocked games free online — no download, no install, no sign-up. Classics like 2048, Snake, Solitaire, Chess and Tetris run right in your browser, so they work at school or work.'

// 큐레이션: 누구나 아는 클래식 + 우리 대표작(전부 registry에 존재 확인됨).
const FEATURED = [
  '2048', 'snake', 'tetris', 'minesweeper', 'solitaire', 'chess',
  'mahjong', 'sudoku', 'pong', 'breakout', 'flappy', 'space-shooter',
  'bubble-shooter', 'tower-stack', 'word-guess', 'checkers', 'freecell', 'typing-test',
]

const FAQ: { q: string; a: string }[] = [
  { q: 'What does "unblocked" mean?', a: 'Every game here runs entirely in your web browser — there is nothing to download or install and no app store needed. Because they are just web pages, they load wherever your browser works.' },
  { q: 'Can I play these at school or work?', a: 'They open in any normal browser with nothing to install, so they work anywhere the browser does. Please still follow your school or workplace rules about when to play.' },
  { q: 'Are they really free?', a: 'Yes. Every game is free to play with no account and no sign-up. The site is ad-supported so the games stay free.' },
  { q: 'Do I need to download or install anything?', a: 'No. Just click a game and it starts instantly in the browser — on a phone, tablet, Chromebook or desktop.' },
  { q: 'Do my scores save?', a: 'Yes, in your browser. Best scores and daily streaks are stored locally on your device, and many games have a weekly online leaderboard.' },
]

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: META_DESC,
  alternates: { canonical: '/unblocked' },
  openGraph: { title: TITLE, description: META_DESC, url: '/unblocked', siteName: siteConfig.name, type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: META_DESC },
}

export default function UnblockedPage() {
  const bySlug = new Map(gamePages.map((g) => [g.slug, g]))
  const games = FEATURED.map((s) => bySlug.get(s)).filter((g): g is NonNullable<typeof g> => Boolean(g))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: H1, description: META_DESC, url: `${siteConfig.url}/unblocked` },
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
        <span className="text-fg">Unblocked</span>
      </nav>

      <h1 className="neon-text mb-4 text-3xl font-bold text-neon-lime sm:text-4xl">{H1}</h1>
      <p className="mb-4 max-w-3xl text-fg-muted">
        Free unblocked games that load instantly in your browser — no download, no install, no
        sign-up. Everything here is just a web page, so there is no app to block: pick a game and it
        starts right away on a phone, Chromebook, tablet or desktop. From the classics everyone knows —
        2048, Snake, Tetris, Minesweeper, Solitaire and Chess — to daily puzzles and original neon
        arcade games, there is always something quick to play. Your best scores and daily streaks
        save right in your browser, and many games have a weekly leaderboard, so there is a reason to
        come back. Browse the favourites below, or dig into the full library by category.
      </p>

      <section aria-label="Popular unblocked games" className="mb-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((g) => (
            <GameCard key={g.slug} slug={g.slug} title={g.h1} description={g.shortDescription} />
          ))}
        </div>
      </section>

      <nav aria-label="Browse more" className="mb-12 flex flex-wrap gap-3 text-sm">
        <Link href="/daily" className="rounded-lg border border-border bg-surface px-3 py-1.5 text-fg-muted hover:text-fg">Daily games</Link>
        <Link href="/collections" className="rounded-lg border border-border bg-surface px-3 py-1.5 text-fg-muted hover:text-fg">Collections</Link>
        {['puzzle', 'arcade', 'classic', 'skill'].map((c) => (
          <Link key={c} href={`/category/${c}`} className="rounded-lg border border-border bg-surface px-3 py-1.5 capitalize text-fg-muted hover:text-fg">
            {c} games
          </Link>
        ))}
      </nav>

      <section aria-labelledby="unblocked-faq" className="mb-12 max-w-3xl">
        <h2 id="unblocked-faq" className="neon-text mb-4 text-sm font-bold uppercase tracking-[0.15em] text-neon-lime">
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
    </main>
  )
}
