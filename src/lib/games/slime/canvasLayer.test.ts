import { describe, expect, it } from 'vitest'
import { MAX_DPR, backingSize, bgLayerKey, canvasDpr, capDpr, createBoardLayer } from './canvasLayer'
import { SKY, skyStarsAnimated, type Theme } from './theme'
import { BOARD_H, BOARD_W } from './types'

describe('캔버스 dpr 캡', () => {
  it('2배를 넘으면 2로 자른다(dpr 3 기기에서 픽셀 수 9/4 → 4/4)', () => {
    expect(MAX_DPR).toBe(2)
    expect(capDpr(3)).toBe(2)
    expect(capDpr(2.625)).toBe(2)
    expect(capDpr(2)).toBe(2)
    expect(capDpr(1.5)).toBe(1.5)
  })
  it('1 미만(데스크톱 축소)은 그대로, 없거나 이상한 값은 1', () => {
    expect(capDpr(0.75)).toBe(0.75)
    expect(capDpr(undefined)).toBe(1)
    expect(capDpr(null)).toBe(1)
    expect(capDpr(0)).toBe(1)
    expect(capDpr(-2)).toBe(1)
    expect(capDpr(Number.NaN)).toBe(1)
    expect(capDpr(Number.POSITIVE_INFINITY)).toBe(1)
  })
  it('상한을 바꿀 수 있다', () => {
    expect(capDpr(3, 3)).toBe(3)
  })
  it('window가 없으면(node·SSR) 1', () => {
    expect(canvasDpr()).toBe(1)
  })
})

describe('백킹 스토어 크기와 변환 배율', () => {
  it('배율 k로 보드를 그리면 백킹 스토어를 정확히(반올림 오차 0.5px 이내) 채운다', () => {
    for (const w of [260, 340, 358, 390, 480]) {
      for (const dpr of [0.75, 1, 1.5, 2, capDpr(3)]) {
        const { bw, bh, k } = backingSize(w, dpr)
        expect(Math.abs(BOARD_W * k - bw)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(BOARD_H * k - bh)).toBeLessThanOrEqual(0.5)
        expect(bw).toBe(Math.round(w * dpr)) // 기존 메인 캔버스 식과 같다
      }
    }
  })
  it('캡 덕분에 480px 폭에서도 백킹 스토어가 960폭을 넘지 않는다', () => {
    const { bw } = backingSize(480, capDpr(3))
    expect(bw).toBe(960)
  })
})

describe('정적 배경 캐시 키', () => {
  const base = { stageId: 'g-slide', theme: 'dawn', w: 358, dpr: 2, bgReady: true, calm: false, withTerrain: true }
  it('같은 입력이면 같은 키(프레임마다 다시 그리지 않는다)', () => {
    expect(bgLayerKey(base)).toBe(bgLayerKey({ ...base }))
  })
  it('크기·dpr·스테이지·시간대·이미지 로드·움직임 줄이기·지형 포함 여부 중 하나만 바뀌어도 키가 바뀐다', () => {
    const k0 = bgLayerKey(base)
    const variants = [{ w: 360 }, { dpr: 1.5 }, { stageId: 's-spike' }, { theme: 'noon' }, { bgReady: false }, { calm: true }, { withTerrain: false }]
    const keys = variants.map((v) => bgLayerKey({ ...base, ...v }))
    for (const k of keys) expect(k).not.toBe(k0)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('별 반짝임 판정(배경에 같이 구울 수 있는가)', () => {
  it('별이 없는 시간대는 항상 정적, 별이 있으면 움직임 줄이기일 때만 정적', () => {
    for (const th of Object.keys(SKY) as Theme[]) {
      expect(skyStarsAnimated(th, true), th).toBe(false)
      expect(skyStarsAnimated(th, false), th).toBe(SKY[th].stars > 0)
    }
  })
})

describe('오프스크린 레이어', () => {
  it('document가 없으면(node) null을 돌려 기존 그리기로 폴백한다', () => {
    let called = false
    expect(
      createBoardLayer(358, 2, () => {
        called = true
      }),
    ).toBeNull()
    expect(called).toBe(false)
  })
})
