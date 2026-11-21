import { ogImage } from '@/lib/og/ogImage'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { gamePages } from '@/lib/games/registry'
import { DEFAULT_META, gameMeta, type GameCategory } from '@/lib/games/gameMeta'
import { GardenChipNav, GardenFaq, GardenGameGrid, GardenHubHead, GardenHubPage, HAESSI_SKY, categoryWash } from '@/components/garden-hub/GardenHub'
import type { MascotArt } from '@/components/Mascot'
import { siteConfig, thinPageRobots } from '@/lib/siteConfig'

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
      'Play free arcade games online — snake, falling blocks, breakout, flappy, space shooter and more retro action. No download, no sign-up, unblocked in your browser.',
    intro:
      'Fast, free arcade games that load instantly in your browser — no download, no sign-up, unblocked anywhere. Chase a high score in snake, falling blocks, breakout, flappy and a whole shelf of original neon arcade games, all playable on phone or desktop. Beat your best, then push for the weekly leaderboard.',
    faq: [
      { q: 'Are these arcade games free?', a: 'Yes. Every game is free to play in the browser with no download and no account.' },
      { q: 'Do they work on mobile?', a: 'Yes. The arcade games support touch controls and work on phones and tablets as well as desktop.' },
      { q: 'Is there a high-score board?', a: 'Many arcade games have a weekly online leaderboard, and your personal best always saves in your browser.' },
    ],
  },
  classic: {
    category: 'Classic',
    h1: 'Free Classic Games',
    title: 'Free Classic Games — Cards, Board Games & More Online',
    metaDescription:
      'Play free classic games online — solitaire, tic-tac-toe, connect four, checkers, reversi and dots and boxes. Cards and board classics in your browser. No download, no sign-up.',
    intro:
      'The timeless classics, free and instant in your browser — from the card game everyone knows, Klondike solitaire, to the board games you grew up with: tic-tac-toe, connect four, checkers, reversi and dots and boxes. Play a hand of solitaire on your own or take on a computer opponent at the board classics, all with no download, no sign-up, unblocked anywhere and playable on any device. These are the games that never get old — perfect for a quick round whenever you have a minute.',
    faq: [
      { q: 'Are these classic and card games free?', a: 'Yes. Every classic game, solitaire included, plays free in your browser with no download and no account.' },
      { q: 'Do I play against a computer?', a: 'For the board games, yes — you play against a built-in computer opponent at your chosen difficulty. Solitaire is a single-player card game you play on your own.' },
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

// 선반 주인(D5 마스코트 ↔ 카테고리 1:1): 말랑이 Puzzle · 토리 Arcade · 해씨 Classic · 보미 Skill. 기존 원본의 192px 사본.
// 토리는 발사기를 겨누지 않는 포즈(world-bible 3-2 '사이트 전면 금지'), 해씨 disc만 하늘색(홈 선반과 같음).
const HOSTS: Record<GameCategory, { art: MascotArt; wash: string }> = {
  Puzzle: { art: 'mallang-wave', wash: categoryWash('Puzzle') },
  Arcade: { art: 'tori-cheer', wash: categoryWash('Arcade') },
  Classic: { art: 'haessi-guide', wash: HAESSI_SKY },
  Skill: { art: 'bomi-cheer', wash: categoryWash('Skill') },
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
    robots: thinPageRobots,
    openGraph: {
      title: hub.title,
      description: hub.metaDescription,
      url: `/category/${slug}`,
      siteName: siteConfig.name,
      type: 'website',
      images: ogImage(),
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

  const host = HOSTS[hub.category]
  return (
    <GardenHubPage page={`category-${slug}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <GardenHubHead
        crumbs={[{ href: '/', label: 'Home' }, { label: hub.category }]}
        kicker={`${games.length} games`}
        title={hub.h1}
        art={{ mascot: host.art, wash: host.wash }}
      >
        <p>{hub.intro}</p>
      </GardenHubHead>

      <GardenGameGrid games={games} label={`${hub.category} games`} />

      <GardenFaq id="hub-faq" items={hub.faq} />

      <GardenChipNav
        label="Other categories"
        title="Other shelves"
        links={Object.entries(HUBS)
          .filter(([s]) => s !== slug)
          .map(([s, h]) => ({ href: `/category/${s}`, label: `${h.category} games` }))}
      />
    </GardenHubPage>
  )
}
