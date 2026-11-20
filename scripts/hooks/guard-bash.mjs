#!/usr/bin/env node
// PreToolUse(Bash) hook — 되돌릴 수 없는 명령만 막는다(오너 승인 제안 E, docs/team/mentor/lydia-hallie.md H3·H6).
//
// 막는 것(exit 2 → Claude Code가 도구 호출을 막고 stderr를 Claude에게 이유로 보여 준다):
//   - main/master로 가는 push(직접 푸시·삭제), force push(--force·-f·--force-with-lease·+refspec), --mirror·--all·--prune
//   - git reset --hard, git clean -f, git restore/checkout ., git stash drop/clear(커밋 안 한 작업 삭제)
//   - 로컬 배포(wrangler deploy·versions deploy, pnpm/npm run deploy*) — 배포는 main 머지 시 Actions
//   - 원격 D1 쓰기(wrangler d1 execute --remote 의 --file·쓰기 SQL, d1 migrations apply --remote), wrangler 자원 삭제·secret 변경
//   - gh repo delete, gh pr merge --admin(CI 우회), gh workflow run deploy(main 아닌 ref), gh api 로 저장소 삭제·main ref·보호 규칙·ruleset 변경
//   - 시크릿 읽기(.env*·.dev.vars*·~/.ssh·gh hosts.yml·wrangler 설정을 인자로 받는 명령, gh auth token, printenv *TOKEN*)
//   - rm -r 로 저장소 루트·상위·홈·/ 지우기
// 허용하는 것: 기능 브랜치 push, gh pr merge(관리자 우회 없이), wrangler d1 execute --local, 원격 D1 읽기(SELECT·PRAGMA·EXPLAIN),
//   wrangler dev·deployments list·rollback(비상 복구), rm -rf .next out 같은 산출물 정리.
//
// 이 hook은 보안 경계가 아니다(Claude Code 문서: Bash 규칙은 명령 문자열을 본다). 진짜 경계는 GitHub 브랜치 보호다.
// 실수로 치는 흔한 형태(복합 명령·sh -c·$(...)·래퍼·경로로 부른 git)를 잡는 것이 목적이고, 파싱이 실패하면 막지 않는다(fail-open).
// 같은 파일이 minigames-hub·sandlab 두 저장소에 있다. 고치면 둘 다 고친다.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROTECTED_BRANCHES = new Set(['main', 'master'])

// ---------------------------------------------------------------- 토크나이저

const OPERATORS = ['&&', '||', '|&', ';;', ';', '|', '&', '\n', '(', ')']

/**
 * 셸 명령을 단어·연산자 토큰으로 나눈다. 따옴표·백슬래시를 벗기고, 리다이렉트(2>&1, &>)는 단어로 둔다.
 * @param {string} src
 * @returns {{ type: 'word' | 'op', value: string }[]}
 */
export function tokenize(src) {
  /** @type {{ type: 'word' | 'op', value: string }[]} */
  const out = []
  let word = ''
  let inWord = false
  const flush = () => {
    if (inWord) out.push({ type: 'word', value: word })
    word = ''
    inWord = false
  }
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === "'") {
      const end = src.indexOf("'", i + 1)
      const stop = end === -1 ? src.length : end
      word += src.slice(i + 1, stop)
      inWord = true
      i = stop + 1
      continue
    }
    if (c === '"') {
      i++
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < src.length && '"\\$`\n'.includes(src[i + 1])) {
          word += src[i + 1]
          i += 2
          continue
        }
        word += src[i]
        i++
      }
      i++
      inWord = true
      continue
    }
    if (c === '\\') {
      if (src[i + 1] === '\n') {
        i += 2
        continue
      }
      word += src[i + 1] ?? ''
      inWord = true
      i += 2
      continue
    }
    if ((c === '$' && src[i + 1] === '(') || c === '`') {
      // 명령 치환은 한 단어로 둔다(rm -rf $(pwd) 의 대상이 '$' 하나로 쪼개지지 않게). 안쪽 검사는 extractSubstitutions가 한다.
      let j = i + 1
      if (c === '`') {
        j = src.indexOf('`', i + 1)
        if (j === -1) j = src.length - 1
      } else {
        let depth = 0
        for (; j < src.length; j++) {
          if (src[j] === '(') depth++
          else if (src[j] === ')' && --depth === 0) break
        }
      }
      word += src.slice(i, j + 1)
      inWord = true
      i = j + 1
      continue
    }
    if (c === '#' && !inWord) {
      // 주석: 줄 끝까지 버린다.
      const nl = src.indexOf('\n', i)
      i = nl === -1 ? src.length : nl
      continue
    }
    if (c === ' ' || c === '\t') {
      flush()
      i++
      continue
    }
    // 리다이렉트 안의 &(2>&1, >&2, &>file)는 연산자가 아니다.
    if (c === '&' && ((inWord && /[<>]$/.test(word)) || src[i + 1] === '>')) {
      word += c
      inWord = true
      i++
      continue
    }
    const op = OPERATORS.find((o) => src.startsWith(o, i))
    if (op) {
      flush()
      out.push({ type: 'op', value: op })
      i += op.length
      continue
    }
    word += c
    inWord = true
    i++
  }
  flush()
  return out
}

/**
 * 히어독 본문을 떼어 낸다. 본문은 보통 커밋 메시지·파일 내용이라 명령으로 보지 않는다.
 * 단, sh/bash/zsh에 먹이는 히어독은 실행되므로 shellBodies로 돌려준다.
 * @param {string} src
 */
export function stripHeredocs(src) {
  const lines = src.split('\n')
  const kept = []
  /** @type {string[]} */
  const shellBodies = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    kept.push(line)
    const m = /<<-?\s*(['"]?)([A-Za-z_][\w-]*)\1/.exec(line)
    if (!m) continue
    const delim = m[2]
    const body = []
    let j = i + 1
    while (j < lines.length && lines[j].trim() !== delim) {
      body.push(lines[j])
      j++
    }
    if (/(^|[\s|;&(])(ba|z|da|k)?sh\b[^<]*<</.test(line)) shellBodies.push(body.join('\n'))
    i = j
  }
  return { text: kept.join('\n'), shellBodies }
}

/**
 * $(...)·백틱 안 명령을 꺼낸다(중첩 괄호 지원). 작은따옴표 안은 셸이 실행하지 않으므로 건너뛴다
 * (커밋 메시지·PR 본문의 '`git push origin main` 금지' 같은 인용이 막히지 않게). 큰따옴표 안은 실행되므로 본다.
 */
export function extractSubstitutions(src) {
  const found = []
  let inDouble = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '\\') {
      i++
      continue
    }
    if (c === "'" && !inDouble) {
      const end = src.indexOf("'", i + 1)
      if (end === -1) break
      i = end
      continue
    }
    if (c === '"') {
      inDouble = !inDouble
      continue
    }
    if (c === '$' && src[i + 1] === '(' && src[i + 2] !== '(') {
      let depth = 0
      let j = i + 1
      for (; j < src.length; j++) {
        if (src[j] === '(') depth++
        else if (src[j] === ')') {
          depth--
          if (depth === 0) break
        }
      }
      found.push(src.slice(i + 2, j))
      i = j
    } else if (c === '`') {
      const end = src.indexOf('`', i + 1)
      if (end === -1) break
      found.push(src.slice(i + 1, end))
      i = end
    }
  }
  return found
}

/** 토큰 열을 단순 명령(단어 배열)들로 나눈다. */
function splitSimpleCommands(tokens) {
  const cmds = []
  let cur = []
  for (const t of tokens) {
    if (t.type === 'op') {
      if (cur.length) cmds.push(cur)
      cur = []
    } else cur.push(t.value)
  }
  if (cur.length) cmds.push(cur)
  return cmds
}

// ---------------------------------------------------------------- 래퍼 벗기기

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh'])
const CONTROL_WORDS = new Set(['then', 'do', 'else', 'elif', 'if', 'while', 'until', '!', '{', '}', 'time'])

const base = (w) => w.split('/').pop() ?? w

/**
 * 앞쪽 환경 변수 대입·래퍼(env·sudo·timeout·nice·nohup·command·exec·xargs …)를 벗긴다.
 * @param {string[]} words
 * @returns {string[]}
 */
export function stripWrappers(words) {
  let w = [...words]
  for (let guard = 0; guard < 20 && w.length; guard++) {
    const head = base(w[0])
    if (/^[A-Za-z_]\w*=/.test(w[0]) || CONTROL_WORDS.has(w[0])) {
      w = w.slice(1)
    } else if (head === 'env') {
      let k = 1
      while (k < w.length && (w[k].startsWith('-') || /^[A-Za-z_]\w*=/.test(w[k]))) {
        if (w[k] === '-u' || w[k] === '-C' || w[k] === '--unset' || w[k] === '--chdir') k++
        k++
      }
      w = w.slice(k)
    } else if (head === 'sudo' || head === 'doas') {
      let k = 1
      while (k < w.length && w[k].startsWith('-')) {
        if (['-u', '-g', '-C', '-h', '-p', '-U'].includes(w[k])) k++
        k++
      }
      w = w.slice(k)
    } else if (head === 'timeout') {
      let k = 1
      while (k < w.length && w[k].startsWith('-')) {
        if (w[k] === '-s' || w[k] === '-k' || w[k] === '--signal' || w[k] === '--kill-after') k++
        k++
      }
      w = w.slice(k + 1) // 시간 인자
    } else if (head === 'nice') {
      let k = 1
      while (k < w.length && w[k].startsWith('-')) {
        if (w[k] === '-n') k++
        k++
      }
      w = w.slice(k)
    } else if (head === 'stdbuf' || head === 'ionice' || head === 'chrt' || head === 'setsid') {
      let k = 1
      while (k < w.length && w[k].startsWith('-')) k++
      w = w.slice(k)
    } else if (['nohup', 'command', 'builtin', 'exec', 'noglob', 'nocorrect'].includes(head)) {
      if (head === 'command' && (w[1] === '-v' || w[1] === '-V')) return w
      w = w.slice(1)
    } else if (head === 'xargs') {
      let k = 1
      while (k < w.length && w[k].startsWith('-')) {
        if (['-I', '-n', '-P', '-L', '-d', '-E', '-s', '-a'].includes(w[k])) k++
        k++
      }
      w = w.slice(k)
    } else {
      return w
    }
  }
  return w
}

/**
 * 패키지 러너(npx·pnpm exec·pnpm dlx·yarn·bunx·npm exec)를 벗겨 실제 프로그램을 찾는다.
 * pnpm/npm/yarn/bun run <script> 은 { script } 로 돌려준다.
 * @param {string[]} words
 * @returns {{ prog: string, args: string[], script?: string }}
 */
export function resolveProgram(words) {
  if (!words.length) return { prog: '', args: [] }
  const head = base(words[0])
  const skipFlags = (arr, start, withValue = []) => {
    let k = start
    while (k < arr.length && arr[k].startsWith('-')) {
      if (withValue.includes(arr[k])) k++
      k++
    }
    return k
  }
  if (/^wrangler@/.test(head)) return { prog: 'wrangler', args: words.slice(1) }
  if (head === 'corepack') return resolveProgram(words.slice(1))
  if (head === 'npx' || head === 'bunx') {
    const k = skipFlags(words, 1, ['-p', '--package', '-c', '--call'])
    return resolveProgram(words.slice(k))
  }
  if (['pnpm', 'npm', 'yarn', 'bun'].includes(head)) {
    let k = skipFlags(words, 1, ['-C', '--dir', '--filter', '-F', '--prefix', '-w', '--workspace', '--cwd'])
    const sub = words[k]
    if (sub === undefined) return { prog: head, args: [] }
    if (['exec', 'dlx', 'x'].includes(sub)) {
      k = skipFlags(words, k + 1, ['-c', '--package', '-p'])
      if (words[k] === '--') k++
      return resolveProgram(words.slice(k))
    }
    if (sub === 'run' || sub === 'run-script') {
      k = skipFlags(words, k + 1, ['--filter', '-F'])
      return { prog: head, args: words.slice(k), script: words[k] }
    }
    if (head === 'npm') return { prog: head, args: words.slice(k) }
    // pnpm/yarn/bun <이름>: 스크립트나 로컬 bin을 그대로 실행한다.
    if (sub === 'wrangler') return resolveProgram(words.slice(k))
    return { prog: head, args: words.slice(k + 1), script: sub }
  }
  return { prog: head, args: words.slice(1) }
}

// ---------------------------------------------------------------- 규칙

const block = (reason, instead) => ({ reason, instead })

/** git 전역 옵션을 건너뛰고 { sub, args, dir } 를 돌려준다. */
function parseGit(args, cwd) {
  let k = 0
  let dir = cwd
  while (k < args.length && args[k].startsWith('-')) {
    const a = args[k]
    if (a === '-C') {
      dir = path.resolve(dir, args[k + 1] ?? '.')
      k += 2
    } else if (['-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix'].includes(a)) {
      k += 2
    } else k++
  }
  return { sub: args[k], args: args.slice(k + 1), dir }
}

function shortCluster(a) {
  return /^-[A-Za-z]+$/.test(a) ? a.slice(1) : ''
}

function normalizeRef(ref) {
  return ref.replace(/^refs\/heads\//, '')
}

/**
 * @param {string[]} args `git push` 뒤 인자
 * @param {() => string | null} currentBranch
 */
function checkGitPush(args, currentBranch) {
  const VALUE_OPTS = ['-o', '--push-option', '--receive-pack', '--exec', '--repo']
  const positional = []
  let force = false
  let destructive = ''
  let del = false
  let dryRun = false
  for (let k = 0; k < args.length; k++) {
    const a = args[k]
    if (a === '--') {
      positional.push(...args.slice(k + 1))
      break
    }
    if (VALUE_OPTS.includes(a)) {
      k++
      continue
    }
    if (a.startsWith('--')) {
      const name = a.split('=')[0]
      if (name === '--force' || name === '--force-with-lease' || name === '--force-if-includes') force = true
      else if (name === '--mirror' || name === '--all' || name === '--branches' || name === '--prune') destructive = name
      else if (name === '--delete') del = true
      else if (name === '--dry-run') dryRun = true
      continue
    }
    const cl = shortCluster(a)
    if (cl) {
      if (cl.includes('f')) force = true
      if (cl.includes('d')) del = true
      if (cl.includes('n')) dryRun = true
      continue
    }
    if (a.startsWith('-')) continue // -4, -oci.skip 같은 짧은 옵션은 위치 인자가 아니다
    positional.push(a)
  }
  if (dryRun) return null
  if (force)
    return block(
      'force push는 원격 기록을 덮어써 되돌릴 수 없다(ROTA 교대 규칙 5·SESSION-GUIDE 금지).',
      '새 커밋을 쌓아 일반 push 하거나, 브랜치를 새 이름으로 만들어 PR을 다시 연다.',
    )
  if (destructive)
    return block(
      `git push ${destructive}는 main을 포함한 여러 원격 브랜치를 한 번에 바꾸거나 지운다.`,
      '올릴 브랜치 이름을 하나 적어 push 한다(예: git push -u origin shift/16-topic).',
    )
  const refspecs = positional.slice(1)
  for (const spec of refspecs) {
    if (spec.startsWith('+'))
      return block('+refspec은 force push다.', '+ 없이 push 하고, 거절되면 rebase·merge 후 다시 push 한다.')
    const [src, dst] = spec.includes(':') ? spec.split(/:(.*)/s) : [spec, undefined]
    let target = dst !== undefined ? dst : src
    // HEAD·@ 와 변수·명령 치환($BRANCH, $(git branch --show-current))은 보통 지금 브랜치다.
    if (dst === undefined && (src === 'HEAD' || src === '@' || /[$`]/.test(src))) target = currentBranch() ?? ''
    else if (/[$`]/.test(target)) target = currentBranch() ?? ''
    target = normalizeRef(target)
    if (PROTECTED_BRANCHES.has(target))
      return block(
        `${target}로 직접 push(또는 ${target} 삭제)는 금지다 — main은 PR 머지로만 바뀐다.`,
        '기능 브랜치(shift/<시각>-<주제>)에 push 하고 PR → CI 초록 → squash 머지.',
      )
    if (del && PROTECTED_BRANCHES.has(normalizeRef(src)))
      return block(`${src} 브랜치 삭제는 금지다.`, '지울 기능 브랜치 이름을 확인한다.')
  }
  if (refspecs.length === 0) {
    const cur = currentBranch()
    if (cur && PROTECTED_BRANCHES.has(cur))
      return block(
        `지금 브랜치가 ${cur}라서 인자 없는 git push는 ${cur}로 직접 푸시된다.`,
        'git switch -c shift/<시각>-<주제> 로 브랜치를 만든 뒤 push 하고 PR을 연다.',
      )
  }
  return null
}

function checkGit(args, ctx) {
  const { sub, args: rest, dir } = parseGit(args, ctx.cwd)
  if (sub === 'push') return checkGitPush(rest, () => ctx.currentBranch(dir))
  if (sub === 'reset' && rest.includes('--hard'))
    return block(
      'git reset --hard는 커밋 안 한 변경을 되살릴 수 없게 지운다.',
      '먼저 git stash(또는 커밋)로 보관한 뒤 git reset --keep / git switch 를 쓴다. 원격과 맞추려면 새 브랜치를 origin/main에서 딴다(git switch -c <새 브랜치> origin/main).',
    )
  const ALL_PATHS = ['.', ':/', '*', ':/*']
  if ((sub === 'restore' || sub === 'checkout') && !rest.includes('--staged') && rest.some((a) => ALL_PATHS.includes(a)))
    return block(
      `git ${sub} . 은 커밋 안 한 변경 전체를 되살릴 수 없게 버린다.`,
      '버릴 파일을 하나씩 적거나, 먼저 git stash 로 보관한다.',
    )
  if (sub === 'stash' && (rest[0] === 'drop' || rest[0] === 'clear'))
    return block(`git stash ${rest[0]}는 보관한 작업을 지운다.`, '필요 없으면 그대로 두고, 남길 것이면 브랜치로 꺼낸다(git stash branch <이름>).')
  if (sub === 'clean') {
    const flags = rest.filter((a) => a.startsWith('-'))
    const forced = flags.some((a) => a === '--force' || shortCluster(a).includes('f'))
    const dry = flags.some((a) => a === '--dry-run' || shortCluster(a).includes('n'))
    if (forced && !dry)
      return block(
        'git clean -f는 추적 안 된 파일을 되살릴 수 없게 지운다.',
        'git clean -n 으로 목록을 먼저 보고, 지울 산출물만 rm -rf <경로>로 지운다(예: rm -rf .next out).',
      )
  }
  return null
}

function checkGh(args) {
  const [group, action] = args
  if (group === 'auth' && action === 'token') return block('gh auth token 은 GitHub 토큰을 그대로 출력한다.', 'gh auth status 로 로그인 여부만 본다.')
  if (group === 'repo' && action === 'delete') return block('gh repo delete는 저장소를 지운다.', '오너에게 묻는다.')
  if (group === 'workflow' && action === 'run' && /^deploy(\.ya?ml)?$/.test(args[2] ?? '')) {
    const ref = optionValue(args, ['--ref', '-r'])
    if (ref !== 'main')
      return block(
        'deploy 워크플로를 main이 아닌 ref(또는 ref 없이)로 수동 실행하면 리뷰 안 된 코드가 프로덕션에 간다.',
        'PR을 머지하면 deploy가 자동으로 돈다. 다시 돌려야 하면 --ref main 을 적는다.',
      )
  }
  if (group === 'pr' && action === 'merge' && args.some((a) => a === '--admin' || a.startsWith('--admin=')))
    return block(
      'gh pr merge --admin은 브랜치 보호·필수 CI를 건너뛴다.',
      'PR CI가 초록이 될 때까지 기다리거나(gh pr checks --watch), 빨강이면 원인을 고친다. --auto 는 써도 된다.',
    )
  if (group === 'api') {
    let method = ''
    let hasBody = false
    const positional = []
    for (let k = 1; k < args.length; k++) {
      const a = args[k]
      if (a === '-X' || a === '--method') method = (args[++k] ?? '').toUpperCase()
      else if (a.startsWith('-X')) method = a.slice(2).toUpperCase()
      else if (a.startsWith('--method=')) method = a.slice(9).toUpperCase()
      else if (['-f', '-F', '--field', '--raw-field', '--input'].includes(a)) {
        hasBody = true
        k++
      } else if (['-H', '--header', '-q', '--jq', '-t', '--template', '--hostname', '--cache'].includes(a)) k++
      else if (!a.startsWith('-')) positional.push(a)
    }
    if (!method) method = hasBody ? 'POST' : 'GET' // gh api 는 필드가 있으면 기본 POST
    const ep = (positional[0] ?? '').replace(/^https:\/\/api\.github\.com/, '').replace(/^\//, '').replace(/\?.*$/, '')
    if (method !== 'GET' && /git\/refs\/heads\/(main|master)$/.test(ep))
      return block('gh api 로 main ref를 바꾸거나 지우는 것은 금지다(사실상 직접 푸시·force push).', 'PR로 머지한다.')
    if (ep === 'graphql' && positional.length && args.some((a) => /\bmutation\b/.test(a) && /(updateRef|deleteRef|updateBranchProtectionRule|deleteBranchProtectionRule|deleteRepository|updateRefs)/.test(a)))
      return block('gh api graphql 로 ref·브랜치 보호·저장소를 바꾸는 것은 금지다.', '오너에게 묻는다.')
    if (method === 'DELETE' && /^repos\/[^/]+\/[^/]+\/?$/.test(ep))
      return block('gh api DELETE로 저장소·main 브랜치를 지우는 것은 금지다.', '오너에게 묻는다.')
    if (method !== 'GET' && /branches\/(main|master)\/protection/.test(ep))
      return block('main 브랜치 보호 규칙 변경은 오너 몫이다.', '필요하면 오너 보고에 적는다.')
    if (method !== 'GET' && /^repos\/[^/]+\/[^/]+\/rulesets/.test(ep))
      return block('저장소 ruleset 변경은 오너 몫이다.', '필요하면 오너 보고에 적는다.')
  }
  return null
}

const READ_ONLY_SQL = /^(select|pragma|explain|with|values)\b/i
// replace(…)·SQLite 함수는 쓰기가 아니다 — 'replace' 뒤에 괄호가 오면 함수 호출로 본다.
const WRITE_SQL = /\b(insert|update|delete|replace(?!\s*\()|create|drop|alter|attach|detach|vacuum|reindex)\b/i

/** SQL 문자열이 읽기 전용(SELECT·PRAGMA 조회·EXPLAIN)인지. 문자열 리터럴·주석은 빼고 본다. */
export function isReadOnlySql(sql) {
  const cleaned = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
  const statements = cleaned
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!statements.length) return false
  return statements.every((s) => {
    if (!READ_ONLY_SQL.test(s)) return false
    if (/^pragma\b/i.test(s) && s.includes('=')) return false
    return !WRITE_SQL.test(s)
  })
}

function optionValues(args, names) {
  const out = []
  for (let k = 0; k < args.length; k++) {
    for (const n of names) {
      if (args[k] === n) out.push(args[k + 1] ?? '')
      else if (args[k].startsWith(`${n}=`)) out.push(args[k].slice(n.length + 1))
    }
  }
  return out
}

function optionValue(args, names) {
  for (let k = 0; k < args.length; k++) {
    for (const n of names) {
      if (args[k] === n) return args[k + 1] ?? ''
      if (args[k].startsWith(`${n}=`)) return args[k].slice(n.length + 1)
    }
  }
  return undefined
}

const WRANGLER_VALUE_OPTS = ['-e', '--env', '-c', '--config', '--cwd', '--name', '--outdir', '--command', '--file', '--database', '--persist-to']

function checkWrangler(args) {
  const positional = []
  for (let k = 0; k < args.length; k++) {
    if (WRANGLER_VALUE_OPTS.includes(args[k])) k++
    else if (!args[k].startsWith('-')) positional.push(args[k])
  }
  const has = (f) => args.some((a) => a === f || a.startsWith(`${f}=`))
  const [g, a1, a2] = positional
  if (g === 'deploy' || g === 'publish' || (g === 'versions' && a1 === 'deploy'))
    return block(
      '로컬 배포는 금지다 — 배포는 main 머지 때 GitHub Actions(deploy.yml)가 한다.',
      'PR을 머지하고 gh run list --workflow deploy.yml 로 배포를 확인한다. 비상 복구는 wrangler rollback.',
    )
  if ((g === 'secret' && a1 && a1 !== 'list') || (g === 'versions' && a1 === 'secret' && a2 && a2 !== 'list'))
    return block('Worker secret 변경은 값이 덮어써져 되돌릴 수 없다.', '오너가 자기 터미널에서 한다(필요하면 보고에 적는다).')
  if (g === 'd1') {
    if (a1 === 'execute' && has('--remote')) {
      if (has('--file'))
        return block(
          '원격(프로덕션) D1에 SQL 파일 실행은 금지다 — 마이그레이션은 deploy.yml 또는 오너가 한다.',
          '로컬에서 --local 로 먼저 돌리고, 원격 적용은 PR·오너 보고에 적는다.',
        )
      const sqls = optionValues(args, ['--command'])
      if (!sqls.length || !sqls.every(isReadOnlySql))
        return block(
          '원격(프로덕션) D1 쓰기(또는 읽기인지 확인 못 하는 SQL)는 금지다 — 사용자 데이터는 되돌릴 수 없다.',
          '읽기는 --command "SELECT …"처럼 SQL을 그대로 적는다. 쓰기는 --local 에서 확인하고 오너에게 넘긴다.',
        )
    }
    if (a1 === 'migrations' && a2 === 'apply' && has('--remote'))
      return block('원격 D1 마이그레이션 적용은 금지다.', '--local 로 확인하고 원격 적용은 배포 워크플로·오너에게 넘긴다.')
    if (a1 === 'time-travel' && a2 === 'restore') return block('원격 D1 시점 복구는 오너 몫이다.', '오너 보고에 적는다.')
  }
  if (positional.includes('delete') && !has('--local'))
    return block('Cloudflare 자원 삭제(wrangler … delete)는 되돌릴 수 없다.', '오너에게 묻는다.')
  return null
}

function checkScript(script) {
  if (script && /^deploy(:|$)/.test(script))
    return block(
      `로컬에서 ${script} 스크립트로 배포하는 것은 금지다 — 배포는 main 머지 때 GitHub Actions가 한다.`,
      'PR을 머지하고 gh run list 로 deploy 워크플로를 확인한다.',
    )
  return null
}

function checkRm(args, ctx) {
  const flags = []
  const targets = []
  let endOfOpts = false
  for (const a of args) {
    if (!endOfOpts && a === '--') endOfOpts = true
    else if (!endOfOpts && a.startsWith('-') && a !== '-') flags.push(a)
    else targets.push(a)
  }
  const recursive = flags.some((f) => f === '--recursive' || (/^-[A-Za-z]+$/.test(f) && /[rR]/.test(f)))
  if (flags.includes('--no-preserve-root')) return block('rm --no-preserve-root는 금지다.', '지울 경로를 정확히 적는다.')
  if (!recursive) return null
  const home = ctx.home
  for (const t of targets) {
    const bad = () =>
      block(
        `rm -r ${t} 는 저장소 전체·상위·홈을 지운다.`,
        '지울 하위 경로를 정확히 적는다(예: rm -rf .next out test-results).',
      )
    if (/^\$\{?\w+\}?\/?\*?$/.test(t) || /^\$\(.*\)\/?\*?$/.test(t) || /^`.*`\/?\*?$/.test(t) || t === '~' || t.startsWith('~/') && t.replace(/\/+\*?$/, '') === '~')
      return bad()
    if (['*', '.*', './*', '.', './', '..', '../', '/', '/*'].includes(t)) return bad()
    const expanded = t.startsWith('~/') || t === '~' ? path.join(home, t.slice(1)) : t
    const abs = path.resolve(ctx.cwd, expanded.replace(/\/\*$/, ''))
    const root = ctx.projectRoot
    if (abs === '/' || abs === home) return bad()
    if (root && (abs === root || root.startsWith(abs + path.sep) || abs === path.join(root, '.git'))) return bad()
  }
  return null
}

/**
 * 한 단순 명령(단어 배열)을 검사한다.
 * @param {string[]} rawWords
 * @param {Ctx} ctx
 * @param {number} depth
 */
function checkSimple(rawWords, ctx, depth) {
  const words = stripWrappers(rawWords)
  if (!words.length) return null
  const head = base(words[0])
  if (head === 'cd') {
    const to = words[1]
    if (to && to !== '-') ctx.cwd = path.resolve(ctx.cwd, to.startsWith('~') ? path.join(ctx.home, to.slice(1)) : to)
    else if (!to) ctx.cwd = ctx.home
    return null
  }
  if (SHELLS.has(head)) {
    const ci = words.findIndex((w, k) => k > 0 && /^-[A-Za-z]*c[A-Za-z]*$/.test(w))
    if (ci !== -1 && words[ci + 1] !== undefined) return checkCommandInner(words[ci + 1], ctx, depth + 1)
    return null
  }
  if (head === 'eval') return checkCommandInner(words.slice(1).join(' '), ctx, depth + 1)
  const { prog, args, script } = resolveProgram(words)
  if (script !== undefined) return checkScript(script)
  if (prog === 'git') return checkGit(args, ctx)
  if (prog === 'gh') return checkGh(args)
  if (prog === 'wrangler') return checkWrangler(args)
  if (prog === 'rm') return checkRm(args, ctx)
  if (head === 'printenv' && words.slice(1).some((a) => /TOKEN|SECRET|KEY|PASSWORD/i.test(a)))
    return block('시크릿 환경 변수 값을 출력하면 로그·대화에 남는다.', '값이 있는지만 보려면 test -n "$이름" && echo set.')
  return checkSecretArgs(head, words.slice(1))
}

const SECRET_PATH = /(^|\/)(\.env(\.[\w.-]+)?|\.dev\.vars(\.[\w.-]+)?|hosts\.yml)$|(^|\/)\.ssh\/|(^|\/)\.wrangler\/config\//
const SECRET_SAFE = /\.env\.(example|sample|template)$/

/** 시크릿 파일을 인자로 받는 명령(cat·cp·source·grep 등). git add/rm·ls 처럼 내용을 읽지 않는 것은 통과. */
function checkSecretArgs(head, args) {
  if (['ls', 'git', 'stat', 'test', '[', 'touch', 'mkdir', 'echo', 'printf'].includes(head)) return null
  const hit = args.find((a) => SECRET_PATH.test(a) && !SECRET_SAFE.test(a))
  if (hit)
    return block(
      `${hit} 는 시크릿 파일이다 — 내용을 읽거나 옮기면 되돌릴 수 없다(로그·PR·대화에 남는다).`,
      '필요한 값의 이름만 문서·.env.example 에서 확인한다. 값이 필요하면 오너에게 묻는다.',
    )
  return null
}

/**
 * @typedef {{ cwd: string, home: string, projectRoot: string | null, currentBranch: (dir: string) => string | null }} Ctx
 */

/** @param {string} command @param {Ctx} ctx @param {number} depth */
function checkCommandInner(command, ctx, depth) {
  if (depth > 5) return null
  const { text, shellBodies } = stripHeredocs(command)
  for (const body of shellBodies) {
    const r = checkCommandInner(body, ctx, depth + 1)
    if (r) return r
  }
  for (const sub of extractSubstitutions(text)) {
    const r = checkCommandInner(sub, { ...ctx }, depth + 1)
    if (r) return r
  }
  for (const words of splitSimpleCommands(tokenize(text))) {
    const r = checkSimple(words, ctx, depth)
    if (r) return r
  }
  return null
}

/**
 * Bash 명령 문자열을 검사한다. 막아야 하면 { reason, instead }, 아니면 null.
 * @param {string} command
 * @param {Partial<Ctx>} [opts]
 */
export function checkCommand(command, opts = {}) {
  const ctx = {
    cwd: opts.cwd ?? process.cwd(),
    home: opts.home ?? process.env.HOME ?? '/',
    projectRoot: opts.projectRoot ?? null,
    currentBranch: opts.currentBranch ?? gitCurrentBranch,
  }
  return checkCommandInner(command, ctx, 0)
}

/** @param {string} dir */
export function gitCurrentBranch(dir) {
  try {
    const out = execFileSync('git', ['-C', dir, 'symbolic-ref', '--short', '-q', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim()
    return out || null // detached HEAD면 빈 값
  } catch {
    return null
  }
}

/** @param {{ reason: string, instead: string }} r */
export function formatBlock(r) {
  return `[guard-bash] 막음: ${r.reason}\n대신: ${r.instead}\n(저장소 안전 설정 — .claude/settings.json · scripts/hooks/guard-bash.mjs. 꼭 필요하면 오너에게 묻는다.)`
}

function main() {
  let input
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    process.exit(0)
  }
  const command = input?.tool_input?.command
  if (typeof command !== 'string' || !command.trim()) process.exit(0)
  const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd()
  let result = null
  try {
    result = checkCommand(command, { cwd, projectRoot: process.env.CLAUDE_PROJECT_DIR || cwd })
  } catch {
    process.exit(0) // 파싱 실패는 막지 않는다(fail-open). 정적 deny 규칙이 뒤를 받친다.
  }
  if (result) {
    process.stderr.write(formatBlock(result) + '\n')
    process.exit(2)
  }
  process.exit(0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
