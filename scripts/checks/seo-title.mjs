// check-seo 보조: 검색 결과에서 잘릴 수 있는 긴 title 경고(실패 아님). 렌더된 <title> 글자 수(접미사 포함)로 센다.
export const TITLE_MAX = 65

/** @param {Array<[string, string]>} entries [경로, 렌더된 title] */
export function titleLengthWarnings(entries, max = TITLE_MAX) {
  return entries.filter(([, t]) => [...t].length > max).map(([rel, t]) => `${rel}: title ${[...t].length}자 > ${max} — "${t}"`)
}
