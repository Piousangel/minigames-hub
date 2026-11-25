import { describe, expect, it } from 'vitest'
import robots, { AI_SEARCH_BOTS, AI_TRAIN_BOTS, DISALLOW } from './robots'

describe('robots', () => {
  const rules = robots().rules as Array<{ userAgent: string; allow: string; disallow: string[] }>

  it('AI 검색·학습 봇마다 그룹이 있다', () => {
    const agents = rules.map((r) => r.userAgent)
    expect(agents).toEqual(expect.arrayContaining(['*', ...AI_SEARCH_BOTS, ...AI_TRAIN_BOTS]))
  })

  it('모든 그룹이 차단 경로를 반복한다(자기 그룹이 있으면 * 그룹을 무시하므로)', () => {
    for (const r of rules) expect(r.disallow, r.userAgent).toEqual(DISALLOW)
    expect(DISALLOW).toContain('/tools/')
  })

  it('어떤 그룹도 사이트 전체를 막지 않는다', () => {
    for (const r of rules) expect(r.disallow).not.toContain('/')
  })
})
