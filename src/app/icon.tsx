import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'
// 구글 검색 파비콘은 48px의 배수(≥48)를 권장 → 96×96 PNG로 생성(래스터라 구글이 확실히 집는다).
export const size = { width: 96, height: 96 }
export const contentType = 'image/png'

// 브랜드 로고: 네온 아케이드 화면 + 재생 버튼(icon.svg와 동일 모티프를 div로 재현).
export default function Icon() {
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
          gap: 8,
          backgroundColor: '#08080f',
          borderRadius: 20,
        }}
      >
        {/* 화면(시안 테두리) + 재생 삼각형(앰버) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 62,
            height: 48,
            border: '6px solid #22d3ee',
            borderRadius: 14,
          }}
        >
          {/* 재생 삼각형 — Satori에서 CSS-보더 삼각형이 사각형으로 렌더돼 SVG polygon 사용 */}
          <svg width={22} height={26} viewBox="0 0 10 12" style={{ marginLeft: 4 }}>
            <polygon points="0,0 10,6 0,12" fill="#fbbf24" />
          </svg>
        </div>
        {/* 스탠드(마젠타) */}
        <div style={{ width: 30, height: 6, borderRadius: 3, backgroundColor: '#ff3d9a' }} />
      </div>
    ),
    size,
  )
}
