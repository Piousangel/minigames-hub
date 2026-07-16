# Quick MiniGames — 세션 핸드오프 문서

> 최종 업데이트: 2026-07-16 · 작성: Claude(Fable 5) · 다음 세션이 이 문서만 읽고 바로 이어서 작업할 수 있도록 작성됨

---

## 0. 30초 요약

- **무엇**: 무료 브라우저 미니게임 사이트. 광고(AdSense)로 월 5~10만원 수익 목표.
- **지금 상태**: **라이브** — https://quickminigames.site (커스텀 도메인 + SSL 정상, Cloudflare Workers 배포).
- **게임 수**: 50종 (registry 기준). 상당수 오리지널 창작 게임 + 클래식.
- **리더보드**: 37개 게임에 주간 Top10 온라인 리더보드 (Cloudflare D1).
- **광고**: 아직 **OFF** — 단 이유가 바뀌었다. pub-id는 발급받아 채웠고(`ca-pub-9363381710674627`),
  **AdSense 심사 대기 중**. 게재는 `siteConfig.adsenseEnabled: false`로 잠가 둔 상태. 자세한 절차는 7.2.
- **바로 다음 할 일**: (1) AdSense 승인 확인 → 광고 켜기(7.2), (2) 게임 계속 찍어내기 + UI/UX 고도화.

---

## 1. 프로젝트 목표 & 수익 모델

- 사용자(Pious Angel, yyh7654@gmail.com)의 목표: 광고로 **월 5~10만원(~$35-70)** 벌기.
- 전략: (a) 게임을 대량 생산해 페이지 수·색인 늘리기, (b) UI/UX를 계속 고도화, (c) 리더보드로 재방문·체류시간↑(경쟁심리), (d) AdSense 광고 게재.
- **디자인 방향**: RETRO NEON(신스웨이브) 미학. Press Start 2P 픽셀 폰트, 네온 컬러 팔레트, 스캔라인. 이모지 기본값 대신 커스텀 SVG 아이콘 사용.
- **게임 철학**: 단순 클론이 아니라 **창의적이고 중독성 있는 오리지널 게임**을 멀티 에이전트 심의(Workflow)로 계속 발명. 라운드1~5 진행됨.

---

## 2. 라이브 현황

| 항목 | 값 |
|---|---|
| 도메인 | `quickminigames.site` (라이브, SSL OK) |
| 호스팅 | Cloudflare Workers + Static Assets |
| Worker 이름 | `minigames-hub` |
| DB | Cloudflare D1 `minigames-leaderboard` (id `c99eaae9-e197-4020-b718-a3d599949f70`) |
| 게임 수 | 48 (`registry.ts`) |
| 리더보드 게임 | 37 (`leaderboard.ts` LEADERBOARD_GAMES) |
| 광고 | OFF (승인 전) |
| Node / pnpm | v22.22.3 / 9.15.0 |

**API 엔드포인트** (worker/index.ts):
- `GET /api/leaderboard?game=X` → 해당 게임 주간 Top10
- `POST /api/score` → 점수 제출(검증·상한·insert)
- `GET /api/leaderboards` → 게임별 Top3 한 방에(리더보드 허브용)
- 그 외 경로 → `env.ASSETS.fetch` (정적 파일)

---

## 3. 기술 스택 & 아키텍처

- **Next.js 15 App Router**, `output: 'export'` **정적 익스포트**. → 서버 런타임 없음. route handler는 `export const dynamic = 'force-static'` 필요.
- **Cloudflare Workers**: `worker/index.ts`가 API를 직접 처리하고 나머지는 정적 에셋 바인딩(ASSETS)으로 서빙. `tsconfig.json`은 `"worker"`를 exclude(별도 타입).
- **D1(SQLite)**: 리더보드 저장. worker는 `../src/lib/leaderboard`를 **상대경로**로 import(@/ 별칭 안 씀).
- **폰트**: Press Start 2P 셀프호스팅 — `src/app/fonts.ts` + `src/app/fonts/PressStart2P.woff2` (next/font/local).
- **디자인 시스템**: `src/app/globals.css`에 `--neon-cyan/magenta/lime/amber/purple/blue/red/green`, 유틸 `.neon-text/.neon-box/.font-pixel/.scanlines`.
- **브랜드**: `src/lib/siteConfig.ts` (name/url/description/adsenseClientId/adsenseEnabled). name 바꾸면 헤더/푸터/타이틀/OG/manifest 전파.
- **로고**: `src/components/Logo.tsx` (네온 아케이드 캐비닛 + 플레이 삼각형 SVG, currentColor). 파비콘 `src/app/icon.svg`와 통일.

### 게임 공통 규칙 (GameShell 템플릿)
- **엔진(engine.ts)은 순수·결정론적**: rng 주입, `Math.random`/`Date.now`/`performance.now` 절대 금지. vitest 유닛테스트.
- **컴포넌트**: GameShell/GameOverlay/GameButton, `useGameSound`, `useReducedMotion`, `isTypingTarget` 가드, SSR 안전(상태는 effect에서 init), 보드에 `data-testid`, `@keyframes`는 컴포넌트 스코프.
- **사운드 이름은 이것만**: `move|merge|win|lose|eat|flag|error|flip|match|mismatch`.

### 새 게임 와이어링에 손대는 공유 파일 (6곳)
1. `src/lib/games/registry.ts` — union variant + gamePages 엔트리(slug/title/h1/metaDescription/shortDescription/howToPlay≥3/strategy≥3/faq≥3)
2. `src/lib/games/GameRenderer.tsx` — import + switch case (`storageKey=`best:${page.slug}``)
3. `src/lib/games/gameMeta.ts` — icon/accent/category
4. `src/components/GameIcon.tsx` — 커스텀 SVG glyph(없으면 joystick fallback)
5. `e2e/smoke.spec.ts` — load + board-visible 테스트
6. `src/lib/leaderboard.ts` LEADERBOARD_GAMES — (점수형 게임이면) label 추가

---

## 4. 배포 파이프라인

```bash
pnpm run deploy      # = next build && wrangler deploy
```

**배포 전 항상 검증**:
```bash
npx tsc --noEmit                 # 타입체크
pnpm build                        # 정적 빌드(out/ 생성)
npx playwright test               # e2e (webServer: pnpm build && npx serve out -l 3100)
```

**검증 팁**:
- 빌드 출력은 `out/contact.html` 형태(트레일링 슬래시 auto). 라이브에서 `/contact` = 200, `/contact/` = 307 리다이렉트(정상).
- 배포 후 `curl`로 확인. **엣지 캐시가 새 경로에 잠깐 stale 404를 줄 수 있음** — 수초 내 해소.
- wrangler는 **OAuth 토큰**(`wrangler login`)으로 인증됨 — Workers 권한 있음.

---

## 5. 도메인 (완료됨 — 참고용)

- `quickminigames.site` Gabia에서 구매 → Cloudflare로 존 이전 완료(네임서버 변경, gabia NS 전부 제거해야 active됨).
- Worker 커스텀 도메인 연결: `wrangler.jsonc`의 `"routes": [{ "pattern": "quickminigames.site", "custom_domain": true }]` + `wrangler deploy`로 붙임.
- **주의**: Cloudflare API 토큰(cfut_...)은 **zone 권한만** 있고 Workers 권한 없음. Worker 관련은 wrangler OAuth로, zone 생성/DNS는 API 토큰으로 분리했음.

---

## 6. 이번 세션(m22)에 한 일

브랜치 `feature/m22-branding-legal` → main 머지 → 배포 완료:
- 브랜드명 `MiniGames Hub` → **`Quick MiniGames`** (siteConfig + leaderboards 메타)
- **커스텀 네온 SVG 로고마크** `Logo.tsx` 제작 → 헤더 🕹️ 이모지 교체, 파비콘 `icon.svg` 통일(네온 프레임 + 앰버 플레이 삼각형)
- **법적 페이지 정비**:
  - Contact: 실제 이메일 **yyh7654@gmail.com**
  - Privacy: 리더보드(공개 닉네임·점수) 고지, localStorage, AdSense 쿠키/EU 동의, 아동(13세 미만) 조항, 날짜 갱신
  - Terms: 사용자 제출 닉네임 조항(부적절 시 삭제)
  - About: 제작자 **Pious Angel** 명시, 리더보드 언급
- **라이브 검증 완료**: 전 페이지 200, 브랜드/이메일/닉네임 조항 반영 확인.

---

## 7. 다음 세션 할 일 (우선순위 순)

### 7.1 ✅ 라운드5 게임 3종 — 2026-07-16 배포 완료
Decant / Backspace / Duplex 라이브(`/decant` `/backspace` `/duplex`). 게임 **50종**.

> 이전 핸드오프가 "엔진만 있고 컴포넌트·테스트 없음"이라고 적었으나 **사실과 달랐다**.
> 컴포넌트(460/567/772줄)와 엔진 테스트(92개)가 이미 있었고 배선 5곳만 빠져 있었다.
> 교훈: 핸드오프의 미완성 주장은 그대로 믿지 말고 `ls`/테스트 실행으로 먼저 확인할 것.

### 7.2 🟡 AdSense — 심사 대기 중 (2026-07-16 검토 요청 완료)
- pub-id: `ca-pub-9363381710674627`. 소유권 확인은 **메타 태그** 방식으로 통과.
- **현재 상태**: `siteConfig.adsenseClientId`는 채워져 있고(메타 태그·ads.txt가 사용),
  게재는 `siteConfig.adsenseEnabled: false`로 **잠가 둠**. 승인돼도 자동으로 켜지지 않는다.
- **승인되면 할 일** (이 순서를 지킬 것):
  1. AdSense에서 광고 단위 2개 생성 → **숫자 슬롯 ID** 발급받기.
  2. `AdSlot`을 쓰는 두 곳의 플레이스홀더 slot 문자열을 실제 숫자 ID로 교체:
     `src/app/page.tsx`(`"home-footer"`), `src/components/GamePageLayout.tsx`(`"game-incontent"`).
  3. `siteConfig.adsenseEnabled: true` → 배포.
  - ⚠️ 2번을 건너뛰고 3번만 하면 잘못된 슬롯으로 요청이 나가 콘솔 에러만 남는다.
- **EU 동의(CMP)**: Google CMP **3버튼**(동의 / 동의하지 않음 / 옵션 관리)으로 설정 완료(2026-07-16).
  사이트 코드와 무관하게 AdSense 대시보드에서만 동작한다.
  - IAB 데이터 사용 목적: 광고 관련(기기 정보 저장/제한적 데이터 광고 선택/개인화 프로필 생성·선택/
    광고 성과 측정/오디언스 통계) = **동의**, Develop and improve services = **적법한 이익**,
    content 개인화 계열 = **사용되지 않음**(우리는 콘텐츠를 개인화하지 않으므로 받을 이유가 없다).
  - 2버튼 버전은 고르지 말 것 — GDPR상 "거부가 동의만큼 쉬워야" 요건에 걸린다(CNIL 제재 선례).
  - ⚠️ 사용자 보고 기준이며 대시보드 재확인은 안 했다. 광고 켤 때 배너가 실제로 뜨는지 확인할 것.

### 7.3 🟡 게임 계속 찍어내기 (Workflow 파이프라인)
멀티 에이전트 심의 워크플로우로 오리지널 게임 라운드 계속:
- 패턴: **Ideate**(5개 다양한 각도) → **Judge**(독창성/중독성/실현성/매력 점수 → 다양성 있는 Top3) → **Build**(spec→build 파이프라인, self-contained 파일). 약 12에이전트/~500k토큰/라운드.
- 산출물(self-contained 파일) 나오면 내가 검증(test/typecheck/build/e2e) → 6곳 와이어링 → 시각 QA → 배포.
- **함정**: 워크플로우 진행 중 배포하면 미완성 파일이 빌드 lint 깨뜨림. **워크플로우 완료 후 배포**하거나 해당 lint만 수정.

### 7.4 🟡 UI/UX 고도화 (지속)
- 트렌디한 애니메이션/인터랙션, 최신 사이트 참고. 스스로 판단해서 계속 개선.
- Lighthouse 기준선(회귀 금지): home 97, game 99, a11y/bp/seo 100, CLS 0.

---

## 8. 광고 수익 → 통장 입금 흐름 (사용자 질문 답변)

**AdSense 정산 구조 (한국 기준)**:
1. **AdSense 계정 생성** + 사이트 등록 + 심사 통과.
2. 광고 노출/클릭으로 수익이 **매일 누적** → 매월 초 전월 확정 수익 마감.
3. **지급 요건 3가지**를 채워야 실제 입금됨:
   - **주소 확인(PIN)**: 누적 $10 도달 시 구글이 우편으로 PIN 발송 → 입력.
   - **세금 정보**: AdSense에서 세금 양식 제출(한국 개인은 보통 간단).
   - **결제 수단(수취 은행 계좌)** 등록 — 한국은 **전신환(은행 송금)** 방식으로 원화 입금.
4. **지급 기준액 $100** (약 13~14만원). 월말 누적이 $100을 넘으면 **다음 달 21~26일경 등록한 계좌로 자동 입금**. $100 미만이면 다음 달로 이월.
5. 즉, 월 5~10만원 목표라면 **한 달에 바로 입금되진 않고**, 누적이 $100 넘는 시점(약 1.5~2개월치)에 처음 입금되고 이후로는 매월 입금됨.

요약: **AdSense 계정 → 사이트 승인 → 은행계좌·세금·PIN 등록 → $100 넘으면 매달 계좌로 자동 송금.**

---

## 9. 핵심 주의사항 / 함정 (과거에 겪은 것들)

- **정적 익스포트라 `next start` 안 됨** → playwright는 `pnpm build && npx serve out -l 3100`. 게임 늘면 빌드 오래 걸려 타임아웃 상향(현재 240s).
- **엔진에 Math.random 금지** — 순수성 깨지면 골든테스트/되감기 붕괴.
- **worker는 @/ 별칭 못 씀** → `../src/lib/leaderboard` 상대경로.
- **per-game OG 이미지**(ImageResponse): `background` 축약 금지(→ backgroundColor/backgroundImage 분리), div에 자식 2+면 `display:flex` 필요, 텍스트는 단일 노드.
- **leaderboard.ts 제어문자 정규식**은 `/[\u0000-\u001f\u007f]/g` (리터럴 제어문자 붙여넣기 금지 — 유니코드 이스케이프로 작성).
- **엣지 캐시**: 새 경로 배포 직후 잠깐 stale 404 가능(수초 해소). 배포 검증은 여유 두고.
- **Browse/스크린샷**: 클라이언트 하이드레이션 전 스냅샷이라 흰 화면 나올 수 있음 → settle 후 별도 호출로 재확인.
- **워크플로우 opt-in**: Workflow 툴은 사용자가 명시적으로 원할 때만. 이 프로젝트는 사용자가 "너네끼리 회의해서 디벨롭" 하라고 반복 요청함 = 게임 발명에 Workflow 사용 승인됨.

---

## 10. 계정 & 크레덴셜

- **이메일**: yyh7654@gmail.com
- **브랜드명**: Quick MiniGames
- **제작자 핸들**: Pious Angel
- **도메인**: quickminigames.site (Gabia 구매 → Cloudflare 존)
- **Cloudflare**: wrangler OAuth 로그인됨(`wrangler login`). API 토큰(zone 전용)은 존/DNS용.
- **git**: main 브랜치가 배포 소스. 기능은 `feature/*` 브랜치 → `--no-ff` 머지 → main.
- **커밋 규칙**: 메시지 한국어, 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## 11. 다음 세션 시작 시 첫 명령 추천

```bash
# 1) 상태 확인
git log --oneline -5
git status --short
curl -s -o /dev/null -w "%{http_code}" https://quickminigames.site/   # 200 확인

# 2) AdSense 승인 났는지 사용자에게 확인 → 났으면 7.2 절차대로 광고 켜기
grep -n "adsense" src/lib/siteConfig.ts
```

AdSense 승인 여부부터 사용자에게 묻는 것을 권장(7.2). 아직이면 게임 생산(7.3)·UI/UX(7.4)를 이어간다.
