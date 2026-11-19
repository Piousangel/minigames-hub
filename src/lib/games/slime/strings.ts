import type { Outcome } from './types'

/** 화면 문구 테이블. 정식 출시는 영어(사이트가 영어 전용), 시험판은 한국어. 나중에 언어를 늘릴 때 여기만 추가한다. */
export interface SlimeText {
  outcome: Record<Outcome, string>
  failBubble: Record<Outcome, string>
  win: string
  perfect: string
  scoreLine: (stars: number, starPts: number, ink: number, total: number) => string
  hintBubble: string
  startBubble: string
  startStatus: string
  running: string
  banNear: string
  scrollNote: string
  tooShort: string
  kakaoNote: string // <b>…</b> 강조 포함 문자열을 쓰지 않도록 앞·강조·뒤로 분리
  kakaoBold: string
  inAppNote: string // 카톡 외 인앱 브라우저(인스타·네이버 등)용 앞부분. 강조·뒤는 kakaoBold·kakaoTail을 같이 쓴다
  kakaoTail: string
  stageGroup: string
  stageLabel: (n: number) => string
  ink: (pct: number) => string
  soundOn: string
  soundOff: string
  retry: string
  next: string
  allClear: string
  copy: (n: number) => string
  copied: (n: number) => string
  copyFail: string
  canvasLabel: string
}

export const KO: SlimeText = {
  outcome: { nest: '도착!', spiked: '독꽃에 닿았어요', fell: '떨어졌어요', stalled: '멈췄어요', timeout: '시간이 다 됐어요' },
  failBubble: { nest: '', spiked: '앗, 독꽃!', fell: '떨어졌어요', stalled: '멈췄어요', timeout: '멈췄어요' },
  win: '도착!',
  perfect: '완벽해요!',
  scoreLine: (stars, starPts, ink, total) => `도착! ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)} 별 ${starPts} + 잉크 ${ink} = ${total}점`,
  hintBubble: '이 길로 그어 보세요 (힌트)',
  startBubble: '말랑이 아래에서 꽃까지 선을 그어요',
  startStatus: '말랑이 아래에서 시작해 꽃까지 선을 그어요',
  running: '미끄러지는 중…',
  banNear: '말랑이 바로 근처(점선 안)에는 못 그어요',
  scrollNote: '스크롤은 보드 바깥(위·아래·옆 띠)에서 해요',
  tooShort: '선이 너무 짧아요(40px 이상)',
  kakaoNote: '카카오톡 안에서는 화면이 움직일 수 있어요. 오른쪽 아래 ⋮(또는 공유) → ',
  kakaoBold: '다른 브라우저로 열기',
  inAppNote: '앱 안 브라우저에서는 화면이 움직일 수 있어요. 메뉴(⋮ 또는 공유) → ',
  kakaoTail: '를 쓰면 더 잘 그려져요.',
  stageGroup: '스테이지 선택',
  stageLabel: (n) => `스테이지 ${n}`,
  ink: (p) => `잉크 ${p}%`,
  soundOn: '소리 켜기',
  soundOff: '소리 끄기',
  retry: '다시 그리기',
  next: '다음 스테이지',
  allClear: '모두 클리어! 🎉',
  copy: (n) => `플레이 기록 복사 (${n}판)`,
  copied: (n) => `${n}판 기록을 복사했어요`,
  copyFail: '복사 실패 — 아래 상자를 길게 눌러 복사해 주세요',
  canvasLabel: '말랑 미끄럼길 게임판. 손가락으로 선을 그어 말랑이를 꽃까지 보내요',
}

export const EN: SlimeText = {
  outcome: { nest: 'Landed!', spiked: 'Touched a poison flower', fell: 'Fell off', stalled: 'Got stuck', timeout: 'Out of time' },
  failBubble: { nest: '', spiked: 'Oops, poison!', fell: 'Fell off', stalled: 'Stuck', timeout: 'Stuck' },
  win: 'Landed!',
  perfect: 'Perfect!',
  scoreLine: (stars, starPts, ink, total) => `Landed! ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)} stars ${starPts} + ink ${ink} = ${total} pts`,
  hintBubble: 'Try this path (hint)',
  startBubble: 'Draw a line from Mallang to the flower',
  startStatus: 'Draw a line from Mallang down to the flower',
  running: 'Sliding…',
  banNear: 'You cannot draw inside the dotted circle',
  scrollNote: 'To scroll the page, swipe on the strips outside the board',
  tooShort: 'That line is too short (40px or more)',
  kakaoNote: 'The page may move while you draw inside KakaoTalk. Tap ⋮ (or Share) at the bottom right, then ',
  kakaoBold: 'Open in another browser',
  inAppNote: 'The page may move while you draw inside an in-app browser. Open the menu (⋮ or Share), then ',
  kakaoTail: ' for smoother drawing.',
  stageGroup: 'Choose stage',
  stageLabel: (n) => `Stage ${n}`,
  ink: (p) => `Ink ${p}%`,
  soundOn: 'Turn sound on',
  soundOff: 'Turn sound off',
  retry: 'Redraw',
  next: 'Next stage',
  allClear: 'All clear! 🎉',
  copy: (n) => `Copy play log (${n})`,
  copied: (n) => `Copied ${n} runs`,
  copyFail: 'Copy failed. Long-press the box below to copy',
  canvasLabel: 'Slime Slide game board. Draw a line with your finger to send Mallang to the flower',
}
