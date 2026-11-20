import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkCommand, isReadOnlySql, tokenize } from './guard-bash.mjs'

const ROOT = '/work/repo'
const ctx = (branch = 'shift/16-topic') => ({
  cwd: ROOT,
  home: '/home/u',
  projectRoot: ROOT,
  currentBranch: () => branch,
})
const blocked = (cmd, branch) => checkCommand(cmd, ctx(branch)) !== null

describe('guard-bash: 막아야 하는 것', () => {
  it.each([
    // main 직접 푸시
    'git push origin main',
    'git push -u origin main',
    'git push origin HEAD:main',
    'git push origin HEAD:refs/heads/main',
    'git push origin feature:main',
    'git push origin :main',
    'git push origin --delete main',
    'git push origin master',
    'git push https://github.com/o/r.git main',
    // force
    'git push --force origin shift/16-x',
    'git push -f origin shift/16-x',
    'git push -uf origin shift/16-x',
    'git push --force-with-lease origin shift/16-x',
    'git push --force-with-lease=shift/16-x:abc origin shift/16-x',
    'git push origin +shift/16-x',
    'git push --mirror',
    'git push --all origin',
    'git push --prune origin',
    // 우회 형태
    'git -C . push origin main',
    'git -c push.default=current push origin main',
    '/usr/bin/git push origin main',
    'FOO=1 git push origin main',
    'env GIT_TRACE=1 git push origin main',
    'timeout 30 git push origin main',
    'nohup git push origin main',
    'command git push origin main',
    'cd /tmp && git push origin main',
    'git status; git push origin main',
    'true || git push --force origin x',
    'echo hi | git push origin main',
    'sh -c "git push origin main"',
    "bash -lc 'git push --force origin x'",
    'eval "git push origin main"',
    'echo "$(git push origin main)"',
    'echo `git reset --hard`',
    'echo "`git reset --hard`"',
    "echo 'x' \"$(git push origin main)\"",
    'wrangler d1 execute db --remote --command "REPLACE INTO t VALUES (1)"',
    '(git push origin main)',
    'if true; then git push origin main; fi',
    'bash <<EOF\ngit push origin main\nEOF',
    // reset/clean
    'git reset --hard',
    'git reset --hard origin/main',
    'git reset HEAD~1 --hard',
    'git clean -fdx',
    'git clean -xdf',
    'git clean --force -d',
    // 배포
    'wrangler deploy',
    'npx wrangler deploy',
    'npx --yes wrangler deploy --env preview',
    'pnpm exec wrangler deploy',
    'pnpm wrangler deploy',
    'pnpm dlx wrangler deploy',
    './node_modules/.bin/wrangler deploy',
    'wrangler versions deploy',
    'pnpm run deploy',
    'pnpm run deploy:preview',
    'npm run deploy',
    'pnpm deploy',
    'yarn deploy',
    // 원격 D1 쓰기
    'wrangler d1 execute minigames-leaderboard --remote --command "DELETE FROM scores"',
    'npx wrangler d1 execute sandlab-gallery --remote --yes --command "ALTER TABLE scenes ADD COLUMN x TEXT"',
    'wrangler d1 execute db --remote --command="INSERT INTO t VALUES (1)"',
    'wrangler d1 execute db --remote --command "SELECT 1; DROP TABLE t"',
    'wrangler d1 execute db --remote --command "WITH x AS (SELECT 1) DELETE FROM t"',
    'wrangler d1 execute db --remote --command "PRAGMA foreign_keys=OFF"',
    'wrangler d1 execute db --remote --command "$SQL"',
    'wrangler d1 execute sandlab-gallery --remote --file=schema.sql',
    'wrangler d1 execute db --remote --file db/migrations/0001.sql',
    'wrangler d1 migrations apply db --remote',
    'wrangler d1 delete db',
    'wrangler d1 time-travel restore db --timestamp 1',
    'wrangler delete',
    'wrangler secret put RATE_SALT',
    'wrangler secret delete X',
    'wrangler r2 bucket delete b',
    // gh
    'gh repo delete Piousangel/minigames-hub --yes',
    'gh pr merge 12 --squash --admin',
    'gh api -X DELETE repos/o/r',
    'gh api --method DELETE /repos/o/r/git/refs/heads/main',
    'gh api -XPUT repos/o/r/branches/main/protection --input p.json',
    'gh api --method=DELETE repos/o/r/branches/main/protection',
    'gh api -X POST repos/o/r/rulesets -f name=x',
    // rm
    'rm -rf .',
    'rm -rf ./',
    'rm -rf *',
    'rm -rf ~',
    'rm -rf ~/',
    'rm -rf /',
    'rm -rf /work/repo',
    'rm -rf /work',
    'rm -rf .git',
    'rm -r ../repo',
    'rm -rf "$HOME"',
    'rm -rf $CLAUDE_PROJECT_DIR',
    'rm -fr src/..',
    'rm --recursive --force .',
    'cd src && rm -rf ..',
    'rm --no-preserve-root -rf /x',
    // 리뷰 2(우회) 반영
    'gh workflow run deploy.yml --ref shift/x',
    'gh workflow run deploy',
    'rm -rf $(pwd)',
    'rm -rf `pwd`',
    'rm -rf $(git rev-parse --show-toplevel)',
    'cat .env',
    'cat worker/.dev.vars',
    'cp .env /tmp/x',
    'source .env.local',
    'grep TOKEN .env',
    'cat ~/.config/gh/hosts.yml',
    'gh auth token',
    'printenv CLOUDFLARE_API_TOKEN',
    'git restore .',
    'git checkout -- .',
    'git checkout .',
    'git stash drop',
    'git stash clear',
    'npx wrangler@4 deploy',
    'pnpm dlx wrangler@latest deploy',
    'wrangler --env production deploy',
    'wrangler -c wrangler.jsonc deploy',
    'wrangler versions secret put X',
    'corepack pnpm run deploy',
    'wrangler d1 execute db --remote --command "SELECT 1" --command "DELETE FROM t"',
    'gh pr merge 1 --admin=true',
    'gh api -X PATCH repos/o/r/git/refs/heads/main -F force=true',
    'gh api repos/o/r/rulesets -f name=x',
  ])('%s', (cmd) => {
    expect(blocked(cmd)).toBe(true)
  })

  it('main에 있을 때 인자 없는 push·HEAD push·변수 브랜치 push를 막는다', () => {
    expect(blocked('git push -u origin $(git branch --show-current)', 'main')).toBe(true)
    expect(blocked('git push -u origin "$(git rev-parse --abbrev-ref HEAD)"', 'main')).toBe(true)
    expect(blocked('git push origin "$BRANCH"', 'main')).toBe(true)
    expect(blocked('git push -4 origin', 'main')).toBe(true)
    expect(blocked('git push -oci.skip origin', 'main')).toBe(true)
    expect(blocked('git push -u origin $(git branch --show-current)', 'shift/x')).toBe(false)
    expect(blocked('git push', 'main')).toBe(true)
    expect(blocked('git push origin', 'main')).toBe(true)
    expect(blocked('git push -u origin HEAD', 'main')).toBe(true)
  })

  it('막을 때 이유와 대안을 준다', () => {
    const r = checkCommand('git push origin main', ctx())
    expect(r?.reason).toMatch(/main/)
    expect(r?.instead).toMatch(/PR/)
  })
})

describe('guard-bash: 팀 운영에 필요한 것은 통과', () => {
  it.each([
    'git push -u origin shift/16-topic',
    'git push origin chore/repo-safety-settings',
    'git push origin HEAD',
    'git push',
    'git push origin --delete shift/old-topic',
    'git push --dry-run origin main',
    'git push --tags origin shift/x',
    'git push --follow-tags origin shift/x',
    'git push origin shift/main-fix',
    'git pull',
    'git fetch origin && git rebase origin/main',
    'git reset --soft HEAD~1',
    'git reset HEAD file.ts',
    'git clean -n',
    'git clean -nd',
    'git commit -m "chore: git push --force 와 git reset --hard 를 막는다"',
    'git commit -F - <<\'EOF\'\nfeat: x\n\ngit push origin main 은 막힌다\nEOF',
    'echo "git push origin main"',
    'gh pr create --title t --body b',
    'gh pr merge 12 --squash --delete-branch',
    'gh pr merge 12 --squash --auto',
    'gh pr checks 12 --watch',
    'gh api repos/o/r/pulls/12/comments',
    'gh api -X POST repos/o/r/issues/1/comments -f body=hi',
    'gh repo view o/r --json visibility',
    'gh run list --workflow deploy.yml',
    'wrangler dev --port 8799 --local',
    'wrangler deployments list',
    'wrangler rollback',
    'wrangler secret list',
    'wrangler d1 execute sandlab-gallery --local --file=schema.sql',
    'wrangler d1 execute sandlab-gallery --local --command "DELETE FROM votes"',
    'wrangler d1 execute minigames-leaderboard --remote --json --command "SELECT COUNT(*) FROM scores"',
    'npx wrangler d1 execute db --remote --json --command "SELECT name FROM sqlite_master WHERE type=\'table\'"',
    "wrangler d1 execute db --remote --command \"SELECT * FROM t WHERE note = 'delete me'\"",
    'wrangler d1 execute db --remote --command "PRAGMA table_info(scores)"',
    'wrangler d1 execute db --remote --command "WITH a AS (SELECT 1) SELECT * FROM a"',
    'wrangler d1 migrations apply db --local',
    'pnpm run build:preview',
    'pnpm build',
    'pnpm test',
    'pnpm vitest related --run src/a.ts',
    'pnpm typecheck && pnpm lint',
    'node scripts/check-routes.mjs',
    'rm -rf .next out',
    'rm -rf test-results playwright-report',
    'rm -rf /tmp/claude-501/x',
    'rm -rf ./node_modules/.cache',
    'rm file.txt',
    'rm -f .',
    'cd /tmp && rm -rf build',
    'ls -la && cat package.json | head',
    'gh workflow run deploy.yml --ref main',
    'gh workflow run deploy-preview.yml',
    'cat .env.example',
    'ls -la .env',
    'git add .gitignore',
    'git restore --staged .',
    'git restore src/a.ts',
    'git checkout shift/x',
    'git checkout -- src/a.ts',
    'git stash',
    'git stash pop',
    'gh auth status',
    'gh api repos/o/r/git/refs/heads/main',
    'wrangler -c wrangler.jsonc dev',
    'npx wrangler@4 deployments list',
    'rm -rf "$TMPDIR/x"',
    // 작은따옴표 안 백틱·$( )는 실행되지 않는다(리뷰 1 오탐)
    "git commit -m 'docs: `git reset --hard` 대신 `git stash` 사용'",
    "git commit -m 'docs: handoff — `git push origin main` 금지 메모'",
    "gh pr create --title x --body 'deploy는 `pnpm run deploy` 대신 Actions가 한다'",
    "echo '- `wrangler deploy` 대신 Actions, $(git push origin main) 도 금지' >> HANDOFF.md",
    'wrangler d1 execute db --remote --command "SELECT replace(text, \'a\', \'b\') FROM t"',
  ])('%s', (cmd) => {
    expect(blocked(cmd)).toBe(false)
  })
})

describe('isReadOnlySql', () => {
  it('읽기만 통과', () => {
    expect(isReadOnlySql('SELECT 1')).toBe(true)
    expect(isReadOnlySql('select a from t; select b from u;')).toBe(true)
    expect(isReadOnlySql('-- 주석\nSELECT 1')).toBe(true)
    expect(isReadOnlySql('EXPLAIN QUERY PLAN SELECT 1')).toBe(true)
    expect(isReadOnlySql('')).toBe(false)
    expect(isReadOnlySql('UPDATE t SET a=1')).toBe(false)
    expect(isReadOnlySql('SELECT 1; /* x */ DELETE FROM t')).toBe(false)
    expect(isReadOnlySql('REPLACE INTO t VALUES (1)')).toBe(false)
  })
})

describe('tokenize', () => {
  it('따옴표·연산자·리다이렉트', () => {
    expect(tokenize(`a "b c" 'd;e' f&&g 2>&1`).map((t) => t.value)).toEqual(['a', 'b c', 'd;e', 'f', '&&', 'g', '2>&1'])
  })
})

describe('hook 프로세스(stdin JSON → exit code)', () => {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'guard-bash.mjs')
  const run = (command, cwd = process.cwd()) =>
    spawnSync('node', [script], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    })

  it('막으면 exit 2 + stderr 이유', () => {
    const r = run('git push --force origin x')
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/force push/)
  })

  it('통과는 exit 0, 출력 없음', () => {
    const r = run('pnpm test')
    expect(r.status).toBe(0)
    expect(r.stderr).toBe('')
  })

  it('잘못된 입력은 막지 않는다(fail-open)', () => {
    const r = spawnSync('node', [script], { input: 'not json', encoding: 'utf8' })
    expect(r.status).toBe(0)
  })

  it('실제 git 저장소에서 main 브랜치의 인자 없는 push를 막는다', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'guard-bash-'))
    execFileSync('git', ['init', '-q', '-b', 'main', dir])
    expect(run('git push', dir).status).toBe(2)
    execFileSync('git', ['-C', dir, 'checkout', '-q', '-b', 'shift/16-x'])
    expect(run('git push', dir).status).toBe(0)
  })
})
