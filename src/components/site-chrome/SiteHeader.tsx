import Link from 'next/link'
import { siteConfig } from '@/lib/siteConfig'
import { HEADER_NAV, TODAY_PILL, chromeFocus, type HeaderNavIcon } from './chromeLinks'
import { GardenLogoMark, IsleIcon, PacketIcon, SunIcon, WellIcon } from './GardenIcons'
import { HeaderSearchLink } from './HeaderSearchLink'

const NAV_ICON: Record<HeaderNavIcon, typeof IsleIcon> = { isle: IsleIcon, packet: PacketIcon, well: WellIcon }

function NavLinks({ layout }: { layout: 'bar' | 'row' }) {
  return HEADER_NAV.map(({ href, label, icon }) => {
    const Icon = NAV_ICON[icon]
    return (
      <Link
        key={href}
        href={href}
        className={
          layout === 'bar'
            ? `flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-garden-ink transition-colors hover:bg-garden-cream-2 ${chromeFocus}`
            : // 모바일 2행: 3칸 균등, 칸 사이 세로 헤어라인(시안 .m-nav). 라벨 13px(D12 하한).
              `flex h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-semibold text-garden-ink-deep transition-colors hover:bg-garden-cream-2 [&+&]:border-l [&+&]:border-garden-ink/45 ${chromeFocus}`
        }
      >
        <Icon className={layout === 'bar' ? 'h-5 w-5 shrink-0' : 'h-[18px] w-[18px] shrink-0'} />
        {label}
      </Link>
    )
  })
}

/**
 * 사이트 헤더(리디자인 v2 R2). 모든 페이지(게임 페이지 포함)가 RootLayout에서 이걸 쓴다.
 * - lg(1024+): 한 줄 64px — 로고 · 가운데 내비 3 · 오늘 pill · 검색.
 * - 그 아래: 1행 56px(로고 · pill · 검색)만 sticky, 2행 내비 3칸(44px)은 sticky 아님 —
 *   모바일 게임 화면에서 고정 크롬을 56px로 묶어 두려는 것(리뷰 권고 '크롬 약 60px').
 * 높이는 전부 고정값(h-14/h-16/h-11) → 폰트 swap·하이드레이션으로 높이가 변하지 않는다(CLS 0).
 * 내비 마크업은 두 벌이지만 화면에 보이는 건 늘 한 벌(다른 쪽은 display:none = 접근성 트리에서도 빠짐).
 * z-[42]: body.scanlines::after(z 40) 줄무늬가 크림 바에 얹히지 않게, 그리고 z-[41]을 쓰는
 * Plop Landing 보드가 스크롤 때 sticky 헤더 위로 올라오지 않게.
 */
export function SiteHeader() {
  return (
    <>
      <header className="font-ui sticky top-0 z-[42] h-14 border-b-2 border-garden-ink bg-garden-cream/[.86] text-garden-ink lg:h-16">
        <div className="relative mx-auto flex h-full max-w-6xl items-center gap-1 pl-4 pr-2 sm:pr-3 lg:px-6">
          <Link
            href="/"
            aria-label={`${siteConfig.name} — home`}
            className={`flex h-11 min-w-0 shrink items-center gap-2 rounded-lg ${chromeFocus}`}
          >
            <GardenLogoMark className="h-7 w-7 shrink-0 lg:h-9 lg:w-9" />
            <span className="font-display truncate text-[18px] leading-none font-semibold tracking-[-0.01em] text-garden-ink sm:text-[20px] lg:text-[22px]">
              {siteConfig.name}
            </span>
          </Link>

          <nav
            aria-label="Main"
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 lg:flex"
          >
            <NavLinks layout="bar" />
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {/* 오늘 pill: 터치 영역 44px(링크) 안에 40px 알약. 좁은 화면은 짧은 문구, 이름은 늘 전체 문구 */}
            <Link
              href={TODAY_PILL.href}
              aria-label={`${TODAY_PILL.short} — ${TODAY_PILL.label}`}
              className={`group flex h-11 items-center rounded-full ${chromeFocus}`}
            >
              <span className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-garden-ink bg-garden-cream pl-2 pr-3 text-[14px] leading-none font-semibold text-garden-ink transition-colors group-hover:bg-garden-cream-2">
                <SunIcon className="h-[18px] w-[18px] shrink-0" />
                <span className="sm:hidden">{TODAY_PILL.short}</span>
                <span className="hidden sm:inline">{TODAY_PILL.label}</span>
              </span>
            </Link>
            <HeaderSearchLink
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-garden-cream-2 ${chromeFocus}`}
            />
          </div>
        </div>
      </header>
      <nav
        aria-label="Main"
        className="font-ui relative z-[42] border-b-2 border-garden-ink bg-garden-cream/[.86] lg:hidden"
      >
        <div className="mx-auto grid h-11 max-w-6xl grid-cols-3 px-2 sm:px-4">
          <NavLinks layout="row" />
        </div>
      </nav>
    </>
  )
}
