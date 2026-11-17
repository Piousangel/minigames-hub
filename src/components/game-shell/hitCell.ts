/**
 * PlayZone 오버레이가 포인터를 받는 탭형 보드에서, 터치 좌표가 어느 셀(`data-cell="n"` 요소)에 떨어졌는지 찾는다.
 * 셀 사이 틈이나 셀 밖이면 -1. 좌표는 각 셀의 getBoundingClientRect 기준이라 오버레이 크기와 무관하다.
 */
export function hitCell(e: { clientX: number; clientY: number }, root: HTMLElement | null): number {
  if (!root) return -1
  for (const el of root.querySelectorAll<HTMLElement>('[data-cell]')) {
    const r = el.getBoundingClientRect()
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      return Number(el.dataset.cell)
    }
  }
  return -1
}
