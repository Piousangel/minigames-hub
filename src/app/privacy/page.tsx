import type { Metadata } from 'next'
import Link from 'next/link'
import { ProsePage } from '@/components/ProsePage'
import { siteConfig } from '@/lib/siteConfig'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  alternates: { canonical: '/privacy' },
  openGraph: { url: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy Policy">
      <p>Last updated: October 9, 2026</p>
      <p>
        This page describes, in plain language, what {siteConfig.name} stores and sends when you use
        it. The site has no accounts, no sign-in and no contact forms, so the list is short.
      </p>

      <h2>Data stored in your browser</h2>
      <p>
        Your game data is kept in your own browser&apos;s local storage (localStorage, plus
        sessionStorage for a few per-tab counters). It is not sent to us. Depending on which games you
        play, this includes:
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>best scores, times and per-game statistics (games played, wins, results);</li>
        <li>daily-puzzle progress and streaks, and which levels or puzzles you have solved;</li>
        <li>saved in-progress boards for games that can be resumed;</li>
        <li>your favourites, recently played games, achievements and the sound on/off setting;</li>
        <li>which emoji reactions you have already given on a game page;</li>
        <li>the nickname you last typed for a leaderboard or comment, so you do not retype it;</li>
        <li>a random anonymous visitor ID used for the page-view counts described below.</li>
      </ul>
      <p>
        You can remove all of this at any time by clearing this site&apos;s data in your browser
        settings. Doing so resets your scores and streaks, because there is no server copy.
      </p>

      <h2>Anonymous usage statistics</h2>
      <p>
        When you open or leave a page, finish a game, or add a reaction, the site sends a small
        first-party event to its own server. It contains the page or game name, the event type (for
        example a view, a win or a loss), how long you stayed when you leave, the referring page if your browser provides one, and the random
        visitor ID mentioned above. Cloudflare adds the country your request came from. These events
        are written to Cloudflare Workers Analytics Engine and are used only to see which games are
        played and whether people come back. No name, email address or account is attached, and no
        third-party analytics script is loaded.
      </p>

      <h2>Leaderboards</h2>
      <p>
        Some games have weekly online leaderboards. If you choose to submit a score, the score and the
        display name you type (up to 16 characters, or &quot;Anon&quot; if left blank) are stored on
        the server and shown publicly on the leaderboard. Submitting is optional. Please do not use
        your real name or any personal information as your display name.
      </p>

      <h2>Comments and reactions</h2>
      <p>
        Game pages allow short anonymous comments. The name and text you post are stored and shown
        publicly on that game&apos;s page; links are not accepted. To limit spam, the server records
        your IP address together with the time of your most recent comment so it can enforce a short
        wait between posts. Emoji reactions are stored only as a running count per game — nothing
        identifying you is saved with them.
      </p>
      <p>
        If you want a leaderboard name or comment you posted removed, get in touch through the{' '}
        <Link href="/contact" className="text-accent">contact page</Link> and say which page and
        what it said. Submitted names, scores or comments may also be removed at our discretion.
      </p>

      <h2>Cookies and advertising</h2>
      <p>
        The site itself does not set cookies. It may display ads served by Google AdSense. When ads
        are shown, Google and its partners may use cookies or similar identifiers to serve ads,
        including ads based on your prior visits to this or other websites. You can opt out of
        personalised advertising at{' '}
        <a href="https://adssettings.google.com" className="text-accent">Google Ads Settings</a>, or
        learn more about{' '}
        <a href="https://policies.google.com/technologies/partner-sites" className="text-accent">
          how Google uses information from sites that use its services
        </a>
        . Where consent for personalised ads is required, such as in the EU, EEA and UK, it will be
        requested before such ads are shown.
      </p>

      <h2>Hosting and third parties</h2>
      <p>
        The site is hosted on Cloudflare, which also stores leaderboard entries, comments, reaction
        counts and the usage events described above. Like any web host, Cloudflare processes your IP
        address to deliver pages. Google AdSense may serve ads as described above. We do not sell
        your data.
      </p>

      <h2>Children</h2>
      <p>
        This is a general-audience site and is not directed to children under 13. We do not knowingly
        collect personal information from children.
      </p>

      <h2>Changes and contact</h2>
      <p>
        This page will be updated when what the site stores changes, and the date above will change
        with it. Questions about this policy? Reach us via the{' '}
        <Link href="/contact" className="text-accent">contact page</Link>.
      </p>
    </ProsePage>
  )
}
