import type { Metadata } from 'next'
import Link from 'next/link'
import { ProsePage } from '@/components/ProsePage'
import { siteConfig } from '@/lib/siteConfig'

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } }

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy Policy">
      <p>Last updated: July 16, 2026</p>

      <h2>What we collect</h2>
      <p>
        {siteConfig.name} does not require an account and does not collect personal information
        directly. Your game progress and best scores are stored locally in your browser
        (localStorage) and stay on your device.
      </p>

      <h2>Leaderboards</h2>
      <p>
        Some games have optional online leaderboards. When you choose to submit a score, the display
        name you type and your score are sent to our server (hosted on Cloudflare) and shown publicly
        on the leaderboard. Submitting is entirely optional — please do not use your real name or any
        personal information as your leaderboard name. We may remove any submitted name or score at
        our discretion.
      </p>

      <h2>Cookies and advertising</h2>
      <p>
        This site may display ads served by third-party advertising partners such as Google AdSense.
        These partners may use cookies to serve ads based on your prior visits to this or other
        websites. You can opt out of personalized advertising at{' '}
        <a href="https://adssettings.google.com" className="text-accent">Google Ads Settings</a>, or
        learn more at{' '}
        <a href="https://policies.google.com/technologies/partner-sites" className="text-accent">
          how Google uses information from sites that use its services
        </a>
        . Visitors in the EU, EEA, and UK are shown a consent choice for personalized ads where
        required.
      </p>

      <h2>Third parties</h2>
      <p>
        We rely on Cloudflare to host the site and store leaderboard entries, and on Google AdSense
        to serve ads. We do not sell your data.
      </p>

      <h2>Children</h2>
      <p>
        This is a general-audience site and is not directed to children under 13. We do not knowingly
        collect personal information from children.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Reach us via the{' '}
        <Link href="/contact" className="text-accent">contact page</Link>.
      </p>
    </ProsePage>
  )
}
