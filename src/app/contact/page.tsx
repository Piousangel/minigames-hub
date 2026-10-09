import type { Metadata } from 'next'
import Link from 'next/link'
import { ProsePage } from '@/components/ProsePage'
import { siteConfig } from '@/lib/siteConfig'

export const metadata: Metadata = {
  title: 'Contact',
  alternates: { canonical: '/contact' },
  openGraph: { url: '/contact' },
}

export default function ContactPage() {
  return (
    <ProsePage title="Contact">
      <p>
        {siteConfig.name} is made by one person, and I genuinely like hearing from the people who play
        it. Whether you have found a bug, thought of a game you wish existed, spotted a rule that is
        unclear, or just want to say hello, please get in touch — every message reaches me directly.
      </p>
      <p>
        The best way to reach me is by email at{' '}
        <a href="mailto:yyh7654@gmail.com" className="text-accent">yyh7654@gmail.com</a>. I read
        everything and reply as soon as I can, usually within a couple of days.
      </p>

      <h2>What&apos;s helpful to include</h2>
      <ul className="list-disc space-y-2 pl-5">
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
        <Link href="/privacy" className="text-accent">privacy policy</Link>. There is no contact form
        to fill in and no newsletter sign-up — just an inbox that a real person reads.
      </p>
    </ProsePage>
  )
}
