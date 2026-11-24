# 허브 함정 정본 (코드에서 못 읽는 것만, 2026-11-24 HANDOFF에서 분리)

카드가 건드리는 영역의 줄만 읽는다. 끝났거나 틀린 줄은 지운다(이력은 git·`docs/archive/`). 옛 함정 전문은 [archive 핸드오프](../archive/handoff-2026-11-24.md) '6.1 함정 · 결정사항'.

## 현재 유효한 함정
- `best:<slug>` 저장 키엔 숫자만. slug·공유 URL·저장 키·점수 체계 변경 금지.
- 에이전트의 "GREEN 보고"는 플레이 가능을 뜻하지 않는다 — 직접 해 보거나 e2e로.
- `generateImageMetadata`는 `output: 'export'`와 충돌(빌드 깨짐) — OG alt는 정적 문구.
- `git checkout .`을 stash 복원과 같이 쓰지 말 것(스테이징 안 된 파일 손실).
- 말랑 일일은 매일 `SLIME_STAGES` 전체를 연다 — 풀 칸을 바꾸면 오늘 `slime:daily2` 시도가 새 판에 붙어 서버 재생 400. `BAN_SLACK`(verify) = `ZONE_SLACK`(multiline).
- deploy.yml D1 마이그레이션은 `continue-on-error` — 실패해도 초록, 로그 단계를 직접 볼 것.
- Satori는 webp·woff2·가변 축 불가(`src/lib/og/assets/`). 페이지 `openGraph`/`twitter` 객체는 layout 것을 통째로 덮는다(check-seo가 잡음). 브랜드 원판 변경 → `python3 scripts/brand-icons.py`(OG 사본도).
- 광고 자리 `<AdSlot>`을 옮기면 `[data-ad-after]` 표시도 같이(광고 꺼진 동안 거짓 통과). 마스코트는 `Mascot` 컴포넌트로(D6 400px·뷰포트당 1 검사가 `img[data-mascot]`을 셈).
- R8: acorn-hop 390은 CI(리눅스 글꼴)에서 도구 줄(↻)이 화면 밖으로 넘친다(main도 같음 — 모바일 가로폭 작업). Tailwind 임의 색(`from-[#hex]/50`·`from-[color-mix()]`)은 oklab으로 미리 계산돼 채널이 1씩 어긋난다 → 인라인 `--tw-gradient-from`. 관련 게임 카드 색은 값(`GARDEN_ACCENT_INK`) — 정원 `--neon-*` 재매핑을 바꾸면 같이.
- 대비 검사는 조상 배경·로드 직후 화면만 본다 — 형제 덮개·진행 중 덮개는 손으로. 그라데이션 바탕은 `backgroundColor`도 줄 것. 캔버스 스크립트는 fillText만.
- 결과 시트는 열 때 `history.pushState` — 다른 곳에서 pushState를 끼우면 닫기가 어긋남. 시트 애니메이션 `backwards` 유지, body `position:fixed` 잠금 금지(sticky 헤더 CLS).
- Continue 칸·리더보드 li key는 위치(index) — slug로 바꾸면 CLS가 돌아온다.
- 히어로는 크롬 높이만큼 위로 당김(`--chrome-h`) — 헤더 높이 바꾸면 같이. 키아트를 바꾸면 0.6185·0.069·섹션 그라데이션 색 재측정.
- 정적 serve엔 `/api`가 없다(리더보드는 늘 실패 카드 — e2e는 흉내).
- 클라우드 세션은 quickminigames.site가 프록시 403 → 같은 커밋 로컬 빌드로 점검. Playwright는 `-c` 임시 설정 + `executablePath:/opt/pw-browsers/chromium`(커밋 금지). `prettier --write` 쓰지 말 것(설정 없음).
- 새 핵심 화면 e2e는 ci.yml 스모크 `--grep`에 추가. CI에서 15초 가까운 테스트는 한도 대신 구조를 고칠 것. 로컬 과부하 `Timeout calling "onTaskUpdate"`는 재실행.
- 픽셀 비교는 `node scripts/garden-capture.mjs diff --base <main 빌드> --head <브랜치 빌드>`(시계·랜덤 고정). SEO 비교 `node scripts/seo-head-diff.mjs`.
