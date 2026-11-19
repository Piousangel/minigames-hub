# 번들 기준선 2026-11-19

엔지니어 보고(`docs/team/research/2026-11-19/opinion-engineer.md` §4 항목 4·5)의 "번들 분석 한 번을 기준선으로 기록" 이행.
서버 재검증(엔진이 워커에도 들어감)·기믹 추가 전에 이 표와 비교한다.

- 날짜: 2026-11-19
- 명령: `pnpm build` (= `next build`, Next 15 정적 내보내기). 수치는 빌드 출력의 Size / First Load JS(gzip 기준)
- 청크 크기: `out/_next/static/chunks/*.js`를 `gzip -c <file> | wc -c`로 잰 값
- 비교: 변경 전 = `acce2ed`, 변경 후 = 브랜치 `shift/22-perf`(dpr 캡·배경 오프스크린 캐시)

## 라우트별 First Load JS

| 라우트 | Size | First Load JS (전) | First Load JS (후) |
| --- | ---: | ---: | ---: |
| `/` (홈) | 6.47 kB | 198 kB | 198 kB |
| `/[slug]` (모든 게임 페이지, `/slime-slide`·`/snake`·`/2048` 포함) | 23 kB | 218 kB | 218 kB |
| `/daily` | 2.49 kB | 113 kB | 113 kB |
| `/leaderboards` | 3.15 kB | 191 kB | 191 kB |
| `/category/[slug]` | 1.51 kB | 112 kB | 112 kB |
| `/tools/slime-slide` (내부) | 4.94 kB | 130 kB | 131 kB |
| `/tools/slime-proto` (내부) | 681 B | 123 kB | 123 kB |
| 전 페이지 공유 | — | 105 kB | 105 kB |

`/slime-slide`는 별도 라우트가 아니라 `/[slug]` 하나로 빌드되므로 First Load JS가 다른 게임 페이지와 같다(218 kB).
게임 코드는 아래 지연 청크로 따로 받는다.

## 슬라임 코드가 어디에 들어가나 (지연 로드 확인)

`src/components/GameRenderer.tsx`가 **이미 게임마다 `next/dynamic(..., { ssr: false })`** 로 나눠 두었다.
`/slime-slide`에 들어갔을 때만 아래 두 청크를 추가로 받는다.

| 청크 | 내용 | raw (전→후) | gzip (전→후) |
| --- | --- | ---: | ---: |
| `7206-*.js` → `3319-*.js` | `SlimeProto` + `src/lib/games/slime/*`(엔진·draw·fx·terrainRender·theme·solver) | 48,750 → 49,798 B | 17,571 → 18,009 B |
| `7622-*.js` | `GameSlimeSlide` + `SlimeJourney` | 9,416 → 9,416 B | 3,911 → 3,913 B |

- 슬라임 고유 문자열(`KAKAOTALK`, `slime:muted`, `First Light`)은 위 청크 하나에만 있다. 홈(`index.html`)·`/daily`·`/snake`·`/2048`·`/leaderboards`의 HTML은 이 청크를 참조하지 않는다 → **허브·다른 게임 페이지에 슬라임 코드가 섞이지 않는다.**
- `/[slug]` 페이지 청크에는 `Promise.all([t.e(3319), t.e(7622)])` 지연 참조(몇 바이트)만 있다.
- `/tools/slime-*`는 `SlimeProto`를 정적 import하지만 비공개 내부 페이지라 그대로 둔다.
- 결론: `SlimeProto`에 `next/dynamic`을 더 거는 변경은 **불필요**(이미 게임 단위로 분리, 추가 이득 없음). 이번 변경의 비용은 지연 청크 +0.4 kB(gzip)뿐.

## 진짜 공유 번들 부채 (권고, 이번에 고치지 않음)

홈과 모든 게임 페이지가 받는 `5789-*.js` = **252 kB raw / 77.5 kB gzip** 가 가장 크다.
내용은 `src/lib/games/registry`의 전 게임(113개) 콘텐츠(`metaDescription`·`faq`·`howToPlay` 각 113회 등장).
클라이언트 컴포넌트가 registry를 직접 import해서 SEO 본문까지 브라우저로 간다:
`GameNav`, `GameSwitcher`, `NextRail`, `Leaderboard`, `LeaderboardsHub`, `GameRenderer`.

권고: 클라이언트용 가벼운 색인(slug·title·category·아이콘 등)과 서버 전용 본문(faq·howToPlay·metaDescription)을 모듈로 나누고,
클라이언트 컴포넌트는 색인만 import(본문은 서버 컴포넌트가 props로 내림). 예상 효과는 홈·게임 페이지 First Load JS 수십 kB 감소 [미측정].
게임 수가 늘수록 커지므로 다음 성능 작업 1순위로 둔다.

## 캔버스 비용 (같은 브랜치에서 함께 처리)

- 백킹 스토어 dpr을 **2배로 캡**(`src/lib/games/slime/canvasLayer.ts`의 `canvasDpr()`). 이전에는 메인 캔버스가 dpr 그대로(3배 기기에서 358px 폭 → 1074×1542 = 1.66M px), 지형 레이어만 2배 캡이라 배율도 서로 달랐다. 이제 716×1028 = 0.74M px(−56%)이고 메인·지형·배경 레이어가 같은 dpr·같은 크기식(`backingSize`)을 쓴다.
- `getContext('2d')`는 렌더 루프 effect마다 1회만 얻는다(이전: 매 프레임).
- 정적 배경 오프스크린 캐시: 하늘 에셋 + 시간대 색 막·바다 띠·해/달을 한 번 굽고 매 프레임 `drawImage` 1회. 별이 반짝이지 않는 시간대(또는 움직임 줄이기)면 별·지형까지 같이 구워 배경 전체가 `drawImage` 1회. 크기·dpr·스테이지·시간대·하늘 에셋 로드·움직임 줄이기가 바뀌면 다시 굽는다. 하늘 에셋이 아직 없으면 기존처럼 반짝이는 기본 배경을 매 프레임 그린다.
- 시각 동일성 확인(정적 빌드, 390px 뷰포트, Playwright 가짜 시계로 같은 시각 고정): dpr 2에서 5개 스테이지 × 움직임 줄이기 켬/끔 모두 전후 캔버스 픽셀 차이 최대 1/255(사실상 동일). 하늘 에셋을 늦게 보낸 경우에도 폴백 → 도착 후 정상 화면과 동일. dpr 3에서는 해상도가 2배로 낮아진 만큼만 다르다(정렬·배치 동일).
