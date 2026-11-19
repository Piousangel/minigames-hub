import Link from 'next/link'
import { siteConfig } from '@/lib/siteConfig'
import { FOOTER_GROUPS, chromeFocus } from './chromeLinks'
import { GardenLogoMark } from './GardenIcons'

/**
 * 푸터 '정원 안내판'(리디자인 v2 R2). 크림 바탕 · ink 글자 · 2단 그리드(lg에서 3단, 모바일에선 사이트 안내가 아래 한 줄).
 * 링크 묶음마다 nav + 이름(aria-labelledby). 각 링크 탭 높이 44px.
 * 묶음 제목은 <p> — 모든 페이지 끝에 붙어 문서 제목 구조(h2)를 흐리지 않게.
 */
export function SiteFooter() {
  return (
    // relative z-[42]: body.scanlines 줄무늬(z 40)가 크림 안내판에 얹히지 않게(헤더와 같은 이유).
    <footer className="font-ui relative z-[42] border-t-2 border-garden-ink bg-garden-cream text-garden-ink">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-8 lg:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-3">
          {FOOTER_GROUPS.map((g) => (
            // 사이트 안내(4개, 짧은 낱말)는 모바일에서 두 칸을 다 쓰는 한 줄 묶음 — 안내판 높이를 줄인다.
            <nav key={g.id} aria-labelledby={`footer-${g.id}`} className={g.inline ? 'col-span-2 lg:col-span-1' : undefined}>
              <p id={`footer-${g.id}`} className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-garden-coral-text">
                {g.title}
              </p>
              <ul className={g.inline ? 'flex flex-wrap gap-x-5 lg:block' : undefined}>
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={`-mx-2 inline-flex h-11 items-center rounded-md px-2 text-[15px] font-medium text-garden-ink transition-colors hover:text-garden-coral-text hover:underline ${chromeFocus}`}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {siteConfig.kofiUrl && (
          <p className="mt-6">
            <a
              href={siteConfig.kofiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-garden-ink bg-garden-cream-2 px-4 text-[14px] font-semibold text-garden-ink shadow-garden-button transition-colors hover:bg-garden-cream-shade ${chromeFocus}`}
            >
              <span aria-hidden="true">☕</span>
              <span>Enjoying the games? Support the site</span>
            </a>
          </p>
        )}

        <p className="mt-6 flex items-center gap-2 border-t border-garden-ink/30 pt-4 text-[13px] text-garden-ink-soft">
          <GardenLogoMark className="h-[18px] w-[18px] shrink-0" />
          <span>© 2026 {siteConfig.name}. All games are free to play.</span>
        </p>
      </div>
    </footer>
  )
}
