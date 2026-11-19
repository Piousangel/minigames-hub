# 참고 레포·UI/UX 원칙·지속 개선 프로세스 (허브 quickminigames.site · 샌드랩 sandlab.app)

작성: 2026-11-19 · 조사: GitHub API(별 수·라이선스·마지막 push)와 README 원문 직접 열람, WebSearch/WebFetch
표기: **[확인]** 원문(README·LICENSE·공식 페이지)을 직접 열어 본 사실 / **[요약]** 검색 결과·2차 자료 요약 / **[추정]** 내 판단·일반 지식
별 수·push 날짜는 2026-11-19 GitHub API 값 [확인]. 오너가 보낸 예시 이미지 2장은 못 봤으므로 범주를 넓게 잡았다.

---

## 0. 현재 두 사이트 관찰 (WebFetch, 2026-11-19)

- 허브 [확인]: 헤더 위에 "◄ INSERT COIN ►" 배너, 히어로 "Free Online Mini Games / PLAY · INSTANTLY · FREE", "113 GAMES · 100% FREE · NO SIGN-UP" 띠가 반복된다. 카테고리 탭(All·Daily·Puzzle·Arcade·Classic·Skill)과 Random 버튼이 있고, 카드는 제목·한 줄 설명·PLAY·♡로 구성된다. 세계관 캐릭터(말랑이 Slime Slide, 토리 Acorn Hop)는 신작 카드에만 나온다.
  - 문제 [추정]: 아케이드 캐비닛 모티프(INSERT COIN·GAME OVER)가 '노을 정원' 세계관과 부딪친다. 또 Solitaire·Chess·2048 같은 범용 클래식이 Featured 18개를 거의 다 차지해서 Poki나 CrazyGames와 구별되지 않는다. 지금 독창성은 신작 3개에만 몰려 있다.
- 샌드랩 [확인]: 첫 화면은 "Starting the sandbox…"이고, 72만 셀 GPU 시뮬레이션이다. 재료 18종, 브러시 크기, Erase·Clear·Copy link·Publish·Record 10s clip, Gallery, Puzzle 11레벨, Daily(/daily)가 있다. 온보딩은 "Right-click to erase" 힌트 하나뿐이다.
  - 문제 [추정]: 모바일에는 우클릭이 없다. 첫 10초 안에 "무엇을 해 보라"는 제안이 없다. 공유 수단은 3개인데 공유되는 결과물에 브랜드 프레임이 없다.

---

## 1. 참고 오픈소스 레포 (7개 범주, 46개)

재사용 범위 표기:
- **코드 OK**: MIT·ISC·zlib·Apache·Unlicense·CC0. 고지만 남기면 상업(AdSense) 사이트에도 넣을 수 있다.
- **조건부**: GPL·AGPL·MPL·CC BY. 코드를 섞으면 공개·고지 의무가 생기므로 사실상 아이디어 참고만 한다.
- **참고만**: 독자 라이선스·All rights reserved·NC/ND. 코드를 가져오면 안 된다.

### (a) 고품질 웹 캐주얼 게임 · 타격감(juice)

| 레포 | ★ / 최근 push / 라이선스 | 한 줄 요약 | 우리가 가져올 요소 | 재사용 | 주의 |
|---|---|---|---|---|---|
| [grapefrukt/juicy-breakout](https://github.com/grapefrukt/juicy-breakout) | 693 / 2017-03 / zlib | "Juice it or lose it" 강연의 브레이크아웃 원본. README 참고문헌에 Penner easing, Game Feel, 12 animation principles가 있다 [확인] | 같은 게임에 효과를 하나씩 켜 가며 비교하는 '토글 데모' 방식. 허브 내부 QA용 "juice 체크 화면"으로 쓸 만하다 | 코드 OK(zlib)지만 AS3(Flash)라 아이디어만 쓴다 | 저자 중 한 명이 Petri Purho(Noita 개발사 Nolla)다 [확인: LICENSE 저작권자]. 샌드랩 기술 계보와 이어진다 |
| [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS) | 4,393 / 2026-11-13 / MIT | 의존성 없는 작은 2D/3D 엔진. 물리·파티클·사운드·입력을 갖췄고 예제 브라우저와 Arcade가 있다 [확인] | 파티클 이미터 파라미터 구조, 예제 브라우저에서 코드를 고치면 바로 반영되는 UX(샌드랩 Learn에 응용) | 코드 OK | 엔진을 통째로 갈아타지 말 것. 부분 발췌만 한다 [추정] |
| [gabrielecirulli/2048](https://github.com/gabrielecirulli/2048) | 13,478 / 2024-10 / MIT | 2048 원본. 모바일 스와이프와 최고 점수 저장이 있다 [확인] | 타일 등장 시 '팝(scale 0→1.1→1)', 합쳐질 때 바운스, 점수 +n 플로팅. 최소 juice의 교과서 | 코드 OK | 이미 허브에 2048이 있으니 우리 구현과 나란히 놓고 비교하는 용도 |
| [ncase/trust](https://github.com/ncase/trust) | 6,348 / 2025-12 / CC0 | 'The Evolution of Trust' 인터랙티브 설명 게임. PIXI·Howler·Tween.js를 썼고 효과음 출처 목록을 공개한다 [확인] | 캐릭터가 규칙을 설명하는 튜토리얼 화법, 효과음 출처 정리 방식 | 코드 CC0(퍼블릭 도메인)이지만 효과음 일부는 CC BY-NC [확인]라 효과음은 빼야 한다 | 샌드랩 Learn 페이지 톤의 레퍼런스 |
| [ncase/joy](https://github.com/ncase/joy) | 573 / 2018 / CC0 | 'Joy.js' 아이들도 다룰 수 있는 프로그래밍 UI [확인: API 메타] | 블록형 파라미터 편집 UI(샌드랩 재료 규칙 편집기) | 코드 OK | 오래됨 |
| [a327ex/emoji-merge](https://github.com/a327ex/emoji-merge) | 79 / 2023-12 / MIT | 수박게임 클론. README가 엔진 해설서 수준이다. hitfx·flashes·springs·Shake·slow 장(章)이 따로 있다 [확인] | **hitfx(맞은 순간 흰 플래시와 스프링 스케일) + 전역 slow(히트스톱)** 구조. 젤리 말랑이 합체·착지 연출에 그대로 맞는다 | 코드 OK지만 Lua(LÖVE)라 개념만 옮긴다 | 구조와 수치 감각을 보는 용도 |
| [Hextris/hextris](https://github.com/Hextris/hextris) | 2,446 / 2023-05 / GPL-3.0 [확인: README] | 육각 테트리스 HTML5. 프레스킷이 있다 | 원 하나의 회전 조작으로 모바일 한 손 플레이, 프레스킷 페이지 구성 | 조건부(GPL) → 아이디어만 | API는 NOASSERTION, README에 GPL-3 명시 |
| [proyecto26/awesome-jsgames](https://github.com/proyecto26/awesome-jsgames) | 995 / 2026-10 / CC0 | JS 게임 큐레이션 목록 | 벤치마크 후보 풀(분기 갱신 소스) | 목록 OK | 개별 게임 라이선스는 각자 확인 |
| [ellisonleao/magictools](https://github.com/ellisonleao/magictools) | 17,828 / 2026-11-18 / MIT | 게임 개발 리소스 목록(에셋·사운드·툴) | 무료 에셋·폰트·사운드 출처 | 목록 OK | 동상 |

### (b) 게임 포털·허브·일일 챌린지 UI

| 레포 | ★ / push / 라이선스 | 한 줄 요약 | 가져올 요소 | 재사용 | 주의 |
|---|---|---|---|---|---|
| [lichess-org/lila](https://github.com/lichess-org/lila) | 19,001 / 2026-11-19 / AGPL-3.0 | lichess 서버. 토너먼트·퍼즐 트레이너·팀·140개 언어 [확인] | **오늘의 퍼즐·퍼즐 연승(streak)·레이팅 그래프·주간 토너먼트**의 정보 구조, 광고 없는 신뢰감 | 조건부(AGPL) → UI 흐름만 참고 | Scala라 구현 참고 가치는 낮고 화면 흐름이 핵심 |
| [Oia20/PopALockDaily](https://github.com/Oia20/PopALockDaily) | 11 / 2024-09 / MIT | Wordle식 숫자 일일 퍼즐. 하루 4회, 무한 모드 분리 [확인] | **'오늘 1판 + 무한 연습' 이중 구조**, 일일 생성 서버 분리 | 코드 OK | 작은 프로젝트라 UI 완성도는 보통 [추정] |
| [lynn/hello-wordl](https://github.com/lynn/hello-wordl) | 380 / 2024-03 / MIT | Wordle 클론 [확인: API] | 결과 이모지 그리드, 키보드 피드백 | 코드 OK | — |
| [WebDevSimplified/wordle-clone](https://github.com/WebDevSimplified/wordle-clone) | 179 / 2023-12 / MIT | 바닐라 JS Wordle 클론 [확인: API] | 타일 flip·shake·dance 애니메이션을 CSS 키프레임으로 짜는 최소 구현 | 코드 OK | 학습용 |
| [ekzhang/setwithfriends](https://github.com/ekzhang/setwithfriends) | 647 / 2025-02 / MIT | 가입 없이 링크로 바로 멀티플레이하는 Set. Firebase와 MUI [확인] | **'frictionless'**: 링크 하나로 방 입장, 월간 커뮤니티 미팅 | 코드 OK | 유지보수 모드 [확인] |
| [boardgameio/boardgame.io](https://github.com/boardgameio/boardgame.io) | 12,497 / 2026-10 / MIT | 턴제 게임 상태 관리·멀티플레이 프레임워크 | 로비, 리플레이(로그 기반 되감기) 개념을 일일 챌린지 '리플레이 공유'에 응용 | 코드 OK | 실시간 게임에는 맞지 않는다 |
| [codeplay-code/CloudArcade](https://github.com/codeplay-code/CloudArcade) | 21 / 2023-10 / GPL-3.0 | PHP HTML5 게임 포털 CMS [확인] | 포털의 '평범한 기본형'(카테고리·태그·인기순)을 확인하는 반면교사 | 조건부 → 참고만 | 우리가 피해야 할 템플릿 미학의 표본 [추정] |

> 참고: 상위 포털(Poki·CrazyGames·Coolmath·NYT Games·Neal.fun) 자체는 오픈소스가 아니므로 2장에서 사이트 관찰로 다룬다.

### (c) 모션·juice 라이브러리와 기법

| 레포 | ★ / push / 라이선스 | 한 줄 요약 | 가져올 요소 | 재사용 | 주의 |
|---|---|---|---|---|---|
| [motiondivision/motion](https://github.com/motiondivision/motion) | 35,358 / 2026-11-19 / MIT | React/JS 애니메이션(구 Framer Motion) | 카드 hover·탭 전환에 `spring`, 결과 카드 등장에 `layout` 애니메이션 | 코드 OK | 홈 번들 크기를 확인할 것. `motion/mini`나 CSS로 대체할 수 있는지 먼저 본다 [추정] |
| [pmndrs/react-spring](https://github.com/pmndrs/react-spring) | 29,318 / 2026-11 / MIT | 스프링 물리 기반 React 애니메이션 | **젤리 UI 버튼**(눌림 squash → 놓을 때 overshoot). tension·friction 토큰화 | 코드 OK | Motion과 둘 중 하나만 고른다 |
| [greensock/GSAP](https://github.com/greensock/GSAP) | 30,926 / 2026-11 / 'Standard no-charge' | Webflow 인수 후 SplitText·MorphSVG 포함 전부 무료, 상업 사용 가능 [확인] | 타임라인 연출(일일 결과 공개 시퀀스), SplitText 제목 튕김 | 사용 OK, 라이선스는 MIT 아님 [확인] | 'Webflow와 경쟁하는 도구' 금지 조항 등은 standard-license 원문을 확인할 것 [추정] |
| [juliangarnier/anime](https://github.com/juliangarnier/anime) | 74,899 / 2026-11 / MIT | 경량 JS 애니메이션 엔진 | stagger(카드 그리드 순차 등장) | 코드 OK | — |
| [tweenjs/tween.js](https://github.com/tweenjs/tween.js) | 10,159 / 2026-11 / MIT [확인: LICENSE] | 캔버스 게임용 트윈 | 게임 루프 안 트윈(캔버스 게임 공통 유틸) | 코드 OK | — |
| [tsparticles/tsparticles](https://github.com/tsparticles/tsparticles) | 9,117 / 2026-11-18 / MIT | 파티클·컨페티·불꽃 | 신기록·일일 완료 축하 프리셋 | 코드 OK | 전체 번들이 무겁다. slim이나 개별 프리셋만 쓴다 [추정] |
| [catdad/canvas-confetti](https://github.com/catdad/canvas-confetti) | 12,868 / 2025-10 / ISC | 초경량 컨페티 | **꽃잎·해바라기씨 모양 커스텀 shape**로 세계관 컨페티 | 코드 OK | `disableForReducedMotion` 옵션을 켠다 |
| [sajmoni/screen-shake](https://github.com/sajmoni/screen-shake) | 5 / 2025-02 / MIT | Squirrel Eiserloh GDC 강연 기반. Perlin noise + exponential trauma, 700B [확인] | **trauma(0~1) 누적 → 제곱 감쇠** 흔들림. 캔버스 게임 공통 카메라 모듈로 쓴다 | 코드 OK | 별은 적지만 기법이 정석이다 |
| [KilledByAPixel/ZzFX](https://github.com/KilledByAPixel/ZzFX) | 816 / 2026-11 / MIT | 1KB 미만 효과음 합성기, 파라미터 20개 [확인] | 효과음 파일 없이 코드 한 줄로 '뿅·톡' 생성 → 게임별 사운드 팔레트 | 코드 OK | 음색이 칩튠 쪽이라 '정원' 톤에 맞게 다듬어야 한다 [추정] |
| [chr15m/jsfxr](https://github.com/chr15m/jsfxr) | 467 / 2026-05 / Unlicense | sfxr JS 포트, 효과음 생성기 | 동상(디자이너 UI가 있음) | 코드 OK | — |
| [joshwcomeau/use-sound](https://github.com/joshwcomeau/use-sound) | 3,163 / 2025-06 / MIT | React 효과음 훅(Howler 기반) | 허브 UI 클릭음·토글음(스프라이트 1파일) | 코드 OK | 기본 음소거와 첫 상호작용 후 재생 규칙을 지킨다 |
| [rive-app/rive-wasm](https://github.com/rive-app/rive-wasm) | 1,029 / 2026-11-19 / MIT | Rive 런타임. 상태 머신 애니메이션 [확인] | **마스코트(말랑이·토리) 상태 머신**: 대기·눈깜빡·환호·시무룩을 입력으로 전환 | 런타임 OK(에디터는 상용 SaaS) | WASM 크기에 주의. 홈 LCP 밖에서 지연 로드 [추정] |

기법 자료(레포 아님):
- "Juice it or lose it"(Jonasson & Purho, 2012) [확인: juicy-breakout README가 강연 영상을 링크].
- Squirrel Eiserloh "Math for Game Programmers: Juicing Your Cameras" [확인: screen-shake README가 GDC 강연 링크].
- Vlambeer "Art of Screenshake" [추정: 널리 알려진 강연, 원문 미열람].

### (d) falling-sand·셀룰러 오토마타

| 레포 | ★ / push / 라이선스 | 한 줄 요약 | 가져올 요소 | 재사용 | 주의 |
|---|---|---|---|---|---|
| [MaxBittker/sandspiel](https://github.com/MaxBittker/sandspiel) | 3,230 / 2026-09 / MIT | Rust(wasm) + WebGL 샌드. 목표는 "공유와 포크" [확인]. 유체 코드는 PavelDoGreat WebGL-Fluid에서 가져왔다 [확인] | **작품 공유 → 포크 → 리믹스 계보**, 바람(유체) 레이어, 제작기 글(maxbittker.com/making-sandspiel) | 코드 OK | 샌드랩의 가장 직접적인 경쟁·참조 대상. UI를 따라 하면 차별성이 사라진다 |
| [MaxBittker/sandspiel-studio](https://github.com/MaxBittker/sandspiel-studio) | 41 / 2026-10 / MIT | 블록 코딩으로 원소를 만들어 공유 [확인] | 사용자 정의 재료(장기), 블록 레퍼런스 문서 구조 | 코드 OK | 얼리액세스 운영 중 [확인] |
| [The-Powder-Toy/The-Powder-Toy](https://github.com/The-Powder-Toy/The-Powder-Toy) | 5,414 / 2026-11-18 / GPL-3.0 | C++/SDL 데스크톱 고전 | 재료 상호작용 표(열·압력·전기), 세이브 브라우저의 투표·태그 | 조건부(GPL) → 규칙 아이디어만 | 웹 포트 레포들은 별이 0~3개이고 라이선스가 불명확해 추천하지 않는다 [확인: 검색] |
| [R74nCom/sandboxels](https://github.com/R74nCom/sandboxels) | 487 / 2026-06 / R74n Content License | 500개 넘는 원소, 열·화학반응·전기, 모드 매니저 [확인] | 단축키 체계(1234 뷰 전환, 원소 정보 I, 단일 스텝 >), 원소 정보 화면 | **참고만**: 상업 목적(광고 포함) 사용 금지, 크레딧 의무, 삭제 요청권 [확인: license.txt] | AdSense 사이트이므로 코드 한 줄도 가져오면 안 된다 |
| [Hartrik/sand-game-js](https://github.com/Hartrik/sand-game-js) | 47 / 2024-08 / 독자 | 모바일 지원 WebGL2 샌드, 시나리오·목표(objectives) 정의 [확인]. 현재 SandSaga.com으로 이어짐 | **목표(objective) 있는 씬**, 풀·나무 성장. 샌드랩 퍼즐·일일 설계와 가장 가깝다 | **참고만**: "NOT open-source in the legal sense", 파생물 배포 불가 [확인: LICENSE] | 모바일 터치 UI 벤치마크로 sandsaga.com을 정기 관찰 |
| [PieKing1215/FallingSandSurvival](https://github.com/PieKing1215/FallingSandSurvival) | 223 / 2022-09 / BSD-3 | Noita풍 C++ 서바이벌 | 강체와 픽셀 결합(청크 단위 업데이트) 구조 | 코드 OK(C++이라 개념만) | — |
| [ericleong/sand.js](https://github.com/ericleong/sand.js) | 37 / 2019 / GPL-3.0 | WebGL 셀룰러 오토마타 샌드 | 셰이더 기반 업데이트 패턴 | 조건부 | 오래됨 |

기법 자료:
- Petri Purho, GDC 2019 "Exploring the Tech and Design of Noita" [요약]: 큰 월드 스케일링, 아래에서 위로 업데이트, 청크 멀티스레딩, 파괴 가능한 강체 통합. GDC 공식 유튜브(youtu.be/prXuyMCgbTc)에서 무료로 볼 수 있다. GDC Vault 버전은 로그인이 필요해 열지 않았다.

### (e) 물리 퍼즐(선 긋기·슬링샷)

| 레포 | ★ / push / 라이선스 | 한 줄 요약 | 가져올 요소 | 재사용 | 주의 |
|---|---|---|---|---|---|
| [liabru/matter-js](https://github.com/liabru/matter-js) | 18,659 / 2026-09 / MIT | 웹 2D 강체 물리 | 슬링샷 데모(제약 constraint로 고무줄 구현), 소프트바디 예제(composite) → **젤리 말랑이** | 코드 OK | 연속 충돌 감지가 약해 빠른 물체가 터널링한다 [추정] |
| [piqnt/planck.js](https://github.com/piqnt/planck.js) | 5,322 / 2026-11-14 / MIT | Box2D의 JS/TS 재작성 [확인] | 선 긋기 퍼즐(체인 셰이프 → 동적 바디화), 테스트베드로 버그 재현 | 코드 OK | 선 긋기 게임에는 matter보다 안정적이다 [추정] |
| [dimforge/rapier](https://github.com/dimforge/rapier) | 6,100 / 2026-11 / Apache-2.0 | Rust 물리(2D/3D), wasm JS 바인딩 | 결정론(deterministic) 옵션 → **일일 챌린지 리플레이·부정 검증** | 코드 OK | wasm 용량 |
| [emjose/slingshot](https://github.com/emjose/slingshot) | 2 / 2023 / 없음 | matter.js 슬링샷 최소 예제 [확인: 검색] | 당기기 → 궤적 점선 미리보기 흐름 확인용 | **참고만**(라이선스 없음) | 품질 낮음. 구조만 본다 |

> 선 긋기 물리 퍼즐(Brain It On·Love Balls류)은 고품질 오픈소스를 찾지 못했다 [확인: GitHub 검색 결과 0~스팸]. 이 장르는 planck.js 테스트베드와 우리 구현으로 가야 한다.

### (f) 디자인 시스템·게임 UI 키트

| 레포 | ★ / push / 라이선스 | 한 줄 요약 | 가져올 요소 | 재사용 | 주의 |
|---|---|---|---|---|---|
| [nostalgic-css/NES.css](https://github.com/nostalgic-css/NES.css) | 21,862 / 2024-01 / MIT | 패미컴풍 CSS 프레임워크 | '컨셉 하나로 버튼·대화창·배지를 통일'하는 방식(우리는 컨셉을 '노을 정원 점토/젤리'로 바꿔 적용) | 코드 OK | 픽셀 미학은 우리 세계관과 다르니 구조만 본다 |
| [RonenNess/RPGUI](https://github.com/RonenNess/RPGUI) | 964 / 2023-10 / zlib [확인: LICENSE] | 올드스쿨 RPG 웹 GUI | 프레임(9-slice) 테두리, 진행 바, 인벤토리 슬롯 | 코드 OK | 동상 |
| [rough-stuff/rough](https://github.com/rough-stuff/rough) | 21,404 / 2024-07 / MIT | 손그림 스케치풍 그래픽 | **정원 지도·일일 정원 일러스트의 손그림 선**(SVG/캔버스) | 코드 OK | 많이 쓰면 Excalidraw 느낌이 나서 포인트로만 쓴다 [추정] |
| [game-icons/icons](https://github.com/game-icons/icons) | 1,370 / 2026-04 / CC BY 3.0 [확인: README "CC-BY"] | 4천 개 넘는 게임 SVG 아이콘, 색 변환 스크립트 | 아이템·업적 아이콘 원형 | 조건부: 저작자 표시 필수 | 각진 실루엣이라 둥근 세계관에 맞추려면 수정이 필요하다 [추정] |
| Kenney 에셋(kenney.nl, 레포 아님) | — / — / CC0 [추정] | UI Pack·파티클 팩 | 둥근 버튼·패널 시트를 프로토타입 자리표시자로 | OK | 출시 화면에 그대로 쓰면 '어디서 본' 느낌이 난다 |

### (g) AI 에이전트 팀 운영·자동화

| 레포 | ★ / push / 라이선스 | 한 줄 요약 | 가져올 요소 | 재사용 | 주의 |
|---|---|---|---|---|---|
| [garrytan/gstack](https://github.com/garrytan/gstack) | 142,067 / 2026-11-19 / MIT | Claude Code를 CEO·엔지니어링 매니저·디자이너(AI slop 감지)·QA·보안·릴리스 역할로 나눔 [확인] | 이미 설치돼 있다(design-review·plan-design-review·qa·benchmark). 주간 혹평 라운드를 `/design-review`와 `/benchmark`로 고정 | 코드 OK | 역할이 많아 토큰 비용이 크다. 라운드별로 2~3개만 쓴다 |
| [obra/superpowers](https://github.com/obra/superpowers) | 321,648 / 2026-11 / MIT | 조합 가능한 스킬 기반 개발 방법론 [확인] | 이미 사용 중. 검증 전 완료 금지, 리뷰 요청 스킬 | 코드 OK | 사용자 CLAUDE.md가 우선한다(S는 바로 처리) |
| [wshobson/agents](https://github.com/wshobson/agents) | 42,685 / 2026-11-18 / MIT | 플러그인 93개. Markdown 한 벌로 여러 하네스용 산출물을 생성 [확인] | UI 디자이너·접근성 감사 에이전트 정의를 참고해 '혹평가' 서브에이전트 작성 | 코드 OK | 전부 설치하지 말고 필요한 것만 |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 26,662 / 2026-11 / MIT | 서브에이전트 100개 이상 모음 | ui-designer·accessibility-tester 프롬프트 발췌 | 코드 OK | 품질 편차가 크다 [추정] |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | 58,346 / 2026-11-19 / CC BY-NC-ND 4.0 [확인] | Claude Code 리소스 큐레이션 | 분기마다 새 도구를 찾는 소스 | **참고만**(목록 재배포·변형 금지) | — |
| [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) | 10,014 / 2026-11-19 / MIT | GitHub PR·이슈에서 Claude 실행, 자동화 프롬프트 [확인] | **PR마다 390px 스크린샷 비교와 디자인 체크리스트 리뷰 자동 실행** | 코드 OK | API 비용과 시크릿 관리 |
| [smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad) | 8,836 / 2026-11 / AGPL-3.0 | 여러 에이전트를 각자 격리된 git workspace에서 병렬 실행 [확인] | 허브와 샌드랩 디자인 실험 2~3안을 병렬 브랜치로 | 도구로 쓰는 건 OK(AGPL은 수정·배포 시 의무) | — |
| [ruvnet/ruflo](https://github.com/ruvnet/ruflo) (구 claude-flow) | 82,074 / 2026-11-19 / MIT | 에이전트 메타 하네스, 스웜·메모리·MCP [확인] | 공유 메모리 개념만 참고 | 코드 OK | 무겁다. 지금 루틴 체계에는 과하다 [추정] |
| [anthropics/skills](https://github.com/anthropics/skills) | 197,499 / 2026-11-16 / 다수 Apache-2.0 [확인: README] | 공식 Agent Skills 예시 | 'ui-critique' 같은 자체 스킬을 쓸 때 형식 참고 | Apache 부분 OK | API에는 라이선스가 none으로 나오므로 폴더별로 확인 |

---

## 2. 두 사이트 UI/UX를 고품질·독창적으로 만드는 원칙 10개

### 상위 포털 비교

| 사이트 | 장점 | 한계(우리의 기회) |
|---|---|---|
| Poki | 로딩 속도를 집착 수준으로 관리한다. Stickman Hook은 40MB→6MB로 줄여 중앙 로딩이 29.5s→3.7s가 됐고 플레이 전환율이 50%→72%로 올랐다 [확인: Poki 블로그]. 첫 초에 바로 액션, 화면 중앙 집중, 큰 UI [확인]. 초기 다운로드 8MB 미만 권장 [요약] | 썸네일 벽이라 게임 사이 세계관이 없다. 어떤 게임인지보다 광고 밀도가 먼저 보인다 [추정] |
| CrazyGames | 카테고리·태그·'인기 급상승'이 촘촘하다 [추정] | 포털 대부분이 이 구조를 복제했다. 차별화 불가 영역 |
| Coolmath Games | 신뢰(학교·부모)와 오래된 브랜드 [추정] | 시각적 낡음 |
| itch.io 상위작 | 작품마다 강한 개성과 개발자 목소리(devlog) [추정] | 포털 수준의 일관성은 없다 |
| Neal.fun | 하나에 하나의 아이디어. 첫 화면에서 질문 하나로 끌어들이고, 공유하고 싶은 결과를 남긴다 [추정] | 지속 리텐션 장치가 약하다 |
| Wordle·NYT Games | 하루 1판의 희소성, 스포일러 없는 이모지 그리드 공유, 가입 없음 [요약: Wordle 이모지 그리드는 뉴질랜드 초기 사용자가 손으로 치던 것을 공식 기능화] | 장르 폭이 좁다 |

### 원칙 10개

1. **로딩 3초 예산.** 홈 LCP와 게임 첫 입력 가능 시점(TTI)을 각각 측정한다. 게임별 초기 다운로드는 Poki 기준을 가져와 5MB 미만으로 잡는다 [확인 근거: Poki]. 무거운 것(Rive·파티클·물리)은 첫 입력 이후 지연 로드한다.
2. **첫 3초 안에 손이 움직이게.** 플레이 버튼 다음 튜토리얼 화면을 두지 말고, 첫 판이 곧 튜토리얼이 되게 한다. 샌드랩은 열자마자 모래가 이미 흘러내리는 '살아 있는 첫 화면'으로 시작한다.
3. **모든 입력에 3중 피드백(시각·청각·촉각).** 눌림 squash, 짧은 효과음(ZzFX), `navigator.vibrate(10)`(지원 기기만)을 쓴다. 단 `prefers-reduced-motion`과 음소거 기본값을 존중한다.
4. **juice는 토큰으로 관리한다.** 스프링(tension·friction), 히트스톱(ms), shake trauma, 파티클 수를 디자인 토큰 파일 하나로 두고 전 게임이 공유한다. 게임마다 연출을 새로 만들지 않는다.
5. **세계관 하나, 모티프 하나.** '노을 정원' 이외의 메타포(INSERT COIN 아케이드)를 걷어낸다. 색은 노을 그라데이션 3단과 잎·흙 보조색, 형태는 둥근 모서리와 말랑한 볼륨으로 정한다.
6. **카드는 정적인 썸네일이 아니라 작게 살아 있는 장면.** hover나 뷰포트 진입 시 0.8초 루프(말랑이 깜빡임, 토리 꼬리)를 보여 준다. 카드의 정보는 제목, 플레이 시간(예: "1분"), 오늘의 기록 하나로 줄인다.
7. **결과 화면이 곧 공유물.** 스포일러 없는 결과 카드(이모지와 정원 일러스트 프레임), 링크로 같은 시드에 재도전하게 한다. 결과 화면이 광고 노출 지점이 되더라도 '공유' 버튼을 광고보다 위에 둔다.
8. **하루 1의 리듬.** 허브의 Daily, 샌드랩의 Daily, 연승(streak)을 하나의 '정원 달력'에 쌓는다. 놓친 날도 처벌하지 않는다(시든 꽃 대신 '쉬는 날' 잎).
9. **모바일 390px이 원본, 데스크톱이 확장판.** 엄지 영역 안에 주요 버튼, 최소 터치 목표 44px, 우클릭·호버 의존 금지(샌드랩 "Right-click to erase"를 지우개 토글과 길게 누르기로 대체).
10. **독창성은 '반복되는 작은 서명'에서 나온다.** 모든 화면에 같은 3가지 서명(아래)이 반복돼야 기억된다. 새 기능은 이 서명 중 하나를 강화할 때만 홈에 올린다.

### 허브 시그니처 3개

1. **일일 정원(Daily Garden)**: 매일 Daily 게임을 하나 완료할 때마다 홈 상단 '내 정원'에 해바라기가 한 송이 자란다(localStorage, 계정 없음). 7일 연승이면 말랑이가 정원에 이사 온다. Wordle의 하루 1판과 lichess 퍼즐 연승을 세계관 안에 녹인 형태다.
2. **젤리 물리 UI**: 버튼·카드·탭이 react-spring이나 Motion 스프링으로 squash & overshoot한다. 페이지 전환 때 말랑이가 다음 화면으로 '퐁' 튀어 들어간다. 다른 포털은 정적인 CSS hover뿐이라 '만지면 말랑한 포털'이 곧 브랜드가 된다.
3. **노을 시간 테마**: 사용자 현지 시각에 따라 정원 하늘색이 아침·낮·노을·밤 4단으로 바뀐다(CSS 변수). 게임 카드 그림자 방향도 해 위치를 따른다. "올 때마다 하늘이 다르다"는 작은 놀람을 준다.

(보조) **결과 공유 카드**: "🌻🌻🌱 · 노을 정원 #312" 같은 스포일러 없는 텍스트와 OG 이미지(Cloudflare Workers에서 생성)를 함께 쓴다.

### 샌드랩 시그니처 3개

1. **"한 줌의 실험" 일일 챌린지**: 매일 제한된 재료 3~4개만으로 목표를 달성한다(예: "용암을 쓰지 않고 얼음 녹이기"). 결과는 '재료 아이콘 + 사용 셀 수 + 걸린 시간' 그리드로 공유한다. sand-game-js의 objective 개념을 아이디어로만 참고한다.
2. **살아 있는 공유 링크**: 링크를 열면 정지 이미지가 아니라 만든 사람의 작품이 재생된다. 그 위에 "이어서 실험하기(포크)" 버튼 하나만 둔다. sandspiel의 공유·포크 계보를 따르되, 계보 트리를 '실험 노트' 형태로 보여 준다.
3. **실험 노트 UI 언어**: 모눈 노트·라벨 테이프·손글씨(rough.js 포인트) 비주얼로 통일한다. 재료 정보는 '표본 카드', 10초 클립은 '실험 기록 필름' 프레임에 담는다. 허브의 '정원'과 형제 세계관(정원 옆 실험 온실)으로 두 사이트를 잇는다.

---

## 3. 지속 개선 프로세스 (04시 기획·디자인 숙의 교대용 체크리스트)

### 3-1. 주 1회 UI 혹평 라운드 (월요일 04시 세션, 60분)

**캡처 목록 (매주 같은 것, 같은 조건)**
- [ ] 기기: 390×844(모바일, DPR 3) 기준. 1440×900은 보조로만
- [ ] 허브: 홈 첫 화면(스크롤 0)·홈 전체 스크롤·카테고리 1개·이번 주 신작 게임의 시작 / 플레이 중 / 결과 화면·Daily·Leaderboard
- [ ] 샌드랩: 첫 진입 0초·3초·10초 스냅샷, 팔레트 열림, Daily, 공유 링크를 연 화면, 퍼즐 1레벨 클리어 화면
- [ ] 각 화면은 라이트·다크(시스템 설정)로 1장씩
- [ ] 첫 10초 화면 녹화(허브 신작 1개, 샌드랩 첫 진입)
- [ ] Lighthouse 모바일 점수(LCP·CLS·INP)와 게임 첫 입력 가능까지 걸린 초
- [ ] 도구: Playwright `browser_resize(390,844)` 후 `browser_take_screenshot`, gstack `/design-review`·`/benchmark`

**채점표 (항목당 1~5점, 합계 50점. 화면마다 매기고 평균)**

| # | 항목 | 5점 기준 | 1점 기준 |
|---|---|---|---|
| 1 | 첫인상(3초) | 무엇을 하는 곳인지와 누를 곳이 즉시 보임 | 텍스트 벽·버튼 경쟁 |
| 2 | 세계관 일관성 | 색·형태·말투가 노을 정원 / 실험 노트 | 다른 메타포 혼재(INSERT COIN 등) |
| 3 | 손맛(juice) | 모든 입력에 시각·청각 피드백, 과하지 않음 | 반응 없음 또는 어지러움 |
| 4 | 모바일 조작 | 엄지 영역, 44px, 호버·우클릭 의존 없음 | 오조작·확대 필요 |
| 5 | 위계·가독성 | 화면당 주인공 하나, 본문 16px 이상 | 다 같은 크기 |
| 6 | 속도 | LCP 2.5s 이하, 첫 입력 3s 이하 | 5s 초과 |
| 7 | 공유 욕구 | 결과가 자랑할 만하고 스포일러 없음 | 공유 버튼 없음 |
| 8 | 재방문 장치 | 오늘·연승·내 정원이 보임 | 재방문 이유 없음 |
| 9 | 광고 조화 | 광고가 플레이·공유 흐름을 끊지 않음, CLS 0.1 이하 | 레이아웃 튐·오클릭 유도 |
| 10 | 독창성 | 로고를 가려도 우리 사이트로 알아봄 | Poki·템플릿과 구별 불가 |

- 진행: 작성자가 아닌 세션이 채점한다(팀 리뷰 원칙: 작성자≠검토자). 점수마다 근거 스크린샷 파일명을 단다.
- 산출: "가장 낮은 항목 2개 → 다음 주 개선 과제 1~2개"(하루 1출시 흐름에 편입). 점수 추이를 `design-scores.csv`(날짜, 사이트, 화면, 항목 1~10)에 누적한다.
- 금지: 점수가 오르지 않는데 새 기능을 홈에 추가하는 것.

### 3-2. 벤치마크 갱신 주기

| 주기 | 할 일 |
|---|---|
| 매주(혹평 라운드 안) | 벤치마크 사이트 2곳을 같은 화면 기준으로 캡처·비교. 순환 목록: Poki·CrazyGames·NYT Games·Neal.fun·sandspiel.club·sandsaga.com·lichess 퍼즐 |
| 매월 첫 월요일 | 이 문서 1장의 레포 별 수·최근 push·라이선스 재확인(`gh api repos/<r> --jq '.stargazers_count,.license.spdx_id,.pushed_at'`). 1년 넘게 push가 없으면 '보관'으로 내리고 신규 후보 2개를 추가(awesome-jsgames·magictools·awesome-claude-code에서) |
| 분기 | 시그니처 3개(허브·샌드랩 각각)가 여전히 유효한지 오너에게 1문단 보고. 채점표 항목·기준 개정 |

### 3-3. 디자인 부채 목록 운영

- 위치: 각 레포의 `docs/design-debt.md`(또는 기존 DECISIONS.md 옆). 진행은 `.claude/progress.md`에 한 줄 링크.
- 항목 형식: `ID | 사이트·화면 | 문제(스크린샷) | 위반 원칙 # | 채점 항목 # | 영향(상·중·하) | 노력(S·M·L) | 상태 | 발견일`
- 규칙
  - [ ] 혹평 라운드에서 2점 이하 항목은 자동으로 부채에 등록한다
  - [ ] 우선순위 = 영향 상·노력 S부터. 매일 출시 1개 중 주 1회 이상은 부채 상환으로 채운다
  - [ ] 4주 넘게 '열림'인 항목은 오너 보고 메일에 노출한다
  - [ ] 고칠 때는 고치기 전과 후의 390px 스크린샷을 PR에 첨부한다(claude-code-action으로 자동화 가능)
  - [ ] 새 컴포넌트·효과는 juice 토큰 파일과 색 토큰을 쓰지 않으면 리뷰에서 반려한다
- 현재 바로 등록할 후보 [추정, 2026-11-19 관찰 기반]
  1. 허브: 아케이드 모티프(INSERT COIN·GAME OVER)와 노을 정원 세계관 충돌 (원칙 5, 영향 상, 노력 M)
  2. 허브: Featured가 범용 클래식 위주라 오리지널 게임이 묻힘 (원칙 10, 상, S)
  3. 허브: "113 GAMES · 100% FREE" 띠 반복, 위계 과잉 (원칙 5·위계, 중, S)
  4. 샌드랩: 모바일에서 지우기가 우클릭 의존 (원칙 9, 상, S)
  5. 샌드랩: 첫 10초 제안·목표 없음 (원칙 2, 상, M)
  6. 샌드랩: 공유물(링크·클립·갤러리)에 브랜드 프레임 없음 (원칙 7, 중, M)

### 3-4. 04시 교대 체크리스트 (한 장 요약)

- [ ] 지난 혹평 점수와 열린 부채 상위 3개 읽기
- [ ] 오늘 출시 후보가 시그니처 6개(허브 3·샌드랩 3) 중 무엇을 강화하는지 한 줄로 적기. 해당 없으면 보류
- [ ] 390px 목업 또는 스크린샷 먼저, 코드는 나중에
- [ ] juice·색 토큰 사용 여부, reduced-motion과 음소거 대응 확인
- [ ] 성능 예산(LCP 2.5s, 게임 첫 입력 3s, 게임 초기 5MB) 확인
- [ ] 외부 코드를 넣을 때 1장 '재사용' 열 확인. 참고만인 레포(sandboxels·sand-game-js·라이선스 없음)는 코드 금지
- [ ] 작성자가 아닌 세션이 리뷰한 뒤 배포, 배포 후 실제 URL을 390px로 캡처해 확인
- [ ] 월요일이면 혹평 라운드, 매월 첫 월요일이면 벤치마크 갱신

---

## 출처

- GitHub 레포 메타·README·LICENSE: 위 표의 각 링크(2026-11-19, `gh api`로 열람) [확인]
- Poki, "What makes a high-quality browser game" https://poki.com/blog/what-makes-high-quality-browser-game [확인]
- Poki 요구사항(초기 8MB 미만 등) https://sdk.poki.com/requirements, https://developers.poki.com/guide/easy-access [요약: 검색 결과]
- Noita GDC 2019 https://gdcvault.com/play/1025695/Exploring-the-Tech-and-Design (Vault 로그인이 필요해 미열람), https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/ [요약]
- Wordle 이모지 그리드 기원 https://www.buzzfeednews.com/article/stefficao/how-wordle-went-viral-strategy, https://thespinoff.co.nz/media/13-01-2022/those-coloured-boxes-on-twitter-are-new-zealands-fault [요약]
- 현재 사이트 관찰 https://quickminigames.site, https://sandlab.app (WebFetch 요약) [확인]
