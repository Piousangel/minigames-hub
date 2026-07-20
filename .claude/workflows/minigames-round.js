export const meta = {
  name: 'minigames-round',
  description: '신규 오리지널 게임 3종 기획→심의→구현 + UI/UX 읽기전용 감사 (20 에이전트)',
  whenToUse: '오리지널 게임 라운드를 돌릴 때. 돌리기 전 EXISTING 상수를 현재 게임 목록으로 갱신할 것 — 낡으면 재탕 아이디어가 나온다. 산출물 배선(registry/GameRenderer/gameMeta/GameIcon/e2e/leaderboard)은 에이전트가 아니라 오케스트레이터가 직접 한다.',
  phases: [
    { title: 'Ideate', detail: '5개 각도에서 오리지널 게임 아이디어 발상' },
    { title: 'Judge', detail: '독창성·중독성·실현성·매력 3인 심의' },
    { title: 'Spec', detail: '승선 3종 설계 명세' },
    { title: 'Build', detail: '엔진+테스트+컴포넌트 구현 (자기 파일만)' },
    { title: 'Audit', detail: 'UI/UX 5개 차원 읽기전용 감사' },
    { title: 'Synthesize', detail: '감사 결과 중복 제거·우선순위' },
  ],
}

const EXISTING = `2048, 2048-animals(동물 테마), snake, minesweeper, memory-game, typing-test, tetris,
sliding-puzzle, breakout, word-guess(워들), tic-tac-toe, reaction-time, connect-four, hangman,
simon(색 순서 반복), whack-a-mole, aim-trainer, sudoku, rock-paper-scissors, pong, lights-out,
mastermind, bubble-shooter, nonogram, sokoban, dots-and-boxes, flappy, checkers, maze,
number-memory, word-search, reversi, gem-match, space-shooter, tower-stack,
prospector(더 팔까 은행에 넣을까), zero-hour(숫자마다 자기 카운트다운), overload(한 탭 연쇄반응),
ricochet(한 탭, 번개가 보드를 훑음), stackpot(정확히 착지 아니면 파산), flywheel(내 타이밍이 템포를 정함),
ripple(물결에 맞춰 팝), ticker(모멘텀 타고 탈출 타이밍), overfold(종이 접어 눈 맞추기),
splice(모서리 잘라 단색 그룹 붕괴), quarry(탐침으로 숨은 표적 몰이), latch(스윙-릴리스-캐치),
decant(색이 곧 밀도인 시험관 분류), backspace(세계를 되감는 5레인 다저), duplex(한 입력, 거울 토큰 둘),
overdub(16스텝 루프에 노트를 영구히 박는다 — 내 과거가 장애물),
pinwheel(핀을 꽂고 판 전체를 90° 회전 — 앵커에 앉은 점만 박힌다),
cleave(전리품을 두 더미로 가르면 라이벌이 고른다),
umbra(어둠에 사라진 구슬의 도착 순간을 외삽해 친다),
fuse(여러 심지가 동시에 탄다 — 손 하나, 방문 순서가 정답),
polytap(F 3박 J 4박, 어긋난 두 클럭을 동시에 살린다),
deepdive(수직 갱도 잠수 — 내려갈수록 값진 보물, 매 칸이 올라올 숨),
sonar(맨해튼 거리 추론 — 핑 하나가 가장 가까운 표적 거리만 반환),
handful(바구니 내용 다 보이되 순서만 숨김 — 한 줌 크기 도박),
flapjack(팬케이크 정렬 — 위 k장을 통째로 뒤집어 큰 것부터 정렬),
interlock(맞물린 두 구슬 고리를 돌려 색 구슬을 홈 아크로),
clusters(Connections식 — 16타일을 숨은 4그룹으로, 4목숨, 데일리),
quadle(Quordle식 — 4개 단어를 한 번에, 9번 추측, 데일리),
equate(Nerdle식 — 숨은 8칸 수식 맞히기, 6번 추측, 데일리),
reactor(네온 idle/클리커 — 탭+모듈 자동생성, 오프라인 수익, 프레스티지 리부트),
solitaire(클론다이크 솔리테어 — draw-3, 파운데이션 완성),
freecell(프리셀 — 전부 오픈, 프리셀 4, 슈퍼무브),
spider(스파이더 솔리테어 — 2덱, 1/2/4 suit, 동일수트 런),
pyramid(피라미드 솔리테어 — 합13 페어 제거),
tripeaks(트라이픽스 솔리테어 — 3봉우리, 위/아래 1랭크 체인),
mahjong(마작 솔리테어 — 144타일 매칭, free 판정, 풀 수 있는 딜),
chess(체스 — 전체 규칙 perft 검증, minimax AI, vs컴퓨터/2P)`

// EXISTING에서 직접 센다. 괄호 안 설명에 쉼표가 있으므로(ricochet, duplex) 먼저 제거해야 한다.
// 프롬프트에 숫자를 하드코딩하면 라운드마다 어긋나므로, 반드시 이 상수를 주입해 쓸 것.
const GAME_COUNT = EXISTING.replace(/\([^)]*\)/g, '').split(',').filter((s) => s.trim()).length

const RULES = `
## 절대 제약 (minigames-hub)
- Next.js 15 **정적 내보내기**. 서버 런타임 없음. **외부 런타임 의존성/CDN 금지**(폰트·이미지·라이브러리 추가 금지).
- 엔진은 **순수·결정론적**: \`Math.random\`/\`Date.now\`/\`performance.now\` **직접 호출 금지**.
  난수는 반드시 주입된 \`Rng = () => number\`로만. 그래야 골든 테스트가 된다.
- Tailwind v4 + globals.css의 네온 CSS 변수(--neon-cyan|magenta|lime|amber|purple|blue|red|green).
- \`prefers-reduced-motion\` 지원 필수. 애니메이션은 transform/opacity만(레이아웃 속성 금지).
- 사운드는 파일이 아니라 Web Audio 합성 — \`useGameSound\` 훅을 쓴다.

## 반드시 재사용할 공통 템플릿 (밋밋한 게임을 새로 만들지 말 것)
- \`import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'\`
  GameShell이 Score/Best 헤더(변화 펄스·점수 플로트), 뮤트 토글, New Game, 오버레이 슬롯을 준다. 게임은 보드만 채운다.
- \`import { useGameSound } from '@/lib/sound/useGameSound'\`
- \`import { useReducedMotion } from '@/lib/useReducedMotion'\`
- 키 입력 시 \`import { isTypingTarget } from '@/lib/isTypingTarget'\`로 입력창 포커스 예외 처리.
- 레퍼런스 구현: \`src/components/games/GameDecant.tsx\`, \`src/lib/games/decant/engine.ts\` — 이 두 파일을 먼저 읽어라.

## 산출 파일 (이 3개만. 다른 파일은 절대 건드리지 마라)
1. \`src/lib/games/<key>/engine.ts\`
2. \`src/lib/games/<key>/engine.test.ts\`  (vitest, \`describe/it/expect\` from 'vitest')
3. \`src/components/games/Game<Pascal>.tsx\`  — \`export function Game<Pascal>({ storageKey }: { storageKey: string })\`

## 공유 파일 편집 금지 (오케스트레이터가 직접 배선한다)
registry.ts, GameRenderer.tsx, gameMeta.ts, GameIcon.tsx, e2e/smoke.spec.ts, leaderboard.ts, globals.css

## 그 외
- 보드 최상위에 \`data-testid="<key>-board"\` 필수.
- SSR 안전: 보드 생성은 클라이언트에서만(useState(null) + useEffect). \`Math.random\`/\`Date\`를 렌더 중 호출하면 hydration이 깨진다.
- 검증: \`pnpm vitest run src/lib/games/<key>\` 와 \`pnpm typecheck\`가 통과해야 한다. 직접 돌려서 GREEN 확인할 것.
`

const IDEA_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array', minItems: 3, maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'key', 'verb', 'pitch', 'why_novel', 'why_addictive', 'feasibility_note'],
        properties: {
          name: { type: 'string' },
          key: { type: 'string', description: `kebab-case slug, 기존 ${GAME_COUNT}종과 겹치지 않을 것` },
          verb: { type: 'string', description: '핵심 동사 하나. 이 게임에서 플레이어가 반복하는 행동' },
          pitch: { type: 'string', description: '한 문장. 카드 설명으로 쓸 수 있게' },
          why_novel: { type: 'string', description: `기존 ${GAME_COUNT}종 중 무엇과 가장 가깝고, 어떻게 다른가` },
          why_addictive: { type: 'string', description: '한 판 더 하게 만드는 루프' },
          feasibility_note: { type: 'string', description: '순수 결정론 엔진으로 구현 가능한 근거' },
        },
      },
    },
  },
}

const JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['scores'],
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'originality', 'addictiveness', 'feasibility', 'appeal', 'note'],
        properties: {
          key: { type: 'string' },
          originality: { type: 'number', description: `1-10. 기존 ${GAME_COUNT}종 대비 진짜 새로운가` },
          addictiveness: { type: 'number', description: '1-10. 한 판 더?' },
          feasibility: { type: 'number', description: '1-10. 순수 엔진 + 정적 사이트로 가능한가' },
          appeal: { type: 'number', description: '1-10. 검색으로 들어온 낯선 사람이 30초 안에 이해하고 즐기나' },
          note: { type: 'string' },
        },
      },
    },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'pascal', 'files', 'tests_pass', 'typecheck_pass', 'summary', 'testid'],
  properties: {
    key: { type: 'string' },
    pascal: { type: 'string', description: '컴포넌트 이름의 파스칼 부분 (Game<Pascal>)' },
    files: { type: 'array', items: { type: 'string' } },
    tests_pass: { type: 'boolean', description: 'pnpm vitest run src/lib/games/<key> 를 실제로 돌린 결과' },
    typecheck_pass: { type: 'boolean', description: 'pnpm typecheck 를 실제로 돌린 결과' },
    testid: { type: 'string' },
    summary: { type: 'string', description: '무엇을 만들었나, 조작법, 점수 규칙' },
  },
}

const AUDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'impact', 'file', 'evidence', 'proposal', 'risk'],
        properties: {
          title: { type: 'string' },
          impact: { type: 'string', enum: ['high', 'medium', 'polish'] },
          file: { type: 'string', description: 'path:line' },
          evidence: { type: 'string', description: '코드/수치 근거. 추측 금지' },
          proposal: { type: 'string', description: '구체적 변경안. 어떤 클래스/값을 무엇으로' },
          risk: { type: 'string', description: '이 변경이 깨뜨릴 수 있는 것' },
        },
      },
    },
  },
}

// ---------------- 트랙 A: 신규 게임 ----------------
const ANGLES = [
  { key: 'physics', brief: '**물리·모멘텀**: 관성, 중력, 탄성, 마찰이 핵심인 게임. 단 latch(스윙)·flappy·pong·breakout·tower-stack과 겹치지 말 것.' },
  { key: 'deduction', brief: '**추론·숨은 정보**: 관찰로 숨은 상태를 좁혀가는 게임. 단 minesweeper·mastermind·quarry·nonogram과 겹치지 말 것.' },
  { key: 'transform', brief: '**공간 변형**: 보드 자체가 접히거나 회전하거나 뒤집히는 게임. 단 overfold(접기)·duplex(거울)·sliding-puzzle과 겹치지 말 것.' },
  { key: 'economy', brief: '**위험·보상 경제**: 얼마나 욕심낼지 계속 판단하는 게임. 단 prospector(더 팔까)·stackpot(정확히 착지)·ticker(탈출 타이밍)와 겹치지 말 것.' },
  { key: 'rhythm', brief: '**리듬·타이밍·순서**: 박자나 순서가 핵심인 게임. 단 simon·flywheel·ripple·reaction-time과 겹치지 말 것.' },
]

async function trackA() {
  phase('Ideate')
  const batches = await parallel(
    ANGLES.map((a) => () =>
      agent(
        `너는 히트 미니게임을 설계하는 게임 디자이너다. minigames-hub(무료 브라우저 미니게임 허브, 광고 수익 목표, 글로벌 영어 검색 트래픽)를 위한 **오리지널** 게임을 3~4개 발상하라.

담당 각도: ${a.brief}

## 이미 있는 ${GAME_COUNT}종 (절대 재탕 금지 — 변형·리스킨도 금지)
${EXISTING}

## 좋은 아이디어의 기준
- **동사 하나**로 설명된다. 그 동사가 새롭다. ("되감는다", "밀도로 가라앉힌다"처럼)
- 규칙은 30초 안에 이해되는데 숙련 천장은 높다.
- 순수 결정론 엔진(주입 Rng)으로 구현 가능하다. 물리 시뮬레이션이 필요하면 정수 틱 기반이어야 한다.
- 낯선 사람이 검색으로 들어와도 튜토리얼 없이 논다.

## 하지 말 것
- 기존 게임에 테마만 씌우기(예: "우주 배경 2048")
- 서버·계정·실시간 멀티플레이가 필요한 것
- 규칙이 3문장을 넘는 것

${RULES}

각 아이디어마다 기존 ${GAME_COUNT}종 중 **가장 가까운 것을 스스로 지목**하고 어떻게 다른지 밝혀라. 못 대면 그건 재탕이다.`,
        { label: `ideate:${a.key}`, phase: 'Ideate', schema: IDEA_SCHEMA },
      ),
    ),
  )

  const ideas = batches.filter(Boolean).flatMap((b) => b.ideas)
  log(`아이디어 ${ideas.length}개 수집 → 심의 시작`)
  if (ideas.length === 0) return { winners: [], builds: [] }

  const catalogue = ideas
    .map((i) => `### ${i.key} — ${i.name}\n동사: ${i.verb}\n피치: ${i.pitch}\n신규성: ${i.why_novel}\n중독성: ${i.why_addictive}\n실현성: ${i.feasibility_note}`)
    .join('\n\n')

  phase('Judge')
  const LENSES = [
    { key: 'originality', brief: `너는 **독창성 심사관**이다. 기존 ${GAME_COUNT}종의 재탕·리스킨을 잔인하게 골라내라. 조금이라도 기존 게임의 변형이면 originality를 4 이하로 줘라.` },
    { key: 'player', brief: '너는 **플레이어 대변인**이다. 검색으로 처음 들어온 사람이 30초 안에 이해하고 한 판 더 하고 싶은지만 본다. 설명이 필요하면 appeal을 낮게 줘라.' },
    { key: 'engineer', brief: '너는 **구현 심사관**이다. 순수 결정론 엔진(주입 Rng, Date.now 금지) + 정적 사이트 + 외부 의존성 0으로 만들 수 있는지만 본다. 물리·경로탐색·대규모 상태는 feasibility를 낮게 줘라.' },
  ]
  const judged = await parallel(
    LENSES.map((l) => () =>
      agent(
        `${l.brief}

아래 후보 전부를 1~10으로 채점하라. 후하게 주지 마라 — 평균 5, 8 이상은 정말 뛰어난 것에만.

## 기존 ${GAME_COUNT}종
${EXISTING}

## 후보
${catalogue}

모든 후보에 대해 key를 정확히 그대로 써서 점수를 매겨라.`,
        { label: `judge:${l.key}`, phase: 'Judge', schema: JUDGE_SCHEMA },
      ),
    ),
  )

  // 집계 — 세 심사관 평균. 실현성에 하드 컷(구현 불가면 아무리 참신해도 탈락).
  const agg = new Map()
  for (const j of judged.filter(Boolean)) {
    for (const s of j.scores) {
      const cur = agg.get(s.key) || { key: s.key, o: [], a: [], f: [], p: [] }
      cur.o.push(s.originality); cur.a.push(s.addictiveness)
      cur.f.push(s.feasibility); cur.p.push(s.appeal)
      agg.set(s.key, cur)
    }
  }
  const avg = (xs) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0)
  const ranked = [...agg.values()]
    .map((v) => ({
      key: v.key,
      originality: avg(v.o), addictiveness: avg(v.a),
      feasibility: avg(v.f), appeal: avg(v.p),
      total: avg(v.o) * 1.2 + avg(v.a) * 1.2 + avg(v.f) * 0.8 + avg(v.p) * 1.0,
    }))
    .filter((v) => v.feasibility >= 5.5 && v.originality >= 5.5)
    .sort((x, y) => y.total - x.total)

  log(`심의 통과 ${ranked.length}개 (실현성<5.5 또는 독창성<5.5 탈락)`)

  // 다양성: 각도가 겹치지 않게 상위 3개
  const byKey = new Map(ideas.map((i) => [i.key, i]))
  const winners = []
  const usedVerbs = new Set()
  for (const r of ranked) {
    const idea = byKey.get(r.key)
    if (!idea) continue
    const verbSig = (idea.verb || '').toLowerCase().slice(0, 12)
    if (usedVerbs.has(verbSig)) continue
    usedVerbs.add(verbSig)
    winners.push({ ...idea, ...r })
    if (winners.length === 3) break
  }
  log(`승선: ${winners.map((w) => `${w.key}(${w.total.toFixed(1)})`).join(', ')}`)
  if (winners.length === 0) return { winners: [], builds: [] }

  // Spec → Build 파이프라인 (게임마다 독립 진행, 배리어 없음)
  const builds = await pipeline(
    winners,
    (w) =>
      agent(
        `너는 시니어 게임 엔지니어다. 아래 게임의 **구현 명세**를 써라. 코드는 아직 쓰지 마라.

## 게임
이름: ${w.name} (key: ${w.key})
동사: ${w.verb}
피치: ${w.pitch}
신규성: ${w.why_novel}
중독성 루프: ${w.why_addictive}
실현성: ${w.feasibility_note}

${RULES}

먼저 \`src/lib/games/decant/engine.ts\`와 \`src/components/games/GameDecant.tsx\`를 읽고 이 레포의 관행을 익혀라.

명세에 반드시 담을 것:
1. **상태 타입** — 엔진의 State 인터페이스 전체
2. **순수 함수 목록** — 시그니처와 각각의 불변식
3. **난수 사용 지점** — 어디서 몇 번, 어떤 순서로 Rng를 소비하는가(결정론 보장)
4. **점수 규칙** — 높을수록 좋은 정수인가? (주간 리더보드 후보가 되려면 그래야 한다)
5. **승/패 조건**
6. **조작** — 키보드 + 터치 양쪽
7. **테스트 계획** — 최소 20개. 골든 시나리오 포함
8. **컴포넌트 구조** — GameShell에 무엇을 넘기고 보드에 무엇을 그리는가
9. **모션** — reduced-motion에서 무엇이 꺼지는가

명세는 다음 에이전트가 그대로 구현할 수 있을 만큼 구체적이어야 한다.`,
        { label: `spec:${w.key}`, phase: 'Spec' },
      ),
    (spec, w) =>
      agent(
        `너는 시니어 게임 엔지니어다. 아래 명세를 **실제 코드로 구현**하라.

## 대상
${w.name} (key: ${w.key}) — ${w.pitch}

## 명세
${spec}

${RULES}

## 작업 순서
1. \`src/lib/games/decant/engine.ts\`, \`src/lib/games/decant/engine.test.ts\`, \`src/components/games/GameDecant.tsx\`를 읽어 관행 파악
2. \`src/lib/games/${w.key}/engine.ts\` 작성 — 순수·결정론. 주입 Rng만
3. \`src/lib/games/${w.key}/engine.test.ts\` 작성 — 최소 20개. 엣지 케이스와 골든 시나리오
4. \`pnpm vitest run src/lib/games/${w.key}\` 를 **실제로 돌려** GREEN 확인
5. \`src/components/games/Game<Pascal>.tsx\` 작성 — GameShell/GameOverlay/useGameSound/useReducedMotion 사용
6. \`pnpm typecheck\` 를 **실제로 돌려** 통과 확인

## 절대 금지
- 위 3개 파일 외 편집(특히 registry.ts, GameRenderer.tsx, gameMeta.ts, GameIcon.tsx, e2e, globals.css, leaderboard.ts)
- 테스트를 통과시키려고 테스트를 무르게 고치기
- \`pnpm build\`/\`pnpm run deploy\` 실행

tests_pass / typecheck_pass 는 **실제 실행 결과**만 보고하라. 안 돌렸으면 false다. 거짓 보고는 배선 단계에서 바로 들통난다.`,
        { label: `build:${w.key}`, phase: 'Build', schema: BUILD_SCHEMA },
      ),
  )

  return { winners, builds: builds.filter(Boolean) }
}

// ---------------- 트랙 B: UI/UX 읽기전용 감사 ----------------
const DIMENSIONS = [
  { key: 'game-feel', brief: '**게임 손맛(juice)**: `src/components/games/Game*.tsx`를 **직접 나열해 전부** 훑어 GameShell 템플릿의 juice(점수 플로트, 변화 펄스, 오버레이, 컨피티, 합성 사운드)를 **채택하지 않았거나 얕게 쓴 게임**을 찾아라. 어떤 게임이 밋밋한가? 무엇이 빠졌나?' },
  { key: 'mobile', brief: '**모바일 경험**: 터치 조작, 보드 크기, 세로 화면에서의 스크롤, 엄지 도달 범위. 데스크톱 전용 조작(호버 의존, 키보드 전용)만 있는 게임이 있는지 찾아라.' },
  { key: 'first-30s', brief: '**첫 30초**: 검색으로 들어온 낯선 사람이 게임 페이지에서 뭘 해야 할지 아는가? hint 문구, 시작 상태, 빈 상태를 점검하라. 설명 없이 못 시작하는 게임을 찾아라.' },
  { key: 'consistency', brief: '**일관성**: 게임 전체에 걸친 편차. 어떤 게임은 Reset, 어떤 게임은 New Game인가? stat 라벨, 오버레이 문구, 난이도 UI가 제각각인가? 구체적으로 어떤 게임이 어떻게 튀는가.' },
  { key: 'retention', brief: '**재방문 동기**: Daily 모드, 연속 기록(streak), 리더보드, 개인 기록이 어떤 게임에 있고 없나. 붙일 만한데 안 붙은 곳은? (리더보드는 "높을수록 좋은 정수 점수"가 있어야만 가능하다)' },
]

async function trackB() {
  phase('Audit')
  const audits = await parallel(
    DIMENSIONS.map((d) => () =>
      agent(
        `너는 시니어 프로덕트 디자이너 겸 프론트엔드 엔지니어다. minigames-hub 레포를 **읽기 전용**으로 감사하라.

담당 차원: ${d.brief}

## 맥락
무료 브라우저 미니게임 허브 ${GAME_COUNT}종. 광고(AdSense) 수익 목표. 수익 논리는 트래픽 × 체류 × 재방문.
레트로 네온 아케이드 디자인 시스템. 라이브: https://quickminigames.site
최근 디자인 감사에서 Design A− / AI Slop A를 받았다 — 기본기는 이미 탄탄하다. **사소한 트집이 아니라 실제로 값어치 있는 것**만 찾아라.

## 읽어야 할 곳
- \`src/components/game-shell/\` — 공통 셸(GameShell, GameOverlay, GameButton, Confetti)
- \`src/components/games/Game*.tsx\` — 게임 컴포넌트 전체(몇 개인지는 직접 나열해서 세라)
- \`src/components/GamePageLayout.tsx\`, \`src/components/GameBrowser.tsx\`, \`src/app/layout.tsx\`
- \`src/app/globals.css\` — 네온 토큰, 모션 토큰
- \`src/lib/leaderboard.ts\`, \`src/lib/games/gameMeta.ts\`, \`src/lib/games/registry.ts\`

## 절대 금지
- **파일 수정 금지.** 너는 읽고 제안만 한다. 구현은 오케스트레이터가 한다.
- \`pnpm build\`/\`deploy\` 실행 금지.

## 보고 기준
- **증거 필수**: 추측 금지. 어떤 파일 몇 줄에 무엇이 있어서 그렇게 판단했는지 대라. 세지 않았으면 "여러 게임"이라 쓰지 말고 실제로 세라.
- **구체적 제안**: "개선하라"가 아니라 "GameSudoku.tsx:140의 X를 Y로"
- **위험 명시**: 이 변경이 무엇을 깨뜨릴 수 있는가. 게임 전체에 걸친 변경이면 그렇게 말하라.
- 이미 잘 돼 있으면 findings를 비워도 된다. 없는 문제를 만들지 마라.

impact는 실제 사용자 영향 기준으로: high=이탈/오해를 부른다, medium=체류·재방문을 갉는다, polish=좋으면 좋은 것.`,
        { label: `audit:${d.key}`, phase: 'Audit', schema: AUDIT_SCHEMA },
      ),
    ),
  )

  const all = audits.filter(Boolean).flatMap((a) => a.findings)
  log(`UI/UX 발견 ${all.length}건 → 종합`)
  if (all.length === 0) return { findings: [], synthesis: '발견 없음' }

  phase('Synthesize')
  const synthesis = await agent(
    `너는 이 제품의 기술 리드다. 5명의 감사관이 각자 다른 차원에서 올린 발견을 종합하라.

## 맥락
minigames-hub — 무료 미니게임 ${GAME_COUNT}종, AdSense 수익 목표(월 5~10만원). 수익 = 트래픽 × 체류 × 재방문.
Design A− / AI Slop A. 기본기는 탄탄하다. 남은 작업 시간은 유한하다.

## 원본 발견 (${all.length}건)
${all.map((f, i) => `### [${i + 1}] ${f.title} (${f.impact})\n파일: ${f.file}\n증거: ${f.evidence}\n제안: ${f.proposal}\n위험: ${f.risk}`).join('\n\n')}

## 할 일
1. **중복 제거** — 여러 감사관이 같은 것을 다르게 말한 것을 묶어라.
2. **증거가 약한 것 탈락** — "여러 게임이 밋밋하다" 같은 셈하지 않은 주장, 파일:줄 없는 주장은 버려라. 왜 버렸는지 밝혀라.
3. **위험 대비 가치로 정렬** — 게임 전체에 걸친 변경은 가치가 아주 크지 않으면 뒤로.
4. **상위 5건**을 골라, 각각에 대해 정확한 구현 계획(어떤 파일의 무엇을 어떻게)과 검증 방법을 써라.
5. **하지 말 것 목록** — 제안됐지만 하면 안 되는 것과 그 이유. (예: 대다수 게임을 망치면서 3개를 고치는 변경)

마크다운으로. 오케스트레이터가 이걸 읽고 바로 구현에 들어간다. 두루뭉술한 말은 쓰지 마라.`,
    { label: 'synthesize', phase: 'Synthesize' },
  )

  return { findings: all, synthesis }
}

const [a, b] = await parallel([trackA, trackB])

return {
  games: {
    winners: a?.winners?.map((w) => ({ key: w.key, name: w.name, pitch: w.pitch, verb: w.verb, total: Number(w.total?.toFixed(2)) })) ?? [],
    builds: a?.builds ?? [],
  },
  uiux: {
    count: b?.findings?.length ?? 0,
    synthesis: b?.synthesis ?? '',
  },
}
