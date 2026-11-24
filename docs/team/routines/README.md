# 루틴 프롬프트 초안 (운영안 v2 — 아직 적용 전)

오너가 루틴 계정에 로그인하고 Slack 커넥터를 연결한 뒤, 메인 세션이 이 초안으로 루틴을 만든다. 그 전에는 루틴을 만들거나 고치지 않는다.
- 파일: `plan.md`(05:07) · `work.md`(07:07·11:07·13:07) · `review.md`(PR ready 이벤트 + 21:07 줍기) · `quality.md`(03:07) · `ops.md`(20:07). 시각은 [SHIFT](../SHIFT.md) 2장.
- 리뷰 루틴 트리거는 PR `opened`·`ready_for_review`(draft 제외) + 줍기 시각. 적용 전 조건: 결정적 검사 PR(`pr-guard`·`check:docs`) 머지, 라벨 생성.
- 각 프롬프트 ≤60줄, 필독은 CLAUDE.md·SHIFT·NORTH-STAR·HANDOFF뿐. 모델·effort는 루틴 설정에서 고른다(문서에 쓰지 않는다): 계획·리뷰는 high, 작업은 medium, 품질·운영·SEO는 low~medium.
- `{작업 팀}` 자리에 시각별 팀 라벨을 넣는다(07:07 = H3 화·금 / H2 수 / H0 그 외, 11:07 = H1·H0, 13:07 = H4).
