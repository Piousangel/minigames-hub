import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/lib/siteConfig'
import { pixelFont } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: 'black-translucent' },
  openGraph: { type: 'website', siteName: siteConfig.name },
}

export const viewport: Viewport = {
  themeColor: '#08080f',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={pixelFont.variable} suppressHydrationWarning>
      <body className="scanlines flex min-h-screen flex-col antialiased">
        {/* Mark JS as available BEFORE first paint so the scroll-reveal hidden
            state only applies for JS-capable browsers (no FOUC; no-JS/crawlers
            always see visible content). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('has-js')",
          }}
        />
        {/* AdSense 로더 — clientId가 설정된 경우에만 로드(승인 전엔 비활성). */}
        {siteConfig.adsenseClientId && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${siteConfig.adsenseClientId}`}
            crossOrigin="anonymous"
          />
        )}
        {/* Synthwave background — decorative, fixed, behind all content. */}
        <div aria-hidden="true" className="synthwave-bg" />
        <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
          <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link
              href="/"
              aria-label={`${siteConfig.name} — home`}
              className="group flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              style={{ color: 'var(--neon-amber)' }}
            >
              <span aria-hidden="true" className="text-lg leading-none">🕹️</span>
              <span className="font-pixel neon-text text-xs sm:text-sm">
                {siteConfig.name}
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="font-pixel neon-text hidden text-[10px] tracking-[0.2em] text-neon-cyan sm:inline"
              >
                INSERT COIN
              </span>
              <Link
                href="/about"
                className="rounded-md text-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                About
              </Link>
            </div>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border bg-bg-2/60 py-8 text-center text-sm text-fg-muted">
          <p
            aria-hidden="true"
            className="font-pixel neon-text mb-4 text-[10px] tracking-[0.25em] text-neon-magenta"
          >
            ★ GAME OVER · INSERT COIN ★
          </p>
          <nav className="mb-4 space-x-4">
            <Link href="/about" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">About</Link>
            <Link href="/privacy" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Privacy</Link>
            <Link href="/terms" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Terms</Link>
            <Link href="/contact" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Contact</Link>
          </nav>
          <p>© 2026 {siteConfig.name}. All games are free to play.</p>
        </footer>
      </body>
    </html>
  )
}
