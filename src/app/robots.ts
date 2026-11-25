import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/siteConfig'

export const dynamic = 'force-static'

/** 차단 경로. 봇은 자기 그룹이 있으면 `*` 그룹을 무시하므로 모든 그룹에 반복한다(robots.test.ts가 고정). */
export const DISALLOW = ['/tools/']

/**
 * AI 봇 정책(D-1125-04 기본안, 되돌릴 수 있음): 검색·답변용과 학습용 모두 허용.
 * 이름 출처 — Anthropic: support.claude.com/en/articles/8896518 (ClaudeBot·Claude-User·Claude-SearchBot, 확인함).
 * OpenAI platform.openai.com/docs/bots · Perplexity docs.perplexity.ai/guides/bots · Google-Extended·Applebot-Extended·CCBot은
 * 각 공식 문서 기준 이름(이 세션에서는 도메인 차단으로 재확인 못 함 — PR 본문 참고).
 */
export const AI_SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User']
export const AI_TRAIN_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: ['*', ...AI_SEARCH_BOTS, ...AI_TRAIN_BOTS].map((userAgent) => ({
      userAgent,
      allow: '/',
      disallow: DISALLOW,
    })),
    sitemap: `${siteConfig.url}/sitemap.xml`,
  }
}
