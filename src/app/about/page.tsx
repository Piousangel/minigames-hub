import type { Metadata } from 'next'
import Link from 'next/link'
import { ProsePage } from '@/components/ProsePage'
import { siteConfig } from '@/lib/siteConfig'
import { gamePages } from '@/lib/games/registry'
import { gameMeta } from '@/lib/games/gameMeta'
import { LEADERBOARD_GAMES } from '@/lib/leaderboard'

export const metadata: Metadata = {
  title: 'About',
  alternates: { canonical: '/about' },
  openGraph: { url: '/about' },
}

// 수치는 하드코딩하지 않고 레지스트리에서 계산 — 게임이 늘어도 About이 거짓말을 하지 않게.
const GAME_COUNT = gamePages.length
const DAILY_COUNT = gamePages.filter((g) => gameMeta[g.slug]?.daily).length
const LEADERBOARD_COUNT = Object.keys(LEADERBOARD_GAMES).length

export default function AboutPage() {
  return (
    <ProsePage title={`About ${siteConfig.name}`}>
      <p>
        {siteConfig.name} is a collection of {GAME_COUNT} free browser games, designed, coded and
        maintained by one indie developer who goes by <strong>Pious Angel</strong>. There is no studio
        behind it and no catalogue licensed from somewhere else: every game on the site was written
        for it, and dozens of them are original designs you will not find on other game portals —
        games like Prospector, Ricochet, Decant, Bisect and Strata, each built around a single
        mechanic that takes seconds to learn and much longer to master. Alongside them sit careful
        versions of the classics people come back to for years, from 2048 and Minesweeper to
        Solitaire, Sudoku and Chess.
      </p>

      <h2>Why this site exists</h2>
      <p>
        Most free game sites are hard to enjoy. Pages are slow, the game is buried under pop-ups, and
        you are asked to install an app or create an account before you can play for two minutes.
        I wanted the opposite: open a page, play straight away, and close it again without having
        handed over anything. That goal shapes almost every decision here — no accounts, no
        downloads, and a short written guide on
        every game page explaining the rules, a few strategy ideas and the questions players
        actually ask.
      </p>

      <h2>What you can do here</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Play without signing up.</strong> Best scores, streaks, settings and in-progress
          boards are saved in your own browser (localStorage), so they stay on your device.
        </li>
        <li>
          <strong>Daily puzzles.</strong> {DAILY_COUNT} games have a daily mode where everyone gets
          the same board for the day, with a streak for coming back. They are gathered on the{' '}
          <Link href="/daily" className="text-accent">daily puzzles page</Link>.
        </li>
        <li>
          <strong>Weekly leaderboards.</strong> {LEADERBOARD_COUNT} games let you submit a score,
          under any nickname you choose, to a leaderboard that resets every week.
        </li>
        <li>
          <strong>Comments and reactions.</strong> Each game page has short anonymous comments and
          emoji reactions, so you can leave a tip or a complaint without making an account.
        </li>
      </ul>

      <h2>How the games are built</h2>
      <p>
        Every game is split into two parts: a pure rules engine that holds the board, the scoring
        and the win and loss conditions, and a separate interface that draws it and handles your
        taps and keys. Keeping the rules apart from the screen means they can be checked directly:
        the project has thousands of automated tests that play moves against those engines and
        confirm the scores, streaks and edge cases come out right, plus browser smoke tests that
        load the games and check the board appears. Daily puzzles generate their board from the
        date, which is why everyone sees the same one on the same day.      </p>

      <h2>Your privacy</h2>
      <p>
        The site collects as little as it can. Game progress lives in your browser. To understand
        which games people play, each visit sends an anonymous page-view event with a random
        visitor ID generated in your browser — no name, email or account is attached. Leaderboard
        names and comments are public by design, so please do not use your real name in them. The
        site may show ads from Google AdSense, which can use cookies. The full details are in the{' '}
        <Link href="/privacy" className="text-accent">privacy policy</Link>, and the rules for using
        the site are in the <Link href="/terms" className="text-accent">terms of use</Link>.
      </p>

      <h2>Get in touch</h2>
      <p>
        New games are added and existing ones are tuned as players report what is confusing or
        broken. If you have found a bug, have an idea for a game, or spotted a rule that does not
        match how a game plays, I would love to hear about it — the{' '}
        <Link href="/contact" className="text-accent">contact page</Link> has my email address, and
        every message is read by me.
      </p>
    </ProsePage>
  )
}
