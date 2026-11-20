#!/usr/bin/env node
// Stop hook — 클라우드 세션(루틴)이 저장 안 된 작업을 안고 끝나려 하면 한 번 막는다(오너 승인 제안 E).
//
// 왜: 클라우드 세션은 끝나면 컨테이너와 함께 사라진다. 커밋 안 한 변경·푸시 안 한 커밋은 되돌릴 수 없게 잃는다.
// 어떻게: CLAUDE_CODE_REMOTE=true(클라우드)일 때만 `git status --porcelain`, `git rev-list --branches --not --remotes`(모든 로컬 브랜치),
//   `git stash list`를 본다.
//   남은 것이 있으면 exit 2 — Claude Code가 종료를 막고 stderr를 이유로 Claude에게 준다.
//   stop_hook_active=true(이미 이 hook 때문에 한 번 이어 간 상태)면 막지 않는다 → 일부러 버리는 경우 무한 반복이 없다.
// 로컬(오너 터미널·데스크톱)에서는 아무것도 하지 않는다: 파일이 디스크에 남고, 공유 체크아웃은 다른 세션 변경으로 늘 더럽다.
// 무거운 검사(테스트·빌드)는 넣지 않는다 — PR CI가 한다. git 명령 두 개라 수십 ms.
// 같은 파일이 minigames-hub·sandlab 두 저장소에 있다. 고치면 둘 다 고친다.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * @param {{ remote: boolean, stopHookActive: boolean, dirty: string[] | null, unpushed: number | null, stashes?: number | null }} s
 * @returns {string | null} 막을 이유(없으면 null)
 */
export function evaluate(s) {
  if (!s.remote || s.stopHookActive) return null
  const dirty = s.dirty ?? []
  const unpushed = s.unpushed ?? 0
  const stashes = s.stashes ?? 0
  if (!dirty.length && !unpushed && !stashes) return null
  const parts = []
  if (dirty.length) {
    const sample = dirty.slice(0, 5).join(', ')
    parts.push(`커밋 안 된 파일 ${dirty.length}개(${sample}${dirty.length > 5 ? ' …' : ''})`)
  }
  if (unpushed) parts.push(`어느 원격 브랜치에도 없는 커밋 ${unpushed}개(모든 로컬 브랜치 기준)`)
  if (stashes) parts.push(`stash ${stashes}개(세션과 함께 사라진다)`)
  return [
    `[stop-unsaved-work] 아직 끝내지 않는다: ${parts.join(', ')}.`,
    '클라우드 세션은 끝나면 사라져 이 작업을 되살릴 수 없다.',
    '남길 작업이면: 기능 브랜치(shift/<시각>-<주제>)에 커밋 → push → PR, HANDOFF에 상태를 적는다.',
    '일부러 버리는 것(실험·임시 파일)이면 그 이유를 한 줄 답하고 다시 끝내면 된다 — 이 검사는 한 번만 막는다.',
  ].join('\n')
}

/** @param {string} dir */
export function readGitState(dir) {
  const git = (args) =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 })
  let dirty = null
  let unpushed = null
  let stashes = null
  try {
    dirty = git(['status', '--porcelain', '--untracked-files=normal'])
      .split('\n')
      .map((l) => l.slice(3).trim())
      .filter(Boolean)
  } catch {
    return { dirty: null, unpushed: null, stashes: null } // git 저장소가 아니면 검사하지 않는다
  }
  try {
    unpushed = Number(git(['rev-list', '--count', '--branches', '--not', '--remotes']).trim()) || 0
  } catch {
    unpushed = null // 커밋이 없으면 건너뛴다
  }
  try {
    stashes = git(['stash', 'list']).split('\n').filter(Boolean).length
  } catch {
    stashes = null
  }
  return { dirty, unpushed, stashes }
}

function main() {
  let input = {}
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    process.exit(0)
  }
  const remote = process.env.CLAUDE_CODE_REMOTE === 'true'
  if (!remote || input.stop_hook_active === true) process.exit(0)
  const dir = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const reason = evaluate({ remote, stopHookActive: false, ...readGitState(dir) })
  if (reason) {
    process.stderr.write(reason + '\n')
    process.exit(2)
  }
  process.exit(0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
