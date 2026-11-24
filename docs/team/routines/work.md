너는 미니게임허브(저장소 Piousangel/minigames-hub)의 **작업 루틴**이다. 이번 run의 팀: `{작업 팀}`. 카드 **1장**만 처리한다.

## 읽기 (이것만)
CLAUDE.md · docs/team/SHIFT.md · docs/team/NORTH-STAR.md · HANDOFF.md · 집은 카드 본문과 코멘트. 카드가 가리키는 문서만 추가로 연다.

## 카드 집기
1. `gh issue list --label ready --label "team:<팀>" --limit 10` 에서 위에서부터.
2. 이미 assignee가 있거나 `in-progress`면 건너뛴다. 하나도 없으면 "카드 없음"으로 종료(빈 슬롯 정상).
3. 내 카드: `gh issue edit <n> --add-assignee @me --add-label in-progress --remove-label ready` → 하트비트 `♥ HH:MM 시작 — 다음: <한 줄>`.
4. 이어받기: 같은 카드에 PR 초안·브랜치가 있으면 그 브랜치에서 계속(`card/<n>-<주제>`).

## 작업
- 브랜치 `card/<n>-<주제>`. 같은 파일을 바꾸는 열린 PR이 있으면 멈추고 카드에 `blocked` + 이유.
- 오답 검사 먼저(실패 확인) → 구현 → `pnpm verify 2>&1 | tail -n 80`.
- 큰 구현은 `.claude/agents/implementer`에, 확인은 `checker`에. 브리프 ≤2k 토큰(카드 수락 기준·파일·오답 검사만), 동시 ≤2개.
- 단계가 바뀔 때마다 하트비트 코멘트 1줄.
- 품질 관문(SHIFT 4장): `stage:prepro`면 시안 혹평 채점 통과 전 코드 금지. 화면 변경이면 390·1440 전후 캡처, H1이면 퀄리티 장부 점수.

## PR
- 제목 한국어 conventional. 본문 첫 줄 = 오답 검사와 결과, 그다음 `Closes #<n>`, 수락 기준 체크, 증거, 위험 등급.
- 기록 3곳만(SHIFT 6장): HANDOFF 현재분 덮어쓰기(필요한 줄만), 갈림길이면 DECISIONS, `docs/daily/log.md` 한 줄.
- `git status --short`로 의도한 파일만. 커밋 공저자 줄은 하네스 attribution 그대로.
- 푸시 → `gh pr create` → 카드 `review` 라벨(in-progress 제거) → 하트비트 `♥ HH:MM PR #<p> — 다음: 리뷰`.
- 머지는 리뷰 루틴이 한다. 이 run에서 머지하지 않는다.
- 한 run에 못 끝나면 draft PR로 올리고 남은 일을 카드 코멘트로.

## 규칙
- CI 실패는 `gh run view <id> --log-failed | tail -n 80`부터. 테스트를 약화하지 않는다.
- 금지: SHIFT 9장 전부(배포·main 푸시·시크릿·외부 게시·slug 변경 등). hook에 막히면 우회하지 말고 메시지의 '대신'.
- Slack은 장애일 때만 `C0CLG4R8VPG`에 1줄.

## 마지막 출력 (4줄)
카드 #n / PR #p(상태) / verify 결과 / 다음 run이 할 것
