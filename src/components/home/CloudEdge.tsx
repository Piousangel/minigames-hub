/**
 * 히어로(라벤더 구름바다) ↔ 본문(paper 종이)을 잇는 구름 경계(리디자인 v2 R4). 정적 인라인 SVG — 런타임 JS 장식 금지(계획서 0장).
 * 규칙적인 혹: 시안(hub-v2.html scallop)의 '반지름 15, 390에 13개'를 단위 타일 30×19로 고정해
 * 폭에 맞춰 가로 반복(pattern)한다 — 화면이 넓어지면 혹 수만 늘고 모양은 같다.
 * 아래 면은 본문 바탕(--garden-paper #fffaf0)과 같은 색, 윗선은 ink(#5b3a1e) 2.5px — SVG 속성이라 값으로 적는다.
 */
const W = 30 // 혹 하나 폭(시안 390/13)
const R = 15 // 혹 높이(반지름)
const H = R + 4

export function CloudEdge() {
  const arc = `A ${W / 2} ${R} 0 0 1 ${W} ${H - 2}`
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="home-cloud-edge block h-[19px] w-full"
      height={H}
    >
      <defs>
        <pattern id="home-cloud-bump" width={W} height={H} patternUnits="userSpaceOnUse">
          <path d={`M0 ${H} L0 ${H - 2} ${arc} L${W} ${H} Z`} fill="#fffaf0" />
          <path d={`M0 ${H - 2} ${arc}`} fill="none" stroke="#5b3a1e" strokeWidth="2.5" strokeLinejoin="round" />
        </pattern>
      </defs>
      <rect width="100%" height={H} fill="url(#home-cloud-bump)" />
    </svg>
  )
}
