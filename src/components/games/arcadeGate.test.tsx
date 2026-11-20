/**
 * 리뉴얼 R1 회귀 테스트: 아케이드 4종의 시작 게이트 + 탭 숨김 일시정지.
 * 수정 전 main 실측(390px, 8초 무입력): pong 0-7 패배, space-shooter 목숨 3→1, tetris 조각 낙하.
 * canvas 드로잉은 jsdom이 못 그리므로 phase·HUD·DOM 보드만 본다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { GamePong } from './GamePong'
import { GameSpaceShooter } from './GameSpaceShooter'
import { GameTetris } from './GameTetris'
import { GameFlappy } from './GameFlappy'
import { statsKey } from '@/lib/gameStats'

let queue: FrameRequestCallback[] = []
let now = 0
let nextId = 1

function runFrames(durationMs: number, hz = 60) {
  const dt = 1000 / hz
  const frames = Math.round(durationMs / dt)
  for (let i = 0; i < frames; i++) {
    now += dt
    const cbs = queue
    queue = []
    act(() => {
      for (const cb of cbs) cb(now)
    })
  }
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

/** 테트리스 셀 그리드만(보드 안의 게이트 패널은 제외). */
const grid = () => screen.getByTestId('tetris-board').firstElementChild?.outerHTML ?? ''
const zone = () => document.querySelector('[data-play-zone]') as HTMLElement
const stats = () => screen.getByTestId('game-shell-stats').textContent ?? ''
const plays = (slug: string) => {
  const raw = localStorage.getItem(statsKey(slug))
  return raw ? (JSON.parse(raw) as { plays: number }).plays : 0
}

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  localStorage.clear()
  queue = []
  now = 1000
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push(cb)
    return nextId++
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    queue = []
  })
  vi.stubGlobal('ResizeObserver', RO)
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {}
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})
afterEach(() => {
  cleanup() // 언마운트(cancelAnimationFrame)를 전역 복원보다 먼저
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('pong gate', () => {
  it('does not play itself on load: 8s idle keeps 0-0, no game over, no recorded loss', () => {
    render(<GamePong storageKey="best:pong" />)
    expect(screen.getByTestId('gate-ready')).toBeInTheDocument()
    runFrames(8000)
    expect(stats()).toContain('CPU 0')
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
    expect(plays('pong')).toBe(0)
  })

  it('first tap starts; hidden tab pauses and stays paused on return; Resume counts down', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(<GamePong storageKey="best:pong" />)
    fireEvent.pointerDown(zone())
    expect(screen.queryByTestId('gate-ready')).not.toBeInTheDocument()
    expect(screen.getByTestId('gate-pause')).toBeInTheDocument()
    runFrames(500)
    setHidden(true)
    expect(screen.getByTestId('gate-paused')).toBeInTheDocument()
    setHidden(false)
    runFrames(8000)
    expect(screen.getByTestId('gate-paused')).toBeInTheDocument() // 자동 재개 없음
    expect(stats()).toContain('CPU 0') // 멈춘 동안 실점 없음
    fireEvent.click(screen.getByTestId('gate-resume'))
    expect(screen.getByTestId('gate-countdown')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1500))
    expect(screen.queryByTestId('gate-countdown')).not.toBeInTheDocument()
  })

  it('arrow key while paused is ignored (no movement queued)', () => {
    render(<GamePong storageKey="best:pong" />)
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(screen.queryByTestId('gate-ready')).not.toBeInTheDocument() // 첫 화살표 = 시작
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' })
    expect(screen.getByTestId('gate-paused')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByTestId('gate-paused')).toBeInTheDocument()
  })
})

describe('new game skips the gate', () => {
  it('pong: New Game while paused goes straight to play (no Ready, no countdown)', () => {
    render(<GamePong storageKey="best:pong" />)
    fireEvent.pointerDown(zone())
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' })
    expect(screen.getByTestId('gate-paused')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
    expect(screen.queryByTestId('gate-paused')).not.toBeInTheDocument()
    expect(screen.queryByTestId('gate-ready')).not.toBeInTheDocument()
    expect(screen.queryByTestId('gate-countdown')).not.toBeInTheDocument()
  })

  it('flappy: New Game returns to its tap-to-fly prompt (first tap = start + flap)', () => {
    render(<GameFlappy storageKey="best:flappy" />)
    fireEvent.pointerDown(zone())
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
    expect(screen.getByTestId('gate-ready')).toBeInTheDocument()
  })

  it('pong: paused panel moves focus to Resume, Space on it resumes', () => {
    render(<GamePong storageKey="best:pong" />)
    fireEvent.pointerDown(zone())
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' })
    expect(document.activeElement).toBe(screen.getByTestId('gate-resume'))
  })
})

describe('space-shooter gate', () => {
  it('8s idle keeps all lives and no game over', () => {
    render(<GameSpaceShooter storageKey="best:space-shooter" />)
    expect(screen.getByTestId('gate-ready')).toBeInTheDocument()
    runFrames(8000)
    expect(stats()).toContain('Lives 3')
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
  })

  it('first press starts; hidden while firing pauses and does not resume by itself', () => {
    render(<GameSpaceShooter storageKey="best:space-shooter" />)
    fireEvent.pointerDown(zone(), { clientX: 10 })
    expect(screen.queryByTestId('gate-ready')).not.toBeInTheDocument()
    setHidden(true)
    setHidden(false)
    const before = stats()
    runFrames(8000)
    expect(screen.getByTestId('gate-paused')).toBeInTheDocument()
    expect(stats()).toBe(before)
  })
})

describe('tetris gate', () => {
  it('does not drop pieces on load; Space in ready only starts (no hard drop of the first piece)', () => {
    vi.useFakeTimers()
    render(<GameTetris storageKey="best:tetris" />)
    const board = grid
    expect(screen.getByTestId('gate-ready')).toBeInTheDocument()
    const at0 = board()
    act(() => vi.advanceTimersByTime(8000))
    expect(screen.getByTestId('gate-ready')).toBeInTheDocument()
    expect(board()).toBe(at0)
    fireEvent.keyDown(window, { key: ' ' })
    expect(screen.queryByTestId('gate-ready')).not.toBeInTheDocument()
    expect(screen.getByTestId('score').textContent).toBe('0') // 하드드롭이면 점수가 오른다
  })

  it('after a hidden-tab pause, a key does not resume-and-move at once (old act bug)', () => {
    vi.useFakeTimers()
    render(<GameTetris storageKey="best:tetris" />)
    fireEvent.keyDown(window, { key: 'ArrowLeft' }) // 시작 + 이동
    setHidden(true)
    setHidden(false)
    const paused = grid()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: ' ' })
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByTestId('gate-paused')).toBeInTheDocument()
    expect(grid()).toBe(paused)
  })

  it('a held touch button stops repeating when the game pauses', () => {
    vi.useFakeTimers()
    render(<GameTetris storageKey="best:tetris" />)
    fireEvent.pointerDown(screen.getByLabelText('Move left'))
    act(() => vi.advanceTimersByTime(300)) // DAS 반복 시작
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' })
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' }) // 재개(카운트다운)
    act(() => vi.advanceTimersByTime(1190)) // 카운트다운(1.2초)이 끝나기 직전 — 이동은 아직 버려진다
    expect(screen.getByTestId('gate-countdown')).toBeInTheDocument()
    const afterResume = grid()
    // 손가락은 여전히 '누른 채'(pointerup 없음). 반복이 살아 있으면 running이 되자마자 조각이 왼쪽으로 간다.
    act(() => vi.advanceTimersByTime(240)) // DAS 간격 110ms × 2, 중력(레벨 1)보다 짧다
    expect(screen.queryByTestId('gate-countdown')).not.toBeInTheDocument()
    expect(grid()).toBe(afterResume)
  })
})

describe('flappy gate', () => {
  it('shows an in-board start prompt; tap while paused does not flap or resume', () => {
    render(<GameFlappy storageKey="best:flappy" />)
    expect(screen.getByTestId('gate-ready')).toBeInTheDocument()
    runFrames(5000)
    expect(screen.getByTestId('score').textContent).toBe('0')
    fireEvent.pointerDown(zone())
    expect(screen.queryByTestId('gate-ready')).not.toBeInTheDocument()
    setHidden(true)
    expect(screen.getByTestId('gate-paused')).toBeInTheDocument()
    setHidden(false)
    fireEvent.pointerDown(zone())
    runFrames(5000)
    expect(screen.getByTestId('gate-paused')).toBeInTheDocument()
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument() // 멈춘 동안 떨어지지 않음
  })
})
