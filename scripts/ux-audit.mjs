// 사용자 친화성 점검(docs/team/QUALITY.md 5장): 390 터치에서 페이지별 작은 누르는 영역·iOS 확대 입력(16px 미만)·가로 넘침·확대 막힘(viewport meta)·
// touch-action:none 영역(스크롤 갇힘 후보)·누름 피드백 없는 버튼 후보를 JSON으로.
// 쓰는 법: (빌드 후) npx serve out -l 3461 & → node scripts/ux-audit.mjs http://localhost:3461 [/경로 ...]
// 누르는 영역은 보이는 크기가 아니라 elementFromPoint로 잰다(.hit-44 같은 보이지 않는 확장 포함).
import { chromium } from '@playwright/test'
const base = process.argv[2] ?? 'http://localhost:3100'
const pages = process.argv.length > 3 ? process.argv.slice(3) : ['/', '/daily', '/leaderboards', '/slime-slide', '/plop-landing', '/acorn-hop', '/2048', '/snake', '/unblock', '/polarity', '/beatline', '/solitaire', '/chess']
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
const out = {}
for (const p of pages) {
  const page = await ctx.newPage()
  await page.goto(base + p, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(800)
  out[p] = await page.evaluate(() => {
    const vis = (el) => el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 0
    const label = (el) => (el.getAttribute('aria-label') || el.dataset.testid || el.textContent || el.getAttribute('href') || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    const where = (el) => (el.closest('header') ? 'header' : el.closest('footer') ? 'footer' : el.closest('[data-testid$="-board"], canvas') ? 'board' : el.closest('main') ? 'main' : 'other')
    const inlineText = (el) => el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement && /^(P|LI|SPAN|DD|TD)$/.test(el.parentElement.tagName) && el.parentElement.textContent.trim().length > el.textContent.trim().length + 10
    const small = []
    for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], summary, [role="tab"]')) {
      if (!vis(el) || inlineText(el)) continue
      el.scrollIntoView({ block: 'center', inline: 'center' })
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const hitOk = [[cx, cy - 21], [cx, cy + 21], [cx - 21, cy], [cx + 21, cy]].every(([x, y]) => {
        const h = document.elementFromPoint(x, y)
        return !!h && (h === el || el.contains(h))
      })
      if (!hitOk) small.push({ l: label(el), w: Math.round(r.width), h: Math.round(r.height), at: where(el), cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 60) })
    }
    const zoomInputs = [...document.querySelectorAll('input, select, textarea')].filter(vis).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => ({ l: label(el) || el.getAttribute('placeholder'), fs: getComputedStyle(el).fontSize }))
    const meta = document.querySelector('meta[name="viewport"]')?.getAttribute('content')
    const overflowX = document.documentElement.scrollWidth - window.innerWidth
    const noSelectCallout = [...document.querySelectorAll('*')].filter((el) => getComputedStyle(el).webkitTouchCallout === 'none').length
    const touchNone = [...document.querySelectorAll('*')].filter((el) => getComputedStyle(el).touchAction === 'none' && vis(el)).map((el) => { const r = el.getBoundingClientRect(); return `${el.tagName.toLowerCase()}${el.dataset.testid ? '#' + el.dataset.testid : ''} ${Math.round(r.width)}x${Math.round(r.height)}` })
    const noFeedback = [...document.querySelectorAll('button')].filter(vis).filter((el) => !/active:|btn-press|garden-jelly|hover:|transition/.test(el.className?.toString() ?? '')).map(label).slice(0, 12)
    return { small, zoomInputs, meta, overflowX, noSelectCallout, touchNone, noFeedback }
  })
  await page.close()
}
await browser.close()
console.log(JSON.stringify(out, null, 1))
