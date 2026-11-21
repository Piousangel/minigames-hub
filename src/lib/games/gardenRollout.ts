// 허브 리디자인 v2 R7(계획서 3장 R7a~f, D7·D8): 113개 게임을 「노을 정원」 틀로 20개씩 옮기는 배치 목록.
//
// - 오리지널 3종 밖의 게임 페이지는 `main[data-world="garden"]`으로 렌더된다(GamePageLayout — R8에서 네온 갈래 삭제).
//   그 스코프 안에서만 --neon-*·--fg 등 토큰을 다시 매핑한다(globals.css 'R7 정원 틀'). 전역 토큰은 그대로.
// - 바깥 틀(제목·목표·리액션·다음 게임·하단 섹션) = 크림·ink, 게임판(`[data-garden-board]`) = 밤 정원 남보라(D8).
// - 배치 순서·선정 이유는 docs/plans/2026-11-19-hub-redesign-v2.md 6장. R7 동안의 되돌리기(slug 1줄 삭제 → 네온 화면)는
//   R8(네온 갈래 삭제)로 없어졌다 — 목록은 이제 '전 게임이 정원 틀 대상인지' 장부(gardenPending)와 e2e·캡처 스크립트용.
// - 선정 규칙(R7a에서 정함): 캔버스로 직접 그리는 게임(getContext)과 하드코딩 색 20개 이상인 게임은 뒤 배치,
//   그 밖에서 퀄리티 장부 점검 끝난 게임(R7a 때 2048·2048-animals·snake 3개 — 전부 넣음) + 트래픽(docs/daily/metrics) 상위 순.
//   e2e/garden-frame.spec.ts 대비 검사(게임판 안 포함)에서 실패가 나는 게임은 그 게임의 결함을 고친 뒤 넣는다
//   (R7a 때 chess — 좌표 8px fg-muted/70, mahjong — 막힌 패 #b9bccb 위 색 글자: 둘 다 예전부터 있던 게임 안 하드코딩).

/** 오리지널 3종: 자기 '방'(하늘·섬)을 직접 그리는 게임. 정원 제목만 쓰고 틀 매핑은 아직 하지 않는다(R7 뒤 배치에서 따로). */
export const GARDEN_ORIGINALS = ['plop-landing', 'acorn-hop', 'slime-slide'] as const

/** 배치별 목록(a~f, R7f로 113개 전부 — 오리지널 3 + 정원 틀 110). 새 게임은 마지막 배치에 넣거나 새 키를 늘린다. */
export const GARDEN_BATCHES = {
  a: [
    '2048',
    '2048-animals',
    'snake',
    'solitaire',
    'battleship',
    'polarity',
    'beatline',
    'quarry',
    'bearing',
    'hogline',
    'countcircle',
    'mancala',
    'typing-test',
    'aim-trainer',
    'minesweeper',
    'sokoban',
    'word-guess',
    'sudoku',
    'flow',
    'clusters',
  ],
  // R7b(11-20): chess·mahjong(대비 결함 수정 뒤 투입) + 캔버스 없음·하드코딩 색 <20인 고전 18개.
  // 트래픽은 chess·mahjong 말고 전부 0(11-15~21 지표)이라 HANDOFF R7a 후보 8개 + 레지스트리 앞쪽 고전 10개
  // (보드 checkers·reversi는 chess와 묶음 — mastermind·dots-and-boxes·maze 등은 R7c 첫 순서, DECISIONS R7b).
  b: [
    'chess',
    'mahjong',
    'memory-game',
    'tetris',
    'tic-tac-toe',
    'connect-four',
    'yahtzee',
    'freecell',
    'spider',
    'jigsaw',
    'sliding-puzzle',
    'reaction-time',
    'hangman',
    'simon',
    'whack-a-mole',
    'rock-paper-scissors',
    'lights-out',
    'nonogram',
    'checkers',
    'reversi',
  ],
  // R7c(11-20): 트래픽 0인 남은 DOM 후보를 레지스트리 순으로 20개(R7b가 넘긴 mastermind·maze 먼저).
  // 전부 getContext 0·하드코딩 색 <20(gem-match 12 — DOM 보석 그리드라 넣음). duplex는 잠긴 팩 글자 대비만 고쳐 넣음.
  // dots-and-boxes(차례 표시 opacity 0.4)·decant(밴드 숫자 hsl 52%/12%)는 대비 수정이 게임 표현을 바꿔 R7d로 미룸
  // → 레지스트리 다음 DOM polytap·deepdive로 채움(DECISIONS R7c, 장부).
  c: [
    'mastermind',
    'maze',
    'number-memory',
    'word-search',
    'gem-match',
    'prospector',
    'zero-hour',
    'overload',
    'ricochet',
    'stackpot',
    'overfold',
    'splice',
    'duplex',
    'overdub',
    'pinwheel',
    'cleave',
    'umbra',
    'fuse',
    'polytap',
    'deepdive',
  ],
  // R7d(11-20): 남은 DOM 게임 레지스트리 순 20개(getContext 0·하드코딩 색 <20, ticker 25·unblock 20은 R7f).
  // R7c가 미룬 dots-and-boxes(쉬는 쪽 차례 글자 opacity 0.4 → muted 색, 점만 흐림)·decant(밴드 숫자 흰/짙은 글자 선택,
  // 같은 bandColor의 interlock도)는 색만 바꾸는 수정으로 넣음(DECISIONS R7d).
  d: [
    'dots-and-boxes',
    'decant',
    'sonar',
    'handful',
    'flapjack',
    'interlock',
    'quadle',
    'equate',
    'reactor',
    'pyramid',
    'tripeaks',
    'golf-solitaire',
    'dominoes',
    'yukon-solitaire',
    'gomoku',
    'kakuro',
    'skew',
    'turntile',
    'stakehouse',
    'grasp',
  ],
  // R7e(11-20): 남은 DOM 게임 18개 전부(getContext 0·하드코딩 색 <20 — 20 미만이라 한 배치로 끝, R7d 인계).
  // loopgrid·carousel은 decant와 같은 색 밴드 숫자 결함이라 bandInk로 색만 고쳐 넣음(DECISIONS R7e).
  // 남는 것: ticker(색 25)·unblock(색 20) + 캔버스 10종 = R7f.
  e: [
    'offbeat',
    'prismbox',
    'gravwell',
    'loopgrid',
    'bisect',
    'slotter',
    'carousel',
    'gridlock',
    'strata',
    'bankshot',
    'morse-relay',
    'lagline',
    'recoil',
    'hunch',
    'fizzbeat',
    'siteswap',
    'shadowfit',
    'slosh',
  ],
  // R7f(11-20, 마지막 배치): 하드코딩 색이 많은 DOM 2개(ticker 25·unblock 20) + 캔버스로 직접 그리는 10종.
  // 캔버스 게임은 판 밖 틀(배경·헤더·버튼·GOAL — DOM)만 정원으로 바뀌고, 캔버스 안 그림은 원칙상 그대로다(D8: 판은 밤 정원이라
  // 예전 어두운 바탕 기준 색이 그대로 읽힌다). 캔버스 안 글자 대비는 DOM 게이트가 못 보므로 scripts/garden-canvas-contrast.mjs로 잰다.
  f: [
    'ticker',
    'unblock',
    'breakout',
    'pong',
    'bubble-shooter',
    'flappy',
    'space-shooter',
    'tower-stack',
    'flywheel',
    'ripple',
    'latch',
    'backspace',
  ],
} as const satisfies Record<string, readonly string[]>

/** 캔버스(getContext)로 판을 직접 그리는 게임 — 정원 틀은 판 밖 DOM만 바꾼다. gardenRollout.test.ts가 소스와 대조한다. */
export const GARDEN_CANVAS = [
  'breakout',
  'pong',
  'bubble-shooter',
  'flappy',
  'space-shooter',
  'tower-stack',
  'flywheel',
  'ripple',
  'latch',
  'backspace',
] as const

export type GardenBatch = keyof typeof GARDEN_BATCHES

/** 정원 틀(크림 바깥 + 밤 정원 게임판)을 적용하는 게임 전체. */
export const GARDEN_FRAMED: ReadonlySet<string> = new Set(Object.values(GARDEN_BATCHES).flat())

/** 이 게임이 속한 배치(없으면 null). e2e·캡처 스크립트가 쓴다. */
export function gardenBatchOf(slug: string): GardenBatch | null {
  for (const [batch, slugs] of Object.entries(GARDEN_BATCHES) as [GardenBatch, readonly string[]][]) {
    if (slugs.includes(slug)) return batch
  }
  return null
}

/**
 * 아직 정원 틀도 오리지널 방도 아닌 게임 slug(레지스트리 순). R7f로 전 게임이 끝나 **빈 배열이어야 한다**
 * (gardenRollout.test.ts '전 게임 정원 틀' 한 줄 검사). 새 게임을 레지스트리에 넣으면 여기 잡혀 테스트가 배치 추가를 요구한다.
 */
export function gardenPending(allSlugs: readonly string[]): string[] {
  return allSlugs.filter((s) => gameWorld(s) === null)
}

/**
 * 게임 페이지의 세계 표시:
 * - 'room'  = 오리지널 3종(자기 방을 그림, 예전과 같은 화면)
 * - 'garden' = 정원 틀 배치 적용
 * - null    = 배치 목록에 없음(R8부터 화면은 정원 틀로 그린다 — 목록 누락은 gardenPending 테스트가 잡는다)
 */
export function gameWorld(slug: string): 'room' | 'garden' | null {
  if ((GARDEN_ORIGINALS as readonly string[]).includes(slug)) return 'room'
  if (GARDEN_FRAMED.has(slug)) return 'garden'
  return null
}
