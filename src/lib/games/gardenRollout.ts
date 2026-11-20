// 허브 리디자인 v2 R7(계획서 3장 R7a~f, D7·D8): 113개 게임을 「노을 정원」 틀로 20개씩 옮기는 배치 목록.
//
// - 여기 있는 slug의 게임 페이지는 `main[data-world="garden"]`으로 렌더된다(GamePageLayout).
//   그 스코프 안에서만 --neon-*·--fg 등 토큰을 다시 매핑한다(globals.css 'R7 정원 틀'). 전역 토큰은 그대로.
// - 바깥 틀(제목·목표·리액션·다음 게임·하단 섹션) = 크림·ink, 게임판(`[data-garden-board]`) = 밤 정원 남보라(D8).
// - **되돌리기 = 배열에서 slug 1줄 삭제.** 배치 순서·선정 이유는 docs/plans/2026-11-19-hub-redesign-v2.md 6장.
// - 선정 규칙(R7a에서 정함): 캔버스로 직접 그리는 게임(getContext)과 하드코딩 색 20개 이상인 게임은 뒤 배치,
//   그 밖에서 퀄리티 장부 점검 끝난 게임(R7a 때 2048·2048-animals·snake 3개 — 전부 넣음) + 트래픽(docs/daily/metrics) 상위 순.
//   e2e/garden-frame.spec.ts 대비 검사(게임판 안 포함)에서 실패가 나는 게임은 그 게임의 결함을 고친 뒤 넣는다
//   (R7a 때 chess — 좌표 8px fg-muted/70, mahjong — 막힌 패 #b9bccb 위 색 글자: 둘 다 예전부터 있던 게임 안 하드코딩).

/** 오리지널 3종: 자기 '방'(하늘·섬)을 직접 그리는 게임. 정원 제목만 쓰고 틀 매핑은 아직 하지 않는다(R7 뒤 배치에서 따로). */
export const GARDEN_ORIGINALS = ['plop-landing', 'acorn-hop', 'slime-slide'] as const

/** 배치별 목록. 새 배치는 키를 하나 늘린다(b~f). */
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
} as const satisfies Record<string, readonly string[]>

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
 * 게임 페이지의 세계 표시:
 * - 'room'  = 오리지널 3종(자기 방을 그림, 예전과 같은 화면)
 * - 'garden' = 정원 틀 배치 적용
 * - null    = 아직 예전 네온 화면
 */
export function gameWorld(slug: string): 'room' | 'garden' | null {
  if ((GARDEN_ORIGINALS as readonly string[]).includes(slug)) return 'room'
  if (GARDEN_FRAMED.has(slug)) return 'garden'
  return null
}
