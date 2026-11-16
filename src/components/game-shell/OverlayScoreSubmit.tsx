'use client'

import { useEffect, useRef, useState } from 'react'
import { sendHit } from '@/lib/hit'
import {
  LEADERBOARD_GAMES,
  SCORE_SCALE,
  loadPlayerName,
  loadSubmittedScore,
  saveSubmittedScore,
  savePlayerName,
} from '@/lib/leaderboard'

/** best:<slug>(게임이 쓰는 숫자)를 리더보드 정수 점수로. 없거나 0이면 0. */
export function readBestScore(slug: string): number {
  try {
    const raw = Number(localStorage.getItem(`best:${slug}`))
    const scale = SCORE_SCALE[slug] ?? 1
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw * scale) : 0
  } catch {
    return 0
  }
}

/**
 * 게임오버 오버레이의 1클릭 제출. 저장된 이름이 있고 best가 마지막 제출보다 높을 때만 노출.
 * 하단 Leaderboard 폼과 같은 저장 키(submitted:<slug>)를 써서 중복 제출을 막는다.
 * 이름이 없으면 안내만 하고 하단 폼으로 보낸다(오버레이에 입력창을 두지 않음 — 게임 키 입력 가로채기 방지).
 */
export function OverlayScoreSubmit({ slug, show }: { slug: string; show: boolean }) {
  const [best, setBest] = useState(0)
  const [name, setName] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const submittedRef = useRef(0)
  const meta = LEADERBOARD_GAMES[slug]

  useEffect(() => {
    if (!show) return
    setState('idle')
    setName(loadPlayerName())
    submittedRef.current = loadSubmittedScore(slug)
    // 게임이 best를 오버레이와 같은 틱에 쓰지 않는 경우가 있어 잠시 뒤 한 번 더 읽는다.
    const read = () => setBest(readBestScore(slug))
    read()
    const t = setTimeout(read, 600)
    return () => clearTimeout(t)
  }, [show, slug])

  if (!show || !meta || best <= 0) return null
  const fresh = best > submittedRef.current && state !== 'done'
  if (!fresh && state !== 'done') return null
  if (state === 'done') {
    return (
      <p data-testid="overlay-submit-done" className="text-xs font-semibold text-neon-lime">
        ✓ Submitted to this week&apos;s board
      </p>
    )
  }
  if (!name.trim()) return null // 이름 미설정 → 기존 하단 폼 안내만

  async function submit() {
    setState('sending')
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game: slug, name, score: best }),
      })
      if (!res.ok) throw new Error('bad')
      saveSubmittedScore(slug, best)
      savePlayerName(name)
      sendHit(slug, 'lb_submit')
      sendHit(slug, 'lb_submit_overlay')
      setState('done')
    } catch {
      setState('error')
    }
  }

  const scale = SCORE_SCALE[slug] ?? 1
  const shown = scale === 1 ? best.toLocaleString() : (best / scale).toFixed(1)
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        data-testid="overlay-submit"
        onClick={submit}
        disabled={state === 'sending'}
        className="btn-press rounded-lg border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 text-sm font-semibold text-neon-cyan disabled:opacity-50"
      >
        {state === 'sending' ? '…' : `🏆 Submit ${shown} as ${name.trim()}`}
      </button>
      {state === 'error' && (
        <span className="text-xs text-neon-amber">Couldn&apos;t submit — try again in a few seconds.</span>
      )}
    </div>
  )
}
