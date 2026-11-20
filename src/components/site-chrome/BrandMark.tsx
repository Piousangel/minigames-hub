/**
 * 브랜드 마크(11-20 오너 승인 최종판 — 3차 V2 최종판 A '밝게': 금빛 링 엠블럼 + 말랑이). 헤더·푸터가 쓴다.
 * 파비콘·앱 아이콘과 같은 그림을 원형으로 오린 96px webp 한 장(헤더 36px의 2.7배, 28px의 3.4배) — 원본·생성법은
 * `scripts/brand-icons.py`. width/height를 주어 CLS 0, 크기는 className(h-*·w-*)이 정한다. 장식이라 alt="" —
 * 링크 이름은 감싼 <Link>의 aria-label·글자가 맡는다.
 */
export function BrandMark({ className, size }: { className?: string; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/mark-96.webp" alt="" width={size} height={size} decoding="async" draggable={false} className={className} />
  )
}
