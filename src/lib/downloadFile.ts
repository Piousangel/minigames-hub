/**
 * 클라이언트에서 만든 텍스트를 파일로 내려받는다(Blob + 임시 `<a download>` 클릭).
 * 지원하지 않는 환경(createObjectURL 없음 등)이거나 실패하면 던지지 않고 false.
 */
const REVOKE_DELAY_MILLISECONDS = 1000

export function downloadTextFile(filename: string, mimeType: string, text: string): boolean {
  try {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false
    const objectUrl = URL.createObjectURL(new Blob([text], { type: mimeType }))
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    // 일부 브라우저는 클릭 직후 해제하면 저장이 취소된다.
    setTimeout(() => URL.revokeObjectURL(objectUrl), REVOKE_DELAY_MILLISECONDS)
    return true
  } catch {
    return false
  }
}
