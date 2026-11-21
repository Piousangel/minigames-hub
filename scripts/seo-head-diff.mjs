// 두 정적 빌드(out/)의 SEO 메타 비교 — 디자인만 바꾸는 PR이 SEO를 건드리지 않았다는 증거(R9).
//   node scripts/seo-head-diff.mjs <base-out> <head-out> [--json 결과.json]
// 모든 .html(게임·홈·허브 전부)에서 뽑아 비교: <title>, <meta name|property|content>(robots·description·og·twitter 등),
// <link rel=canonical|alternate>, <html lang>, JSON-LD(application/ld+json) 본문(파싱 후 정규화). 빌드 해시가 붙는 css·js 링크는 뺀다.
// 다르면 페이지·항목을 찍고 exit 1.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const [baseDir, headDir] = process.argv.slice(2)
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? (n === '_next' ? [] : walk(join(d, n))) : [join(d, n)]))
const htmlFiles = (d) => walk(d).filter((f) => f.endsWith('.html')).map((f) => relative(d, f)).sort()

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
function seo(html) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
  const out = []
  out.push(`lang=${html.match(/<html[^>]*\slang="([^"]*)"/)?.[1]}`)
  out.push(`title=${head.match(/<title>([\s\S]*?)<\/title>/)?.[1]}`)
  for (const m of head.matchAll(/<meta\b[^>]*>/g)) {
    const key = attr(m[0], 'name') ?? attr(m[0], 'property') ?? attr(m[0], 'charSet') ?? attr(m[0], 'http-equiv')
    out.push(`meta ${key}=${attr(m[0], 'content') ?? ''}`)
  }
  for (const m of head.matchAll(/<link\b[^>]*>/g)) {
    const rel = attr(m[0], 'rel')
    if (rel === 'canonical' || rel === 'alternate' || rel === 'icon' || rel === 'apple-touch-icon' || rel === 'manifest') out.push(`link ${rel}=${attr(m[0], 'href')}`)
  }
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    out.push(`ld=${JSON.stringify(JSON.parse(m[1]))}`)
  }
  return out.sort()
}

const a = htmlFiles(baseDir)
const b = htmlFiles(headDir)
const diffs = []
const onlyBase = a.filter((f) => !b.includes(f))
const onlyHead = b.filter((f) => !a.includes(f))
for (const f of a.filter((x) => b.includes(x))) {
  const sa = seo(readFileSync(join(baseDir, f), 'utf8'))
  const sb = seo(readFileSync(join(headDir, f), 'utf8'))
  const removed = sa.filter((x) => !sb.includes(x))
  const added = sb.filter((x) => !sa.includes(x))
  // 정렬한 목록 전체 비교(같은 항목의 개수 변화 — 예: JSON-LD 중복 — 도 잡는다)
  if (JSON.stringify(sa) !== JSON.stringify(sb)) diffs.push({ file: f, removed, added, countBase: sa.length, countHead: sb.length })
}
const report = { pages: a.length, compared: a.filter((x) => b.includes(x)).length, onlyBase, onlyHead, diffs }
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 2) + '\n')
console.log(`페이지 ${report.compared}개 비교 · 다른 페이지 ${diffs.length} · base만 ${onlyBase.length} · head만 ${onlyHead.length}`)
for (const d of diffs.slice(0, 20)) console.log(d.file, '\n  -', d.removed.join('\n  - '), '\n  +', d.added.join('\n  + '))
process.exit(diffs.length || onlyBase.length || onlyHead.length ? 1 : 0)
