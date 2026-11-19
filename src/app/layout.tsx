import type { Metadata, Viewport } from 'next'
import { siteConfig } from '@/lib/siteConfig'
import { SiteFooter } from '@/components/site-chrome/SiteFooter'
import { SiteHeader } from '@/components/site-chrome/SiteHeader'
import { RecordPageView } from '@/components/RecordPageView'
import { displayFont, pixelFont, uiFont } from './fonts'
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
  // displayFont·uiFont는 CSS 변수(--font-display·--font-ui)로 노출. R2: 헤더·푸터만 font-ui/font-display, body 전체는 R3.
  return (
    <html lang="en" className={`${pixelFont.variable} ${displayFont.variable} ${uiFont.variable}`} suppressHydrationWarning>
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
        <SiteHeader />
        {/* 전 페이지 조회·체류 비콘. 게임 페이지는 RecordPlay가 'view'를 따로 보내므로
            여기서는 'pageview'로 분리 기록한다(기존 'view' 집계 정의 보존). */}
        <RecordPageView />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  )
}
