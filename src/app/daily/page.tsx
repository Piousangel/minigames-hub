import { ogImage } from '@/lib/og/ogImage'
import type { Metadata } from 'next'
import { gamePages } from '@/lib/games/registry'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { GardenChipNav, GardenFaq, GardenGameGrid, GardenHubHead, GardenHubPage, HAESSI_SKY } from '@/components/garden-hub/GardenHub'
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
  { q: 'Do my streaks and stats save?', a: 'Yes, in your browser. Every daily solve extends your day streak, and your best score, longest streak and (for games with a win condition) your win rate are kept locally — no account needed.' },
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
    images: ogImage(),
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
    <GardenHubPage page="daily">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 오늘의 정원 = 해씨(D5). 카운트다운은 '밤 정원 판'(내일 판이 오기 전 밤) */}
      <GardenHubHead
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Daily' }]}
        kicker={`Today’s garden · ${games.length} daily games`}
        title={H1}
        art={{ mascot: 'haessi-cheer', wash: HAESSI_SKY }}
      >
        <p>{INTRO}</p>
      </GardenHubHead>
      <DailyCountdown />

      <GardenGameGrid games={games} label="Daily games" />

      <GardenFaq id="daily-faq" items={FAQ} />

      <GardenChipNav
        label="Browse by category"
        title="Browse by category"
        links={['puzzle', 'arcade', 'classic', 'skill'].map((c) => ({ href: `/category/${c}`, label: `${c[0].toUpperCase()}${c.slice(1)} games` }))}
      />
    </GardenHubPage>
  )
}
