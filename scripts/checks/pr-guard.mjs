#!/usr/bin/env node
// PR 가드(운영안 v2, docs/team/SHIFT.md 4장·5장) — .github/workflows/pr-guard.yml이 부른다.
//   node scripts/checks/pr-guard.mjs high-risk <PR번호>  → 고위험 경로면 `high-risk` 라벨을 붙이고,
//        `high-risk`인데 `owner-ok`·`team-2review` 라벨도 승인 리뷰 2개도 없으면 exit 1(머지 차단 표시. 필수 체크 지정은 오너 몫)
//   node scripts/checks/pr-guard.mjs overlap <PR번호>    → 다른 열린 PR과 같은 파일을 바꾸면 경고 코멘트(exit 0)
// 판정 로직은 순수 함수(classifyHighRisk·gateDecision·findOverlaps)로 두고 테스트한다. gh CLI와 GH_TOKEN·GITHUB_REPOSITORY가 필요하다.
// 같은 파일이 minigames-hub·sandlab 두 저장소에 있다(규칙은 두 저장소의 경로 합집합).

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const HIGH_RISK_LABEL = 'high-risk'
export const OWNER_OK_LABEL = 'owner-ok'
/** 팀 내부 2중 리뷰(D-1124-02): 리뷰 루틴이 서로 다른 리뷰 2회를 PR 코멘트로 남긴 뒤 붙인다. owner-ok와 같은 효력. */
export const TEAM_2REVIEW_LABEL = 'team-2review'
export const OVERLAP_MARKER = '<!-- pr-guard:overlap -->'

/** 경로만 보고 고위험인 것. [정규식, 이유] */
const PATH_RULES = [
  [/^\.claude\/(?!handoff\/)/, '.claude/ 설정·에이전트·스킬(루틴 동작이 바뀐다)'],
  [/^scripts\/hooks\//, 'scripts/hooks/ (Claude Code hook)'],
  [/^\.github\/workflows\/deploy[^/]*\.ya?ml$/, '배포 워크플로'],
  [/^wrangler\.(jsonc?|toml)$/, 'wrangler 설정'],
  [/^(db\/|migrations\/)/, 'D1 schema·migrations'],
  [/^schema\.sql$/, 'D1 schema'],
]

const TEST_RE = /(\.test\.|\.spec\.|^e2e\/|__tests__\/)/

/** 바뀐 줄 내용으로 고위험인 것. file 조건 + 줄 조건(added/removed). */
const CONTENT_RULES = [
  { file: /^(src|worker)\//, line: /localStorage|sessionStorage|STORAGE_KEY|storageKey/, sides: ['+', '-'], why: '저장 형식(브라우저 저장 키)' },
  { file: /^src\//, line: /\b(ADS_ENABLED|adsenseEnabled)\b/, sides: ['+', '-'], why: '광고 켜기·위치' },
  { file: /^src\/lib\/games\/registry\.ts$/, line: /\bslug\s*:/, sides: ['-'], why: 'slug 목록(기존 slug 변경·삭제)' },
  { file: /^src\/lib\/spill\/levels\//, line: /\bid\s*:\s*['"`]/, sides: ['-'], why: '레벨 id 목록(기존 id 변경·삭제)' },
]

/**
 * @param {{filename: string, previous_filename?: string, patch?: string}[]} files  GitHub PR files API 형식
 * @returns {string[]} 고위험 이유(`파일 — 이유`), 없으면 빈 배열
 */
export function classifyHighRisk(files) {
  const reasons = new Set()
  for (const f of files) {
    const names = [f.filename, f.previous_filename].filter(Boolean)
    for (const name of names) {
      for (const [re, why] of PATH_RULES) if (re.test(name)) reasons.add(`${name} — ${why}`)
    }
    if (TEST_RE.test(f.filename) || !f.patch) continue
    const changed = f.patch.split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l))
    for (const rule of CONTENT_RULES) {
      if (!rule.file.test(f.filename)) continue
      if (changed.some((l) => rule.sides.includes(l[0]) && rule.line.test(l.slice(1)))) reasons.add(`${f.filename} — ${rule.why}`)
    }
  }
  return [...reasons].sort()
}

/**
 * 고위험 머지 관문. reviews = [{author, state, submittedAt}] — 리뷰어마다 마지막 상태만 센다.
 * @returns {{ok: boolean, why: string}}
 */
export function gateDecision({ labels, reviews }) {
  const names = new Set(labels)
  if (!names.has(HIGH_RISK_LABEL)) return { ok: true, why: 'high-risk 아님' }
  if (names.has(OWNER_OK_LABEL)) return { ok: true, why: 'owner-ok 라벨' }
  if (names.has(TEAM_2REVIEW_LABEL)) return { ok: true, why: 'team-2review 라벨(팀 내부 2중 리뷰)' }
  const last = new Map()
  for (const r of [...reviews].sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)))) {
    if (r.state === 'COMMENTED' || r.state === 'PENDING') continue // 코멘트는 승인 상태를 바꾸지 않는다
    last.set(r.author, r.state)
  }
  const approvals = [...last.values()].filter((s) => s === 'APPROVED').length
  if (approvals >= 2) return { ok: true, why: `승인 리뷰 ${approvals}개` }
  return { ok: false, why: `high-risk인데 owner-ok·team-2review 라벨도 승인 리뷰 2개도 없다(승인 ${approvals}개). 서로 다른 독립 리뷰 2회를 PR 코멘트로 남긴 뒤 리뷰 루틴이 team-2review를 붙인다` }
}

const DOC_RE = /(\.md$|^docs\/|^decisions\/)/

/**
 * @param {string[]} mine  이 PR이 바꾼 파일
 * @param {{number: number, title: string, files: string[]}[]} others  다른 열린 PR
 * @returns {{number: number, title: string, files: string[]}[]} 겹치는 PR과 파일(문서 제외)
 */
export function findOverlaps(mine, others, { excludeDocs = true } = {}) {
  const keep = (f) => !(excludeDocs && DOC_RE.test(f))
  const set = new Set(mine.filter(keep))
  return others
    .map((o) => ({ number: o.number, title: o.title, files: o.files.filter((f) => keep(f) && set.has(f)).sort() }))
    .filter((o) => o.files.length > 0)
    .sort((a, b) => a.number - b.number)
}

export function overlapComment(overlaps) {
  if (!overlaps.length) return `${OVERLAP_MARKER}\n✓ 지금은 다른 열린 PR과 같은 코드 파일을 바꾸지 않는다(문서 제외).`
  const lines = overlaps.map((o) => `- #${o.number} ${o.title}: ${o.files.map((f) => `\`${f}\``).join(', ')}`)
  return `${OVERLAP_MARKER}\n⚠️ **열린 PR과 같은 파일을 바꾼다**(문서 제외) — 이어받거나, 먼저 머지될 PR을 기다리거나, 다른 카드를 고른다(SHIFT 5장).\n${lines.join('\n')}`
}

// ---------------------------------------------------------------- gh 호출(Actions)

function gh(args, { json = true } = {}) {
  const out = execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return json ? JSON.parse(out) : out
}

function repo() {
  const r = process.env.GITHUB_REPOSITORY
  if (!r) throw new Error('GITHUB_REPOSITORY가 없다')
  return r
}

/** PR 파일 목록(patch 포함). --paginate는 페이지마다 배열을 이어 붙이므로 --slurp 없이 jq로 한 줄씩 받는다. */
function prFiles(n) {
  const out = gh(['api', '--paginate', `repos/${repo()}/pulls/${n}/files`, '--jq', '.[] | {filename, previous_filename, patch} | @json'], { json: false })
  return out.split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

function cmdHighRisk(n) {
  const reasons = classifyHighRisk(prFiles(n))
  const view = gh(['pr', 'view', String(n), '-R', repo(), '--json', 'labels,reviews'])
  const labels = view.labels.map((l) => l.name)
  if (reasons.length) {
    console.log(`고위험 경로 ${reasons.length}건:\n${reasons.map((r) => `  - ${r}`).join('\n')}`)
    if (!labels.includes(HIGH_RISK_LABEL)) {
      gh(['pr', 'edit', String(n), '-R', repo(), '--add-label', HIGH_RISK_LABEL], { json: false })
      labels.push(HIGH_RISK_LABEL)
      console.log(`'${HIGH_RISK_LABEL}' 라벨을 붙였다`)
    }
  } else console.log('고위험 경로 없음')
  const reviews = view.reviews.map((r) => ({ author: r.author?.login ?? '?', state: r.state, submittedAt: r.submittedAt }))
  const gate = gateDecision({ labels, reviews })
  console.log(`관문: ${gate.ok ? '통과' : '실패'} — ${gate.why}`)
  if (!gate.ok) process.exit(1)
}

function cmdOverlap(n) {
  const mine = prFiles(n).flatMap((f) => [f.filename, f.previous_filename].filter(Boolean))
  const open = gh(['pr', 'list', '-R', repo(), '--state', 'open', '--limit', '50', '--json', 'number,title'])
  const others = open
    .filter((p) => p.number !== n)
    .map((p) => ({ ...p, files: gh(['pr', 'view', String(p.number), '-R', repo(), '--json', 'files']).files.map((f) => f.path) }))
  const overlaps = findOverlaps(mine, others)
  const body = overlapComment(overlaps)
  console.log(body)
  const comments = gh(['api', '--paginate', `repos/${repo()}/issues/${n}/comments`, '--jq', '.[] | {id, body} | @json'], { json: false })
    .split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const prev = comments.find((c) => c.body.includes(OVERLAP_MARKER))
  if (prev) {
    if (prev.body !== body) gh(['api', '-X', 'PATCH', `repos/${repo()}/issues/comments/${prev.id}`, '-f', `body=${body}`])
  } else if (overlaps.length) {
    gh(['api', '-X', 'POST', `repos/${repo()}/issues/${n}/comments`, '-f', `body=${body}`])
  }
  if (overlaps.length) console.log(`::warning::열린 PR ${overlaps.map((o) => `#${o.number}`).join(' ')}과 같은 파일을 바꾼다`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [cmd, num] = process.argv.slice(2)
  const n = Number(num)
  if (!Number.isInteger(n) || n <= 0) {
    console.error('사용법: pr-guard.mjs high-risk|overlap <PR번호>')
    process.exit(2)
  }
  if (cmd === 'high-risk') cmdHighRisk(n)
  else if (cmd === 'overlap') cmdOverlap(n)
  else {
    console.error(`알 수 없는 명령: ${cmd}`)
    process.exit(2)
  }
}
