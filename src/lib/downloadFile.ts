/**
 * 클라이언트에서 만든 텍스트를 파일로 내려받는다(Blob + 임시 `<a download>` 클릭).
 * 지원하지 않는 환경(createObjectURL 없음 등)이거나 실패하면 던지지 않고 false.
 * 주의: true는 "클릭이 던지지 않았다"는 뜻일 뿐, 인앱 브라우저(카카오톡·인스타그램 등)처럼
 * 다운로드를 조용히 무시하는 환경에서는 실제 저장을 보장하지 않는다.
 */
// Safari·iOS는 클릭 뒤에도 blob을 비동기로 읽으므로 넉넉히 둔다.
const REVOKE_DELAY_MILLISECONDS = 40_000

export function downloadTextFile(filename: string, mimeType: string, text: string): boolean {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false
  let objectUrl: string
  try {
    objectUrl = URL.createObjectURL(new Blob([text], { type: mimeType }))
  } catch {
    return false
  }
  const link = document.createElement('a')
  try {
    link.href = objectUrl
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    return true
  } catch {
    return false
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), REVOKE_DELAY_MILLISECONDS)
  }
}
