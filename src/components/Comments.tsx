'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { MAX_COMMENT_LEN, type CommentRow } from '@/lib/comments'
import { MAX_NAME_LEN } from '@/lib/leaderboard'

/**
 * 게임별 익명 댓글(design doc Approach A, 2026-08-10) — 계정 불필요, 즉시공개. 리액션과
 * 마찬가지로 리더보드 유무와 무관하게 전 게임 공용. API 없는 환경(정적 프리뷰/e2e)에서는
 * 조용히 숨김(페이지 안 깨짐).
 */
export function Comments({ slug }: { slug: string }) {
  const [comments, setComments] = useState<CommentRow[] | null>(null)
  const [available, setAvailable] = useState(true)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [hp, setHp] = useState('') // 허니팟 — 사람은 안 채움, 봇은 자동으로 채움
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/comments?game=${encodeURIComponent(slug)}`, {
      headers: { accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('bad')
        return res.json() as Promise<{ comments: CommentRow[] }>
      })
      .then((data) => setComments(data.comments))
      .catch(() => setAvailable(false))
    setName(localStorage.getItem('lb:name') ?? '')
  }, [slug])

  if (!available || comments === null) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (trimmed.length === 0 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/comment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game: slug, name, text: trimmed, hp }),
      })
      if (res.status === 429) {
        setError('One comment at a time — try again in a bit.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error === 'links not allowed' ? 'Links aren’t allowed in comments.' : 'Could not post — try again.')
        return
      }
      const data = (await res.json()) as { comments: CommentRow[] }
      setComments(data.comments)
      setText('')
      if (name.trim()) localStorage.setItem('lb:name', name.trim().slice(0, MAX_NAME_LEN))
    } catch {
      setError('Could not post — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      data-testid="comments"
      aria-labelledby="comments-heading"
      className="mx-auto mt-6 w-full max-w-100"
      style={{ color: 'var(--neon-lime)' }}
    >
      <div className="mb-3 flex items-center gap-3">
        <h2 id="comments-heading" className="neon-text text-sm font-bold uppercase tracking-[0.15em]">
          Comments
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-neon-lime/50 to-transparent" />
      </div>

      <form onSubmit={submit} className="mb-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LEN}
            placeholder="Name (optional)"
            aria-label="Your name"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface/80 px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:border-neon-lime focus-visible:outline-none"
          />
        </div>
        {/* 허니팟 — 시각적으로 숨기되 스크린리더에도 안 읽히게, 봇만 채우도록. */}
        <input
          type="text"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          className="sr-only"
        />
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_COMMENT_LEN}
            rows={2}
            placeholder="Say something about this game…"
            aria-label="Your comment"
            className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-surface/80 px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:border-neon-lime focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={submitting || text.trim().length === 0}
            className="btn-press rounded-lg border border-neon-lime/60 bg-neon-lime/10 px-3 py-2 text-sm font-semibold text-neon-lime disabled:opacity-50"
          >
            {submitting ? '…' : 'Post'}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-neon-red">
            {error}
          </p>
        )}
      </form>

      <ol className="flex flex-col gap-2">
        {comments.length === 0 ? (
          <li className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-fg-muted">
            No comments yet — be the first!
          </li>
        ) : (
          comments.map((c, i) => (
            <li key={i} className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm">
              <span className="font-semibold text-neon-lime">{c.name}</span>{' '}
              <span className="text-fg">{c.text}</span>
            </li>
          ))
        )}
      </ol>
    </section>
  )
}
