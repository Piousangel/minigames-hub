# 공유 카드(OG) 빌드 전용 사본

`src/lib/og/gardenCard.tsx`가 빌드 때 읽는다. 사용자에게 내려가지 않는다(public 아님). Satori(next/og)가 webp·woff2·가변 글꼴을 못 읽어서 따로 둔다.

| 파일 | 원본 | 만드는 법 |
|---|---|---|
| `home-bg.jpg` | `public/art/hub-og-bg.webp` | sharp `resize(1200,630,{fit:'cover',position:'right'}).jpeg({quality:82,mozjpeg:true})` |
| `cover-<slug>.jpg` | `public/art/<slug>-cover.webp` | sharp `resize(1200,630,{fit:'cover'}).jpeg({quality:80,mozjpeg:true})` |
| `mallang·tori·haessi·bomi.png` | `public/art/<name>-idle.webp` | sharp `resize(220,220,{fit:'contain'}).png({palette:true})` |
| `brand-mark.png` | `docs/design/brand-3/final/mark-760.webp` | `python3 scripts/brand-icons.py`(`src/brand/icon-96.png`와 같은 96px 원형 크롭, 표시 48px — 테스트가 두 파일이 같은지 대조) |
| `Fraunces-600.ttf`, `Figtree-600/800.ttf` | `src/app/fonts/*.woff2` | fontTools: Figtree는 `instancer`로 wght 고정, 둘 다 U+0020–007E·—–’‘“”·…·NBSP 부분집합 |

표지를 새로 단 게임은 `COVER_SLUGS`와 이 폴더에 사본을 같이 넣는다(`gardenCard.test.ts`가 대조). 빌드 뒤 `scripts/og-compress.mjs`가 카드를 팔레트 PNG로 줄이고 장당 400KB를 넘으면 실패시킨다.
