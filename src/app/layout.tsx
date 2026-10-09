import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/lib/siteConfig'
import { Logo } from '@/components/Logo'
import { TrophyIcon } from '@/components/icons/TrophyIcon'
import { RecordPageView } from '@/components/RecordPageView'
import { pixelFont } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: 'black-translucent' },
  openGraph: { type: 'website', siteName: siteConfig.name },
  // AdSense 사이트 소유권 확인. 심사 중에도 살아 있어야 하므로 adsenseEnabled와 무관하게 렌더.
  other: { 'google-adsense-account': siteConfig.adsenseClientId },
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
        {/* AdSense 로더 — 게재가 켜진 경우에만 로드(승인 전엔 비활성). */}
        {siteConfig.adsenseEnabled && siteConfig.adsenseClientId && (
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
              <Logo className="h-5 w-5" />
              <span className="font-pixel neon-text text-xs sm:text-sm">
                {siteConfig.name}
              </span>
            </Link>
            <div className="flex items-center gap-4">
              {/* aria-label은 상시 필요: 좁은 화면에서 텍스트 라벨이 display:none이 되므로
                  이게 없으면 링크에 접근 가능한 이름이 남지 않는다.
                  탭 영역은 ::after로 44px까지 넓힌다 — 링크 자체를 키우면 스티키 헤더가 두꺼워진다. */}
              <Link
                href="/leaderboards"
                aria-label="Leaderboards"
                className="relative flex items-center gap-1.5 rounded-md text-sm text-fg-muted transition-colors after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-full after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <TrophyIcon className="h-[1.15em] w-[1.15em]" />
                <span className="hidden sm:inline">Leaderboards</span>
              </Link>
              <Link
                href="/about"
                className="relative rounded-md text-sm text-fg-muted transition-colors after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-full after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                About
              </Link>
            </div>
          </nav>
        </header>
        {/* 전 페이지 조회·체류 비콘. 게임 페이지는 RecordPlay가 'view'를 따로 보내므로
            여기서는 'pageview'로 분리 기록한다(기존 'view' 집계 정의 보존). */}
        <RecordPageView />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border bg-bg-2/60 py-8 text-center text-sm text-fg-muted">
          <p
            aria-hidden="true"
            className="font-pixel neon-text mb-4 text-[10px] tracking-[0.25em] text-neon-magenta"
          >
            ★ GAME OVER · INSERT COIN ★
          </p>
          <nav className="mb-3 space-x-4" aria-label="Browse by category">
            <Link href="/daily" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Daily games</Link>
            <Link href="/category/puzzle" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Puzzle games</Link>
            <Link href="/category/arcade" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Arcade games</Link>
            <Link href="/category/classic" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Classic games</Link>
            <Link href="/category/skill" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Skill games</Link>
            <Link href="/collections" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Collections</Link>
          </nav>
          <nav className="mb-4 space-x-4">
            <Link href="/about" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">About</Link>
            <Link href="/privacy" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Privacy</Link>
            <Link href="/terms" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Terms</Link>
            <Link href="/contact" className="rounded-md transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg">Contact</Link>
          </nav>
          {siteConfig.kofiUrl && (
            <p className="mb-4">
              <a
                href={siteConfig.kofiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-neon-magenta/40 bg-surface px-3 py-1.5 text-neon-magenta transition-colors hover:bg-neon-magenta/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-magenta focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <span aria-hidden="true">☕</span>
                <span>Enjoying the games? Support the site</span>
              </a>
            </p>
          )}
          <p>© 2026 {siteConfig.name}. All games are free to play.</p>
        </footer>
      </body>
    </html>
  )
}
