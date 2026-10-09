import type { ContentSection, ContentTable } from '@/content/types'

/** 공략/기사 본문 렌더러 — 섹션(h2 + 문단 + 선택 목록)과 데이터 표. */
export function ContentBody({ sections, tables }: { sections: ContentSection[]; tables?: ContentTable[] }) {
  return (
    <div className="space-y-4 leading-relaxed text-fg-muted">
      {sections.map((s) => (
        <section key={s.heading} className="space-y-4">
          <h2 className="mt-10 text-xl font-semibold text-fg">{s.heading}</h2>
          {s.paragraphs.map((p) => (
            <p key={p.slice(0, 48)}>{p}</p>
          ))}
          {s.list && (
            <ul className="list-disc space-y-2 pl-5">
              {s.list.map((li) => (
                <li key={li.slice(0, 48)}>{li}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {tables?.map((t) => (
        <figure key={t.caption} className="mt-10 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {t.columns.map((c) => (
                  <th key={c} className="border-b border-border px-3 py-2 font-semibold text-fg">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j} className="border-b border-border/50 px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption className="mt-2 text-xs text-fg-muted">{t.caption}</figcaption>
        </figure>
      ))}
    </div>
  )
}
