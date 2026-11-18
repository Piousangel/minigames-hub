# 데일리 출시 로그

| 날짜 | 출시물 | URL | 검증 | 메모 |
|---|---|---|---|---|
| 2026-11-13 | Battleship 공략(엔진·CPU 시뮬 기반) | /guides/battleship | typecheck·lint·관련 테스트·build·check-routes 통과 | 상위 트래픽 게임에 공략 추가 |
| 2026-11-14 | 홈 배지 게임 수 자동 계산 + manifest icon.svg 404 제거 | / | typecheck·lint·관련 테스트·build·check-routes 통과 | 첫 화면 숫자 불일치 해소 |
| 2026-11-15 | 리더보드 새로고침 중복 제출 방지 | 게임 페이지 Weekly Top 10 | typecheck·lint·관련 테스트·build·check-routes 통과 | backlog 0번 일부 |
| 2026-11-16 | 리더보드 제출 이벤트(lb_submit) 계측 + 주간 회고·큰 기능 스펙 2건 | 게임 페이지 Weekly Top 10 | typecheck·lint·관련 테스트·build·check-routes | 큰 기능 계측 기준선 |
| 2026-11-17 | 게임오버 오버레이 1클릭 리더보드 제출(+lb_submit_overlay 계측) + 전략 문서 | 리더보드 있는 게임 오버레이 | typecheck·lint·관련 테스트·build·check-routes | 이름 저장된 신기록만 노출. 기대: lb_submit 주 5건+ |
| 2026-11-17 (13시) | 뿅 착지 PR #64 점검(G4 5/10, 머지 보류) | 없음 | 변경 없음(기록만) | 6.5 미달이라 출시 보류 |
| 2026-11-17 (16시) | 홈 PLAY NOW를 오리지널 대표 7종 랜덤으로 교체 + hero_play·?ref=hero 계측 (실험 E1) | 홈 히어로 버튼 | typecheck·lint·관련 테스트·build·check-routes | 판정 11-24(n<30 보류, 상한 12-01) |
| 2026-11-17 (20시) | 출시 확인(#79·#82·#83·#84 배포 success) + 스크롤 리뉴얼 Bluesky 홍보 큐 | 없음 | 문서만 | 라이브 curl 차단 |
| 2026-11-18 (06시) | 계획 세션: 회의록, R1·다음 게임 추천 리서치1+v1, 수요일 블로그 초안, portfolio.md 신설 | 없음 | 문서만(출시는 10·13·16시) | R1 감사 재검증: tetris·space-shooter·pong 즉시 시작 남음, flappy는 수정됨 |
| 2026-11-18 (16시) | 게임 종료 후 '다음 게임' 레일(같은 장르·다른 입력 2장, 오리지널 우선) + 오버레이 Next ?ref=next·next_* 계측 (실험 E2) | 게임 페이지 보드 아래·종료 오버레이 링크 | typecheck·lint·vitest·build·check-routes·e2e 390/1366 | 리서치2: 세 가정 모두 약화 → next_seen·낯섦 완화 반영 |
- 2026-11-18 13시: 뿅 착지 램프 보정(게이지 후반 600ms·가라앉음 1500·반폭 18, σ30 중앙 39→34)
| 2026-11-19 (06시) | 계획 세션: 회의록, 리더보드 S2 리서치1+v1 | 없음 | 문서만(출시는 10·13·16시) | 축 C 이틀째 0 → 10시 R1 구현 필수 |
