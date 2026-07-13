import type { Metadata } from 'next'
import { ProsePage } from '@/components/ProsePage'
import { siteConfig } from '@/lib/siteConfig'

export const metadata: Metadata = { title: 'Terms of Use', alternates: { canonical: '/terms' } }

export default function TermsPage() {
  return (
    <ProsePage title="Terms of Use">
      <p>Last updated: July 13, 2026</p>
      <p>
        By using {siteConfig.name}, you agree to these terms. All games are provided free of charge,
        "as is", for personal entertainment. We make no guarantees about availability or fitness for
        any particular purpose.
      </p>
      <p>
        The games and original content on this site are our own work. Game mechanics (such as sliding
        tile puzzles) are common public-domain concepts; we do not use trademarks or assets belonging
        to other games or companies.
      </p>
      <p>
        We may update these terms or discontinue any game at any time. Continued use of the site
        after changes means you accept the updated terms.
      </p>
    </ProsePage>
  )
}
