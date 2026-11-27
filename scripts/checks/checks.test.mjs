// 운영안 v2 결정적 검사(scripts/checks/)의 테스트. 일부러 상한을 넘는 입력으로 '실패해야 할 때 실패'하는지 본다.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LIMITS, checkBudget, findModelNames, run } from './docs-budget.mjs'
import { parseOwnerReply, validateOpenDecisions } from './decisions.mjs'
import { classifyHighRisk, findOverlaps, gateDecision, overlapComment, OVERLAP_MARKER } from './pr-guard.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function fakeRepo(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'docs-budget-'))
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    writeFileSync(path.join(dir, rel), text)
  }
  return dir
}
const base = { 'CLAUDE.md': 'c\n', 'docs/team/SHIFT.md': 's\n', 'docs/team/NORTH-STAR.md': 'n\n', 'HANDOFF.md': 'h\n' }

describe('docs-budget: 필독 세트·인계 상한·모델명', () => {
  it('이 저장소는 통과한다(필독 ≤30KB, 인계 ≤10KB·150줄, 지시 문서에 모델명 없음)', () => {
    const { sizes, errors } = run(ROOT)
    expect(errors).toEqual([])
    expect(sizes.reduce((s, x) => s + x.bytes, 0)).toBeLessThanOrEqual(LIMITS.mustReadBytes)
  })

  it('필독 합계가 상한을 넘으면 실패한다', () => {
    const dir = fakeRepo({ ...base, 'docs/team/SHIFT.md': '가'.repeat(11_000) }) // 33,000B
    expect(run(dir).errors.join('\n')).toMatch(/필독 세트 합계 \d+B > 상한/)
  })

  it('인계가 바이트·줄 상한을 넘으면 실패한다', () => {
    const big = fakeRepo({ ...base, 'HANDOFF.md': 'x'.repeat(LIMITS.handoffBytes + 1) })
    expect(run(big).errors.join('\n')).toMatch(/인계 HANDOFF\.md \d+B > 상한/)
    const long = fakeRepo({ ...base, 'HANDOFF.md': '줄\n'.repeat(LIMITS.handoffLines + 1) })
    expect(run(long).errors.join('\n')).toMatch(/151줄 > 상한 150줄/)
  })

  it('샌드랩 인계 경로(.claude/handoff/main.md)를 쓴다', () => {
    const rest = { ...base }
    delete rest['HANDOFF.md']
    const dir = fakeRepo({ ...rest, '.claude/handoff/main.md': 'y'.repeat(LIMITS.handoffBytes + 5) })
    expect(run(dir).errors.join('\n')).toMatch(/\.claude\/handoff\/main\.md/)
  })

  it('필독 파일이 없으면 실패한다', () => {
    const rest = { ...base }
    delete rest['docs/team/SHIFT.md']
    expect(run(fakeRepo(rest)).errors.join('\n')).toMatch(/SHIFT\.md이 없다/)
  })

  it('지시 문서의 모델명을 잡고, agents·archive는 보지 않는다', () => {
    expect(findModelNames('공저자 Claude Sonnet 5.5\nOpus4 설계')).toEqual([
      { line: 1, match: 'Sonnet 5' },
      { line: 2, match: 'Opus4' },
    ])
    expect(findModelNames('Haiku는 단순 확인, sonnet 별칭은 허용')).toEqual([])
    const dir = fakeRepo({
      ...base,
      'docs/team/routines/work.md': 'model: Haiku 4.5\n',
      '.claude/agents/checker.md': 'model: Haiku 4.5\n',
      'docs/archive/old.md': 'Sonnet 5.5\n',
    })
    const errs = run(dir).errors
    expect(errs).toHaveLength(1)
    expect(errs[0]).toMatch(/docs\/team\/routines\/work\.md:1 모델명/)
  })

  it('checkBudget 순수 판정', () => {
    const ok = [{ file: 'HANDOFF.md', bytes: 100, lines: 3 }]
    expect(checkBudget(ok, 'HANDOFF.md')).toEqual([])
    expect(checkBudget(ok, 'HANDOFF.md', { mustReadBytes: 50, handoffBytes: 1000, handoffLines: 10 })).toHaveLength(1)
  })
})

describe('decisions: open.json 스키마와 오너 답 형식', () => {
  const good = {
    id: 'D-1124-03', site: 'hub', title: '말랑 홍보 재개', options: ['재개', '보류 유지'], default: 2,
    deadline: '2026-11-25T20:00+09:00', reversible: true, highRisk: false, reason: '7일 완료율 근거', status: 'open', answer: null,
  }

  it('저장소의 decisions/open.json이 통과한다', () => {
    expect(validateOpenDecisions(JSON.parse(readFileSync(path.join(ROOT, 'decisions/open.json'), 'utf8')))).toEqual([])
  })

  it('올바른 항목은 통과, 틀린 항목은 이유와 함께 실패', () => {
    expect(validateOpenDecisions({ version: 1, decisions: [good] })).toEqual([])
    const bad = validateOpenDecisions({
      version: 1,
      decisions: [
        { ...good, id: 'D-1324-01' },
        { ...good, options: ['a', 'b', 'c', 'd'] },
        { ...good, status: 'answered', answer: null },
        { ...good, id: 'D-1124-04', status: 'defaulted', highRisk: true },
        good,
        good,
      ],
    }).join('\n')
    expect(bad).toMatch(/id는 D-MMDD-NN/)
    expect(bad).toMatch(/options는 비지 않은 문자열 1~3개/)
    expect(bad).toMatch(/answered면 answer/)
    expect(bad).toMatch(/defaulted\)은 되돌릴 수 있고 high-risk가 아닐 때만/)
    expect(bad).toMatch(/id 중복/)
    expect(validateOpenDecisions([])).toEqual(['최상위가 객체가 아니다'])
  })

  it('오너 답은 `D-MMDD-NN: <번호>`만 인정한다', () => {
    expect(parseOwnerReply('D-1124-03: 2')).toEqual({ id: 'D-1124-03', choice: 2 })
    expect(parseOwnerReply('  D-1124-03:1 ')).toEqual({ id: 'D-1124-03', choice: 1 })
    for (const no of ['2', '2번', 'D-1124-03 2', 'd-1124-03: 2', 'D-1124-03: 2 좋아요', 'D-1124-3: 2', 'D-1132-01: 1', '좋아 D-1124-03: 2']) {
      expect(parseOwnerReply(no), no).toBeNull()
    }
  })
})

describe('pr-guard: 고위험 분류·관문·겹침', () => {
  it('고위험 경로를 잡고 인계 폴더·일반 코드는 통과시킨다', () => {
    const r = classifyHighRisk([
      { filename: '.claude/settings.json' },
      { filename: '.claude/handoff/main.md' },
      { filename: 'scripts/hooks/guard-bash.mjs' },
      { filename: '.github/workflows/deploy.yml' },
      { filename: '.github/workflows/ci.yml' },
      { filename: 'wrangler.jsonc' },
      { filename: 'migrations/0003_x.sql' },
      { filename: 'db/schema.sql' },
      { filename: 'src/app/page.tsx', patch: '@@\n+const a = 1' },
    ])
    expect(r).toEqual([
      '.claude/settings.json — .claude/ 설정·에이전트·스킬(루틴 동작이 바뀐다)',
      '.github/workflows/deploy.yml — 배포 워크플로',
      'db/schema.sql — D1 schema·migrations',
      'migrations/0003_x.sql — D1 schema·migrations',
      'scripts/hooks/guard-bash.mjs — scripts/hooks/ (Claude Code hook)',
      'wrangler.jsonc — wrangler 설정',
    ])
  })

  it('바뀐 줄 내용으로 저장 키·광고·slug/레벨 id 삭제를 잡는다(추가만은 통과, 테스트 파일 제외)', () => {
    const r = classifyHighRisk([
      { filename: 'src/lib/bestScore.ts', patch: "@@\n-const KEY = 'best:'\n+localStorage.setItem(k, v)" },
      { filename: 'src/lib/ads/config.ts', patch: '@@\n-export const ADS_ENABLED = false\n+export const ADS_ENABLED = true' },
      { filename: 'src/lib/games/registry.ts', patch: "@@\n-  { slug: 'snake' },\n+  { slug: 'snake-2' }," },
      { filename: 'src/lib/spill/levels/w1/index.ts', patch: "@@\n+  { id: '1-11' }," },
      { filename: 'src/lib/bestScore.test.ts', patch: '@@\n+localStorage.clear()' },
    ])
    expect(r).toEqual([
      'src/lib/ads/config.ts — 광고 켜기·위치',
      'src/lib/bestScore.ts — 저장 형식(브라우저 저장 키)',
      'src/lib/games/registry.ts — slug 목록(기존 slug 변경·삭제)',
    ])
    expect(classifyHighRisk([{ filename: 'src/lib/spill/levels/w1/index.ts', patch: "@@\n-  { id: '1-3' }," }])).toEqual([
      'src/lib/spill/levels/w1/index.ts — 레벨 id 목록(기존 id 변경·삭제)',
    ])
    expect(classifyHighRisk([{ filename: 'scripts/checks/pr-guard.mjs' }, { filename: '.github/workflows/pr-guard.yml' }])).toHaveLength(2)
    expect(classifyHighRisk([{ filename: 'docs/x.md', previous_filename: '.claude/team/charter.md' }])[0]).toMatch(/^\.claude\/team\/charter\.md/)
  })

  it('관문: high-risk면 owner-ok·team-2review 또는 리뷰어별 마지막 승인 2개가 있어야 통과', () => {
    expect(gateDecision({ labels: [], reviews: [] }).ok).toBe(true)
    expect(gateDecision({ labels: ['high-risk'], reviews: [] }).ok).toBe(false)
    expect(gateDecision({ labels: ['high-risk', 'owner-ok'], reviews: [] }).ok).toBe(true)
    expect(gateDecision({ labels: ['high-risk', 'team-2review'], reviews: [] }).ok).toBe(true)
    expect(gateDecision({ labels: ['high-risk', 'team-2review'], reviews: [] }).why).toMatch(/team-2review/)
    // 라벨 이름이 비슷해도 통과하지 못한다 — 정확히 team-2review만
    expect(gateDecision({ labels: ['high-risk', 'team-review', '2review'], reviews: [] }).ok).toBe(false)
    const t = (m) => `2026-11-24T0${m}:00:00Z`
    const two = [
      { author: 'a', state: 'APPROVED', submittedAt: t(1) },
      { author: 'b', state: 'APPROVED', submittedAt: t(2) },
    ]
    expect(gateDecision({ labels: ['high-risk'], reviews: two }).ok).toBe(true)
    // 같은 사람 승인 두 번은 1개, 나중 CHANGES_REQUESTED는 승인을 지운다, COMMENTED는 상태를 바꾸지 않는다
    expect(gateDecision({ labels: ['high-risk'], reviews: [two[0], { ...two[0], submittedAt: t(3) }] }).ok).toBe(false)
    expect(gateDecision({ labels: ['high-risk'], reviews: [...two, { author: 'b', state: 'CHANGES_REQUESTED', submittedAt: t(4) }] }).ok).toBe(false)
    expect(gateDecision({ labels: ['high-risk'], reviews: [...two, { author: 'b', state: 'COMMENTED', submittedAt: t(5) }] }).ok).toBe(true)
  })

  it('겹침: 코드 파일만 센다(문서·decisions 제외)', () => {
    const o = findOverlaps(['src/a.ts', 'HANDOFF.md', 'docs/x.png', 'decisions/open.json'], [
      { number: 7, title: 'B', files: ['src/a.ts', 'HANDOFF.md'] },
      { number: 3, title: 'A', files: ['HANDOFF.md', 'docs/x.png'] },
    ])
    expect(o).toEqual([{ number: 7, title: 'B', files: ['src/a.ts'] }])
    expect(findOverlaps(['HANDOFF.md'], [{ number: 3, title: 'A', files: ['HANDOFF.md'] }], { excludeDocs: false })).toHaveLength(1)
    expect(overlapComment(o)).toContain(OVERLAP_MARKER)
    expect(overlapComment(o)).toContain('#7 B: `src/a.ts`')
    expect(overlapComment([])).toContain('✓')
  })
})

describe('check-seo title 길이 경고 (#265)', () => {
  it('66자 title은 경고 1건, 65자·짧은 title은 0건', async () => {
    const { titleLengthWarnings } = await import('./seo-title.mjs')
    const t66 = 'x'.repeat(66)
    expect(titleLengthWarnings([['/a.html', t66]])).toHaveLength(1)
    expect(titleLengthWarnings([['/a.html', 'x'.repeat(65)], ['/b.html', 'short']])).toHaveLength(0)
  })
})
