#!/usr/bin/env node
// 배포 라우트 회귀 게이트 — 린트/빌드가 라우트를 "조용히" 떨구면(과거 2회 발생: prefer-const
// 린트 에러로 정적 export 중단 → out/ 스테일) 배포 전 하드 실패시킨다.
// registry.ts의 게임 slug 전부 + 허브 라우트가 out/에 실제 생성됐는지 대조한다.
import { readFileSync, existsSync } from 'node:fs'

const reg = readFileSync('src/lib/games/registry.ts', 'utf8')
// gamePages 항목의 `slug: 'xxx',` 를 추출(들여쓰기된 slug 필드).
const slugs = [...reg.matchAll(/^\s*slug:\s*'([a-z0-9-]+)',/gm)].map((m) => m[1])
const uniq = [...new Set(slugs)]

// 정규식이 깨져 슬러그를 못 잡으면(리팩터로 포맷 변경 등) 조용히 통과하지 않게 하한 가드.
if (uniq.length < 60) {
  console.error(`route-check FAILED — registry에서 게임 slug ${uniq.length}개만 파싱됨(정규식 확인 필요)`)
  process.exit(1)
}

const has = (p) => existsSync(`out/${p}.html`) || existsSync(`out/${p}/index.html`)

const missing = []
for (const s of uniq) if (!has(s)) missing.push(s)

// 컬렉션 라우트도 대조(collections.ts의 키에서 추출).
const col = readFileSync('src/lib/games/collections.ts', 'utf8')
const colSlugs = [...col.matchAll(/^\s*'([a-z0-9-]+)':\s*\{$/gm)].map((m) => m[1])

// 허브/랜딩 라우트(SSG)도 함께 지킨다.
const hubs = [
  'category/puzzle',
  'category/arcade',
  'category/classic',
  'category/skill',
  'daily',
  'collections',
  'unblocked',
  ...colSlugs.map((s) => `collection/${s}`),
]
for (const h of hubs) if (!has(h)) missing.push(h)

if (missing.length) {
  console.error(`route-check FAILED — out/에서 ${missing.length}개 라우트 누락:`)
  for (const m of missing) console.error(`  - /${m}`)
  console.error('(정적 export가 라우트를 떨궜을 수 있음 — `rm -rf .next out && pnpm build`로 재확인)')
  process.exit(1)
}

console.log(`route-check OK — 게임 ${uniq.length}개 + 허브 ${hubs.length}개 라우트 모두 out/에 존재`)
