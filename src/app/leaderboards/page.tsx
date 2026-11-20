import { ogImage } from '@/lib/og/ogImage'
import type { Metadata } from 'next'
import { siteConfig, thinPageRobots } from '@/lib/siteConfig'
import { LeaderboardsHub } from '@/components/LeaderboardsHub'
import { Mascot } from '@/components/Mascot'

export const metadata: Metadata = {
  title: 'Leaderboards — Weekly Top Scores',
  description:
    'This week’s top scores across all Quick MiniGames games. Beat the leaders and get your name on the board.',
  alternates: { canonical: '/leaderboards' },
  robots: thinPageRobots,
  openGraph: { url: '/leaderboards', type: 'website', siteName: siteConfig.name, images: ogImage() },
}

const h2 = 'font-display text-[22px] leading-[28px] font-semibold tracking-[-0.015em] text-garden-ink'
const h3 = 'text-[16px] font-semibold text-garden-ink'

/**
 * /leaderboards — 리디자인 v2 정원 틀(R6 이월: 머리 보미, 부록 A '리더보드는 상을 받는 느낌이 없음').
 * 크림 paper 위 머리(보미 deliver 96px — 소식 담당 D5, 한 페이지 1마리 D6) → 주 라벨 → 게임별 '연감' 카드 → 설명·FAQ.
 * 광고 없음(리더보드 상단은 저가치 화면 광고 금지, 개념서 광고 표). 바깥 크롬(줄무늬·신스웨이브 배경)은
 * globals.css `main[data-world='garden-hub']` 규칙이 끈다.
 */
export default function LeaderboardsPage() {
  return (
    <main data-world="garden-hub" className="font-ui bg-garden-paper text-garden-ink">
      <div className="mx-auto max-w-5xl px-4 pt-8 pb-14 sm:pt-12">
        <header className="mb-6 text-center">
          {/* 첫 화면 안이라 eager. 192px 사본(9KB) → 96px 표시 */}
          <Mascot art="bomi-deliver" size={96} loading="eager" className="mx-auto" />
          <p className="mt-3 text-[12px] leading-4 font-semibold text-garden-coral-text">Weekly high scores</p>
          <h1 className="font-display mt-1 text-[36px] leading-[42px] font-semibold tracking-[-0.02em] sm:text-[44px] sm:leading-[50px]">
            Leaderboards
          </h1>
          <p className="font-display-italic mt-2 text-[17px] leading-6 italic" data-testid="lb-bomi-line">
            “Fresh from the Star Well: this week’s brightest stars.”
            <span className="font-ui ml-1.5 text-[13px] not-italic text-garden-ink-soft">— Bomi</span>
          </p>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-6 text-garden-ink-deep">
            This week’s top players across {siteConfig.name}. Set a high score in any game, then submit it from that
            game’s page to climb the board.
          </p>
        </header>
        <LeaderboardsHub />

        <section aria-labelledby="lb-about" className="mx-auto mt-16 max-w-3xl space-y-4 text-[16px] leading-[26px] text-garden-ink-deep">
          <h2 id="lb-about" className={h2}>
            How the leaderboards work
          </h2>
          <p>
            A high score is a lot more fun when there is someone to beat. Every score-based game on {siteConfig.name}{' '}
            keeps a live online leaderboard that resets at the start of each week, so there is always a fresh board to
            climb and last week’s runaway leader has to earn their spot all over again. This page gathers the current top
            players from every one of those games into one place — a quick way to see where the competition is fierce and
            where a modest run might be enough to land you in the top ten.
          </p>
          <p>
            Getting on a board is simple and takes no account. Play a game, beat your own personal best, and a prompt
            appears asking for a short name to post your score under — that name is stored on your device, and only the
            score itself travels to the board. Not every game has a leaderboard: they are for games with a clear “higher
            is better” score, like the arcade and puzzle high-score chases, rather than the versus-the-computer board
            games or the puzzles you simply finish. If a game shows a leaderboard on its page, your best is welcome on it.
          </p>

          <h2 className={`${h2} mt-10`}>Frequently asked questions</h2>
          <div className="space-y-5">
            <div>
              <h3 className={h3}>When do the leaderboards reset?</h3>
              <p>
                Each board covers a single week and clears at the start of the next, so a top score is a weekly title
                rather than a permanent one — good news if you missed this week, and a reason to defend your place if
                you are on top.
              </p>
            </div>
            <div>
              <h3 className={h3}>Do I need an account to submit a score?</h3>
              <p>
                No. There is no sign-up and no password. When you beat your personal best in a game with a leaderboard,
                you are asked for a display name once, and your score posts under it.
              </p>
            </div>
            <div>
              <h3 className={h3}>Why doesn’t every game have a leaderboard?</h3>
              <p>
                Leaderboards only make sense where a single number clearly means “better.” Games you play against the
                computer, or puzzles you either finish or don’t, are ranked by your own record and personal bests
                instead of a shared score table.
              </p>
            </div>
            <div>
              <h3 className={h3}>How do I climb the board?</h3>
              <p>
                Open any game with a leaderboard, play until you top your previous best, and submit the new score from
                that game’s page. The board on this page updates to reflect the latest standings across every game.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
