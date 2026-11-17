/**
 * 마스코트: 전신 포즈 이미지(idle/fire/happy/dizzy)를 스프링 물리로 움직인다.
 * - 포즈가 바뀌면 부드럽게 크로스페이드(깜빡임 없음)
 * - 숨쉬기: 발 쪽 기준으로 위아래로 살짝 늘었다 줄었다
 * - 발사(fireSeq): 납작하게 눌렸다가 튕겨 늘어나며 반대 방향으로 기울었다 복귀(오버슈트)
 * - 이동(vx, vy): 진행 방향으로 기울고, 속도에 따라 길쭉해짐
 */
import { useEffect, useRef } from 'react'
import { spriteUrl, type CharId, type Pose } from './characters'

interface Spring {
  x: number
  v: number
}
const sp = (): Spring => ({ x: 0, v: 0 })
function stepSpring(s: Spring, target: number, k: number, d: number, dt: number) {
  s.v += (-k * (s.x - target) - d * s.v) * dt
  s.x += s.v * dt
}

export function Mascot({
  id,
  pose,
  size,
  facing = 1,
  fireSeq = 0,
  vx = 0,
  vy = 0,
  breathe = true,
  className,
}: {
  id: CharId
  pose: Pose
  size: number | string
  facing?: 1 | -1
  fireSeq?: number
  vx?: number
  vy?: number
  breathe?: boolean
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const live = useRef({ vx, vy, facing })
  live.current = { vx, vy, facing }
  const s = useRef({ squash: sp(), tilt: sp(), hop: sp(), face: { x: facing, v: 0 } as Spring, pop: sp() })
  const poseRef = useRef(pose)

  useEffect(() => {
    if (!fireSeq) return
    const k = s.current
    k.squash.v -= 14 // 먼저 납작
    k.tilt.v -= 90 // 반동으로 뒤로 젖힘
    k.hop.v += 40
  }, [fireSeq])

  useEffect(() => {
    if (poseRef.current !== pose && pose === 'happy') s.current.pop.v += 9
    if (poseRef.current !== pose && pose === 'dizzy') s.current.tilt.v += 160
    poseRef.current = pose
  }, [pose])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const t = now / 1000
      const k = s.current
      const { vx: x, vy: y, facing: f } = live.current
      const speed = Math.min(1, Math.hypot(x, y))
      const bob = reduce || !breathe ? 0 : Math.sin(t * 2.2) * 0.03
      const tiltTarget = Math.max(-16, Math.min(16, x * 16)) + (poseRef.current === 'dizzy' ? Math.sin(t * 7) * 8 : 0)
      stepSpring(k.squash, 0, 320, 17, dt)
      stepSpring(k.tilt, tiltTarget, 150, 12, dt)
      stepSpring(k.hop, 0, 200, 13, dt)
      stepSpring(k.face, f, 260, 22, dt) // 방향 전환도 팽그르르 도는 대신 스프링으로
      stepSpring(k.pop, 0, 280, 12, dt)
      const sq = k.squash.x * 0.045
      const sy = 1 - sq + bob + speed * 0.05 + k.pop.x * 0.04
      const sx = 1 + sq - bob * 0.6 - speed * 0.03 + k.pop.x * 0.04
      el.style.transform = `translateY(${-k.hop.x * 0.15}px) rotate(${k.tilt.x}deg) scale(${sx * k.face.x}, ${sy})`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [breathe])

  const poses: Pose[] = ['idle', 'fire', 'happy', 'dizzy']
  return (
    <div ref={box} className={`mascot ${className ?? ''}`} style={{ width: size, height: size }} aria-hidden="true">
      {poses.map((p) => (
        <img key={p} className={p === pose ? 'on' : ''} src={spriteUrl(id, p)} alt="" draggable={false} />
      ))}
    </div>
  )
}
