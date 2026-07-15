// Space Shooter(스페이스 인베이더 풍) 순수 물리 엔진.
// 렌더러와 무관한 고정 논리 좌표계(FIELD_W × FIELD_H) 위에서 계산하고,
// 컴포넌트가 캔버스 크기에 맞춰 스케일한다. 순수/결정적: step은 전역 난수를
// 쓰지 않으며, 적의 발사에만 주입된 RNG를 사용한다. (snake/breakout 엔진 스타일)

export type Rng = () => number

/** 논리 필드 크기(정사각). 컴포넌트가 컨테이너 크기로 스케일한다. */
export const FIELD_W = 480
export const FIELD_H = 480

// ---- 적 포메이션 ----
export const ENEMY_COLS = 7
export const ENEMY_ROWS = 4
export const ENEMY_W = 34
export const ENEMY_H = 24
const ENEMY_HGAP = 14
const ENEMY_VGAP = 16
const FORMATION_TOP = 58
const FORMATION_W = ENEMY_COLS * ENEMY_W + (ENEMY_COLS - 1) * ENEMY_HGAP
const FORMATION_LEFT = (FIELD_W - FORMATION_W) / 2

/** 적 포메이션 가로 이동 속도(프레임당, wave 1 기준). */
export const ENEMY_SPEED = 0.9
/** 가장자리 도달 시 하강량(논리 단위). */
export const ENEMY_DROP = 18

// ---- 플레이어 ----
export const PLAYER_W = 42
export const PLAYER_H = 20
/** 플레이어 함선 윗면 y(고정). 적이 이 라인에 닿으면 게임 오버. */
export const PLAYER_Y = FIELD_H - 44
/** 플레이어 중심 y. */
export const PLAYER_CY = PLAYER_Y + PLAYER_H / 2
export const PLAYER_SPEED = 6 // 프레임당 이동량(논리 단위)

// ---- 탄환 ----
export const BULLET_W = 4
export const BULLET_H = 13
export const BULLET_SPEED = 9 // 플레이어 탄(위로)
export const ENEMY_BULLET_W = 5
export const ENEMY_BULLET_H = 12
export const ENEMY_BULLET_SPEED = 4.2 // 적 탄(아래로)

export const FIRE_COOLDOWN = 12 // 연사 쿨다운(프레임)
export const MAX_PLAYER_BULLETS = 4
export const MAX_ENEMY_BULLETS = 5
/** 프레임당 적이 발사할 확률(dt 배수 적용). */
export const ENEMY_FIRE_CHANCE = 0.035

export const START_LIVES = 3

export interface Enemy {
  col: number
  row: number
  x: number // 중심 x
  y: number // 중심 y
  alive: boolean
}

export interface Bullet {
  x: number // 중심 x
  y: number // 중심 y
}

/** step이 이번 프레임에 발생시킨 이벤트(주스/사운드용, 매 프레임 새로 계산). */
export interface FrameEvents {
  fired: boolean
  kills: { x: number; y: number; row: number }[]
  lostLife: boolean
  waveCleared: boolean
  over: boolean
}

export interface SpaceState {
  playerX: number // 함선 중심 x
  bullets: Bullet[] // 플레이어 탄
  enemyBullets: Bullet[]
  enemies: Enemy[]
  dir: 1 | -1 // 포메이션 가로 방향
  fireCooldown: number // 남은 쿨다운(프레임)
  score: number
  lives: number
  wave: number
  over: boolean
  events: FrameEvents
}

export interface StepInput {
  /** 프레임 배수(1 = 60fps 한 틱). 기본 1. */
  dt?: number
  /** 플레이어 이동: -1(왼쪽) | 0 | 1(오른쪽). */
  moveDir?: -1 | 0 | 1
  /** 이번 프레임 발사 요청(쿨다운으로 제한). */
  fire?: boolean
}

const NO_EVENTS: FrameEvents = { fired: false, kills: [], lostLife: false, waveCleared: false, over: false }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

const HALF_PLAYER = PLAYER_W / 2

/** 행별 점수: 위쪽(먼) 행일수록 높다. */
export function enemyPoints(row: number): number {
  return (ENEMY_ROWS - row) * 10
}

/** 지정 wave의 초기 포메이션 생성(상단 정렬, 모두 생존). */
export function buildEnemies(): Enemy[] {
  const enemies: Enemy[] = []
  for (let row = 0; row < ENEMY_ROWS; row++) {
    for (let col = 0; col < ENEMY_COLS; col++) {
      enemies.push({
        col,
        row,
        x: FORMATION_LEFT + col * (ENEMY_W + ENEMY_HGAP) + ENEMY_W / 2,
        y: FORMATION_TOP + row * (ENEMY_H + ENEMY_VGAP) + ENEMY_H / 2,
        alive: true,
      })
    }
  }
  return enemies
}

export function newGame(): SpaceState {
  return {
    playerX: FIELD_W / 2,
    bullets: [],
    enemyBullets: [],
    enemies: buildEnemies(),
    dir: 1,
    fireCooldown: 0,
    score: 0,
    lives: START_LIVES,
    wave: 1,
    over: false,
    events: NO_EVENTS,
  }
}

/** 현재 wave/전멸 진행도에 따른 포메이션 가로 속도. */
export function formationSpeed(wave: number, aliveCount: number, total: number): number {
  const waveFactor = 1 + (wave - 1) * 0.28 // wave가 오를수록 빨라짐
  const killed = total - aliveCount
  const clearFactor = 1 + (total > 0 ? killed / total : 0) * 0.9 // 적이 줄수록 빨라짐
  return ENEMY_SPEED * waveFactor * clearFactor
}

/** 각 열에서 가장 아래에 있는 생존 적(발사 후보). */
function frontEnemies(enemies: Enemy[]): Enemy[] {
  const byCol = new Map<number, Enemy>()
  for (const e of enemies) {
    if (!e.alive) continue
    const cur = byCol.get(e.col)
    if (!cur || e.y > cur.y) byCol.set(e.col, e)
  }
  return [...byCol.values()]
}

function overlaps(bx: number, by: number, bhw: number, bhh: number, ex: number, ey: number, ehw: number, ehh: number) {
  return Math.abs(bx - ex) <= bhw + ehw && Math.abs(by - ey) <= bhh + ehh
}

/**
 * 물리 한 프레임 전진. 순수 함수 — 동일 입력/RNG에 대해 결정적.
 * 플레이어 이동, 발사(쿨다운), 탄 이동, 포메이션 좌우 이동 + 가장자리 하강,
 * 적 발사(RNG), 충돌(플레이어 탄↔적 / 적 탄↔플레이어), 바닥 도달=게임오버,
 * 전멸=다음 wave.
 */
export function step(state: SpaceState, input: StepInput, rng: Rng): SpaceState {
  if (state.over) return state

  const dt = input.dt ?? 1
  const moveDir = input.moveDir ?? 0
  const events: FrameEvents = { fired: false, kills: [], lostLife: false, waveCleared: false, over: false }

  // 1) 플레이어 이동 (클램프)
  const playerX = clamp(state.playerX + moveDir * PLAYER_SPEED * dt, HALF_PLAYER, FIELD_W - HALF_PLAYER)

  // 2) 발사(쿨다운)
  let fireCooldown = Math.max(0, state.fireCooldown - dt)
  let bullets = state.bullets
  if (input.fire && fireCooldown <= 0 && bullets.length < MAX_PLAYER_BULLETS) {
    bullets = [...bullets, { x: playerX, y: PLAYER_Y - BULLET_H / 2 }]
    fireCooldown = FIRE_COOLDOWN
    events.fired = true
  }

  // 3) 플레이어 탄 이동(위로) + 화면 밖 제거
  bullets = bullets
    .map((b) => ({ x: b.x, y: b.y - BULLET_SPEED * dt }))
    .filter((b) => b.y + BULLET_H / 2 > 0)

  // 4) 적 탄 이동(아래로) + 화면 밖 제거
  let enemyBullets = state.enemyBullets
    .map((b) => ({ x: b.x, y: b.y + ENEMY_BULLET_SPEED * dt }))
    .filter((b) => b.y - ENEMY_BULLET_H / 2 < FIELD_H)

  // 5) 포메이션 좌우 이동 + 가장자리 하강
  let enemies = state.enemies
  let dir = state.dir
  const aliveList = enemies.filter((e) => e.alive)
  if (aliveList.length > 0) {
    const speed = formationSpeed(state.wave, aliveList.length, enemies.length)
    let minX = Infinity
    let maxX = -Infinity
    for (const e of aliveList) {
      if (e.x < minX) minX = e.x
      if (e.x > maxX) maxX = e.x
    }
    const delta = dir * speed * dt
    const hitEdge =
      (dir === 1 && maxX + ENEMY_W / 2 + delta > FIELD_W) || (dir === -1 && minX - ENEMY_W / 2 + delta < 0)
    if (hitEdge) {
      dir = dir === 1 ? -1 : 1
      enemies = enemies.map((e) => (e.alive ? { ...e, y: e.y + ENEMY_DROP } : e))
    } else {
      enemies = enemies.map((e) => (e.alive ? { ...e, x: e.x + delta } : e))
    }
  }

  // 6) 적 발사(RNG). chance 통과 시 최전열 중 하나가 발사.
  if (enemyBullets.length < MAX_ENEMY_BULLETS && rng() < ENEMY_FIRE_CHANCE * dt) {
    const front = frontEnemies(enemies)
    if (front.length > 0) {
      const shooter = front[Math.min(front.length - 1, Math.floor(rng() * front.length))]
      enemyBullets = [...enemyBullets, { x: shooter.x, y: shooter.y + ENEMY_H / 2 }]
    }
  }

  // 7) 충돌: 플레이어 탄 ↔ 적 (탄당 최대 1기 격추)
  let score = state.score
  let enemiesChanged = false
  const survivingBullets: Bullet[] = []
  for (const b of bullets) {
    let hit = false
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]
      if (!e.alive) continue
      if (overlaps(b.x, b.y, BULLET_W / 2, BULLET_H / 2, e.x, e.y, ENEMY_W / 2, ENEMY_H / 2)) {
        if (!enemiesChanged) {
          enemies = enemies.slice()
          enemiesChanged = true
        }
        enemies[i] = { ...e, alive: false }
        score += enemyPoints(e.row)
        events.kills.push({ x: e.x, y: e.y, row: e.row })
        hit = true
        break
      }
    }
    if (!hit) survivingBullets.push(b)
  }
  bullets = survivingBullets

  // 8) 충돌: 적 탄 ↔ 플레이어 (프레임당 최대 1회 피격)
  let lives = state.lives
  const keptEnemyBullets: Bullet[] = []
  let struck = false
  for (const b of enemyBullets) {
    if (
      !struck &&
      overlaps(b.x, b.y, ENEMY_BULLET_W / 2, ENEMY_BULLET_H / 2, playerX, PLAYER_CY, HALF_PLAYER, PLAYER_H / 2)
    ) {
      struck = true
      lives -= 1
      events.lostLife = true
      continue // 탄 소멸
    }
    keptEnemyBullets.push(b)
  }
  enemyBullets = keptEnemyBullets

  // 9) 생명 소진 → 게임 오버
  if (lives <= 0) {
    events.over = true
    return {
      ...state,
      playerX,
      bullets,
      enemyBullets,
      enemies,
      dir,
      fireCooldown,
      score,
      lives: 0,
      over: true,
      events,
    }
  }

  // 10) 적이 바닥(플레이어 라인) 도달 → 게임 오버
  const reachedBottom = enemies.some((e) => e.alive && e.y + ENEMY_H / 2 >= PLAYER_Y)
  if (reachedBottom) {
    events.over = true
    return {
      ...state,
      playerX,
      bullets,
      enemyBullets,
      enemies,
      dir,
      fireCooldown,
      score,
      lives,
      over: true,
      events,
    }
  }

  // 11) 전멸 → 다음 wave(속도 증가). 포메이션 재생성, 탄 정리.
  const anyAlive = enemies.some((e) => e.alive)
  if (!anyAlive) {
    events.waveCleared = true
    return {
      ...state,
      playerX,
      bullets: [],
      enemyBullets: [],
      enemies: buildEnemies(),
      dir: 1,
      fireCooldown,
      score,
      lives,
      wave: state.wave + 1,
      over: false,
      events,
    }
  }

  return {
    ...state,
    playerX,
    bullets,
    enemyBullets,
    enemies,
    dir,
    fireCooldown,
    score,
    lives,
    over: false,
    events,
  }
}
