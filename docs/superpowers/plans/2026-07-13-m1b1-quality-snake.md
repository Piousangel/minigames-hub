# M1-b1: 품질 이월분 + Snake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** M1-a 최종 리뷰 이월분(판별 유니온, 입력 게이트, favicon, OG, ESLint 등)을 정리하고 두 번째 게임 Snake를 추가한다.

**Architecture:** 기존 패턴 유지 — 순수 TS 엔진(`src/lib/games/snake/engine.ts`, TDD) + 클라이언트 컴포넌트 + 레지스트리 엔트리 추가만으로 라우트·sitemap·홈 그리드 자동 반영. `GamePage`를 판별 유니온으로 전환해 게임별 config가 컴파일 타임에 강제되게 한다.

**Tech Stack:** 기존과 동일 (Next.js 15 SSG, TS strict, Tailwind v4, Vitest, Playwright) + ESLint 9(flat config, eslint-config-next).

## Global Constraints

- UI 언어는 영어. 상표명 사용 금지. `any` 금지, TypeScript strict. 전 페이지 SSG.
- 게임 엔진은 순수 TS(UI 무관), TDD 필수. 게임은 첫 화면에서 즉시 플레이 가능.
- 디자인 토큰(bg/surface/fg/fg-muted/accent)과 기존 Game2048 컴포넌트 패턴(클라이언트 초기화, 베스트 스코어 effect 분리, data-testid)을 따를 것.
- 패키지 매니저 pnpm. 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- 각 태스크 끝에 관련 게이트(명시된 명령) 통과 필수.

---

### Task 1: GamePage 판별 유니온 + GameRenderer exhaustive

**Files:**
- Modify: `src/lib/games/registry.ts` (GamePage 타입 재구성)
- Modify: `src/components/GameRenderer.tsx`

**Interfaces:**
- Produces:
  - `type GamePage = GamePageBase & ({ game: '2048'; themeKey: keyof typeof themes2048 } | { game: 'snake' })` — snake 멤버는 Task 5에서 사용되며 지금 선언만 한다
  - `GameRenderer`의 switch는 `default`에서 `page satisfies never`로 컴파일 타임 exhaustive

- [ ] **Step 1: registry.ts 타입 교체**

`src/lib/games/registry.ts`의 인터페이스 부분을 다음으로 교체(기존 `gamePages` 배열 데이터는 그대로 유지 — `game: '2048'` 엔트리들은 유니온에 그대로 부합):

```ts
import { themes2048 } from './g2048/themes'

interface GamePageBase {
  slug: string
  title: string // <title>
  h1: string
  metaDescription: string
  shortDescription: string // 홈 카드용 한 줄
  howToPlay: string[]
  strategy: string[]
  faq: Array<{ q: string; a: string }>
}

export type GamePage = GamePageBase &
  (
    | { game: '2048'; themeKey: keyof typeof themes2048 }
    | { game: 'snake' } // Task 5에서 첫 엔트리 추가
  )
```

기존 파일 상단의 `export interface GamePage { ... }` 블록을 삭제하고 위로 대체한다. `themes2048` import가 순환이 아님을 확인(themes.ts는 registry를 import하지 않음).

- [ ] **Step 2: GameRenderer exhaustive 처리**

`src/components/GameRenderer.tsx` 전체 교체:

```tsx
import { Game2048 } from '@/components/games/Game2048'
import { themes2048 } from '@/lib/games/g2048/themes'
import type { GamePage } from '@/lib/games/registry'

export function GameRenderer({ page }: { page: GamePage }) {
  switch (page.game) {
    case '2048':
      return <Game2048 theme={themes2048[page.themeKey]} storageKey={`best:${page.slug}`} />
    default: {
      page satisfies never
      return null
    }
  }
}
```

주의: 이 시점(snake 컴포넌트 없음)에서는 유니온에 `snake`가 있으므로 `page satisfies never`가 컴파일 에러가 난다. **Task 5 전까지는 유니온에서 `| { game: 'snake' }` 줄을 주석 처리하지 말고**, 대신 default 블록을 다음 임시 형태로 두고 Task 5에서 snake case 추가와 함께 `satisfies never`로 조인다:

```tsx
    case 'snake':
      return null // Task 5에서 GameSnake로 교체
    default: {
      page satisfies never
      return null
    }
```

- [ ] **Step 3: 게이트**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck 0 에러, 20/20 통과 (registry.test의 themeKey 테스트는 이제 타입으로도 보장되지만 런타임 테스트 유지).

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "refactor: GamePage 판별 유니온 + GameRenderer exhaustive"
```

---

### Task 2: 공통 품질 픽스 (입력 게이트·NaN 가드·JSON-LD escape·next/link·favicon·OG)

**Files:**
- Create: `src/lib/isTypingTarget.ts`, `src/app/icon.svg`, `src/app/opengraph-image.tsx`
- Modify: `src/components/games/Game2048.tsx`, `src/app/[slug]/page.tsx`, `src/app/layout.tsx`

**Interfaces:**
- Produces: `isTypingTarget(t: EventTarget | null): boolean` — Snake(Task 5)도 사용

- [ ] **Step 1: isTypingTarget 유틸**

`src/lib/isTypingTarget.ts`:
```ts
export function isTypingTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && t.closest('input, textarea, select, [contenteditable]') !== null
}
```

- [ ] **Step 2: Game2048 3건 수정**

`src/components/games/Game2048.tsx`:

(a) keydown 게이트 — 기존 keydown effect의 핸들러 첫 줄에 추가:
```tsx
import { isTypingTarget } from '@/lib/isTypingTarget'
// ...
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const dir = KEY_DIRS[e.key]
      // ... 기존 그대로
```

(b) localStorage NaN 가드 — 마운트 effect의 `setBest(Number(localStorage.getItem(storageKey) ?? 0))`를 다음으로 교체:
```tsx
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) ? stored : 0)
```

(c) 승리 오버레이 입력 게이트 — 오버레이가 떠 있는 동안 이동 차단:
```tsx
  const winOverlayVisible = state !== null && state.won && !wonSeen && !state.over

  const doMove = useCallback(
    (dir: Direction) => {
      if (winOverlayVisible) return
      setState((s) => (s && !s.over ? move(s, dir, Math.random) : s))
    },
    [winOverlayVisible],
  )
```
(`winOverlayVisible` 선언은 `wonSeen`/`state` 선언 뒤, `doMove` 앞에 위치. 오버레이 렌더 조건도 이 변수 재사용으로 통일.)

- [ ] **Step 3: JSON-LD escape**

`src/app/[slug]/page.tsx`의 JSON-LD script를:
```tsx
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
```

- [ ] **Step 4: 헤더/푸터 next/link + OG 메타**

`src/app/layout.tsx`:
- `import Link from 'next/link'` 추가, 헤더/푸터의 내부 링크 `<a href="...">` 6개를 전부 `<Link href="...">`로 교체(외부 링크 없음).
- metadata에 openGraph 추가:
```tsx
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: { type: 'website', siteName: siteConfig.name },
}
```

`src/app/[slug]/page.tsx`의 generateMetadata 반환에 추가:
```tsx
  return {
    title: { absolute: page.title },
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
    openGraph: { title: page.title, description: page.metaDescription, url: `/${page.slug}` },
  }
```

- [ ] **Step 5: favicon + OG 이미지**

`src/app/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0f1115"/><rect x="5" y="5" width="10" height="10" rx="2" fill="#f59e0b"/><rect x="17" y="5" width="10" height="10" rx="2" fill="#374151"/><rect x="5" y="17" width="10" height="10" rx="2" fill="#374151"/><rect x="17" y="17" width="10" height="10" rx="2" fill="#f59e0b"/></svg>
```

`src/app/opengraph-image.tsx`:
```tsx
import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/siteConfig'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f1115',
          color: '#e8eaed',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 72, height: 72, background: '#f59e0b', borderRadius: 16 }} />
          <div style={{ fontSize: 72, fontWeight: 700 }}>{siteConfig.name}</div>
        </div>
        <div style={{ fontSize: 32, color: '#9aa0a8', marginTop: 24 }}>
          Free online mini games — play instantly, no download
        </div>
      </div>
    ),
    size,
  )
}
```

- [ ] **Step 6: 게이트**

Run: `pnpm typecheck && pnpm test && pnpm build && pnpm e2e`
Expected: 전부 통과. build 출력에 `/icon.svg`, `/opengraph-image` 라우트 생성 확인. E2E 3/3 (기존 동작 무회귀).

- [ ] **Step 7: Commit**

```bash
git add src && git commit -m "fix: 입력게이트·NaN가드·JSON-LD escape·next/link·favicon·OG 메타"
```

---

### Task 3: ESLint 9 도입

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json`, `src/app/terms/page.tsx`(위반 시)

- [ ] **Step 1: 설치 및 설정**

Run: `pnpm add -D eslint eslint-config-next @eslint/eslintrc`

`eslint.config.mjs`:
```js
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

export default [
  { ignores: ['.next/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]
```

`package.json` scripts에 추가: `"lint": "eslint ."`

- [ ] **Step 2: 위반 정리**

Run: `pnpm lint`
예상 위반: `src/app/terms/page.tsx`의 `"as is"` (react/no-unescaped-entities) → `&quot;as is&quot;`로 수정. 그 외 위반이 나오면 룰 비활성화가 아니라 코드 수정으로 해결한다(불가피하게 룰 자체가 부적절한 경우만 라인 단위 disable + 사유 주석).

- [ ] **Step 3: 게이트**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: lint 0 에러 0 워닝, 나머지 통과.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: ESLint 9 flat config (next/core-web-vitals) 도입"
```

---

### Task 4: Snake 엔진 (TDD)

**Files:**
- Create: `src/lib/games/snake/engine.ts`
- Test: `src/lib/games/snake/engine.test.ts`

**Interfaces:**
- Produces:
  - `GRID = 20`, `type Point = { x: number; y: number }`, `type Dir = 'up' | 'down' | 'left' | 'right'`, `type Rng = () => number`
  - `interface SnakeState { snake: Point[]; dir: Dir; pendingDir: Dir; food: Point; score: number; over: boolean }` (snake는 머리가 index 0. `dir`=마지막으로 실제 이동한 방향, `pendingDir`=다음 틱에 적용될 방향)
  - `newSnakeGame(rng: Rng): SnakeState` — 중앙에서 길이 3, 오른쪽 방향
  - `changeDir(state: SnakeState, dir: Dir): SnakeState` — `dir`가 현재 `state.dir`의 정반대면 무시(레퍼런스 그대로 반환), 아니면 `pendingDir`만 갱신
  - `tick(state: SnakeState, rng: Rng): SnakeState` — pendingDir 방향으로 한 칸 전진. 벽/몸 충돌 시 `over: true`. 음식 먹으면 성장+score+1+새 음식. 꼬리가 비켜주는 칸은 이동 가능
  - `placeFood(snake: Point[], rng: Rng): Point` — 뱀이 없는 칸 중 `Math.floor(rng() * free.length)`번째 (스캔 순서 y 바깥, x 안쪽)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/games/snake/engine.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { changeDir, newSnakeGame, placeFood, tick, type SnakeState } from './engine'

const S = (partial: Partial<SnakeState>): SnakeState => ({
  snake: [{ x: 5, y: 5 }],
  dir: 'right',
  pendingDir: 'right',
  food: { x: 0, y: 0 },
  score: 0,
  over: false,
  ...partial,
})

describe('newSnakeGame', () => {
  it('중앙에서 길이 3, 오른쪽 방향으로 시작한다', () => {
    const s = newSnakeGame(() => 0)
    expect(s.snake).toEqual([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }])
    expect(s.dir).toBe('right')
    expect(s.score).toBe(0)
    expect(s.over).toBe(false)
  })
})

describe('placeFood', () => {
  it('뱀 위에는 음식이 놓이지 않는다', () => {
    const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }]
    expect(placeFood(snake, () => 0)).toEqual({ x: 2, y: 0 }) // (0,0)(1,0) 제외한 첫 빈 칸
  })
})

describe('changeDir', () => {
  it('정반대 방향은 무시한다', () => {
    const s = S({ dir: 'right', pendingDir: 'right' })
    expect(changeDir(s, 'left')).toBe(s)
  })
  it('직각 방향은 pendingDir만 바꾼다 (dir는 tick에서 반영)', () => {
    const s = S({ dir: 'right', pendingDir: 'right' })
    const next = changeDir(s, 'up')
    expect(next.pendingDir).toBe('up')
    expect(next.dir).toBe('right')
  })
  it('한 틱 안에 두 번 꺾어도 180도 반전은 불가하다', () => {
    const s = changeDir(S({ dir: 'right', pendingDir: 'right' }), 'up')
    expect(changeDir(s, 'left').pendingDir).toBe('up') // dir가 아직 right이므로 left 거부
  })
})

describe('tick', () => {
  it('머리가 전진하고 꼬리가 줄어든다', () => {
    const s = S({ snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], food: { x: 0, y: 0 } })
    const next = tick(s, () => 0)
    expect(next.snake).toEqual([{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }])
    expect(next.score).toBe(0)
  })
  it('pendingDir가 반영되고 dir가 갱신된다', () => {
    const s = S({ snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }], dir: 'right', pendingDir: 'up', food: { x: 0, y: 0 } })
    const next = tick(s, () => 0)
    expect(next.snake[0]).toEqual({ x: 5, y: 4 })
    expect(next.dir).toBe('up')
  })
  it('음식을 먹으면 성장하고 score+1, 새 음식이 놓인다', () => {
    const s = S({ snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }], food: { x: 6, y: 5 } })
    const next = tick(s, () => 0)
    expect(next.snake).toEqual([{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }])
    expect(next.score).toBe(1)
    expect(next.food).toEqual({ x: 0, y: 0 }) // 첫 빈 칸
  })
  it('벽에 부딪히면 over', () => {
    const s = S({ snake: [{ x: 19, y: 10 }], dir: 'right', pendingDir: 'right' })
    expect(tick(s, () => 0).over).toBe(true)
  })
  it('자기 몸에 부딪히면 over', () => {
    const s = S({
      snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 7, y: 5 }],
      dir: 'right',
      pendingDir: 'right',
    })
    expect(tick(s, () => 0).over).toBe(true) // (6,5)는 꼬리가 아닌 몸통
  })
  it('꼬리가 비켜주는 칸으로는 이동할 수 있다', () => {
    const s = S({
      snake: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }],
      dir: 'down',
      pendingDir: 'down',
      food: { x: 0, y: 0 },
    })
    const next = tick(s, () => 0)
    expect(next.over).toBe(false)
    expect(next.snake[0]).toEqual({ x: 5, y: 6 })
  })
  it('over 상태에서는 그대로 반환한다', () => {
    const s = S({ over: true })
    expect(tick(s, () => 0)).toBe(s)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test`
Expected: snake/engine.test.ts FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`src/lib/games/snake/engine.ts`:
```ts
export const GRID = 20

export type Point = { x: number; y: number }
export type Dir = 'up' | 'down' | 'left' | 'right'
export type Rng = () => number

export interface SnakeState {
  snake: Point[] // 머리가 index 0
  dir: Dir // 마지막으로 실제 이동한 방향
  pendingDir: Dir // 다음 틱에 적용될 방향
  food: Point
  score: number
  over: boolean
}

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export function placeFood(snake: Point[], rng: Rng): Point {
  const free: Point[] = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!snake.some((p) => p.x === x && p.y === y)) free.push({ x, y })
    }
  }
  return free[Math.floor(rng() * free.length)]
}

export function newSnakeGame(rng: Rng): SnakeState {
  const mid = Math.floor(GRID / 2)
  const snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }]
  return { snake, dir: 'right', pendingDir: 'right', food: placeFood(snake, rng), score: 0, over: false }
}

export function changeDir(state: SnakeState, dir: Dir): SnakeState {
  if (dir === OPPOSITE[state.dir]) return state
  return { ...state, pendingDir: dir }
}

export function tick(state: SnakeState, rng: Rng): SnakeState {
  if (state.over) return state
  const dir = state.pendingDir
  const head = state.snake[0]
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y }
  if (next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID) {
    return { ...state, dir, over: true }
  }
  const eats = next.x === state.food.x && next.y === state.food.y
  const body = eats ? state.snake : state.snake.slice(0, -1) // 안 먹으면 꼬리가 비켜준다
  if (body.some((p) => p.x === next.x && p.y === next.y)) {
    return { ...state, dir, over: true }
  }
  const snake = [next, ...body]
  return {
    snake,
    dir,
    pendingDir: dir,
    food: eats ? placeFood(snake, rng) : state.food,
    score: eats ? state.score + 1 : state.score,
    over: false,
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test`
Expected: 전체 PASS (기존 20 + 신규 11 = 31건).

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/snake && git commit -m "feat: Snake 엔진 (이동·성장·충돌·180도 반전 방지)"
```

---

### Task 5: GameSnake 컴포넌트 + 레지스트리 엔트리

**Files:**
- Create: `src/components/games/GameSnake.tsx`
- Modify: `src/components/GameRenderer.tsx` (snake case 연결 + satisfies never 완성)
- Modify: `src/lib/games/registry.ts` (snake 엔트리 추가)

**Interfaces:**
- Consumes: Task 4 엔진 전체, Task 2 `isTypingTarget`
- Produces: `/snake` 페이지 (레지스트리 추가만으로 라우트·sitemap·홈 그리드 자동 반영)

- [ ] **Step 1: GameSnake 구현**

`src/components/games/GameSnake.tsx`:
```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { changeDir, GRID, newSnakeGame, tick, type Dir, type SnakeState } from '@/lib/games/snake/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'

const KEY_DIRS: Record<string, Dir> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

const TICK_MS = 130

export function GameSnake({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<SnakeState | null>(null)
  const [running, setRunning] = useState(false)
  const [best, setBest] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const restart = useCallback(() => {
    setState(newSnakeGame(Math.random))
    setRunning(false)
  }, [])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) ? stored : 0)
  }, [restart, storageKey])

  const over = state?.over ?? false

  useEffect(() => {
    if (!running || over) return
    const id = setInterval(() => setState((s) => (s && !s.over ? tick(s, Math.random) : s)), TICK_MS)
    return () => clearInterval(id)
  }, [running, over])

  useEffect(() => {
    if (state && state.score > best) {
      setBest(state.score)
      localStorage.setItem(storageKey, String(state.score))
    }
  }, [state, best, storageKey])

  const steer = useCallback((dir: Dir) => {
    setRunning(true)
    setState((s) => (s && !s.over ? changeDir(s, dir) : s))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const dir = KEY_DIRS[e.key]
      if (dir) {
        e.preventDefault()
        steer(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steer])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const header = (score: number) => (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex gap-2 text-sm">
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Score <span className="font-bold" data-testid="score">{score}</span>
        </div>
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Best <span className="font-bold">{best}</span>
        </div>
      </div>
      <button
        onClick={restart}
        disabled={!state}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-stone-900"
      >
        New Game
      </button>
    </div>
  )

  const hint = (
    <p className="mt-3 text-center text-sm text-fg-muted">Press an arrow key (or swipe) to start.</p>
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        {header(0)}
        <div className="aspect-square rounded-xl bg-surface" data-testid="snake-loading" />
        {hint}
      </div>
    )
  }

  const occupied = new Map<string, 'head' | 'body'>()
  state.snake.forEach((p, i) => occupied.set(`${p.x},${p.y}`, i === 0 ? 'head' : 'body'))

  return (
    <div className="mx-auto w-full max-w-100 select-none">
      {header(state.score)}
      <div
        className="relative grid aspect-square gap-px rounded-xl bg-surface p-2 touch-none"
        style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="snake-board"
      >
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const x = i % GRID
          const y = Math.floor(i / GRID)
          const kind = occupied.get(`${x},${y}`)
          const isFood = state.food.x === x && state.food.y === y
          return (
            <div
              key={i}
              className={
                kind === 'head'
                  ? 'rounded-[2px] bg-accent'
                  : kind === 'body'
                    ? 'rounded-[2px] bg-accent/70'
                    : isFood
                      ? 'rounded-full bg-red-500'
                      : 'rounded-[2px] bg-white/5'
              }
            />
          )
        })}
        {state.over && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/80"
            data-testid="game-over"
          >
            <p className="text-2xl font-bold">Game over</p>
            <p className="text-fg-muted">Score: {state.score}</p>
            <button onClick={restart} className="rounded-lg bg-accent px-4 py-2 font-semibold text-stone-900">
              Try again
            </button>
          </div>
        )}
      </div>
      {hint}
    </div>
  )
}
```

- [ ] **Step 2: GameRenderer에 연결**

`src/components/GameRenderer.tsx`의 임시 `case 'snake': return null`을 교체:
```tsx
import { GameSnake } from '@/components/games/GameSnake'
// ...
    case 'snake':
      return <GameSnake storageKey={`best:${page.slug}`} />
```

- [ ] **Step 3: 레지스트리 엔트리 추가**

`src/lib/games/registry.ts`의 `gamePages` 배열 끝에 추가:
```ts
  {
    slug: 'snake',
    game: 'snake',
    title: 'Play Snake Online — Free Classic Snake Game',
    h1: 'Snake',
    metaDescription:
      'Play the classic Snake game online for free. Eat food, grow longer, and avoid the walls in this timeless arcade game. Works on desktop and mobile — no download needed.',
    shortDescription: 'The timeless snake — eat, grow, survive.',
    howToPlay: [
      'Press any arrow key (or swipe on mobile) to start the game and steer the snake.',
      'Eat the red food to grow longer — each bite is worth one point.',
      'The snake keeps moving in its current direction; you can turn up, down, left, or right, but never straight backwards.',
      'The game ends when the snake hits a wall or runs into its own body.',
    ],
    strategy: [
      'Hug the edges early: sweeping along the walls keeps the middle of the board open for when your snake gets long.',
      'Plan two turns ahead — most deaths come from turning into a corridor your own body just closed off.',
      'Use the classic "lawnmower" pattern, sweeping back and forth in rows, once your snake takes up a big part of the board.',
      'Do not chase food the moment it spawns; approach it from a direction that leaves you an exit.',
      'A gap that looks closed will often open right as you arrive — the tail moves away every tick, so count cells before you panic-turn.',
    ],
    faq: [
      {
        q: 'Is this the classic snake game?',
        a: 'Yes — this is the classic snake formula: eat food, grow longer, avoid the walls and your own body. No power-ups and no gimmicks, just the pure game.',
      },
      {
        q: 'How do I control the snake on mobile?',
        a: 'Swipe anywhere on the board in the direction you want to turn. The snake starts moving on your first swipe.',
      },
      {
        q: "Why can't I reverse direction?",
        a: 'A 180-degree turn would make the head collide with the neck instantly, so classic snake rules only allow 90-degree turns.',
      },
      {
        q: 'What is a good score?',
        a: 'Anything above 20 is solid. Past 40 the board gets crowded and every turn matters — that is where the real game begins.',
      },
    ],
  },
```

- [ ] **Step 4: 게이트**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 통과. build 출력에 `/snake` prerender 확인, sitemap URL 8개.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: Snake 게임 (/snake) — 컴포넌트 + 레지스트리 연결"
```

---

### Task 6: Snake E2E + 전체 게이트 + README 갱신

**Files:**
- Modify: `e2e/smoke.spec.ts`, `README.md`

- [ ] **Step 1: E2E 추가**

`e2e/smoke.spec.ts`에 추가:
```ts
test('snake: 시작 → 자동 전진 → 벽 충돌 게임오버', async ({ page }) => {
  await page.goto('/snake')
  await expect(page.getByTestId('snake-board')).toBeVisible()
  await page.keyboard.press('ArrowRight') // 시작: 중앙(10,10)에서 오른쪽으로
  // 10칸 × 130ms ≈ 1.3초 뒤 벽 충돌이 결정론적으로 발생
  await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('score')).toBeVisible()
})
```

- [ ] **Step 2: README E2E 매트릭스 갱신**

README의 E2E 매트릭스에 행 추가:
```markdown
| Snake | ✅ e2e/smoke.spec.ts (벽 충돌 게임오버) |
```

- [ ] **Step 3: 전체 게이트**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`
Expected: lint 0, 31 유닛, build 전 라우트 prerender, E2E 4/4.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: Snake E2E + README 매트릭스 갱신"
```
