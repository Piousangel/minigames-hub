import { describe, expect, it } from 'vitest'
import { extendSequence, newGame, pressPad, type Pad, type SimonState } from './engine'

// 결정론 RNG: 주어진 값들을 순서대로 반환 (rng()*4 => 패드 인덱스)
function seqRng(pads: Pad[]): () => number {
  let i = 0
  return () => (i < pads.length ? pads[i++] / 4 : 0)
}

// 시퀀스를 정확히 pads 로 세팅한 상태 만들기
function withSequence(pads: Pad[]): SimonState {
  let s = newGame()
  const rng = seqRng(pads)
  for (let k = 0; k < pads.length; k++) s = extendSequence(s, rng)
  return s
}

describe('newGame', () => {
  it('빈 시퀀스·round/score 0·미종료로 시작한다', () => {
    const s = newGame()
    expect(s.sequence).toEqual([])
    expect(s.round).toBe(0)
    expect(s.score).toBe(0)
    expect(s.over).toBe(false)
    expect(s.started).toBe(false)
  })
})

describe('extendSequence', () => {
  it('한 라운드마다 시퀀스를 정확히 1개씩 늘린다', () => {
    let s = newGame()
    const rng = seqRng([0, 1, 2, 3])
    s = extendSequence(s, rng)
    expect(s.sequence).toHaveLength(1)
    s = extendSequence(s, rng)
    expect(s.sequence).toHaveLength(2)
    s = extendSequence(s, rng)
    expect(s.sequence).toHaveLength(3)
  })

  it('주입된 RNG로 결정론적으로 패드를 고른다', () => {
    const s = withSequence([2, 0, 3, 1])
    expect(s.sequence).toEqual([2, 0, 3, 1])
    expect(s.started).toBe(true)
    expect(s.inputIndex).toBe(0)
  })

  it('같은 RNG 시퀀스면 같은 결과가 나온다', () => {
    expect(withSequence([1, 2, 3])).toEqual(withSequence([1, 2, 3]))
  })
})

describe('pressPad', () => {
  it('부분 정답 입력은 게임을 계속 진행한다 (커서만 전진)', () => {
    const s = withSequence([1, 2, 3])
    const r = pressPad(s, 1)
    expect(r.correct).toBe(true)
    expect(r.roundComplete).toBe(false)
    expect(r.state.inputIndex).toBe(1)
    expect(r.state.over).toBe(false)
    expect(r.state.score).toBe(0)
  })

  it('전체 시퀀스를 맞추면 라운드 완료 + score/round 증가', () => {
    const s = withSequence([0, 3])
    const r1 = pressPad(s, 0)
    expect(r1.roundComplete).toBe(false)
    const r2 = pressPad(r1.state, 3)
    expect(r2.correct).toBe(true)
    expect(r2.roundComplete).toBe(true)
    expect(r2.state.round).toBe(1)
    expect(r2.state.score).toBe(1)
    expect(r2.state.inputIndex).toBe(0) // 다음 라운드 대비 리셋
  })

  it('틀린 패드는 게임을 끝낸다 (over=true)', () => {
    const s = withSequence([1, 2])
    const r = pressPad(s, 3)
    expect(r.correct).toBe(false)
    expect(r.roundComplete).toBe(false)
    expect(r.state.over).toBe(true)
    expect(r.state.score).toBe(0)
  })

  it('부분 정답 후 틀리면 게임이 끝난다', () => {
    const s = withSequence([2, 1, 0])
    const ok = pressPad(s, 2)
    expect(ok.correct).toBe(true)
    const bad = pressPad(ok.state, 3) // 두 번째는 1 이어야 하는데 3
    expect(bad.correct).toBe(false)
    expect(bad.state.over).toBe(true)
  })

  it('over 상태에서의 입력은 no-op', () => {
    const s = withSequence([0])
    const over = pressPad(s, 1).state
    expect(over.over).toBe(true)
    const again = pressPad(over, 0)
    expect(again.state).toBe(over)
    expect(again.correct).toBe(false)
  })

  it('빈 시퀀스에서의 입력은 no-op', () => {
    const s = newGame()
    const r = pressPad(s, 0)
    expect(r.state).toBe(s)
    expect(r.correct).toBe(false)
  })

  it('여러 라운드를 진행하면 score/round가 누적 증가한다', () => {
    // 라운드1: [1] 완주 -> score 1
    let s = withSequence([1])
    s = pressPad(s, 1).state
    expect(s.score).toBe(1)
    // 라운드2: 시퀀스에 3 추가 -> [1,3] 완주 -> score 2
    s = extendSequence(s, seqRng([3]))
    expect(s.sequence).toEqual([1, 3])
    s = pressPad(s, 1).state
    s = pressPad(s, 3).state
    expect(s.score).toBe(2)
    expect(s.round).toBe(2)
  })
})
