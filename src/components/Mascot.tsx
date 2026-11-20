/**
 * 마스코트 그림 한 장(리디자인 v2 R6, D5·D6). 서버·클라이언트 어디서나 쓰는 순수 `<img>`.
 *
 * - 파일은 `public/art/mascots/<이름>-<px>.webp` — 표시 크기 2배로 줄인 사본(원본 512px은 그대로 둔다). 각 ≤ 40KB.
 * - 기본 `loading="lazy"`(홈·시트 자리는 모두 첫 화면 밖, 404·/leaderboards 머리만 eager), `width/height`로 자리를 먼저 잡는다(CLS 0). 장식이면 `alt=""`.
 * - `data-mascot` = D6 자동 검사(e2e)가 세는 표식. 한 뷰포트 1마리 — 여러 장을 한 묶음으로 셀 곳(선반 disc 4장)은
 *   감싸는 요소에 `data-mascot-group`을 단다.
 * - 등불 글로우 등은 그림 그대로 — CSS 필터·블러를 더하지 않는다.
 */
export const MASCOT_ART = {
  'mallang-idle': { src: '/art/mascots/mallang-idle-80.webp', px: 80 },
  'tori-idle': { src: '/art/mascots/tori-idle-80.webp', px: 80 },
  'haessi-idle': { src: '/art/mascots/haessi-idle-80.webp', px: 80 },
  'bomi-idle': { src: '/art/mascots/bomi-idle-80.webp', px: 80 },
  'haessi-guide': { src: '/art/mascots/haessi-guide-192.webp', px: 192 },
  'haessi-think': { src: '/art/mascots/haessi-think-160.webp', px: 160 },
  'bomi-countdown': { src: '/art/mascots/bomi-countdown-64.webp', px: 64 },
  'bomi-deliver': { src: '/art/mascots/bomi-deliver-192.webp', px: 192 },
  'mallang-dizzy': { src: '/art/mallang-dizzy.webp', px: 320 },
  // R9 게임 밖 정원 페이지 머리(카테고리·/daily) — 기존 512px 원본의 192px 사본(새 그림 아님)
  'mallang-wave': { src: '/art/mascots/mallang-wave-192.webp', px: 192 },
  'tori-cheer': { src: '/art/mascots/tori-cheer-192.webp', px: 192 },
  'haessi-cheer': { src: '/art/mascots/haessi-cheer-192.webp', px: 192 },
  'bomi-cheer': { src: '/art/mascots/bomi-cheer-192.webp', px: 192 },
} as const

export type MascotArt = keyof typeof MASCOT_ART

export function Mascot({
  art,
  size,
  alt = '',
  className,
  loading = 'lazy',
}: {
  art: MascotArt
  /** 표시 크기(CSS px, 정사각) */
  size: number
  alt?: string
  className?: string
  /** 첫 화면 안에 놓이는 곳(404)만 'eager' */
  loading?: 'lazy' | 'eager'
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={MASCOT_ART[art].src}
      width={size}
      height={size}
      alt={alt}
      loading={loading}
      decoding="async"
      draggable={false}
      data-mascot={art}
      className={`block shrink-0 select-none ${className ?? ''}`}
    />
  )
}
