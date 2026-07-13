import type { Metadata } from 'next'
import { siteConfig } from '@/lib/siteConfig'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased">
        <header className="border-b border-white/10">
          <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <a href="/" className="font-bold text-accent">{siteConfig.name}</a>
            <a href="/about" className="text-sm text-fg-muted hover:text-fg">About</a>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-white/10 py-6 text-center text-sm text-fg-muted">
          <div className="mb-2 space-x-4">
            <a href="/about" className="hover:text-fg">About</a>
            <a href="/privacy" className="hover:text-fg">Privacy</a>
            <a href="/terms" className="hover:text-fg">Terms</a>
            <a href="/contact" className="hover:text-fg">Contact</a>
          </div>
          <p>© 2026 {siteConfig.name}. All games are free to play.</p>
        </footer>
      </body>
    </html>
  )
}
