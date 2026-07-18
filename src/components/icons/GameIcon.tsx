import type { ReactNode } from 'react'

/**
 * GameIcon — 사이트 22개 게임을 위한 커스텀 네온 라인 아이콘 세트.
 *
 * 패밀리 규칙(응집성):
 *  - viewBox="0 0 24 24", fill="none", stroke="currentColor"
 *  - stroke-width 1.75, linecap/linejoin round
 *  - 색은 오직 currentColor → 부모(카드)의 게임별 네온 accent + glow 상속
 *  - 일부 도형에만 저투명 currentColor fill로 은은한 깊이(라인 아이콘 성격 유지)
 *  - 2px 그리드 정렬 / 동일 광학 두께 / 동일 코너 라운딩
 *
 * 장식용이므로 aria-hidden + focusable=false. 카드에 이미 텍스트 라벨이 있다.
 */

// 저투명 fill 프리셋 — 도형에 은은한 깊이를 주되 라인 아이콘 성격 유지
const soft = { fill: 'currentColor', fillOpacity: 0.12 } as const
const softer = { fill: 'currentColor', fillOpacity: 0.18 } as const
const solid = { fill: 'currentColor' } as const

const glyphs: Record<string, ReactNode> = {
  // 2048 — 병합되어 쌓이는 숫자 타일 두 장
  '2048': (
    <>
      <rect x="3.5" y="3.5" width="11" height="11" rx="2" />
      <rect x="9.5" y="9.5" width="11" height="11" rx="2" {...soft} />
    </>
  ),

  // 2048-animals — 발바닥(패드 + 발가락 4개)
  '2048-animals': (
    <>
      <ellipse cx="12" cy="15.5" rx="4.6" ry="3.9" {...soft} />
      <circle cx="6.5" cy="10.5" r="1.6" {...soft} />
      <circle cx="10" cy="7.4" r="1.7" {...soft} />
      <circle cx="14" cy="7.4" r="1.7" {...soft} />
      <circle cx="17.5" cy="10.5" r="1.6" {...soft} />
    </>
  ),

  // snake — 안으로 감기는 뱀 코일 + 머리/혀
  snake: (
    <>
      <path d="M6.5 8.5h8.5v7.5h-6.5v-4.5h3.5" />
      <path d="M6.5 8.5l-2-1.3M6.5 8.5l-2 1.3" />
      <circle cx="9" cy="8.5" r="0.55" {...solid} />
    </>
  ),

  // minesweeper — 스파이크 달린 지뢰 + 스파크
  minesweeper: (
    <>
      <circle cx="11" cy="13" r="5.5" {...soft} />
      <path d="M11 7.5V5M11 18.5V21M5.5 13H3M16.5 13H19M7.1 9.1L5.5 7.5M14.9 9.1l1.6-1.6M7.1 16.9L5.5 18.5M14.9 16.9l1.6 1.6" />
      <path d="M18.6 3.5v3M17.1 5h3" />
    </>
  ),

  // memory-game — 뒤집히는 카드 두 장(한 장에 심볼)
  'memory-game': (
    <>
      <rect x="3.5" y="4.5" width="9" height="13" rx="1.5" {...soft} />
      <path d="M8 8.5v6M5 11.5h6" />
      <rect x="11.5" y="6.5" width="9" height="13" rx="1.5" />
    </>
  ),

  // typing-test — 키보드 바디 + 키 + 스페이스바
  'typing-test': (
    <>
      <rect x="2.5" y="7.5" width="19" height="10" rx="2" {...soft} />
      <path d="M5.5 11h1.5M9.5 11h1.5M13 11h1.5M16.5 11h1.5" />
      <path d="M8 14.5h8" />
    </>
  ),

  // tetris — T 테트로미노 블록 클러스터(셀 심)
  tetris: (
    <>
      <path d="M4 6.5h15v5h-5v5h-5v-5H4z" {...soft} />
      <path d="M9 6.5v5M14 6.5v5" />
    </>
  ),

  // sliding-puzzle — 한 칸 빈 3x3 그리드 + 화살표
  'sliding-puzzle': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v12M3 9h18M3 15h12" />
      <path d="M11 18h4.5M14 16.5l1.7 1.5-1.7 1.5" />
    </>
  ),

  // breakout — 벽돌 + 공 + 패들
  breakout: (
    <>
      <rect x="3.5" y="3.5" width="17" height="5.5" rx="1" {...soft} />
      <path d="M3.5 6.25h17M9 3.5v2.75M15 3.5v2.75M6 6.25V9M12 6.25V9M18 6.25V9" />
      <circle cx="16" cy="14.5" r="1.3" {...solid} />
      <rect x="7" y="18.7" width="10" height="1.8" rx="0.9" {...soft} />
    </>
  ),

  // word-guess — 글자 타일 3칸(가운데 "A")
  'word-guess': (
    <>
      <rect x="2.5" y="8.5" width="6" height="7" rx="1" />
      <rect x="9" y="8.5" width="6" height="7" rx="1" {...soft} />
      <rect x="15.5" y="8.5" width="6" height="7" rx="1" />
      <path d="M10.4 14L12 9.8 13.6 14M10.9 12.6h2.2" />
    </>
  ),

  // tic-tac-toe — # 격자 + X + O
  'tic-tac-toe': (
    <>
      <path d="M9 4v16M15 4v16M4 9h16M4 15h16" />
      <path d="M5 5l3 3M8 5l-3 3" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),

  // reaction-time — 번개
  'reaction-time': (
    <>
      <path d="M13 2L6 12.5h5L10 22l8-11h-5z" {...soft} />
    </>
  ),

  // connect-four — 보드 + 가운데 열이 채워진 원반
  'connect-four': (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="8" cy="7.5" r="1.7" />
      <circle cx="12" cy="7.5" r="1.7" {...softer} />
      <circle cx="16" cy="7.5" r="1.7" />
      <circle cx="8" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" {...softer} />
      <circle cx="16" cy="12" r="1.7" />
      <circle cx="8" cy="16.5" r="1.7" />
      <circle cx="12" cy="16.5" r="1.7" {...softer} />
      <circle cx="16" cy="16.5" r="1.7" />
    </>
  ),

  // hangman — 교수대 + 매달린 형상
  hangman: (
    <>
      <path d="M3 21h8M6 21V4M6 4h9.5M15.5 4v3" />
      <circle cx="15.5" cy="9.2" r="2.2" />
      <path d="M15.5 11.4v4.1" />
    </>
  ),

  // simon — 4분할 원 + 중앙 허브
  simon: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17M3.5 12h17" />
      <circle cx="12" cy="12" r="2.3" {...soft} />
    </>
  ),

  // whack-a-mole — 망치(약간 기울인 다이내믹)
  'whack-a-mole': (
    <g transform="rotate(20 12 12)">
      <rect x="5" y="4" width="14" height="5" rx="1.8" {...soft} />
      <rect x="10.6" y="9" width="2.8" height="11" rx="1.4" {...soft} />
    </g>
  ),

  // aim-trainer — 크로스헤어/타깃
  'aim-trainer': (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="0.9" {...solid} />
    </>
  ),

  // sudoku — 3x3 박스 + 숫자 + 주어진 값(dot)
  sudoku: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
      <path d="M11.3 11l1-0.8V14" />
      <circle cx="6" cy="6" r="0.95" {...solid} />
      <circle cx="18" cy="18" r="0.95" {...solid} />
    </>
  ),

  // rock-paper-scissors — 주먹(너클 + 손가락 심 + 엄지)
  'rock-paper-scissors': (
    <>
      <path
        d="M6 13a1.5 1.5 0 0 1 3 0a1.5 1.5 0 0 1 3 0a1.5 1.5 0 0 1 3 0a1.5 1.5 0 0 1 3 0v3a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z"
        {...soft}
      />
      <path d="M9 13.5v1.8M12 13.5v1.8M15 13.5v1.8" />
      <path d="M6 15.5c-1.8-0.2-2.1-1.6-1.2-2.6" />
    </>
  ),

  // pong — 양쪽 패들 + 공 + 센터 네트
  pong: (
    <>
      <rect x="3.7" y="8" width="1.8" height="8" rx="0.9" {...soft} />
      <rect x="18.5" y="8" width="1.8" height="8" rx="0.9" {...soft} />
      <circle cx="12" cy="12" r="1.4" {...solid} />
      <path d="M12 5v3M12 11v2M12 16v3" />
    </>
  ),

  // lights-out — 켜진 전구
  'lights-out': (
    <>
      <path d="M8.5 15a6 6 0 1 1 7 0v1h-7z" {...soft} />
      <path d="M9.5 16h5M10 18.5h4M11 20.5h2" />
      <path d="M10.6 11L12 12.5 13.4 11" />
      <path d="M4 7l1.7 0.9M20 7l-1.7 0.9" />
    </>
  ),

  // mastermind — 4개 코드 페그 행 + 피드백 페그
  mastermind: (
    <>
      <circle cx="5.5" cy="9" r="2.4" {...softer} />
      <circle cx="10.5" cy="9" r="2.4" />
      <circle cx="15.5" cy="9" r="2.4" {...softer} />
      <circle cx="20.5" cy="9" r="2.4" />
      <circle cx="8" cy="17" r="0.9" {...solid} />
      <circle cx="11" cy="17" r="0.9" />
      <circle cx="8" cy="20" r="0.9" />
      <circle cx="11" cy="20" r="0.9" {...solid} />
    </>
  ),

  // bubble-shooter — 상단 버블 클러스터 + 조준선 위 발사 버블
  'bubble-shooter': (
    <>
      <circle cx="8" cy="6.5" r="2.4" {...soft} />
      <circle cx="13" cy="6.5" r="2.4" {...soft} />
      <circle cx="10.5" cy="10.8" r="2.4" {...soft} />
      <path d="M12 20v-4.2" />
      <circle cx="12" cy="20" r="1.4" {...solid} />
    </>
  ),

  // nonogram — 3x3 픽셀 그리드 + 대각선으로 채워진 칸(피크로스)
  nonogram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16" />
      <rect x="4" y="4" width="5.33" height="5.33" {...softer} />
      <rect x="9.33" y="9.33" width="5.33" height="5.33" {...softer} />
      <rect x="14.67" y="14.67" width="5.33" height="5.33" {...softer} />
    </>
  ),

  // sokoban — X 표시된 상자 + 목표 마커
  sokoban: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="6" cy="6" r="0.7" {...solid} />
      <rect x="8.5" y="8.5" width="10" height="10" rx="1" {...soft} />
      <path d="M8.5 8.5l10 10M18.5 8.5l-10 10" />
    </>
  ),

  // dots-and-boxes — 점 격자 + 완성된 박스 한 칸 + 연결선
  'dots-and-boxes': (
    <>
      <rect x="5" y="5" width="7" height="7" {...soft} />
      <path d="M5 5h7M5 12h7M5 5v7M12 5v7M12 19h7" />
      <circle cx="5" cy="5" r="1" {...solid} />
      <circle cx="12" cy="5" r="1" {...solid} />
      <circle cx="19" cy="5" r="1" {...solid} />
      <circle cx="5" cy="12" r="1" {...solid} />
      <circle cx="12" cy="12" r="1" {...solid} />
      <circle cx="19" cy="12" r="1" {...solid} />
      <circle cx="5" cy="19" r="1" {...solid} />
      <circle cx="12" cy="19" r="1" {...solid} />
      <circle cx="19" cy="19" r="1" {...solid} />
    </>
  ),

  // flappy — 새(몸통 + 눈 + 부리 + 날개) + 오른쪽 파이프 간극
  flappy: (
    <>
      <rect x="18.5" y="3" width="3.2" height="6" rx="0.6" {...soft} />
      <rect x="18.5" y="15" width="3.2" height="6" rx="0.6" {...soft} />
      <circle cx="10" cy="12" r="4" {...soft} />
      <circle cx="11.3" cy="10.8" r="0.6" {...solid} />
      <path d="M13.8 11.2L16.4 12l-2.6 0.8z" {...soft} />
      <path d="M7 12.5c1.3 1.6 3 1.6 4.3 0.2" />
    </>
  ),

  // checkers — 킹(2단으로 쌓인 원반 스택)
  checkers: (
    <>
      <ellipse cx="12" cy="10" rx="6.5" ry="2.7" {...softer} />
      <path d="M5.5 10v3a6.5 2.7 0 0 0 13 0v-3" />
      <path d="M5.5 13v3a6.5 2.7 0 0 0 13 0v-3" />
    </>
  ),

  // maze — 사각 나선 미로 경로(하단 출구)
  maze: (
    <>
      <path d="M4 20V4h16v16H8V8h8v8" {...soft} />
    </>
  ),

  // number-memory — 카드 위 숫자 + 왼쪽 모션 라인(깜빡이는 숫자)
  'number-memory': (
    <>
      <path d="M2.5 8.5h2.4M2 12h3M2.5 15.5h2.4" />
      <rect x="7" y="5" width="11" height="14" rx="1.5" {...soft} />
      <path d="M10 9.6l1-0.8V15" />
      <path d="M12.6 9.9c1.2-0.9 2.7 0.1 1.8 1.4L12.4 15h2.6" />
    </>
  ),

  // word-search — 글자 격자 + 대각선 하이라이트(찾은 단어)
  'word-search': (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <rect
        x="3"
        y="10"
        width="18"
        height="4"
        rx="2"
        transform="rotate(-45 12 12)"
        {...softer}
      />
      <circle cx="7" cy="7" r="0.85" {...solid} />
      <circle cx="12" cy="7" r="0.85" {...solid} />
      <circle cx="17" cy="7" r="0.85" {...solid} />
      <circle cx="7" cy="12" r="0.85" {...solid} />
      <circle cx="12" cy="12" r="0.85" {...solid} />
      <circle cx="17" cy="12" r="0.85" {...solid} />
      <circle cx="7" cy="17" r="0.85" {...solid} />
      <circle cx="12" cy="17" r="0.85" {...solid} />
      <circle cx="17" cy="17" r="0.85" {...solid} />
    </>
  ),

  // reversi — 오델로 원반(위/아래로 갈린 뒤집히는 디스크)
  reversi: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12a8 8 0 0 1 16 0z" {...softer} />
    </>
  ),

  // gem-match — 커팅된 보석/다이아몬드(크라운 + 파빌리온 패싯)
  'gem-match': (
    <>
      <path d="M6 3h12l3 6-9 12L3 9z" {...soft} />
      <path d="M3 9h18M9 3l3 6 3-6M9 9l3 12 3-12" />
    </>
  ),

  // space-shooter — 삼각 우주선 + 위로 발사되는 볼트
  'space-shooter': (
    <>
      <path d="M13 1.5l-3 5.5h2.4L10.8 9.5l3.2-5.5h-2.4z" {...soft} />
      <path d="M12 10.5l5.5 11-5.5-3-5.5 3z" {...soft} />
    </>
  ),

  // tower-stack — 어긋나게 쌓인 블록 3단 타워
  'tower-stack': (
    <>
      <rect x="5.5" y="5" width="11" height="4.2" rx="1" {...soft} />
      <rect x="4" y="10" width="14" height="4.2" rx="1" />
      <rect x="6" y="15" width="13" height="4.2" rx="1" {...soft} />
    </>
  ),

  // prospector — 곡괭이(곡선 양날 머리 + 자루)가 금괴 너깃을 내리찍음(푸시-유어-럭 채굴)
  prospector: (
    <>
      <path d="M4.5 7.5Q12 3 19.5 7.5" />
      <path d="M12 4v10" />
      <path d="M12 14.3l3.6 2.1-1.3 3.6H9.7L8.4 16.4z" {...soft} />
    </>
  ),

  // zero-hour — 모래시계(카운트다운): 상하 프레임판 + 양쪽 유리 + 떨어지는 모래알
  'zero-hour': (
    <>
      <path d="M5.5 3.5h13M5.5 20.5h13" />
      <path d="M7.5 4h9l-4.5 8z" {...soft} />
      <path d="M12 12l4.5 8h-9z" {...soft} />
      <circle cx="12" cy="15.4" r="0.7" {...solid} />
    </>
  ),

  // overload — 과부하된 중앙 셀이 상하좌우 이웃으로 연쇄 폭발(체인 리액션)
  overload: (
    <>
      <rect x="9" y="9" width="6" height="6" rx="1.5" {...soft} />
      <circle cx="12" cy="12" r="0.9" {...solid} />
      <path d="M12 8.5V3.5M10.4 5.1L12 3.5l1.6 1.6" />
      <path d="M12 15.5v5M10.4 18.9L12 20.5l1.6-1.6" />
      <path d="M8.5 12H3.5M5.1 10.4L3.5 12l1.6 1.6" />
      <path d="M15.5 12h5M18.9 10.4L20.5 12l-1.6 1.6" />
    </>
  ),

  // ricochet — 그리드를 가로지르는 지그재그 궤적 + 튕기는 볼트(끝단 도트 헤드)
  ricochet: (
    <>
      <path d="M3.5 19l4.5-9 4 6 4.5-9" />
      <circle cx="16.5" cy="7" r="1.4" {...solid} />
    </>
  ),

  // stackpot — 목표선까지 쌓아올린 막대 + 위에서 떨어지는 칩(팟에 칩 넣기)
  stackpot: (
    <>
      <circle cx="12" cy="3.7" r="1.5" {...solid} />
      <path d="M3.5 7h17" />
      <rect x="5" y="11" width="3.4" height="8.5" rx="0.9" {...soft} />
      <rect x="10.3" y="7.5" width="3.4" height="12" rx="0.9" />
      <rect x="15.6" y="11" width="3.4" height="8.5" rx="0.9" {...soft} />
    </>
  ),

  // flywheel — 스포크 달린 회전 바퀴 + 림 마커 도트 + 상단 스트라이크존 틱(박자 탭)
  flywheel: (
    <>
      <circle cx="12" cy="13" r="7" />
      <circle cx="12" cy="13" r="1.9" {...soft} />
      <path d="M13.35 11.65l2.8-2.8M10.65 11.65l-2.8-2.8M10.65 14.35l-2.8 2.8M13.35 14.35l2.8 2.8" />
      <path d="M12 3.9v1.8" />
      <circle cx="17" cy="8" r="1.15" {...solid} />
    </>
  ),

  // ripple — 중심에서 바깥으로 퍼지는 동심원 물결 + 중앙 부표 도트
  ripple: (
    <>
      <circle cx="12" cy="12" r="2.4" {...soft} />
      <circle cx="12" cy="12" r="5.4" />
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="0.9" {...solid} />
    </>
  ),

  // ticker — 우상향 지그재그 시세 라인(스파크라인) + 코너 상승 화살표
  ticker: (
    <>
      <path d="M3.5 16.5l4.5-5 3 2.5L17 7" />
      <path d="M13 7h4v4" />
    </>
  ),

  // overfold — 우상단 모서리가 접힌 종이(도그이어 플랩) + 접힘 크리스 라인
  overfold: (
    <>
      <path d="M5 4h10l4 4v12H5z" {...soft} />
      <path d="M15 4v4h4" />
      <path d="M15 8L7 16" />
    </>
  ),

  // splice — 3노드 그래프 + 상단 엣지가 잘린 자국(간극 + 가위 스니프 X)(엣지 커팅)
  splice: (
    <>
      <path d="M5 8L12 18M19 8L12 18" />
      <path d="M6.6 8H9.6M14.4 8H17.4" />
      <path d="M10.6 6.6l2.8 2.8M13.4 6.6l-2.8 2.8" />
      <circle cx="5" cy="8" r="1.4" {...solid} />
      <circle cx="19" cy="8" r="1.4" {...solid} />
      <circle cx="12" cy="18" r="1.4" {...solid} />
    </>
  ),

  // quarry — 조준경 리클(틱 마크 달린 원) + 중심을 벗어나 달아나는 도트(숨은 표적 추적)
  quarry: (
    <>
      <circle cx="11" cy="11" r="7.5" {...soft} />
      <path d="M11 2v3.5M11 16.5v3.5M2 11h3.5M16.5 11h3.5" />
      <circle cx="14.2" cy="13.8" r="1.1" {...solid} />
    </>
  ),

  // latch — 페그(고정 도트)에 매달려 스윙하는 갈고리(줄 끝 훅)
  latch: (
    <g transform="rotate(-16 12 4.5)">
      <circle cx="12" cy="4.5" r="1.3" {...solid} />
      <path d="M12 5.8v7.5" />
      <path d="M12 13.3a3 3 0 1 1-3-3" />
    </g>
  ),

  // decant — 시험관 + 바닥에 가라앉은 무거운 층(밀도 분리)
  decant: (
    <>
      <path d="M9.5 3v8.2L5.9 17a3.6 3.6 0 0 0 3 5.5h6.2a3.6 3.6 0 0 0 3-5.5l-3.6-5.8V3" />
      <path d="M8.2 3h7.6" />
      <path d="M7.2 15.5h9.6a3.6 3.6 0 0 1-1.7 7H8.9a3.6 3.6 0 0 1-1.7-7Z" {...softer} />
      <path d="M8.5 19h7" {...soft} />
    </>
  ),

  // backspace — 되감기 화살표 두 개(시간 역주행)
  backspace: (
    <>
      <path d="M12.5 7.5 6 12l6.5 4.5V7.5Z" {...softer} />
      <path d="M20 7.5 13.5 12l6.5 4.5V7.5Z" {...soft} />
      <path d="M3.5 6.5v11" />
    </>
  ),

  // duplex — 거울축을 사이에 둔 쌍둥이 토큰(하나는 채움, 하나는 반전)
  duplex: (
    <>
      <path d="M12 2.5v19" strokeDasharray="2.5 2.5" />
      <circle cx="6.75" cy="12" r="3.25" {...solid} />
      <circle cx="17.25" cy="12" r="3.25" {...soft} />
      <path d="M4 6.5h5.5M4 17.5h5.5" {...soft} />
    </>
  ),

  // overdub — 루프(원형 스텝)와 그 위를 도는 재생 헤드
  overdub: (
    <>
      <circle cx="12" cy="12" r="8" strokeDasharray="1.5 3" />
      <circle cx="12" cy="12" r="2.4" {...soft} />
      <circle cx="12" cy="4" r="1.5" {...solid} />
      <path d="M12 9.6V6" opacity="0.6" />
    </>
  ),

  // pinwheel — 핀 하나와 그 둘레를 도는 90° 회전 화살
  pinwheel: (
    <>
      <circle cx="12" cy="12" r="1.6" {...solid} />
      <path d="M12 12 5 5" opacity="0.35" />
      <path d="M18.5 12a6.5 6.5 0 0 1-6.5 6.5" />
      <path d="M12 5.5A6.5 6.5 0 0 1 18.5 12" {...soft} />
      <path d="M16.6 9.9 18.5 12l2.1-1.9" />
    </>
  ),

  // cleave — 양팔 저울(내가 나누고 상대가 고른다)
  cleave: (
    <>
      <path d="M12 4.5v15" />
      <path d="M8 19.5h8" />
      <path d="M4.5 8h15" />
      <path d="M4.5 8 2.5 13h4z" {...soft} />
      <path d="M19.5 8 17.5 13h4z" {...softer} />
    </>
  ),

  // umbra — 밝은 입구를 지나 어둠으로 사라지는 구슬의 궤적
  umbra: (
    <>
      <path d="M3 12h7" opacity="0.9" />
      <path d="M14 12h7" strokeDasharray="1.5 3" opacity="0.4" />
      <circle cx="8" cy="12" r="2.2" {...solid} />
      <path d="M11.5 6.5v11" opacity="0.55" />
    </>
  ),

  // fuse — 격자 한 칸에서 타들어가는 심지와 불꽃
  fuse: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="1.5 2.5" opacity="0.45" />
      <path d="M8 16c2-1 3-3 3-5s1-3 2.5-3" />
      <circle cx="14.5" cy="7.5" r="1.8" {...softer} />
      <path d="M14.5 5.4v-1.4M16.6 7.5h1.4M13 6 12 5" opacity="0.7" />
    </>
  ),

  // polytap — 어긋난 두 주기가 한 박에서 겹친다
  polytap: (
    <>
      <path d="M4 9h16" opacity="0.85" />
      <path d="M4 15h16" opacity="0.5" strokeDasharray="1.5 3" />
      <circle cx="8" cy="9" r="1.5" {...solid} />
      <circle cx="15" cy="15" r="1.5" {...solid} />
      <path d="M12 6.5v11" opacity="0.6" />
      <circle cx="12" cy="12" r="2.4" {...soft} />
    </>
  ),

  // deepdive — 수직 갱도로 내려가는 하강 화살 + 바닥의 보물
  deepdive: (
    <>
      <path d="M12 3v13" />
      <path d="M7 11l5 5 5-5" />
      <rect x="8.5" y="18.5" width="7" height="3" rx="1" {...soft} />
    </>
  ),

  // sonar — 핑 발신점 + 확장 링 두 겹
  sonar: (
    <>
      <circle cx="12" cy="12" r="1.6" {...solid} />
      <path d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5" opacity="0.85" />
      <path d="M12 8.5a3.5 3.5 0 0 1 3.5 3.5" {...soft} />
      <path d="M5.5 12A6.5 6.5 0 0 1 12 5.5" opacity="0.4" />
    </>
  ),

  // handful — 바구니 + 그 안의 알 세 개
  handful: (
    <>
      <path d="M4.5 9h15l-1.5 10.5a1.5 1.5 0 0 1-1.5 1.3H7.5a1.5 1.5 0 0 1-1.5-1.3z" {...soft} />
      <path d="M4.5 9h15" />
      <circle cx="9" cy="13.5" r="1.4" {...solid} />
      <circle cx="12.5" cy="14.5" r="1.4" {...soft} />
      <circle cx="15.5" cy="13" r="1.4" {...solid} />
    </>
  ),

  // flapjack — 크기 다른 팬케이크 스택 + 스패출러
  flapjack: (
    <>
      <ellipse cx="12" cy="17.5" rx="7.5" ry="1.8" {...soft} />
      <ellipse cx="12" cy="13.5" rx="5.5" ry="1.6" {...soft} />
      <ellipse cx="12" cy="9.8" rx="3.5" ry="1.4" {...softer} />
      <path d="M3 6.5h6" opacity="0.7" />
    </>
  ),

  // interlock — 맞물린 두 고리 + 교차점
  interlock: (
    <>
      <circle cx="9" cy="12" r="5.5" />
      <circle cx="15" cy="12" r="5.5" {...soft} />
      <circle cx="12" cy="8.6" r="1" {...solid} />
      <circle cx="12" cy="15.4" r="1" {...solid} />
    </>
  ),

  // default — 아케이드 조이스틱(알 수 없는 slug 폴백)
  __default: (
    <>
      <circle cx="12" cy="6.5" r="2.6" {...soft} />
      <path d="M12 9v6" />
      <path d="M6 20a3 3 0 0 1 2.5-5h7a3 3 0 0 1 2.5 5z" {...soft} />
    </>
  ),
}

export function GameIcon({
  slug,
  className,
}: {
  slug: string
  className?: string
}) {
  const glyph = glyphs[slug] ?? glyphs.__default
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-8 w-8'}
      aria-hidden="true"
      focusable="false"
    >
      {glyph}
    </svg>
  )
}
