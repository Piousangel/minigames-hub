'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Confetti } from './Confetti'
import { useGameNav } from '@/components/GameNav'
import { nearestGoalHint } from '@/lib/achievements'
import { siteConfig } from '@/lib/siteConfig'
import { hasLeaderboard } from '@/lib/leaderboard'
import { sendHit } from '@/lib/hit'
import { isEndless } from '@/lib/games/gameMeta'
import { OverlayScoreSubmit } from './OverlayScoreSubmit'

/** 덮개 자리(offsetParent)별: 덮개 전 min-height와 지금 떠 있는 덮개 수(R7f 짧은 판 최소 높이). */
const seats = new WeakMap<HTMLElement, { prev: string; open: number }>()

/**
 * Shared win/lose/draw overlay: blurred backdrop, entrance animation, optional
 * confetti on win. Fills its positioned parent (`absolute inset-0`).
 * `draw` is a neutral card (no green/red, no win confetti) for tied results.
 *
 * `testId` and any accessibility wiring are supplied by the caller so existing
 * e2e selectors (`game-over`, `you-win`, …) are preserved per game.
 */
export function GameOverlay({
  show,
  variant,
  title,
  children,
  testId,
  tone = 'neon',
  compact = false,
}: {
  show: boolean
  variant: 'win' | 'lose' | 'draw'
  title: string
  children?: ReactNode
  testId?: string
  /** 'cozy': 동화풍 게임용(네온 글로우 없이 크림 패널·갈색 외곽선). 기본 'neon'은 기존과 동일. */
  tone?: 'neon' | 'cozy'
  /** opt-in: 패널 안 간격·제목·여백을 줄여 390 폭의 작은 판(≈358px)보다 패널이 커지지 않게 한다.
   * 결과 줄이 한 줄 더 붙는 게임(2048 Animals)용. 기본 false = 기존 동작 그대로. */
  compact?: boolean
}) {
  const cozy = tone === 'cozy'
  // 게임오버 = 최고 이탈 지점. 여기에 '다음 게임'을 꽂아 세션을 이어붙인다(DOMAIN §2, 체류↑).
  // 훅은 early-return 전에 호출.
  const nav = useGameNav()
  // 게임오버 순간, 지금 바로 늘릴 수 있는 목표가 가깝다면 구체적 넛지("1 more win for Champion").
  const [goalHint, setGoalHint] = useState<{ text: string; icon: string } | null>(null)
  useEffect(() => {
    // endless 게임은 승리가 없으므로 'N more wins' 넛지는 이 판에서 이룰 수 없다 — 제외.
    setGoalHint(show ? nearestGoalHint(3, { excludeUnits: isEndless(nav.slug) ? ['win'] : [] }) : null)
  }, [show, nav.slug])
  // 종료 노출(next_* 이동률의 분모): show가 false→true가 될 때만 1회. 재렌더로 중복 집계되지 않는다.
  useEffect(() => {
    // Next 링크가 실제로 뜰 때만 센다(추천 없음·하이드레이션 전은 분모에서 제외).
    if (show && nav.slug && nav.nextSlug) sendHit(nav.slug, 'next_show')
  }, [show, nav.slug, nav.nextSlug])
  // 판이 짧은 게임(R7e slotter: 덮개 168px에 상자 440px)은 상자가 판 밖 크림 위로 넘쳤다. 상자가 덮개보다 클 때만
  // 덮개의 자리(absolute inset-0의 기준 = offsetParent) 최소 높이를 상자 + 위아래 12px로 늘려 판 안에 들게 한다 — 판이 그만큼
  // 길어지고 덮개가 닫히면 원래대로. 상자가 들어가는 게임은 아무것도 바꾸지 않는다(픽셀 그대로). 상자 높이가 바뀌면(넛지·점수 제출 칸) 다시 잰다.
  const rootRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = rootRef.current
    const seat = root?.offsetParent
    const panel = root?.querySelector<HTMLElement>('[data-overlay-panel]')
    if (!show || !root || !(seat instanceof HTMLElement) || !panel) return
    // 같은 자리에 덮개가 둘 이상 동시에 떠도 원래 값을 한 번만 기억하고, 마지막 덮개가 닫힐 때 되돌린다
    const entry = seats.get(seat) ?? { prev: seat.style.minHeight, open: 0 }
    entry.open++
    seats.set(seat, entry)
    const fit = () => {
      seat.style.minHeight = entry.prev
      const need = panel.offsetHeight // transform(등장 scale)과 무관한 레이아웃 높이
      if (need > root.clientHeight) seat.style.minHeight = `${need + 24}px`
    }
    fit()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    ro?.observe(panel)
    return () => {
      ro?.disconnect()
      if (--entry.open === 0) {
        seat.style.minHeight = entry.prev
        seats.delete(seat)
      }
    }
  }, [show])
  if (!show) return null
  // 승/패/무에 따른 색 — 컨테이너 currentColor 로 .neon-box 발광. 무승부는 중립(본문색).
  const neon = variant === 'win' ? 'var(--neon-green)' : variant === 'lose' ? 'var(--neon-red)' : 'var(--fg-muted)'
  // 세션 연속 플레이(RUN) 게임화: 손실회피로 "한 판 더"를 유도(방문당 플레이 수↑).
  const run = nav.runCount
  const runMilestone = run >= 3 && (run === 3 || run === 5 || run === 10 || run === 20 || run % 25 === 0)
  return (
    <div
      ref={rootRef}
      data-testid={testId}
      role="alertdialog"
      aria-label={title}
      // justify-center-safe: 위 최소 높이로도 못 들어가는 경우(자리 높이가 고정 등) 위로는 넘치지 않게(제목·첫 버튼 보존).
      // 넘치지 않으면 예전 가운데와 같다. overflow는 건드리지 않는다(auto면 상자 발광이 덮개 경계에서 잘려 픽셀이 바뀐다 — R7f 리뷰).
      className={`anim-backdrop-in absolute inset-0 z-10 flex flex-col items-center justify-center-safe gap-3 rounded-xl ${cozy ? 'bg-[#14123a]/70' : 'bg-bg/75'}`}
    >
      {/* 승리 + 세션 RUN 마일스톤에 축하 — 세션 길이 자체를 보상해 '한 판 더'를 강화(체류↑). */}
      {(variant === 'win' || runMilestone) && <Confetti active={show} />}
      <div
        data-overlay-panel
        style={cozy ? { color: '#5b3a1e', background: 'linear-gradient(#fff3dc, #f3d9aa)', border: '4px solid #5b3a1e', boxShadow: '0 5px 0 #3a2410, inset 0 0 0 3px #fbeccc' } : { color: neon }}
        className={`anim-overlay-in flex flex-col items-center rounded-2xl text-center ${compact ? 'gap-2' : 'gap-4'} ${cozy ? (compact ? 'mx-2 px-4 py-2.5' : 'mx-3 px-6 py-5') : compact ? 'neon-box border border-current/40 bg-bg-2/85 px-5 py-4' : 'neon-box border border-current/40 bg-bg-2/85 px-8 py-6'}`}
      >
        <p className={cozy ? `${compact ? 'text-[1.4rem]' : 'text-[1.7rem]'} font-bold leading-tight tracking-tight` : `neon-text-strong ${compact ? 'text-2xl' : 'text-3xl'} font-extrabold tracking-tight`}>
          {title}
        </p>
        <div className={`flex flex-col items-center ${compact ? 'gap-2' : 'gap-3'} ${cozy ? '' : 'text-fg'}`}>{children}</div>
        {/* 넛지: 목표가 가까우면 구체적으로(강한 동기), 아니면 세션 RUN. 한 줄만 — 클러터 방지. */}
        {goalHint ? (
          <p data-testid="overlay-goal-hint" className={`text-sm font-semibold ${cozy ? 'text-[#a0561b]' : 'text-neon-amber'}`}>
            {goalHint.icon} {goalHint.text} — one more?
          </p>
        ) : (
          run > 1 && (
            <p
              data-testid="overlay-run"
              className={`text-sm font-semibold ${cozy ? 'text-[#7a5230]' : runMilestone ? 'text-neon-amber' : 'text-fg-muted'}`}
            >
              {runMilestone ? `🔥 ${run}-game run! Keep it going —` : `🔥 Run ×${run} · one more?`}
            </p>
          )
        )}
        {nav.nextSlug && nav.nextTitle && (
          <Link
            href={`/${nav.nextSlug}?ref=next`}
            onClick={() => sendHit(nav.slug, 'next_ovl')}
            data-testid="overlay-next-game"
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 text-sm ${compact ? 'py-1.5' : 'mt-1 py-2'} font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${cozy ? 'border-2 border-[#5b3a1e] bg-[#fff8e8] text-[#5b3a1e] hover:bg-white focus-visible:ring-[#a0561b]' : 'border border-neon-lime/50 bg-surface text-neon-lime hover:bg-neon-lime/10 focus-visible:ring-neon-lime focus-visible:ring-offset-bg'}`}
          >
            <span aria-hidden="true">▶</span>
            <span>Next: {nav.nextTitle}</span>
          </Link>
        )}
        {hasLeaderboard(nav.slug) && <OverlayScoreSubmit slug={nav.slug} show={show} tone={cozy ? 'garden' : 'neon'} />}
        {/* 리더보드 발견 유도: 페이지 하단(NextRail/GameStats/DailyDock 다음)에 묻혀 있어
            스크롤로는 잘 안 보임 — 게임오버 순간 바로 점프시켜 존재를 알린다(참여율↑). */}
        {hasLeaderboard(nav.slug) && (
          <a
            href="#leaderboard"
            data-testid="overlay-leaderboard"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className={`text-xs underline decoration-dotted underline-offset-2 transition-colors ${cozy ? 'text-garden-ink-soft hover:text-garden-coral-text' : 'text-fg-muted hover:text-neon-amber'}`}
          >
            🏆 See this week&apos;s leaderboard
          </a>
        )}
        {/* 후원 넛지: RUN 마일스톤(몰입한 유저)에만, 세션당 한 번뿐인 순간이라 부담 없음. */}
        {runMilestone && siteConfig.kofiUrl && (
          <a
            href={siteConfig.kofiUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="overlay-support"
            className="text-xs text-fg-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-neon-magenta"
          >
            ☕ On a roll — support the site?
          </a>
        )}
      </div>
    </div>
  )
}
