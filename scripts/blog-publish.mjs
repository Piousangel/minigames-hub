#!/usr/bin/env node
// 주간 블로그 발행기. 마케터가 PR에 넣은 docs/marketing/blog/<YYYY-MM-DD>-<slug>/ 를 main 머지 후 Actions가 처리한다.
//  1) shots.json 에 적힌 실사이트 화면을 Playwright로 캡처해 같은 폴더에 PNG로 저장(에이전트는 실사이트 접근 불가라 여기서 찍는다)
//  2) 본문의 {{img:파일명}} 을 공개 raw URL로 바꿔 velog.ready.md(사람이 velog에 붙여넣을 최종본)를 만든다
//  3) devto.md 가 있으면 dev.to API로 게시(DEVTO_API_KEY 필요, 없으면 skipped)
// 결과는 docs/marketing/blog/posted.json 원장. 최근 7일 폴더만, 이미 게시된 것은 다시 안 올린다.
//
// 폴더 구성:
//   shots.json  [{ "url": "https://...", "file": "01-home.png", "width": 390, "height": 844, "waitMs": 1500, "fullPage": false }]
//   velog.md    한국어 원고(첫 줄 '# 제목'), 이미지 {{img:01-home.png}}
//   devto.md    영어 원고, 맨 위 front matter: title, description, tags(최대 4개, 쉼표), 이미지 {{img:...}}
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'docs/marketing/blog'
const LEDGER = join(ROOT, 'posted.json')
const REPO = process.env.GITHUB_REPOSITORY // owner/name (Actions가 넣어줌)
const BRANCH = 'main'
const stage = process.argv[2] ?? 'all' // shots | publish | all

const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : []
const recent = (name) => {
  const d = Date.parse(name.slice(0, 10))
  return Number.isFinite(d) && Date.now() - d < 7 * 86400e3 && Date.now() - d > -2 * 86400e3
}
const dirs = existsSync(ROOT)
  ? readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}-/.test(d.name) && recent(d.name)).map((d) => d.name)
  : []

const rawUrl = (dir, file) => `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${ROOT}/${dir}/${file}`
const fillImages = (text, dir) => text.replace(/\{\{img:([\w.-]+)\}\}/g, (_, f) => rawUrl(dir, f))

async function captureShots() {
  const need = dirs.filter((d) => {
    const p = join(ROOT, d, 'shots.json')
    return existsSync(p) && JSON.parse(readFileSync(p, 'utf8')).some((s) => !existsSync(join(ROOT, d, s.file)))
  })
  if (!need.length) return console.log('캡처할 화면 없음')
  const require = createRequire(join(process.env.PW_DIR ?? process.cwd(), 'noop.js'))
  const { chromium } = require('playwright')
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) // 로컬 테스트용: PW_CHANNEL=chrome
  for (const d of need) {
    for (const s of JSON.parse(readFileSync(join(ROOT, d, 'shots.json'), 'utf8'))) {
      const out = join(ROOT, d, s.file)
      if (existsSync(out)) continue
      const page = await browser.newPage({ viewport: { width: s.width ?? 1280, height: s.height ?? 800 }, deviceScaleFactor: 2 })
      try {
        await page.goto(s.url, { waitUntil: 'networkidle', timeout: 45_000 })
        await page.waitForTimeout(s.waitMs ?? 1500)
        await page.screenshot({ path: out, fullPage: !!s.fullPage })
        console.log(`캡처 ${d}/${s.file} ← ${s.url}`)
      } catch (e) {
        console.log(`캡처 실패 ${d}/${s.file}: ${String(e.message).slice(0, 150)}`)
      } finally {
        await page.close()
      }
    }
  }
  await browser.close()
}

function frontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return { meta: {}, body: md }
  const meta = Object.fromEntries(
    m[1].split('\n').filter((l) => l.includes(':')).map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '')]),
  )
  return { meta, body: md.slice(m[0].length) }
}

async function publish() {
  let changed = false
  for (const d of dirs) {
    // velog 최종본(사람이 붙여넣기)
    const vp = join(ROOT, d, 'velog.md')
    if (existsSync(vp)) {
      const ready = fillImages(readFileSync(vp, 'utf8'), d)
      const rp = join(ROOT, d, 'velog.ready.md')
      if (!existsSync(rp) || readFileSync(rp, 'utf8') !== ready) {
        writeFileSync(rp, ready)
        changed = true
      }
    }
    // dev.to 자동 게시
    const dp = join(ROOT, d, 'devto.md')
    if (!existsSync(dp)) continue
    const id = `${d}#devto`
    if (ledger.some((e) => e.id === id && e.status === 'posted')) continue
    const entry = { id, at: new Date().toISOString() }
    const { meta, body } = frontMatter(readFileSync(dp, 'utf8'))
    if (!process.env.DEVTO_API_KEY) entry.status = 'skipped-no-credentials'
    else if (!meta.title) entry.status = 'error-no-title'
    else {
      const res = await fetch('https://dev.to/api/articles', {
        method: 'POST',
        headers: { 'api-key': process.env.DEVTO_API_KEY, 'content-type': 'application/json', accept: 'application/vnd.forem.api-v1+json' },
        body: JSON.stringify({
          article: {
            title: meta.title,
            description: meta.description,
            tags: (meta.tags ?? '').split(',').map((t) => t.trim().toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean).slice(0, 4),
            body_markdown: fillImages(body, d),
            published: true,
          },
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.url) Object.assign(entry, { status: 'posted', link: j.url, ref: j.id })
      else Object.assign(entry, { status: 'error', error: `${res.status} ${JSON.stringify(j).slice(0, 200)}` })
    }
    console.log(`${id}: ${entry.status}${entry.link ? ' ' + entry.link : ''}${entry.error ? ' ' + entry.error : ''}`)
    const i = ledger.findIndex((e) => e.id === id)
    if (i >= 0) ledger[i] = entry
    else ledger.push(entry)
    changed = true
  }
  if (changed) writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n')
}

if (stage === 'shots' || stage === 'all') await captureShots()
if (stage === 'publish' || stage === 'all') await publish()
process.exit(0)
