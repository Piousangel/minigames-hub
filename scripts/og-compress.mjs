#!/usr/bin/env node
// 빌드 뒤 공유 카드(OG PNG) 압축 + 크기 게이트.
// next/og(ImageResponse)는 무손실 PNG만 낸다 — 키아트·표지 그림을 깐 카드는 465~700KB였다(11-20 실측).
// Bluesky 링크 카드 썸네일 한도 약 1MB(추정)·작은 썸네일 로딩을 위해 팔레트 PNG(256색, 디더링)로 다시 쓴다.
// 크기·확장자·URL은 그대로(og:image:width/height 1200×630, _headers의 image/png 유지).
// 예산: 장당 300KB 목표, 400KB 넘으면 실패(exit 1) — 큰 그림을 새로 깔면 여기서 걸린다.
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const OUT = 'out'
const LIMIT = 400 * 1024

function find(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) find(p, acc)
    else if (name === 'opengraph-image') acc.push(p)
  }
  return acc
}

if (!existsSync(OUT)) {
  console.error('og-compress: out/ 없음 — next build 뒤에 돌린다')
  process.exit(1)
}
const files = find(OUT)
let before = 0
let after = 0
const over = []
for (const f of files) {
  const size0 = statSync(f).size
  const buf = await sharp(f).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9, dither: 1 }).toBuffer()
  const final = buf.length < size0 ? buf : null
  if (final) writeFileSync(f, final)
  const size1 = final ? final.length : size0
  before += size0
  after += size1
  if (size1 > LIMIT) over.push(`${f} ${Math.round(size1 / 1024)}KB`)
}
console.log(`og-compress: ${files.length}장 ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB`)
if (files.length < 60) {
  console.error(`og-compress FAILED — 공유 카드가 ${files.length}장뿐(게임별 opengraph-image 생성 확인)`)
  process.exit(1)
}
if (over.length) {
  console.error(`og-compress FAILED — 400KB 초과:\n${over.join('\n')}`)
  process.exit(1)
}
