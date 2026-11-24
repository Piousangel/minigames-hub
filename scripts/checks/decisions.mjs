#!/usr/bin/env node
// decisions/open.json 스키마 검사 + 오너 답 형식 판별(운영안 v2, docs/team/SHIFT.md 8장).
// Slack에서 게시자와 오너가 같은 계정이라 '누가 답했나'로는 판별할 수 없다 → 형식 `D-MMDD-NN: <번호>` 한 줄만 답으로 인정한다.
//
//   node scripts/checks/decisions.mjs   → decisions/open.json 검사, 틀리면 exit 1
//
// 스키마(version 1):
// { "version": 1, "decisions": [ {
//     "id": "D-1124-03",            // D-MMDD-NN, 고유
//     "site": "hub" | "sandlab",
//     "title": "한 줄",
//     "options": ["…", "…"],        // 1~3개, 번호는 1부터
//     "default": 1,                 // 기본안 번호
//     "deadline": "2026-11-25T20:00+09:00",
//     "reversible": true,           // 되돌릴 수 있나
//     "highRisk": false,
//     "reason": "근거 1줄",
//     "status": "open" | "answered" | "defaulted" | "expired",
//     "answer": null | 번호,         // answered면 필수
//     "slackTs": "…"(선택), "answeredAt": "…"(선택)
// } ] }

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ID_RE = /^D-(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])-\d{2}$/
const STATUSES = new Set(['open', 'answered', 'defaulted', 'expired'])
const SITES = new Set(['hub', 'sandlab'])

/**
 * 오너 답 한 줄을 판별한다. 형식이 정확할 때만 {id, choice}, 아니면 null.
 * 허용: 'D-1124-03: 2' (콜론 뒤 공백 0~1개, 앞뒤 공백 무시). 그 밖(설명 덧붙임·'2번'·소문자 d)은 답이 아니다.
 */
export function parseOwnerReply(text) {
  const m = /^\s*(D-\d{4}-\d{2}):\s?([1-9])\s*$/.exec(String(text))
  if (!m || !ID_RE.test(m[1])) return null
  return { id: m[1], choice: Number(m[2]) }
}

/** @returns {string[]} 위반 목록(없으면 빈 배열) */
export function validateOpenDecisions(doc) {
  const errors = []
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['최상위가 객체가 아니다']
  if (doc.version !== 1) errors.push('version은 1이어야 한다')
  if (!Array.isArray(doc.decisions)) return [...errors, 'decisions는 배열이어야 한다']
  const seen = new Set()
  doc.decisions.forEach((d, i) => {
    const at = `decisions[${i}]${d && d.id ? ` (${d.id})` : ''}`
    if (!d || typeof d !== 'object') return errors.push(`${at}: 객체가 아니다`)
    if (!ID_RE.test(d.id ?? '')) errors.push(`${at}: id는 D-MMDD-NN 형식`)
    else if (seen.has(d.id)) errors.push(`${at}: id 중복`)
    else seen.add(d.id)
    if (!SITES.has(d.site)) errors.push(`${at}: site는 hub | sandlab`)
    if (typeof d.title !== 'string' || !d.title.trim()) errors.push(`${at}: title 필요`)
    const n = Array.isArray(d.options) ? d.options.length : 0
    if (n < 1 || n > 3 || !d.options.every((o) => typeof o === 'string' && o.trim())) errors.push(`${at}: options는 비지 않은 문자열 1~3개`)
    if (!Number.isInteger(d.default) || d.default < 1 || d.default > n) errors.push(`${at}: default는 1~${n || '?'} 번호`)
    if (typeof d.deadline !== 'string' || Number.isNaN(Date.parse(d.deadline))) errors.push(`${at}: deadline은 ISO 일시`)
    if (typeof d.reversible !== 'boolean') errors.push(`${at}: reversible은 true/false`)
    if (typeof d.highRisk !== 'boolean') errors.push(`${at}: highRisk는 true/false`)
    if (typeof d.reason !== 'string' || !d.reason.trim()) errors.push(`${at}: reason(근거 1줄) 필요`)
    if (!STATUSES.has(d.status)) errors.push(`${at}: status는 open | answered | defaulted | expired`)
    if (d.status === 'answered') {
      if (!Number.isInteger(d.answer) || d.answer < 1 || d.answer > n) errors.push(`${at}: answered면 answer는 1~${n || '?'} 번호`)
    } else if (d.answer != null) errors.push(`${at}: answered가 아니면 answer는 null`)
    if (d.status === 'defaulted' && (d.reversible !== true || d.highRisk !== false)) {
      errors.push(`${at}: 기본안 자동 진행(defaulted)은 되돌릴 수 있고 high-risk가 아닐 때만`)
    }
  })
  return errors
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const file = path.join(root, 'decisions/open.json')
  let errors
  try {
    errors = validateOpenDecisions(JSON.parse(readFileSync(file, 'utf8')))
  } catch (e) {
    errors = [`읽기 실패: ${e.message}`]
  }
  if (errors.length) {
    for (const e of errors) console.error(`✗ decisions/open.json ${e}`)
    process.exit(1)
  }
  console.log('✓ decisions/open.json 스키마 통과')
}
