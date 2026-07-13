import type { Metadata } from 'next'
import { ProsePage } from '@/components/ProsePage'

export const metadata: Metadata = { title: 'Contact', alternates: { canonical: '/contact' } }

export default function ContactPage() {
  return (
    <ProsePage title="Contact">
      <p>
        Found a bug, have a game suggestion, or want to get in touch? Email us at{' '}
        <a href="mailto:hello@minigameshub.example" className="text-accent">hello@minigameshub.example</a>{' '}
        and we will get back to you as soon as we can.
      </p>
      <p>We read every message — feedback directly shapes which games get built next.</p>
    </ProsePage>
  )
}
