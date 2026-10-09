'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LEADERBOARD_GAMES,
  MAX_NAME_LEN,
  SCORE_SCALE,
  loadPlayerName,
  savePlayerName,
  type ScoreRow,
} from '@/lib/leaderboard'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'

/**
 * 주간 글로벌 리더보드(게임 페이지). Cloudflare Worker + D1 API 사용.
 * - GET /api/leaderboard?game=slug → 이번 주 톱10
 * - 플레이어의 최고기록(localStorage 'best:slug', 숫자)을 읽어 제출 가능
 * API가 없는 환경(정적 프리뷰/e2e)에서는 조용히 숨김(페이지 안 깨짐).
 */
export function Leaderboard({ slug }: { slug: string }) {
  const meta = LEADERBOARD_GAMES[slug]
  const scale = SCORE_SCALE[slug] ?? 1
  const fmt = (score: number) => (scale === 1 ? score.toLocaleString() : (score / scale).toFixed(1))
  const [rows, setRows] = useState<ScoreRow[] | null>(null)
  const [week, setWeek] = useState('')
  const [available, setAvailable] = useState(true)
  const [best, setBest] = useState(0)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [slowDown, setSlowDown] = useState(false) // 429(IP 쿨다운) — 조용히 실패하지 않게 안내
  const [shared, setShared] = useState(false)
  const submittedRef = useRef(0) // 마지막으로 제출한 점수 — 이보다 높아졌을 때만 재제출 허용

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

  // best:<slug>는 게임 쪽에서 갱신되므로, 마운트 때 한 번만 읽으면 이번 세션에 낸
  // 신기록을 놓친다(첫 방문자는 best=0 → 제출 폼이 아예 안 뜬다). 1초 폴링으로
  // 따라잡되, 동등성 가드로 값이 바뀔 때만 리렌더한다.
  useEffect(() => {
    load()
    setName(loadPlayerName())
    submittedRef.current = 0 // 새 게임(slug) 진입 시 제출 허용 초기화
    const readBest = () => {
      const raw = Number(localStorage.getItem(`best:${slug}`))
      const v = Number.isFinite(raw) && raw > 0 ? Math.floor(raw * scale) : 0
      setBest((prev) => (prev === v ? prev : v))
      if (v > submittedRef.current) setSubmitted(false) // 기록을 갱신했을 때만 다시 제출 가능
    }
    readBest()
    const id = setInterval(readBest, 1000)
    return () => clearInterval(id)
  }, [load, slug, scale])

  async function submit() {
    if (best <= 0 || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game: slug, name, score: best }),
      })
      setSlowDown(res.status === 429)
      if (!res.ok) throw new Error('bad')
      const data = (await res.json()) as { week: string; top: ScoreRow[] }
      setRows(data.top)
      setWeek(data.week)
      setSubmitted(true)
      submittedRef.current = best // 이 점수는 제출됨 — 더 높은 기록이 나와야 재제출 허용
      savePlayerName(name)
    } catch {
      /* 무시 */
    } finally {
      setSubmitting(false)
    }
  }

  async function share() {
    if (best <= 0) return
    const title = gamePages.find((g) => g.slug === slug)?.h1 ?? slug
    const url = `${location.origin}/${slug}`
    const text = `I scored ${fmt(best)} ${meta!.label} in ${title} on ${siteConfig.name}! Can you beat it? 🎮`
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} — ${siteConfig.name}`, text, url })
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`)
        setShared(true)
      }
    } catch {
      /* 취소/불가 무시 */
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
              <span className="font-bold text-neon-cyan">{fmt(r.score)}</span>
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
            {submitting ? '…' : `Submit ${meta.label} ${fmt(best)}`}
          </button>
        </div>
      ) : null}
      {canSubmit && slowDown && (
        <p className="mt-2 text-center text-xs text-neon-amber">
          Too many submits from your network — try again in a few seconds.
        </p>
      )}
      {canSubmit ? null : submitted ? (
        <p className="mt-3 text-center text-xs text-neon-lime">Submitted! Beat your best to climb higher.</p>
      ) : (
        <p className="mt-3 text-center text-xs text-fg-muted">
          Play to set a {meta.label.toLowerCase()}, then submit it to the board.
        </p>
      )}

      {best > 0 && (
        <div className="mt-2 text-center">
          <button
            onClick={share}
            className="btn-press rounded-lg border border-neon-magenta/50 px-3 py-1.5 text-xs font-semibold text-neon-magenta hover:bg-neon-magenta/10"
          >
            {shared ? 'Link copied!' : `📣 Share your ${meta.label.toLowerCase()}`}
          </button>
        </div>
      )}
    </section>
  )
}
