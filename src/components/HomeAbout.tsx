import Link from 'next/link'
import { siteConfig } from '@/lib/siteConfig'

/**
 * 홈 하단의 실질 편집 콘텐츠 — 사이트의 목적·차별점·구성을 원본 산문으로 설명한다.
 * AdSense 심사자가 착지하는 홈에 "가치 있는 고유 콘텐츠"를 제공(정책: low-value content 방지).
 * 정적 서버 렌더라 SSR HTML에 그대로 들어가고, 카테고리로의 내부링크도 겸한다.
 */
export function HomeAbout() {
  return (
    <section aria-labelledby="about-site" className="mt-16 border-t border-border pt-10">
      <div className="mx-auto max-w-2xl space-y-4 leading-relaxed text-fg-muted">
        <h2 id="about-site" className="text-xl font-semibold text-fg">
          About {siteConfig.name}
        </h2>
        <p>
          {siteConfig.name} is a free online arcade you can play the moment the page loads. There is
          nothing to download, no account to create, and no paywall — every game runs right in your
          browser on a phone, tablet or computer, and your scores, streaks and goals are saved on your
          own device so you can pick up where you left off.
        </p>
        <p>
          Most game portals simply embed the same titles from around the web. This site is different:
          every game here is designed and built by hand specifically for {siteConfig.name}. That means
          they load in about a second, carry no third-party pop-ups, are tuned to feel right with both
          touch and keyboard, and include a handful of originals you will not find anywhere else.
        </p>

        <h3 className="mt-8 text-lg font-semibold text-fg">What you&apos;ll find</h3>
        <p>
          The library spans four kinds of game.{' '}
          <Link href="/category/puzzle" className="text-accent hover:underline">
            Puzzle games
          </Link>{' '}
          like 2048, Minesweeper, Sudoku, nonograms, Flow and Unblock reward careful thinking.{' '}
          <Link href="/category/arcade" className="text-accent hover:underline">
            Arcade games
          </Link>{' '}
          such as Snake, Tetris and Breakout are about quick reflexes and chasing a high score.{' '}
          <Link href="/category/classic" className="text-accent hover:underline">
            Classic games
          </Link>{' '}
          bring the tabletop home — the full Solitaire family, Chess, Checkers, Mancala and Yahtzee,
          played against the computer or a friend. And{' '}
          <Link href="/category/skill" className="text-accent hover:underline">
            skill games
          </Link>{' '}
          like reaction and aim trainers, memory and typing tests measure how sharp you are.
        </p>

        <h3 className="mt-8 text-lg font-semibold text-fg">A reason to come back</h3>
        <p>
          A rotating set of{' '}
          <Link href="/daily" className="text-accent hover:underline">
            daily puzzles
          </Link>{' '}
          gives everyone the same board each day, so there is a fresh challenge every morning and a
          streak to protect. Many games keep a{' '}
          <Link href="/leaderboards" className="text-accent hover:underline">
            weekly online leaderboard
          </Link>{' '}
          where you can post a high score, and the site quietly tracks your personal bests and goals as
          you play. New games are added regularly, everything stays free, and the whole thing is built
          to respect your time and your privacy. Browse the full library above, or jump straight into a
          featured game to get started.
        </p>
      </div>
    </section>
  )
}
