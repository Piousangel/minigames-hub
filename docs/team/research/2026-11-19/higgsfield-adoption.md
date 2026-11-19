# Higgsfield 도입 조사 (허브·샌드랩 리디자인용)

조사일: 2026-11-19 · 조사자: AI 영상·이미지 도구 도입 리서처
표시: **[확인]** 공식 페이지를 직접 열어 확인 · **[요약]** 공식/2차 출처를 요약(문구 일부 해석) · **[추정]** 근거 기반 추론
로그인·계정 생성·결제는 하지 않음. 공개 페이지만 열람.

---

## 0. 결론 먼저

1. Higgsfield에는 **정식 REST API가 있다**. 구독(웹 플랜)과는 **별개 상품**이고 달러 선불 종량제다. GitHub Actions에서 그대로 부를 수 있다. [확인]
2. 우리 용도(3~6초 무음 루프, 720p)에는 **API + Wan 3.0 image-to-video(첫 프레임 = 끝 프레임)** 조합이 가장 싸고 맞다. 1개 6초 기준 약 $0.2~0.4, 재시도를 포함해도 수 달러 안이다. [추정]
3. 키아트 정지 이미지는 지금처럼 **Gemini(Nano Banana)로 만들고**, Higgsfield는 그 이미지를 **움직이게 하는 데만** 쓰면 캐릭터 일관성 문제가 대부분 해결된다. [추정]
4. Gemini API 쪽 **Veo 3.1 preview는 2026-10-22에 종료됐다**. 후속은 `gemini-omni-1.2-flash`(3~15초, 참조 이미지 최대 6장)다. 기존 GEMINI_API_KEY로 비교 후보가 된다. [확인]
5. 게임 소개 영상은 **실제 게임 화면 캡처가 1순위**다. AI 영상은 광고 사이트 신뢰와 실제 게임과 다르다는 오해 위험이 있고, 캡처는 비용이 0이다. [추정]

---

## 1. Higgsfield가 제공하는 것

### 1-1. 모델 구성 [확인] (docs.higgsfield.ai/docs/models.md, video-generation.md)
- API 카탈로그: **84개(이미지 17, 영상 67)**. 자체 모델과 서드파티 모델을 함께 제공한다.
- 영상 계열: Genjutsu(자체: 모션 전이·오브젝트 교체·리스타일), Cinema Studio 4.0(자체: **카메라·스타일 컨트롤**), Seedance 2.0/2.5(ByteDance), Kling 2.5 Turbo/2.6/3.0/O3/Omni/Motion Control, Wan 2.6/2.7/3.0/3.0 Prime(Alibaba), Happy Horse, MiniMax H3·Hailuo 2.3, LTX-2.5, PixVerse V6, Grok Imagine Video 1.5.
- 이미지 계열: SOUL(자체), Soul ID 학습, Marketing Studio, Ads Studio, Grok, Recraft, Qwen Image, Ideogram, Z-Image.
- 웹앱(higgsfield.ai)에는 위 모델 외에 **Google Veo 3.1 / 3.1 Fast, Nano Banana Pro/2, GPT Image, Seedream, FLUX.2, DoP(카메라 무브 프리셋)** 등이 있다. 웹 요금표 기준 [확인]. 다만 **API 공개 모델 목록에는 Veo가 보이지 않는다** [확인: models.md에 Veo 언급 없음].

### 1-2. 길이·해상도·포맷
| 모델(API) | 길이 | 해상도 | 루프에 쓸 기능 | 출처 |
|---|---|---|---|---|
| Wan 3.0 image-to-video | 2~30초(기본 5초) | 480p/720p/1080p | `image_url`(첫 프레임) + `end_image_url`(끝 프레임), `generate_audio`(기본 true), `seed`, 비율 16:9·4:3·1:1·3:4·9:16·adaptive | [확인] |
| Kling O3 first-last-frame | 3~15초(기본 5초) | `mode`: std / pro(기본) / 4k | `first_frame_url` + `last_frame_url`, `sound` on/off(기본 off), 비율 16:9·9:16·1:1, 멀티샷 최대 6개 | [확인] |
| Seedance 2.0 | 4~15초 | 최대 4K | text / image / reference-to-video | [확인: 요금 페이지·모델 페이지] |
| Seedance 2.5 | 4~30초 | 1080p | 생성·편집·연장, 멀티모달 참조 | [확인] |
| Kling 4.0 / 4.0 Flash | 3~30초 / 3~20초 | 1080p / 720p | — | [확인: 요금 페이지] |
- 출력 포맷: 완료 응답의 `video.url`이 **MP4**다. 일부 작업은 zip·mov 등도 준다. [확인]
- 입력 이미지는 **공개 HTTPS URL**이어야 한다. 아니면 `POST /files/generate-upload-url`로 presigned 업로드를 한 뒤 받은 `public_url`을 쓴다(jpeg/png/webp/gif 지원, upload_url은 1시간 뒤 만료). [확인]

### 1-3. 스타일·캐릭터 일관성
- **Soul ID**: 참조 이미지로 캐릭터를 학습하는 워크플로(`POST /v1/custom-references`, 동시 학습 수에 제한이 있다). [확인] 주로 실사 인물용이다. 말랑이 같은 2D·젤리 마스코트에 맞는지는 [추정: 부적합 가능성 큼].
- **reference-to-video**(Seedance 2.0/2.5, Wan 2.6/2.7/3.0, Kling O3/Omni): 참조 이미지를 여러 장 넣어 같은 캐릭터를 유지한다. [확인: 엔드포인트 존재]
- 우리에게 가장 확실한 방법은 **image-to-video**다. Gemini로 만든 확정 키아트를 첫 프레임으로 쓰므로 캐릭터가 바뀔 여지가 가장 적다. [추정]

---

## 2. API 유무와 형태 [확인] (docs.higgsfield.ai)

| 항목 | 내용 |
|---|---|
| 상품 | **Higgsfield API**. 웹 구독과 별개이고 플랜 크레딧을 쓰지 않는다. 구독 없이도 쓸 수 있다. |
| 베이스 URL | `https://api.higgsfield.ai` |
| 콘솔(키·잔액·분석) | 문서는 `console.higgsfield.ai`, 도움말은 `open.higgsfield.ai`로 표기한다. 둘 다 같은 API 콘솔로 보인다 [추정]. |
| 인증 | 자격 증명이 **Key ID + Secret** 두 개다. 헤더는 `Authorization: Key ${KEY_ID}:${KEY_SECRET}`. 키는 생성할 때 한 번만 보여준다. 401은 "Invalid credentials". 서버 측에서만 호출한다. |
| SDK | Python `pip install higgsfield-client`(환경변수 `HF_KEY="key-id:key-secret"`, `subscribe()`·`submit()`·`upload_file()`), TS `npm i @higgsfield/client`(`HF_CREDENTIALS`, `@higgsfield/client/v2`, 서버 전용) |
| 비동기 방식 | `POST /{model-path}`를 보내면 `{status:"queued", request_id, status_url, cancel_url}`가 온다. 이후 `GET /requests/{id}/status`로 폴링한다. 상태는 queued → in_progress → **completed / failed / nsfw / canceled**. 웹훅은 `?hf_webhook=https://...`로 받는다(Standard Webhooks 서명, 5xx일 때 최대 2시간 재시도). |
| 멱등성 | 생성 요청에 `Idempotency-Key` 헤더를 붙인다. 타임아웃 뒤 같은 키로 재시도해도 요청이 중복되지 않는다. |
| 비용 사전 조회 | `POST /estimate/{model}`(생성과 같은 파라미터)를 보내면 `{"usd":"0.094"}` 형태로 금액이 온다. **예산 상한 구현에 그대로 쓸 수 있다.** |
| 동시 실행 제한 | 신규 계정은 2개, 최근 28일 충전액이 $25 이상이면 10개, $100 이상이면 20개, $1,000 이상이면 40개. 한도를 넘은 요청은 queued로 대기한다. 큐가 가득 차면 429와 `Retry-After`를 받고, 이때는 과금되지 않는다. 남은 용량을 알려주는 rate-limit 헤더는 아직 없다. |
| 결과 보존 | **7일 뒤 파일 삭제**. `Hf-Expires-After` 헤더로 1시간까지 줄일 수 있고, `DELETE /requests/{id}`로 즉시 삭제할 수 있다. 생성 직후 내려받아야 한다. |
| 실패 과금 | failed·nsfw·대기 중 취소는 **과금하지 않고 자동 환불**한다. |

**별도 경로(참고)**: Higgsfield **MCP/CLI**는 웹 계정에 붙어 **플랜 크레딧을 차감**한다. [확인] 이 로컬 세션에서 MCP로 붙는 방법도 있지만, 무제한 모델과 무료 생성은 웹에서만 되고 MCP/CLI에서는 안 된다. [확인: 요금 페이지 주석] 자동화에는 API가 맞다.

**API가 막히면 쓸 웹 UI 수동 워크플로**: higgsfield.ai에 로그인한 뒤 Create Video를 열고, Wan 3.0 또는 Kling O3 FLF를 고른 다음 첫 프레임과 끝 프레임에 같은 키아트를 올리고 프롬프트를 넣어 생성한다. 결과 MP4를 내려받아 `assets-src/video/`에 두면 Actions의 변환 단계만 실행하면 된다. 웹 플랜은 유료여야 워터마크가 없다(아래 3).

---

## 3. 요금·약관

### 3-1. API 요금(종량제, USD) [확인] (open.higgsfield.ai/pricing, 도움말)
- 선불 잔액에서 차감한다. **최소 충전 $5**. 충전한 돈은 **1년 뒤 만료**된다. 잔액이 0 아래로 내려가지 않으므로 잔액이 바닥나면 요청이 멈춘다. **충전액 자체가 하드 예산 상한이다**(자동 충전을 끄면).
- 영상은 출력 초 단위, 이미지는 장 단위로 과금한다. 단가는 구성(해상도·오디오)별로 고정돼 있고 충전 규모와 무관하다.
- 시작가(from): **Wan 3.0 $0.038/s**, Wan 3.0 Prime $0.051/s, Kling 3.0 $0.071/s, Seedance 2.0 $0.080/s, Seedance 2.5 $0.118/s, Kling 4.0 $0.126/s, Kling 4.0 Flash $0.063/s, Genjutsu Light $0.074/s, Kling Image 4.0 $0.063/장.
- 구성별 예시: Kling 3.0 Standard i2v $0.107/s, Kling 3.0 Pro $0.144/s, PixVerse 6 1080p $0.098/s.
- **영상 1개 대략 비용** [추정]: 웹 크레딧 비율(Wan 3.0이 480p 5 / 720p 8.75 / 1080p 17.5크레딧)을 API 시작가에 대입하면 Wan 3.0 720p는 약 $0.066/s, 1080p는 약 $0.13/s다.
  - 6초 720p 루프: 약 **$0.40**, 480p는 약 $0.23. `generate_audio=false`로 끄면 더 낮아질 수 있다(오디오가 단가에 영향을 준다고 명시돼 있음 [확인]).
  - 정확한 값은 `/estimate`로 확인한다. 시작가가 어떤 구성의 가격인지는 공식 페이지에 나와 있지 않다.

### 3-2. 웹 구독 플랜 [확인] (higgsfield.ai/pricing, 2026-11-19 열람 · **블랙프라이데이 최대 64% 할인 중, 남은 시간 약 11시간**)
| 플랜 | 가격(연간 결제, 월 환산) | 월 크레딧 | 동시 생성 | 비고 |
|---|---|---|---|---|
| Free | 무료 | 제한된 사용 | 영상 1 | 워터마크 있음 [요약] |
| Starter | US$19 | 270 | 영상 2 · 이미지 4 | 일부 모델만 |
| Plus | US$33(정가 $59) | 1,200 | 유료 무제한 | 모든 모델 |
| Ultra | US$50(정가 $129) | 3,000(6천·9천 옵션) | 유료 무제한 | 모든 모델 |
- 웹 크레딧 단가 예시: Wan 3.0 720p 8.75/5초, Kling O3 FLF 1080p 약 6/5초, Kling 3.0 1080p 약 8/5초, Veo 3.1 Fast 약 16/4초, Veo 3.1 약 40/4초, DoP Lite 약 3/3초, Nano Banana Pro 2/장. [확인]
- 월간 결제 가격은 화면에 정가로만 표시돼 있었다(Plus $59, Ultra $129). Business(Team) 플랜은 따로 있다. [확인/요약]
- **우리에게는 구독이 필요 없다.** API $5~$25만 충전하면 된다. [추정]

### 3-3. 상업적 이용·소유권·금지·데이터 [확인] (higgsfield.ai/terms-of-use-agreement, 최종 개정 2026-10-23 · 도움말 "Who owns my generations")
- **소유권**: "Company does not claim ownership of any of your Inputs or Outputs, nor does it restrict your commercial use of Outputs"(§4.4). 생성물을 고객이나 제3자에게 양도·재라이선스할 수 있고, 해지한 뒤에도 권리가 유지된다.
- **상업적 이용**: 광고·SNS·브랜드 캠페인·제품·클라이언트 작업을 허용한다. 별도 상업 라이선스는 없고 **플랜과 무관**하다. → AdSense 광고 사이트의 키아트와 마케팅 클립에 쓸 수 있다. API 생성물도 같은 약관을 따른다(도움말: "Outputs can be used commercially under the Higgsfield Terms of Use").
- **고유성 보장 없음**: 다른 사용자가 비슷한 결과물을 얻을 수 있다. 우리 고유 캐릭터를 첫 프레임으로 쓰면 위험이 줄어든다. [추정]
- **워터마크**: "Paid plans include watermark-free downloads"이고 무료 플랜 결과물은 워터마크가 있다 [요약]. API 출력의 워터마크 여부는 공식 문서에 명시가 없다 [추정: 종량 유료 상품이라 없을 가능성이 큼. 첫 생성물을 눈으로 확인할 것].
- **학습 이용**: 약관상 Higgsfield는 입력·출력을 모델 학습에 **쓸 수 있다**(Enterprise 별도 계약은 제외). API 콘솔 Settings의 **"Exclude data from training"은 기본 꺼짐**이고, 개인 계정도 켤 수 있다. → **오너가 켜야 한다.** [확인]
- **금지 콘텐츠**: 불법·혐오·괴롭힘·명예훼손·사기, 미성년자 유해물, 비동의 성적 이미지, 생체 식별·민감 속성 추론, 사칭, 필터 우회(jailbreak), 경쟁 AI 학습에 사용, 스크래핑·역공학, 프롬프트에 민감 개인정보 기재. 만 18세 이상만 쓸 수 있고 **계정 공유는 금지**된다. [확인] → 키는 오너 계정에서 발급해 GitHub 시크릿으로만 쓰고 팀원이 로그인을 공유하지 않는다.
- **준거법**: 캘리포니아, AAA 중재, 집단소송 포기(30일 안에 옵트아웃 가능). [확인]
- **데이터 보존**: API 요청 파일·프롬프트는 7일 뒤 삭제되고, 짧게 줄이거나 즉시 삭제할 수 있다. 과금 기록은 남는다. [확인]

---

## 4. 용도별 적합성 비교

비교 대상은 세 가지다.
- **H** = Higgsfield API(Wan 3.0 / Kling O3 FLF)
- **G** = Gemini API(Veo 3.1 preview는 10-22 종료 [확인]. 현재 후보는 `gemini-omni-1.2-flash`: 3~15초, 참조 이미지 최대 6장, 720p 약 $0.07/s [요약: 2차 출처 다수 일치])
- **C** = 게임 화면 캡처(Playwright로 녹화한 뒤 ffmpeg)

웹 성능 공통 전제 [추정]:
- 히어로 영상은 **720p 이하, 무음, 3~6초, VP9 webm 약 300~700KB와 H.264 mp4(faststart)**로 만든다.
- `poster`는 Gemini 정지 키아트(webp)로 LCP를 담당하게 한다. 영상은 `preload="none"`으로 두고 첫 상호작용이나 idle 뒤에 로드한다.
- `prefers-reduced-motion`과 `saveData`에서는 영상을 끈다. AdSense 사이트라 LCP·CLS가 수익에 직결된다.

| 용도 | H(Higgsfield) | G(Gemini Omni Flash) | C(게임 캡처) | 추천 |
|---|---|---|---|---|
| ① 허브 홈 히어로 '살아 있는 키아트' 3~6초 루프 | **첫 프레임 = 끝 프레임 지정이 공식 파라미터로 있다**(Wan `end_image_url`, Kling `last_frame_url`) [확인]. 이음매 없는 루프를 만들기 가장 쉽다. 6초 720p에 약 $0.4 [추정]. 오디오를 끌 수 있다. | 참조 이미지로 일관성은 좋다. 끝 프레임 지정 여부는 미확인 [추정: 루프는 ffmpeg 크로스페이드로 보정 필요]. 기존 키를 그대로 쓸 수 있다. 약 $0.42/6초 [요약]. | 키아트가 아니므로 해당 없음. | **H 1순위**, G는 비교 샘플 1개 |
| ② 게임 소개 짧은 영상(Threads/Bluesky) | 연출 컷(인트로 2초)에는 좋다. 하지만 실제 게임플레이와 달라질 위험이 있다. | 같은 이유로 연출 컷만 쓴다. | **실제 화면이라 정확하고 비용 0**, 매일 출시와 자동화하기 쉽다. | **C 본편 + H 인트로 1~2초**(선택) |
| ③ 캐릭터 반응 클립(말랑이 통통 튐) | i2v로 젤리 물리 표현에 강하다 [추정]. 짧은 1~2초 클립은 2초부터 가능하다(Wan 최소 2초 [확인]). 같은 시작 포즈 이미지에서 여러 반응을 만들 수 있다. | 가능하다. 최소 3초. | 게임 안에서는 CSS/스프라이트 애니메이션이 더 가볍다. | **인게임은 CSS/Lottie·스프라이트**, 마케팅용만 H |
| ④ 샌드랩 홈 배경 루프 | 추상·질감 루프는 480p로 충분하다. 약 $0.23/6초 [추정]. 루프 프레임을 지정할 수 있다. | 가능하다. | 시뮬레이션(모래) 실제 화면을 캡처하면 **브랜드 고유성이 가장 높다**. | **C(실제 시뮬레이션 녹화) 또는 Canvas 실시간**, 보조로 H |

품질 메모 [추정]: H는 같은 입력으로 여러 모델(Wan·Kling·Seedance)을 한 키로 A/B할 수 있는 것이 최대 장점이다. G는 시크릿과 파이프라인이 이미 있어 추가 계정이 필요 없다.

---

## 5. 도입 절차

### 5-1. 오너가 할 일
1. **API 콘솔 가입**: https://console.higgsfield.ai (또는 open.higgsfield.ai). 개인으로 가입한다. 웹 구독은 필요 없다.
2. **결제 수단 등록과 충전**: 우선 **$10**(최소 $5). 이 금액이 하드 예산 상한이 되도록 **자동 충전(auto top-up)은 끈다**. 동시 생성 2개면 충분하다.
3. **Settings → "Exclude data from training" 켜기**(기본 꺼짐).
4. (선택) 보존 기간을 짧게 설정한다. 우리는 Actions에서 바로 내려받으므로 7일 기본값도 문제없다.
5. **API 키 생성**: Key ID와 Secret이 **한 번만** 표시되므로 바로 복사한다.
6. **GitHub 시크릿 등록**: 값은 `KEY_ID:KEY_SECRET` 형태로 **콜론으로 이어 한 줄**로 넣는다. SDK가 요구하는 형식이다.
   ```bash
   gh secret set HIGGSFIELD_API_KEY --repo Piousangel/minigames-hub
   # 프롬프트가 뜨면  <KEY_ID>:<KEY_SECRET>  를 직접 붙여넣기 (명령줄 인자로 넣지 말 것: 셸 히스토리에 남음)
   ```
   샌드랩 저장소에서도 쓸 경우 `--repo <샌드랩 저장소>`로 한 번 더 등록한다.
7. 첫 생성물을 보고 워터마크가 없는지와 품질 기준을 승인한다.

### 5-2. 우리가 만들 것: Actions 워크플로 초안 설계
**파일**: `.github/workflows/gen-video.yml`, `scripts/gen-video.py`, 요청 JSON은 `assets-src/video/requests/*.json`

**요청 JSON 예시**
```json
{
  "id": "hub-hero-loop-v1",
  "model": "alibaba/wan-3.0/image-to-video",
  "input": {
    "prompt": "jelly mascot gently bobbing, soft light shimmer, static camera, seamless loop",
    "image_url": "https://raw.githubusercontent.com/Piousangel/minigames-hub/main/public/img/keyart-hero.webp",
    "end_image_url": "https://raw.githubusercontent.com/Piousangel/minigames-hub/main/public/img/keyart-hero.webp",
    "duration": 5, "resolution": "720p", "aspect_ratio": "16:9",
    "generate_audio": false, "seed": 42
  },
  "outputs": { "dir": "public/video", "name": "hub-hero", "maxKB": 800 },
  "maxUsd": 0.6
}
```
(공개 저장소가 아니면 `image_url`은 SDK의 `upload_file()`로 올린 `public_url`을 쓴다.)

**워크플로 흐름**
1. 트리거: `workflow_dispatch`(input: 요청 파일 경로), 그리고 `assets-src/video/requests/**` push. `concurrency: gen-video`로 한 번에 하나만 실행한다.
2. `pip install higgsfield-client requests`를 설치하고 `env: HF_KEY: ${{ secrets.HIGGSFIELD_API_KEY }}`를 넘긴다.
3. **예산 검사** ①: `POST /estimate/{model}`로 받은 금액이 `maxUsd`를 넘으면 실패시킨다. ②: `assets-src/video/ledger.json`의 이번 달 누적 금액과 이번 견적을 더해 **월 상한 `VIDEO_MONTHLY_CAP_USD`(기본 $5, 저장소 변수)**를 넘으면 실패시킨다. ③: 마지막 방어선은 잔액이다(자동 충전 끔).
4. 생성: `Idempotency-Key = sha256(요청 JSON)`으로 같은 요청이 재실행돼도 이중 과금되지 않게 한다. `submit`한 뒤 폴링한다(지수 백오프, 최대 15분). 429는 `Retry-After`를 따른다.
5. 종결 상태 처리: completed면 `video.url`의 MP4를 내려받는다. failed·nsfw면 로그를 남기고 실패시킨다(과금 없음).
6. 변환(ffmpeg, ubuntu 기본):
   - webm: `-an -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -vf scale=-2:720`
   - mp4: `-an -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart`
   - poster: 첫 프레임을 `.webp`로 저장한다.
   - 결과가 `maxKB`를 넘으면 crf를 올려 다시 인코딩한다.
7. 루프 보정(선택): 끝 프레임 지정이 안 되는 모델이면 0.3초 크로스페이드(`xfade`) 또는 ping-pong(`reverse` 이어붙이기)을 적용한다.
8. 기록: `ledger.json`에 `{id, request_id, model, usd, date}`를 추가한다. 원본 MP4는 커밋하지 않고 아티팩트로만 업로드한다(용량 관리).
9. 커밋: `public/video/{name}.webm|.mp4|.webp`와 ledger를 **새 브랜치에 커밋하고 PR을 연다**. main에 바로 push하지 않는다. 사람(또는 리뷰 에이전트)이 영상을 본 뒤 머지한다.
10. 정리: 성공 뒤 `DELETE /requests/{id}`로 Higgsfield 쪽 파일을 즉시 삭제한다(선택).

**같은 스크립트로 Gemini 비교**: `provider: "gemini"` 분기를 두고 `gemini-omni-1.2-flash`를 기존 `GEMINI_API_KEY`로 호출하면 ①번 용도를 A/B할 수 있다. [추정: 엔드포인트와 파라미터는 구현할 때 공식 문서로 재확인]

**프런트 적용 규칙(별도 PR)**: `<video autoplay muted loop playsinline preload="none" poster=...>`에 `<source webm>`, `<source mp4>`를 넣는다. reduced-motion이거나 saveData면 poster만 보여준다. 모바일에서는 idle 뒤에 붙인다.

---

## 6. 남은 확인 사항(키를 받은 뒤 바로)
- `/estimate`로 Wan 3.0 720p 5초 무음, Kling O3 FLF std 5초 실제 단가를 확인한다. [미확인]
- API 출력에 워터마크가 없는지 확인한다. [미확인]
- Wan 3.0 `end_image_url`을 첫 프레임과 같은 이미지로 줬을 때 이음매가 자연스러운지 확인한다(샘플 2~3개). [미확인]
- Gemini Omni Flash가 끝 프레임 지정을 지원하는지, 단가가 공식 페이지와 같은지 확인한다. [미확인]

## 출처
- https://docs.higgsfield.ai/ · /docs/llms.txt · /docs/quickstart.md · /docs/authentication.md · /docs/concepts/requests.md · /docs/concepts/rate-limits.md · /docs/concepts/billing-and-retention.md · /docs/concepts/file-uploads.md · /docs/how-to/webhooks.md · /docs/how-to/sdk.md · /docs/models.md · /docs/models/video-generation.md · /docs/models/wan-3/image-to-video.md · /docs/models/kling-o3/first-last-frame.md · /docs/enterprise/model-training.md
- https://open.higgsfield.ai/pricing (API 단가·동시 실행 등급)
- https://higgsfield.ai/pricing (웹 플랜, 2026-11-19 브라우저 렌더링으로 열람)
- https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api
- https://higgsfield.ai/creator-hub/help-center/account-and-privacy/who-owns-my-generations-and-can-i-use-them-commercially
- https://higgsfield.ai/terms-of-use-agreement (최종 개정 2026-10-23)
- https://aistudio.google.com/docs/video (Veo 3.1 preview 종료, Omni Flash) · https://aistudio.google.com/docs/pricing (Gemini 이미지 단가)
- Omni Flash 영상 단가는 2차 출처: letsdatascience.com, braindetox.kr, eesel.ai 등 [요약]
