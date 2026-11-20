import type { ContentSection, ContentTable } from '@/content/types'
import { gardenProse } from '@/components/garden-hub/GardenHub'

/**
 * 공략/기사 본문 렌더러 — 섹션(h2 + 문단 + 선택 목록)과 데이터 표.
 * 리디자인 v2 R9: 정원 글 본문(gardenProse — 17px·1.75 행간·ink-deep), 표는 크림 카드(넓으면 카드 안에서만 가로 스크롤).
 */
export function ContentBody({ sections, tables }: { sections: ContentSection[]; tables?: ContentTable[] }) {
  return (
    <div className={`${gardenProse} [&>section:first-child>h2]:!mt-2`}>
      {sections.map((s) => (
        <section key={s.heading} className="space-y-5">
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {s.list && (
            <ul>
              {s.list.map((li, i) => (
                <li key={i}>{li}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {tables?.map((t) => (
        <figure key={t.caption} className="!mt-12">
          {/* 넓은 표는 카드 안에서만 가로로 민다(페이지 가로 스크롤 0). 키보드로도 밀 수 있게 tabIndex */}
          <div
            className="overflow-x-auto rounded-[14px] border-2 border-garden-ink bg-garden-cream shadow-[var(--garden-shadow-seed)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2 focus-visible:ring-offset-garden-paper"
            tabIndex={0}
            role="region"
            aria-label={t.caption}
          >
            <table className="w-full border-collapse text-left text-[15px] leading-[22px] tabular-nums">
              <thead>
                <tr className="bg-garden-cream-2">
                  {t.columns.map((c) => (
                    <th key={c} className="border-b-2 border-garden-ink px-3 py-2.5 font-semibold text-garden-ink">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, i) => (
                  <tr key={i} className="border-b border-dashed border-garden-ink/25 last:border-b-0">
                    {r.map((cell, j) => (
                      <td key={j} className="px-3 py-2 text-garden-ink-deep">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <figcaption className="mt-2 text-[13px] leading-5 text-garden-ink-soft">{t.caption}</figcaption>
        </figure>
      ))}
    </div>
  )
}
