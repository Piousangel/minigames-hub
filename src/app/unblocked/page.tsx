import { ogImage } from '@/lib/og/ogImage'
import type { Metadata } from 'next'
import { gamePages } from '@/lib/games/registry'
import { GardenChipNav, GardenFaq, GardenGameGrid, GardenHubHead, GardenHubPage } from '@/components/garden-hub/GardenHub'
import { siteConfig, thinPageRobots } from '@/lib/siteConfig'

// "unblocked games" 랜딩 — 브라우저 게임 최대 검색 의도 중 하나(학교/직장 무설치, DOMAIN §1).
// 우리 전 게임이 무설치 브라우저 실행 = 정직하게 unblocked. 순수 SSG.

const H1 = 'Unblocked Games'
const TITLE = 'Unblocked Games — Free to Play Online, No Download at School or Work'
const META_DESC =
  'Play unblocked games free online — no download, no install, no sign-up. Classics like 2048, Snake, Solitaire, Chess and Falling Blocks run right in your browser, so they work at school or work.'

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
  robots: thinPageRobots,
  openGraph: { title: TITLE, description: META_DESC, url: '/unblocked', siteName: siteConfig.name, type: 'website', images: ogImage() },
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
    <GardenHubPage page="unblocked">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <GardenHubHead
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Unblocked' }]}
        kicker={`${games.length} favourites`}
        title={H1}
      >
        <p>
          Free unblocked games that load instantly in your browser — no download, no install, no
          sign-up. Everything here is just a web page, so there is no app to block: pick a game and it
          starts right away on a phone, Chromebook, tablet or desktop. From the classics everyone knows —
          2048, Snake, Falling Blocks, Minesweeper, Solitaire and Chess — to daily puzzles and original neon
          arcade games, there is always something quick to play. Your best scores and daily streaks
          save right in your browser, and many games have a weekly leaderboard, so there is a reason to
          come back. Browse the favourites below, or dig into the full library by category.
        </p>
      </GardenHubHead>

      <GardenGameGrid games={games} label="Popular unblocked games" />

      <GardenChipNav
        label="Browse more"
        title="Browse more"
        links={[
          { href: '/daily', label: 'Daily games' },
          { href: '/collections', label: 'Collections' },
          ...['puzzle', 'arcade', 'classic', 'skill'].map((c) => ({ href: `/category/${c}`, label: `${c[0].toUpperCase()}${c.slice(1)} games` })),
        ]}
      />

      <GardenFaq id="unblocked-faq" items={FAQ} />
    </GardenHubPage>
  )
}
