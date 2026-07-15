import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS "홈 화면에 추가" 아이콘(네온 아케이드).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#08080f',
          backgroundImage: 'radial-gradient(120px 120px at 50% 30%, #22d3ee33, transparent)',
          fontSize: 110,
        }}
      >
        🕹️
      </div>
    ),
    size,
  )
}
