/**
 * 반동 퍼즐 — 토스 인앱 화면. 엔진은 웹 포털과 같은 @/lib/games/recoil/engine을 쓴다.
 * 웹판(GameRecoil.tsx)에서 도전 링크·공유·웹 지표를 빼고, 한국어·풀스크린·토스 리더보드·햅틱을 붙였다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AMMO_PTS,
  ARENA_H,
  ARENA_W,
  BANK_PTS,
  DIRS,
  DRIFT_LIMIT,
  FP,
  PREVIEW_TICKS,
  STAR_PTS,
  WIN_BONUS,
  createGameForSeed,
  dailySeedFor,
  dirFromVector,
  isOver,
  predictPath,
  seedWithDifficulty,
  setAim,
  step,
  timeBonus,
  type Difficulty,
  type Phase,
  type RecoilEvent,
  type RecoilInput,
  type RecoilState,
} from '@/lib/games/recoil/engine'
import { playSound, type SoundName } from './sound'
import { haptic, submitScore } from './toss'
import { getSave, liveStreak, nextStreak, todayKST, updateSave } from './store'
import { Mascot } from './Mascot'
import { CHARACTERS, isUnlocked, josa, spriteUrl, type Character, type Pose } from './characters'

export type Mode = 'daily' | 'practice'

const TICK_MS = 1000 / 60
const TRAIL_LEN = 20
const QUEUE_MAX = 3
const u = (v: number) => v / FP

const DIFF_LABEL: Record<Difficulty, string> = { easy: '쉬움', normal: '보통', hard: '어려움' }

const SOUND_PRIORITY: Array<[RecoilEvent, SoundName]> = [
  ['win', 'win'],
  ['lose', 'lose'],
  ['bank', 'match'],
  ['star', 'eat'],
  ['bounce', 'flag'],
  ['fire', 'move'],
  ['dry', 'error'],
]

const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 7 : 3
  const a = -Math.PI / 2 + (i * Math.PI) / 5
  return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`
}).join(' ')

function seedForDay(day: string): number {
  return dailySeedFor(Number(day.replace(/-/g, '')))
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

interface Burst {
  seq: number
  x: number
  y: number
}

export function RecoilGame({
  mode,
  difficulty,
  character,
  onExit,
}: {
  mode: Mode
  difficulty: Difficulty
  character: Character
  onExit: () => void
}) {
  const [pose, setPose] = useState<Pose>('idle')
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = useCallback((p: Pose, ms: number) => {
    setPose(p)
    if (poseTimer.current) clearTimeout(poseTimer.current)
    poseTimer.current = setTimeout(() => setPose('idle'), ms)
  }, [])
  const [newFriends, setNewFriends] = useState<Character[]>([])
  const [fireSeq, setFireSeq] = useState(0)
  const [state, setState] = useState<RecoilState | null>(null)
  const [bursts, setBursts] = useState<Burst[]>([])
  const [bankText, setBankText] = useState<{ seq: number; x: number; y: number } | null>(null)
  const [result, setResult] = useState<{ counted: boolean; newBest: boolean; streak: number; underPar: boolean } | null>(null)

  const stateRef = useRef<RecoilState | null>(null)
  const trailRef = useRef<Array<{ x: number; y: number }>>([])
  const queueRef = useRef<RecoilInput[]>([])
  const pressedRef = useRef(false)
  const prevPhaseRef = useRef<Phase | null>(null)
  const seqRef = useRef(0)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dayRef = useRef<string>(todayKST())

  const commit = useCallback((next: RecoilState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const deal = useCallback(
    (sameSeed: boolean) => {
      const cur = stateRef.current
      let g: RecoilState
      if (sameSeed && cur) g = createGameForSeed(cur.seed)
      else if (mode === 'daily') {
        dayRef.current = todayKST()
        g = createGameForSeed(seedForDay(dayRef.current))
      } else g = createGameForSeed(seedWithDifficulty(freshSeed(), difficulty))
      trailRef.current = []
      queueRef.current = []
      pressedRef.current = false
      prevPhaseRef.current = 'ready'
      setBursts([])
      setBankText(null)
      setResult(null)
      setNewFriends([])
      setPose('idle')
      commit(g)
    },
    [mode, difficulty, commit],
  )

  useEffect(() => {
    deal(false)
  }, [deal])

  const react = useCallback((prev: RecoilState, next: RecoilState, evs: Set<RecoilEvent>) => {
    for (const [ev, sound] of SOUND_PRIORITY) {
      if (evs.has(ev)) {
        playSound(sound)
        break
      }
    }
    if (evs.has('fire')) {
      haptic('tap')
      flash('fire', 260)
      setFireSeq((n) => n + 1)
    }
    if (evs.has('star')) {
      flash('happy', 500)
      const fresh = next.stars.filter((st, i) => st.taken && !prev.stars[i].taken)
      setBursts((b) => [...b, ...fresh.map((st) => ({ seq: ++seqRef.current, x: st.x, y: st.y }))])
      if (next.bankShots > prev.bankShots && fresh.length) {
        const st = fresh[fresh.length - 1]
        setBankText({ seq: ++seqRef.current, x: st.x, y: st.y })
      }
    }
    if (evs.has('win')) {
      haptic('success')
      if (poseTimer.current) clearTimeout(poseTimer.current)
      setPose('happy')
    }
    if (evs.has('lose')) {
      haptic('error')
      if (poseTimer.current) clearTimeout(poseTimer.current)
      setPose('dizzy')
    }
  }, [flash])

  // 60Hz 고정 틱. 프레임 시간은 몇 틱을 돌릴지만 정한다(웹판과 동일: 같은 시드+입력이면 같은 결과).
  const phase = state?.phase
  useEffect(() => {
    if (phase !== 'flying') return
    let raf = 0
    let last: number | null = null
    let acc = 0
    const frame = (ts: number) => {
      if (last === null) last = ts
      acc += Math.min(ts - last, 100)
      last = ts
      const prev = stateRef.current
      if (!prev || prev.phase !== 'flying') return
      let s = prev
      const evs = new Set<RecoilEvent>()
      let n = 0
      while (acc >= TICK_MS && n < 4) {
        s = step(s, queueRef.current.shift() ?? null)
        acc -= TICK_MS
        n++
        for (const e of s.events) evs.add(e)
        trailRef.current.push({ x: s.x, y: s.y })
        if (trailRef.current.length > TRAIL_LEN) trailRef.current.shift()
        if (isOver(s)) break
      }
      if (n === 4) acc = Math.min(acc, TICK_MS)
      if (s !== prev) {
        commit(s)
        react(prev, s, evs)
      }
      if (!isOver(s)) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase, commit, react])

  // 판이 끝난 순간 1회: 기록 저장 + (데일리 첫 판이면) 토스 리더보드 제출
  useEffect(() => {
    const s = stateRef.current
    if (!s) return
    const was = prevPhaseRef.current
    prevPhaseRef.current = s.phase
    if (was !== 'flying' || !isOver(s)) return
    const save = getSave()
    const day = dayRef.current
    const won = s.phase === 'won'
    const firstDaily = mode === 'daily' && save.dailyTriedDay !== day
    const counted = mode === 'practice' || firstDaily
    const newBest = counted && s.score > save.best
    let streak = liveStreak(save, todayKST())
    const underPar = won && s.shotsFired <= s.config.parShots
    const patch: Parameters<typeof updateSave>[0] = {
      plays: save.plays + 1,
      totalStars: save.totalStars + s.collected,
      parClears: save.parClears + (underPar ? 1 : 0),
    }
    if (newBest) patch.best = s.score
    if (firstDaily) {
      patch.dailyTriedDay = day
      patch.dailyScore = s.score
      if (won && day === todayKST()) {
        streak = nextStreak(save, day)
        patch.streak = streak
        patch.lastClearDay = day
        patch.maxStreak = Math.max(save.maxStreak, streak)
      }
    }
    setResult({ counted, newBest, streak, underPar })
    const after = { ...save, ...patch }
    const fresh = CHARACTERS.filter((c) => isUnlocked(c, after) && !save.seenUnlocks.includes(c.id))
    if (fresh.length) {
      patch.seenUnlocks = [...save.seenUnlocks, ...fresh.map((c) => c.id)]
      setNewFriends(fresh)
    }
    void updateSave(patch)
    if (firstDaily) void submitScore(s.score)
  }, [phase, mode])

  const aimTo = useCallback(
    (d: number) => {
      const s = stateRef.current
      if (!s) return
      const next = setAim(s, d)
      if (next !== s) commit(next)
    },
    [commit],
  )

  const fire = useCallback(() => {
    const s = stateRef.current
    if (!s || isOver(s)) return
    if (s.phase === 'ready') {
      const next = step(s, { fire: s.aim })
      trailRef.current = [{ x: s.x, y: s.y }, { x: next.x, y: next.y }]
      commit(next)
      react(s, next, new Set(next.events))
      return
    }
    if (queueRef.current.length < QUEUE_MAX) queueRef.current.push({ fire: s.aim })
  }, [commit, react])

  const pointerAim = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const s = stateRef.current
      const svg = svgRef.current
      if (!s || !svg) return
      const rect = svg.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      // 세로 화면용으로 90° 돌려 그린다: 화면 X = ARENA_H - y, 화면 Y = x
      const X = ((e.clientX - rect.left) * ARENA_H) / rect.width
      const Y = ((e.clientY - rect.top) * ARENA_W) / rect.height
      const px = Y
      const py = ARENA_H - X
      const d = dirFromVector(Math.round(px * FP) - s.x, Math.round(py * FP) - s.y)
      if (d !== null) aimTo(d)
    },
    [aimTo],
  )

  if (!state) return <div className="screen" />

  const s = state
  const cfg = s.config
  const over = isOver(s)
  const won = s.phase === 'won'
  const total = s.stars.length
  const shipX = u(s.x)
  const shipY = u(s.y)
  const preview = !over && s.ammo > 0 ? predictPath(s, s.aim, PREVIEW_TICKS) : []
  const previewPts = [`${shipX},${shipY}`, ...preview.map((p) => `${u(p.x)},${u(p.y)}`)].join(' ')
  const trailPts = trailRef.current.map((p) => `${u(p.x)},${u(p.y)}`).join(' ')
  const [adx, ady] = DIRS[s.aim]
  const best = Math.max(getSave().best, result?.newBest ? s.score : 0)

  const hint =
    s.phase === 'ready'
      ? '화면을 누른 채 방향을 정하고, 손을 떼면 발사해요'
      : s.ammo > 0
        ? '마찰이 없어요. 진행 방향으로 쏘면 멈출 수 있어요'
        : '탄약을 다 썼어요. 멈출 때까지 흘러가요'

  return (
    <div className="screen game">
      <header className="hud">
        <div className="hud-title">
          {mode === 'daily' ? `오늘의 퍼즐 · ${dayRef.current.slice(5).replace('-', '/')}` : `연습 · ${DIFF_LABEL[difficulty]}`}
        </div>
        <div className="stats">
          <Stat label="점수" value={s.score} />
          <Stat label="별" value={`${s.collected}/${total}`} />
          <Stat label="탄약" value={s.ammo} />
          <Stat label="최고" value={best} />
        </div>
      </header>

      <div className="arena-wrap">
        <div className="ammo-row" aria-label={`탄약 ${s.ammo}발 남음`}>
          {Array.from({ length: cfg.ammo }, (_, i) => (
            <span key={i} className={`pip ${i < s.ammo ? 'live' : ''}`} />
          ))}
          <span className="par">
            {s.shotsFired}발 / 기준 {cfg.parShots}발
          </span>
        </div>
        {s.ammo === 0 && s.phase === 'flying' && (
          <div className="drift">
            <div style={{ transform: `scaleX(${Math.max(0, 1 - s.driftTicks / DRIFT_LIMIT)})` }} />
          </div>
        )}
        <div className="arena">
          <div className="arena-inner">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${ARENA_H} ${ARENA_W}`}
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              try {
                e.currentTarget.setPointerCapture(e.pointerId)
              } catch {
                // ignore
              }
              pressedRef.current = true
              pointerAim(e)
            }}
            onPointerMove={(e) => {
              if (pressedRef.current) pointerAim(e)
            }}
            onPointerUp={() => {
              if (!pressedRef.current) return
              pressedRef.current = false
              fire()
            }}
            onPointerCancel={() => {
              pressedRef.current = false
            }}
          >
            <g transform={`matrix(0 1 -1 0 ${ARENA_H} 0)`}>
            <g stroke="#ffffff" strokeOpacity={0.06} strokeWidth={0.5}>
              {Array.from({ length: ARENA_W / 16 - 1 }, (_, i) => (
                <line key={`v${i}`} x1={(i + 1) * 16} y1={0} x2={(i + 1) * 16} y2={ARENA_H} />
              ))}
              {Array.from({ length: ARENA_H / 16 - 1 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={(i + 1) * 16} x2={ARENA_W} y2={(i + 1) * 16} />
              ))}
            </g>
            <rect x={0.75} y={0.75} width={ARENA_W - 1.5} height={ARENA_H - 1.5} rx={3} fill="none" stroke="var(--cyan)" strokeWidth={1.5} />
            {s.walls.map((w, i) => (
              <rect key={i} x={u(w.x)} y={u(w.y)} width={u(w.w)} height={u(w.h)} rx={1.5} fill="var(--purple)" fillOpacity={0.25} stroke="var(--purple)" strokeWidth={1} />
            ))}
            {s.stars.map((st) =>
              st.taken ? null : (
                <g key={st.id} transform={`translate(${u(st.x)} ${u(st.y)})`}>
                  <g transform="rotate(-90)">
                    <polygon className="star" points={STAR_POINTS} fill="var(--amber)" style={{ animationDelay: `${(st.id * 0.37) % 1.6}s` }} />
                  </g>
                </g>
              ),
            )}
            {bursts.map((b) => (
              <g key={b.seq} transform={`translate(${u(b.x)} ${u(b.y)})`} pointerEvents="none">
                <g transform="rotate(-90)"><g className="burst" onAnimationEnd={() => setBursts((cur) => cur.filter((x) => x.seq !== b.seq))}>
                  <polygon points={STAR_POINTS} fill="var(--amber)" />
                  <circle r={9} fill="none" stroke="var(--lime)" strokeWidth={1.2} />
                </g></g>
              </g>
            ))}
            {trailRef.current.length > 1 && (
              <polyline points={trailPts} fill="none" stroke={character.accent} strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {preview.length > 0 && (
              <polyline points={previewPts} fill="none" stroke="var(--cyan)" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="1 3" strokeLinecap="round" />
            )}
            {!over && (
              <line x1={shipX} y1={shipY} x2={shipX + (adx * 14) / 256} y2={shipY + (ady * 14) / 256} stroke="var(--magenta)" strokeWidth={1} strokeDasharray="2 2" />
            )}
            <g transform={`translate(${shipX} ${shipY})`}>
              <circle r={5} fill="none" stroke={character.accent} strokeOpacity={0.35} strokeWidth={0.8} />
            </g>
            </g>
          </svg>
          <div
            className="hero"
            style={{ left: `${((ARENA_H - shipY) / ARENA_H) * 100}%`, top: `${(shipX / ARENA_W) * 100}%`, translate: '-50% -56%' }}
          >
            <Mascot
              id={character.id}
              pose={pose}
              size="100%"
              facing={ady <= 0 ? 1 : -1}
              fireSeq={fireSeq}
              vx={(-s.vy / 1024) * 1.2}
              vy={(s.vx / 1024) * 1.2}
            />
          </div>
          {bankText && (
            <span
              key={bankText.seq}
              className="bank"
              style={{ left: `${((ARENA_H - u(bankText.y)) / ARENA_H) * 100}%`, top: `${(u(bankText.x) / ARENA_W) * 100}%` }}
              onAnimationEnd={() => setBankText(null)}
            >
              벽 튕기기 +{BANK_PTS}
            </span>
          )}
        </div>
        </div>
        <p className="hint">{hint}</p>
      </div>

      <footer className="controls">
        <button className="btn ghost" onClick={onExit}>
          처음으로
        </button>
        <button className="btn ghost" onClick={() => deal(true)}>
          다시 하기
        </button>
      </footer>

      {over && (
        <div className="sheet-backdrop">
          <div className="sheet" role="dialog" aria-modal="true">
            <img className="sheet-hero" src={spriteUrl(character.id, won ? 'happy' : 'dizzy')} alt="" />
            <h2>{won ? '별을 모두 모았어요!' : s.endReason === 'stalled' ? '우주에 멈춰버렸어요' : '밖으로 흘러갔어요'}</h2>
            {won ? (
              <ul className="breakdown">
                <li>
                  <span>별 {s.collected}개</span>
                  <b>{s.collected * STAR_PTS}</b>
                </li>
                <li>
                  <span>벽 튕기기 {s.bankShots}번</span>
                  <b>{s.bankShots * BANK_PTS}</b>
                </li>
                <li>
                  <span>클리어 보너스</span>
                  <b>{WIN_BONUS}</b>
                </li>
                <li>
                  <span>남은 탄약 {s.ammo}발</span>
                  <b>{s.ammo * AMMO_PTS}</b>
                </li>
                <li>
                  <span>시간 보너스</span>
                  <b>{timeBonus(s.ticks)}</b>
                </li>
              </ul>
            ) : (
              <p className="muted">
                별 {s.collected}/{total}개{total - s.collected === 1 ? ' · 딱 하나 남았어요. 한 발 아껴 보세요' : ''}
              </p>
            )}
            <p className="total">
              {s.score.toLocaleString()}점{result?.newBest ? <span className="tag">최고 기록</span> : null}
            </p>
            {mode === 'daily' && result && (
              <p className="muted small">
                {result.counted
                  ? won
                    ? `연속 ${result.streak}일째 성공`
                    : '오늘 첫 판 기록이 랭킹에 올라가요'
                  : '오늘의 퍼즐은 첫 판만 기록돼요'}
              </p>
            )}
            {newFriends.map((f) => (
              <div key={f.id} className="unlock">
                <img src={spriteUrl(f.id, 'happy')} alt="" />
                <div>
                  <b>새 친구 {josa(f.name, '이가', '가')} 합류했어요!</b>
                  <span>처음 화면의 우주 친구들에서 함께 날 수 있어요</span>
                </div>
              </div>
            ))}
            <div className="sheet-actions">
              {mode === 'practice' ? (
                <>
                  <button className="btn ghost" onClick={() => deal(true)}>
                    같은 판 다시
                  </button>
                  <button className="btn primary" onClick={() => deal(false)}>
                    새 판
                  </button>
                </>
              ) : (
                <>
                  <button className="btn ghost" onClick={onExit}>
                    처음으로
                  </button>
                  <button className="btn primary" onClick={() => deal(true)}>
                    다시 도전
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{typeof value === 'number' ? value.toLocaleString() : value}</b>
    </div>
  )
}
