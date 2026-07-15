import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BULLET_SPEED,
  ENEMY_BULLET_H,
  ENEMY_W,
  FIELD_W,
  FIRE_COOLDOWN,
  newGame,
  PLAYER_CY,
  PLAYER_SPEED,
  PLAYER_W,
  PLAYER_Y,
  START_LIVES,
  step,
  type Bullet,
  type Enemy,
  type SpaceState,
} from './engine'

// 결정적 RNG: 적이 발사하지 않도록(항상 큰 값) 기본값. 필요 시 큐를 주입.
const noFire = () => 1
const seq = (values: number[]) => {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

const anEnemy = (partial: Partial<Enemy> = {}): Enemy => ({
  col: 0,
  row: 0,
  x: 100,
  y: 100,
  alive: true,
  ...partial,
})

const S = (partial: Partial<SpaceState> = {}): SpaceState => ({
  playerX: FIELD_W / 2,
  bullets: [],
  enemyBullets: [],
  enemies: [anEnemy()],
  dir: 1,
  fireCooldown: 0,
  score: 0,
  lives: START_LIVES,
  wave: 1,
  over: false,
  events: { fired: false, kills: [], lostLife: false, waveCleared: false, over: false },
  ...partial,
})

describe('newGame', () => {
  it('가운데 함선, 3목숨, wave 1, 가득 찬 포메이션으로 시작한다', () => {
    const s = newGame()
    expect(s.playerX).toBe(FIELD_W / 2)
    expect(s.lives).toBe(START_LIVES)
    expect(s.wave).toBe(1)
    expect(s.over).toBe(false)
    expect(s.enemies.length).toBeGreaterThan(0)
    expect(s.enemies.every((e) => e.alive)).toBe(true)
  })
})

describe('플레이어 이동', () => {
  it('moveDir로 좌우 이동한다', () => {
    const s = S({ playerX: 200 })
    const right = step(s, { moveDir: 1 }, noFire)
    expect(right.playerX).toBe(200 + PLAYER_SPEED)
    const left = step(s, { moveDir: -1 }, noFire)
    expect(left.playerX).toBe(200 - PLAYER_SPEED)
  })

  it('좌우 경계에서 클램프된다', () => {
    const atLeft = step(S({ playerX: PLAYER_W / 2 }), { moveDir: -1 }, noFire)
    expect(atLeft.playerX).toBe(PLAYER_W / 2)
    const atRight = step(S({ playerX: FIELD_W - PLAYER_W / 2 }), { moveDir: 1 }, noFire)
    expect(atRight.playerX).toBe(FIELD_W - PLAYER_W / 2)
  })
})

describe('발사(쿨다운)', () => {
  it('fire로 탄이 생성되고, 다음 프레임 쿨다운 중엔 생성되지 않는다', () => {
    const first = step(S(), { fire: true }, noFire)
    expect(first.bullets.length).toBe(1)
    expect(first.events.fired).toBe(true)
    expect(first.fireCooldown).toBe(FIRE_COOLDOWN)

    // 쿨다운이 남은 상태에서 다시 발사 → 새 탄 없음(기존 탄은 위로 이동만)
    const second = step(first, { fire: true }, noFire)
    expect(second.events.fired).toBe(false)
    expect(second.bullets.length).toBe(1)
  })
})

describe('플레이어 탄 이동', () => {
  it('매 프레임 위로 이동한다', () => {
    const b: Bullet = { x: 100, y: 300 }
    const next = step(S({ bullets: [b], enemies: [anEnemy({ x: 0, y: 0 })] }), {}, noFire)
    expect(next.bullets[0].y).toBe(300 - BULLET_SPEED)
    expect(next.bullets[0].x).toBe(100)
  })
})

describe('충돌: 플레이어 탄 ↔ 적', () => {
  it('적을 맞히면 그 적이 제거되고 점수가 오른다', () => {
    const e = anEnemy({ x: 150, y: 150 })
    const s = S({ enemies: [e], bullets: [{ x: 150, y: 150 }], score: 0 })
    const next = step(s, {}, noFire)
    // 유일한 적이 죽으면 전멸 → 다음 wave로 재생성되지만 점수/이벤트로 확인
    expect(next.score).toBeGreaterThan(0)
    expect(next.events.kills.length).toBe(1)
  })

  it('맞은 적만 제거되고 나머지는 생존한다', () => {
    const hit = anEnemy({ col: 0, x: 150, y: 150 })
    const miss = anEnemy({ col: 1, x: 300, y: 150 })
    const s = S({ enemies: [hit, miss], bullets: [{ x: 150, y: 150 }] })
    const next = step(s, {}, noFire)
    const aliveXs = next.enemies.filter((en) => en.alive).map((en) => Math.round(en.x))
    expect(next.enemies.filter((en) => en.alive).length).toBe(1)
    expect(aliveXs.some((x) => Math.abs(x - 300) < ENEMY_W)).toBe(true)
  })
})

describe('포메이션 이동/하강', () => {
  it('가장자리에 닿으면 방향을 반전하고 하강한다', () => {
    const e = anEnemy({ x: FIELD_W - ENEMY_W / 2 - 0.1, y: 80 })
    const s = S({ enemies: [e], dir: 1 })
    const next = step(s, {}, noFire)
    expect(next.dir).toBe(-1)
    expect(next.enemies[0].y).toBeGreaterThan(80) // 하강
    expect(next.enemies[0].x).toBeCloseTo(e.x) // 하강 프레임엔 가로 이동 없음
  })

  it('가장자리가 아니면 진행 방향으로 가로 이동한다', () => {
    const e = anEnemy({ x: 200, y: 80 })
    const next = step(S({ enemies: [e], dir: 1 }), {}, noFire)
    expect(next.enemies[0].x).toBeGreaterThan(200)
    expect(next.enemies[0].y).toBe(80)
  })
})

describe('충돌: 적 탄 ↔ 플레이어', () => {
  it('적 탄이 함선을 맞히면 목숨이 줄고 탄이 사라진다', () => {
    const s = S({
      playerX: 240,
      enemyBullets: [{ x: 240, y: PLAYER_CY - ENEMY_BULLET_H / 2 }],
      lives: 3,
      enemies: [anEnemy({ x: 0, y: 0 })],
    })
    const next = step(s, {}, noFire)
    expect(next.lives).toBe(2)
    expect(next.events.lostLife).toBe(true)
    expect(next.enemyBullets.length).toBe(0)
  })

  it('목숨이 0이 되면 게임 오버', () => {
    const s = S({
      playerX: 240,
      lives: 1,
      enemyBullets: [{ x: 240, y: PLAYER_CY }],
      enemies: [anEnemy({ x: 0, y: 0 })],
    })
    const next = step(s, {}, noFire)
    expect(next.lives).toBe(0)
    expect(next.over).toBe(true)
    expect(next.events.over).toBe(true)
  })
})

describe('게임 오버: 적이 바닥 도달', () => {
  it('적이 플레이어 라인에 닿으면 게임 오버', () => {
    const e = anEnemy({ x: 200, y: PLAYER_Y })
    const next = step(S({ enemies: [e] }), {}, noFire)
    expect(next.over).toBe(true)
    expect(next.events.over).toBe(true)
  })
})

describe('wave 진행', () => {
  it('모든 적을 제거하면 wave가 오르고 포메이션이 재생성된다', () => {
    const e = anEnemy({ x: 150, y: 150 })
    const s = S({ enemies: [e], bullets: [{ x: 150, y: 150 }], wave: 1 })
    const next = step(s, {}, noFire)
    expect(next.wave).toBe(2)
    expect(next.events.waveCleared).toBe(true)
    expect(next.enemies.length).toBeGreaterThan(1)
    expect(next.enemies.every((en) => en.alive)).toBe(true)
  })
})

describe('적 발사(주입 RNG)', () => {
  it('RNG가 임계값을 통과하면 적 탄이 생성된다', () => {
    // 첫 rng()=0(chance 통과), 두 번째 rng()=0(첫 최전열 선택)
    const s = S({ enemies: [anEnemy({ x: 120, y: 100 })], enemyBullets: [] })
    const next = step(s, {}, seq([0, 0]))
    expect(next.enemyBullets.length).toBe(1)
    // 발사 전 포메이션이 한 틱 이동하므로 정확히 120은 아니지만 그 근처.
    expect(Math.abs(next.enemyBullets[0].x - 120)).toBeLessThan(ENEMY_W)
  })

  it('RNG가 임계값을 넘지 못하면 적 탄이 없다', () => {
    const s = S({ enemies: [anEnemy({ x: 120, y: 100 })], enemyBullets: [] })
    const next = step(s, {}, noFire) // rng=1 → chance 실패
    expect(next.enemyBullets.length).toBe(0)
  })
})

describe('over 상태', () => {
  it('over면 그대로 반환한다', () => {
    const s = S({ over: true })
    expect(step(s, { moveDir: 1, fire: true }, noFire)).toBe(s)
  })
})

describe('결정성', () => {
  it('엔진 소스에 Math.random이 없다', () => {
    const src = readFileSync(fileURLToPath(new URL('./engine.ts', import.meta.url)), 'utf8')
    expect(src.includes('Math.random')).toBe(false)
  })
})
