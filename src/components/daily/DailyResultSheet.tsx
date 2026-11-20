'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { roundFont } from '@/app/roundFont'
import { useGameNav } from '@/components/GameNav'
import { Mascot } from '@/components/Mascot'
import { ShareButtons } from '@/components/ShareButtons'
import { BottomSheet, type SheetApi } from '@/components/sheet/BottomSheet'
import { BudIcon, FlowerIcon, PlayIcon } from '@/components/site-chrome/GardenIcons'
import { todayLocal } from '@/lib/dailyDate'
import { nextEditionLabel } from '@/lib/daily/countdown'
import { GARDEN_DONE_EVENT, type DailyResult } from '@/lib/daily/result'
import { SKY_BANDS, SKY_NOW } from '@/lib/daily/shareCard'
import { sendHit } from '@/lib/hit'
import { editionFor, type Edition } from '@/lib/home/edition'
import { FIRST_GARDEN, bloomedCount, readGarden, type Garden } from '@/lib/home/garden'
import { tagShareUrl } from '@/lib/share'
import { siteConfig } from '@/lib/siteConfig'

export const SHEET_TEST_ID = 'daily-result-sheet'
const HISTORY_MARK = '__dailySheet'

type ShareState = 'idle' | 'busy' | 'shared' | 'copied' | 'failed'

/** 시트 문구(테스트가 같은 함수를 본다). */
export function sheetCopy(g: Garden, gameTitle: string) {
  const n = bloomedCount(g)
  return {
    kicker: `${gameTitle} · Bloomed`, // 호수(No. N)는 공유 카드에만(계획서 0장: 마스트헤드·공유 카드 2곳)
    full: n === 3,
    titleLead: 'Today’s garden',
    titleTail: n === 3 ? 'is full.' : 'is growing.',
    meta: `${n} of 3 bloomed`,
    shareLine: `${gameTitle} · garden ${n}/3`,
  }
}

/** 공유 문구(링크 제외): 게임의 원래 결과 문구 + 오늘 호·정원. 개인 정보 없음. */
export function sheetShareText(gameText: string, g: Garden, edition: Edition): string {
  return [gameText.trim(), `Today's garden ${bloomedCount(g)}/3 · No. ${edition.no}`].filter(Boolean).join('\n')
}

function readNow(): { edition: Edition; garden: Garden } {
  const edition = editionFor(new Date())
  let garden = FIRST_GARDEN
  try {
    garden = readGarden(window.localStorage, edition, todayLocal())
  } catch {
    /* 저장소 막힘 */
  }
  return { edition, garden }
}

/**
 * 데일리 결과 시트(오리지널 3종 공통, 리디자인 v2 R5 — 시안 hub-v2.html M-SHEET).
 * - 게임 화면 위 하단 시트: max-height 85dvh + 안쪽 스크롤, 광고 없음, 노란 버튼은 Share 하나.
 * - 보조: Next game(크림, GameNavProvider의 다음 게임 = NextRail·옛 오버레이와 같은 픽), 닫기(게임으로 돌아가기).
 * - 열기·닫기·끌어 닫기·포커스·history·스크롤 잠금은 공통 BottomSheet(src/components/sheet). 여기는 내용만.
 * - 모션 줄이기: 꽃 피기 애니메이션 없이 최종 상태(globals.css .daily-sheet__flower).
 * - 리더보드 제출(OverlayScoreSubmit) 등 게임별 칸은 children으로 받는다(흐름은 게임 그대로).
 */
export function DailyResultSheet({
  open,
  onClose,
  slug,
  gameTitle,
  result,
  shareText,
  closeLabel = 'Back to game',
  leaderboard = false,
  children,
}: {
  open: boolean
  onClose: () => void
  slug: string
  gameTitle: string
  result: DailyResult
  /** 게임의 원래 결과 공유 문구(링크 제외). */
  shareText: string
  closeLabel?: string
  /** 페이지 아래 리더보드(#leaderboard)로 가는 링크(옛 오버레이의 'See this week's leaderboard'). */
  leaderboard?: boolean
  children?: ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<{ edition: Edition; garden: Garden } | null>(null)
  const [clock, setClock] = useState('')
  const [share, setShare] = useState<ShareState>('idle')
  const [channels, setChannels] = useState(false)
  const nav = useGameNav()
  const titleId = useId()
  const card = useRef<File | null>(null) // 터치 기기: 시트가 열릴 때 미리 만든 공유 카드(클릭 뒤 await가 길면 사용자 활성화가 만료된다)
  const nextShownFor = useRef<DailyResult | null>(null)
  const router = useRouter()

  useEffect(() => setMounted(true), [])

  // 열릴 때: 오늘 호·정원 읽기, 계측, 시계
  useEffect(() => {
    if (!open) return
    setNow(readNow())
    setShare('idle')
    setChannels(false)
    sendHit(slug, 'result_sheet')
    const onDone = () => setNow(readNow())
    window.addEventListener(GARDEN_DONE_EVENT, onDone)
    const tick = () => setClock(nextEditionLabel(Date.now()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => {
      window.removeEventListener(GARDEN_DONE_EVENT, onDone)
      window.clearInterval(id)
    }
  }, [open, slug])

  // 옛 오버레이와 같은 분모: Next 버튼이 실제로 보일 때 판마다 1회(next_show) — 'Today’s result'로 다시 열어도 다시 세지 않는다
  useEffect(() => {
    if (!open || !nav.slug || !nav.nextSlug || nextShownFor.current === result) return
    nextShownFor.current = result
    sendHit(nav.slug, 'next_show')
  }, [open, nav.slug, nav.nextSlug, result])

  // 터치 기기 + Web Share: 공유 카드 PNG를 미리 만들어 둔다(정원 칸이 바뀌면 다시)
  useEffect(() => {
    card.current = null
    if (!open || !now || typeof navigator.share !== 'function' || !window.matchMedia?.('(pointer: coarse)').matches) return
    let alive = true
    const { edition, garden } = now
    void (async () => {
      try {
        const { makeShareCard } = await import('@/lib/daily/shareCard')
        const css = getComputedStyle(document.documentElement)
        const blob = await makeShareCard({
          editionNo: edition.no,
          gameTitle,
          line: sheetCopy(garden, gameTitle).shareLine,
          bloomed: garden.slots.map((x) => x.status === 'bloomed'),
          displayFont: css.getPropertyValue('--font-display').trim() || 'serif',
          uiFont: css.getPropertyValue('--font-ui').trim() || 'sans-serif',
        })
        if (alive && blob) card.current = new File([blob], `quickminigames-no${edition.no}.png`, { type: 'image/png' })
      } catch {
        /* 카드 없이 문구만 공유 */
      }
    })()
    return () => {
      alive = false
    }
  }, [open, now, gameTitle])

  if (!open || !mounted) return null

  const { edition, garden } = now ?? readNow()
  const copy = sheetCopy(garden, gameTitle)
  const text = sheetShareText(shareText, garden, edition)
  const url = tagShareUrl(`${siteConfig.url}/${slug}`, 'native') // 예전 시스템 공유와 같은 URL(?ref=share-native)

  const onShare = async () => {
    if (share === 'busy') return
    setShare('busy')
    const touch = window.matchMedia?.('(pointer: coarse)').matches
    try {
      if (touch && typeof navigator.share === 'function') {
        // 터치 기기: 미리 만든 카드 이미지 + 문구(파일 공유 미지원·카드 없음이면 문구만). 클릭 뒤 바로 share — 활성화 만료 방지.
        // 데스크톱 공유창엔 보통 메신저가 없어 아래 복사로(예전 규칙)
        const file = card.current
        const files = file && navigator.canShare?.({ files: [file] }) ? [file] : undefined
        await navigator.share(files ? { files, text: `${text}\n${url}` } : { text, url })
        sendHit(slug, files ? 'share_card' : 'share_native')
        setShare('shared')
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setShare('idle')
        return
      }
      // 그 밖의 실패(인앱 브라우저 등)는 복사로
    }
    let ok = false
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      ok = true
    } catch {
      ok = false
    }
    sendHit(slug, ok ? 'share_copy' : 'share_copy_fail')
    setShare(ok ? 'copied' : 'failed')
    setChannels(true) // 채널 줄(Threads·Facebook·카카오톡…)을 펼친다 — 예전 결과 화면의 공유 줄
  }

  const nextHref = nav.nextSlug ? `/${nav.nextSlug}?ref=next` : ''
  const onNext = (e: ReactMouseEvent<HTMLAnchorElement>, sheet: SheetApi) => {
    sendHit(nav.slug, 'next_ovl')
    // 시트 history 칸 위에 새 페이지를 쌓지 않고 그 칸을 바꿔 끼운다(뒤로 가기 한 번 = 게임 페이지)
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0 && sheet.takeHistory()) {
      e.preventDefault()
      router.replace(nextHref)
    }
  }
  const toLeaderboard = (e: ReactMouseEvent<HTMLAnchorElement>, sheet: SheetApi) => {
    e.preventDefault()
    // 시트가 다 닫히고 스크롤 잠금이 풀린 뒤에 내려간다(잠금 중에 스크롤하면 풀릴 때 제자리로 돌아온다)
    sheet.close(() => document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // 큰 숫자: 5글자 이상(예: '1024 m')은 24px로 — 360에서 세 칸(약 97px)을 넘지 않게
  const big = (v: string | number) =>
    `${roundFont.className} block whitespace-nowrap font-bold tabular-nums text-garden-coral-text leading-9 ${String(v).length > 4 ? 'text-[24px]' : 'text-[32px]'}`
  const lbl = 'block text-[12px] leading-4 font-medium text-garden-ink-soft'
  const flowers = garden.slots.map((s) => s.status === 'bloomed')

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      testId={SHEET_TEST_ID}
      rootTestId={`${SHEET_TEST_ID}-root`}
      historyMark={HISTORY_MARK}
      className="px-4"
    >
      {(sheet) => (
      <div data-full={copy.full ? 'true' : 'false'} data-testid="sheet-body">
        <p className="truncate text-[12px] leading-4 font-semibold text-garden-coral-text">{copy.kicker}</p>
        <h2 id={titleId} className="font-display mt-1 text-[28px] leading-8 font-semibold tracking-[-0.02em] min-[380px]:text-[30px] min-[380px]:leading-[34px]">
          {copy.titleLead} <em className="font-display-italic italic">{copy.titleTail}</em>
        </h2>

        <div className="mt-3 flex h-10 items-center" role="img" aria-label={`Today's garden: ${copy.meta}`} data-testid="sheet-garden">
          {flowers.map((b, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <svg aria-hidden="true" viewBox="0 0 40 12" className="h-3 w-8 shrink-0 min-[380px]:w-10">
                  <g fill="#7a5636">
                    <circle cx="6" cy="8" r="1.6" />
                    <circle cx="14" cy="5" r="1.6" />
                    <circle cx="22" cy="4" r="1.6" />
                    <circle cx="30" cy="5" r="1.6" />
                  </g>
                </svg>
              )}
              <span className={`daily-sheet__flower shrink-0 ${b ? 'is-bloomed' : ''}`} style={{ animationDelay: `${120 + i * 140}ms` }}>
                {b ? <FlowerIcon className="h-9 w-9" /> : <BudIcon className="h-9 w-9" />}
              </span>
            </Fragment>
          ))}
          <span className="ml-3 text-[13px] leading-[18px] font-medium text-garden-ink-soft">{copy.meta}</span>
        </div>

        <dl className="mt-3 grid grid-cols-3 border-t border-b border-t-garden-ink border-b-[#c4a27c]" data-testid="sheet-stats">
          <div className="flex min-w-0 flex-col-reverse py-3">
            <dt className={lbl}>{result.primary.label}</dt>
            <dd className={big(result.primary.value)}>{result.primary.value}</dd>
          </div>
          <div className="flex min-w-0 flex-col-reverse border-l border-[#c4a27c] py-3 pl-3">
            <dt className={lbl}>{result.secondary?.label ?? ''}</dt>
            <dd className={big(result.secondary?.value ?? '—')}>{result.secondary?.value ?? '—'}</dd>
          </div>
          <div className="flex min-w-0 flex-col-reverse border-l border-[#c4a27c] py-3 pl-3">
            {/* 이 게임을 연달아 끝낸 날 수(게임별). 아래 DailyDock 🔥는 사이트 연속이라 이름을 달리 둔다 */}
            <dt className={lbl}>days in a row</dt>
            <dd className={big(result.streak)} data-testid="sheet-streak">
              {result.streak}
            </dd>
          </div>
        </dl>

        {/* 공유 카드 미리보기(실제 공유는 같은 구성의 PNG) */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-garden-ink bg-garden-paper px-3 py-2.5" data-testid="sheet-share-card">
          <div aria-hidden="true" className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-garden-ink bg-[url(/art/hub-hero-desktop-4f-d3.webp)] bg-[length:auto_148%] bg-[position:66%_60%]" />
          <div className="min-w-0">
            <p className="font-display truncate text-[15px] leading-5 font-semibold">Quick MiniGames · No. {edition.no}</p>
            <p className="truncate text-[12px] leading-4 text-garden-ink-soft">{copy.shareLine}</p>
            <span aria-hidden="true" className="relative mt-1.5 flex h-1.5 w-40 max-w-full overflow-visible">
              {SKY_BANDS.map((c, i) => (
                <i key={c} className={`block h-full flex-1 ${i === 0 ? 'rounded-l-full' : ''} ${i === 7 ? 'rounded-r-full' : ''}`} style={{ background: c }} />
              ))}
              <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-garden-ink bg-garden-cream" style={{ left: `${((SKY_NOW + 0.5) / 8) * 100}%` }} />
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onShare}
          data-testid="sheet-share"
          aria-busy={share === 'busy'}
          aria-describedby={share !== 'idle' ? `${titleId}-share` : undefined}
          className="garden-jelly mt-4 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full border-[3px] border-garden-ink bg-garden-sun text-[17px] leading-none font-bold text-garden-ink shadow-garden-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-cream"
        >
          <ShareGlyph />
          {share === 'busy' ? 'Making your card…' : 'Share today’s garden'}
        </button>
        <p id={`${titleId}-share`} aria-live="polite" className="min-h-4 pt-1 text-center text-[12px] leading-4 text-garden-ink-soft">
          {share === 'copied' ? 'Copied — paste it anywhere.' : share === 'failed' ? 'Copy was blocked — pick an app below.' : share === 'shared' ? 'Shared. See you tomorrow!' : ''}
        </p>
        {channels && <ShareButtons compact slug={slug} title={gameTitle} text={text} />}

        {nav.nextSlug && nav.nextTitle && (
          <Link
            href={nextHref}
            onClick={(e) => onNext(e, sheet)}
            data-testid="sheet-next-game"
            className="garden-jelly mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full border-[3px] border-garden-ink bg-garden-cream px-4 text-[16px] leading-none font-bold text-garden-ink shadow-garden-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-cream"
          >
            <PlayIcon className="h-5 w-5 shrink-0" />
            <span className="truncate">Next game: {nav.nextTitle}</span>
          </Link>
        )}

        {children && <div className="mt-3 flex flex-col items-center gap-2 text-center">{children}</div>}
        {leaderboard && (
          <p className="mt-1 text-center">
            <a href="#leaderboard" onClick={(e) => toLeaderboard(e, sheet)} data-testid="sheet-leaderboard" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-garden-ink-soft underline decoration-dotted underline-offset-4 hover:text-garden-coral-text">
              See this week’s leaderboard
            </a>
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2">
          <button
            type="button"
            onClick={() => sheet.close()}
            data-testid="sheet-close"
            className="flex h-11 items-center gap-1.5 whitespace-nowrap rounded-md px-1 text-[15px] leading-none font-semibold text-garden-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
              <path d="M14.5 6l-6 6 6 6" fill="none" stroke="#5b3a1e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {closeLabel}
          </button>
          <p className="ml-auto flex shrink-0 items-center gap-2 text-[13px] leading-[18px] text-garden-ink-soft" data-testid="sheet-countdown">
            <span className="whitespace-nowrap">
              Next edition in <b className="inline-block w-[8ch] text-left font-bold tabular-nums text-garden-ink">{clock || '--:--:--'}</b>
            </span>
            {/* 보미(꿀벌 우체부, 소식 담당 D5) — '내일 호'를 들고 나는 countdown 32px(R6). 시트의 마스코트는 이 1마리(D6) */}
            <span aria-hidden="true" className="block h-8 w-8 shrink-0" data-testid="sheet-bomi-slot">
              <Mascot art="bomi-countdown" size={32} />
            </span>
          </p>
        </div>
      </div>
      )}
    </BottomSheet>
  )
}

function ShareGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0">
      <path d="M4 11.5 20 4l-5.5 16-3-6.5z" fill="none" stroke="#5b3a1e" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M11.5 13.5 20 4" stroke="#5b3a1e" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
