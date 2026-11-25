# SEO·GEO 기술 감사 2026-11-25 (카드 #238, H4)

측정 방법: `pnpm build` 산출물 `out/`의 색인 대상(noindex 제외) HTML 142쪽을 스크립트로 훑음. 라이브·Search Console·CWV는 이 세션에서 못 봤다.

## 결과
| 항목 | 결과 | 조치 |
|---|---|---|
| sitemap 커버리지 | 색인 대상 142쪽 = `check-seo` 통과. 얇은 목록 쪽은 `thinPagesNoindex` 동안 sitemap 제외(의도) | 없음 |
| canonical | 142쪽 모두 `rel="canonical"` 있음 | 없음 |
| title 중복 | 0 | 없음 |
| description 중복·누락 | 0 | 없음 |
| title 길이 | 26쪽이 65자 초과(검색 결과에서 잘릴 수 있음) | 후속 카드: 문구 변경이라 slug·문구 위험 검토 필요(이 PR 범위 밖) |
| description 길이 | 88쪽이 70~160자 밖 | 같은 후속 카드 |
| CWV | **미측정**(Lighthouse·CrUX 접근 없음) | 후속: 라이브 측정 카드 |
| robots.txt | AI 봇 11종 그룹 추가, 모든 그룹에 `/tools/` 차단 반복(테스트 고정) | 이 PR |
| llms.txt | `/llms.txt` 신설, sitemap과 같은 소스, 빠짐 테스트·`check-routes`에 out/ 존재 확인 | 이 PR |

## JSON-LD 점검 목록 (게임 페이지 `/2048` 샘플 기준)
- 있는 것: VideoGame, FAQPage(Question·Answer), BreadcrumbList, Offer.
- 점검할 것: ① `aggregateRating`·`review`가 없는지(위조 금지 — 샘플에는 없음, 113쪽 전수 확인은 후속) ② FAQPage 문답이 화면에 보이는 문장과 같은지 ③ VideoGame의 `offers.price`가 0·무료로 맞는지 ④ BreadcrumbList 마지막 항목 URL이 canonical과 같은지 ⑤ 가이드 Article의 author·datePublished가 화면과 같은지.
- Google 리치 결과 테스트로 샘플 5쪽 확인은 라이브 접근이 되는 카드에서.

## AI 검색 노출 기준선 표 틀 (대표 질의 20개 — 측정은 다음 카드)
| # | 질의 | 엔진 | 우리 도메인 인용 | 인용된 URL | 날짜 |
|---|---|---|---|---|---|
| 1 | free 2048 game online | ChatGPT·Perplexity·Google AI | | | |
| 2 | play minesweeper online no download | 〃 | | | |
| 3 | free snake game | 〃 | | | |
| 4 | online solitaire free | 〃 | | | |
| 5 | free sudoku online | 〃 | | | |
| 6 | free tetris-like game online | 〃 | | | |
| 7 | typing speed test free | 〃 | | | |
| 8 | word guess game like wordle | 〃 | | | |
| 9 | best free browser mini games | 〃 | | | |
| 10 | free brain games online no sign up | 〃 | | | |
| 11 | 2048 strategy corner tactic | 〃 | | | |
| 12 | minesweeper tips first click | 〃 | | | |
| 13 | connect four online vs computer | 〃 | | | |
| 14 | memory matching game free | 〃 | | | |
| 15 | free chess against computer online | 〃 | | | |
| 16 | daily puzzle games free | 〃 | | | |
| 17 | quick games to play at work | 〃 | | | |
| 18 | games to play on phone without download | 〃 | | | |
| 19 | breakout brick breaker online free | 〃 | | | |
| 20 | morse code game online | 〃 | | | |

## 봇 이름 출처
- Anthropic(확인함): https://support.claude.com/en/articles/8896518 — ClaudeBot·Claude-User·Claude-SearchBot.
- OpenAI(OAI-SearchBot·ChatGPT-User·GPTBot) https://platform.openai.com/docs/bots, Perplexity(PerplexityBot·Perplexity-User) https://docs.perplexity.ai/guides/bots: 이 세션의 네트워크가 두 도메인을 막아 **재확인 못 함**. 리뷰어가 대조해 달라.
- Google-Extended·Applebot-Extended·CCBot: 각 사 공식 이름(재확인 못 함).
