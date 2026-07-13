import type { Metadata } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/lib/siteConfig'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: { type: 'website', siteName: siteConfig.name },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased">
        <header className="border-b border-white/10">
          <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-bold text-accent">{siteConfig.name}</Link>
            <Link href="/about" className="text-sm text-fg-muted hover:text-fg">About</Link>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-white/10 py-6 text-center text-sm text-fg-muted">
          <div className="mb-2 space-x-4">
            <Link href="/about" className="hover:text-fg">About</Link>
            <Link href="/privacy" className="hover:text-fg">Privacy</Link>
            <Link href="/terms" className="hover:text-fg">Terms</Link>
            <Link href="/contact" className="hover:text-fg">Contact</Link>
          </div>
          <p>© 2026 {siteConfig.name}. All games are free to play.</p>
        </footer>
      </body>
    </html>
  )
}
