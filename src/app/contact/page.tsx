import { ogImage } from '@/lib/og/ogImage'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ProsePage } from '@/components/ProsePage'
import { CATEGORY_TINT } from '@/components/home/SeedCard'
import { siteConfig } from '@/lib/siteConfig'

export const metadata: Metadata = {
  title: 'Contact',
  alternates: { canonical: '/contact' },
  description: 'Get in touch with the maker of Quick MiniGames — report a bug, suggest a game idea or correct a rule. Email hello@quickminigames.site; replies within a couple of days.',
  // 페이지 openGraph는 layout 것을 덮는다 → siteName을 다시 준다(og:site_name 누락 방지)
  openGraph: { url: '/contact', type: 'website', siteName: siteConfig.name, images: ogImage() },
}

export default function ContactPage() {
  return (
    <ProsePage page="contact" kicker="Say hello" title="Contact" art={{ mascot: 'bomi-deliver', wash: CATEGORY_TINT.Skill.wash }}>
      <p>
        {siteConfig.name} is made by one person, and I genuinely like hearing from the people who play
        it. Whether you have found a bug, thought of a game you wish existed, spotted a rule that is
        unclear, or just want to say hello, please get in touch — every message reaches me directly.
      </p>
      <p>
        The best way to reach me is by email at{' '}
        <a href="mailto:hello@quickminigames.site">hello@quickminigames.site</a>. I read
        everything and reply as soon as I can, usually within a couple of days.
      </p>

      <h2>What&apos;s helpful to include</h2>
      <ul>
        <li>
          <strong>Bug reports:</strong> the game you were playing, what you expected to happen, what
          actually happened, and whether you were on a phone, tablet or computer (and which browser).
          That detail lets me reproduce and fix the problem quickly.
        </li>
        <li>
          <strong>Game ideas:</strong> the game or mechanic you would like to see. I read every
          suggestion when deciding what to build next.
        </li>
        <li>
          <strong>Corrections:</strong> if a rule, strategy tip or FAQ answer on any game page looks
          wrong or confusing, tell me the page and what tripped you up.
        </li>
      </ul>

      <p>
        For questions about how your data is handled, see the{' '}
        <Link href="/privacy">privacy policy</Link>. There is no contact form
        to fill in and no newsletter sign-up — just an inbox that a real person reads.
      </p>
    </ProsePage>
  )
}
