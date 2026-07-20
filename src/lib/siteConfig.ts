export const siteConfig = {
  name: 'Quick MiniGames', // 브랜드명
  url: 'https://quickminigames.site', // 커스텀 도메인
  description:
    'Play free classic mini games online — 2048, snake, minesweeper and more. No download, no sign-up.',
  // 발급된 AdSense 퍼블리셔 ID. 사이트 소유권 확인용 메타 태그(layout.tsx)와
  // public/ads.txt가 이 값을 쓰므로 승인 전에도 채워져 있어야 한다.
  adsenseClientId: 'ca-pub-9363381710674627',
  // 광고 게재 스위치. AdSlot의 data-ad-slot이 아직 플레이스홀더 문자열이라,
  // 승인 후 AdSense에서 광고 단위를 만들어 실제 숫자 슬롯 ID로 교체한 뒤에 true로 바꿀 것.
  // EU 트래픽엔 인증 CMP도 필요.
  adsenseEnabled: false,
  // 후원(선택) — Ko-fi 페이지. 위젯 스크립트가 아니라 단순 외부 링크로만 연결(외부 JS·추적기
  // 금지 원칙 유지). 비우면 후원 링크가 안 뜬다.
  kofiUrl: 'https://ko-fi.com/piousangel',
}

