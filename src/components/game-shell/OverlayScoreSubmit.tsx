'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { sendHit } from '@/lib/hit'
import { parseRankInfo, rankLine, type RankInfo } from '@/lib/leaderboardOrder'
import {
  LEADERBOARD_GAMES,
  MAX_NAME_LEN,
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
 * 게임오버 오버레이의 신기록 제출. best가 마지막 제출보다 높을 때만 노출.
 * - 이름이 저장돼 있으면 1클릭 버튼(+ 이름 바꾸기 링크).
 * - 이름이 없으면 이름 입력창 + 제출 버튼(리더보드 제출 0건의 원인이 '이름 저장된 사람만 노출'이었음).
 * 하단 Leaderboard 폼과 같은 저장 키(submitted:<slug>)를 써서 중복 제출을 막는다.
 * 입력창의 키 이벤트는 전파를 끊어 window에 붙은 게임 키 핸들러(방향키·스페이스 등)로 새지 않게 한다.
 * 오버레이가 뜨자마자 게임 재시작 키를 삼키지 않도록 자동 포커스는 하지 않는다.
 */
export function OverlayScoreSubmit({ slug, show }: { slug: string; show: boolean }) {
  const [best, setBest] = useState(0)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [rankInfo, setRankInfo] = useState<RankInfo | null>(null)
  const submittedRef = useRef(0)
  const meta = LEADERBOARD_GAMES[slug]

  useEffect(() => {
    if (!show) return
    setState('idle')
    setRankInfo(null)
    const saved = loadPlayerName()
    setName(saved)
    setEditing(!saved.trim())
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
        {rankInfo && (
          <span data-testid="overlay-rank" className="mt-0.5 block text-sm font-bold text-neon-amber">
            {rankLine(rankInfo)}
          </span>
        )}
      </p>
    )
  }

  const trimmed = name.trim()

  async function submit() {
    if (!trimmed || state === 'sending') return
    setState('sending')
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game: slug, name: trimmed, score: best }),
      })
      if (!res.ok) throw new Error('bad')
      const info = parseRankInfo(await res.json().catch(() => null))
      setRankInfo(info)
      if (info) sendHit(slug, 'lb_rank_shown')
      saveSubmittedScore(slug, best)
      savePlayerName(trimmed)
      sendHit(slug, 'lb_submit')
      sendHit(slug, 'lb_submit_overlay')
      setState('done')
    } catch {
      setState('error')
    }
  }

  // 입력 중 키가 게임(window keydown/keyup 리스너)으로 새지 않게 전파 차단.
  // React는 루트 컨테이너에서 위임 처리하므로 여기서 멈추면 document/window까지 버블되지 않는다.
  const stopKeys = (e: KeyboardEvent<HTMLInputElement>) => e.stopPropagation()

  const scale = SCORE_SCALE[slug] ?? 1
  const shown = scale === 1 ? best.toLocaleString() : (best / scale).toFixed(1)
  const error = state === 'error' && (
    <span className="text-xs text-neon-amber">Couldn&apos;t submit — try again in a few seconds.</span>
  )

  if (editing) {
    return (
      <form
        data-testid="overlay-submit-form"
        className="flex w-full max-w-[16rem] flex-col items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <span className="text-xs font-semibold text-neon-cyan">🏆 Your best {shown} — put it on the board</span>
        <div className="flex w-full items-center gap-2">
          <input
            data-testid="overlay-submit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={stopKeys}
            onKeyUp={stopKeys}
            maxLength={MAX_NAME_LEN}
            placeholder="Your name"
            aria-label="Your name for the leaderboard"
            autoComplete="nickname"
            enterKeyHint="send"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface/80 px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:border-neon-cyan focus-visible:outline-none"
          />
          <button
            type="submit"
            data-testid="overlay-submit"
            disabled={state === 'sending' || !trimmed}
            className="btn-press shrink-0 rounded-lg border border-neon-cyan/60 bg-neon-cyan/10 px-3 py-2 text-sm font-semibold text-neon-cyan disabled:opacity-50"
          >
            {state === 'sending' ? '…' : 'Submit'}
          </button>
        </div>
        {error}
      </form>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        data-testid="overlay-submit"
        onClick={submit}
        disabled={state === 'sending'}
        className="btn-press max-w-full truncate rounded-lg border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 text-sm font-semibold text-neon-cyan disabled:opacity-50"
      >
        {state === 'sending' ? '…' : `🏆 Submit ${shown} as ${trimmed}`}
      </button>
      <button
        type="button"
        data-testid="overlay-submit-rename"
        onClick={() => setEditing(true)}
        className="text-xs text-fg-muted underline decoration-dotted underline-offset-2 hover:text-neon-cyan"
      >
        Not {trimmed}? Change name
      </button>
      {error}
    </div>
  )
}
