import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { useGameGate, COUNT_FROM, COUNT_STEP_MS } from './useGameGate'

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

function key(init: KeyboardEventInit, target: EventTarget = window) {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  act(() => {
    target.dispatchEvent(e)
  })
  return e
}

const COUNT_TOTAL = COUNT_FROM * COUNT_STEP_MS

describe('useGameGate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setHidden(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    setHidden(false)
  })

  it('starts in ready and only start() moves to running (no countdown on first start)', () => {
    const { result } = renderHook(() => useGameGate())
    expect(result.current.phase).toBe('ready')
    act(() => vi.advanceTimersByTime(10_000))
    expect(result.current.phase).toBe('ready')
    act(() => result.current.start())
    expect(result.current.phase).toBe('running')
    expect(result.current.phaseRef.current).toBe('running')
  })

  it('hidden tab pauses with reason hidden and does NOT auto-resume when visible again', () => {
    const onPause = vi.fn()
    const { result } = renderHook(() => useGameGate({ onPause }))
    act(() => result.current.start())
    setHidden(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('pagehide')) // 두 신호가 겹쳐도 한 번만
    })
    expect(result.current.phase).toBe('paused')
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(onPause).toHaveBeenCalledWith('hidden')
    setHidden(false)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.phase).toBe('paused')
  })

  it('hidden while ready stays ready (nothing to pause)', () => {
    const onPause = vi.fn()
    const { result } = renderHook(() => useGameGate({ onPause }))
    setHidden(true)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current.phase).toBe('ready')
    expect(onPause).not.toHaveBeenCalled()
  })

  it('resume runs a short 3-2-1 countdown, then running', () => {
    const { result } = renderHook(() => useGameGate())
    act(() => result.current.start())
    act(() => result.current.pause())
    act(() => result.current.resume())
    expect(result.current.phase).toBe('countdown')
    expect(result.current.count).toBe(3)
    act(() => vi.advanceTimersByTime(COUNT_STEP_MS))
    expect(result.current.count).toBe(2)
    act(() => vi.advanceTimersByTime(COUNT_STEP_MS * 2))
    expect(result.current.phase).toBe('running')
    expect(result.current.count).toBe(0)
    expect(COUNT_TOTAL).toBeLessThanOrEqual(1500) // 리서치 2: 3초는 길다 → 1.5초 이하
  })

  it('hiding during the countdown cancels it and goes back to paused', () => {
    const { result } = renderHook(() => useGameGate())
    act(() => result.current.start())
    act(() => result.current.pause())
    act(() => result.current.resume())
    setHidden(true)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current.phase).toBe('paused')
    act(() => vi.advanceTimersByTime(COUNT_TOTAL * 3))
    expect(result.current.phase).toBe('paused') // 남은 타이머가 몰래 running으로 바꾸지 않는다
  })

  it('canPause=false (game over) ignores hidden and hotkeys', () => {
    const { result } = renderHook(() => useGameGate({ canPause: () => false }))
    act(() => result.current.start())
    setHidden(true)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    key({ key: 'p', code: 'KeyP' })
    expect(result.current.phase).toBe('running')
  })

  it('P toggles pause/resume; Korean layout (code KeyP) works; Esc pauses', () => {
    const { result } = renderHook(() => useGameGate())
    act(() => result.current.start())
    key({ key: 'ㅔ', code: 'KeyP' })
    expect(result.current.phase).toBe('paused')
    key({ key: 'p', code: 'KeyP' })
    expect(result.current.phase).toBe('countdown')
    act(() => vi.advanceTimersByTime(COUNT_TOTAL))
    key({ key: 'Escape', code: 'Escape' })
    expect(result.current.phase).toBe('paused')
  })

  it('ignores Ctrl/Cmd+P (print), IME composition, typing targets and already-handled Esc', () => {
    const { result } = renderHook(() => useGameGate())
    act(() => result.current.start())
    const print = key({ key: 'p', code: 'KeyP', ctrlKey: true })
    expect(print.defaultPrevented).toBe(false)
    key({ key: 'p', code: 'KeyP', metaKey: true })
    key({ key: 'p', code: 'KeyP', isComposing: true })
    const input = document.createElement('input')
    document.body.appendChild(input)
    key({ key: 'p', code: 'KeyP' }, input)
    input.remove()
    // 다른 다이얼로그가 이미 Esc를 처리했다
    const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    handled.preventDefault()
    act(() => {
      window.dispatchEvent(handled)
    })
    expect(result.current.phase).toBe('running')
  })

  it('window blur only releases input (onBlur), it does not pause', () => {
    const onBlur = vi.fn()
    const { result } = renderHook(() => useGameGate({ onBlur }))
    act(() => result.current.start())
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(onBlur).toHaveBeenCalledTimes(1)
    expect(result.current.phase).toBe('running')
  })

  it('reset during countdown clears the timer (New Game while resuming)', () => {
    const { result } = renderHook(() => useGameGate())
    act(() => result.current.start())
    act(() => result.current.pause())
    act(() => result.current.resume())
    act(() => result.current.reset('ready'))
    act(() => vi.advanceTimersByTime(COUNT_TOTAL * 2))
    expect(result.current.phase).toBe('ready')
    act(() => result.current.reset())
    expect(result.current.phase).toBe('running') // 기본 reset = Play again은 게이트 생략
  })

  it('unmount during countdown leaves no pending timer', () => {
    const { result, unmount } = renderHook(() => useGameGate())
    act(() => result.current.start())
    act(() => result.current.pause())
    act(() => result.current.resume())
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('StrictMode: a single P press pauses exactly once (no doubled listeners)', () => {
    const onPause = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>
    const { result } = renderHook(() => useGameGate({ onPause }), { wrapper })
    act(() => result.current.start())
    key({ key: 'p', code: 'KeyP' })
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(result.current.phase).toBe('paused')
  })
})
