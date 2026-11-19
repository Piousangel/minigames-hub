# AdSense 광고 단위 (오너 11-20 "만들자")

게시자 ca-pub-9363381710674627. 슬롯 ID는 페이지 HTML에 공개되는 값이라 비밀이 아니다.

| 사이트 | 이름 | 슬롯 ID | 크기 | 자리 |
|---|---|---|---|---|
| quickminigames.site | qmg-home-shelf-320x100 | 3366937812 | 고정 320×100 | 홈 광고 1 — R6(#191)에서 **4선반 아래 → About 아래**로 옮김(`HomeAdBand slot="home-about"`, 마스코트 400px 규칙 D6). 크기가 같아 단위는 그대로 쓴다 |
| quickminigames.site | qmg-home-footer-320x100 | 5373706948 | 고정 320×100 | 홈 푸터 앞 광고 2 |

- 만든 날: 2026-11-20 07시경(KST), 디스플레이 광고 → 고정 크기. AdSense 안내: 고정 크기는 게재 가능한 광고 수가 줄 수 있음(리뷰 B6 CLS 규칙 때문에 고정을 택함 — 계획서 D11).
- 사이트 상태(11-20 확인): quickminigames.site·sandlab.app 모두 "준비 중"(심사 중). ads.txt는 두 사이트 모두 200으로 서비스 중(AdSense 화면의 '찾을 수 없음'은 재크롤 전 표시).
- 광고는 `adsenseEnabled`(siteConfig)가 켜질 때만 렌더된다. 승인 전에는 켜지 않는다. 재심사 신청 금지.
- 샌드랩 단위는 P8·P10에서 자리·크기가 정해지면 같은 방식으로 만든다(sandlab `src/ui-next/ads/config.ts` AD_SLOTS).
- 다음 할 일: 홈 광고 컴포넌트에 위 슬롯 ID를 연결(`home-about` → 3366937812, `home-footer` → 5373706948)(별도 작은 PR — 광고 off 상태에서는 화면 변화 0).
