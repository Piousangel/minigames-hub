#!/usr/bin/env node
// 필독 세트 크기·인계 상한·지시 문서 모델명 금지 검사(운영안 v2, docs/team/SHIFT.md 0장·2장).
// 교대마다 읽는 문서가 다시 불어나는 것을 문장 대신 검사로 막는다. 같은 파일이 minigames-hub·sandlab 두 저장소에 있다.
//
//   node scripts/checks/docs-budget.mjs        → 표를 찍고, 넘으면 exit 1
//
// 필독 세트 = CLAUDE.md + docs/team/SHIFT.md + docs/team/NORTH-STAR.md + 인계(허브 HANDOFF.md, 샌드랩 .claude/handoff/main.md).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 상한(바이트). 30KB ≈ 한국어 문서 약 10k 토큰. */
export const LIMITS = {
  mustReadBytes: 30 * 1024,
  handoffBytes: 10 * 1024,
  handoffLines: 150,
}

/** 인계 파일 경로 — 샌드랩은 .claude/handoff/main.md, 허브는 HANDOFF.md. */
export function handoffPath(root) {
  const sand = '.claude/handoff/main.md'
  return existsSync(path.join(root, sand)) ? sand : 'HANDOFF.md'
}

export function mustReadFiles(root) {
  return ['CLAUDE.md', 'docs/team/SHIFT.md', 'docs/team/NORTH-STAR.md', handoffPath(root)]
}

/** 지시 문서(모델명 금지 대상): 필독 세트 + docs/team 최상위 문서 + 루틴 초안 + 스킬. .claude/agents(모델 필드 자리)·archive·기록(DECISIONS)은 제외. */
export function instructionFiles(root) {
  const out = new Set(mustReadFiles(root))
  const walk = (dir, { recursive }) => {
    const abs = path.join(root, dir)
    if (!existsSync(abs)) return
    for (const name of readdirSync(abs)) {
      const rel = path.join(dir, name)
      const st = statSync(path.join(root, rel))
      if (st.isDirectory()) {
        if (recursive) walk(rel, { recursive })
      } else if (name.endsWith('.md')) out.add(rel)
    }
  }
  walk('docs/team', { recursive: false })
  walk('docs/team/routines', { recursive: true })
  walk('.claude/skills', { recursive: true })
  return [...out].filter((f) => existsSync(path.join(root, f))).sort()
}

const MODEL_RE = /\b(Opus|Sonnet|Haiku)\s*\d/g

/** 텍스트에서 모델명(예: 'Sonnet 5.5')을 찾아 [{line, match}]로 돌려준다. */
export function findModelNames(text) {
  const hits = []
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(MODEL_RE)) hits.push({ line: i + 1, match: m[0] })
  })
  return hits
}

/**
 * 크기 판정(순수 함수). sizes = [{file, bytes, lines}], handoff = 인계 파일 이름.
 * @returns {string[]} 위반 메시지(없으면 빈 배열)
 */
export function checkBudget(sizes, handoff, limits = LIMITS) {
  const errors = []
  const total = sizes.reduce((s, x) => s + x.bytes, 0)
  if (total > limits.mustReadBytes) {
    errors.push(`필독 세트 합계 ${total}B > 상한 ${limits.mustReadBytes}B — 끝난 일은 인계에서 지우고, 규칙은 한 곳(SHIFT)에만`)
  }
  const h = sizes.find((x) => x.file === handoff)
  if (!h) errors.push(`인계 파일 ${handoff}이 없다`)
  else {
    if (h.bytes > limits.handoffBytes) errors.push(`인계 ${handoff} ${h.bytes}B > 상한 ${limits.handoffBytes}B — 이력은 docs/archive/handoff-2026-*.md로`)
    if (h.lines > limits.handoffLines) errors.push(`인계 ${handoff} ${h.lines}줄 > 상한 ${limits.handoffLines}줄`)
  }
  for (const x of sizes) if (x.missing) errors.push(`필독 파일 ${x.file}이 없다`)
  return errors
}

export function measure(root, files) {
  return files.map((file) => {
    const abs = path.join(root, file)
    if (!existsSync(abs)) return { file, bytes: 0, lines: 0, missing: true }
    const buf = readFileSync(abs)
    const text = buf.toString('utf8')
    return { file, bytes: buf.length, lines: text.split('\n').length - (text.endsWith('\n') ? 1 : 0) }
  })
}

/** 저장소 전체 검사. @returns {{sizes, errors}} */
export function run(root) {
  const handoff = handoffPath(root)
  const sizes = measure(root, mustReadFiles(root))
  const errors = checkBudget(sizes, handoff)
  for (const f of instructionFiles(root)) {
    for (const hit of findModelNames(readFileSync(path.join(root, f), 'utf8'))) {
      errors.push(`${f}:${hit.line} 모델명 '${hit.match}' — 문서에 모델명을 쓰지 않는다(루틴 설정·.claude/agents에만, 공저자 줄은 하네스 attribution)`)
    }
  }
  return { sizes, errors }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const { sizes, errors } = run(root)
  const total = sizes.reduce((s, x) => s + x.bytes, 0)
  console.log('| 필독 파일 | 바이트 | 줄 |\n|---|---:|---:|')
  for (const x of sizes) console.log(`| ${x.file} | ${x.bytes} | ${x.lines} |`)
  console.log(`| 합계 (상한 ${LIMITS.mustReadBytes}) | ${total} | |`)
  if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`)
    process.exit(1)
  }
  console.log('✓ 필독 세트·인계 상한·모델명 금지 통과')
}
