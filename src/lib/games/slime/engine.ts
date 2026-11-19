import { CONST, DEFAULT_PHYSICS, type Physics, type Pt, type Seg, type SimResult, type Stage } from './types'

/**
 * 말랑 미끄럼길 결정적 엔진(브리프 4-2). 연산은 + − × ÷ sqrt 와 비교만 쓴다(삼각함수·pow·hypot 금지) →
 * 같은 입력은 Node·브라우저에서 같은 결과. 난수·시계를 쓰지 않는다.
 *
 * lines: 그린 선(파이프라인 통과 후 점 배열). 선마다 연속 점을 선분으로 잇는다.
 */
export function simulate(stage: Stage, lines: Pt[][], phys: Physics = DEFAULT_PHYSICS, trace?: Pt[]): SimResult {
  const { DT, D0, V_MAX, MAX_STEPS } = CONST
  // 선분을 평평한 배열로(ax, ay, bx, by)
  const segs: number[] = []
  const push = (s: Seg) => segs.push(s.a.x, s.a.y, s.b.x, s.b.y)
  for (const t of stage.terrain) push(t)
  for (const line of lines) for (let i = 0; i + 1 < line.length; i++) push({ a: line[i], b: line[i + 1] })
  const n = segs.length / 4
  // 선분별 경계 상자(조기 탈출용): 공 중심이 상자에서 D0보다 멀면 최근접 거리도 D0 이상이라 충돌 계산 결과는 어차피 '충돌 없음'이다.
  // 건너뛰기만 하므로 결과는 비트 단위로 같다(골든 테스트가 증명). 여유 1e-6은 부동소수 오차 방어.
  const bb = new Float64Array(n * 4)
  const MARGIN = CONST.D0 + 1e-6
  for (let s = 0; s < n; s++) {
    const o = s * 4
    bb[o] = Math.min(segs[o], segs[o + 2]) - MARGIN
    bb[o + 1] = Math.min(segs[o + 1], segs[o + 3]) - MARGIN
    bb[o + 2] = Math.max(segs[o], segs[o + 2]) + MARGIN
    bb[o + 3] = Math.max(segs[o + 1], segs[o + 3]) + MARGIN
  }
  // 튕기는 벽(terrain 인덱스): 기믹이 없는 스테이지는 이 배열이 비어 기존 계산 경로 그대로다
  const bouncy = stage.bouncy && stage.bouncy.length ? stage.bouncy : null

  let x = stage.spawn.x
  let y = stage.spawn.y
  let vx = 0
  let vy = 0
  let mask = 0
  let stall = 0
  let minNest2 = Infinity
  const g = phys.g
  const e1 = 1 + phys.e
  const gdt = g * DT

  for (let step = 0; step < MAX_STEPS; step++) {
    if (step >= CONST.START_DELAY) {
      vy += gdt
      const sp2 = vx * vx + vy * vy
      if (sp2 > V_MAX * V_MAX) {
        const k = V_MAX / Math.sqrt(sp2)
        vx *= k
        vy *= k
      }
      x += vx * DT
      y += vy * DT
    }
    // 충돌: 같은 스텝 2회 반복
    for (let it = 0; it < 2; it++) {
      for (let s = 0; s < n; s++) {
        const o = s * 4
        if (x < bb[o] || y < bb[o + 1] || x > bb[o + 2] || y > bb[o + 3]) continue
        const ax = segs[o]
        const ay = segs[o + 1]
        const dx = segs[o + 2] - ax
        const dy = segs[o + 3] - ay
        const len2 = dx * dx + dy * dy
        let t = len2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / len2
        if (t < 0) t = 0
        else if (t > 1) t = 1
        const px = ax + t * dx
        const py = ay + t * dy
        const rx = x - px
        const ry = y - py
        const d2 = rx * rx + ry * ry
        if (d2 >= D0 * D0) continue
        let nx: number
        let ny: number
        let d = Math.sqrt(d2)
        if (d < 1e-9) {
          // 중심이 선 위: 선분 법선 중 위쪽(−y)을 고른다
          const l = Math.sqrt(len2) || 1
          nx = dy / l
          ny = -dx / l
          if (ny > 0 || (ny === 0 && nx > 0)) {
            nx = -nx
            ny = -ny
          }
          d = 0
        } else {
          nx = rx / d
          ny = ry / d
        }
        // 위치 보정
        x = px + nx * D0
        y = py + ny * D0
        // 속도: 법선 성분 반사(e), 접선 성분 쿨롱 마찰
        const vn = vx * nx + vy * ny
        if (vn < 0) {
          const isB = bouncy !== null && s < stage.terrain.length && bouncy.includes(s)
          const imp = -(isB ? CONST.BOUNCE_E1 : e1) * vn // 법선 임펄스 크기
          vx += imp * nx
          vy += imp * ny
          const tx = vx - (vx * nx + vy * ny) * nx
          const ty = vy - (vx * nx + vy * ny) * ny
          const tl = Math.sqrt(tx * tx + ty * ty)
          if (tl > 0) {
            const dec = (isB ? 0 : phys.mu) * imp
            const k = dec >= tl ? 0 : (tl - dec) / tl
            vx = vx - tx + tx * k
            vy = vy - ty + ty * k
          }
        }
      }
    }

    if (trace && step >= CONST.START_DELAY && step % 6 === 0) trace.push({ x, y })
    // 판정(도토리 → 밤송이 → 둥지 → 추락 → 멈춤)
    for (let i = 0; i < 3; i++) {
      if (mask & (1 << i)) continue
      const dx = x - stage.acorns[i].x
      const dy = y - stage.acorns[i].y
      if (dx * dx + dy * dy < CONST.ACORN_R * CONST.ACORN_R) mask |= 1 << i
    }
    const acorns = (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1)
    {
      const dx = x - stage.nest.x
      const dy = y - stage.nest.y
      const d2 = dx * dx + dy * dy
      if (d2 < minNest2) minNest2 = d2
    }
    for (const sp of stage.spikes) {
      const dx = x - sp.x
      const dy = y - sp.y
      if (dx * dx + dy * dy < CONST.SPIKE_R * CONST.SPIKE_R) return { outcome: 'spiked', acorns, acornMask: mask, steps: step + 1, minNest: Math.sqrt(minNest2) }
    }
    {
      const dx = x - stage.nest.x
      const dy = y - stage.nest.y
      if (dx * dx + dy * dy < CONST.NEST_R * CONST.NEST_R) return { outcome: 'nest', acorns, acornMask: mask, steps: step + 1, minNest: Math.sqrt(minNest2) }
    }
    if (y > CONST.FALL_Y || x < CONST.FALL_X0 || x > CONST.FALL_X1) return { outcome: 'fell', acorns, acornMask: mask, steps: step + 1, minNest: Math.sqrt(minNest2) }
    if (step >= CONST.START_DELAY) {
      if (vx * vx + vy * vy < CONST.STALL_V * CONST.STALL_V) {
        if (++stall >= CONST.STALL_STEPS) return { outcome: 'stalled', acorns, acornMask: mask, steps: step + 1, minNest: Math.sqrt(minNest2) }
      } else stall = 0
    }
  }
  const acorns = (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1)
  return { outcome: 'timeout', acorns, acornMask: mask, steps: MAX_STEPS, minNest: Math.sqrt(minNest2) }
}
