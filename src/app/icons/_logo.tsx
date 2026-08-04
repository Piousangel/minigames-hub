import { ImageResponse } from 'next/og'

/**
 * PWA 설치 아이콘(192/512 PNG) 공유 렌더러. 브랜드 네온 아케이드 로고(화면+재생+스탠드)를
 * 캔버스 중앙 ~60% 안에 배치 → maskable(원형/스퀴클 크롭) 안전 영역 준수. 배경 풀블리드.
 * `_logo`는 언더스코어 프리픽스라 라우팅되지 않는다(route.tsx들이 import만 함).
 */
export function iconImage(px: number): ImageResponse {
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
          gap: px * 0.06,
          backgroundColor: '#08080f',
          backgroundImage: `radial-gradient(${px * 0.6}px ${px * 0.6}px at 50% 42%, #22d3ee2e, transparent)`,
        }}
      >
        {/* 화면(시안 테두리) + 재생 삼각형(앰버) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: px * 0.5,
            height: px * 0.38,
            border: `${px * 0.058}px solid #22d3ee`,
            borderRadius: px * 0.11,
          }}
        >
          {/* 재생 삼각형 — Satori에서 CSS-보더 삼각형이 사각형으로 렌더돼 SVG polygon 사용 */}
          <svg width={px * 0.19} height={px * 0.22} viewBox="0 0 10 12" style={{ marginLeft: px * 0.03 }}>
            <polygon points="0,0 10,6 0,12" fill="#fbbf24" />
          </svg>
        </div>
        {/* 스탠드(마젠타) */}
        <div style={{ width: px * 0.24, height: px * 0.05, borderRadius: px * 0.025, backgroundColor: '#ff3d9a' }} />
      </div>
    ),
    { width: px, height: px },
  )
}
