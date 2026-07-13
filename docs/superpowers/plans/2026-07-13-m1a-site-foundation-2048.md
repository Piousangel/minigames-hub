# M1-a: 사이트 기반 + 2048 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배포 가능한 미니게임 허브의 뼈대 — 2048(클래식 + animals 변형), SEO 인프라(메타·JSON-LD·sitemap), 필수 페이지 — 를 완성한다.

**Architecture:** Next.js App Router 전 페이지 SSG. 게임 로직은 `src/lib/games/*`의 순수 TS 엔진(단위 테스트 대상), UI는 클라이언트 컴포넌트. 모든 게임 페이지는 레지스트리(`registry.ts`) 데이터 하나로 라우트·메타·sitemap·홈 그리드가 전부 생성된다 — 변형 페이지 양산의 기반.

**Tech Stack:** Next.js 15(App Router) + TypeScript(strict) + Tailwind v4 + Vitest(엔진 단위 테스트) + Playwright(스모크 E2E). 백엔드·DB 없음, 상태는 localStorage.

## Global Constraints

- UI 언어는 영어. 상표명(Wordle, Tetris 등) 사용 금지 — 게임명·URL·메타 전부.
- 모든 게임 페이지에 How to play / Strategy & Tips / FAQ 텍스트 섹션 필수 (레지스트리 데이터로 강제).
- `any` 금지, TypeScript strict.
- 게임은 뷰포트 첫 화면에서 플레이 가능해야 함 (게임 위에 다른 콘텐츠 배치 금지).
- 도메인 확정 전까지 `siteConfig.url`은 `https://minigameshub.example`로 두고, 구매 후 이 상수 1곳만 변경한다.
- 디자인 토큰은 `globals.css`의 CSS 변수 기본값으로 시작 — 이후 design-consultation 세션 결과로 교체(구조 변경 없이 변수만).
- 패키지 매니저: pnpm. 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`(임시), `src/app/globals.css`, `src/lib/siteConfig.ts`

**Interfaces:**
- Produces: `siteConfig = { name: string; url: string; description: string }` (`src/lib/siteConfig.ts`), 경로 별칭 `@/*` → `src/*`

- [ ] **Step 1: 설정 파일 생성**

`package.json`:
```json
{
  "name": "minigames-hub",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

`postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } }
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['src/**/*.test.ts'] },
})
```

`.gitignore`:
```
node_modules/
.next/
out/
*.tsbuildinfo
next-env.d.ts
test-results/
playwright-report/
```

- [ ] **Step 2: 앱 셸 생성**

`src/lib/siteConfig.ts`:
```ts
export const siteConfig = {
  name: 'MiniGames Hub', // 브랜드 확정 시 변경
  url: 'https://minigameshub.example', // 도메인 구매 후 변경 (유일한 변경 지점)
  description:
    'Play free classic mini games online — 2048, snake, minesweeper and more. No download, no sign-up.',
}
```

`src/app/globals.css`:
```css
@import 'tailwindcss';

:root {
  --bg: #0f1115;
  --surface: #1a1d24;
  --fg: #e8eaed;
  --fg-muted: #9aa0a8;
  --accent: #f59e0b;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-fg: var(--fg);
  --color-fg-muted: var(--fg-muted);
  --color-accent: var(--accent);
}

body {
  background: var(--bg);
  color: var(--fg);
}
```

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { siteConfig } from '@/lib/siteConfig'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
```

`src/app/page.tsx` (임시 — Task 7에서 교체):
```tsx
export default function Home() {
  return <main className="p-8">MiniGames Hub — coming soon</main>
}
```

- [ ] **Step 3: 설치 및 검증**

Run: `pnpm install && pnpm typecheck && pnpm build`
Expected: 빌드 성공, `○ (Static)` 표시.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: Next.js 15 + Tailwind v4 + Vitest 스캐폴드"
```

---

### Task 2: 2048 엔진 — 행 슬라이드/병합 (TDD)

**Files:**
- Create: `src/lib/games/g2048/engine.ts`
- Test: `src/lib/games/g2048/engine.test.ts`

**Interfaces:**
- Produces: `SIZE = 4`, `type Board = number[][]`, `slideRowLeft(row: number[]): { row: number[]; gained: number }`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/games/g2048/engine.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { slideRowLeft } from './engine'

describe('slideRowLeft', () => {
  it('빈 칸을 건너 왼쪽으로 민다', () => {
    expect(slideRowLeft([0, 2, 0, 4]).row).toEqual([2, 4, 0, 0])
  })
  it('같은 값 쌍을 병합하고 점수를 얻는다', () => {
    expect(slideRowLeft([2, 2, 0, 0])).toEqual({ row: [4, 0, 0, 0], gained: 4 })
  })
  it('네 개 같은 값은 두 쌍으로 병합된다', () => {
    expect(slideRowLeft([2, 2, 2, 2])).toEqual({ row: [4, 4, 0, 0], gained: 8 })
  })
  it('한 턴에 연쇄 병합은 없다 (4,2,2 → 4,4, 8 아님)', () => {
    expect(slideRowLeft([4, 2, 2, 0]).row).toEqual([4, 4, 0, 0])
  })
  it('이동 불가면 그대로', () => {
    expect(slideRowLeft([2, 4, 8, 16]).row).toEqual([2, 4, 8, 16])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test`
Expected: FAIL — `slideRowLeft is not a function` 류.

- [ ] **Step 3: 최소 구현**

`src/lib/games/g2048/engine.ts`:
```ts
export const SIZE = 4

export type Board = number[][] // [row][col], 0 = 빈 칸

export function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const tiles = row.filter((v) => v !== 0)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2)
      gained += tiles[i] * 2
      i++ // 병합된 쌍의 두 번째 타일 소비 — 연쇄 병합 방지
    } else {
      out.push(tiles[i])
    }
  }
  while (out.length < row.length) out.push(0)
  return { row: out, gained }
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test`
Expected: PASS 5건.

- [ ] **Step 5: Commit**

```bash
git add src/lib/games && git commit -m "feat: 2048 엔진 행 슬라이드/병합"
```

---

### Task 3: 2048 엔진 — 보드 이동·스폰·종료 판정 (TDD)

**Files:**
- Modify: `src/lib/games/g2048/engine.ts`
- Test: `src/lib/games/g2048/engine.test.ts` (추가)

**Interfaces:**
- Consumes: Task 2의 `slideRowLeft`, `Board`, `SIZE`
- Produces:
  - `type Direction = 'left' | 'right' | 'up' | 'down'`
  - `type Rng = () => number` (0 이상 1 미만 — 테스트에서 주입)
  - `interface GameState { board: Board; score: number; over: boolean; won: boolean }`
  - `applyMove(board: Board, dir: Direction): { board: Board; gained: number; moved: boolean }`
  - `spawnTile(board: Board, rng: Rng): Board` (빈 칸 하나에 90% 확률 2, 10% 확률 4)
  - `canMove(board: Board): boolean`
  - `newGame(rng: Rng): GameState` (타일 2개 스폰)
  - `move(state: GameState, dir: Direction, rng: Rng): GameState` (이동 없으면 상태 그대로·스폰 없음)

- [ ] **Step 1: 실패하는 테스트 추가**

`engine.test.ts`에 추가:
```ts
import { applyMove, canMove, move, newGame, spawnTile, type Board } from './engine'

const B = (rows: number[][]): Board => rows.map((r) => [...r])

describe('applyMove', () => {
  it('right는 각 행을 오른쪽으로 민다', () => {
    const { board, gained, moved } = applyMove(
      B([[2, 2, 0, 0], [0, 0, 0, 4], [0, 0, 0, 0], [0, 0, 0, 0]]),
      'right',
    )
    expect(board[0]).toEqual([0, 0, 0, 4])
    expect(board[1]).toEqual([0, 0, 0, 4])
    expect(gained).toBe(4)
    expect(moved).toBe(true)
  })
  it('up은 각 열을 위로 민다', () => {
    const { board } = applyMove(
      B([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [0, 0, 0, 0]]),
      'up',
    )
    expect(board.map((r) => r[0])).toEqual([4, 4, 0, 0])
  })
  it('이동이 없으면 moved=false', () => {
    const full = B([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
    expect(applyMove(full, 'left').moved).toBe(false)
  })
})

describe('spawnTile', () => {
  it('rng<0.9면 2를, 아니면 4를 빈 칸에 놓는다', () => {
    const nearFull = B([[2, 4, 8, 16], [16, 8, 4, 2], [2, 4, 8, 16], [16, 8, 4, 0]])
    expect(spawnTile(nearFull, () => 0)[3][3]).toBe(2)
    expect(spawnTile(nearFull, () => 0.95)[3][3]).toBe(4)
  })
})

describe('canMove / move', () => {
  it('병합 가능 칸이 없고 꽉 차면 false', () => {
    expect(canMove(B([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]))).toBe(false)
    expect(canMove(B([[2, 2, 4, 8], [4, 8, 16, 2], [2, 4, 8, 16], [16, 2, 4, 8]]))).toBe(true)
  })
  it('newGame은 타일 2개로 시작한다', () => {
    const s = newGame(() => 0)
    expect(s.board.flat().filter((v) => v > 0)).toHaveLength(2)
    expect(s.score).toBe(0)
  })
  it('move는 이동 발생 시 타일을 스폰하고 점수를 더한다', () => {
    const s = { board: B([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), score: 0, over: false, won: false }
    const next = move(s, 'left', () => 0)
    expect(next.board.flat().filter((v) => v > 0)).toHaveLength(2) // 병합 결과 4 + 스폰 2
    expect(next.score).toBe(4)
  })
  it('이동 불가 방향이면 상태 그대로 (스폰 없음)', () => {
    const s = { board: B([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), score: 0, over: false, won: false }
    expect(move(s, 'left', () => 0)).toBe(s)
  })
  it('2048 도달 시 won=true', () => {
    const s = { board: B([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), score: 0, over: false, won: false }
    expect(move(s, 'left', () => 0).won).toBe(true)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test`
Expected: FAIL — `applyMove is not a function` 류.

- [ ] **Step 3: 구현**

`engine.ts`에 추가:
```ts
export type Direction = 'left' | 'right' | 'up' | 'down'
export type Rng = () => number

export interface GameState {
  board: Board
  score: number
  over: boolean
  won: boolean
}

const transpose = (b: Board): Board => b[0].map((_, c) => b.map((r) => r[c]))
const flipRows = (b: Board): Board => b.map((r) => [...r].reverse())

export function applyMove(board: Board, dir: Direction): { board: Board; gained: number; moved: boolean } {
  // 모든 방향을 '왼쪽 슬라이드'로 정규화: 변환 → slide → 역변환
  const to = dir === 'up' || dir === 'down' ? transpose(board) : board
  const oriented = dir === 'right' || dir === 'down' ? flipRows(to) : to
  let gained = 0
  const slid = oriented.map((row) => {
    const r = slideRowLeft(row)
    gained += r.gained
    return r.row
  })
  const back = dir === 'right' || dir === 'down' ? flipRows(slid) : slid
  const result = dir === 'up' || dir === 'down' ? transpose(back) : back
  const moved = result.some((row, i) => row.some((v, j) => v !== board[i][j]))
  return { board: result, gained, moved }
}

export function spawnTile(board: Board, rng: Rng): Board {
  const empty: Array<[number, number]> = []
  board.forEach((row, i) => row.forEach((v, j) => { if (v === 0) empty.push([i, j]) }))
  if (empty.length === 0) return board
  const [i, j] = empty[Math.floor(rng() * empty.length)]
  const next = board.map((r) => [...r])
  next[i][j] = rng() < 0.9 ? 2 : 4
  return next
}

export function canMove(board: Board): boolean {
  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board.length; j++) {
      if (board[i][j] === 0) return true
      if (j + 1 < board.length && board[i][j] === board[i][j + 1]) return true
      if (i + 1 < board.length && board[i][j] === board[i + 1][j]) return true
    }
  }
  return false
}

export function newGame(rng: Rng): GameState {
  let board: Board = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0))
  board = spawnTile(spawnTile(board, rng), rng)
  return { board, score: 0, over: false, won: false }
}

export function move(state: GameState, dir: Direction, rng: Rng): GameState {
  const { board, gained, moved } = applyMove(state.board, dir)
  if (!moved) return state
  const withSpawn = spawnTile(board, rng)
  return {
    board: withSpawn,
    score: state.score + gained,
    won: state.won || withSpawn.flat().some((v) => v >= 2048),
    over: !canMove(withSpawn),
  }
}
```

주의: `spawnTile`의 테스트는 rng를 두 번 호출(위치, 값)하는 구현을 가정하지 않도록 `() => 0` 같은 상수 rng를 쓴다. 구현은 rng 호출 순서를 `위치 → 값`으로 고정한다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm test`
Expected: 전체 PASS (Task 2 포함 13건).

- [ ] **Step 5: Commit**

```bash
git add src/lib/games && git commit -m "feat: 2048 엔진 이동·스폰·종료 판정"
```

---

### Task 4: 테마 시스템 + 게임 페이지 레지스트리

**Files:**
- Create: `src/lib/games/g2048/themes.ts`
- Create: `src/lib/games/registry.ts`
- Test: `src/lib/games/registry.test.ts`

**Interfaces:**
- Produces:
  - `interface Theme2048 { key: string; tiles: Record<number, string> }`, `themes2048: Record<string, Theme2048>` (`'classic'`, `'animals'`)
  - `interface GamePage { slug: string; game: '2048'; themeKey: string; title: string; h1: string; metaDescription: string; shortDescription: string; howToPlay: string[]; strategy: string[]; faq: Array<{ q: string; a: string }> }`
  - `gamePages: GamePage[]` — 라우트·sitemap·홈 그리드의 단일 SSOT

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/games/registry.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { gamePages } from './registry'
import { themes2048 } from './g2048/themes'

describe('gamePages 레지스트리', () => {
  it('slug는 유일하고 URL-safe다', () => {
    const slugs = gamePages.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/)
  })
  it('모든 페이지에 SEO 텍스트 섹션이 있다', () => {
    for (const g of gamePages) {
      expect(g.howToPlay.length).toBeGreaterThanOrEqual(3)
      expect(g.strategy.length).toBeGreaterThanOrEqual(3)
      expect(g.faq.length).toBeGreaterThanOrEqual(3)
    }
  })
  it('2048 페이지의 themeKey는 실제 테마를 가리킨다', () => {
    for (const g of gamePages.filter((g) => g.game === '2048')) {
      expect(themes2048[g.themeKey]).toBeDefined()
    }
  })
  it('2048 테마는 2~2048 타일 표기를 모두 가진다', () => {
    const required = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]
    for (const t of Object.values(themes2048)) {
      for (const v of required) expect(t.tiles[v], `${t.key}:${v}`).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`src/lib/games/g2048/themes.ts`:
```ts
export interface Theme2048 {
  key: string
  tiles: Record<number, string> // 타일 값 → 표시 문자(숫자 또는 이모지)
}

export const themes2048: Record<string, Theme2048> = {
  classic: {
    key: 'classic',
    tiles: Object.fromEntries([2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048].map((v) => [v, String(v)])),
  },
  animals: {
    key: 'animals',
    tiles: { 2: '🐭', 4: '🐹', 8: '🐰', 16: '🦊', 32: '🐱', 64: '🐶', 128: '🐺', 256: '🦁', 512: '🐯', 1024: '🐻', 2048: '🐉' },
  },
}
```

`src/lib/games/registry.ts`:
```ts
export interface GamePage {
  slug: string
  game: '2048' // Plan 2에서 'snake' | 'minesweeper' | ... 로 확장
  themeKey: string
  title: string // <title>
  h1: string
  metaDescription: string
  shortDescription: string // 홈 카드용 한 줄
  howToPlay: string[]
  strategy: string[]
  faq: Array<{ q: string; a: string }>
}

export const gamePages: GamePage[] = [
  {
    slug: '2048',
    game: '2048',
    themeKey: 'classic',
    title: 'Play 2048 Online — Free, No Download',
    h1: '2048',
    metaDescription:
      'Play 2048 online for free. Slide the tiles, merge matching numbers, and reach the 2048 tile. Works on desktop and mobile — no download or sign-up needed.',
    shortDescription: 'Merge tiles to reach 2048.',
    howToPlay: [
      'Use your arrow keys (or swipe on mobile) to slide all tiles in one direction.',
      'When two tiles with the same number touch, they merge into one tile with double the value.',
      'After every move, a new tile (2 or 4) appears in a random empty cell.',
      'Reach the 2048 tile to win — or keep going for a higher score. The game ends when no moves are left.',
    ],
    strategy: [
      'Pick one corner and keep your highest tile there for the whole game — most players use the bottom-left.',
      'Prefer two directions (e.g. left and down) and avoid the opposite ones unless forced. This keeps your board ordered.',
      'Build tiles in a descending "snake" pattern along one edge so merges chain naturally into your corner.',
      'Never make a move that lifts your biggest tile out of its corner — one careless swipe can unravel the board.',
      'Slow down in the endgame: when the board is over half full, count what each move spawns space for before you swipe.',
    ],
    faq: [
      { q: 'Is 2048 free to play?', a: 'Yes — this version of 2048 is completely free, with no download, installation, or account required. It runs in your browser on desktop and mobile.' },
      { q: 'Can I keep playing after reaching 2048?', a: 'Yes. Reaching the 2048 tile wins the game, but you can continue playing to chase 4096, 8192, and a higher score.' },
      { q: 'Is 2048 a game of luck or skill?', a: 'Mostly skill. Tile spawns are random, but corner strategy and disciplined move directions let good players reach 2048 consistently.' },
      { q: 'Does my best score save?', a: 'Your best score is saved in your browser (localStorage), so it persists between visits on the same device.' },
    ],
  },
  {
    slug: '2048-animals',
    game: '2048',
    themeKey: 'animals',
    title: 'Play 2048 Animals Online — Cute Animal Merge Game',
    h1: '2048 Animals',
    metaDescription:
      'Play 2048 Animals free online — merge cute animals from mouse to dragon in this animal-themed 2048 game. No download needed, works on mobile.',
    shortDescription: 'The classic 2048 with cute animals.',
    howToPlay: [
      'Swipe or use arrow keys to slide every animal tile in one direction.',
      'When two identical animals touch, they merge and evolve into the next animal.',
      'The chain goes from mouse all the way up to the dragon — the animal version of the 2048 tile.',
      'A new animal appears after each move. The game ends when the board is full and nothing can merge.',
    ],
    strategy: [
      'The rules are identical to classic 2048, so the same corner strategy applies: keep your strongest animal parked in one corner.',
      'Learn the animal order early (mouse → hamster → rabbit → fox → …) so you can read the board at a glance.',
      'Stick to two swipe directions to keep the animals sorted from strongest to weakest.',
      'If you get stuck, look for the smallest pair on the board first — clearing small animals opens space safely.',
    ],
    faq: [
      { q: 'What is 2048 Animals?', a: 'It is the classic 2048 puzzle with animals instead of numbers. Matching animals merge and evolve into the next animal in the chain, ending at the dragon.' },
      { q: 'What is the animal order?', a: 'Mouse, hamster, rabbit, fox, cat, dog, wolf, lion, tiger, bear, and finally the dragon — which is the equivalent of the 2048 tile.' },
      { q: 'Is it harder than normal 2048?', a: 'The mechanics are identical, so it plays the same. Some players find animals easier to track than numbers; others prefer the classic tiles.' },
    ],
  },
]
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test`
Expected: 전체 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/games && git commit -m "feat: 2048 테마 시스템 + 게임 페이지 레지스트리(classic·animals)"
```

---

### Task 5: Game2048 컴포넌트 + 게임 페이지 레이아웃

**Files:**
- Create: `src/components/games/Game2048.tsx`
- Create: `src/components/GamePageLayout.tsx`
- Create: `src/components/GameRenderer.tsx`

**Interfaces:**
- Consumes: Task 3 엔진 전체, Task 4 `Theme2048`/`GamePage`
- Produces:
  - `<Game2048 theme={Theme2048} storageKey={string} />` — 키보드·스와이프 플레이 가능한 클라이언트 컴포넌트
  - `<GameRenderer page={GamePage} />` — `page.game`에 따라 게임 컴포넌트 선택
  - `<GamePageLayout page={GamePage}>{게임}</GamePageLayout>` — h1 + 게임(첫 화면) + How to play/Strategy/FAQ 섹션

- [ ] **Step 1: 컴포넌트 구현**

`src/components/games/Game2048.tsx`:
```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { move, newGame, type Direction, type GameState } from '@/lib/games/g2048/engine'
import type { Theme2048 } from '@/lib/games/g2048/themes'

const KEY_DIRS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

const TILE_STYLES: Record<number, string> = {
  0: 'bg-white/5',
  2: 'bg-amber-100 text-stone-800',
  4: 'bg-amber-200 text-stone-800',
  8: 'bg-orange-300 text-stone-900',
  16: 'bg-orange-400 text-white',
  32: 'bg-orange-500 text-white',
  64: 'bg-red-500 text-white',
  128: 'bg-yellow-400 text-stone-900',
  256: 'bg-yellow-500 text-stone-900',
  512: 'bg-yellow-600 text-white',
  1024: 'bg-amber-600 text-white',
  2048: 'bg-accent text-stone-900',
}

export function Game2048({ theme, storageKey }: { theme: Theme2048; storageKey: string }) {
  // SSR 불일치 방지: 초기 보드는 클라이언트에서만 생성
  const [state, setState] = useState<GameState | null>(null)
  const [best, setBest] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const restart = useCallback(() => setState(newGame(Math.random)), [])

  useEffect(() => {
    restart()
    setBest(Number(localStorage.getItem(storageKey) ?? 0))
  }, [restart, storageKey])

  const doMove = useCallback(
    (dir: Direction) => {
      setState((s) => {
        if (!s || s.over) return s
        const next = move(s, dir, Math.random)
        if (next.score > best) {
          setBest(next.score)
          localStorage.setItem(storageKey, String(next.score))
        }
        return next
      })
    },
    [best, storageKey],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[e.key]
      if (dir) {
        e.preventDefault()
        doMove(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doMove])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  if (!state) {
    return <div className="mx-auto aspect-square w-full max-w-100 rounded-xl bg-surface" data-testid="board-loading" />
  }

  return (
    <div className="mx-auto w-full max-w-100 select-none">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-2 text-sm">
          <div className="rounded-lg bg-surface px-3 py-1.5">
            Score <span className="font-bold" data-testid="score">{state.score}</span>
          </div>
          <div className="rounded-lg bg-surface px-3 py-1.5">
            Best <span className="font-bold">{best}</span>
          </div>
        </div>
        <button onClick={restart} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-stone-900">
          New Game
        </button>
      </div>
      <div
        className="relative grid aspect-square grid-cols-4 gap-2 rounded-xl bg-surface p-2 touch-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="board"
      >
        {state.board.flat().map((v, i) => (
          <div
            key={i}
            data-testid={v > 0 ? 'tile' : 'cell'}
            className={`flex items-center justify-center rounded-lg text-2xl font-bold ${TILE_STYLES[v] ?? TILE_STYLES[2048]}`}
          >
            {v > 0 ? theme.tiles[v] ?? v : ''}
          </div>
        ))}
        {state.over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/80" data-testid="game-over">
            <p className="text-2xl font-bold">Game over</p>
            <button onClick={restart} className="rounded-lg bg-accent px-4 py-2 font-semibold text-stone-900">
              Try again
            </button>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-sm text-fg-muted">Arrow keys or swipe to move the tiles.</p>
    </div>
  )
}
```

`src/components/GameRenderer.tsx`:
```tsx
import { Game2048 } from '@/components/games/Game2048'
import { themes2048 } from '@/lib/games/g2048/themes'
import type { GamePage } from '@/lib/games/registry'

export function GameRenderer({ page }: { page: GamePage }) {
  switch (page.game) {
    case '2048':
      return <Game2048 theme={themes2048[page.themeKey]} storageKey={`best:${page.slug}`} />
  }
}
```

`src/components/GamePageLayout.tsx`:
```tsx
import type { GamePage } from '@/lib/games/registry'

export function GamePageLayout({ page, children }: { page: GamePage; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-center text-3xl font-bold">{page.h1}</h1>
      {children}
      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">How to play</h2>
        <ul className="list-disc space-y-2 pl-5 text-fg-muted">
          {page.howToPlay.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">Strategy &amp; tips</h2>
        <ul className="list-disc space-y-2 pl-5 text-fg-muted">
          {page.strategy.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">FAQ</h2>
        <div className="space-y-4">
          {page.faq.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold">{q}</h3>
              <p className="text-fg-muted">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: 타입 검증**

Run: `pnpm typecheck`
Expected: 에러 0.

- [ ] **Step 3: Commit**

```bash
git add src/components && git commit -m "feat: Game2048 컴포넌트 + 게임 페이지 레이아웃"
```

---

### Task 6: 게임 페이지 동적 라우트 + SEO 메타·JSON-LD

**Files:**
- Create: `src/app/[slug]/page.tsx`

**Interfaces:**
- Consumes: `gamePages`, `GameRenderer`, `GamePageLayout`, `siteConfig`
- Produces: `/2048`, `/2048-animals` 정적 페이지 (generateStaticParams, `dynamicParams = false`)

- [ ] **Step 1: 라우트 구현**

`src/app/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GamePageLayout } from '@/components/GamePageLayout'
import { GameRenderer } from '@/components/GameRenderer'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'

export const dynamicParams = false

export function generateStaticParams() {
  return gamePages.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = gamePages.find((g) => g.slug === slug)
  if (!page) return {}
  return {
    title: { absolute: page.title },
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
  }
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = gamePages.find((g) => g.slug === slug)
  if (!page) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: page.h1,
    url: `${siteConfig.url}/${page.slug}`,
    description: page.metaDescription,
    playMode: 'SinglePlayer',
    applicationCategory: 'Game',
    gamePlatform: 'Web browser',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <GamePageLayout page={page}>
        <GameRenderer page={page} />
      </GamePageLayout>
    </>
  )
}
```

- [ ] **Step 2: 수동 검증**

Run: `pnpm dev` 후 `http://localhost:3000/2048`, `http://localhost:3000/2048-animals` 열기.
Expected: 게임이 첫 화면에서 플레이 가능(키보드·스와이프), 아래로 스크롤하면 3개 텍스트 섹션. 존재하지 않는 slug는 404.

- [ ] **Step 3: Commit**

```bash
git add src/app && git commit -m "feat: 게임 동적 라우트 + 메타데이터 + VideoGame JSON-LD"
```

---

### Task 7: 홈페이지(게임 그리드) + 헤더/푸터

**Files:**
- Modify: `src/app/page.tsx` (임시 내용 교체)
- Modify: `src/app/layout.tsx` (헤더/푸터 추가)

**Interfaces:**
- Consumes: `gamePages`, `siteConfig`

- [ ] **Step 1: 구현**

`src/app/page.tsx` 전체 교체:
```tsx
import Link from 'next/link'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Free Online Mini Games</h1>
      <p className="mb-8 text-fg-muted">{siteConfig.description}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {gamePages.map((g) => (
          <Link
            key={g.slug}
            href={`/${g.slug}`}
            className="rounded-xl bg-surface p-4 transition hover:bg-white/10"
          >
            <h2 className="font-semibold">{g.h1}</h2>
            <p className="mt-1 text-sm text-fg-muted">{g.shortDescription}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
```

`src/app/layout.tsx`의 `<body>` 내용 교체:
```tsx
<body className="flex min-h-screen flex-col antialiased">
  <header className="border-b border-white/10">
    <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
      <a href="/" className="font-bold text-accent">{siteConfig.name}</a>
      <a href="/about" className="text-sm text-fg-muted hover:text-fg">About</a>
    </nav>
  </header>
  <div className="flex-1">{children}</div>
  <footer className="border-t border-white/10 py-6 text-center text-sm text-fg-muted">
    <div className="mb-2 space-x-4">
      <a href="/about" className="hover:text-fg">About</a>
      <a href="/privacy" className="hover:text-fg">Privacy</a>
      <a href="/terms" className="hover:text-fg">Terms</a>
      <a href="/contact" className="hover:text-fg">Contact</a>
    </div>
    <p>© 2026 {siteConfig.name}. All games are free to play.</p>
  </footer>
</body>
```

- [ ] **Step 2: 수동 검증**

Run: `pnpm dev` 후 `/` 열기.
Expected: 게임 카드 2개(2048, 2048 Animals), 클릭 시 게임 페이지 이동, 푸터 링크 4개(다음 Task에서 404 해소).

- [ ] **Step 3: Commit**

```bash
git add src/app && git commit -m "feat: 홈 게임 그리드 + 헤더/푸터"
```

---

### Task 8: 필수 페이지 (About / Privacy / Terms / Contact)

**Files:**
- Create: `src/app/about/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/contact/page.tsx`
- Create: `src/components/ProsePage.tsx`

**Interfaces:**
- Consumes: `siteConfig`
- Produces: AdSense 심사에 필요한 신뢰 페이지 4종

- [ ] **Step 1: 공통 레이아웃 + 4개 페이지 구현**

`src/components/ProsePage.tsx`:
```tsx
export function ProsePage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{title}</h1>
      <div className="space-y-4 leading-relaxed text-fg-muted [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-fg">
        {children}
      </div>
    </main>
  )
}
```

`src/app/about/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { ProsePage } from '@/components/ProsePage'
import { siteConfig } from '@/lib/siteConfig'

export const metadata: Metadata = { title: 'About', alternates: { canonical: '/about' } }

export default function AboutPage() {
  return (
    <ProsePage title={`About ${siteConfig.name}`}>
      <p>
        {siteConfig.name} is a collection of free browser games you can play instantly — no downloads,
        no installs, and no account required. Every game on this site is built by hand to load fast,
        work great on both desktop and mobile, and respect your time.
      </p>
      <p>
        We focus on classic puzzle and arcade games that are easy to learn but hard to master: number
        merge puzzles, snake, minesweeper, memory games, and more. Each game page also includes clear
        rules, practical strategy tips, and answers to common questions.
      </p>
      <p>
        New games and game variants are added regularly. If you have a suggestion or found a bug,
        we would love to hear from you on the <a href="/contact" className="text-accent">contact page</a>.
      </p>
    </ProsePage>
  )
}
```

`src/app/privacy/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { ProsePage } from '@/components/ProsePage'
import { siteConfig } from '@/lib/siteConfig'

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } }

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy Policy">
      <p>Last updated: July 13, 2026</p>
      <h2>What we collect</h2>
      <p>
        {siteConfig.name} does not require an account and does not collect personal information
        directly. Game progress and best scores are stored locally in your browser (localStorage)
        and never leave your device.
      </p>
      <h2>Analytics</h2>
      <p>
        We use privacy-respecting analytics to understand aggregate traffic (page views, referrers,
        approximate region). This data is not used to identify individual visitors.
      </p>
      <h2>Advertising</h2>
      <p>
        This site may display ads served by third-party advertising partners such as Google AdSense.
        These partners may use cookies to serve ads based on your prior visits to this or other
        websites. You can opt out of personalized advertising at{' '}
        <a href="https://adssettings.google.com" className="text-accent">Google Ads Settings</a>.
      </p>
      <h2>Contact</h2>
      <p>Questions about this policy? Reach us via the <a href="/contact" className="text-accent">contact page</a>.</p>
    </ProsePage>
  )
}
```

`src/app/terms/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { ProsePage } from '@/components/ProsePage'
import { siteConfig } from '@/lib/siteConfig'

export const metadata: Metadata = { title: 'Terms of Use', alternates: { canonical: '/terms' } }

export default function TermsPage() {
  return (
    <ProsePage title="Terms of Use">
      <p>Last updated: July 13, 2026</p>
      <p>
        By using {siteConfig.name}, you agree to these terms. All games are provided free of charge,
        "as is", for personal entertainment. We make no guarantees about availability or fitness for
        any particular purpose.
      </p>
      <p>
        The games and original content on this site are our own work. Game mechanics (such as sliding
        tile puzzles) are common public-domain concepts; we do not use trademarks or assets belonging
        to other games or companies.
      </p>
      <p>
        We may update these terms or discontinue any game at any time. Continued use of the site
        after changes means you accept the updated terms.
      </p>
    </ProsePage>
  )
}
```

`src/app/contact/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { ProsePage } from '@/components/ProsePage'

export const metadata: Metadata = { title: 'Contact', alternates: { canonical: '/contact' } }

export default function ContactPage() {
  return (
    <ProsePage title="Contact">
      <p>
        Found a bug, have a game suggestion, or want to get in touch? Email us at{' '}
        <a href="mailto:hello@minigameshub.example" className="text-accent">hello@minigameshub.example</a>{' '}
        and we will get back to you as soon as we can.
      </p>
      <p>We read every message — feedback directly shapes which games get built next.</p>
    </ProsePage>
  )
}
```

(연락 이메일은 도메인 확정 시 `siteConfig.url`과 함께 실제 주소로 교체.)

- [ ] **Step 2: 검증 및 Commit**

Run: `pnpm typecheck && pnpm build`
Expected: `/about` `/privacy` `/terms` `/contact` 모두 Static 생성.

```bash
git add src/app src/components && git commit -m "feat: About/Privacy/Terms/Contact 페이지"
```

---

### Task 9: sitemap.xml + robots.txt

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`

**Interfaces:**
- Consumes: `gamePages`, `siteConfig`

- [ ] **Step 1: 구현**

`src/app/sitemap.ts`:
```ts
import type { MetadataRoute } from 'next'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ['', '/about', '/privacy', '/terms', '/contact']
  return [
    ...staticPaths.map((p) => ({ url: `${siteConfig.url}${p}`, changeFrequency: 'monthly' as const })),
    ...gamePages.map((g) => ({
      url: `${siteConfig.url}/${g.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
```

`src/app/robots.ts`:
```ts
import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/siteConfig'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  }
}
```

- [ ] **Step 2: 검증 및 Commit**

Run: `pnpm build` 후 `curl http://localhost:3000/sitemap.xml`(dev 또는 start 상태에서).
Expected: 정적 5 + 게임 2 = URL 7개.

```bash
git add src/app && git commit -m "feat: sitemap + robots"
```

---

### Task 10: Playwright 스모크 E2E

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `package.json` (스크립트·devDependency 추가)

**Interfaces:**
- Consumes: 실행 중인 앱 전체

- [ ] **Step 1: 설치 및 설정**

Run: `pnpm add -D @playwright/test && pnpm exec playwright install chromium`

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command: 'pnpm build && pnpm start -p 3100',
    url: 'http://localhost:3100',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
})
```

`package.json` scripts에 추가: `"e2e": "playwright test"`

- [ ] **Step 2: 스모크 테스트 작성**

`e2e/smoke.spec.ts`:
```ts
import { expect, test } from '@playwright/test'

test('홈에서 게임 카드로 이동할 수 있다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Free Online Mini Games')
  await page.getByRole('link', { name: /2048 Animals/ }).click()
  await expect(page).toHaveURL(/\/2048-animals/)
})

test('2048: 로드 → 조작 → 상태 변화', async ({ page }) => {
  await page.goto('/2048')
  await expect(page.getByTestId('board')).toBeVisible()
  await expect(page.getByTestId('tile')).toHaveCount(2) // 초기 타일 2개

  // 방향 4개를 눌러 최소 1회 이동을 보장 → 스폰으로 타일 3개 이상
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
    await page.keyboard.press(key)
  }
  await expect
    .poll(async () => page.getByTestId('tile').count())
    .toBeGreaterThanOrEqual(3)
})

test('게임 페이지에 SEO 텍스트 섹션이 있다', async ({ page }) => {
  await page.goto('/2048')
  await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Strategy/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'FAQ' })).toBeVisible()
})
```

- [ ] **Step 3: 실행 확인**

Run: `pnpm e2e`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: Playwright 스모크 E2E (홈·2048·SEO 섹션)"
```

---

### Task 11: 프로덕션 빌드 검증 + 배포 체크리스트

**Files:**
- Create: `README.md`

- [ ] **Step 1: 전체 게이트 실행**

Run: `pnpm typecheck && pnpm test && pnpm build && pnpm e2e`
Expected: 전부 통과. build 출력에서 모든 라우트가 `○ (Static)`인지 확인.

- [ ] **Step 2: README 작성**

`README.md`:
```markdown
# MiniGames Hub

Free online mini games. Next.js SSG + Vercel.

## Commands
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm test` — 엔진 단위 테스트 (Vitest)
- `pnpm e2e` — 스모크 E2E (Playwright)

## E2E 매트릭스
| 게임 | 스모크 E2E |
|---|---|
| 2048 (classic) | ✅ e2e/smoke.spec.ts |
| 2048 Animals | ✅ 홈 내비 테스트로 커버 |

## 배포 (수동 — 사용자가 직접)
1. 도메인 구매 후 `src/lib/siteConfig.ts`의 `url`·브랜드명, `src/app/contact/page.tsx`의 이메일 변경
2. Vercel 프로젝트 연결 (GitHub repo import), 도메인 연결
3. Google Search Console 등록 → sitemap.xml 제출
4. GA4 프로퍼티 생성 → 측정 ID를 layout에 추가 (M1-b에서)
```

- [ ] **Step 3: Commit**

```bash
git add README.md && git commit -m "docs: README + 배포 체크리스트"
```
