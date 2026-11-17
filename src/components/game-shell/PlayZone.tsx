import type { CSSProperties, HTMLAttributes } from 'react'

/**
 * 모바일 스크롤 갇힘 해결용 '조작 구역'.
 *
 * 문제: 보드 전체에 `touch-none`을 주면 보드를 손으로 짚은 채로는 페이지가 스크롤되지 않는다(보드가 화면의 절반 이상이면 사실상 갇힌다).
 * 해결: 보드 컨테이너는 touch-action을 제한하지 않고, **가운데 구역에만 이 오버레이로 touch-action을 건다.** 위·아래(또는 좌·우) 가장자리는
 * 비워 두어 손가락을 얹고 밀면 페이지가 스크롤된다. (touch-action은 조상과의 교집합이라 자식이 부모의 none을 풀 수 없어 구조를 이렇게 나눈다.)
 *
 * 사용: 컨테이너(position: relative) 안에 `<PlayZone />`을 넣고, 터치 시작 핸들러 맨 앞에서 `if (!inPlayZone(e)) return`으로 가장자리 터치를 무시한다.
 * 캔버스처럼 핸들러가 캔버스에 달린 게임은 핸들러를 PlayZone에 넘기고 캔버스에는 `touchAction: 'pan-y'`를 준다(좌표는 canvasRef rect로 계산할 것 — currentTarget이 PlayZone이 된다).
 * 스크롤이 시작되면 브라우저가 pointercancel을 보내므로 드래그형 게임은 cancel을 '취소'로 처리해야 한다.
 */
export interface PlayZoneProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 각 변의 스크롤 띠 비율(0~1). 기본: 위·아래 12% */
  top?: number
  bottom?: number
  left?: number
  right?: number
  /** 가운데 구역의 touch-action. 기본 'none'(모든 제스처를 게임이 받음), 가로 조작만 쓰면 'pan-y' */
  axis?: 'none' | 'pan-y' | 'pan-x' | 'manipulation'
}

export function PlayZone({ top = 0.12, bottom = 0.12, left = 0, right = 0, axis = 'none', className, style, ...rest }: PlayZoneProps) {
  const pct = (n: number) => `${Math.max(0, Math.min(0.45, n)) * 100}%`
  const s: CSSProperties = { position: 'absolute', top: pct(top), bottom: pct(bottom), left: pct(left), right: pct(right), touchAction: axis, zIndex: 3, ...style }
  return <div data-play-zone="" aria-hidden="true" className={className} style={s} {...rest} />
}

/** 터치/포인터가 조작 구역에서 시작했는가(가장자리 스크롤 띠에서 시작했으면 false). */
export function inPlayZone(e: { target: EventTarget | null }): boolean {
  const t = e.target
  return t instanceof Element && t.closest('[data-play-zone]') !== null
}
