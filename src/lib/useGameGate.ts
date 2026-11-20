'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isTypingTarget } from '@/lib/isTypingTarget'

/**
 * 실시간 아케이드 게임의 '시작 게이트 + 일시정지' 상태기계(리뉴얼 R1, specs/2026-11-18-r1-arcade-gate.md).
 *
 *   ready ──start()──▶ running ──pause()/탭 숨김──▶ paused ──resume()──▶ countdown ──▶ running
 *
 * - 로드 직후는 `ready`: 게임 루프는 phaseRef가 'running'일 때만 상태를 진행한다.
 * - 탭이 숨겨지면(visibilitychange) running·countdown → paused. **돌아와도 자동 재개하지 않는다**.
 * - 재개는 짧은 카운트다운을 거친다(복귀 직후 손이 준비되기 전에 죽지 않게).
 * - P 또는 Esc로 일시정지/재개(Space는 하드드롭·발사와 겹쳐 쓰지 않는다).
 * - 게임오버 같은 '멈출 게 없는' 상태는 canPause()로 알려 준다(그때는 숨김·단축키를 무시).
 *
 * 게임오버는 훅 밖(각 게임)의 상태다: 게임오버 중 phase는 'running'으로 남고 canPause()가 false를 돌려준다.
 * 입력 규약(게임이 지킨다): ready에서 첫 입력 = start() + 그 입력 적용(단 테트리스 Space/Enter는 시작만),
 * paused·countdown에서는 게임 입력을 적용하지 않는다.
 *
 * 렌더 루프(rAF·setInterval)는 게임이 소유한다. 이 훅은 phase만 소유하고, 게임은
 * phaseRef.current === 'running'일 때만 step 하며, 그 밖의 프레임에서는 lastTs를 0으로 되돌려
 * 재개 첫 프레임의 시간 점프를 막는다.
 */
export type GatePhase = 'ready' | 'countdown' | 'running' | 'paused'
export type PauseReason = 'hidden' | 'manual'

/** 재개 카운트다운: 3 → 2 → 1, 한 칸 COUNT_STEP_MS. 합계 약 1.2초(리서치 2·리뷰로 확정, 스펙 참조). */
export const COUNT_FROM = 3
export const COUNT_STEP_MS = 400

export interface UseGameGateOptions {
  /** 시작 phase. 기본 'ready'. */
  initial?: GatePhase
  /** 일시정지 진입 시 게임이 정리할 것(눌린 키·포인터·자동 발사 초기화 등). */
  onPause?: (reason: PauseReason) => void
  /** 지금 멈출 수 있는가(예: 게임오버면 false). 기본 항상 true. */
  canPause?: () => boolean
  /** 탭 숨김 시 자동 일시정지. 기본 true. */
  pauseOnHidden?: boolean
  /** P/Esc 단축키. 기본 true. */
  hotkeys?: boolean
  /** 창이 포커스를 잃을 때(alt-tab 등, visibilitychange가 오지 않는 경로) 눌린 입력을 비운다. 일시정지는 하지 않는다. */
  onBlur?: () => void
}

export interface GameGate {
  phase: GatePhase
  /** rAF·이벤트 핸들러에서 stale 없이 읽는다. */
  phaseRef: React.MutableRefObject<GatePhase>
  /** countdown 중 표시할 숫자(3,2,1). 그 밖에는 0. */
  count: number
  /** ready → running(카운트다운 없음). 첫 시작은 즉시 — 1탭 마찰만 남긴다. */
  start: () => void
  pause: (reason?: PauseReason) => void
  /** paused → countdown → running */
  resume: () => void
  /** 새 판: 기본은 곧바로 running(Play again·New Game은 게이트를 다시 거치지 않는다). */
  reset: (to?: GatePhase) => void
}

export function useGameGate(opts: UseGameGateOptions = {}): GameGate {
  const { initial = 'ready', pauseOnHidden = true, hotkeys = true } = opts
  const [phase, setPhaseState] = useState<GatePhase>(initial)
  const [count, setCount] = useState(0)
  const phaseRef = useRef<GatePhase>(initial)
  const timerRef = useRef<number | null>(null)
  const onPauseRef = useRef(opts.onPause)
  const canPauseRef = useRef(opts.canPause)
  const onBlurRef = useRef(opts.onBlur)
  onPauseRef.current = opts.onPause
  canPauseRef.current = opts.canPause
  onBlurRef.current = opts.onBlur

  const setPhase = useCallback((p: GatePhase) => {
    phaseRef.current = p
    setPhaseState(p)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    if (phaseRef.current !== 'ready') return
    clearTimer()
    setCount(0)
    setPhase('running')
  }, [clearTimer, setPhase])

  const pause = useCallback(
    (reason: PauseReason = 'manual') => {
      const p = phaseRef.current
      if (p !== 'running' && p !== 'countdown') return
      if (canPauseRef.current && !canPauseRef.current()) return
      clearTimer()
      setCount(0)
      setPhase('paused')
      onPauseRef.current?.(reason)
    },
    [clearTimer, setPhase],
  )

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return
    clearTimer()
    setPhase('countdown')
    let n = COUNT_FROM
    setCount(n)
    const tickDown = () => {
      n -= 1
      if (n <= 0) {
        timerRef.current = null
        setCount(0)
        if (phaseRef.current === 'countdown') setPhase('running')
        return
      }
      setCount(n)
      timerRef.current = window.setTimeout(tickDown, COUNT_STEP_MS)
    }
    timerRef.current = window.setTimeout(tickDown, COUNT_STEP_MS)
  }, [clearTimer, setPhase])

  const reset = useCallback(
    (to: GatePhase = 'running') => {
      clearTimer()
      setCount(0)
      setPhase(to)
    },
    [clearTimer, setPhase],
  )

  // 탭 숨김 → 일시정지. 돌아와도 자동 재개하지 않는다.
  useEffect(() => {
    if (!pauseOnHidden) return
    const onVis = () => {
      if (document.visibilityState === 'hidden') pause('hidden')
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onVis)
    }
  }, [pauseOnHidden, pause])

  // 창 포커스 상실: 놓친 keyup으로 키가 눌린 채 남지 않게 입력만 비운다.
  useEffect(() => {
    const onWinBlur = () => onBlurRef.current?.()
    window.addEventListener('blur', onWinBlur)
    return () => window.removeEventListener('blur', onWinBlur)
  }, [])

  // P / Esc: 일시정지 ↔ 재개. 자판 배열과 무관하게 e.code로 P를 본다(한글 자판에서 e.key는 'ㅔ').
  // Ctrl/Cmd+P(인쇄)·IME 조합 중·입력창·이미 처리된 Esc(다른 다이얼로그)는 건드리지 않는다.
  useEffect(() => {
    if (!hotkeys) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      const isP = e.code === 'KeyP' || e.key === 'p' || e.key === 'P'
      const isEsc = e.key === 'Escape'
      if (!isP && !isEsc) return
      if (isEsc && e.defaultPrevented) return
      const p = phaseRef.current
      if (p === 'running' || p === 'countdown') {
        if (canPauseRef.current && !canPauseRef.current()) return
        e.preventDefault()
        pause('manual')
      } else if (p === 'paused') {
        e.preventDefault()
        resume()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkeys, pause, resume])

  useEffect(() => clearTimer, [clearTimer])

  // 콜백은 안정적이라 phase·count가 바뀔 때만 새 객체(의존성으로 써도 리스너가 매 렌더 다시 붙지 않는다).
  return useMemo(() => ({ phase, phaseRef, count, start, pause, resume, reset }), [phase, count, start, pause, resume, reset])
}
