import type { Metadata } from 'next'
import Link from 'next/link'
import { ProsePage } from '@/components/ProsePage'
import { siteConfig } from '@/lib/siteConfig'

export const metadata: Metadata = {
  title: 'Terms of Use',
  alternates: { canonical: '/terms' },
  openGraph: { url: '/terms' },
}

export default function TermsPage() {
  return (
    <ProsePage title="Terms of Use">
      <p>Last updated: October 9, 2026</p>
      <p>
        These terms explain how {siteConfig.name} may be used. By using the site, you agree to them.
      </p>

      <h2>The games</h2>
      <p>
        All games are provided free of charge, &quot;as is&quot;, for personal entertainment. There is
        no guarantee that any game, daily puzzle or leaderboard will always be available, free of bugs,
        or suitable for any particular purpose, and games may be changed, rebalanced or removed at any
        time.
      </p>

      <h2>Your saved progress</h2>
      <p>
        Scores, streaks and other progress are saved only in your own browser. Clearing your browser
        data, switching browsers or devices, or using a private window will lose or hide that progress,
        and it cannot be restored from the site. See the{' '}
        <Link href="/privacy" className="text-accent">privacy policy</Link> for what is stored.
      </p>

      <h2>Leaderboards, comments and reactions</h2>
      <p>
        Leaderboard names, scores and comments you submit are shown publicly. Do not submit names or
        comments that are offensive, harassing, impersonate someone else, advertise anything, or
        contain personal information about yourself or anyone else. Do not submit scores you did not
        earn by playing, and do not use scripts or automated tools to post scores, comments or
        reactions. Any name, score, comment or reaction may be removed at our discretion and without
        notice.
      </p>

      <h2>Content</h2>
      <p>
        The games, text and graphics on this site are original work created for it. Some games are
        versions of traditional or widely known game concepts (such as solitaire, sliding-tile puzzles
        or chess); no trademarks, artwork or code belonging to other games or companies are used.
      </p>

      <h2>Advertising and links</h2>
      <p>
        The site may show ads from third-party networks such as Google AdSense, and may link to other
        websites. We are not responsible for the content of ads or external sites.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may be updated from time to time; the date above shows the latest version.
        Continued use of the site after a change means you accept the updated terms. Questions can be
        sent through the <Link href="/contact" className="text-accent">contact page</Link>.
      </p>
    </ProsePage>
  )
}
