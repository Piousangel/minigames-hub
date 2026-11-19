# Slime Slide 8스테이지 데일리: 레벨 연출 레퍼런스 (R1)

조사일 2026-11-19. 방법: WebSearch(standard)를 16회 돌렸다. 출처 유형은 다섯 가지다. ① GDC 슬라이드와 개발자 코멘터리, ② 디자인 기사·블로그(Game Developer, MCV, Kotaku, Tuts+ 등), ③ 학술 논문, ④ 플레이어 커뮤니티(Steam 토론, Reddit 미러, App Store 리뷰), ⑤ 위키.
**한계:** 이 세션에서는 WebFetch가 막혀 있었다(gamedeveloper.com, engadget.com DNS 차단). 그래서 아래 인용은 모두 **검색 결과 스니펫 기준**이고 원문 전체는 열어보지 못했다. 검색에 나오지 않고 기억에만 의존한 내용은 [기억, 미검증]으로 표시했다.

---

## (a) 기법 13선

### 1. 기승전결(kishōtenketsu) 4단계
- **무엇인가:** 한 레벨 안에서 하나의 아이디어를 소개하고, 발전시키고, 비틀고, 마무리한다. Super Mario 3D World의 하야시다 고이치가 이 4단 구조로 설계 과정을 정리했다고 알려져 있다.
- **출처:** https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps , https://kotaku.com/what-made-super-mario-3d-world-so-great-1691916400
- **우리 게임에 적용:** 8스테이지를 4+4 두 사이클로 나눈다. 1(기)에서 경사 미끄럼만 소개하고, 2(승)에서 같은 지형에 경사를 연장한다. 3(전)에서는 같은 지형인데 꽃이 위쪽에 있어 '올려치기'가 필요하다. 4(결)는 앞의 셋을 합친 시험이다. 5~8은 새 변수 하나로 같은 사이클을 한 번 더 돈다.
- **위험:** '전'이 그냥 난이도만 올린 것이면 재탕으로 느껴진다. 전환점은 *같은 도구를 다르게 쓰는 깨달음*이어야 한다.

### 2. 가르치고 → 반복하고 → 비틀고 → 최종 시험
- **무엇인가:** 메이커형 레벨 디자인 공식이다. 메커닉 하나를 고르고, 안전하게 소개하고, 반복으로 익숙하게 만든 뒤, 변주하고 마지막 테스트로 끝낸다. 툴박스를 전부 쏟아붓지 말라는 경고도 함께 나온다.
- **출처:** https://gamedeveloper.com/design/great-level-design-tips-using-super-mario-maker- , GMTK 'How to Make Your First Super Mario Maker 2 Level' 자막 https://amara.org/subtitles/ncguKGRPsIw0/en/1/download/How%20to%20Make%20Your%20First%20Super%20Mario%20Maker%202%20Level%20%20Game%20Makers%20Toolkit.en.txt
- **우리 게임에 적용:** 스테이지마다 '새 요소'(바운스 버섯, 바람, 가시 등)는 최대 1개로 제한한다.
- **위험:** 8스테이지밖에 없어서 '반복' 단계를 길게 가져갈 수 없다. 반복은 별 3개 수집 경로 안에서 소화한다.

### 3. 월드당 메커닉 하나, 쓰고 나면 버린다 (Braid / Cut the Rope)
- **무엇인가:** Braid는 월드마다 시간 규칙이 바뀌고, 월드끼리 규칙이 거의 겹치지 않는다. 특히 **월드 2와 월드 4에 사실상 같은 레벨이 나오지만 시간 규칙이 달라서 해법이 전혀 다르다.** Cut the Rope는 '박스'마다 25레벨이 들어 있고, 새 메커닉은 새 박스에서만 나온다. 덕분에 플레이어는 25레벨 동안 그 메커닉을 숙달할 수 있다고 믿게 된다.
- **출처:** https://wikipedia.com/wiki/Braid_(video_game) , https://www.gamedeveloper.com/design/design-lesson-101---em-braid-em- , https://mechanicsofmagic.com/2023/05/18/critical-play-cut-the-rope/
- **우리 게임에 적용:** Braid의 2→4 사례는 사장님 북극성인 "N+1은 N의 지형 + 새 변수 하나"를 정확히 실증한다. **같은 지형이라도 해법이 바뀌면 콜백이고, 해법이 같으면 재탕이다.** 이 기준을 그대로 검수 규칙으로 쓰면 된다.
- **위험:** 새 변수를 넣었는데도 예전 해법이 그대로 통하면 재탕이 된다. 반드시 *이전 최적선이 실패하는지* 시뮬레이션으로 확인해야 한다.

### 4. 나중에 배운 것으로 앞의 퍼즐을 푼다 (The Witness)
- **무엇인가:** 막히면 다른 곳으로 가서 새 규칙을 배우고 돌아오게 만드는 구조다. 뒤에서 배운 규칙이 앞의 퍼즐을 쉽게 만든다고 평가된다. 텍스트 없이 퍼즐의 배열만으로 가르친다.
- **출처:** https://www.gamespot.com/articles/the-witness-preview/1100-6327782/ , https://www.electrondance.com/the-laboratory-of-logic/
- **우리 게임에 적용:** 데일리 순차 해금 구조에서는 *역방향 콜백*이 가능하다. 스테이지 2의 별 하나는 스테이지 5의 기술(예: 루프 그리기)로만 닿게 배치하고, 8을 클리어한 뒤 "2의 숨은 별"을 다시 열어준다.
- **위험:** 3회 시도 제한과 충돌한다. 재방문용 별은 시도 횟수를 차감하지 않는 보너스로 분리한다.

### 5. 작은 변경, 큰 해법 차이 (Snakebird 연구)
- **무엇인가:** Snakebird 레벨을 분석한 논문에 따르면 레벨을 조금만 바꿔도 최적해 길이가 크게 늘어날 수 있다.
- **출처:** https://webdocs.cs.ualberta.ca/~nathanst/papers/sturtevant2020incremental.pdf
- **우리 게임에 적용:** "N 지형 재사용 + 하나 변경"을 자동 검증할 수 있다. 솔버가 최소 잉크 해를 찾게 해서 N과 N+1의 해 차이(잉크량, 선의 위상)가 임계값보다 클 때만 통과시킨다.
- **위험:** 해법이 길어지는 것과 재미있어지는 것은 같지 않다. 지루한 복잡도만 늘 수 있다.

### 6. 같은 레이아웃의 하드 리믹스 (Super Meat Boy Dark World)
- **무엇인가:** 라이트 월드와 레이아웃은 같고, 위험 요소 밀도를 높이고 안전 발판을 뺀 버전이다. 라이트 레벨에서 A+를 받아야 열린다.
- **출처:** https://tcrf.net/Super_Meat_Boy , https://super-meat-boy-3d.pages.dev/guide/dark-world
- **우리 게임에 적용:** 같은 지형을 *밤 버전*으로 재등장시킨다. 이때 바꾸는 것은 위험이 아니라 **조건**이다(예: 밤에는 반딧불 별이 다른 자리에서 빛나고, 이슬로 마찰이 줄어든다).
- **위험:** 사장님이 금지한 "도토리만 옮긴 같은 레벨"에 가장 가까운 패턴이다. **실행 난이도만 올린 리믹스는 캐주얼 데일리에서는 재탕이다.** 해법이 바뀌는 경우에만 쓴다.

### 7. 재맥락화(recontextualize) (Void Stranger)
- **무엇인가:** 답을 아는 퍼즐을 다시 풀면 첫 경험이 재현되지 않는다. 그래서 퍼즐 자체가 아니라 *의미와 맥락*을 바꿔서 다시 보여준다.
- **출처:** https://publish.obsidian.md/myaiba/Z0+Zettels/Void+Stranger+Understands+that+it+is+impossible+to+replay+puzzle+games+and+get+the+original+experience%2C+so+it+instead+recontextualizes+its+puzzles+to+create+a+new+experience
- **우리 게임에 적용:** 스테이지 1의 언덕이 스테이지 7에서는 멀리 배경으로 보이거나, 슬라임이 그 언덕을 *반대쪽에서* 내려오는 일부 구간으로 재등장한다. 미러 복제가 아니라 같은 장소를 다른 시점에서 보여주는 것이다.
- **위험:** 플레이어가 알아보지 못하면 아무 효과가 없다. 첫 등장 때 고유한 랜드마크(큰 버섯, 부러진 울타리)를 심어둬야 한다.

### 8. 한 번에 개념 하나, 중간에 쉬는 퍼즐 (Portal)
- **무엇인가:** Valve는 게임 전체를 "확장된 훈련"으로 봤다. 개념을 한꺼번에 너무 많이 넣은 에너지볼 퍼즐은 재작업했다. 복잡한 퍼즐 사이에 단순한 과제가 없으면 피로가 쌓인다는 것도 발견했다. 초기부터 자주 플레이테스트하는 것이 핵심 철학이었다.
- **출처:** https://cdn.fastly.steamstatic.com/apps/valve/2008/GDC2008_PortalPostMortem.pdf , https://theportalwiki.com/wiki/Portal_developer_commentary
- **우리 게임에 적용:** 8스테이지 곡선에 '숨 고르기'를 하나 넣는다. 예를 들어 스테이지 6은 짧고 시원한 활강 보상 스테이지로 만든다.
- **위험:** 숨 고르기가 너무 쉬우면 그 단계가 버려진다. 별 3개 조건으로 숙련자에게는 도전을 남긴다.

### 9. 모든 화면이 한 장의 그림 + 컬러 스크립트 (Monument Valley)
- **무엇인가:** 모든 화면이 퍼즐이자 건축물이자 그래픽 구성으로 동작해야 한다. 퍼즐에 필요한 정보는 한 화면 안에 다 있다. 전 화면을 출력해 벽에 붙여놓고 컬러 스크립트로 검토했다.
- **출처:** https://gdcvault.com/play/1020878/Designing-Monument-Valley-Less-Game , https://www.pocketgamer.biz/feature/58906/stairway-to-heaven-the-making-of-monument-valley/
- **우리 게임에 적용:** 새벽에서 별밤으로 가는 8컷을 한 줄로 늘어놓고 색 흐름을 검수한다. 각 보드(390×560)는 그 자체로 엽서 한 장이 되게 만든다.
- **위험:** 아트 비용이 든다. 팔레트 보간과 배경 레이어 재사용으로 비용을 줄인다.

### 10. 끊김 없는 하나의 세계 (Inside / Limbo)
- **무엇인가:** Inside는 하나의 큰 레벨로 만들어졌다. 튜토리얼 없이 장애물로 가르친다. 로드와 리스폰을 구분해 음악 흐름이 끊기지 않게 했다.
- **출처:** https://www.gamedeveloper.com/design/inside-teaching-through-level-design , https://mcvuk.com/?p=68239
- **우리 게임에 적용:** **스테이지 N의 꽃 위치가 N+1의 슬라임 스폰 지점이 되게** 카메라를 패닝한다. 8장을 이으면 하나의 파노라마 정원이 된다. 예전 지형을 기억하게 만드는 가장 값싼 방법이다.
- **위험:** 스폰은 좌상단으로 고정되어 있다는 제약이 있다. 패닝 연출로만 처리하고 실제 좌표는 고정한다.

### 11. 메커니컬 복선과 '살짝 보여주기'
- **무엇인가:** 아직 닿을 수 없는 목표를 미리 보여줘서 플레이어가 머릿속에 북마크하게 만든다. 아직 쓸 수 없는 오브젝트를 먼저 노출하는 방식도 있다. 이 패턴들이 호기심 탐색을 유발하는지 실험한 CHI Play 2021 논문도 있다.
- **출처:** https://gamedeveloper.com/design/mechanical-foreshadowing , https://cxong.github.io/2019/10/level-design-patterns-in-2d-games , https://repository.tudelft.nl/islandora/object/uuid%3A987f5a6c-3e37-403a-8c1c-13f99aa3ba59
- **우리 게임에 적용:** 클리어 연출 끝에 다음 보드 가장자리를 2초쯤 비춘다. 이때 *다음 스테이지의 새 변수*(처음 보는 버섯, 바람 깃발)의 실루엣만 보여준다. 이것이 "다음은 뭐지?" 훅이다.
- **위험:** 너무 많이 보여주면 스포일러가 되고 놀라움이 사라진다. 실루엣 하나만 보여준다.

### 12. 하루 한 세트의 희소성과 모두 같은 퍼즐 (Wordle)
- **무엇인가:** 하루 1회로 제한한 것이 돌파구였다. 이것이 희소성을 만들고 하루 3분 정도의 습관을 만든다. 모두가 같은 단어를 풀기 때문에 사회적 공유가 생긴다.
- **출처:** https://en.wikipedia.org/wiki/Wordle , https://www.boston.com/news/national-news/2022/01/04/he-made-wordle-for-his-partner-now-its-an-online-hit/
- **우리 게임에 적용:** 8스테이지를 모두 같은 시드로 내고, 결과 공유 카드에 "스테이지별 별 개수와 잉크 사용량"을 이모지 격자로 담는다.
- **위험:** 8스테이지는 3분보다 길다. 스테이지 1~3을 아주 짧게 만들어야 한다.

### 13. 고정된 난이도 경사와 난이도 라벨 (NYT)
- **무엇인가:** NYT 크로스워드는 월요일이 가장 쉽고 토요일이 가장 어렵다. 쇼츠가 그 경사를 일부러 더 가파르게 만들었다. Connections는 요일이 아니라 색(노랑→보라)으로 난이도를 알려준다.
- **출처:** https://www.puzzazz.com/puzzle-difficulty-index , https://tomsguide.com/gaming/the-10-toughest-nyt-connections-of-2025
- **우리 게임에 적용:** 하루 안에서 1부터 8까지 단조롭게 오르는 경사를 기본으로 하고, 각 스테이지에 새벽부터 별밤까지 색 라벨을 붙인다. 시간대가 곧 난이도라는 걸 시각적으로 약속하는 셈이다.
- **위험:** 경사가 너무 가파르면 7~8에서 이탈한다(실패 사례 2 참고).

### 14. 단계형 힌트와 실패 시 힌트, 힌트 의존도를 진단 지표로 쓰기
- **무엇인가:** 답을 알려주는 힌트는 만족감을 없애고, 방향만 짚어주는 힌트는 만족감을 지킨다. 점점 더 구체적인 힌트를 주는 사다리 구조, 실패 N회 뒤에 힌트를 제안하는 방식이 있다. 같은 힌트를 50% 이상의 플레이어가 요청하면 퍼즐을 고치라는 기준도 있다.
- **출처:** https://roomescapeartist.com/2016/10/02/hints-and-hinting-systems-room-design , https://tvtropes.org/pmwiki/pmwiki.php/Main/HintSystem , https://bugnet.io/blog/how-to-design-a-hint-system-for-puzzles
- **우리 게임에 적용:** 3회 시도와 연동한다. 2번 실패하면 *꽃 쪽의 첫 접점 하나*만 점으로 표시하고, 전체 고스트 선은 보여주지 않는다. 스테이지별 힌트 사용률을 지표로 수집한다.
- **위험:** 전체 해답 고스트를 보여주면 "따라 그리기"가 되어 퍼즐이 소멸한다.

---

## (b) 실패 사례 8선

1. **원리 재탕: Happy Glass.** App Store 리뷰에 "많은 레벨이 이전 레벨의 같은 원리를 재사용한다", "일부 레벨은 다른 레벨을 반복한다", "매우 쉽다"는 지적이 있다. 선 그리기 물리 장르에서 재탕을 겪은 직접 사례다. https://apps.apple.com/au/app/happy-glass/id1425793208 (스니펫은 여러 국가 스토어 페이지에 걸쳐 수집됨. 어느 국가의 리뷰인지는 특정하지 못함)
2. **난이도 절벽: Poly Bridge 2, 월드 5.** "5번째 월드는 난이도가 차원이 다르다. 숙제처럼 느껴졌다"는 Steam 토론 글이 있다. 개발사는 1편이 너무 어렵다는 피드백을 받아 2편 곡선을 완만하게 하려 했다고 답했다. https://steamcommunity.com/app/1062160/discussions/0/2965021152080424026
3. **실패 원인이 안 보이면 감으로 하는 게임이 된다: Poly Bridge 2.** 큰 레벨에서 다리가 왜 무너지는지 알 수 없어서 추측 게임이 된다는 리뷰가 있다. https://gamerant.com/poly-bridge-2-review/ ; r/PolyBridge에서는 6-15를 "어렵다기보다 지루하다"고 했다. https://redlib.ssps.io/r/PolyBridge/comments/9n514o/hardest_level_on_poly_bridge (Reddit 미러)
4. **해답 노출형 힌트와 광고 결합: Love Balls.** 힌트를 광고나 코인으로 사야 하고, 광고가 로드되지 않거나 코인만 빠졌다는 불만이 있다. 새 메커닉에 '해답을 보여주는' 방식을 쓴다는 분석도 있다. https://apps.apple.com/au/app/love-balls/id1348173937 , https://megacool.medal.tv/blog/how-love-balls-became-a-viral-smash-and-6-ways-to-improve-it/
5. **물리가 예측과 다르게 움직임: Brain It On!** "지시대로 그렸는데 자석에 닿지 않고 그냥 떨어진다"는 리뷰가 있다. 물리 퍼즐에서는 *읽을 수 있는 물리*가 공정성의 전제다. https://apps.apple.com/us/app/brain-it-on-physics-puzzles/id985367692
6. **조건을 읽을 수 없는 퍼즐: Snakebird 3-19, 3-21.** 체리를 먹는 순서가 잘 읽히지 않아서 플레이어가 여러 번 시도한 뒤에야 문제를 깨닫는다는 플레이어 분석이 있다. 출처는 electrondance.com의 Snakebird 연재로, https://www.electrondance.com/?p=13654 또는 ?p=13562 중 하나다(검색 요약에서 정확한 글을 특정하지 못함).
7. **답을 알면 퍼즐이 사라진다: 리플레이와 단일해.** Ghost Trick은 해법이 하나뿐이어서 다시 하면 "동작만 따라 하게 된다"는 평을 받았다. https://gamedeveloper.com/business/critical-reception-capcom-s-i-ghost-trick-i- ; 답을 아는 퍼즐은 첫 경험을 재현하지 못한다는 분석도 있다(위 Void Stranger 노트). 고스트 선을 보여주는 힌트나 같은 해법의 재탕 스테이지가 이런 실패를 겪는다.
8. **한 퍼즐에 새 개념이 너무 많음: Portal 초기 에너지볼 퍼즐.** 플레이테스트에서 실패해 재작업했다. https://theportalwiki.com/wiki/Portal_developer_commentary

---

## (c) 8스테이지 데일리를 위한 권고 5가지

1. **'한 정원 파노라마' 구조로 만든다** (기법 9, 10, 11). 8장을 이어 붙이면 하나의 가로 정원이 되게 한다. 스테이지 N의 꽃 근처가 N+1의 출발 언덕이다. 클리어 연출에서 카메라를 다음 보드로 밀어서 *새 변수 실루엣 하나*만 보여주고 멈춘다. 지형 연결 자체가 기억과 콜백을 만들고, 이 엿보기가 "다음은?" 훅이 된다.
2. **4+4 기승전결 두 사이클로 짠다** (기법 1, 2, 8).
   - 1 기(경사 소개)
   - 2 승(1의 지형 + 길이나 각도 변화)
   - 3 전(같은 도구로 *올려치기*)
   - 4 결(합성 시험)
   - 5 새 변수 등장(예: 바운스 버섯)
   - 6 숨 고르기 활강(별 3개는 어렵게)
   - 7 전(5의 변수를 1~3에서 배운 기술과 결합)
   - 8 피날레(별밤, 1의 언덕을 반대편에서 내려오는 재맥락화)

   새 요소는 스테이지당 최대 1개로 하고, 한 퍼즐에 새 개념을 2개 이상 넣지 않는다.
3. **"해법이 바뀌어야 콜백"을 자동 검수 규칙으로 만든다** (기법 3, 5, 6, 실패 1). N+1이 N의 지형을 재사용한다면 다음 세 가지를 확인한다. ① N의 최적선을 그대로 그렸을 때 N+1에서 실패한다. ② 솔버의 최소 잉크 해의 위상(선 개수, 오목/볼록, 접점 위치)이 다르다. ③ 미러 변환이나 단순 평행이동 관계가 아니다. 세 가지 모두 통과해야 배포한다. 직선 막대만으로 된 지형은 곡률 분산 최소값으로 걸러낸다.
4. **힌트는 '첫 접점 한 점'까지만 주고, 고스트 선 전체는 보여주지 않는다** (기법 14, 실패 4, 7). 2번 실패하면 접점 하나만 표시하고, 3번째 시도가 끝나야 해답 리플레이를 보여준다(이 경우 별 0개, 다음 스테이지는 해금). 스테이지별 힌트와 해답 열람 비율을 지표로 수집해서 50%를 넘는 스테이지는 다음 날 세트에서 수정한다.
5. **경사는 단조롭게 오르되 절벽은 없게 하고, 실패는 읽히게 만든다** (기법 13, 실패 2, 3, 5). 1~3은 각각 30초 안에 끝나게 해서 Wordle처럼 짧은 진입을 만든다. 7→8의 난이도 상승폭이 6→7보다 크지 않게 한다. 실패한 시도는 슬라임 궤적 잔상과 "여기서 튕겨나감" 마커로 원인을 보여줘서 감으로 하는 게임이 되지 않게 한다. 결과 공유 카드는 8칸 이모지(별 개수, 시간대 색)로 만들어 같은 시드를 푼 사람끼리 비교할 수 있게 한다.

---
*참고: Monument Valley GDC 영상, MiXiT 'Level design in Baba Is You'(https://mixitconf.org/en/user/arviteikari), Cut the Rope GDC 2012 레벨 디자인 사례 연구(https://gdcvault.com/play/1015344/contactUs)는 존재만 확인했고 내용은 검증하지 못했다. Baba Is You의 'reverse engineering' 퍼즐 설계(해법이 될 깨달음부터 정하고 레벨을 역으로 짓는 방식)는 [기억, 미검증]이다. 여기서는 권고 3의 솔버 검수와 같은 취지로만 참고했다.*
