import type { Metadata } from 'next'
import Link from 'next/link'
import { ProsePage } from '@/components/ProsePage'
import { siteConfig } from '@/lib/siteConfig'

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } }

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy Policy">
      <p>Last updated: July 13, 2026</p>
      <h2>What we collect</h2>
      <p>
        {siteConfig.name} does not require an account and does not collect personal information
        directly. Game progress and best scores are stored locally in your browser (localStorage)
        and never leave your device.
      </p>
      <h2>Analytics</h2>
      <p>
        We use privacy-respecting analytics to understand aggregate traffic (page views, referrers,
        approximate region). This data is not used to identify individual visitors.
      </p>
      <h2>Advertising</h2>
      <p>
        This site may display ads served by third-party advertising partners such as Google AdSense.
        These partners may use cookies to serve ads based on your prior visits to this or other
        websites. You can opt out of personalized advertising at{' '}
        <a href="https://adssettings.google.com" className="text-accent">Google Ads Settings</a>.
      </p>
      <h2>Contact</h2>
      <p>Questions about this policy? Reach us via the <Link href="/contact" className="text-accent">contact page</Link>.</p>
    </ProsePage>
  )
}
