'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { accentVar, DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { LEADERBOARD_GAMES, type ScoreRow } from '@/lib/leaderboard'
import { gamePages } from '@/lib/games/registry'
import { GameIcon } from '@/components/icons/GameIcon'
import { orderBoards } from '@/lib/leaderboardOrder'
import { isNew } from '@/lib/newGames'
import { sendHit } from '@/lib/hit'

const titleOf = (slug: string) => gamePages.find((g) => g.slug === slug)?.h1 ?? slug

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
  const now = Date.now()

  if (!available) {
    return (
      <p className="mt-6 text-center text-fg-muted">
        Leaderboards are temporarily unavailable. Play a game and try again soon.
      </p>
    )
  }

  return (
    <div>
      {week && (
        <p className="mb-6 text-center font-pixel text-[10px] tracking-[0.2em] text-fg-muted">
          WEEK {week}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(boards === null ? empty : active).map((slug) => {
          const meta = gameMeta[slug] ?? DEFAULT_META
          const color = accentVar(meta.accent)
          const rows = boards?.[slug] ?? []
          return (
            <div
              key={slug}
              style={{ color }}
              className="neon-box rounded-xl border border-border bg-surface/70 p-4"
            >
              <Link
                href={`/${slug}`}
                onClick={() => sendHit('leaderboards', 'lb_hub_card_click')}
                className="mb-3 flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                <span className="neon-icon inline-flex">
                  <GameIcon slug={slug} className="h-6 w-6" />
                </span>
                <span className="neon-text font-bold">{titleOf(slug)}</span>
                {isNew(meta.addedDate, now) && (
                  <span className="rounded-full border border-current px-1.5 py-0.5 text-[9px] font-bold leading-none">NEW</span>
                )}
              </Link>
              <ol className="space-y-1 text-sm text-fg">
                {boards === null ? (
                  <li className="text-fg-muted">Loading…</li>
                ) : rows.length === 0 ? (
                  <li className="text-fg-muted">No scores yet — be the first!</li>
                ) : (
                  rows.map((r, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-5 text-center text-sm" style={{ color }} role="img" aria-label={`Rank ${i + 1}`}>
                          {['🥇', '🥈', '🥉'][i] ?? i + 1}
                        </span>
                        <span className="truncate text-fg">{r.name}</span>
                      </span>
                      <span className="font-bold" style={{ color }}>
                        {r.score.toLocaleString()}
                      </span>
                    </li>
                  ))
                )}
              </ol>
            </div>
          )
        })}
      </div>
      {boards !== null && empty.length > 0 && (
        <details className="mt-6 rounded-xl border border-border bg-surface/50 p-4" data-testid="lb-empty">
          <summary className="cursor-pointer text-sm font-semibold text-fg-muted">
            {empty.length} boards still empty — be the first to claim #1
          </summary>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {empty.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/${slug}`}
                  onClick={() => sendHit('leaderboards', 'lb_hub_card_click')}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="inline-flex" style={{ color: accentVar((gameMeta[slug] ?? DEFAULT_META).accent) }}>
                    <GameIcon slug={slug} className="h-5 w-5" />
                  </span>
                  <span className="truncate">{titleOf(slug)}</span>
                  {isNew(gameMeta[slug]?.addedDate, now) && <span className="text-[9px] font-bold text-neon-amber">NEW</span>}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
