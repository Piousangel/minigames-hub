'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { sendHit } from '@/lib/hit'
import { parseRankInfo, rankLine, type RankInfo } from '@/lib/leaderboardOrder'
import {
  LEADERBOARD_GAMES,
  MAX_NAME_LEN,
  SCORE_SCALE,
  formatBoardScore,
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
/**
 * 검증 제출(선택): 게임이 점수 대신 증거를 서버에 보내는 경우(말랑 미끄럼길 /api/slime/submit).
 * - score: best:<slug> 대신 보여 주고 제출할 점수(예: 오늘 합계)
 * - key: 중복 제출 방지 키(기본 slug, 예: 'slime-slide:2026-11-20' → 날마다 따로)
 * - request: 이름을 받아 보낼 요청. null이면 기본 /api/score 경로.
 * 응답의 submitted.score(서버가 다시 계산한 점수)가 있으면 그 값을 저장한다.
 */
export interface VerifiedSubmit {
  score: number
  key: string
  request: (name: string) => { url: string; body: unknown } | null
}

/** 글자·버튼 색. 'garden' = 크림 결과 시트(R5) 위에서 대비 AA(네온 cyan은 크림에서 1.6:1). 동작은 같다. */
const TONE = {
  neon: {
    done: 'text-neon-lime',
    rank: 'text-neon-amber',
    error: 'text-neon-amber',
    hint: 'text-neon-cyan',
    input: 'border-border bg-surface/80 text-fg placeholder:text-fg-muted focus-visible:border-neon-cyan',
    btn: 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan',
    link: 'text-fg-muted hover:text-neon-cyan',
  },
  garden: {
    done: 'text-garden-leaf-text',
    rank: 'text-garden-coral-text',
    error: 'text-garden-danger-text',
    hint: 'text-garden-ink',
    input: 'border-2 border-garden-ink bg-garden-cream-2 text-garden-ink placeholder:text-garden-ink-soft focus-visible:ring-2 focus-visible:ring-garden-ink',
    btn: 'border-2 border-garden-ink bg-garden-cream-2 text-garden-ink min-h-11',
    link: 'min-h-11 text-garden-ink-soft hover:text-garden-coral-text',
  },
} as const

export function OverlayScoreSubmit({ slug, show, verified, tone = 'neon' }: { slug: string; show: boolean; verified?: VerifiedSubmit; tone?: 'neon' | 'garden' }) {
  const c = TONE[tone]
  const [best, setBest] = useState(0)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [rankInfo, setRankInfo] = useState<RankInfo | null>(null)
  const submittedRef = useRef(0)
  const meta = LEADERBOARD_GAMES[slug]
  const verifiedKey = verified?.key
  const verifiedScore = verified?.score

  useEffect(() => {
    if (!show) return
    setState('idle')
    setRankInfo(null)
    const saved = loadPlayerName()
    setName(saved)
    setEditing(!saved.trim())
    submittedRef.current = loadSubmittedScore(verifiedKey ?? slug)
    if (verifiedScore != null) {
      setBest(verifiedScore)
      return
    }
    // 게임이 best를 오버레이와 같은 틱에 쓰지 않는 경우가 있어 잠시 뒤 한 번 더 읽는다.
    const read = () => setBest(readBestScore(slug))
    read()
    const t = setTimeout(read, 600)
    return () => clearTimeout(t)
  }, [show, slug, verifiedKey, verifiedScore])

  if (!show || !meta || best <= 0) return null
  const fresh = best > submittedRef.current && state !== 'done'
  if (!fresh && state !== 'done') return null
  if (state === 'done') {
    return (
      <p data-testid="overlay-submit-done" className={`text-xs font-semibold ${c.done}`}>
        ✓ Submitted to this week&apos;s board
        {rankInfo && (
          <span data-testid="overlay-rank" className={`mt-0.5 block text-sm font-bold ${c.rank}`}>
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
      const custom = verified?.request(trimmed) ?? null
      const res = await fetch(custom?.url ?? '/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(custom ? custom.body : { game: slug, name: trimmed, score: best }),
      })
      if (!res.ok) throw new Error('bad')
      const data = (await res.json().catch(() => null)) as { submitted?: { score?: unknown } } | null
      const info = parseRankInfo(data)
      setRankInfo(info)
      if (info) sendHit(slug, 'lb_rank_shown')
      const serverScore = Number(data?.submitted?.score)
      // 서버가 다시 계산한 점수가 다르면(검증 제출) 그 값을 제출 기록으로 — 같은 판을 다시 내밀지 않게 큰 쪽을 저장
      saveSubmittedScore(verified?.key ?? slug, Number.isFinite(serverScore) && serverScore > 0 ? Math.max(best, serverScore) : best)
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

  const shown = formatBoardScore(slug, best)
  const error = state === 'error' && (
    <span className={`text-xs ${c.error}`}>Couldn&apos;t submit — try again in a few seconds.</span>
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
        <span className={`text-xs font-semibold ${c.hint}`}>🏆 Your best {shown} — put it on the board</span>
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
            className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none ${c.input}`}
          />
          <button
            type="submit"
            data-testid="overlay-submit"
            disabled={state === 'sending' || !trimmed}
            className={`btn-press shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${c.btn}`}
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
        className={`btn-press max-w-full truncate rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${c.btn}`}
      >
        {state === 'sending' ? '…' : `🏆 Submit ${shown} as ${trimmed}`}
      </button>
      <button
        type="button"
        data-testid="overlay-submit-rename"
        onClick={() => setEditing(true)}
        className={`text-xs underline decoration-dotted underline-offset-2 ${c.link}`}
      >
        Not {trimmed}? Change name
      </button>
      {error}
    </div>
  )
}
