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
