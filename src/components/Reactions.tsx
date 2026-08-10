'use client'

import { useEffect, useState } from 'react'
import {
  REACTIONS,
  hasReacted,
  markReacted,
  type Reaction,
  type ReactionCounts,
} from '@/lib/reactions'
import { sendHit } from '@/lib/hit'

/**
 * 게임별 이모지 리액션(무계정, UGC 없음) — "다른 사람도 왔었다"는 흔적을 남겨 재방문 동기를
 * 만든다(design doc: 사이트 내장 커뮤니티 v1, 2026-08-10). 전 게임 공용, 리더보드 유무와
 * 무관하게 항상 뜬다. API 없는 환경(정적 프리뷰/e2e)에서는 조용히 숨김(페이지 안 깨짐).
 */
export function Reactions({ slug }: { slug: string }) {
  const [counts, setCounts] = useState<ReactionCounts | null>(null)
  const [reacted, setReacted] = useState<Partial<Record<Reaction, boolean>>>({})
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/reactions?game=${encodeURIComponent(slug)}`, {
      headers: { accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('bad')
        return res.json() as Promise<{ counts: ReactionCounts }>
      })
      .then((data) => {
        if (!cancelled) setCounts(data.counts)
      })
      .catch(() => {
        if (!cancelled) setAvailable(false)
      })
    setReacted(Object.fromEntries(REACTIONS.map((r) => [r, hasReacted(slug, r)])))
    return () => {
      cancelled = true
    }
  }, [slug])

  if (!available || counts === null) return null

  function react(emoji: Reaction) {
    if (reacted[emoji]) return
    markReacted(slug, emoji)
    setReacted((prev) => ({ ...prev, [emoji]: true }))
    setCounts((prev) => (prev ? { ...prev, [emoji]: prev[emoji] + 1 } : prev))
    sendHit(slug, 'reaction')
    fetch('/api/reaction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: slug, emoji }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('bad')
        return res.json() as Promise<{ counts: ReactionCounts }>
      })
      .then((data) => setCounts(data.counts))
      .catch(() => {
        // 실패해도 롤백 안 함 — dedup 플래그는 이미 남았고(재시도해도 서버가 카운트 안 함),
        // 낙관적 카운트를 되돌리면 "방금 눌렀는데 왜 취소됐지"라는 혼란만 더한다.
      })
  }

  return (
    <div data-testid="reactions" className="mx-auto mt-4 flex w-full max-w-100 flex-col items-center gap-2">
      <span
        aria-hidden="true"
        className="font-pixel text-[9px] uppercase tracking-[0.2em] text-neon-cyan"
      >
        How was it?
      </span>
      <div className="flex items-center justify-center gap-2.5">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => react(emoji)}
            disabled={reacted[emoji]}
            aria-pressed={!!reacted[emoji]}
            aria-label={`React with ${emoji}`}
            className={`btn-press flex flex-col items-center gap-0.5 rounded-2xl border-2 px-4 py-2.5 transition-colors ${
              reacted[emoji]
                ? 'border-neon-cyan bg-neon-cyan/15'
                : 'border-neon-cyan/40 bg-neon-cyan/5 hover:border-neon-cyan hover:bg-neon-cyan/10'
            }`}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              {emoji}
            </span>
            <span className="text-xs font-bold tabular-nums text-neon-cyan">{counts[emoji]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
