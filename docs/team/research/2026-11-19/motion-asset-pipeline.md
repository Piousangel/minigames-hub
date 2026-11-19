# 모션·에셋 파이프라인 설계안 — 미니게임 허브 · 샌드랩

작성 2026-11-19 · 크리에이티브 테크놀로지 디렉터 관점 · 저장소 소스는 수정하지 않음

표기: **[확인]** 공식 문서·레지스트리를 직접 열어 보거나 직접 측정함 · **[요약]** 검색 결과·2차 자료를 요약함 · **[추정]** 경험에 기반한 판단으로 검증이 필요함

## 0. 현재 상태 (저장소에서 확인)

| 항목 | 허브 (minigames-hub) | 샌드랩 (sandlab) |
|---|---|---|
| Next / React (설치본) | next 15.5.20 / react 19.2.7 [확인] | 동일 [확인] |
| 빌드 | `output: 'export'` → Cloudflare `wrangler deploy` | 동일 |
| 스타일 | Tailwind 4 | Tailwind 없음 (자체 CSS) |
| 모션 | 자체 CSS + `Reveal`·`Marquee`·`SpotlightCard`, `prefers-reduced-motion` 처리가 이미 있음 | 캔버스·WebGPU(`@webgpu/types`), `mediabunny`(영상 인코딩) |
| 에셋 | `public/art` 568KB, Gemini 요청→Actions 생성 (`gen-assets.yml`) | `public/art` 184KB, 같은 스크립트 |
| E2E | Playwright 1.61 + `e2e/smoke.spec.ts`, `out/`을 `serve`로 띄움 | 없음 (`verify-*.py/mjs` 스크립트만 있음) |
| 광고 | `AdSlot.tsx`에서 `adsbygoogle` push, 로더는 `layout.tsx` | `verify-ads.mjs` 배포 게이트 |

현재 모션 라이브러리 의존성은 **0개**입니다. 이 상태가 성능 면에서 가장 좋은 출발점이므로, 아래 추천은 "꼭 필요한 곳에만 더한다"는 원칙을 따릅니다.

---

## 1. 모션 스택

### 1-1. 비교표

번들 크기는 2026-11-19에 npm에서 최신 버전을 설치한 뒤 직접 쟀습니다. esbuild로 minify·ESM 번들링하고 react와 react-dom은 외부로 뺀 다음 `gzip -9`로 압축했습니다 [확인]. 실제 크기는 트리 셰이킹 정도에 따라 ±10% 달라질 수 있습니다.

| 선택지 | 버전 | gzip (JS) | 추가 다운로드 | 정적 export 호환 | 모바일 성능 | 라이선스 | 학습·유지 비용 |
|---|---|---|---|---|---|---|---|
| **CSS View Transitions** | 브라우저 | 0 | – | ○ (클라이언트 내비게이션) | 컴포지터에서 처리, 최상 | – | 낮음 |
| **CSS `@starting-style` + `linear()` 스프링** | 브라우저 | 0 | – | ○ | 최상 (transform·opacity만) | – | 낮음 |
| **CSS scroll-driven animations** | 브라우저 | 0 | – | ○ | 최상 (메인 스레드 밖) | – | 낮음 |
| **Motion `motion/mini` (`animate`)** | motion 14.14.0 | **3.7KB** | – | ○ | WAAPI 기반이라 좋음 | MIT [확인] | 낮음 |
| Motion `animate` (하이브리드) | 14.14.0 | 28.5KB | – | ○ | 좋음 | MIT | 낮음 |
| Motion React (`LazyMotion`+`m`+`domAnimation`) | 14.14.0 | 37.0KB | – | ○ (`"use client"`) | 좋음 | MIT | 중간 |
| Motion React (`motion` 전체) | 14.14.0 | 54.6KB | – | ○ | 좋음 | MIT | 중간 |
| GSAP core | 3.15.1 | 28.5KB | 플러그인은 별도 | ○ | 좋음 | **GSAP Standard License**: 상용·플러그인 모두 무료. Webflow와 경쟁하는 노코드 애니메이션 빌더에만 사용 금지 [확인] | 중간 (타임라인이 강력함) |
| react-spring (`@react-spring/web`) | 10.1.2 | 17.7KB | – | ○ | 보통 (JS로 매 프레임 계산) | MIT [확인] | 중간 |
| **Rive** (`@rive-app/canvas-lite`) | 2.51.0 | 63.6KB | **WASM 366KB gz** | ○ (WASM 파일을 self-host) | 좋음 (캔버스 렌더) | 런타임 MIT. 에디터는 Free 플랜에서 export하면 스플래시가 붙고, Cadet $17/seat/월부터 스플래시가 없음 [확인] | 높음 (에디터·상태 머신) |
| **dotLottie** (`@lottiefiles/dotlottie-web`) | 0.83.2 | 13.1KB | **WASM 492KB gz** | ○ | 좋음 (ThorVG) | MIT [확인] | 중간 (AE 또는 LottieFiles) |
| lottie-web light (SVG) | 5.13.0 | 48.9KB | – | ○ | 보통 (SVG 노드가 많으면 느림) | MIT | 중간 |
| PixiJS | 8.23.0 | 177.9KB | – | ○ (클라이언트 전용) | 좋음 (WebGL·WebGPU) | MIT [확인] | 중간 |
| three.js (최소 import) | 0.187.0 | 133.7KB | – | ○ | 장면 복잡도에 따라 다름 | MIT | 높음 |
| R3F (`@react-three/fiber` + three) | 9.8.2 | 252.2KB | – | ○ | 위와 같음 | MIT | 높음 |

브라우저 지원:
- **View Transitions (same-document)**: React의 통합 기능은 transition types와 `view-transition-class`를 쓰며, 이는 Chromium 125+와 최근 Safari·Firefox에서 동작합니다. 지원하지 않는 브라우저에서도 앱은 정상 동작하고 애니메이션만 생략됩니다 [확인: Next.js 가이드, 2026-11-18 갱신].
- **React `<ViewTransition>`**: React 19.3(2026-09-09)부터 stable입니다 [요약]. 그러나 **두 사이트가 쓰는 Next 15**에서는 `experimental.viewTransition` 플래그와 `unstable_ViewTransition` import가 필요하고, 문서에 "production 비추천"이라고 적혀 있습니다 [확인: Next 15 문서]. 최신 Next 가이드는 "App Router에서 설정 없이 동작"한다고 설명합니다 [확인].
- **Scroll-driven animations**: Firefox 159부터 기본 활성화되어 Baseline Newly available이 됐습니다 [요약: web.dev 2026-10]. 이전 Firefox를 위해 `@supports (animation-timeline: scroll())`로 감쌉니다.
- **`@starting-style`, `linear()` easing**: 3대 엔진이 모두 지원합니다 [추정: 2024년 무렵 모두 출시됨].

### 1-2. 결론: 사이트별 최소 조합

**허브 (콘텐츠·광고 페이지가 많고 LCP와 CLS가 중요함)**
1. **CSS 우선**: View Transitions, `@starting-style`, `linear()` 스프링, scroll-driven. 추가 JS는 0입니다.
2. **`motion/mini` 3.7KB**: JS에서 시작해야 하는 시퀀스(결과 카드 단계 연출, 숫자 카운트업)에 씁니다. WAAPI 위에서 동작하므로 메인 스레드 부담이 작습니다.
3. **자체 스프링 훅(~1KB, 직접 작성)**: 포인터를 따라가는 젤리 변형(드래그·누름)에만 씁니다. rAF에서 `transform`만 갱신합니다.
4. 캔버스 게임은 지금처럼 자체 Canvas 2D를 씁니다. PixiJS는 스프라이트 수백 개와 필터가 필요한 **특정 게임 라우트에서만** 동적 import합니다.
5. Motion React, GSAP, R3F는 **도입하지 않습니다.** 37~250KB를 쓸 만큼 이득인 화면이 현재 없습니다 [추정].

**샌드랩 (시뮬레이션·WebGPU 중심, 첫 화면이 곧 캔버스)**
1. 허브와 같은 CSS 모션 프리미티브를 공유합니다(토큰과 CSS가 같음).
2. 시뮬레이션은 지금처럼 raw WebGPU와 Canvas를 씁니다. three.js와 Pixi는 넣지 않습니다(이미 엔진을 직접 갖고 있음).
3. `motion/mini`는 UI 패널과 결과·공유 카드에만 씁니다.
4. 결과 공유 영상은 이미 들어 있는 `mediabunny`로 캔버스를 녹화해 WebM이나 MP4로 만듭니다(라이브러리 추가 없음).

### 1-3. 연출별로 쓸 기술

| 연출 | 기술 | 구현 요지 |
|---|---|---|
| **젤리 스프링 UI** (버튼·카드·토글) | CSS `linear()` 스프링 토큰 + `@starting-style` (등장) | `--spring-jelly: linear(0, 1.12 18%, 0.96 34%, 1.02 52%, 1)` 같은 스프링 곡선을 **토큰으로 고정**합니다. 누를 때 `scale(0.94, 0.9)`에서 놓을 때 `1.04, 0.98`을 거쳐 1로 돌아가며 찌그러지고 늘어나게 합니다. transform만 쓰므로 INP에 영향이 없습니다. |
| 드래그·손가락 추적 젤리 | 자체 `useSpring` 훅(질량·강성·감쇠) | 속도에 비례해 `scaleX/scaleY`를 반대로 줍니다. 모션 줄이기 설정이면 바로 위치로 이동합니다. |
| **페이지 전환** | View Transitions | 1단계(Next 15 유지): 플래그 없이 **CSS `@view-transition`과 수동 `document.startViewTransition` 래퍼를 `Link` 클릭에 적용**하거나, 실험 플래그를 켜고 `unstable_ViewTransition`을 씁니다. 2단계: Next 16과 React 19.3으로 올린 뒤 stable `<ViewTransition>`, `transitionTypes={['nav-forward']}`, 게임 카드 썸네일에서 게임 히어로로 이어지는 **공유 요소 morph**를 적용합니다. 헤더는 `view-transition-name`으로 고정하고 `::view-transition { pointer-events: none }`을 줍니다. 브라우저 뒤로 가기에서는 애니메이션이 나오지 않습니다 [확인]. |
| **결과 카드 연출** | `motion/mini` 타임라인 + CSS | 순서: 카드가 스프링으로 올라옴(0~350ms) → 점수 카운트업(rAF, 600ms) → 등급 도장(scale 1.6→1, 젤리) → 파티클(캔버스 1장, 40개 이하, 900ms 뒤 정지) → 공유 버튼 등장. **모든 단계는 탭으로 건너뛸 수 있게** 합니다. 결과 카드는 공통 컴포넌트 `ResultCard`로 만듭니다. |
| **캐릭터 반응** | 기본: **포즈 이미지 교체 + 코드 스프링**(squash·stretch·흔들림), 2차 후보: Rive | GEMINI.md 규칙("전신 포즈를 통째로, 움직임은 코드 스프링")과 맞습니다. 포즈 4~6장(idle·happy·sad·surprise·win)을 webp 스프라이트 시트 1장으로 묶습니다. Rive(약 430KB)는 **한 게임에서 시범 적용**했을 때 체류 시간이 오르면 그때 확장합니다. |
| 스크롤 연출 (허브 홈·가이드) | scroll-driven `view()` 타임라인 | 기존 `Reveal.tsx`의 IntersectionObserver 방식을 CSS로 대체할 수 있습니다(`@supports`로 감싸고, 미지원 브라우저는 기존 방식 유지). |
| 축하 이펙트 | 캔버스 파티클 (자체 코드) | 라이브러리를 쓰지 않습니다(confetti 계열은 써도 ≤3KB). |

---

## 2. 에셋 파이프라인

### 2-1. 이미지 (캐릭터·소품·배경·커버)

**모델 단가 (AI Studio 요금 페이지, 2026-11-19 확인)** [확인]

| 모델 | 1K | 2K | Batch | 용도 |
|---|---|---|---|---|
| `gemini-3-pro-image` (Nano Banana Pro) | $0.134 | $0.134 | 없음 | 현재 최종용 |
| `gemini-3.1-flash-image` (Nano Banana 2) | $0.067 | $0.101 | 없음 | 현재 초안용 |
| **`gemini-nano-banana-2.1` (최신)** | **$0.0336** | $0.0504 | **$0.0168** (50%) | **추천: 초안과 일반 에셋** |
| `gemini-3.1-flash-lite-image` | $0.0336 | – | $0.0168 | 아이콘·대량 변형 |

- GEMINI.md의 "이미지에는 Batch 할인이 없다"는 설명은 **2.1 계열이 나오면서 바뀌었습니다.** 초안을 2.1로 바꾸면 장당 단가가 flash 대비 약 1/2, Batch를 쓰면 약 1/4이 됩니다. 같은 월 ₩40,000 예산으로 더 많이 뽑을 수 있습니다. **2.1 품질은 아직 검증하지 않았으므로** 한 회차에서 같은 프롬프트로 A/B 비교한 뒤 전환합니다 [추정].
- 대안: Imagen 4(장당 약 $0.02~0.06 [요약])는 텍스트로만 생성하는 데 강하지만, **참조 이미지로 일관성을 유지하는 기능은 Gemini 이미지 모델이 낫습니다** [추정]. Figma MCP에도 `generate_image`와 `weave_run_model`(Figma Weave 모델 실행)이 있습니다. 다만 Figma 크레딧을 쓰고 로컬 세션에서만 호출할 수 있으므로 보조 수단으로만 둡니다 [추정: 크레딧 정책은 확인 필요].

**스타일을 일관되게 유지하는 방법 (현재 규칙에 더할 것)**
1. **스타일 시트 1장(사이트별)**: `docs/design/<site>/style-sheet.webp`에 팔레트 칩 6색, 외곽선 두께 샘플, 재질(종이·점토 등), 빛 방향(좌상단 45°), 그림자 규칙, 대표 캐릭터 3/4 뷰를 한 장에 담습니다. **모든 요청의 `refs[0]`에 이 시트를 고정으로 넣습니다.**
2. **프롬프트 템플릿을 고정**: `prompt-preamble.txt`(스타일 문장)와 `negative`(글자·워터마크·그라데이션 배경·3D 렌더 느낌 금지)를 스크립트에서 자동으로 앞에 붙입니다. 요청 JSON에는 **대상만** 적습니다.
3. **시드 대신 참조 이미지로 고정**: Gemini 이미지 API는 시드 재현성이 약합니다 [추정]. 일관성은 refs(스타일 시트, 캐릭터 기준 포즈)와 같은 템플릿으로 확보합니다. 기준이 된 생성 이미지는 장부에 "canonical" 표시를 남깁니다.
4. **후처리 표준화**(gen-assets.py 확장 후보): 단색 키잉 → **팔레트 양자화(6~8색으로 스냅)** → 외곽선 정리 → 크기별 webp와 avif 출력 → 가장자리 1px 알파 정리. 팔레트 스냅을 하면 모델이 만든 색 흔들림이 사라져 일관성이 가장 크게 오릅니다 [추정].
5. **혹평 루프**는 지금처럼 유지하되, 비교 기준으로 스타일 시트를 함께 넣습니다("이 시트와 얼마나 같은 세계인가"를 10점 만점으로 평가).

### 2-2. 벡터·아이콘

- **Figma → SVG**: 아이콘 세트는 Figma 파일 한 곳에서 관리합니다. 이 세션의 Figma MCP(`download_assets`, `get_design_context`, `get_variable_defs`)로 SVG와 변수(토큰)를 가져와 `svgo`로 최적화한 뒤 `src/components/icons/`에 React 컴포넌트로 넣습니다. 허브에는 이미 `icons/`가 있습니다.
- 디자인 토큰은 **Figma Variables와 코드 `tokens.json`을 양방향 기준으로** 둡니다. 기준 원본은 코드이고 Figma는 미러입니다. 클라우드 루틴은 Figma MCP를 못 쓰므로 원본을 코드에 둬야 야간 교대 팀도 수정할 수 있습니다.
- 아이콘 생성은 Figma MCP `generate_vector_illustration`으로 초안을 만들 수 있지만, 일관성을 위해 **24px 그리드와 2px 스트로크 규칙**을 먼저 정합니다 [추정].

### 2-3. 캐릭터 애니메이션: 무엇을 쓸지

| 방식 | 비용 (런타임) | 표현력 | 제작 파이프라인 | 판정 |
|---|---|---|---|---|
| **포즈 스프라이트 시트 + 코드 스프링** | 0KB JS, 시트 1장 30~80KB | 포즈 전환과 탄성 | Gemini로 포즈를 통째 생성 → 키잉 → 시트로 묶기 (지금 파이프라인 그대로) | **기본** |
| 프레임 스프라이트 시트 (8~12프레임 루프) | 0KB JS, 시트 100~250KB | 걷기·점프 루프 | 생성 모델로는 프레임 간 일관성을 얻기 어려움 [추정] → 사람이나 Rive가 필요 | 제한적 |
| **Rive 상태 머신** | JS 64KB + WASM 366KB(gz) | 최상 (입력에 반응, 블렌드, 눈 추적) | Rive 에디터에서 리깅. 생성 이미지는 파츠로 분리해야 함(GEMINI.md에 "부위 조립이 어색했다"는 교훈이 있음) | **시범 1개** |
| Lottie (dotLottie) | JS 13KB + WASM 492KB(gz), 또는 light 49KB | 정해진 연출(축하·로딩) | AE나 LottieFiles 필요, 상호작용은 약함 | 우선순위 낮음 |

결론: 캐릭터 반응은 **스프라이트 시트와 코드 스프링**으로 시작합니다. Rive는 "가장 많이 플레이되는 게임 1개의 마스코트"에만 시범 적용하고, 사용자 상호작용 뒤에 지연 로드해 LCP 경로에서 뺍니다. WASM은 `public/`에 self-host합니다(CDN 의존 제거). Lottie는 원하는 리소스가 이미 있을 때만 씁니다.

### 2-4. 짧은 루프 영상 (히어로·게임 미리보기·마케팅)

- **생성**: Veo 3.1 계열 [요약: 720p 기준 Veo 3.1 $0.40/초, Fast $0.10/초, Lite $0.05/초. 공식 표는 이번에 직접 확인하지 못함]. 같은 `GEMINI_API_KEY`(결제 활성화)로 호출할 수 있습니다 [추정]. **8초 Lite 클립 1개는 약 $0.40**입니다. 더 싸고 일관성이 높은 방법은 **게임 화면을 직접 캡처**하는 것입니다(Playwright `recordVideo` 또는 캔버스 + `mediabunny`, 비용 0). 게임 미리보기는 캡처를 기본으로 합니다.
- **인코딩**: `ffmpeg`로 **AV1(libsvtav1) MP4 또는 WebM**과 **H.264 MP4 대체본**을 같이 만들고, 360~480px 폭, 15~24fps, 3~6초 루프로 맞춥니다. Safari의 AV1 디코딩은 하드웨어 지원 기기에서만 됩니다 [추정: iPhone 15 Pro 이상, M3 이상]. 그래서 H.264 대체본이 꼭 필요합니다.
- **마크업**: `<video autoplay muted loop playsinline preload="none" poster="...webp">`. 음소거 상태의 자동재생은 Chrome에서 항상 허용되고, iOS에서는 `playsinline`이 있어야 인라인으로 재생됩니다. 저전력 모드에서는 자동재생이 막힐 수 있으므로 **포스터만으로도 화면이 완성돼 보여야** 합니다 [요약: Chrome 자동재생 정책].
- **로딩**: 화면에 들어올 때(IntersectionObserver) `src`를 붙여 재생합니다. `prefers-reduced-motion`이거나 `navigator.connection.saveData`이면 포스터만 보여 줍니다. **LCP 요소는 영상이 아니라 포스터 이미지가 되도록** 합니다.

### 2-5. 사운드

| 방식 | 비용 | 용도 |
|---|---|---|
| **코드 합성 (WebAudio, ZzFX류 ~1KB 또는 자체 코드)** | 0 | UI 탭·점수·콤보·실패 효과음. 게임마다 음높이와 리듬만 바꿈 → **기본** |
| Lyria 3 Clip(30초) / Pro(전곡) | $0.04 / $0.08 per song [확인] | 홈·게임 BGM 루프 소량 (같은 Gemini 키) |
| 샘플 라이브러리 (CC0: Kenney, freesound CC0) | 0 | 합성이 어려운 환경음 |

규칙: 소리는 첫 사용자 제스처 뒤에 `AudioContext`를 열고, 기본은 음소거하거나 토글을 눈에 띄게 둡니다. BGM은 Opus/WebM 48~64kbps에 MP3 대체본을 두고, 1곡 ≤ 400KB, 지연 로드합니다.

### 2-6. 오너가 준비할 것과 지금 있는 것으로 되는 것

| 단계 | 지금 있는 것으로 가능 | 오너 준비가 필요한 것 |
|---|---|---|
| CSS 모션·`motion/mini`·자체 스프링 | ○ 전부 가능 | 없음 |
| 이미지 생성 (Gemini) | ○ `GEMINI_API_KEY` + Actions | **2.1 모델 전환과 Batch 사용 승인** (예산 규칙 변경). 잔액 유지 |
| 스타일 시트 · 후처리 | ○ (Pillow 등 Actions에서 실행) | 없음 |
| Figma → SVG·토큰 미러 | △ Figma MCP 연결은 돼 있음 | **편집 권한이 있는 Figma 파일(또는 팀 프로젝트) 1개와 링크 공유.** 쓰기·생성 도구는 유료 좌석이 필요할 수 있음 [추정: 플랜 확인 필요] |
| Veo 영상 | △ 같은 키로 될 가능성이 높음 [추정] | **영상 월 예산 승인**(예: ₩15,000 ≈ Lite 8초 클립 25개), 키에서 Veo 사용 가능 여부 1회 확인 |
| 게임 캡처 영상 | ○ Playwright, mediabunny, ffmpeg(Actions 러너) | 없음 |
| Rive 시범 | × | **Rive 계정 + Cadet $17/seat/월**(Free 플랜으로 export하면 스플래시가 붙음) [확인]. 시범이 끝날 때까지 1개월만 |
| Lottie | △ (공개 dotLottie 파일만) | 필요할 때 LottieFiles 계정 (선택) |
| 사운드 합성 | ○ | 없음 |
| Lyria BGM | △ 같은 키 [추정] | **BGM 생성 승인**(곡당 $0.04~0.08) |
| Canva | × (인증 안 됨) | 선택. 마케팅 템플릿이 필요할 때만 인증 |
| 저사양 실기 검증 | △ CPU 스로틀 에뮬레이션만 가능 | **저사양 안드로이드 1대** (예: Galaxy A1x/A0x급), USB 원격 디버깅 |

주의: **클라우드 루틴(야간 교대)은 Figma·Playwright MCP를 쓸 수 없습니다.** 따라서 생성·캡처·검증은 모두 **GitHub Actions 워크플로**로 만들고(지금의 gen-assets 방식), Figma 작업은 로컬 메인 세션 전용으로 둡니다.

---

## 3. 성능 예산

### 3-1. 기준 환경
- 랩: Lighthouse 모바일 기본값(느린 4G, CPU 4배 스로틀) + Playwright 390×844, DPR 2.
- 실기: 저사양 안드로이드(Galaxy A 시리즈급, Chrome 최신).
- 필드: 이미 있는 지표 수집에 **`web-vitals` 6.2.3**(Apache-2.0, attribution 빌드 사용) [확인]으로 LCP·CLS·INP를 붙여 p75를 봅니다. Lighthouse는 실제 광고 경매를 돌리지 않으므로 **광고로 인한 CLS는 필드 데이터로만** 판단할 수 있습니다 [요약].

### 3-2. 목표 (p75, 모바일)

| 지표 | 합격 (Google 기준) | **우리 목표** |
|---|---|---|
| LCP | ≤ 2.5s | **≤ 2.0s** (랩 ≤ 2.5s) |
| CLS | ≤ 0.1 | **≤ 0.05** (광고 포함) |
| INP | ≤ 200ms | **≤ 150ms**, 게임 입력은 ≤ 100ms |
| 모션 프레임 | – | 전환·결과 연출 중 **p95 프레임 ≤ 20ms**, 50ms 넘는 long animation frame 0개 (CPU 4배 스로틀 기준) |

### 3-3. 페이지별 예산 (전송량, gzip 기준)

| 페이지 유형 | JS (Next 런타임 포함) | 이미지 (첫 화면) | 영상 | 폰트 |
|---|---|---|---|---|
| 허브 홈·목록·가이드 | **≤ 170KB** (라우트 고유분 ≤ 40KB) | ≤ 250KB, LCP 이미지 ≤ 100KB(avif/webp, `fetchpriority="high"`) | 첫 화면에 없음. 아래쪽 루프 1개 ≤ 600KB, 화면에 들어올 때 로드 | ≤ 2개 woff2, 서브셋 |
| 허브 게임 페이지 | ≤ 250KB (게임 코드는 동적 import) | 첫 화면 ≤ 200KB, 게임 아트는 시작 후 ≤ 600KB | 없음 | 위와 같음 |
| 샌드랩 홈 | ≤ 200KB (시뮬레이터는 상호작용 뒤 로드) | ≤ 200KB | 포스터 기본, 영상 ≤ 600KB 지연 로드 | 위와 같음 |
| 샌드랩 시뮬레이터 | ≤ 300KB | ≤ 150KB | 녹화 결과는 클라이언트에서 생성 | 위와 같음 |
| Rive·Pixi 사용 라우트(예외) | +430KB(Rive) / +180KB(Pixi). **사용자 상호작용 뒤에만 로드** | – | – | – |

Next 15 App Router의 기본 first-load JS는 약 100KB gz 수준입니다 [추정]. 실제 기준선은 첫 측정에서 확정하고, 그 값에서 +10%를 넘으면 실패로 처리합니다.

### 3-4. 움직임 줄이기 대체
- 전역: `@media (prefers-reduced-motion: reduce)`이면 위치 이동(slide·parallax·bounce)을 **불투명도 크로스페이드(≤150ms)로 바꾸고**, 젤리 스프링은 즉시 이동, 파티클은 0개, 자동재생 영상은 포스터만, scroll-driven은 끕니다. 허브 globals.css에 이미 이 블록이 있으므로 토큰 단위로 확장합니다.
- JS: `motion/mini`와 자체 스프링은 공통 `reducedMotion()` 유틸을 거칩니다(지금처럼 컴포넌트마다 matchMedia를 부르지 않음).
- 사이트 안에 "움직임 줄이기" 토글을 두고 `data-motion="reduced"` 속성으로 OS 설정을 덮어씁니다.

### 3-5. AdSense와 함께 쓰기
1. **자리 예약**: 모든 `AdSlot`에 `min-height`를 주고 aspect 슬롯으로 고정합니다(가장 큰 크기 기준). 빈 공간이 남는 편이 레이아웃이 밀리는 것보다 낫습니다 [요약].
2. **로더 시점**: `adsbygoogle.js`는 LCP 이후(`requestIdleCallback`이나 첫 상호작용, 최대 3초)에 넣습니다. 첫 화면 아래 슬롯은 지연 로드하고 rootMargin을 넉넉히 둡니다 [요약]. Auto ads는 CLS를 통제하기 어려우므로 **수동 슬롯을 우선**합니다 [요약].
3. **모션 격리**: 광고 컨테이너와 그 조상에는 transform, 애니메이션, view-transition을 걸지 않습니다. 광고를 애니메이션시키거나 움직이는 요소를 광고 옆에 두어 **실수 클릭을 유도하면 정책 위반 소지**가 있습니다 [추정: AdSense 실수 클릭 정책]. 결과 카드 연출 중에는 그 근처에 광고를 두지 않고, 연출이 끝난 뒤 광고가 고정된 자리에 보이게 합니다.
4. **게임 중**: 게임을 플레이하는 동안 캔버스 위나 옆에 광고 새로고침을 하지 않습니다. 광고는 결과 화면 아래 고정 슬롯 1개만 둡니다.
5. 광고 iframe은 view transition 스냅샷에 들어가므로 전환 중 잠깐 얼어 보일 수 있습니다 [추정]. 전환 시간은 ≤ 400ms로 유지합니다.

---

## 4. 품질 관리 자동화 (매 PR 최소 세트)

GitHub Actions의 `qa.yml` 하나에 넣습니다. 클라우드 루틴이 PR을 열면 자동으로 돌아갑니다. Playwright 1.65.1, Apache-2.0 [확인].

| # | 검사 | 도구 | 합격 기준 | 소요 |
|---|---|---|---|---|
| 1 | 빌드 + **번들 예산** | `next build` 후 `out/_next/static`에서 라우트별 gz 합계를 내는 스크립트(약 30줄) | 3-3 예산 이내, 기준선 대비 +10% 이내 | 2분 |
| 2 | **390/1440 캡처 + 시각 회귀** | Playwright `toHaveScreenshot()` (내장 pixelmatch). 프로젝트 2개: `mobile-390`(390×844, DPR 2, isMobile) · `desktop-1440`(1440×900) | `maxDiffPixelRatio: 0.01`, `animations: 'disabled'`, `reducedMotion: 'reduce'`. 광고·날짜·랜덤 영역은 `mask` 처리 | 2분 |
| 3 | **Lighthouse CI** | `@lhci/cli` 0.16.1, Apache-2.0 [확인], `staticDistDir: ./out`, 핵심 URL 3개(홈·게임 1개·가이드 1개), 3회 중앙값 | perf ≥ 0.85, LCP ≤ 2.5s, CLS ≤ 0.05, TBT ≤ 200ms, `resource-summary` 예산 | 4분 |
| 4 | 접근성 스모크 (선택) | `@axe-core/playwright` 4.14.0 (MPL-2.0) [확인] | critical 0개 | +30초 |

- **기준 이미지**는 Linux 러너에서만 만듭니다(공식 Playwright Docker 이미지 버전 고정). macOS 로컬에서 만든 스크린샷과 섞으면 글꼴 렌더링 차이로 계속 실패합니다. 기준 갱신은 PR에 `update-snapshots` 라벨을 붙였을 때만 워크플로가 `--update-snapshots`를 돌려 커밋합니다.
- **캡처 결과는 PR 코멘트에 이미지로** 첨부합니다(390과 1440 각각 홈과 변경된 페이지). 사람과 Gemini 혹평 루프가 같은 캡처를 씁니다.
- **모션 프레임 측정 (야간 1회, PR마다는 아님)**: Playwright + CDP `Emulation.setCPUThrottlingRate(4)`, 페이지에 `PerformanceObserver({type:'long-animation-frame'})`를 붙이고 rAF 간격을 기록하는 스크립트를 주입합니다. 시나리오는 홈 → 게임 전환(View Transition), 결과 카드 연출, 젤리 버튼 10회 탭입니다. 결과(p95 프레임, LoAF 개수, INP 근사)를 `docs/perf/motion-YYYYMMDD.json`에 남기고 3-2 기준을 넘으면 이슈를 엽니다.
- 샌드랩에는 아직 Playwright 설정이 없으므로 허브의 `playwright.config.ts`(`out/`을 `serve`)를 그대로 옮깁니다.

---

## 5. 첫 2주 실행 순서

원칙: **1주차는 오너 준비 없이** 진행합니다. 매 단계는 PR 1개이고 4장의 QA 세트를 통과해야 합니다.

| 날 | 단계 | 산출물 | 검증 |
|---|---|---|---|
| D1 | **QA 기반 먼저** | `qa.yml`(번들 예산 + 390/1440 스크린샷 + LHCI), 샌드랩 Playwright 설정, 현재 기준선 기록 | 기존 페이지가 모두 통과함. 기준선 수치(`docs/perf/baseline.json`) |
| D2–D3 | **디자인 토큰 패키지** | `tokens/tokens.json`(색·간격·반경·그림자·**모션: duration 4단계, easing 3종, spring 3종을 `linear()`로**) → `scripts/build-tokens.mjs`가 `tokens.css`(CSS 변수)와 `tokens.ts` 생성. 공통 모션 토큰은 두 저장소에 같은 파일을 쓰고(동기화 스크립트), 색은 사이트별 테마 파일로 분리. 허브는 Tailwind 4 `@theme`에 연결 | 토큰 스냅샷 테스트, 시각 회귀 diff 0(값만 이동했으므로) |
| D4–D5 | **모션 프리미티브** | `<Pressable>`(젤리 누름), `<Appear>`(`@starting-style` 등장), `<ScrollReveal>`(scroll-driven + IO 대체), `useSpring`(~1KB), `reducedMotion()`, `motion/mini` 래퍼 | 단위 테스트(모션 줄이기 분기), 프레임 측정 시나리오 1개, 번들 +5KB 이내 |
| D6–D7 | **페이지 전환** | Next 15 유지 상태: `document.startViewTransition` 기반 `TransitionLink`(앞으로/뒤로 type, 헤더 고정, reduced 대응). 동시에 **Next 16 + React 19.3 업그레이드 조사 PR**(별도, 문서만) | 390에서 홈→게임→홈 녹화 영상, LoAF 0, 미지원 브라우저에서 즉시 전환 |
| D8–D9 | **결과 카드 공통** | `ResultCard`(점수 카운트업, 등급 도장, 파티클, 공유, 건너뛰기), 결과 아래 광고 슬롯 위치 규칙. 허브 게임 2개에 적용 | 연출 중 CLS 0, 탭으로 건너뛰기 테스트, 1440/390 스냅샷 |
| D10 | **캐릭터 반응 프리미티브** | `<CharacterSprite poses=… />`(시트 + 스프링 squash·stretch, 반응 이벤트 매핑) | 시트 1장 ≤ 80KB, reduced에서는 포즈 교체만 |
| D11–D13 | **에셋 파이프라인 1회차** | 사이트별 스타일 시트 1장, gen-assets.py 확장(프리앰블 자동 삽입, 팔레트 스냅, avif 출력, 스프라이트 시트 패킹), **2.1 vs flash vs pro A/B 3장씩** → 장부 기록. 게임 1개의 포즈 5장과 커버 | 혹평 점수 ≥ 7, 스타일 시트 대비 일관성 평가, 월 사용량 ≤ 30장 |
| D14 | **회고 + 확장 결정** | 지표 비교(기준선 대비 LCP·CLS·INP, 체류), Rive·Veo·Lyria 도입 여부 결정 문서(DECISIONS.md) | 필드 데이터는 4주 뒤 재확인 (Search Console 28일 집계) |

---

## 핵심 5줄

1. **모션은 CSS 우선 + `motion/mini`(3.7KB gz)**로 합니다. Motion React(37~55KB), GSAP(28KB), R3F(252KB)는 넣지 않고, Rive(약 430KB)와 Pixi(178KB)는 특정 라우트에서 상호작용 뒤에만 로드합니다.
2. **페이지 전환은 View Transitions**를 씁니다. 다만 Next 15에서 React `<ViewTransition>`은 실험 기능이라 production 비추천이므로, 지금은 `startViewTransition` 래퍼로 시작하고 Next 16 + React 19.3 업그레이드 뒤 stable API로 옮깁니다.
3. **캐릭터는 "통째 포즈 + 코드 스프링"**(지금 규칙)을 스프라이트 시트로 표준화합니다. Rive는 마스코트 1개에만 시범 적용합니다(Free export에는 스플래시가 붙으므로 Cadet $17/seat/월 필요).
4. **이미지는 `gemini-nano-banana-2.1`(1K $0.0336, Batch $0.0168)로 바꾸는 A/B 테스트**를 해 봅니다. 성공하면 같은 예산으로 2~4배를 뽑을 수 있습니다. 일관성은 스타일 시트를 refs에 고정하고 팔레트 스냅 후처리로 확보합니다.
5. **매 PR QA 세트**는 번들 예산, Playwright 390/1440 스크린샷 diff, LHCI 3개 URL(CLS ≤ 0.05, LCP ≤ 2.5s)입니다. 모션 프레임 측정은 야간 1회 돌리고, 광고 CLS는 필드 `web-vitals`로 판단합니다.

## 오너에게 요청할 준비물 (우선순위 순)

1. **이미지 모델 규칙 변경 승인**: 초안을 `gemini-nano-banana-2.1`로 바꾸고 Batch를 허용합니다. 키는 지금 쓰는 `GEMINI_API_KEY`를 그대로 쓰고 잔액을 유지합니다.
2. **Figma 파일 1개 + 편집 권한 링크**: 토큰·아이콘 미러용입니다. MCP 쓰기에 필요한 좌석과 플랜도 확인해야 합니다.
3. **저사양 안드로이드 실기 1대** (Galaxy A 시리즈급, USB 디버깅 가능)
4. **영상 월 예산 승인** (예: ₩15,000, Veo 3.1 Lite). 같은 키에서 Veo를 호출할 수 있는지 1회 확인합니다. 게임 미리보기는 캡처로 대체하므로 소액이면 충분합니다.
5. **BGM 생성 승인** (Lyria 3, 곡당 $0.04~0.08, 월 10곡 이내)
6. **Rive Cadet 1개월** ($17/seat): 2주차 회고에서 시범을 결정하면 그때 요청합니다.
7. (선택) Canva 인증, LottieFiles 계정: 마케팅이나 기존 Lottie 리소스가 필요할 때만

## 출처
- npm 레지스트리 최신 버전과 라이선스, 직접 측정한 번들 크기 (2026-11-19)
- [GSAP Standard License](https://gsap.com/standard-license)
- [Rive pricing docs](https://rive.app/docs/account-admin/pricing.md) · [Rive exporting](https://rive.app/docs/editor/exporting)
- [Next.js — Designing view transitions](https://nextjs.org/docs/app/guides/view-transitions) · [Next 15 viewTransition (experimental)](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/viewTransition) · [React 19.3 blog](https://react.dev/blog/2026/09/09/react-19-3)
- [web.dev — New to the web platform in October 2026](https://web.dev/blog/web-platform-10-2026)
- [Gemini API / AI Studio pricing](https://aistudio.google.com/docs/pricing) · [Veo 3.1 가격 요약(benchlm)](https://benchlm.ai/media-pricing/veo)
- [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay)
- [web.dev — Loading ads without impacting page speed](https://web.dev/articles/loading-ads-page-speed) · [Publift CWV guide](https://www.publift.com/blog/ultimate-guide-to-core-web-vitals-for-publishers)
