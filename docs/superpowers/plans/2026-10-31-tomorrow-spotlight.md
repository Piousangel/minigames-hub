# 내일의 스포트라이트 예고 + 캘린더 알림 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게임오버에서 "내일의 스포트라이트"를 예고하고 `.ics` 반복 알림을 내려받게 하며, 다음 날 홈에서 그 게임을 공개한다.

**Architecture:** 선정(`spotlight.ts`)과 `.ics` 생성(`dailyIcs.ts`)은 React/DOM 비의존 순수 함수로 만들고, 날짜는 컴포넌트 층에서 `todayUTC()`로 읽어 문자열로 넘긴다. 예고 카드(`SpotlightTeaser`)는 `GameOverlay`에, 공개 카드(`SpotlightReveal`)는 `TodayBoard`에 붙인다. 서버·권한·새 저장소 인프라는 없다.

**Tech Stack:** Next.js 15 (정적 export) · React 19 · TypeScript · vitest (engine=node `*.test.ts` / component=jsdom `*.test.tsx`, jsdom이 필요한 `.ts` 테스트는 첫 줄 `// @vitest-environment jsdom`) · Playwright

**Spec:** `docs/superpowers/specs/2026-10-31-tomorrow-spotlight-design.md`

## Global Constraints

- 스포트라이트 풀 = `gameMeta[slug].daily` 인 게임(현재 28종). 풀 크기는 하드코딩하지 않는다.
- 알림은 **00:00 UTC 고정, `RRULE:FREQ=DAILY`**, `.ics` 링크 = `${siteConfig.url}/daily`. 사이트는 알림 권한을 요청하지 않는다.
- 스포트라이트에 새 점수·보상을 주지 않는다. 기존 데일리 스트릭만 그대로 오른다.
- 예고 단계에서 게임 이름·아이콘·slug를 DOM에 넣지 않는다(카테고리만).
- 날짜는 `todayUTC()`(`src/lib/dailyDate.ts`) 단일 소스. 순수 함수는 `new Date()`를 직접 읽지 않고 날짜 문자열/`nowMilliseconds`를 인자로 받는다.
- 변수·함수 이름은 축약하지 않는다(완전한 서술적 이름). 클라이언트 저장소 접근은 전부 try/catch로 감싼다(기존 패턴).
- 새 코드는 TDD(실패하는 테스트 먼저). 커밋은 task 단위, 메시지 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- 사이트 카피는 영어(기존 UI와 동일). md 문서는 한글 본문 + 영어 용어.
- 브랜치는 `feature/tomorrow-spotlight` (main 직접 커밋 금지).

## Review Focus

1. 풀에 게임이 0개/1개 → 크래시 없이 `null`, UI는 아무것도 그리지 않는다. (Task 1, 4)
2. 세션 중 UTC 자정을 넘김 → 예고 카드가 어제 기준 "내일"을 계속 보여 주지 않고 새 날짜로 갱신. (Task 4)
3. `localStorage` 불가/손상 → 예외 없이 동작(본 적 없음으로 취급). (Task 3, 5)
4. `.ics`의 쉼표·세미콜론·개행·역슬래시·멀티바이트·75옥텟 초과 줄 → 유효한 형식 유지. (Task 2)
5. 다운로드 API 없음(`URL.createObjectURL` 미지원) → 예외 없이 "저장 못 했다" 안내. (Task 3, 4)
6. 오늘 스포트라이트를 이미 연 사용자 → 공개 카드에 "Opened today ✓". (Task 5)

---

### Task 1: 스포트라이트 선정 순수 함수

**Files:**
- Create: `src/lib/spotlight.ts`
- Test: `src/lib/spotlight.test.ts`
- Modify: `src/lib/today.ts` (`hashSeed`, `mulberry32`에 `export` 추가 — 중복 구현 금지)
- Modify: `src/lib/dailyStreak.ts` (`prevDayUTC` 옆에 `nextDayUTC` 추가)
- Test: `src/lib/dailyStreak.test.ts` (`nextDayUTC` 케이스 추가)

**Interfaces:**
- Produces:
  - `dayNumberUTC(date: string): number | null` — 'YYYY-MM-DD' → 1970-01-01부터의 일수. 형식/값이 잘못되면 `null`.
  - `pickSpotlight(date: string, pool: readonly string[]): string | null`
  - `dailyGameSlugs(): string[]` — `gamePages` 순서에서 `gameMeta[slug]?.daily` 인 slug.
  - `spotlightFor(date: string): string | null` — `pickSpotlight(date, dailyGameSlugs())`.
  - `nextDayUTC(isoDate: string): string` (`dailyStreak.ts`)

- [ ] **Step 1: 브랜치와 설계 문서 커밋**

```bash
git switch -c feature/tomorrow-spotlight
git add docs/superpowers/specs/2026-10-31-tomorrow-spotlight-design.md docs/superpowers/plans/2026-10-31-tomorrow-spotlight.md
git commit -m "docs: 내일의 스포트라이트 설계·계획"
```

- [ ] **Step 2: `nextDayUTC` 실패하는 테스트** — `dailyStreak.test.ts`에 추가

```ts
it('nextDayUTC: 월말·연말·윤년을 넘긴다', () => {
  expect(nextDayUTC('2026-10-31')).toBe('2026-11-01')
  expect(nextDayUTC('2026-12-31')).toBe('2027-01-01')
  expect(nextDayUTC('2028-02-28')).toBe('2028-02-29')
  expect(nextDayUTC('2028-02-29')).toBe('2028-03-01')
})
```

- [ ] **Step 3: 실패 확인** — Run: `pnpm vitest run src/lib/dailyStreak.test.ts` · Expected: FAIL (`nextDayUTC` is not exported).

- [ ] **Step 4: `nextDayUTC(isoDate: string): string` 구현** — `prevDayUTC`와 같은 방식(UTC `Date`에 +1일).

- [ ] **Step 5: 선정 테스트 작성** (`spotlight.test.ts`, 풀 `s0..s27` 28개 가짜 slug 사용)

  테스트 이름과 단언:
  - `dayNumberUTC`: `'1970-01-01'`→`0`, `'1970-01-02'`→`1`, `'2026-11-01'`→`Math.floor(Date.UTC(2026,10,1)/86_400_000)`, `'abc'`·`''`·`'2026-13-45'`·`'2026-02-30'`→`null`.
  - 같은 `date`·`pool`이면 항상 같은 결과.
  - 빈 풀 → `null`, 잘못된 날짜 → `null`, 풀 1개 → 항상 그 하나.
  - 풀 입력 순서·중복에 영향받지 않는다(섞인 배열·중복 포함 배열이 같은 결과).
  - **주기 안 커버리지:** `dayNumber % 28 === 0` 인 첫 날짜를 테스트 헬퍼로 찾아, 거기서 28일 연속 `pickSpotlight`의 `new Set(...).size === 28`.
  - **경계 중복 없음:** 5개 연속 주기에 대해 (주기 k의 마지막 날 결과) ≠ (주기 k+1의 첫 날 결과). 풀 크기 28과 3 둘 다.
  - 같은 주기 안의 서로 다른 두 날은 결과가 다르다.
  - 실데이터: `dailyGameSlugs().length > 0`이고 모든 항목이 `gameMeta[slug]?.daily === true`; `spotlightFor('2026-11-01')`이 그 목록의 원소.

- [ ] **Step 6: 실패 확인** — Run: `pnpm vitest run src/lib/spotlight.test.ts` · Expected: FAIL (module not found).

- [ ] **Step 7: 구현** — `today.ts`의 `hashSeed`/`mulberry32` export 후 `spotlight.ts` 작성. 알고리즘: 풀을 중복 제거·정렬 → `cycleIndex = floor(dayNumber / poolSize)`, `positionInCycle = dayNumber % poolSize` → `shuffledCycle(cycleIndex)` = 정렬된 풀에 `mulberry32(hashSeed('spotlight:' + cycleIndex))`로 Fisher–Yates. `cycleIndex > 0`이고 `poolSize >= 3`이며 이번 순열의 첫 원소가 **직전 주기 순열의 마지막 원소**와 같으면 첫째·둘째를 맞바꾼다(직전 주기의 마지막 원소는 맞바꿈의 영향을 받지 않으므로 직전 주기의 원본 순열로 비교해도 된다).

- [ ] **Step 8: 통과 확인** — Run: `pnpm vitest run src/lib/spotlight.test.ts src/lib/dailyStreak.test.ts src/lib/today.test.ts` · Expected: PASS (today 기존 테스트 포함).

- [ ] **Step 9: 커밋**

```bash
git add src/lib/spotlight.ts src/lib/spotlight.test.ts src/lib/today.ts src/lib/dailyStreak.ts src/lib/dailyStreak.test.ts
git commit -m "feat(spotlight): 날짜 기반 결정론적 스포트라이트 선정"
```

---

### Task 2: `.ics` 생성 순수 함수

**Files:**
- Create: `src/lib/dailyIcs.ts`
- Test: `src/lib/dailyIcs.test.ts`

**Interfaces:**
- Produces:
  - `nextUtcMidnightMilliseconds(nowMilliseconds: number): number` — **엄밀히 미래**의 다음 UTC 자정(정확히 자정이면 24시간 뒤).
  - `formatIcsUtc(milliseconds: number): string` — `YYYYMMDDTHHMMSSZ`.
  - `escapeIcsText(text: string): string`
  - `foldIcsLine(line: string): string` — 75옥텟 단위, 접는 위치에 `\r\n `, 멀티바이트 문자를 쪼개지 않는다.
  - `interface DailyIcsInput { uid: string; summary: string; description: string; url: string; nowMilliseconds: number }`
  - `buildDailyIcs(input: DailyIcsInput): string`

- [ ] **Step 1: 실패하는 테스트 작성** — 단언:
  - `nextUtcMidnightMilliseconds(Date.UTC(2026,9,31,12))` = `Date.UTC(2026,10,1)`; 정확히 `Date.UTC(2026,10,1)` 입력 → `Date.UTC(2026,10,2)`; `Date.UTC(2026,9,31,23,59,59,999)` → `Date.UTC(2026,10,1)`.
  - `formatIcsUtc(Date.UTC(2026,10,1))` → `'20261101T000000Z'`.
  - `escapeIcsText('a,b;c\\d\ne')` → `'a\\,b\\;c\\\\d\\ne'` (리터럴: `a\,b\;c\\d\ne`).
  - `foldIcsLine`: 200자 ASCII 줄은 모든 조각이 75옥텟 이하이고, `\r\n `을 제거해 합치면 원문과 같다. `'가'.repeat(40)`(120옥텟)도 같은 성질을 만족하며 조각을 `TextDecoder`로 디코드했을 때 `�`가 없다.
  - `buildDailyIcs({ uid: 'daily-reminder@quickminigames.site', summary: "Today's daily puzzles are live", description: 'New daily boards just unlocked.', url: 'https://quickminigames.site/daily', nowMilliseconds: Date.UTC(2026,9,31,12) })`:
    - `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n`로 시작하고 `END:VCALENDAR\r\n`으로 끝난다.
    - `PRODID:`, `UID:daily-reminder@quickminigames.site`, `DTSTAMP:20261031T120000Z`, `DTSTART:20261101T000000Z`, `RRULE:FREQ=DAILY`, `URL:https://quickminigames.site/daily`, `BEGIN:VALARM`, `TRIGGER:PT0S`(시작 시각에 알림)을 포함한다.
    - 모든 `\n`은 `\r\n`의 일부이고, 모든 물리 줄은 75옥텟 이하.
    - 같은 입력 → 같은 출력(결정적).
    - `summary`에 `,;\n`이 있어도 이스케이프되어 줄 구조가 깨지지 않는다.

- [ ] **Step 2: 실패 확인** — Run: `pnpm vitest run src/lib/dailyIcs.test.ts` · Expected: FAIL (module not found).

- [ ] **Step 3: 위 시그니처대로 구현** — RFC 5545 순서(VCALENDAR → VEVENT → VALARM), 모든 내용 줄을 `foldIcsLine`으로 접고 `\r\n`으로 잇는다. `DTSTART`는 `nextUtcMidnightMilliseconds(nowMilliseconds)`. VALARM은 `ACTION:DISPLAY`, `DESCRIPTION:`(summary 재사용), `TRIGGER:PT0S` (내 판단: 시작 시각에 알림이 뜨게 함).

- [ ] **Step 4: 통과 확인** — Run: `pnpm vitest run src/lib/dailyIcs.test.ts` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/dailyIcs.ts src/lib/dailyIcs.test.ts
git commit -m "feat(spotlight): RFC 5545 일일 반복 알림(.ics) 생성"
```

---

### Task 3: 다운로드 헬퍼와 "예고 봄" 저장

**Files:**
- Create: `src/lib/downloadFile.ts`, `src/lib/spotlightSeen.ts`
- Test: `src/lib/downloadFile.test.ts`, `src/lib/spotlightSeen.test.ts` (둘 다 첫 줄 `// @vitest-environment jsdom`)

**Interfaces:**
- Produces:
  - `downloadTextFile(filename: string, mimeType: string, text: string): boolean` — 성공 `true`, `URL.createObjectURL` 없음/예외면 `false`(던지지 않음).
  - `markTeaserSeen(date: string): void` — 키 `spotlight:seen`에 "예고했던 스포트라이트 날짜"를 저장.
  - `wasTeasedFor(date: string): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**
  - `downloadTextFile`: `URL.createObjectURL`/`revokeObjectURL`과 `HTMLAnchorElement.prototype.click`을 스텁 → `true`, 앵커 `download`가 `'quickminigames-daily.ics'`, Blob 타입이 `'text/calendar'`. `URL.createObjectURL`을 `undefined`로 지우면 `false`이고 예외 없음. `createObjectURL`이 던져도 `false`.
  - `spotlightSeen`: `markTeaserSeen('2026-11-01')` 후 `wasTeasedFor('2026-11-01')`=`true`, `'2026-11-02'`=`false`; 아무것도 안 썼으면 `false`; `Storage.prototype.getItem`/`setItem`이 던져도 예외 없이 `false`/무시; 저장값이 JSON 쓰레기여도 `false`.

- [ ] **Step 2: 실패 확인** — Run: `pnpm vitest run src/lib/downloadFile.test.ts src/lib/spotlightSeen.test.ts` · Expected: FAIL.

- [ ] **Step 3: 시그니처대로 구현** — 다운로드는 Blob + 임시 `<a download>` 클릭 후 URL 해제. 저장은 기존 `today.ts`의 try/catch 스타일.

- [ ] **Step 4: 통과 확인** — 같은 명령 · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/downloadFile.ts src/lib/downloadFile.test.ts src/lib/spotlightSeen.ts src/lib/spotlightSeen.test.ts
git commit -m "feat(spotlight): 파일 다운로드 헬퍼와 예고 확인 기록"
```

---

### Task 4: 예고 카드 `SpotlightTeaser` + 게임오버 연결

**Files:**
- Create: `src/components/SpotlightTeaser.tsx`
- Test: `src/components/SpotlightTeaser.test.tsx`
- Modify: `src/components/game-shell/GameOverlay.tsx` (다음 게임 링크 아래, 리더보드 링크 위에 `<SpotlightTeaser />`)
- Test: `src/components/game-shell/GameOverlay.test.tsx` (예고 카드 케이스 추가)

**Interfaces:**
- Consumes: `spotlightFor`, `nextDayUTC`, `todayUTC`, `msUntilNextUTCDay`/`formatCountdown`(dailyStreak), `buildDailyIcs`, `downloadTextFile`, `markTeaserSeen`, `gameMeta`/`DEFAULT_META`, `siteConfig.url`, `useGameNav().slug`, `sendHit(slug, 'spotlight_ics')`.
- Produces: `SpotlightTeaser(): JSX.Element | null` (props 없음). testid: `spotlight-teaser`, `spotlight-countdown`, `spotlight-ics`, `spotlight-ics-status`.

- [ ] **Step 1: 실패하는 테스트 작성** (`vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-10-31T12:00:00Z'))`)
  - 마운트 후 `spotlight-teaser`가 보이고, 텍스트에 `TOMORROW'S SPOTLIGHT`와 내일 스포트라이트의 **카테고리**가 있다.
  - **스포일러 없음:** `container.innerHTML`에 `spotlightFor('2026-11-01')`의 slug, 그 게임의 `h1`(registry)이 **들어 있지 않다**.
  - `spotlight-countdown`이 `12:00:00`을 보이고, 1초 진행 후 `11:59:59`.
  - `spotlight-ics` 클릭 → `downloadTextFile`이 `('quickminigames-daily.ics', 'text/calendar', 내용)`으로 호출되고 내용에 `RRULE:FREQ=DAILY`·`DTSTART:20261101T000000Z`가 있다(모듈 모킹). `sendHit`이 `(현재 게임 slug, 'spotlight_ics')`로 호출. 이후 `spotlight-ics-status`가 저장 안내 문구.
  - `downloadTextFile`이 `false`를 돌려주면 status가 실패 안내 문구이고 예외 없음.
  - 마운트 시 `wasTeasedFor('2026-11-01')`가 `true`(`markTeaserSeen` 호출됨).
  - **자정 롤오버:** 시스템 시각을 `2026-10-31T23:59:58Z`로 두고 3초 진행 → 내일 날짜가 `2026-11-02` 기준으로 갱신되어 `markTeaserSeen('2026-11-02')`가 호출된다.
  - 풀이 비어(`spotlightFor`가 `null`) 있으면 아무것도 렌더하지 않는다(모듈 모킹).
  - `GameOverlay.test.tsx`: `show`일 때 승/패/무 각각 `spotlight-teaser`가 있고, `show={false}`면 없다. 기존 테스트는 그대로 통과.

- [ ] **Step 2: 실패 확인** — Run: `pnpm vitest run src/components/SpotlightTeaser.test.tsx src/components/game-shell/GameOverlay.test.tsx` · Expected: FAIL.

- [ ] **Step 3: `SpotlightTeaser` 구현** — 클라이언트 전용, 준비 전 미렌더(기존 `DailyDock` 패턴). 알림 요약/설명은 영어 문구 상수(`"Today's daily puzzles are live"` / `"New daily boards just unlocked on Quick MiniGames."`), UID는 `daily-reminder@quickminigames.site`(고정 — 재다운로드가 중복 일정을 만들지 않게), 링크는 `${siteConfig.url}/daily`. 매초 틱에서 `todayUTC()`가 바뀌면 내일 날짜·slug를 다시 계산. 기존 오버레이 스타일(작은 텍스트, `neon-*` 토큰)을 따른다.

- [ ] **Step 4: `GameOverlay` 연결** — 위 위치에 한 줄 추가.

- [ ] **Step 5: 통과 확인** — Run: `pnpm vitest run src/components` · Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/components/SpotlightTeaser.tsx src/components/SpotlightTeaser.test.tsx src/components/game-shell/GameOverlay.tsx src/components/game-shell/GameOverlay.test.tsx
git commit -m "feat(spotlight): 게임오버 예고 카드와 캘린더 알림 다운로드"
```

---

### Task 5: 공개 카드 `SpotlightReveal` + 홈 연결

**Files:**
- Create: `src/components/SpotlightReveal.tsx`
- Test: `src/components/SpotlightReveal.test.tsx`
- Modify: `src/components/TodayBoard.tsx` (스트릭/퀘스트 그리드와 "Picks for today" 사이에 `<SpotlightReveal items={items} />`)

**Interfaces:**
- Consumes: `spotlightFor`, `todayUTC`, `wasTeasedFor`, `loadPlayedToday`, `GameCard`, `BrowseItem`(`@/components/GameBrowser`: `slug`, `title`, `description`).
- Produces: `SpotlightReveal({ items }: { items: BrowseItem[] }): JSX.Element | null`. testid: `spotlight-reveal`, `spotlight-teased`, `spotlight-opened`.

- [ ] **Step 1: 실패하는 테스트 작성** (`vi.setSystemTime('2026-11-01T10:00:00Z')`, `items`는 `spotlightFor('2026-11-01')` slug를 포함)
  - `spotlight-reveal`이 보이고 `TODAY'S SPOTLIGHT` 문구와 그 게임으로 가는 링크(`/${slug}`)가 있다.
  - `markTeaserSeen('2026-11-01')`를 먼저 호출했으면 `spotlight-teased`가 보이고, 아니면 없다.
  - `loadPlayedToday`에 그 slug가 있으면(localStorage `quest:2026-11-01`) `spotlight-opened`("Opened today ✓")가 보이고, 없으면 없다.
  - `items`에 그 slug가 없거나 `spotlightFor`가 `null`이면 아무것도 렌더하지 않는다.
  - localStorage가 던져도 렌더가 깨지지 않는다.

- [ ] **Step 2: 실패 확인** — Run: `pnpm vitest run src/components/SpotlightReveal.test.tsx` · Expected: FAIL.

- [ ] **Step 3: 구현 + `TodayBoard` 연결** — `GameCard`를 재사용해 새 카드 스타일을 만들지 않는다. 클라이언트 전용·준비 전 미렌더. 기존 `TodayBoard` 테스트가 있으면 함께 통과시킨다.

- [ ] **Step 4: 통과 확인** — Run: `pnpm vitest run src/components` · Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/components/SpotlightReveal.tsx src/components/SpotlightReveal.test.tsx src/components/TodayBoard.tsx
git commit -m "feat(spotlight): 홈에서 어제 예고한 스포트라이트 공개"
```

---

### Task 6: e2e, 화면 확인, README 범위 정리

**Files:**
- Modify: `e2e/smoke.spec.ts` (테스트 2개 추가)
- Modify: `README.md` ("이번 과제 범위" 절 추가)

- [ ] **Step 1: e2e 작성** — (a) 기존 snake 벽 충돌 게임오버 흐름(같은 파일의 `snake: 시작 → 자동 전진 → 벽 충돌 게임오버` 테스트의 조작을 그대로 사용) 뒤에 `spotlight-teaser`가 보이고, `spotlight-ics` 클릭 시 `page.waitForEvent('download')`가 발생하며 파일명이 `quickminigames-daily.ics`, 내용에 `BEGIN:VCALENDAR`·`RRULE:FREQ=DAILY`. (b) `/` 에서 `spotlight-reveal`이 보인다.

- [ ] **Step 2: 실행** — Run: `pnpm exec playwright test e2e/smoke.spec.ts -g "spotlight|스포트라이트"` · Expected: PASS. (테스트 이름에 `스포트라이트`를 넣을 것)

- [ ] **Step 3: 화면 확인(열린 판단 Q1 결정)** — `pnpm dev` 후 `/snake`를 게임오버까지 진행해 오버레이 스크린샷을 390×844와 1280×800에서 찍는다. **기준:** 예고 카드를 넣고도 "Next: …" 링크와 닫는 조작이 보드 컨테이너 안에서 잘리지 않고 스크롤 없이 보이면 오버레이 유지. 잘리거나 지나치게 산만하면 `<SpotlightTeaser />` 한 줄을 `DailyDock`으로 옮기고(`GameOverlay.tsx`에서 제거, `DailyDock.tsx` 하단 문장 위에 추가), Task 4의 `GameOverlay` 테스트 케이스를 `DailyDock` 쪽으로 옮긴다. 선택과 근거를 커밋 메시지에 남긴다.

- [ ] **Step 4: 전체 검증** — Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm exec playwright test` · Expected: 전부 통과(lint는 error 0, 기존 warning만).

- [ ] **Step 5: README에 과제 범위 절 추가** — 항목: 사용자와 목적 / 핵심 동작 / 이번 범위와 이유 / 기존 vs 이번에 새로 만든 파일 목록 / AI 활용(무엇을 전달하고 무엇을 검토·수정했는지) / 확인한 것·**확인하지 못한 것**(실제 재방문 효과, 캘린더 앱별 가져오기, iOS Safari 다운로드, 수락률) / "재방문이 늘 것이라는 가설" 명시.

- [ ] **Step 6: 실제 브라우저 확인** — Chrome에서 `.ics`를 내려받아 캘린더 앱(Apple/Google 중 쓸 수 있는 것)에 추가해 매일 반복·00:00 UTC·링크를 확인하고 결과를 README의 "확인한 것/못한 것"에 사실대로 적는다. iOS Safari는 기기가 없으면 "확인 못 함"으로 적는다.

- [ ] **Step 7: 커밋**

```bash
git add e2e/smoke.spec.ts README.md
git commit -m "test(spotlight): e2e와 과제 범위 정리"
```
