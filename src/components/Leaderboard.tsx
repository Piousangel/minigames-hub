'use client'

import { useCallback, useEffect, useState } from 'react'
import { LEADERBOARD_GAMES, MAX_NAME_LEN, type ScoreRow } from '@/lib/leaderboard'

/**
 * 주간 글로벌 리더보드(게임 페이지). Cloudflare Worker + D1 API 사용.
 * - GET /api/leaderboard?game=slug → 이번 주 톱10
 * - 플레이어의 최고기록(localStorage 'best:slug', 숫자)을 읽어 제출 가능
 * API가 없는 환경(정적 프리뷰/e2e)에서는 조용히 숨김(페이지 안 깨짐).
 */
export function Leaderboard({ slug }: { slug: string }) {
  const meta = LEADERBOARD_GAMES[slug]
  const [rows, setRows] = useState<ScoreRow[] | null>(null)
  const [week, setWeek] = useState('')
  const [available, setAvailable] = useState(true)
  const [best, setBest] = useState(0)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaderboard?game=${encodeURIComponent(slug)}`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new Error('bad')
      const data = (await res.json()) as { week: string; top: ScoreRow[] }
      setRows(data.top)
      setWeek(data.week)
    } catch {
      setAvailable(false)
    }
  }, [slug])

  useEffect(() => {
    load()
    const raw = Number(localStorage.getItem(`best:${slug}`))
    setBest(Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0)
    setName(localStorage.getItem('lb:name') ?? '')
  }, [load, slug])

  async function submit() {
    if (best <= 0 || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game: slug, name, score: best }),
      })
      if (!res.ok) throw new Error('bad')
      const data = (await res.json()) as { week: string; top: ScoreRow[] }
      setRows(data.top)
      setWeek(data.week)
      setSubmitted(true)
      localStorage.setItem('lb:name', name.trim().slice(0, MAX_NAME_LEN))
    } catch {
      /* 무시 */
    } finally {
      setSubmitting(false)
    }
  }

  if (!meta || !available) return null

  const canSubmit = best > 0 && !submitted

  return (
    <section
      aria-labelledby="leaderboard"
      className="mx-auto mt-6 w-full max-w-100"
      style={{ color: 'var(--neon-cyan)' }}
    >
      <div className="mb-3 flex items-center gap-3">
        <h2 id="leaderboard" className="neon-text text-sm font-bold uppercase tracking-[0.15em]">
          Weekly Top 10
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-neon-cyan/50 to-transparent" />
        {week && <span className="font-pixel text-[9px] text-fg-muted">{week}</span>}
      </div>

      <ol className="overflow-hidden rounded-xl border border-border bg-surface/60 text-sm text-fg">
        {rows === null ? (
          <li className="px-4 py-3 text-fg-muted">Loading…</li>
        ) : rows.length === 0 ? (
          <li className="px-4 py-3 text-fg-muted">No scores yet this week — be the first!</li>
        ) : (
          rows.map((r, i) => (
            <li
              key={i}
              className="flex items-center justify-between border-b border-border/50 px-4 py-2 last:border-b-0"
            >
              <span className="flex items-center gap-3">
                <span className="font-pixel w-6 text-[10px] text-neon-cyan">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="truncate">{r.name}</span>
              </span>
              <span className="font-bold text-neon-cyan">{r.score.toLocaleString()}</span>
            </li>
          ))
        )}
      </ol>

      {canSubmit ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LEN}
            placeholder="Your name"
            aria-label="Your name for the leaderboard"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface/80 px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:border-neon-cyan focus-visible:outline-none"
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="btn-press rounded-lg border border-neon-cyan/60 bg-neon-cyan/10 px-3 py-2 text-sm font-semibold text-neon-cyan disabled:opacity-50"
          >
            {submitting ? '…' : `Submit ${meta.label} ${best.toLocaleString()}`}
          </button>
        </div>
      ) : submitted ? (
        <p className="mt-3 text-center text-xs text-neon-lime">Submitted! Beat your best to climb higher.</p>
      ) : (
        <p className="mt-3 text-center text-xs text-fg-muted">
          Play to set a {meta.label.toLowerCase()}, then submit it to the board.
        </p>
      )}
    </section>
  )
}
