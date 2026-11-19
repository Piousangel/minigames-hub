# 04시 숙의 실측 스크립트 (말랑 3~8단계, 2026-11-20)

typecheck에 안 걸리도록 `.ts.txt`로 보관했다. 저장소 소스는 고치지 않는다.

다시 돌리는 법(의존성 없이 Node 22 내장 타입 제거 사용):
1. 이 폴더를 아무 스크래치 폴더에 복사하고 `.txt` 확장자를 뗀다.
2. `node --no-warnings --import ./register.mjs a.ts` (`register.mjs`가 확장자 없는 상대 import에 `.ts`를 붙인다).
3. import 경로는 `/home/user/minigames-hub/src/...` 절대 경로다. 다른 위치에 클론했으면 고친다.

| 파일 | 내용 |
|---|---|
| lib.ts | 공용: `chain()`, 이전 해 통과율, 금지 구역 반영 `runLineB`/`survB`, 비공식 2선 CEM `solve2` |
| a.ts | 2단계 독꽃 후보 1,500개 탐색 → 채택 (105,186),(104,275) |
| b.ts / segs.ts | 3단계 계단 8변형 |
| final-ab.ts | A·B 물리 9조합 |
| c.ts~c4.ts | 4단계 1선 별 3 불가 탐색 + 2선 근사 |
| d.ts | 6단계 쿠션 3배치(전부 '쿠션 사용 0%') |
| bench.ts / curve.ts / gate-meadow.ts | 1차: 솔버 시간, 곡선 언덕 선분 수 대비 비용, 현행 c-meadow 게이트 |
