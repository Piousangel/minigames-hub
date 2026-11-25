import { buildLlmsTxt } from '@/lib/llmsTxt'

// 정적 export: 빌드 때 out/llms.txt로 생성된다. sitemap과 같은 데이터 소스.
export const dynamic = 'force-static'

export function GET() {
  return new Response(buildLlmsTxt(), { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
