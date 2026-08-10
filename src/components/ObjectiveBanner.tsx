import { OBJECTIVES } from '@/lib/games/objectives'
import { CONTROL_GLYPH, gameMeta } from '@/lib/games/gameMeta'

/**
 * 보드 위 '목표(승리 조건)' 한 줄 — above-the-fold 노출(DOMAIN §5). 글로벌·모바일 낯선
 * 유저가 "무엇을 하면 이기는지"를 즉시 알게 한다(우리 흔한 실수: 힌트가 조작만 말하고 목표 누락).
 * 언어독립 조작 글리프(DOMAIN.md P3 잔여 항목)도 같은 줄에 붙여, 텍스트를 안 읽어도
 * "어떻게 조작하는지"가 보인다 — 별도 박스를 안 만든 이유는 클러터 방지(이미 above-the-fold
 * 요소가 많음).
 *
 * 서버 렌더(정적 텍스트) → SSR HTML·SEO에 그대로 들어간다. 목표 문구가 없으면 안 그림.
 */
export function ObjectiveBanner({ slug }: { slug: string }) {
  const objective = OBJECTIVES[slug]
  if (!objective) return null
  const controls = gameMeta[slug]?.controls
  const primary = controls?.[0] ? CONTROL_GLYPH[controls[0]] : null
  return (
    <p
      className="mx-auto mb-4 flex max-w-md items-center justify-center gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2 text-center text-sm text-fg-muted"
      data-testid="objective"
    >
      <span
        aria-hidden="true"
        className="font-pixel text-[9px] uppercase tracking-[0.2em] text-accent"
      >
        Goal
      </span>
      <span className="text-fg">{objective}</span>
      {primary && (
        <>
          <span aria-hidden="true" className="text-border">
            ·
          </span>
          <span
            data-testid="controls-glyph"
            aria-label={`Controls: ${controls!.map((c) => CONTROL_GLYPH[c].label).join(' or ')}`}
            className="whitespace-nowrap text-fg-muted"
            title={controls!.map((c) => CONTROL_GLYPH[c].label).join(' or ')}
          >
            {primary.icon}
          </span>
        </>
      )}
    </p>
  )
}
