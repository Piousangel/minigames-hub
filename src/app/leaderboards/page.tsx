import type { Metadata } from 'next'
import { siteConfig } from '@/lib/siteConfig'
import { LeaderboardsHub } from '@/components/LeaderboardsHub'

export const metadata: Metadata = {
  title: 'Leaderboards — Weekly Top Scores',
  description:
    'This week’s top scores across all Quick MiniGames games. Beat the leaders and get your name on the board.',
  alternates: { canonical: '/leaderboards' },
  openGraph: { url: '/leaderboards' },
}

export default function LeaderboardsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p
        aria-hidden="true"
        className="font-pixel neon-text mb-4 text-center text-[10px] tracking-[0.3em] text-neon-magenta sm:text-xs"
      >
        ★ HIGH SCORES ★
      </p>
      <h1
        className="neon-text mb-3 text-center text-3xl font-bold"
        style={{ color: 'var(--neon-cyan)' }}
      >
        Leaderboards
      </h1>
      <p className="mx-auto mb-8 max-w-xl text-center text-sm text-fg-muted">
        This week’s top players across {siteConfig.name}. Set a high score in any game, then submit
        it from that game’s page to climb the board.
      </p>
      <LeaderboardsHub />
    </main>
  )
}
