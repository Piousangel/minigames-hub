# M1-b2: Minesweeper · Memory · Typing Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게임 3종(Minesweeper, Memory Game, Typing Speed Test)을 추가해 게임 페이지를 6개로 늘린다 — AdSense 신청 요건 근접.

**Architecture:** 기존 패턴 그대로 — 게임마다 순수 TS 엔진(TDD) + 클라이언트 컴포넌트 + 레지스트리 엔트리(라우트·sitemap·홈 자동 반영). `GamePage` 유니온 멤버는 각 컴포넌트 태스크에서 추가해 `satisfies never` exhaustive가 매 태스크마다 유지되게 한다. 스와이프 훅 추출은 이 3종이 스와이프를 안 쓰므로 하지 않는다(YAGNI).

**Tech Stack:** 기존과 동일. 신규 의존성 없음.

## Global Constraints

- UI 언어는 영어. 상표명 사용 금지. `any` 금지·non-null assertion(`!`) 금지, TypeScript strict. 전 페이지 SSG.
- 게임 엔진은 순수 TS(UI·DOM 무관), rng 주입, 입력 상태 불변(no mutation). TDD 필수.
- 게임은 첫 화면에서 즉시 플레이 가능. 로딩 플레이스홀더는 최종 레이아웃과 동일 구조(CLS 방지).
- 컴포넌트 패턴은 GameSnake를 따른다: 클라이언트 전용 초기화(`useState(null)`+effect), 베스트 기록은 별도 effect에서 persist(업데이터 안 부수효과 금지), localStorage 읽기는 `Number.isFinite` 가드, 키보드 게이트는 `isTypingTarget`.
- 레지스트리 콘텐츠: howToPlay·strategy·faq 각 3개 이상, 영문.
- 게이트: 각 태스크 명시 명령. 패키지 매니저 pnpm. 커밋 트레일러 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Minesweeper 엔진 (TDD)

**Files:**
- Create: `src/lib/games/minesweeper/engine.ts`
- Test: `src/lib/games/minesweeper/engine.test.ts`

**Interfaces:**
- Produces:
  - `MS_SIZE = 9`, `MS_MINES = 10`, `type Rng = () => number`
  - `interface MsCell { mine: boolean; revealed: boolean; flagged: boolean; adjacent: number }`
  - `interface MsState { grid: MsCell[][]; minesPlaced: boolean; over: boolean; won: boolean }` (grid는 `[y][x]`)
  - `newMinesweeper(): MsState` — 빈 그리드, 지뢰는 첫 reveal에서 배치(첫 클릭 안전)
  - `reveal(state, x, y, rng): MsState` — 첫 호출 시 클릭 칸 제외하고 지뢰 배치. 지뢰면 over(전 지뢰 공개). 0칸이면 flood fill. 지뢰 외 전부 공개되면 won
  - `toggleFlag(state, x, y): MsState` — 공개된 칸/게임 종료 시 no-op
  - `flagCount(state): number`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/games/minesweeper/engine.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  flagCount,
  MS_MINES,
  MS_SIZE,
  newMinesweeper,
  reveal,
  toggleFlag,
  type MsState,
} from './engine'

const countRevealed = (s: MsState) => s.grid.flat().filter((c) => c.revealed).length
const countMines = (s: MsState) => s.grid.flat().filter((c) => c.mine).length

describe('newMinesweeper', () => {
  it('9x9 빈 그리드, 지뢰 미배치로 시작한다', () => {
    const s = newMinesweeper()
    expect(s.grid).toHaveLength(MS_SIZE)
    expect(s.grid[0]).toHaveLength(MS_SIZE)
    expect(countMines(s)).toBe(0)
    expect(s.minesPlaced).toBe(false)
  })
})

describe('reveal — 첫 클릭', () => {
  it('첫 reveal에서 지뢰 10개가 배치되고 클릭 칸은 항상 안전하다', () => {
    // rng()=>0: 후보 리스트(클릭 칸 제외, y바깥 x안쪽 순서)의 맨 앞을 10번 뽑는다
    const s = reveal(newMinesweeper(), 0, 0, () => 0)
    expect(countMines(s)).toBe(MS_MINES)
    expect(s.grid[0][0].mine).toBe(false)
    expect(s.grid[0][0].revealed).toBe(true)
    expect(s.minesPlaced).toBe(true)
    expect(s.over).toBe(false)
  })
  it('rng()=>0이면 지뢰는 (1,0)..(8,0),(0,1),(1,1)이고 (0,0)의 adjacent는 3이다', () => {
    const s = reveal(newMinesweeper(), 0, 0, () => 0)
    expect(s.grid[0][1].mine).toBe(true) // (1,0)
    expect(s.grid[1][0].mine).toBe(true) // (0,1)
    expect(s.grid[1][1].mine).toBe(true) // (1,1)
    expect(s.grid[0][0].adjacent).toBe(3)
    expect(countRevealed(s)).toBe(1) // adjacent>0 이므로 flood 없음
  })
})

describe('reveal — flood fill과 승리', () => {
  it('지뢰가 전부 아래쪽에 몰리면 (0,0) 한 번으로 전 안전칸이 열리고 승리한다', () => {
    // rng()=>0.999999: 후보 리스트의 맨 뒤를 10번 뽑는다 → 지뢰 = 8행 전체(9개) + (8,7)
    const s = reveal(newMinesweeper(), 0, 0, () => 0.999999)
    expect(s.grid[8].every((c) => c.mine)).toBe(true)
    expect(s.grid[7][8].mine).toBe(true)
    expect(s.won).toBe(true)
    expect(s.over).toBe(true)
    expect(countRevealed(s)).toBe(MS_SIZE * MS_SIZE - MS_MINES)
  })
})

describe('reveal — 지뢰와 no-op', () => {
  it('지뢰를 밟으면 over, 모든 지뢰가 공개된다', () => {
    const first = reveal(newMinesweeper(), 0, 0, () => 0) // (1,0)은 지뢰
    const s = reveal(first, 1, 0, () => 0)
    expect(s.over).toBe(true)
    expect(s.won).toBe(false)
    expect(s.grid.flat().filter((c) => c.mine && c.revealed)).toHaveLength(MS_MINES)
  })
  it('깃발 꽂힌 칸과 이미 공개된 칸, 종료 후에는 no-op', () => {
    const first = reveal(newMinesweeper(), 0, 0, () => 0)
    const flagged = toggleFlag(first, 5, 5)
    expect(reveal(flagged, 5, 5, () => 0)).toBe(flagged)
    expect(reveal(first, 0, 0, () => 0)).toBe(first)
    const dead = reveal(first, 1, 0, () => 0)
    expect(reveal(dead, 5, 5, () => 0)).toBe(dead)
  })
})

describe('toggleFlag / flagCount', () => {
  it('깃발 토글이 반영되고 공개 칸에는 못 꽂는다', () => {
    const first = reveal(newMinesweeper(), 0, 0, () => 0)
    const f1 = toggleFlag(first, 5, 5)
    expect(f1.grid[5][5].flagged).toBe(true)
    expect(flagCount(f1)).toBe(1)
    expect(flagCount(toggleFlag(f1, 5, 5))).toBe(0)
    expect(toggleFlag(first, 0, 0)).toBe(first) // (0,0)은 공개됨
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test`
Expected: minesweeper 테스트 FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`src/lib/games/minesweeper/engine.ts`:
```ts
export const MS_SIZE = 9
export const MS_MINES = 10

export type Rng = () => number

export interface MsCell {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
}

export interface MsState {
  grid: MsCell[][] // [y][x]
  minesPlaced: boolean
  over: boolean
  won: boolean
}

export function newMinesweeper(): MsState {
  const grid = Array.from({ length: MS_SIZE }, () =>
    Array.from({ length: MS_SIZE }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })),
  )
  return { grid, minesPlaced: false, over: false, won: false }
}

function neighbors(x: number, y: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < MS_SIZE && ny >= 0 && ny < MS_SIZE) out.push([nx, ny])
    }
  }
  return out
}

const cloneGrid = (grid: MsCell[][]): MsCell[][] => grid.map((row) => row.map((c) => ({ ...c })))

function placeMines(grid: MsCell[][], exclude: { x: number; y: number }, rng: Rng): MsCell[][] {
  const next = cloneGrid(grid)
  const candidates: Array<[number, number]> = []
  for (let y = 0; y < MS_SIZE; y++) {
    for (let x = 0; x < MS_SIZE; x++) {
      if (!(x === exclude.x && y === exclude.y)) candidates.push([x, y])
    }
  }
  for (let i = 0; i < MS_MINES; i++) {
    const [picked] = candidates.splice(Math.floor(rng() * candidates.length), 1)
    next[picked[1]][picked[0]].mine = true
  }
  for (let y = 0; y < MS_SIZE; y++) {
    for (let x = 0; x < MS_SIZE; x++) {
      next[y][x].adjacent = neighbors(x, y).filter(([nx, ny]) => next[ny][nx].mine).length
    }
  }
  return next
}

export function reveal(state: MsState, x: number, y: number, rng: Rng): MsState {
  if (state.over) return state
  const target = state.grid[y][x]
  if (target.revealed || target.flagged) return state
  const grid = state.minesPlaced ? cloneGrid(state.grid) : placeMines(state.grid, { x, y }, rng)
  if (grid[y][x].mine) {
    for (const row of grid) {
      for (const c of row) {
        if (c.mine) c.revealed = true
      }
    }
    return { grid, minesPlaced: true, over: true, won: false }
  }
  const stack: Array<[number, number]> = [[x, y]]
  while (stack.length > 0) {
    const item = stack.pop()
    if (!item) break
    const [cx, cy] = item
    const c = grid[cy][cx]
    if (c.revealed || c.flagged || c.mine) continue
    c.revealed = true
    if (c.adjacent === 0) {
      for (const n of neighbors(cx, cy)) stack.push(n)
    }
  }
  const won = grid.every((row) => row.every((c) => c.mine || c.revealed))
  return { grid, minesPlaced: true, over: won, won }
}

export function toggleFlag(state: MsState, x: number, y: number): MsState {
  if (state.over) return state
  if (state.grid[y][x].revealed) return state
  const grid = cloneGrid(state.grid)
  grid[y][x].flagged = !grid[y][x].flagged
  return { ...state, grid }
}

export function flagCount(state: MsState): number {
  return state.grid.flat().filter((c) => c.flagged).length
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: 전체 PASS (기존 32 + 신규 8 = 40건).

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/minesweeper && git commit -m "feat: Minesweeper 엔진 (첫클릭 안전·flood fill·깃발)"
```

---

### Task 2: GameMinesweeper 컴포넌트 + 레지스트리

**Files:**
- Create: `src/components/games/GameMinesweeper.tsx`
- Modify: `src/lib/games/registry.ts` (유니온에 `| { game: 'minesweeper' }` 추가 + 엔트리)
- Modify: `src/components/GameRenderer.tsx` (case 추가)

**Interfaces:**
- Consumes: Task 1 엔진 전체
- Produces: `/minesweeper` 페이지

- [ ] **Step 1: 컴포넌트 구현**

`src/components/games/GameMinesweeper.tsx`:
```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  flagCount,
  MS_MINES,
  MS_SIZE,
  newMinesweeper,
  reveal,
  toggleFlag,
  type MsState,
} from '@/lib/games/minesweeper/engine'

const NUMBER_COLORS: Record<number, string> = {
  1: 'text-blue-400',
  2: 'text-green-400',
  3: 'text-red-400',
  4: 'text-purple-400',
  5: 'text-amber-500',
  6: 'text-teal-400',
  7: 'text-fg',
  8: 'text-fg-muted',
}

export function GameMinesweeper() {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<MsState | null>(null)
  const [flagMode, setFlagMode] = useState(false)

  const restart = useCallback(() => {
    setState(newMinesweeper())
    setFlagMode(false)
  }, [])

  useEffect(() => {
    restart()
  }, [restart])

  const handleCell = useCallback(
    (x: number, y: number, flag: boolean) => {
      setState((s) => {
        if (!s || s.over) return s
        return flag ? toggleFlag(s, x, y) : reveal(s, x, y, Math.random)
      })
    },
    [],
  )

  const header = (minesLeft: number) => (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex gap-2 text-sm">
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Mines <span className="font-bold" data-testid="mines-left">{minesLeft}</span>
        </div>
        <button
          onClick={() => setFlagMode((f) => !f)}
          aria-pressed={flagMode}
          className={`rounded-lg px-3 py-1.5 font-semibold ${flagMode ? 'bg-accent text-stone-900' : 'bg-surface'}`}
        >
          🚩 Flag
        </button>
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
    <p className="mt-3 text-center text-sm text-fg-muted">
      Click to reveal. Right-click (or toggle 🚩 Flag) to mark a mine.
    </p>
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        {header(MS_MINES)}
        <div className="aspect-square rounded-xl bg-surface" data-testid="ms-loading" />
        {hint}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-100 select-none">
      {header(MS_MINES - flagCount(state))}
      <div
        className="relative grid aspect-square gap-px rounded-xl bg-surface p-2"
        style={{ gridTemplateColumns: `repeat(${MS_SIZE}, minmax(0, 1fr))` }}
        data-testid="ms-board"
      >
        {state.grid.flatMap((row, y) =>
          row.map((cell, x) => (
            <button
              key={`${x},${y}`}
              data-testid="ms-cell"
              data-revealed={cell.revealed}
              onClick={() => handleCell(x, y, flagMode)}
              onContextMenu={(e) => {
                e.preventDefault()
                handleCell(x, y, true)
              }}
              className={`flex items-center justify-center rounded-[2px] text-sm font-bold ${
                cell.revealed ? 'bg-white/10' : 'bg-white/5 hover:bg-white/15'
              } ${NUMBER_COLORS[cell.adjacent] ?? ''}`}
            >
              {cell.revealed
                ? cell.mine
                  ? '💣'
                  : cell.adjacent > 0
                    ? cell.adjacent
                    : ''
                : cell.flagged
                  ? '🚩'
                  : ''}
            </button>
          )),
        )}
        {state.over && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/80"
            data-testid="game-over"
          >
            <p className="text-2xl font-bold">{state.won ? 'You win!' : 'Boom!'}</p>
            <button onClick={restart} className="rounded-lg bg-accent px-4 py-2 font-semibold text-stone-900">
              {state.won ? 'Play again' : 'Try again'}
            </button>
          </div>
        )}
      </div>
      {hint}
    </div>
  )
}
```

- [ ] **Step 2: 유니온 멤버 + 렌더러 case + 레지스트리 엔트리**

`src/lib/games/registry.ts` 유니온에 `| { game: 'minesweeper' }` 추가, `gamePages` 끝에 추가:
```ts
  {
    slug: 'minesweeper',
    game: 'minesweeper',
    title: 'Play Minesweeper Online — Free Classic Minesweeper',
    h1: 'Minesweeper',
    metaDescription:
      'Play classic Minesweeper online for free. Reveal safe squares, read the numbers, and flag all 10 mines on a 9x9 board. No download, works on mobile.',
    shortDescription: 'Read the numbers, dodge the mines.',
    howToPlay: [
      'Click any square to start — your first click is always safe.',
      'A number tells you how many mines touch that square, including diagonals.',
      'Right-click (or turn on the 🚩 Flag toggle on mobile) to mark squares you think hide a mine.',
      'Reveal every safe square to win. Click a mine and the game is over.',
    ],
    strategy: [
      'Start from the big open areas: a revealed zero automatically opens all of its neighbors, giving you free information.',
      "If a number already touches exactly that many flags, every other neighbor is safe — this is the game's most-used deduction.",
      'A "1" on a wall or corner is your best friend: it has fewer neighbors, so its mine is easier to pin down.',
      'When two numbers overlap, subtract what they share — patterns like 1-2-1 and 1-2-2-1 have fixed, learnable solutions.',
      'Never guess while a certain deduction exists somewhere on the board. Scan everything before you gamble.',
    ],
    faq: [
      {
        q: 'Can I lose on the first click?',
        a: 'No. Mines are placed after your first click, so the first square you reveal is always safe.',
      },
      {
        q: 'What do the numbers mean?',
        a: 'Each number counts the mines in the up-to-eight squares touching it, including diagonals. A blank square means zero adjacent mines.',
      },
      {
        q: 'How do I flag mines on a phone?',
        a: 'Tap the 🚩 Flag toggle above the board, then tap squares to flag them. Tap the toggle again to go back to revealing.',
      },
      {
        q: 'How many mines are there?',
        a: 'This board is the classic beginner setup: a 9x9 grid with 10 mines. The mine counter shows how many are left unflagged.',
      },
    ],
  },
```

`src/components/GameRenderer.tsx`에 import + case 추가:
```tsx
import { GameMinesweeper } from '@/components/games/GameMinesweeper'
// ...
    case 'minesweeper':
      return <GameMinesweeper />
```

- [ ] **Step 3: 게이트**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 통과. `/minesweeper` prerender, sitemap 9 URL.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: Minesweeper 게임 (/minesweeper)"
```

---

### Task 3: Memory 엔진 (TDD)

**Files:**
- Create: `src/lib/games/memory/engine.ts`
- Test: `src/lib/games/memory/engine.test.ts`

**Interfaces:**
- Produces:
  - `MEMORY_EMOJI: string[]` (8종), `type Rng = () => number`
  - `interface MemoryCard { id: number; emoji: string; matched: boolean }`
  - `interface MemoryState { cards: MemoryCard[]; faceUp: number[]; moves: number; won: boolean }` (faceUp = 미매치 상태로 뒤집힌 카드 인덱스 0~2개)
  - `newMemoryGame(rng): MemoryState` — 8쌍 16장 Fisher–Yates 셔플
  - `flip(state, index): MemoryState` — 두 장째에 매치 판정(+moves). 미스매치면 faceUp 2장 유지(정리는 clearMismatch). 매치/이미 faceUp/2장 상태/승리 후엔 no-op
  - `clearMismatch(state): MemoryState` — faceUp 2장을 내림

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/games/memory/engine.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { clearMismatch, flip, MEMORY_EMOJI, newMemoryGame, type MemoryState } from './engine'

// 4장짜리 미니 상태로 flip 로직을 검증 (엔진은 카드 수에 무관)
const mini = (): MemoryState => ({
  cards: [
    { id: 0, emoji: 'A', matched: false },
    { id: 1, emoji: 'A', matched: false },
    { id: 2, emoji: 'B', matched: false },
    { id: 3, emoji: 'B', matched: false },
  ],
  faceUp: [],
  moves: 0,
  won: false,
})

describe('newMemoryGame', () => {
  it('8쌍 16장, 이모지당 정확히 2장이다', () => {
    const s = newMemoryGame(() => 0)
    expect(s.cards).toHaveLength(16)
    for (const e of MEMORY_EMOJI) {
      expect(s.cards.filter((c) => c.emoji === e)).toHaveLength(2)
    }
    expect(s.moves).toBe(0)
  })
  it('같은 rng 시퀀스면 같은 배치가 나온다 (rng 주입 셔플)', () => {
    expect(newMemoryGame(() => 0)).toEqual(newMemoryGame(() => 0))
  })
})

describe('flip', () => {
  it('첫 장은 faceUp에 쌓이고 moves는 그대로', () => {
    const s = flip(mini(), 0)
    expect(s.faceUp).toEqual([0])
    expect(s.moves).toBe(0)
  })
  it('매치되면 matched 처리되고 faceUp이 비고 moves+1', () => {
    const s = flip(flip(mini(), 0), 1)
    expect(s.cards[0].matched).toBe(true)
    expect(s.cards[1].matched).toBe(true)
    expect(s.faceUp).toEqual([])
    expect(s.moves).toBe(1)
    expect(s.won).toBe(false)
  })
  it('미스매치면 두 장이 faceUp에 남고 moves+1', () => {
    const s = flip(flip(mini(), 0), 2)
    expect(s.faceUp).toEqual([0, 2])
    expect(s.moves).toBe(1)
    expect(s.cards[0].matched).toBe(false)
  })
  it('2장 올라간 상태·같은 카드·matched 카드 flip은 no-op', () => {
    const two = flip(flip(mini(), 0), 2)
    expect(flip(two, 3)).toBe(two)
    const one = flip(mini(), 0)
    expect(flip(one, 0)).toBe(one)
    const matched = flip(flip(mini(), 0), 1)
    expect(flip(matched, 0)).toBe(matched)
  })
  it('마지막 쌍이 맞으면 won', () => {
    const half = flip(flip(mini(), 0), 1)
    const done = flip(flip(half, 2), 3)
    expect(done.won).toBe(true)
    expect(done.moves).toBe(2)
    expect(flip(done, 0)).toBe(done) // 승리 후 no-op
  })
})

describe('clearMismatch', () => {
  it('faceUp 2장을 내리고, 2장 미만이면 no-op', () => {
    const two = flip(flip(mini(), 0), 2)
    expect(clearMismatch(two).faceUp).toEqual([])
    const one = flip(mini(), 0)
    expect(clearMismatch(one)).toBe(one)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test`
Expected: memory 테스트 FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`src/lib/games/memory/engine.ts`:
```ts
export const MEMORY_EMOJI = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉', '🍒', '🥝']

export type Rng = () => number

export interface MemoryCard {
  id: number
  emoji: string
  matched: boolean
}

export interface MemoryState {
  cards: MemoryCard[]
  faceUp: number[] // 미매치 상태로 뒤집힌 카드 인덱스 (0~2개)
  moves: number
  won: boolean
}

export function newMemoryGame(rng: Rng): MemoryState {
  const deck = [...MEMORY_EMOJI, ...MEMORY_EMOJI].map((emoji, i) => ({ id: i, emoji, matched: false }))
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return { cards: deck, faceUp: [], moves: 0, won: false }
}

export function flip(state: MemoryState, index: number): MemoryState {
  if (state.won) return state
  const card = state.cards[index]
  if (!card || card.matched || state.faceUp.includes(index)) return state
  if (state.faceUp.length >= 2) return state // 컴포넌트가 clearMismatch 후 다시 flip
  const faceUp = [...state.faceUp, index]
  if (faceUp.length < 2) return { ...state, faceUp }
  const [a, b] = faceUp
  const moves = state.moves + 1
  if (state.cards[a].emoji === state.cards[b].emoji) {
    const cards = state.cards.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c))
    return { cards, faceUp: [], moves, won: cards.every((c) => c.matched) }
  }
  return { ...state, faceUp, moves }
}

export function clearMismatch(state: MemoryState): MemoryState {
  if (state.faceUp.length < 2) return state
  return { ...state, faceUp: [] }
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: 전체 PASS (40 + 8 = 48건).

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/memory && git commit -m "feat: Memory 엔진 (셔플·매치 판정·moves)"
```

---

### Task 4: GameMemory 컴포넌트 + 레지스트리

**Files:**
- Create: `src/components/games/GameMemory.tsx`
- Modify: `src/lib/games/registry.ts` (유니온 `| { game: 'memory' }` + 엔트리)
- Modify: `src/components/GameRenderer.tsx` (case 추가)

**Interfaces:**
- Consumes: Task 3 엔진, 베스트 기록 = 최소 moves (낮을수록 좋음 — 저장 로직 주의)
- Produces: `/memory-game` 페이지

- [ ] **Step 1: 컴포넌트 구현**

`src/components/games/GameMemory.tsx`:
```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clearMismatch, flip, newMemoryGame, type MemoryState } from '@/lib/games/memory/engine'

const MISMATCH_MS = 900

export function GameMemory({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<MemoryState | null>(null)
  const [best, setBest] = useState(0) // 최소 moves. 0 = 기록 없음
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setState(newMemoryGame(Math.random))
  }, [])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? stored : 0)
  }, [restart, storageKey])

  // 승리 시 최소 moves 기록 (업데이터 밖 persist)
  useEffect(() => {
    if (state?.won && (best === 0 || state.moves < best)) {
      setBest(state.moves)
      localStorage.setItem(storageKey, String(state.moves))
    }
  }, [state, best, storageKey])

  const handleFlip = useCallback((index: number) => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setState((s) => {
      if (!s) return s
      const base = s.faceUp.length >= 2 ? clearMismatch(s) : s
      return flip(base, index)
    })
  }, [])

  // 미스매치 자동 정리
  useEffect(() => {
    if (!state || state.faceUp.length < 2) return
    timer.current = setTimeout(() => setState((s) => (s ? clearMismatch(s) : s)), MISMATCH_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  const header = (moves: number) => (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex gap-2 text-sm">
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Moves <span className="font-bold" data-testid="moves">{moves}</span>
        </div>
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Best <span className="font-bold">{best > 0 ? best : '—'}</span>
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

  const hint = <p className="mt-3 text-center text-sm text-fg-muted">Flip two cards and find every matching pair.</p>

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        {header(0)}
        <div className="aspect-square rounded-xl bg-surface" data-testid="memory-loading" />
        {hint}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-100 select-none">
      {header(state.moves)}
      <div className="relative grid aspect-square grid-cols-4 gap-2 rounded-xl bg-surface p-2" data-testid="memory-board">
        {state.cards.map((card, i) => {
          const shown = card.matched || state.faceUp.includes(i)
          return (
            <button
              key={card.id}
              data-testid="memory-card"
              data-shown={shown}
              onClick={() => handleFlip(i)}
              className={`flex items-center justify-center rounded-lg text-3xl transition ${
                shown ? (card.matched ? 'bg-white/10 opacity-60' : 'bg-white/15') : 'bg-accent/20 hover:bg-accent/30'
              }`}
            >
              {shown ? card.emoji : '?'}
            </button>
          )
        })}
        {state.won && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/80"
            data-testid="game-over"
          >
            <p className="text-2xl font-bold">You win!</p>
            <p className="text-fg-muted">{state.moves} moves</p>
            <button onClick={restart} className="rounded-lg bg-accent px-4 py-2 font-semibold text-stone-900">
              Play again
            </button>
          </div>
        )}
      </div>
      {hint}
    </div>
  )
}
```

- [ ] **Step 2: 유니온 멤버 + 렌더러 case + 레지스트리 엔트리**

유니온에 `| { game: 'memory' }` 추가, 엔트리:
```ts
  {
    slug: 'memory-game',
    game: 'memory',
    title: 'Play Memory Game Online — Free Matching Pairs Game',
    h1: 'Memory Game',
    metaDescription:
      'Play the classic memory matching game online for free. Flip cards, remember what you saw, and find all 8 pairs in as few moves as you can. Great for kids and adults.',
    shortDescription: 'Find all the matching pairs.',
    howToPlay: [
      'Tap or click any card to flip it over and see the picture.',
      'Flip a second card. If the pictures match, the pair stays face up.',
      'If they do not match, both cards flip back — remember where they were!',
      'Match all 8 pairs to win. Fewer moves means a better score.',
    ],
    strategy: [
      'Say what you see (silently): naming the picture and its position makes it far easier to recall than just looking.',
      'Start with cards you have never flipped — new information beats re-checking cards you already know.',
      'When you flip a new card, check your memory first: have you already seen its partner? Only then flip a second card.',
      'Use the grid like a map — remember cards by row and corner ("banana, top-left") rather than as loose images.',
    ],
    faq: [
      {
        q: 'How many cards are there?',
        a: 'The board is a 4x4 grid with 16 cards — 8 matching pairs of pictures, shuffled every game.',
      },
      {
        q: 'What counts as a good score?',
        a: 'Every two flips count as one move. A perfect game is 8 moves; under 14 moves is a strong score for a 4x4 board.',
      },
      {
        q: 'Is this game good for kids?',
        a: 'Yes — memory matching is one of the best simple games for concentration and short-term memory, and the pictures make it friendly for young kids.',
      },
      {
        q: 'Do the cards shuffle every game?',
        a: 'Yes. Every new game deals a fresh random layout, so you cannot memorize positions between rounds.',
      },
    ],
  },
```

`GameRenderer.tsx`:
```tsx
import { GameMemory } from '@/components/games/GameMemory'
// ...
    case 'memory':
      return <GameMemory storageKey={`best:${page.slug}`} />
```

- [ ] **Step 3: 게이트**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 통과. `/memory-game` prerender, sitemap 10 URL.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: Memory 게임 (/memory-game)"
```

---

### Task 5: Typing 엔진 (TDD)

**Files:**
- Create: `src/lib/games/typing/engine.ts`
- Test: `src/lib/games/typing/engine.test.ts`

**Interfaces:**
- Produces:
  - `WORDS: string[]` (일반 영단어 100개), `type Rng = () => number`
  - `sampleWords(count: number, rng: Rng): string[]`
  - `computeWpm(correctChars: number, elapsedMs: number): number` — (correctChars/5) / 분, 반올림. elapsed<=0이면 0
  - `computeAccuracy(correctChars: number, typedChars: number): number` — %, 반올림. typed 0이면 100

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/games/typing/engine.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { computeAccuracy, computeWpm, sampleWords, WORDS } from './engine'

describe('sampleWords', () => {
  it('count만큼 WORDS에서 뽑고 rng가 같으면 결과도 같다', () => {
    const a = sampleWords(50, () => 0)
    expect(a).toHaveLength(50)
    for (const w of a) expect(WORDS).toContain(w)
    expect(a.every((w) => w === WORDS[0])).toBe(true) // rng 0 → 항상 첫 단어
  })
})

describe('computeWpm', () => {
  it('60초에 250자 정타 = 50 WPM', () => {
    expect(computeWpm(250, 60_000)).toBe(50)
  })
  it('30초에 100자 = 40 WPM', () => {
    expect(computeWpm(100, 30_000)).toBe(40)
  })
  it('경과 0이면 0', () => {
    expect(computeWpm(100, 0)).toBe(0)
  })
})

describe('computeAccuracy', () => {
  it('90/100 = 90%', () => {
    expect(computeAccuracy(90, 100)).toBe(90)
  })
  it('아무것도 안 쳤으면 100%', () => {
    expect(computeAccuracy(0, 0)).toBe(100)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test`
Expected: typing 테스트 FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`src/lib/games/typing/engine.ts`:
```ts
export const WORDS = [
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
  'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did',
  'its', 'let', 'put', 'say', 'she', 'too', 'use', 'that', 'with', 'have',
  'this', 'will', 'your', 'from', 'they', 'know', 'want', 'been', 'good', 'much',
  'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make',
  'many', 'more', 'only', 'over', 'such', 'take', 'than', 'them', 'well', 'were',
  'work', 'year', 'back', 'call', 'came', 'each', 'even', 'find', 'give', 'hand',
  'high', 'keep', 'last', 'life', 'live', 'look', 'made', 'most', 'move', 'must',
  'name', 'need', 'next', 'open', 'part', 'play', 'right', 'same', 'tell', 'turn',
]

export type Rng = () => number

export function sampleWords(count: number, rng: Rng): string[] {
  return Array.from({ length: count }, () => WORDS[Math.floor(rng() * WORDS.length)])
}

export function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  return Math.round(correctChars / 5 / (elapsedMs / 60_000))
}

export function computeAccuracy(correctChars: number, typedChars: number): number {
  if (typedChars === 0) return 100
  return Math.round((correctChars / typedChars) * 100)
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: 전체 PASS (48 + 6 = 54건).

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/typing && git commit -m "feat: Typing 엔진 (단어 샘플링·WPM·정확도)"
```

---

### Task 6: GameTyping 컴포넌트 + 레지스트리

**Files:**
- Create: `src/components/games/GameTyping.tsx`
- Modify: `src/lib/games/registry.ts` (유니온 `| { game: 'typing' }` + 엔트리)
- Modify: `src/components/GameRenderer.tsx` (case 추가)

**Interfaces:**
- Consumes: Task 5 엔진. 베스트 = 최고 WPM
- Produces: `/typing-test` 페이지. 60초 테스트, 첫 키입력에 타이머 시작, 스페이스로 단어 확정

- [ ] **Step 1: 컴포넌트 구현**

`src/components/games/GameTyping.tsx`:
```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { computeAccuracy, computeWpm, sampleWords } from '@/lib/games/typing/engine'

const TEST_SECONDS = 60
const WORD_COUNT = 200

interface Progress {
  wordIndex: number
  correctChars: number
  typedChars: number
  results: boolean[] // 단어별 정오
}

const freshProgress = (): Progress => ({ wordIndex: 0, correctChars: 0, typedChars: 0, results: [] })

export function GameTyping({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 단어는 클라이언트에서만 샘플링
  const [words, setWords] = useState<string[] | null>(null)
  const [progress, setProgress] = useState<Progress>(freshProgress())
  const [input, setInput] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(TEST_SECONDS)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [best, setBest] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const restart = useCallback(() => {
    setWords(sampleWords(WORD_COUNT, Math.random))
    setProgress(freshProgress())
    setInput('')
    setSecondsLeft(TEST_SECONDS)
    setRunning(false)
    setFinished(false)
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? stored : 0)
  }, [restart, storageKey])

  useEffect(() => {
    if (!running || finished) return
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [running, finished])

  useEffect(() => {
    if (secondsLeft <= 0 && running) {
      setRunning(false)
      setFinished(true)
    }
  }, [secondsLeft, running])

  const elapsedMs = (TEST_SECONDS - secondsLeft) * 1000
  const wpm = computeWpm(progress.correctChars, finished ? TEST_SECONDS * 1000 : elapsedMs)
  const accuracy = computeAccuracy(progress.correctChars, progress.typedChars)

  // 종료 시 최고 WPM 기록 (업데이터 밖 persist)
  useEffect(() => {
    if (finished && wpm > best) {
      setBest(wpm)
      localStorage.setItem(storageKey, String(wpm))
    }
  }, [finished, wpm, best, storageKey])

  const handleChange = (value: string) => {
    if (finished || !words) return
    if (!running && value.length > 0) setRunning(true)
    if (value.endsWith(' ')) {
      const typed = value.trim()
      if (typed.length === 0) {
        setInput('')
        return
      }
      const target = words[progress.wordIndex]
      const correct = typed === target
      setProgress((p) => ({
        wordIndex: p.wordIndex + 1,
        correctChars: p.correctChars + (correct ? target.length + 1 : 0),
        typedChars: p.typedChars + typed.length + 1,
        results: [...p.results, correct],
      }))
      setInput('')
      return
    }
    setInput(value)
  }

  const header = (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex gap-2 text-sm">
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Time <span className="font-bold" data-testid="typing-timer">{secondsLeft}</span>s
        </div>
        <div className="rounded-lg bg-surface px-3 py-1.5">
          WPM <span className="font-bold" data-testid="wpm">{wpm}</span>
        </div>
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Best <span className="font-bold">{best > 0 ? best : '—'}</span>
        </div>
      </div>
      <button
        onClick={restart}
        disabled={!words}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-stone-900"
      >
        Restart
      </button>
    </div>
  )

  const hint = <p className="mt-3 text-center text-sm text-fg-muted">Type each word and press space. 60 seconds.</p>

  if (!words) {
    return (
      <div className="mx-auto w-full max-w-2xl select-none">
        {header}
        <div className="h-28 rounded-xl bg-surface" data-testid="typing-loading" />
        <div className="mt-3 h-12 rounded-lg bg-surface" />
        {hint}
      </div>
    )
  }

  const visible = words.slice(progress.wordIndex, progress.wordIndex + 18)
  const recent = progress.results.slice(-6)

  return (
    <div className="mx-auto w-full max-w-2xl">
      {header}
      <div className="relative">
        <div
          className="flex min-h-28 flex-wrap content-start gap-x-2 gap-y-1 rounded-xl bg-surface p-4 text-lg leading-relaxed"
          data-testid="typing-words"
        >
          {recent.map((ok, i) => (
            <span key={`r${i}`} className={ok ? 'text-green-400/60' : 'text-red-400/60'}>
              {ok ? '✓' : '✗'}
            </span>
          ))}
          {visible.map((w, i) => (
            <span key={progress.wordIndex + i} className={i === 0 ? 'rounded bg-accent/30 px-1 font-semibold' : 'text-fg-muted'}>
              {w}
            </span>
          ))}
        </div>
        {finished && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-bg/90"
            data-testid="typing-results"
          >
            <p className="text-3xl font-bold">{wpm} WPM</p>
            <p className="text-fg-muted">Accuracy {accuracy}% · {progress.results.filter(Boolean).length} words</p>
            <button onClick={restart} className="mt-2 rounded-lg bg-accent px-4 py-2 font-semibold text-stone-900">
              Try again
            </button>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => handleChange(e.target.value)}
        disabled={finished}
        placeholder="Start typing here…"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        data-testid="typing-input"
        className="mt-3 w-full rounded-lg bg-surface px-4 py-3 text-lg outline-none ring-accent focus:ring-2"
      />
      {hint}
    </div>
  )
}
```

- [ ] **Step 2: 유니온 멤버 + 렌더러 case + 레지스트리 엔트리**

유니온에 `| { game: 'typing' }` 추가, 엔트리:
```ts
  {
    slug: 'typing-test',
    game: 'typing',
    title: 'Typing Speed Test — Free Online WPM Test',
    h1: 'Typing Speed Test',
    metaDescription:
      'Test your typing speed online for free. Type common English words for 60 seconds and get your WPM and accuracy instantly. No sign-up, works on any keyboard.',
    shortDescription: 'How fast can you type? 60-second WPM test.',
    howToPlay: [
      'Click the input box and start typing the highlighted word — the 60-second timer starts on your first keystroke.',
      'Press the space bar to submit each word and move to the next one.',
      'Correct words count toward your WPM; misspelled words hurt your accuracy.',
      'When the timer hits zero you get your words-per-minute score and accuracy.',
    ],
    strategy: [
      'Accuracy first, speed second: a fixed typo costs more time than slow-but-clean typing ever will.',
      'Read one word ahead while your fingers finish the current word — the pause between words is where most WPM is lost.',
      'Keep your eyes on the words, never on the keyboard. If you have to look down, that is the skill to train first.',
      'Use all ten fingers and return to the home row (ASDF–JKL;) after every word.',
      'Take the test a few times in a row: your second and third runs are usually 5-10 WPM faster as you warm up.',
    ],
    faq: [
      {
        q: 'What is WPM and how is it calculated?',
        a: 'WPM means words per minute. Following the standard convention, one "word" is 5 characters (including the space), so WPM = correct characters ÷ 5, scaled to one minute.',
      },
      {
        q: 'What is a good typing speed?',
        a: 'The average is around 40 WPM. 60-70 WPM is good, 80+ is fast, and professional typists reach 100 WPM and beyond.',
      },
      {
        q: 'Do mistakes lower my score?',
        a: 'Misspelled words do not add to your WPM, and they lower your accuracy percentage — so fixing your error rate is the fastest way to raise your score.',
      },
      {
        q: 'Can I retake the test?',
        a: 'Yes, as many times as you like. Hit Restart to get a fresh set of words; your best WPM is saved on this device.',
      },
    ],
  },
```

`GameRenderer.tsx`:
```tsx
import { GameTyping } from '@/components/games/GameTyping'
// ...
    case 'typing':
      return <GameTyping storageKey={`best:${page.slug}`} />
```

- [ ] **Step 3: 게이트**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 통과. `/typing-test` prerender, sitemap 11 URL.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: Typing Speed Test (/typing-test)"
```

---

### Task 7: E2E 3건 + 전체 게이트 + README

**Files:**
- Modify: `e2e/smoke.spec.ts`, `README.md`

- [ ] **Step 1: E2E 추가**

`e2e/smoke.spec.ts`에 추가:
```ts
test('minesweeper: 첫 클릭 → 안전 공개', async ({ page }) => {
  await page.goto('/minesweeper')
  await expect(page.getByTestId('ms-board')).toBeVisible()
  await page.getByTestId('ms-cell').first().click()
  // 첫 클릭은 항상 안전 → 최소 1칸 공개, 게임오버 아님
  await expect.poll(async () => page.locator('[data-revealed="true"]').count()).toBeGreaterThanOrEqual(1)
  await expect(page.getByTestId('game-over')).not.toBeVisible()
})

test('memory: 두 장 뒤집기 → moves 1', async ({ page }) => {
  await page.goto('/memory-game')
  await expect(page.getByTestId('memory-board')).toBeVisible()
  const cards = page.getByTestId('memory-card')
  await cards.nth(0).click()
  await cards.nth(1).click()
  await expect(page.getByTestId('moves')).toHaveText('1')
})

test('typing: 입력 시작 → 타이머 동작 + WPM 표시', async ({ page }) => {
  await page.goto('/typing-test')
  const input = page.getByTestId('typing-input')
  await expect(input).toBeVisible()
  await input.fill('hello ')
  await expect.poll(async () => page.getByTestId('typing-timer').textContent(), { timeout: 5_000 }).not.toBe('60')
  await expect(page.getByTestId('wpm')).toBeVisible()
})
```

- [ ] **Step 2: README 매트릭스 갱신**

```markdown
| Minesweeper | ✅ e2e/smoke.spec.ts (첫 클릭 안전 공개) |
| Memory Game | ✅ e2e/smoke.spec.ts (두 장 뒤집기 moves) |
| Typing Test | ✅ e2e/smoke.spec.ts (타이머·WPM) |
```

- [ ] **Step 3: 전체 게이트**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`
Expected: lint 0, 유닛 54, build 전 라우트 prerender(sitemap 11 URL), E2E 7/7.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: 3종 게임 E2E + README 매트릭스"
```
