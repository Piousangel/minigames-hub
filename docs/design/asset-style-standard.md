# 에셋 스타일 기준 (노을 정원) — 모든 Gemini 요청이 인용하는 단일 기준

작성 2026-11-19. 근거: DECISIONS.md 2026-11-19 "세계관 통일('노을 정원')·신작 이름·에셋 예산(오너 승인)"의 ③ "2~3번 다시 뽑지 않게 스타일 기준·프롬프트를 먼저 확정해 한 번에 생성".
짝 문서: [asset-review-sheet.md](./asset-review-sheet.md)(합성 시안 검수표). 절차·예산: [docs/team/GEMINI.md](../team/GEMINI.md).

**이 문서의 역할**
- 새 이미지 요청(`docs/design/asset-requests/*.json`)을 올리는 PR은 본문에 "기준: asset-style-standard.md" 한 줄을 적고, 아래 규칙을 지켰는지 [검수표](./asset-review-sheet.md) 0장(요청 전 점검)에 표시한다.
- 상위 문서가 서로 다른 말을 하는 곳은 9장에서 하나로 정했다. 요청을 쓸 때는 이 문서를 따른다.
- 숫자는 저장소에서 직접 잰 값(11장 측정 방법)이거나 코드·문서에서 옮긴 값이다. 재지 못한 값은 **미확인**으로 표시했다.

상위 근거(읽는 순서): `docs/design/world/world-bible.md`(월드 바이블 v1, 이하 "바이블") → `docs/team/specs/2026-11-19-slime-v2-final-spec.md` F장(이하 "스펙 F") → `docs/team/research/2026-11-19/multiline-design.md` 8장(시간대 팔레트) → `docs/team/research/2026-11-19/hub-redesign-concept.md` 3장(사이트 디자인 시스템) → 코드(`src/app/globals.css`, `src/lib/games/slime/theme.ts`, `terrainRender.ts`, `draw.ts`) → `scripts/gen-assets.py`.

---

## 1. 팔레트 토큰

### 1-1. 고정 토큰 (시간대와 무관)

"코드" 열은 지금 저장소 코드에 실제로 있는 값이다. 코드에 없는 토큰은 바이블 5-1에만 있고 아직 구현되지 않았다.

| 토큰 | hex | 코드에 있는 곳 | 용도 |
|---|---|---|---|
| ink | **#5b3a1e** | `globals.css` `--garden-ink`, `terrainRender.ts` `INK`, `draw.ts`(윤곽 14곳) | 모든 윤곽선, 본문 글자 |
| ink-deep | #3a2410 | `globals.css` `--garden-ink-deep` | 판 그림자(`.garden-frame` 아래 9px) |
| cream | #fff3dc | `globals.css` `--garden-cream`, `draw.ts`, `theme.ts`(별·달) | 하이라이트, 확정 선, 달 |
| sun-gold | #ffc933 | `globals.css` `--garden-gold`(이름은 `gold`) | 주 버튼, 별, 해바라기. "sun-gold"는 바이블·결정 기록의 이름이고 CSS 변수명은 `--garden-gold`다 |
| bloom-coral | #e8643f | `globals.css` `--garden-coral` | 큰 점수 숫자 |
| cream-shade | #f3d9aa | 없음(바이블) | 카드 아래쪽 |
| leaf / leaf-deep | #7cc26a / #4f8a3c | 없음(바이블). 슬라임 지형은 `GRASS` #5fbf4a / `GRASS_HI` #9be57e | 이끼, 잎 |
| rock / rock-deep | #9aa08f / #6b6e5e | 없음(바이블). 슬라임 지형은 `ROCK` #c79a66·#a97a4a·#6b4526 | 섬 바위 |
| soil | #8a5a2b | 없음(바이블) | 흙 바위, 도토리 |
| jelly-cyan / jelly-violet | #7fe3ff / #9b7bff | 없음(바이블) | 말랑이 |
| tori-amber / tori-mint | #d98b3a / #a8e6c8 | 없음(바이블) | 토리 |
| lavender(그늘) | #b79ad9 | `theme.ts` 노을 `sea` | 그늘, 구름바다 |
| danger | #ff5a4a | 없음(바이블). 슬라임 실패 링은 `rgba(230,70,70,…)`, 독꽃 경보는 `rgba(255,90,90,…)` | 위험(코드로만 점멸) |
| 쿠션 면 | 현재 #ff7f6b(`draw.ts`) / 제안 #ff9a85 | `draw.ts` `drawBouncePad` | 튕기는 쿠션. #ff9a85는 multiline-design 3-4의 제안값이고 아직 코드에 반영되지 않았다 |

**프롬프트에 넣는 팔레트**: 바이블 10-1 STYLE LOCK의 12색(coral #ff9d7a, peach #ffd9b0, lavender #b79ad9, cream #fff3dc, moss #7cc26a, leaf shadow #4f8a3c, sun gold #ffc933, outline brown #5b3a1e, jelly cyan #7fe3ff, jelly violet #9b7bff, squirrel amber #d98b3a, suit mint #a8e6c8)을 그대로 쓴다. 스펙 F-3의 6색 목록(#6a4fb5 보라, #ff9a85 산호 포함)은 9장 결정에 따라 "추가 지정색"으로만 덧붙인다.

### 1-2. 기존 에셋에서 잰 실제 색 (2026-11-19, 11장 방법)

| 대상 | 잰 값 | 기준 토큰과의 차이(ΔE76) | 읽는 법 |
|---|---|---|---|
| 윤곽(토리·섬·구름·꽃·별 등 갈색 계열) | 어두운 연속 픽셀 중앙값 #552918~#5b2c15, 가장자리 평균 #4c1d1d~#5f262b | #552918↔#5b3a1e = 9.6, #55271b↔#5b3a1e = 11.9 | 실제 윤곽은 ink보다 **조금 더 어둡고 붉다**. 바이블 10-4의 윤곽 허용치(ΔE 12) 안에 든다 |
| 윤곽(`mallang-idle`) | #0d1a32(남색) | 45.3 | 바이블 0장 진단("윤곽이 짙은 남색")과 일치. 기준 밖이다 |
| 윤곽(`mallang-happy`·`mallang-dizzy`) | #303b65 / #304d6f(남색 계열) | 미계산(남색이라 기준 밖) | idle과 같은 세대 |
| 윤곽(`mallang-sad`·`sleepy`·`wave`, 11-19 flash 파일럿) | #432c0f~#442c15 | #442c0f↔#5b3a1e = 8.2 | 파일럿에서 갈색 윤곽으로 옮겨졌다 |
| `plop-bg` 하늘(위→아래 10등분 평균) | #fa7f6b #fb856d #fc9575 #fcad82 #fcc897 #fadeb3 #f5e2c6 #dbbfca #d3b7c1 #e4c5b8 | 맨 위 #fa7f6b↔노을 top #ff9d7a(바이블) = 12.8 | 에셋 맨 위가 토큰보다 진한 산호. 위 20% 평균은 #fb826c |
| `cloud-a` 면 | #fdedd2(59%) | ↔cream = 3.2 | 구름 면은 사실상 cream |
| `star` 면 | #fbca4b(20%), #f5b240, #ea9f3c | #fbca4b↔sun-gold = 8.7 | 금색 + 주황 그늘 |
| `plop-flower` 꽃잎 | #f6bd42, #fdc948, #feb83f | 미계산 | 금색 계열 |
| `plop-island-*` 이끼 | #7fb65f, #8db76c, #729b56 | 미계산 | moss 근처 |
| `bg-sky`(Acorn Hop) | #1f2049 ~ #2f3069 | 미계산 | 남색 밤. 노을 정원 토큰 밖(바이블 0장 "같은 세계로 안 보인다") |
| 슬라임 `GRASS` #5fbf4a | — | ↔moss #7cc26a = 16.8 | 지형 풀은 바이블 moss보다 진하다(multiline-design 8-1의 노을 풀 값과 같음) |

### 1-3. 시간대 8종 (슬라임 스테이지 하늘)

**정답 값은 `src/lib/games/slime/theme.ts`의 `SKY`다**(PR-2 #152로 이미 출시). multiline-design 8-1 표와 같은 값이다. 바이블 5-2의 `--sky-*` 표는 일부 값이 다르고(아래 "바이블과 다름"), 사이트(허브)용으로 아직 코드에 없다.

| 슬롯(스펙 B-1) | 이름 | theme | 하늘 위 → 아래 | 바다 | 색 막 불투명도(veil) | 해/달(x, y, r, 색) | 별 수 | 지금 이 theme을 쓰는 스테이지(`THEME_BY_STAGE`) | 바이블과 다름 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | First Light | dawn 새벽 | #f6b6c8 → #ffe3b8 | #c9a8e0 | 0.55 | 해 0.50, 0.60, 46, #ffd9a0 | 0 | g-slide | 바이블 dawn은 #6f6bb8 → #f2b8c6 |
| 2 | Morning Meadow | morning 아침 | #ffe3b8 → #bfe6ff | #b7c8ee | 0.60 | 해 0.22, 0.18, 34, #fff0b8 | 0 | c-meadow, g-slide-m | 바이블은 위·아래가 뒤집혀 있음(#bfe6ff → #ffe3b8) |
| 3 | Stone Steps | noon 낮 | #8fd3ff → #e9f8ff | #9fb8f0 | 0.70 | 해 0.50, 0.10, 30, #fffbe0 | 0 | g-wall | 바다만 다름(바이블 #d6e8fb) |
| 4 | Twin Hills | afternoon 오후 | #ffd27a → #fff0c8 | #e0b8d8 | 0.60 | 해 0.78, 0.20, 36, #fff3c0 | 0 | s-spike, s-spike-m | 바이블 이름은 golden, 위 #ffc07a |
| 5 | Two Banks | sunset 노을 | #ff9d7a → #ffd9b0 | #b79ad9 | **0(에셋 그대로)** | 없음 | 0 | s-wall-b(미지정 스테이지 기본값도 sunset) | 같음 |
| 6 | Jelly Hollow | dusk 황혼 | #8a4f9e → #ffb07a | #7a5aa8 | 0.62 | 없음 | 6 | s-bounce | 바이블은 #c86a8a → #f0a080 |
| 7 | Windy Ridge | night 밤 | #3d3170 → #5a4690 | #3a2f70 | 0.80 | 달 0.74, 0.20, 22, #fff3dc | 24 | **없음** | 바이블 아래 #6a4fb5 |
| 8 | Lantern Gate | starry 별밤 | #1b1740 → #4a3a8a | #2b2260 | 0.88 | 달 0.28, 0.22, 30, #fff3dc | 48 | s-wall-b-m(반전본, 풀 제외) | 바이블은 #241c4a → #3d3170 |

- 그리는 방식(코드 확인): `drawSky`가 `plop-bg.webp`를 보드(390×560)에 아래 기준으로 맞춰 그린 뒤, `paintSkyTheme`가 위 62%에 top→bottom 그라데이션을 `globalAlpha = veil`로 덮고(합성 모드는 기본 `source-over`, multiply 아님), 아래 38%에 `sea`를 `veil × 0.55`로 덮는다. 그 위에 해/달(방사 그라데이션 + 원)과 별(2~3px 사각)을 코드로 찍는다.
- 지금 일일 풀(`SLIME_STAGES`: g-slide, c-meadow, g-wall, s-wall-b, s-bounce)에서 실제로 보이는 theme은 dawn·morning·noon·sunset·dusk 5종이다. **afternoon·night·starry 3종은 풀에 있는 스테이지로는 화면에 나오지 않는다**(합성 시안을 찍을 때 주의, 검수표 2-1).
- 사이트(허브) 시간대: 바이블 5-2 값을 쓰되, 코드로 옮기는 PR에서 위 표와 다른 4곳(dawn·morning·dusk·night/starry)을 어느 쪽으로 맞출지 정한다(**미결**, 9장 C5).

---

## 2. 윤곽선

1. **색**: 항상 ink #5b3a1e. 남색·검정 윤곽 금지(말랑이 포함, 바이블 3-1·10-4). 안쪽 디테일 선은 더 가늘고 밝은 갈색 #7a5232(바이블 6-1).
2. **굵기 규칙**: "**참조 이미지와 같은 표시 크기로 놓았을 때 같은 무게**"가 기준이다(스펙 F-4: "참조 `mallang-idle`의 비율과 같다"). 프롬프트에는 "Match the line weight … of the reference images exactly"(바이블 10-1)를 그대로 넣는다.
3. **바이블의 px 수치**(긴 변 1024 기준 큰 오브젝트 8~10px, 캐릭터 6~8px, 작은 소품 4~5px = 긴 변의 0.4~1.0%)는 **기존 에셋 실측과 맞지 않는다**. 실측(어두운 픽셀 연속 길이 중앙값 ÷ 긴 변)은 다음과 같다.
   - 토리 6장: 1.1~1.4% / 말랑이: 1.25~1.8% / 섬: `plop-island-wide` 0.9%, `island` 1.4%, `plop-island-small` 2.3%, `cat-island-*` 1.0~1.6% / 구름 1.9% / `plop-flower` 2.5% / `star` 3.8%
   - 이 방법은 윤곽에 붙은 어두운 그늘까지 세므로 **실제보다 굵게 나올 수 있다**(정확한 윤곽 굵기는 미확인). 그래도 바이블 수치보다 굵은 쪽이라는 것은 분명하므로 px 수치를 프롬프트에 쓰지 않고 2번 규칙(참조와 나란히 비교)으로 판정한다.
4. **작은 소품일수록 상대적으로 굵다**(꽃 2.5%, 별 3.8%). 화면에서 34~62px로 작게 그려지기 때문이다(`draw.ts`: 별 34px, 독꽃 높이 62px, 말랑이 44px). 새 소품도 "화면에 그려질 크기에서 윤곽이 1px 아래로 사라지지 않는가"를 본다.
5. **코드가 그리는 윤곽**(참고): 보드 틀 4px(`.garden-frame`), 제목 글자 2px(`.garden-title`), 쿠션 윤곽 굵기 18 중 몸 13(`draw.ts`), 바위 기둥 윤곽 14 중 몸 10.

## 3. 명암·질감

- **무광 셀 2단 명암**: 밝은 면 + 경계가 단단한 그늘 1단. 에어브러시·부드러운 그라데이션 광택 금지(바이블 6-2, 스펙 F-3 "평면+1단 하이라이트").
- **예외 1개**: 말랑이만 크림 #fff3dc 투명 하이라이트 타원 1~2개(왼쪽 위)를 허용한다(바이블 3-1·6-2).
- 섬 바위에만 손그림 해칭을 살짝. 노이즈·종이 질감은 이미지에 굽지 않는다(사이트에서 CSS로, hub-redesign-concept 3-6).
- 그늘 색은 회색이 아니라 라벤더 #b79ad9 쪽. 블러 드롭섀도 금지(바이블 6-3·7-4).
- 하늘(장면)은 그라데이션이 정상이다. 이 규칙은 물체(스프라이트·섬·소품)에 적용한다.

## 4. 조명·시간대

| 에셋 종류 | 조명 규칙 | 근거 |
|---|---|---|
| 스프라이트(캐릭터·소품·섬, 배경 투명) | **시간 중립**. 바이블 기준대로 오른쪽 뒤 낮은 해 → 오른쪽·위 가장자리에 크림·살구 테두리광, 그늘은 라벤더. 시간대 색은 생성물에 굽지 않고 코드 틴트로 바꾼다 | 바이블 6-3, 스펙 F-1(꽃에 시간대 틴트) |
| 사이트 장면(히어로·OG·404) | 바이블 9장 규격표의 시간대 1개만(노을 기본, 404는 황혼). 시간대 혼합 금지 | 바이블 9·11-1 6번 |
| 슬라임 스테이지 하늘 | 1-3 표 theme 값. **해·달은 그리지 않는다**(코드가 `orb`로 얹음). 생성은 `sky-night` 1장만 계획됨(7·8 공용) | 스펙 F-2·F-3 |
| 슬라임 지형 | 생성하지 않는다(코드 렌더 `terrainRender.ts`) | 스펙 F-1 |

- 스펙 F-3 공통 앵커의 "빛은 왼쪽 위에서 온다"는 9장 C1 결정에 따라 **요청 작성 시 바이블 문장으로 바꾼다**.
- 시간대별 기믹 단서색(배경 대비): multiline-design 8-2 표(독꽃 보라, 쿠션 산호, 강 청록 #2f9bb0, 바람 흐름선 크림, 문 창살 크림 + 램프 금색). 생성물이 이 색들을 쓰지 않게 한다(게임 단서와 섞임).

## 5. 금지 목록 (요청 프롬프트와 검수 양쪽에 적용)

1. **이미지 안 글자·숫자·로고·서명·워터마크**. 표지판·깃발·우편함은 비워 둔다(GEMINI.md, 바이블 7-5·8). 가짜 글자 자국도 불합격.
2. **원작 IP 닮은꼴**: 기존 게임·브랜드·실존 캐릭터의 이름·그림·구도(GEMINI.md). 특히 유명 배관공·고슴도치·우주 다람쥐 애니 캐릭터·'앵그리' 새(바이블 8), 토리의 돔형 수조 헬멧 + 수영복 구성(바이블 3-2). 프롬프트에 플랫폼·캐릭터·게임 고유명사를 쓰지 않는다(바이블 11-1 8번). 꽃담 정원 관련으로는 'Wall Go·벽바둑·데블스 플랜·Netflix'를 제목·메타·태그에 쓰지 않는다(DECISIONS 11-19).
3. **캐릭터 재생성 금지**(이번 슬라임 요청): 말랑이·토리는 기존 `mallang-*`·`tori-*`를 쓴다(스펙 F-4). 말랑이를 소품 시트에 넣지 않는다(스펙 F-2).
4. **캐릭터 규칙**: 말랑이 초록 점액·흘러내림, 날카로운 이빨, 큰 동공 애니 눈(흰 타원 눈 유지), 분리된 손발 / 토리 사이트 전면에서 발사기 겨누기(바이블 3-1·3-2).
5. **클리셰**: 트로피·왕관·코인 더미·VS 번개·HOT 배지, 무지개 버튼, 네온·CRT·스캔라인·픽셀 아트, INSERT COIN, 3D 클레이·플라스틱 광택·렌즈 플레어, 컨페티 범벅, 흰 스티커 테두리, 회색 블러 그림자(바이블 8).
6. **슬라임 하늘**: 해·달 그리기 금지(코드가 얹음), 보드 가운데 60%에 구름·별 밀집 금지(스펙 F-3).
7. **키 색과 비슷한 색**: 키잉 요청은 대상에 키 색 계열을 쓰지 않는다(6-2 표).
8. **사진 질감·사실적 렌더**(스펙 F-3).

## 6. 파일 형식·크기·용량

### 6-1. 파이프라인이 실제로 하는 일 (`scripts/gen-assets.py` 코드 확인)

- 출력은 **항상 webp**(`quality=86, method=6`). 기본 저장 경로 `public/art/<id>.webp`, critique는 `docs/design/critiques/<id>.md`.
- `size`는 **긴 변 상한**이다. 원본이 더 크면 줄이고, 작으면 **키우지 않는다**. 요청에 해상도 지정(imageSize)을 보내지 않으므로 모델 기본 해상도가 상한이 된다.
- 지금까지 받은 원본 크기(장부·파일 실측): 16:9 → **1376×768**(`hub-keyart-hero`·`hub-og-bg` flash, `hub-d-*` pro, 둘 다 `size` 1536~1600 요청), 9:16 → **768×1376**(pro, `size` 1536), 4:3 → 1200×896(`size` 1200이라 원본이 더 컸는지는 미확인). **3:4·1:1·2:1의 원본 크기는 미확인**.
- `aspect`는 그대로 API의 `aspectRatio`로 넘어간다. 스크립트 머리말 예시는 "1:1 3:4 9:16 16:9 등"이고, **2:1 지원 여부는 미확인**.
- `key`는 **green·magenta 두 가지만** 처리한다. 그 밖의 값(예: 스펙 F-2의 파란색 #0033FF)은 키잉 없이 불투명으로 저장된다.
- 키잉하면 **투명하지 않은 영역의 경계 상자로 자르고, 정사각 캔버스 가운데에 붙인 뒤** `size`로 줄인다. 따라서 키잉한 시트는 원래 격자 좌표가 남지 않는다(6-3).

### 6-2. 키 색 판정 (스크립트 수식)

green: `G − max(R,B)`, magenta: `min(R,B) − G`. 35 넘으면 반투명, 90 넘으면 완전 투명. 토큰별 값(계산):

| 색 | magenta 수식 | green 수식 | 판정 |
|---|---|---|---|
| lavender 그늘 #b79ad9 | **29** | −63 | magenta 경계(35) 근처 — 그늘이 많은 소품은 magenta 위험 |
| jelly-violet #9b7bff | **32** | −132 | magenta 위험(바이블 10-3과 같은 결론) |
| 보라 #6a4fb5 / #c9a8e0 | 27 / **33** | −102 / −56 | magenta 위험 |
| moss #7cc26a | −88 | **70** | green 불가(반투명) |
| tori-mint #a8e6c8 | −62 | 30 | green 경계 근처(바이블 10-3) |
| coral #ff9a85 / #ff7f6b | −21 / −20 | −101 / −128 | 둘 다 안전 |
| sun-gold #ffc933, cream #fff3dc, amber #d98b3a | 음수 | 음수 | 둘 다 안전 |

키 선택은 바이블 10-3 표를 따른다(말랑이 green, 토리·섬·잎·해바라기 magenta, 보라 소품 green, 초록과 보라가 한 장에 다 있으면 나눠서). 장면은 `none`.

### 6-3. 용량·크기 예산

| 에셋 | 형식·크기 | 용량 상한 | 근거 |
|---|---|---|---|
| `sky-night`(슬라임 7·8) | 세로 3:4, 불투명(`key` none). 보드 논리 크기 390×560 × DPR 2 = 780×1120을 덮어야 하므로 **`size` 1120**(아래 주의) | ≤120KB | 스펙 F-2·F-4 |
| `props-garden`(슬라임 소품 8칸) | 스펙 F-2는 1536×768(4×2, 칸 384) | ≤150KB | 스펙 F-2·F-4 |
| 게임 커버 | 16:9, 1200px 안팎 | ≤100KB | GEMINI.md 출시 체크리스트 |
| 사이트 자리별(로고 ≤12KB, 히어로 ≤120KB, 카테고리 섬 각 ≤20KB, 404 ≤60KB, 결과 카드 장식 ≤15KB, OG ≤150KB) | 바이블 9장 표 | 표대로 | 바이블 9 |
| 페이지 전송량 | 허브 게임 페이지 첫 화면 이미지 ≤200KB, 게임 아트는 시작 후 ≤600KB | — | motion-asset-pipeline 3-3 |

- **현재 슬라임 보드가 처음 불러오는 그림**(`SlimeProto.tsx`): mallang-idle·happy·dizzy, plop-bg, plop-island-wide, plop-flower, star = **82,692 B**. `sky-night`(≤120KB)는 6단계 클리어 시 프리로드하고 그 전에는 불러오지 않는다(스펙 F-4).
- `public/art/*.webp` 전체 39장 합계 991,710 B(2026-11-19).
- **주의 1 (`sky-night` size)**: 스펙 F-2의 "긴 변 1120(`size` 780 폭 기준)"은 스크립트 의미(`size` = 긴 변 상한)와 맞지 않는다. `size` 780이면 긴 변이 780으로 줄어 585×780이 된다. 1120을 원하면 `size` 1120으로 적는다. 3:4 원본이 1120보다 작으면 더 작게 나온다(원본 크기 미확인).
- **주의 2 (`props-garden`)**: 지금 파이프라인으로는 1536×768을 만들 수 없다(원본 16:9가 1376×768이었고 2:1 지원은 미확인, 키잉하면 정사각으로 바뀜). 이 시트의 규격·키 색은 PR-10 요청 전에 검수표 4장 "선결 조건"으로 확정한다.

## 7. 이름 규칙

- **id = 파일 이름**(확장자 없이). 소문자 kebab-case. 기본 출력은 `public/art/<id>.webp`.
- **장부에 있는 id는 다시 만들지 않는다**(`regen: true`면 덮어씀). 그래서:
  - **초안과 최종은 id를 다르게** 한다. 초안 `<이름>-draft`(`out`: `docs/design/<영역>/drafts/<이름>-draft.webp`), 최종 `<이름>`(`public/art/`). 스펙 F-3의 "같은 prompt로 model만 pro로 바꿔 최종 1장"을 같은 id로 올리면 **건너뛰어진다**.
  - 불합격 초안을 고쳐 다시 뽑을 때만 `regen: true`를 쓴다(바이블 12장 1.5차).
- 기존 이름 패턴(저장소 확인): `<캐릭터>-<포즈>`(mallang-idle, tori-aim), `<게임접두>-<대상>`(plop-bg, plop-island-wide), `<게임 slug>-cover`(커버), `cat-island-<카테고리>`, `hub-<자리>-<설명>`(hub-og-bg, hub-404-drifted-islet), 시안 `docs/design/mockups/<사이트>-<m|d>-<번호>-<이름>.webp`, 평가 `docs/design/critiques/<대상>-critique-<MMDD 또는 단계>.md`.
- 새 슬라임 에셋 이름은 스펙 F-2를 따른다: `sky-night`, `props-garden`(multiline-design 8-3의 `night-sky`·`props-sheet`는 옛 이름이므로 쓰지 않는다).
- 요청 파일: `docs/design/asset-requests/<묶음>-<번호>.json`(예: hub-pilot-1, ui-mockups-1). 지우지 않는다(GEMINI.md).
- 목표 시안: `docs/design/<영역>/direction/`(GEMINI.md). 지금 있는 것은 `docs/design/plop-landing/direction/target.jpg`(614×1100)뿐이고, `docs/design/slime/direction/`(스펙 F-4)과 `docs/design/hub/direction/`(바이블 10-2)은 **아직 없다**.

## 8. refs 순서 (요청마다 이 순서로, 최대 5장)

순서 = 중요도. 첫 장이 구도·톤을 가장 강하게 끈다는 전제(바이블 10-2)이고, 효과 자체는 측정하지 않았다(미확인).

1. **목표 시안 1장**(해당 영역의 `direction/`). 없으면 요청하지 않는다(스펙 F-4 첫 항목, GEMINI.md).
2. **스타일 기준 1~2장**: 장면이면 `public/art/plop-bg.webp`(하늘·구름), 섬·식생이면 `plop-island-small.webp`·`island.webp`·`plop-flower.webp`.
3. **윤곽·형태 기준 1장**: 같은 종류의 기존 에셋(구름 윤곽은 `cloud-a.webp`, 캐릭터는 그 캐릭터의 idle).
4. (선택) 구도 참고: 합성 시안 캡처.

| 요청 | refs(이 순서) | 출처 |
|---|---|---|
| `sky-night` | `docs/design/slime/direction/<목표 시안>` → `public/art/plop-bg.webp` → `public/art/cloud-a.webp` → PR-2 밤 합성 캡처 | 스펙 F-2 + F-4(목표 시안 맨 앞) |
| `props-garden` | `docs/design/slime/direction/<목표 시안>` → `public/art/island.webp` → `public/art/plop-flower.webp` → `public/art/mallang-idle.webp`(윤곽 비율 기준) | 스펙 F-2. 단 `mallang-idle`은 윤곽이 남색이므로(1-2) **윤곽 색 기준으로는 쓰지 않는다**고 프롬프트에 적거나, 갈색 윤곽인 `mallang-sleepy`/`plop-island-small`로 바꾼다(9장 C3) |
| 캐릭터 포즈 | 그 캐릭터 2장 + 선·색 기준 1장. **장면 이미지 금지**(배경이 따라와 키잉이 깨짐) | 바이블 10-2 |
| 사이트 장면 | `docs/design/hub/direction/hub-keyart.webp`(승격 후) → `docs/design/plop-landing/direction/target.jpg` → `public/art/plop-landing-cover.webp` → `public/art/plop-bg.webp` | 바이블 10-2 |
| critique(혹평) | 평가할 캡처 1장 + 비교용 기존 에셋 0~2장 | GEMINI.md 혹평 루프 |

- refs 파일은 저장소에 실제로 있어야 한다. 스크립트는 확장자로 형식을 정한다(.png → png, .webp → webp, 그 밖은 jpeg).

## 9. 문서 간 충돌과 이 문서의 결정

| # | 항목 | 문서별 내용 | 결정 | 이유 |
|---|---|---|---|---|
| C1 | 광원 방향 | 바이블 6-3: **오른쪽 뒤 낮은 해** / 스펙 F-3·hub-redesign-concept 3-6: **왼쪽 위** | **바이블(오른쪽 뒤)**. 슬라임 하늘은 해/달을 코드가 그리므로 하늘 요청엔 방향을 쓰지 않는다 | 이미 생성된 파일럿 11장(`hub-pilot-1.json`)이 바이블 STYLE LOCK으로 만들어졌다. 기준을 바꾸면 그 11장과 어긋난다 |
| C2 | 질감 | 바이블: 2단 명암, 에어브러시 금지 / hub-redesign 3-6: "평면 셀 + 부드러운 그라데이션 1단" / 스펙 F-3: 평면 + 1단 하이라이트 | **바이블** | 기존 섬·꽃·토리가 무광 셀이다(바이블 0장 진단) |
| C3 | 말랑이 눈·윤곽 기준 | 바이블: 흰 타원 눈, 갈색 윤곽 / hub-redesign 3-6: 검은 구슬 눈 / 스펙 F-2·F-4: 윤곽 기준 refs로 `mallang-idle` | 눈은 **흰 타원(기존 정체성)**. 윤곽 **색** 기준으로 `mallang-idle`을 쓰지 않는다(남색, ΔE 45) | 실측 1-2 |
| C4 | 소품 시트 키 색 | 스펙 F-2: 파란색 #0033FF / gen-assets.py: green·magenta만 | **결정 보류 — PR-10 선결 조건**(검수표 4장). 선택지: ① 스크립트에 blue 키 추가(코드 PR) ② magenta + 그늘을 라벤더 대신 갈색으로 지시 ③ 초록 소품과 나머지를 두 장으로 나눔 | 파란색 그대로 올리면 키잉 없이 불투명 시트가 나온다 |
| C5 | 시간대 값 | theme.ts(= multiline 8-1) / 바이블 5-2 | **슬라임은 theme.ts**. 사이트 `--sky-*` 구현 PR에서 하나로 맞춘다(미결) | theme.ts는 출시된 코드다 |
| C6 | 팔레트 목록 | 바이블 12색 / 스펙 F-3 6색(#6a4fb5, #ff9a85 포함) | 바이블 12색 + 요청별 추가 지정색 | 파일럿과 같은 앵커를 유지 |
| C7 | 실행당 한도 | 스펙 F: `MAX_PER_RUN` 12 / 스크립트·GEMINI.md: 24(오너 11-19 상향) | **24** | 코드 값 |
| C8 | 월 예산 | GEMINI.md 비용 규칙: 월 ₩40,000 / DECISIONS 11-19: 후불 Tier 1, 오너 월 한도 ₩50,000 | DECISIONS(₩50,000, 11월 사용 ₩21,882 기록) | 최신 결정 |
| C9 | 슬라임에서 구름 틴트 | 스펙 F-1: cloud-a/b 틴트 | 슬라임 보드는 cloud-a/b를 **불러오지 않는다**(`SlimeProto.tsx` 확인. cloud-a/b는 Acorn Hop 전용). 구름은 plop-bg 안의 구름이다 | 코드 확인 |

## 10. 프롬프트 조립 순서

1. 바이블 10-1 **STYLE LOCK 영어 문단 전문**(요약·변형 금지).
2. 스프라이트면 바이블 10-1 SPRITE 꼬리말({KEY}를 실제 색 이름·hex로 바꿈), 장면이면 SCENE 꼬리말.
3. 대상 설명(스펙 F-3 초안 등). 이때 F-3 공통 앵커의 광원·팔레트 문장은 넣지 않는다(1번과 충돌, C1·C6).
4. 수치 구도: 빈 영역 %, 대상 폭 %, 시점(정면에서 10~20도 위), 시간대 1개(바이블 11-1 5·6번).
5. 해당 에셋에서 나오기 쉬운 금지 항목을 이름으로 막기(5장).

## 11. 재사용 가능한 기존 에셋 목록 (2026-11-19 측정)

측정: Pillow 10.2(`/usr/bin/python3.12`)로 `public/art/*.webp`를 열어 크기·바이트·알파 비율을 쟀다. "윤곽"은 세로 20~80% 구간의 가로줄마다 바깥에서 안으로 들어가며 처음 만나는 어두운 픽셀(휘도 <95)의 연속 길이 중앙값이다(2장 3번 주의). "쓰는 곳"은 `src/`에서 파일 이름을 검색한 결과다.

| 파일 | 크기(px) | 바이트 | 배경 | 윤곽 중앙값 px (긴 변 대비) | 코드에서 쓰는 곳 | 재사용 메모 |
|---|---|---|---|---|---|---|
| plop-bg.webp | 402×720 | 9,858 | 불투명 | — | Plop Landing, **Slime(모든 스테이지 하늘 바탕)** | 노을 기준 하늘. 시간대 틴트의 바탕 |
| plop-island-wide.webp | 460×278 | 19,138 | 알파 38% 투명 | 4 (0.9%) | Plop, Slime(`drawIslandFloors`) | 넓은 섬 |
| plop-island-small.webp | 300×300 | 14,434 | 알파 39% | 7 (2.3%) | Plop | 갈색 윤곽 섬 기준(바이블 10-2) |
| plop-flower.webp | 114×160 | 8,128 | 알파 37% | 4 (2.5%) | Plop, Slime(목표 꽃 + 보라 틴트 독꽃) | 독꽃은 같은 그림에 `rgba(110,40,150,0.72)` source-atop |
| plop-flag.webp | 200×200 | 7,698 | 알파 73% | 4 (2.0%) | Plop | 크림 삼각기 |
| star.webp | 160×160 | 6,564 | 알파 40% | 6 (3.8%) | Plop, Acorn, Slime(수집물, 34px) | 슬라임 엔진의 `acorns`는 화면에서 이 별로 그린다 |
| island.webp | 360×360 | 25,714 | 알파 41% | 5 (1.4%) | Acorn Hop | 흙 바위·그루터기·버섯 |
| cloud-a.webp | 360×360 | 11,990 | 알파 54% | 7 (1.9%) | Acorn Hop | 구름 윤곽 굵기 기준(스펙 F-2) |
| cloud-b.webp | 360×360 | 12,546 | 알파 42% | 7 (1.9%) | Acorn Hop | |
| bg-sky.webp | 402×720 | 5,072 | 불투명 | — | Acorn Hop | 남색 밤. 노을 정원 밤 토큰과 다름 |
| acorn.webp | 160×160 | 6,814 | 알파 30% | 8 (5.0%, 몸이 어두워 과대) | Acorn Hop(HUD 18px 포함) | |
| bramble.webp | 240×240 | 20,928 | 알파 46% | 6 (2.5%) | Acorn Hop | 가시덤불 장애물 |
| storm.webp | 260×260 | 11,830 | 알파 50% | 5 (1.9%) | Acorn Hop | 폭풍은 게임 안 장애물로만(바이블 4) |
| mallang-idle.webp | 320×320 | 9,592 | 알파 35% | 5 (1.6%), **남색** | Plop, Slime(44px) | 정체성 기준. 윤곽 색 기준으로는 쓰지 않음 |
| mallang-happy.webp | 320×320 | 13,734 | 알파 35% | 4 (1.25%), 남색 | Plop, Slime | |
| mallang-dizzy.webp | 320×320 | 15,678 | 알파 52% | 4 (1.25%), 남색 | Plop, Slime | |
| mallang-sad.webp | 512×512 | 23,972 | 알파 37% | 8 (1.6%), 갈색 | 없음(11-19 flash 파일럿) | 갈색 윤곽 말랑이 |
| mallang-sleepy.webp | 512×512 | 25,940 | 알파 25% | 9 (1.8%), 갈색 | 없음(파일럿) | |
| mallang-wave.webp | 512×512 | 26,128 | 알파 32% | 9 (1.8%), 갈색 | 없음(파일럿) | |
| tori-idle.webp | 360×360 | 22,392 | 알파 39% | 5 (1.4%) | Acorn Hop | 토리 기준 |
| tori-aim.webp | 360×360 | 22,946 | 알파 43% | 4 (1.1%) | Acorn Hop | 사이트 전면 금지 포즈 |
| tori-fire.webp | 360×360 | 21,258 | 알파 52% | 4 (1.1%) | Acorn Hop | 사이트 전면 금지 포즈 |
| tori-happy.webp | 360×360 | 23,132 | 알파 33% | 5 (1.4%) | Acorn Hop | |
| tori-dizzy.webp | 360×360 | 23,768 | 알파 36% | 5 (1.4%) | Acorn Hop | |
| tori-think.webp | 512×512 | 42,638 | 알파 38% | 7 (1.4%) | 없음(파일럿) | |
| tori-cheer.webp | 512×512 | 37,726 | 알파 39% | 7 (1.4%) | 없음(파일럿) | |
| cat-island-daily.webp | 512×512 | 42,484 | 알파 43% | 5 (1.0%) | 없음(파일럿) | 카테고리 섬 상한 20KB(바이블 9)의 2배 |
| cat-island-puzzle.webp | 512×512 | 41,700 | 알파 42% | 8 (1.6%) | 없음(파일럿) | 상한의 2배 |
| cat-island-arcade.webp | 512×512 | 31,570 | 알파 55% | 7 (1.4%) | 없음(파일럿) | 상한의 1.6배 |
| hub-keyart-hero.webp | 1376×768 | 76,066 | 불투명 | — | 없음(파일럿) | 히어로 상한 120KB 안 |
| hub-og-bg.webp | 1376×768 | 62,986 | 불투명 | — | 없음(파일럿) | |
| hub-404-drifted-islet.webp | 1200×896 | 48,512 | 불투명 | — | 없음(파일럿) | 404 상한 60KB 안 |
| plop-landing-cover.webp | 1200×670 | 39,090 | 불투명 | — | gameMeta 커버 | 장면 기준(바이블 10-2) |
| acorn-hop-cover.webp | 1200×670 | 31,186 | 불투명 | — | gameMeta 커버 | 남색 밤 |
| slime-slide-cover.webp | 1200×670 | 34,956 | 불투명 | — | gameMeta 커버 | 기존 에셋 합성(생성 0, 장부 `kind: composite`) |
| polarity-cover.webp | 1200×670 | 46,764 | 불투명 | — | gameMeta 커버 | 노을 정원 밖(네온) |
| shadowfit-cover.webp | 1200×670 | 26,182 | 불투명 | — | gameMeta 커버 | 노을 정원 밖 |
| slosh-cover.webp | 1200×670 | 40,596 | 불투명 | — | gameMeta 커버 | 노을 정원 밖 |

참고(요청 refs로 쓸 수 있는 저장소 밖 `public/art` 이미지): `docs/design/plop-landing/direction/target.jpg` 614×1100 75,299 B, `docs/design/mockups/*.webp` 8장(모바일 768×1376, 데스크톱 1376×768, 79,530~119,732 B, pro로 생성).
