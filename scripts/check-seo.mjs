#!/usr/bin/env node
// SEO·공유 미리보기 회귀 게이트(빌드 뒤 out/ 검사). 교정은 검사로(SESSION-GUIDE 스승님 원칙) — 11-20 감사에서
// 홈 <title>이 이력 내내 브랜드명뿐, 홈 JSON-LD 0, 정책 4쪽이 홈 설명을 그대로 씀, 일부 쪽 og:site_name 누락을 찾았다.
// 색인 대상(noindex 아님) HTML마다: title(브랜드만 금지·중복 금지)·description(중복 금지)·canonical(자기 경로)·
// h1 정확히 1개·JSON-LD 파싱·og:image(파일 존재)·og:site_name·twitter:card 큰 카드. 홈은 WebSite 마크업(name = 브랜드) 1개.
// 수정 전 main(63fa1be) 빌드에 돌리면 36건 실패했다(가이드 22편 og:image 없음, 홈 브랜드만 title 등).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { titleLengthWarnings } from './checks/seo-title.mjs'

const OUT = 'out'
const BRAND = 'Quick MiniGames'
const ORIGIN = 'https://quickminigames.site'

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

function htmlFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) htmlFiles(p, acc)
    else if (name.endsWith('.html')) acc.push(p)
  }
  return acc
}

if (!existsSync(OUT)) {
  console.error('check-seo: out/ 없음 — pnpm build 뒤에 돌린다')
  process.exit(1)
}

const errors = []
const titles = new Map()
const descs = new Map()
const titleList = []
let indexable = 0

for (const file of htmlFiles(OUT)) {
  const html = readFileSync(file, 'utf8')
  const rel = '/' + path.relative(OUT, file).replace(/\\/g, '/')
  const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? ''
  if (/noindex/.test(robots)) continue
  // Next 내부 산출물(_not-found 등)은 건너뛴다
  if (rel.startsWith('/_')) continue
  indexable++
  const err = (m) => errors.push(`${rel}: ${m}`)

  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '')
  if (!title) err('title 없음')
  else if (title.trim() === BRAND) err('title이 브랜드명뿐')
  else titles.set(title, [...(titles.get(title) ?? []), rel])

  if (title) titleList.push([rel, title])
  const desc = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '')
  if (!desc) err('description 없음')
  else descs.set(desc, [...(descs.get(desc) ?? []), rel])

  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1]
  const expected = rel === '/index.html' ? [ORIGIN, `${ORIGIN}/`] : [`${ORIGIN}${rel.replace(/\.html$/, '').replace(/\/index$/, '')}`]
  if (!canonical) err('canonical 없음')
  else if (!expected.includes(canonical)) err(`canonical ${canonical} ≠ ${expected[0]}`)

  const h1 = (html.match(/<h1[\s>]/g) ?? []).length
  if (h1 !== 1) err(`h1 ${h1}개`)

  const ogImg = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
  if (!ogImg) err('og:image 없음')
  else {
    // 카드 파일이 실제로 빌드됐나(슬러그 오타·없는 게임 → 깨진 미리보기)
    const p = ogImg.replace(ORIGIN, '').split('?')[0]
    if (!existsSync(path.join(OUT, p))) err(`og:image 파일 없음 ${p}`)
  }
  const card = html.match(/<meta name="twitter:card" content="([^"]*)"/)?.[1]
  if (card !== 'summary_large_image') err(`twitter:card ${card ?? '없음'}(summary_large_image여야 — 빠지면 작은 정사각 카드)`)
  if (!new RegExp(`<meta property="og:site_name" content="${BRAND}"`).test(html)) err('og:site_name 없음/다름')

  const types = []
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1])
      for (const node of Array.isArray(j) ? j : (j['@graph'] ?? [j])) types.push(node)
    } catch (e) {
      err(`JSON-LD 파싱 실패: ${e.message}`)
    }
  }
  if (rel === '/index.html') {
    const sites = types.filter((n) => n['@type'] === 'WebSite')
    if (sites.length !== 1) err(`홈 WebSite 마크업 ${sites.length}개(1개여야)`)
    else if (sites[0].name !== BRAND) err(`WebSite.name "${sites[0].name}" ≠ ${BRAND}`)
  } else if (types.some((n) => n['@type'] === 'WebSite')) err('WebSite 마크업은 홈에만')
}

for (const [t, pages] of titles) if (pages.length > 1) errors.push(`title 중복 "${t}": ${pages.join(', ')}`)
for (const [d, pages] of descs) if (pages.length > 1) errors.push(`description 중복 "${d.slice(0, 50)}…": ${pages.join(', ')}`)

if (indexable < 100) errors.push(`색인 대상 HTML ${indexable}개뿐(빌드 확인)`)

const warnings = titleLengthWarnings(titleList)
for (const w of warnings) console.warn(`check-seo 경고: ${w}`)

if (errors.length) {
  console.error(`check-seo FAILED (${errors.length}):\n` + errors.join('\n'))
  process.exit(1)
}
console.log(`check-seo OK — 색인 대상 ${indexable}쪽` + (warnings.length ? ` (title 길이 경고 ${warnings.length})` : ''))
