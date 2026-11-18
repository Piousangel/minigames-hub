'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { gamePages } from '@/lib/games/registry'
import { gameMeta, DEFAULT_META } from '@/lib/games/gameMeta'
import { sendHit } from '@/lib/hit'
import { useGameNav } from '@/components/GameNav'
import type { NextPick } from '@/lib/games/nextGame'

/**
 * 보드 아래 "Play next" 레일(연결 고리 #3, docs/team/specs/2026-11-18-next-game-rail.md):
 * 같은 장르 1 + 다른 입력 1, 정적 카드 2장. 광고·자동 이동·새 탭 없음. 오버레이는 건드리지 않는다.
 * 노출(next_seen)은 레일이 화면에 절반 이상 보인 첫 순간 1회(종료와 무관 — 레일 카드 클릭률의
 * 분모는 next_show가 아니라 next_seen이다. 오버레이 버튼 클릭률의 분모가 next_show).
 */
export function NextRail() {
  const { slug, picks, runCount } = useGameNav()
  const ref = useRef<HTMLElement>(null)
  const ready = !!(picks.same || picks.diff)

  useEffect(() => {
    const el = ref.current
    if (!el || !ready || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          sendHit(slug, 'next_seen')
          io.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [slug, ready])

  // 하이드레이션 전(runCount 0)엔 자리만 잡아 레이아웃 밀림(CLS)을 막고, 추천이 없으면 그리지 않는다.
  if (!ready) {
    return runCount === 0 ? <div aria-hidden="true" data-testid="next-rail-reserve" className="mt-6 min-h-[150px] sm:min-h-[96px]" /> : null
  }
  const card = (pick: NextPick | null, kind: 'same' | 'diff') => {
    if (!pick) return null
    const page = gamePages.find((p) => p.slug === pick.slug)
    if (!page) return null
    const m = gameMeta[pick.slug] ?? DEFAULT_META
    return (
      <Link
        key={kind}
        href={`/${pick.slug}?ref=next`}
        onClick={() => sendHit(slug, kind === 'same' ? 'next_same' : 'next_diff')}
        data-testid={`next-rail-${kind}`}
        aria-label={`${page.h1}, ${pick.original ? 'Original, ' : ''}${pick.reason}`}
        className="flex min-h-[64px] items-center gap-3 rounded-xl border border-neon-lime/30 bg-surface px-3 py-2 transition-colors hover:border-neon-lime/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-lime"
      >
        <span aria-hidden="true" className="text-2xl">{m.icon}</span>
        <span className="min-w-0">
          <span className="block break-words text-sm font-bold text-fg">{page.h1}</span>
          <span className="block break-words text-xs text-fg-muted">
            {pick.original && <span className="font-semibold text-neon-amber">★ Original · </span>}
            {pick.reason}
          </span>
        </span>
      </Link>
    )
  }

  return (
    <section ref={ref} aria-label="Next game" data-testid="next-rail" className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold uppercase tracking-[0.15em] text-neon-lime">Play next</span>
        {runCount > 1 && (
          <span
            className="rounded-full border border-neon-lime/40 bg-surface px-3 py-1 text-xs font-bold text-neon-lime"
            data-testid="run-count"
          >
            RUN ×{runCount}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {card(picks.same, 'same')}
        {card(picks.diff, 'diff')}
      </div>
    </section>
  )
}
