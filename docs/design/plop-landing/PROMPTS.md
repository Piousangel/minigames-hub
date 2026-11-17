# 뿅 착지 에셋 프롬프트 (재현용, GEMINI.md: 프롬프트는 지우지 않는다)

- 방향 이미지: `direction/target.jpg`(Gemini 목표 시안, 노을 팔레트). 모든 에셋 요청의 참조로 넣는다.
- 모델: `gemini-3-pro-image`. 배경 제거는 마젠타 단색 키(섬은 초록, 꽃은 노랑이라 마젠타가 안전).
- 공통 스타일 문구: "cozy storybook 'sunset sea of clouds with floating islands'. Palette: coral #ff8a6b, peach #ffc9a0, lavender #b79ad8, cream #fff3dc, moss green #7cc26a, flower gold #ffc933. Thick dark-brown outline #5b3a1e, soft cel shading, plump friendly shapes, top Korean casual mobile game quality. Match the style of the reference image exactly. NO text, NO letters, NO watermark."
- 스프라이트 문구: "Single isolated game sprite, centered with margin, nothing touching the edges. The ENTIRE background must be one flat solid pure magenta #FF00FF (never white), no shadow, no extra objects."

| 에셋 | 비율 | 요지 |
|---|---|---|
| `plop-island-wide` | 16:9 | 옆에서 본 넓고 평평한 떠다니는 풀섬(윗면 평평, 이끼 낀 바위 밑면). 꽃은 따로 |
| `plop-island-small` | 1:1 | 작고 둥근 풀섬 |
| `plop-flower` | 1:1 | 금색 꽃, 짧은 줄기와 잎 두 장(착지 목표 표시) |
| `plop-flag` | 1:1 | 나무 기둥에 크림색 삼각기(오른쪽으로 펄럭) |
| `plop-bg` | 9:16 | 노을 하늘(위 코랄 → 아래 크림 골드), 낮은 해, 라벤더 구름바다. 섬·캐릭터·UI 없음, 저대비 |
| `plop-landing-cover` | 16:9 | 홍보 커버: 구름바다 위 섬 3개, 아치 위의 말랑, 점선, 깃발. 왼쪽 1/3은 비워 제목을 얹는다 |

말랑 스프라이트(idle/happy/dizzy)는 토스 앱 작업에서 만든 `origin/feat/toss-recoil`의 `toss/public/chars/mallang-*.webp`를 쓴다. `aim`/`fire`는 대포를 든 포즈라 이 게임에 맞지 않아 가져오지 않았다(눌림·도약은 코드에서 스케일로 표현).
스크립트: 세션 스크래치패드의 `gen-plop.sh`(이 표와 같은 프롬프트). 원본 PNG는 저장소에 두지 않는다(용량).

## 혹평 리뷰 기록 (G4)
Gemini 아트 디렉터(혹평 프롬프트) 4라운드: **2 → 3 → 4 → 5점**. 기준은 6.5점이다. 평가자는 라운드마다 기준이 흔들린다(젤리 외곽선이 1차에선 "얇다", 3차에선 "너무 진하다"). 타당한 지적만 반영했다.
- 반영: 바람 깃발이 화면 밖이던 것, 젤리와 섬의 외곽선 톤 통일, HUD 라벨, 첫 화면 안내 점선, 게이지를 젤리 둘레로 이동, 목표 꽃 확대·후광, 팝업 가독성, 전역 스캔라인 제거(보드를 오버레이 위로), 점선 확대, 결과 화면 정리
- 남음: 섬의 질감(플랫)과 젤리(글로시)의 스타일 차이(에셋 재생성이 필요), 결과 화면의 공용 요소(다음 게임·후원 링크)는 사이트 공통이라 이 게임에서만 못 바꿈, 깃발 스타일
원문: `critique-G4-r1.md` ~ `critique-G4-r4.md`, 캡처: `shots/`.
