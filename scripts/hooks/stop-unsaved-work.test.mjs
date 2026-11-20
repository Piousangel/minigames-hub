import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { evaluate, readGitState } from './stop-unsaved-work.mjs'

describe('evaluate', () => {
  const s = { remote: true, stopHookActive: false, dirty: [], unpushed: 0 }

  it('클라우드에서 커밋 안 된 파일이 있으면 막는다', () => {
    expect(evaluate({ ...s, dirty: ['a.ts', 'b.ts'] })).toMatch(/커밋 안 된 파일 2개/)
  })

  it('클라우드에서 푸시 안 된 커밋이 있으면 막는다', () => {
    expect(evaluate({ ...s, unpushed: 3 })).toMatch(/커밋 3개/)
  })

  it('클라우드에서 stash가 남아 있으면 막는다', () => {
    expect(evaluate({ ...s, stashes: 1 })).toMatch(/stash 1개/)
  })

  it('깨끗하면 통과', () => {
    expect(evaluate(s)).toBeNull()
  })

  it('로컬에서는 아무것도 하지 않는다', () => {
    expect(evaluate({ ...s, remote: false, dirty: ['a.ts'], unpushed: 1 })).toBeNull()
  })

  it('이미 한 번 막았으면(stop_hook_active) 통과 — 무한 반복 없음', () => {
    expect(evaluate({ ...s, stopHookActive: true, dirty: ['a.ts'] })).toBeNull()
  })

  it('git 저장소가 아니면(null) 통과', () => {
    expect(evaluate({ ...s, dirty: null, unpushed: null })).toBeNull()
  })
})

describe('hook 프로세스', () => {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'stop-unsaved-work.mjs')
  const makeRepo = () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'stop-hook-'))
    const git = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' })
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 't@example.com')
    git('config', 'user.name', 't')
    writeFileSync(path.join(dir, 'a.txt'), 'a')
    git('add', '.')
    git('commit', '-q', '-m', 'init')
    return dir
  }
  const run = (dir, { remote = 'true', active = false } = {}) =>
    spawnSync('node', [script], {
      input: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: active, cwd: dir }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_CODE_REMOTE: remote },
    })

  it('클라우드 + 변경 있음 → exit 2, 이유는 stderr', () => {
    const dir = makeRepo()
    writeFileSync(path.join(dir, 'b.txt'), 'b')
    const r = run(dir)
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/b\.txt/)
  })

  it('클라우드 + 원격에 없는 커밋 → exit 2', () => {
    const dir = makeRepo() // 원격이 없으니 init 커밋은 어느 원격에도 없다
    expect(readGitState(dir).unpushed).toBe(1)
    expect(run(dir).status).toBe(2)
  })

  it('다른 로컬 브랜치의 푸시 안 된 커밋도 센다', () => {
    const dir = makeRepo()
    const git = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' })
    git('switch', '-q', '-c', 'shift/a')
    writeFileSync(path.join(dir, 'c.txt'), 'c')
    git('add', '.')
    git('commit', '-q', '-m', 'c')
    git('switch', '-q', 'main')
    expect(readGitState(dir).unpushed).toBe(2)
  })

  it('stash만 남아도 막는다', () => {
    const dir = makeRepo()
    writeFileSync(path.join(dir, 'a.txt'), 'changed')
    execFileSync('git', ['-C', dir, 'stash', '-q'], { stdio: 'ignore' })
    const st = readGitState(dir)
    expect(st.dirty).toEqual([])
    expect(st.stashes).toBe(1)
    expect(run(dir).stderr).toMatch(/stash 1개/)
  })

  it('로컬이거나 stop_hook_active면 exit 0', () => {
    const dir = makeRepo()
    writeFileSync(path.join(dir, 'b.txt'), 'b')
    expect(run(dir, { remote: '' }).status).toBe(0)
    expect(run(dir, { active: true }).status).toBe(0)
  })

  it('git 저장소가 아닌 곳은 exit 0', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'stop-hook-nogit-'))
    expect(run(dir).status).toBe(0)
  })
})
