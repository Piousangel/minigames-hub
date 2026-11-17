# Acorn Hop 출시 홍보 (11-17 배포, 마케터가 11-18 큐부터 사용)

사실: 웹 허브의 한 손가락 탭형 오리지널 게임. 화면 좌/우를 탭하면 우주 다람쥐 토리가 도토리를 아래로 쏘고 그 반동으로 위로 솟는다. 도토리가 연료, 쉼터 섬에서 충전, 밤송이·심술 구름이 위험물. Daily(모두 같은 하늘)와 Practice. 링크: https://quickminigames.site/acorn-hop

## 11-18 큐에 넣을 것 (채널별 하루 1건 규칙 유지, 링크 ?ref= 는 스크립트가 붙임)
- **bluesky (영어)** 후보: "New original game: Acorn Hop. Tap left or right and a space squirrel fires an acorn down — the recoil rockets it up. Acorns are your fuel. How high can you get? Free, no install. #webgames #indiegame"
- **threads (한국어)** 후보: "새 게임 Acorn Hop 나왔어요. 화면 왼쪽/오른쪽을 탭하면 우주 다람쥐가 도토리를 아래로 쏘고, 그 반동으로 위로 솟아요. 도토리가 연료예요. 몇 m까지 올라가세요? 설치 없이 무료예요. #웹게임"
- 이미지: 게임 첫 화면 캡처를 `docs/design/acorn-hop/shots/ready.jpg`에서 쓴다(링크 카드 대신 이미지가 필요하면 블로그 파이프라인 shots 방식 사용).

## 이후 7일
- 매일 같은 형식을 반복하지 않는다(GROWTH.md 1번). 후보: 토리 캐릭터 소개, 제작기(Gemini로 에셋을 한 톤으로 맞추며 3점→6.5점 오른 과정은 docs/design/acorn-hop/CRITIQUES.md), "오늘의 하늘" 최고 높이 공유, 실패 장면 GIF.
- 주 1회 블로그: 제작기 + 밸런스 시뮬(봇이 중앙값 약 67m) 데이터를 dev.to/velog에.

## 판정 (11-24 월요일 회고)
- 지표: `acorn-hop` finish(완주) 수, 첫 판 후 재방문, Daily 재방문, 평균 판수. 기준은 팀이 정하되 **"한 판 더" 비율**을 핵심으로 본다.
- 결과에 따라 토스 허브 이전(docs/team/toss-hub/PLAN.md) 여부를 결정한다.


## 이미지가 붙는 다채로운 게시 (11-17 추가, 오너 요청: "이미지 캡쳐도 올리고, 다채롭게")
게시 스크립트가 이제 **이미지와 캐러셀**을 지원한다(`scripts/post-social.mjs`). Bluesky는 이미지 최대 4장(링크 카드 대신), Threads는 1장이면 이미지 게시, 2장 이상이면 **캐러셀**. 파일이 없거나 형식·용량(900KB)이 맞지 않으면 게시하지 않고 `skipped-image-*`로 기록한다.

큐 예시:
```json
{ "channel": "threads", "text": "…", "url": "https://quickminigames.site/acorn-hop",
  "images": [ { "path": "docs/marketing/images/acorn-hop/cover.jpg", "alt": "Acorn Hop 키아트: 도토리를 쏘며 솟아오르는 우주 다람쥐 토리" },
              { "path": "docs/marketing/images/acorn-hop/play.jpg", "alt": "플레이 화면" } ] }
```
- 이미지는 **같은 PR에서 main에 머지**돼야 Threads가 공개 URL로 읽을 수 있다(`raw.githubusercontent.com`). 큐 파일과 이미지를 한 PR에 넣는다.
- 새 이미지는 Playwright로 실사이트를 2배 줌으로 캡처하거나(`documentElement.style.zoom=2`, 뷰포트 780 폭) Gemini 파이프라인(docs/team/GEMINI.md)으로 만든다. 글자는 이미지에 넣지 말고 본문에 쓴다.

### 이미지 세트 (docs/marketing/images/acorn-hop/)
| 파일 | 내용 | 어울리는 앵글 |
|---|---|---|
| `cover.jpg` | 16:9 키아트 | 첫 공개, 링크 공유 |
| `howto.jpg` | 첫 화면(좌/우 탭 안내) | "이렇게 해요" 설명 |
| `play.jpg` | 플레이 중 별·도토리 | 플레이 감성, 규칙 소개 |
| `result.jpg` | 결과 카드(높이 m) | "몇 m까지 가세요?" 도전, 기록 공유 |
| `meet-tori.jpg` | 토리 포즈 5종 소개 | 캐릭터 소개 |

### 7일 게시 캘린더 (같은 형식을 이틀 연속 쓰지 않는다)
| 날짜(KST) | 앵글 | 이미지 | 한 줄 방향 |
|---|---|---|---|
| 11-18 | 첫 공개 | cover + play (캐러셀) | "쏘면 반동으로 솟는 우주 다람쥐" |
| 11-19 | 캐릭터 | meet-tori | 토리 소개, 다른 친구들이 곧 온다는 떡밥 |
| 11-20 | 도전 | result | "58m 찍었어요, 몇 m까지 올라가요?" 높이 챌린지 |
| 11-21 | 제작기 | howto + 3→6.5점 요약 | Gemini로 한 톤 맞춘 과정, 혹평 리뷰에서 3점 받은 이야기 |
| 11-22 | 팁 | play | "쉼터 섬을 노려라", 도토리 경제 팁 |
| 11-23 | 데이터 | 없음(텍스트+링크) | 봇 시뮬 결과(중앙값 약 103m), 밸런스를 어떻게 잡았는지 |
| 11-24 | 회고 | 주간 성과 이미지(팀이 제작) | 완주 수·재방문 공개, 다음 신작 예고 |
- 채널별 톤: Bluesky 영어(개발자·인디 게임 층), Threads 한국어(일반 유저). 같은 날 같은 이미지를 두 채널에 쓰지 않아도 된다.
- 반응이 좋은 앵글(좋아요·답글·유입 ref)은 다음 주에 비중을 늘리고, 안 나오는 앵글은 버린다(GROWTH.md 실험 규칙).
