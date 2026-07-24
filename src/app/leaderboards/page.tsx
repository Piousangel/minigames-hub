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

      <section aria-labelledby="lb-about" className="mx-auto mt-14 max-w-3xl space-y-4 leading-relaxed text-fg-muted">
        <h2 id="lb-about" className="text-xl font-semibold text-fg">
          How the leaderboards work
        </h2>
        <p>
          A high score is a lot more fun when there is someone to beat. Every score-based game on{' '}
          {siteConfig.name} keeps a live online leaderboard that resets at the start of each week, so
          there is always a fresh board to climb and last week’s runaway leader has to earn their spot
          all over again. This page gathers the current top players from every one of those games into
          one place — a quick way to see where the competition is fierce and where a modest run might
          be enough to land you in the top ten.
        </p>
        <p>
          Getting on a board is simple and takes no account. Play a game, beat your own personal best,
          and a prompt appears asking for a short name to post your score under — that name is stored
          on your device, and only the score itself travels to the board. Not every game has a
          leaderboard: they are for games with a clear “higher is better” score, like the arcade and
          puzzle high-score chases, rather than the versus-the-computer board games or the puzzles you
          simply finish. If a game shows a leaderboard on its page, your best is welcome on it.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-fg">Frequently asked questions</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-fg">When do the leaderboards reset?</h3>
            <p>
              Each board covers a single week and clears at the start of the next, so a top score is a
              weekly title rather than a permanent one — good news if you missed this week, and a
              reason to defend your place if you are on top.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-fg">Do I need an account to submit a score?</h3>
            <p>
              No. There is no sign-up and no password. When you beat your personal best in a game with
              a leaderboard, you are asked for a display name once, and your score posts under it.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-fg">Why doesn’t every game have a leaderboard?</h3>
            <p>
              Leaderboards only make sense where a single number clearly means “better.” Games you play
              against the computer, or puzzles you either finish or don’t, are ranked by your own record
              and personal bests instead of a shared score table.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-fg">How do I climb the board?</h3>
            <p>
              Open any game with a leaderboard, play until you top your previous best, and submit the
              new score from that game’s page. The board on this page updates to reflect the latest
              standings across every game.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
