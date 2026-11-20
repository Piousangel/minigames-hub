'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { LEADERBOARD_GAMES, formatBoardScore, type ScoreRow } from '@/lib/leaderboard'
import { gamePages } from '@/lib/games/registry'
import { GameIcon } from '@/components/icons/GameIcon'
import { NewBadge } from '@/components/NewBadge'
import { CATEGORY_TINT } from '@/components/home/SeedCard'
import { RankMedal } from '@/components/leaderboard/RankMedal'
import { orderBoards } from '@/lib/leaderboardOrder'
import { weekLabel } from '@/lib/leaderboardWeek'
import { sendHit } from '@/lib/hit'

const titleOf = (slug: string) => gamePages.find((g) => g.slug === slug)?.h1 ?? slug
/** 허브는 게임별 Top 3(`/api/leaderboards`). 카드마다 3칸을 늘 그려 높이가 같다(빈 칸 = Open spot, 로딩 = 막대). */
const PODIUM = 3

const ring =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-cream'

/**
 * /leaderboards 본문(리디자인 v2 — 정원 틀). 데이터·API·정렬·점수 형식은 예전 그대로, 겉모습만 바뀌었다.
 * - 카드 = '연감 한 쪽': 크림 종이·2px ink 윤곽·판 그림자, 윗단 띠와 아이콘 disc는 카테고리 꽃색 4종(CATEGORY_TINT)만.
 *   예전 게임별 랜덤 네온 accent·neon-box·픽셀 폰트는 쓰지 않는다.
 * - 1~3위 = 벡터 메달(RankMedal, 이모지 없음). 점수 tabular-nums.
 * - 주 표기 = "This week · Nov 16–22"(서버 ISO 주 → UTC 월~일).
 * - 로딩 중에도 모든 보드 카드를 같은 높이로 그려(제목·링크는 정적 HTML에 남는다) 데이터가 와도 자리가 흔들리지 않는다.
 */
export function LeaderboardsHub() {
  const [boards, setBoards] = useState<Record<string, ScoreRow[]> | null>(null)
  const [week, setWeek] = useState('')
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    sendHit('leaderboards', 'lb_board_view') // 로드 성공 여부와 무관하게 방문 1회
    fetch('/api/leaderboards', { headers: { accept: 'application/json' } })
      .then((r) => {
        if (!r.ok) throw new Error('bad')
        return r.json() as Promise<{ week: string; boards: Record<string, ScoreRow[]> }>
      })
      .then((d) => {
        setBoards(d.boards)
        setWeek(d.week)
      })
      .catch(() => setAvailable(false))
  }, [])

  const slugs = Object.keys(LEADERBOARD_GAMES)
  // 최신 게임 순. 점수가 있는 보드가 먼저, 빈 보드는 아래에 접는다(로딩 중엔 전부 빈 것으로 취급해 순서만 유지).
  const { active, empty } = orderBoards(slugs, boards, gameMeta)
  const label = week ? weekLabel(week, new Date()) : null

  if (!available) {
    return (
      // 로딩 카드(85장)가 줄어든 뒤에도 아래 설명이 첫 화면으로 끌려오지 않게 같은 최소 높이(CLS)
      <div className="min-h-[100svh]">
        <div
          data-testid="lb-unavailable"
          className="mx-auto mt-2 max-w-md rounded-[18px] border-2 border-garden-ink bg-garden-cream px-5 py-6 text-center shadow-[var(--garden-highlight),var(--garden-shadow-seed)]"
        >
          <p className="font-display text-[20px] leading-7 font-semibold">The scoreboard is resting</p>
          <p className="mt-2 text-[15px] leading-6 text-garden-ink-deep">
            Leaderboards are temporarily unavailable. Play a game and check back soon.
          </p>
          <Link
            href="/#all-games"
            className={`mt-4 inline-flex h-11 items-center rounded-full border-2 border-garden-ink bg-garden-cream-2 px-4 text-[14px] font-semibold ${ring}`}
          >
            Browse all games
          </Link>
        </div>
      </div>
    )
  }

  // 기록이 하나도 없는 주: 카드 대신 펼친 목록 하나(85장 빈 카드는 390에서 19,000px). 허브 최소 높이 덕에 줄어도 CLS 없음
  const weekEmpty = boards !== null && active.length === 0
  const shown = boards === null ? empty : active
  const isCurrent = label?.startsWith('This week') ?? false

  return (
    // 최소 한 화면 높이: 보드가 적은 주에도 데이터가 온 뒤 아래 설명·FAQ가 첫 화면으로 끌려 올라오지 않는다(CLS)
    <div className="min-h-[100svh]">
      {/* 주 라벨 — 데이터가 오기 전에도 같은 높이(56px, 두 줄 고정)를 잡아 둔다(CLS 0) */}
      <p data-testid="lb-week" className="mb-7 flex h-14 flex-col items-center justify-center gap-1 text-center text-[13px] leading-5">
        {label && (
          <span className="whitespace-nowrap rounded-full border-2 border-garden-ink bg-garden-cream-2 px-3 leading-6 font-semibold tabular-nums">
            {label}
          </span>
        )}
        {weekEmpty ? (
          <span data-testid="lb-empty-week" className="text-garden-ink-deep">
            No scores yet — the first score on any board takes #1.
          </span>
        ) : label ? (
          <span className="text-garden-ink-soft">{isCurrent ? 'New boards Monday, 00:00 UTC' : 'Refreshing for the new week…'}</span>
        ) : null}
      </p>
      {/* 로딩 알림은 한 곳만(카드마다 두면 85번 읽힌다) */}
      <p role="status" className="sr-only">
        {boards === null ? 'Loading scores…' : ''}
      </p>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="lb-boards" aria-busy={boards === null}>
        {/* li key = 자리 번호(slug key면 화면 밖 카드가 위로 '이동'해 CLS로 잡힌다), 카드 key = slug(다른 게임이 되면 새로 마운트 —
            링크 포커스·NewBadge 상태가 이전 게임 것으로 남지 않게. 새 노드는 layout shift로 세지 않는다) */}
        {shown.map((slug, i) => (
          <li key={i}>
            <BoardCard key={slug} slug={slug} rows={boards === null ? null : (boards[slug] ?? [])} />
          </li>
        ))}
      </ul>
      {boards !== null && empty.length > 0 && (
        <details
          open={weekEmpty || undefined}
          className="group mt-8 rounded-[18px] border-2 border-garden-ink bg-garden-cream shadow-[var(--garden-highlight),var(--garden-shadow-seed)]"
          data-testid="lb-empty"
        >
          <summary
            className={`flex min-h-12 cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden gap-2 rounded-[16px] px-4 py-2 text-[15px] font-semibold ${ring}`}
          >
            <svg aria-hidden="true" viewBox="0 0 12 12" width={12} height={12} className="shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none">
              <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {weekEmpty ? `All ${empty.length} boards are open — be the first to claim #1` : `${empty.length} boards still empty — be the first to claim #1`}
          </summary>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-1 border-t-2 border-dashed border-garden-ink/25 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
            {empty.map((slug) => {
              const tint = CATEGORY_TINT[(gameMeta[slug] ?? DEFAULT_META).category]
              return (
                <li key={slug}>
                  <Link
                    href={`/${slug}`}
                    onClick={() => sendHit('leaderboards', 'lb_hub_card_click')}
                    className={`flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1 text-[15px] hover:bg-garden-cream-2 ${ring}`}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-garden-ink"
                      style={{ background: tint.wash }}
                    >
                      <GameIcon slug={slug} className="h-4 w-4" />
                    </span>
                    <span className="truncate">{titleOf(slug)}</span>
                    <NewBadge slug={slug} variant="garden" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </div>
  )
}

/** 게임 하나의 주간 Top 3 카드. rows = null이면 로딩. */
function BoardCard({ slug, rows }: { slug: string; rows: ScoreRow[] | null }) {
  const meta = gameMeta[slug] ?? DEFAULT_META
  const tint = CATEGORY_TINT[meta.category]
  const unit = LEADERBOARD_GAMES[slug]?.label
  const title = titleOf(slug)
  return (
    <article
      data-testid="lb-board"
      data-slug={slug}
      className="relative h-full overflow-hidden rounded-[18px] border-2 border-garden-ink bg-garden-cream shadow-[var(--garden-highlight),var(--garden-shadow-seed)]"
    >
      {/* 윗단 꽃색 띠(카테고리) */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-2 border-b-[1.5px] border-garden-ink" style={{ background: tint.flower }} />
      <Link
        href={`/${slug}`}
        onClick={() => sendHit('leaderboards', 'lb_hub_card_click')}
        className={`mx-2 mt-3.5 flex min-h-12 items-center gap-2.5 rounded-xl px-2 py-1 ${ring}`}
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-garden-ink"
          style={{ background: tint.wash }}
        >
          <GameIcon slug={slug} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <h2 className="font-display truncate text-[18px] leading-6 font-semibold tracking-[-0.01em]">{title}</h2>
          <span className="block text-[12px] leading-4 text-garden-ink-soft">
            {meta.category} · top 3{unit && unit !== 'Score' ? ` · ${unit}` : ''}
          </span>
        </span>
        <NewBadge slug={slug} variant="garden" />
      </Link>
      <ol className="mx-4 mt-2 mb-3 border-t-2 border-garden-ink/80" aria-label={`${title} top scores this week`}>
        {Array.from({ length: PODIUM }, (_, i) => {
          const r = rows?.[i]
          return (
            <li key={i} className="flex h-10 items-center gap-2.5 border-b border-dashed border-garden-ink/25 last:border-b-0">
              {rows === null ? (
                // 로딩: 같은 높이의 막대(글자 없음)
                <>
                  <span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-full bg-garden-cream-2" />
                  <span aria-hidden="true" className="h-[22px] flex-1 rounded-full bg-garden-cream-2 bg-clip-content py-[5px]" />
                </>
              ) : r ? (
                <>
                  <RankMedal rank={i + 1} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.name}</span>
                  <span className="shrink-0 text-[15px] font-bold tabular-nums">{formatBoardScore(slug, r.score)}</span>
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="inline-flex shrink-0 opacity-40">
                    <RankMedal rank={i + 1} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-garden-ink-soft">
                    <span className="sr-only">{['1st', '2nd', '3rd'][i]} place: </span>
                    {i === 0 ? 'No scores yet — be the first!' : 'Open spot'}
                  </span>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </article>
  )
}
