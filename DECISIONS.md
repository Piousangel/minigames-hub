# 결정 기록

## 2026-11-12 매일 아침 팀 운영(회의 → 리뷰 → 반영 → 보고)
- 맥락: sandlab에서 11-11부터 돌린 06시 클라우드 루틴 방식을 이 사이트에도 적용. 사용자 목표: 매일 업그레이드되는 사이트, AdSense 승인.
- 선택: 06:00 KST 클라우드 루틴이 지표(05:30 Actions가 docs/daily/metrics에 커밋)·피드백(Gmail·댓글)·QA·마케팅을 회의록으로 남기고, 1개를 골라 PR → 검증 통과 시 squash 머지 → Actions 배포 → 사용자 메일 보고.
- 이전 결정 변경: HANDOFF의 "유통은 사용자, Claude는 품질·제작만"은 이 결정으로 바뀜. 팀이 SEO·공유 기능은 직접 반영하고, 외부 커뮤니티 게시는 초안만(docs/marketing/) 만든다.
- 배포 게이트: typecheck·lint·build·check-routes. 전체 vitest는 기존 실패 때문에 빼고, 루틴이 바꾼 파일 관련 테스트(`vitest related`)를 머지 전에 돌린다.
