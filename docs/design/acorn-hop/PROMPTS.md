# Acorn Hop 에셋 프롬프트 (Gemini 나노바나나, `gemini-3-pro-image`)

공통 스타일 문장(모든 요청 앞에 붙이고 `style-ref.png`를 refs로 넣는다):
> Art direction: cozy storybook 'acorn forest floating in space'. Limited palette: deep indigo night (#1d1b4a, #2a2766), cream #fff3dc, acorn brown #8a5a2b, dark brown outline #5b3a1e, leaf green #7cc26a, star gold #ffc933. Thick uniform dark-brown outline, soft cel shading, plump friendly shapes, production quality of a top Korean casual mobile game. NO text, NO letters, NO watermark.

스프라이트 공통: 단일 오브젝트, 중앙 정렬, 가장자리와 여백, **배경 전체가 순수 마젠타 #FF00FF**(흰색·파란색 금지).

| 파일 | 내용 |
|---|---|
| `bg-sky.webp` | 어두운 남색 밤하늘(위 #1d1b4a→아래 #2d2a6e), 옅은 달, 작은 별, 아주 옅은 구름. 대비 낮게. 캐릭터·UI·땅 없음 |
| `cloud-a/b.webp` | 크림색 부드러운 구름(가로로 넓은 것, 작은 퍼프) |
| `star.webp` | 통통한 광택 금색 별, 얼굴 없음 |
| `acorn.webp` | 광택 갈색 도토리(질감 있는 모자, 작은 잎) |
| `bramble.webp` | 밤송이: 올리브·갈색, 사방으로 뻗은 날카로운 가시, 중앙에 화난 작은 눈 |
| `storm.webp` | 슬레이트 블루·보라의 심술 구름, 아래 번개 |
| `island.webp` | 옆에서 본 떠 있는 숲 섬: 이끼 윗면, 그루터기·버섯, 뿌리 달린 바위 밑면 |
| `tori-*.webp` | toss 브랜치와 동일(전신 포즈 5종, 마젠타 키잉) |

폰트: Fredoka(OFL) `src/app/fonts/Fredoka.woff2` (라틴 서브셋, 가변 600–700).
