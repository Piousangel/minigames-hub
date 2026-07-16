import type { Metadata } from 'next'
import { ProsePage } from '@/components/ProsePage'

export const metadata: Metadata = {
  title: 'Contact',
  alternates: { canonical: '/contact' },
  openGraph: { url: '/contact' },
}

export default function ContactPage() {
  return (
    <ProsePage title="Contact">
      <p>
        Found a bug, have a game suggestion, or want to get in touch? Email{' '}
        <a href="mailto:yyh7654@gmail.com" className="text-accent">yyh7654@gmail.com</a> and I will
        get back to you as soon as I can.
      </p>
      <p>I read every message — feedback directly shapes which games get built next.</p>
    </ProsePage>
  )
}
