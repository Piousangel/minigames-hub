import { BOARD_H, BOARD_W } from './types'

/**
 * 캔버스 해상도·오프스크린 레이어 공통 도구(엔지니어 보고 11-19 §4-5: 성능 부채).
 * dpr 3 기기에서 480px 폭이면 1440×2064 = 약 3M 픽셀을 매 프레임 다시 그린다 → 백킹 스토어를 2배로 캡한다.
 * 메인 캔버스·지형 레이어·배경 레이어가 모두 같은 dpr과 같은 배율을 써야 drawImage가 1:1로 맞아 흐려지거나 어긋나지 않는다.
 */
export const MAX_DPR = 2

/** 기기 픽셀 비율을 (0, max]로 맞춘다. 값이 없거나 이상하면 1. 1 미만(데스크톱 축소)은 그대로 둔다. */
export function capDpr(raw: number | null | undefined, max: number = MAX_DPR): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 1
  return Math.min(max, raw)
}

/** 지금 창의 캔버스용 dpr(2배 캡). 서버 렌더(window 없음)에서는 1. */
export function canvasDpr(): number {
  return capDpr(typeof window === 'undefined' ? undefined : window.devicePixelRatio)
}

/**
 * CSS 폭(px)과 dpr → 백킹 스토어 크기와 논리 보드 좌표 → 백킹 픽셀 배율 k.
 * 메인 캔버스·오프스크린 레이어가 같은 식을 써서 크기가 정확히 같아진다.
 */
export function backingSize(cssW: number, dpr: number): { bw: number; bh: number; k: number } {
  const k = (cssW * dpr) / BOARD_W
  return { bw: Math.round(BOARD_W * k), bh: Math.round(BOARD_H * k), k }
}

/** 정적 배경 레이어 캐시 키. 이 중 하나라도 바뀌면 다시 그린다(크기·dpr·스테이지·시간대·이미지 로드·움직임 줄이기·지형 포함 여부). */
export function bgLayerKey(p: { stageId: string; theme: string; w: number; dpr: number; bgReady: boolean; calm: boolean; withTerrain: boolean }): string {
  return [p.stageId, p.theme, p.w, p.dpr, p.bgReady ? 1 : 0, p.calm ? 1 : 0, p.withTerrain ? 1 : 0].join(':')
}

/** 보드 크기의 오프스크린 캔버스를 만들어 논리 좌표(BOARD_W×BOARD_H)로 paint한다. 캔버스를 못 만드는 환경이면 null. */
export function createBoardLayer(cssW: number, dpr: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const { bw, bh, k } = backingSize(cssW, dpr)
  const cv = document.createElement('canvas')
  cv.width = bw
  cv.height = bh
  const g = cv.getContext('2d')
  if (!g) return null
  g.setTransform(k, 0, 0, k, 0, 0)
  paint(g)
  return cv
}
