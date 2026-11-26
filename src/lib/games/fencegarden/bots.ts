/**
 * 꽃담 정원(가칭) G3-1 — 판 난이도를 재는 봇 두 종(#264). 둘 다 결정적(mulberry32 시드), DOM·시계 없음.
 *  - random: 계획 없는 무작위 봇. 매 턴 '꽃을 말랑이 영역에서 떼어 내지 않는 수' 중 고르게 하나(잡초 우선 필터 없음).
 *    G2(#261)에서 손으로 돌린 재측정을 스크립트 옵션으로 고정한 것(QA-1 11-26 부탁).
 *  - greedy: 한 수 앞 보는 탐욕 봇(사람형 근사). 이번 수로 끝나면 그 수, 아니면 수를 둔 뒤
 *    '내 영역에 남은 잡초 칸의 열린 변 수'가 가장 적은 수(동점은 무작위). 꽃을 떼어 내는 수는 두지 않는다.
 * 봇은 규칙 엔진의 legalMoves만 쓰므로 최소 턴보다 빨리 풀 수 없다 — 테스트가 고정한다.
 */
import { applyMove, cellSides, hopGoal, initialState, legalMoves, mulberry32, regions, type HopMove, type HopPuzzle, type HopState } from './engine'

export type BotKind = 'random' | 'greedy'

export type BotRun = { won: boolean; turns: number; line: HopMove[] }

/** 꽃을 하나라도 말랑이 영역에서 떼어 내면 그 수는 버린다(두 봇 공통). */
function keepsFlowers(p: HopPuzzle, s: HopState, m: HopMove): boolean {
  const reg = regions(p.n, applyMove(s, m).fences)
  return p.flowers.every((f) => reg[f] === reg[m.to])
}

/** 내 영역에 남은 잡초마다 아직 막히지 않은 안쪽 변 수의 합. 0이면 잡초가 모두 떨어졌다. */
export function weedPressure(p: HopPuzzle, s: HopState): number {
  const reg = regions(p.n, s.fences)
  const mine = reg[s.pos]
  let sum = 0
  for (const w of p.weeds) {
    if (reg[w] !== mine) continue
    for (const e of cellSides(p.n, w)) if (e !== null && !s.fences.has(e)) sum++
  }
  return sum
}

function pickMove(p: HopPuzzle, s: HopState, kind: BotKind, rnd: () => number): HopMove | null {
  const ms = legalMoves(p, s).filter((m) => keepsFlowers(p, s, m))
  if (!ms.length) return null
  if (kind === 'random') return ms[Math.floor(rnd() * ms.length)]
  const wins = ms.filter((m) => hopGoal(p, applyMove(s, m)))
  if (wins.length) return wins[Math.floor(rnd() * wins.length)]
  let best = Infinity
  let pool: HopMove[] = []
  for (const m of ms) {
    const v = weedPressure(p, applyMove(s, m))
    if (v < best) {
      best = v
      pool = [m]
    } else if (v === best) pool.push(m)
  }
  return pool[Math.floor(rnd() * pool.length)]
}

/** 봇 한 판. 턴 한도(p.turns) 안에 목표에 닿으면 won. */
export function runBot(p: HopPuzzle, kind: BotKind, rnd: () => number): BotRun {
  let s = initialState(p)
  const line: HopMove[] = []
  for (let t = 1; t <= p.turns; t++) {
    const m = pickMove(p, s, kind, rnd)
    if (!m) break
    s = applyMove(s, m)
    line.push(m)
    if (hopGoal(p, s)) return { won: true, turns: t, line }
  }
  return { won: false, turns: line.length, line }
}

/** 해결률(0~1). 같은 (판, 종류, 시도 수, 시드)면 언제나 같은 값. */
export function botRate(p: HopPuzzle, kind: BotKind, trials: number, seed: number): number {
  const rnd = mulberry32(seed)
  let win = 0
  for (let i = 0; i < trials; i++) if (runBot(p, kind, rnd).won) win++
  return trials ? win / trials : 0
}
