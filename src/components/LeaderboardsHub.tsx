'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { accentVar, DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { LEADERBOARD_GAMES, type ScoreRow } from '@/lib/leaderboard'
import { gamePages } from '@/lib/games/registry'
import { GameIcon } from '@/components/icons/GameIcon'

const titleOf = (slug: string) => gamePages.find((g) => g.slug === slug)?.h1 ?? slug

export function LeaderboardsHub() {
  const [boards, setBoards] = useState<Record<string, ScoreRow[]> | null>(null)
  const [week, setWeek] = useState('')
  const [available, setAvailable] = useState(true)

  useEffect(() => {
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
        {slugs.map((slug) => {
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
                className="mb-3 flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                <span className="neon-icon inline-flex">
                  <GameIcon slug={slug} className="h-6 w-6" />
                </span>
                <span className="neon-text font-bold">{titleOf(slug)}</span>
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
                        <span className="font-pixel w-5 text-[9px]" style={{ color }}>
                          {i + 1}
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
    </div>
  )
}
