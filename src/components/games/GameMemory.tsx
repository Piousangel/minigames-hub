'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearMismatch,
  flip,
  newMemoryGame,
  PERFECT_MOVES,
  winSummary,
  type MemoryState,
  type WinSummary,
} from '@/lib/games/memory/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const MISMATCH_MS = 900
/** 판 중간 New Game 뒤 Undo를 보여 주는 시간(체크리스트 8번: 판을 지우는 버튼은 되돌릴 수 있게). */
const UNDO_MS = 6000

const countMatched = (s: MemoryState) => s.cards.reduce((n, c) => n + (c.matched ? 1 : 0), 0)

/** 맞힘·틀림 진동. 음소거·미지원 환경에서는 아무것도 하지 않는다(2048과 같은 규칙). */
function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    navigator.vibrate(pattern)
  } catch {
    // 사용자 제스처 밖 호출·권한 정책으로 throw하는 브라우저가 있다 — 무시
  }
}

/** 카드 뒷면 무늬: 정원 꽃(이모지·물음표 대신). 장식이라 aria-hidden. */
function FlowerBack() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-[42%] w-[42%]">
      <g fill="currentColor" opacity="0.9">
        <ellipse cx="16" cy="8.5" rx="4.6" ry="6.5" />
        <ellipse cx="16" cy="23.5" rx="4.6" ry="6.5" />
        <ellipse cx="8.5" cy="16" rx="6.5" ry="4.6" />
        <ellipse cx="23.5" cy="16" rx="6.5" ry="4.6" />
      </g>
      <circle cx="16" cy="16" r="4.2" fill="var(--garden-sunflower)" />
    </svg>
  )
}

/** 결과 화면 한두 줄: 이번 기록 vs 이전 최고, 다음 목표(완벽 = 쌍 수만큼). */
function ResultLines({ summary }: { summary: WinSummary }) {
  const { kind, moves, prevBest, gap, perfect } = summary
  const main =
    kind === 'first'
      ? `${moves} moves — your first best!`
      : kind === 'best'
        ? `${moves} moves — ${-gap} fewer than ${prevBest}`
        : kind === 'tie'
          ? `${moves} moves — ties your best`
          : `${moves} moves · Best ${prevBest}`
  const next = perfect
    ? 'Perfect — not a single wrong flip!'
    : kind === 'short'
      ? `${gap} more than your best. Beat ${prevBest}?`
      : `Next goal: ${Math.max(PERFECT_MOVES, moves - 1)} moves · perfect is ${PERFECT_MOVES}`
  return (
    <div className="flex flex-col items-center gap-0.5" data-testid="memory-result">
      <p className="font-semibold tabular-nums text-garden-ink">{main}</p>
      <p className="text-sm font-semibold text-garden-ink-soft">{next}</p>
    </div>
  )
}

export function GameMemory({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<MemoryState | null>(null)
  const [best, setBest] = useState(0) // 최소 moves. 0 = 기록 없음
  const bestRef = useRef(0)
  const [summary, setSummary] = useState<WinSummary | null>(null)
  // 판 중간 New Game 직전 판(되돌리기용). null = Undo 없음
  const [undoSnap, setUndoSnap] = useState<MemoryState | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const mutedRef = useRef(muted)
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])
  // Previous-state trackers used to derive sound cues from state transitions.
  const prevMatched = useRef(0)
  const prevMoves = useRef(0)
  const prevFaceUp = useRef(0)
  const prevWon = useRef(false)

  const syncPrev = useCallback((s: MemoryState) => {
    prevMatched.current = countMatched(s)
    prevMoves.current = s.moves
    prevFaceUp.current = s.faceUp.length
    prevWon.current = s.won
  }, [])

  const dropUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = null
    setUndoSnap(null)
  }, [])

  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    dropUndo()
    const s = newMemoryGame(Math.random)
    syncPrev(s)
    setSummary(null)
    setState(s)
  }, [dropUndo, syncPrev])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    const b = Number.isFinite(stored) && stored > 0 ? stored : 0
    bestRef.current = b
    setBest(b)
  }, [restart, storageKey])

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    },
    [],
  )

  // 판 중간(한 수 이상, 아직 안 끝남)이면 지우기 전에 Undo를 남긴다. 그 밖엔 바로 새 판.
  const onNewGame = useCallback(() => {
    const cur = state
    const inProgress = !!cur && !cur.won && cur.moves > 0
    restart()
    if (!inProgress || !cur) return
    setUndoSnap(clearMismatch(cur))
    undoTimer.current = setTimeout(() => {
      undoTimer.current = null
      setUndoSnap(null)
    }, UNDO_MS)
  }, [state, restart])

  const undoNewGame = useCallback(() => {
    if (!undoSnap) return
    if (timer.current) clearTimeout(timer.current)
    syncPrev(undoSnap) // 되돌린 판으로 소리 기준을 맞춘다(되돌리기에 'match' 소리가 나지 않게)
    setState(undoSnap)
    dropUndo()
  }, [undoSnap, dropUndo, syncPrev])

  // Sound cues driven off state transitions (win > match > mismatch > flip).
  // 승리 순간에 한 번: 결과 요약(이전 최고와 비교) → 최소 moves 기록 저장.
  useEffect(() => {
    if (!state) return
    const matched = countMatched(state)
    const faceUp = state.faceUp.length
    if (state.won && !prevWon.current) {
      play('win')
      const prevBest = bestRef.current
      setSummary(winSummary(state.moves, prevBest))
      if (prevBest === 0 || state.moves < prevBest) {
        bestRef.current = state.moves
        setBest(state.moves)
        localStorage.setItem(storageKey, String(state.moves))
      }
      // 개인 기록: 완료 판수 누적(메모리는 패배 없음 → 항상 승) → 스탯 패널이 읽는다.
      recordResult(storageKey.replace(/^best:/, ''), { won: true })
    } else if (matched > prevMatched.current) {
      play('match')
      if (!mutedRef.current) vibrate(12)
    } else if (state.moves > prevMoves.current) {
      play('mismatch')
      if (!mutedRef.current) vibrate([8, 50, 8])
    } else if (faceUp === 1 && faceUp !== prevFaceUp.current) play('flip')
    syncPrev(state)
  }, [state, play, storageKey, syncPrev])

  const handleFlip = useCallback(
    (index: number) => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
      if (undoSnap) dropUndo() // 새 판을 실제로 시작하면 되돌리기는 끝
      setState((s) => {
        if (!s) return s
        const base = s.faceUp.length >= 2 ? clearMismatch(s) : s
        return flip(base, index)
      })
    },
    [undoSnap, dropUndo],
  )

  // 미스매치 자동 정리
  useEffect(() => {
    if (!state || state.faceUp.length < 2) return
    timer.current = setTimeout(() => setState((s) => (s ? clearMismatch(s) : s)), MISMATCH_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  const stats = [
    { label: 'Moves', value: state?.moves ?? 0, testId: 'moves' },
    { label: 'Best', value: best > 0 ? best : '—', testId: 'best' },
  ]
  // 두 문구 모두 44px 높이 — Undo가 나타나고 사라질 때 아래 페이지가 튀지 않게
  const hint = undoSnap ? (
    <span className="inline-flex min-h-11 items-center gap-2" data-testid="memory-undo-bar">
      New board dealt.
      <GameButton variant="ghost" onClick={undoNewGame} data-testid="memory-undo" className="min-h-11 px-4">
        Undo
      </GameButton>
    </span>
  ) : (
    <span className="inline-flex min-h-11 items-center">Flip two cards and find every matching pair.</span>
  )

  if (!state) {
    return (
      <GameShell stats={stats} onNewGame={restart} newGameDisabled muted={muted} onToggleMute={toggleMuted} hint={hint}>
        <div className="aspect-square rounded-xl bg-surface" data-testid="memory-loading" />
      </GameShell>
    )
  }

  const mismatched = state.faceUp.length === 2

  return (
    <GameShell stats={stats} onNewGame={onNewGame} muted={muted} onToggleMute={toggleMuted} hint={hint}>
      <div
        className="anim-board-in relative grid aspect-square grid-cols-4 gap-2 rounded-xl bg-surface p-2"
        data-testid="memory-board"
      >
        {state.cards.map((card, i) => {
          const open = state.faceUp.includes(i)
          const shown = card.matched || open
          const shaking = mismatched && open
          // 뒤집힌 카드 테두리: 고르는 중 = 해바라기, 틀림 = 산호, 맞힘 = 잎 + ✓ 배지(색만으로 구분하지 않게)
          const ring = card.matched ? 'ring-[3px] ring-[#b5e39c]' : shaking ? 'ring-[3px] ring-garden-danger' : 'ring-[3px] ring-garden-sunflower'
          return (
            <button
              key={card.id}
              data-testid="memory-card"
              data-shown={shown}
              data-matched={card.matched}
              aria-label={shown ? (card.matched ? `${card.emoji} matched` : card.emoji) : 'face-down card'}
              onClick={() => handleFlip(i)}
              className={`memory-card btn-press relative aspect-square rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-sunflower ${shaking ? 'anim-shake' : ''} ${
                card.matched ? 'anim-match' : ''
              }`}
            >
              <span className="memory-card-inner" data-flipped={shown}>
                <span className="memory-face memory-face-front border-2 border-[#cdbde8]/30 bg-[linear-gradient(155deg,#54449a,#382c6c)] text-[#cdbde8] shadow-[inset_0_2px_0_rgba(255,255,255,0.12)] transition-colors hover:bg-[linear-gradient(155deg,#5f4fab,#40327a)]">
                  <FlowerBack />
                </span>
                <span className={`memory-face memory-face-back bg-garden-cream text-4xl ${ring}`}>
                  {card.emoji}
                  {card.matched && (
                    <span
                      aria-hidden="true"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-garden-leaf-text text-xs font-bold text-white"
                    >
                      ✓
                    </span>
                  )}
                </span>
              </span>
            </button>
          )
        })}
        <GameOverlay
          show={state.won}
          variant="win"
          title={summary?.kind === 'best' ? 'New best!' : 'You win!'}
          testId="game-over"
          tone="cozy"
        >
          {summary && <ResultLines summary={summary} />}
          <GameButton onClick={restart} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
