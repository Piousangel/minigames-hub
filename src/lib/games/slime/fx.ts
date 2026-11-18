/** 말랑 미끄럼길 연출(파티클·떠오르는 글자). 화면 전용이라 Math.random을 써도 된다(엔진은 결정적). 단위: 초. */
type Kind = 'spark' | 'confetti' | 'star' | 'ring'
interface P {
  kind: Kind
  x: number
  y: number
  vx: number
  vy: number
  ay: number
  age: number
  life: number
  size: number
  color: string
  rot: number
  vr: number
}
interface T {
  x: number
  y: number
  text: string
  color: string
  size: number
  age: number
  life: number
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
// 파스텔 배경에서도 보이게 채도를 높이고 짙은 외곽선을 두른다(디자이너 검수: 4~7px 연한 직사각형은 거의 안 보임)
const CONFETTI = ['#ff3d6e', '#ffb000', '#1fc77e', '#2a9dff', '#8a5cff']

export function starPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot = 0): void {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.45
    const px = cx + Math.cos(a) * rr
    const py = cy + Math.sin(a) * rr
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
}

export class Fx {
  ps: P[] = []
  texts: T[] = []
  /** 파티클 수를 줄일지(움직임 줄이기 설정) */
  calm = false

  private n(count: number): number {
    return this.calm ? Math.ceil(count / 3) : count
  }
  sparks(x: number, y: number, count: number, color: string, speed = 130, life = 0.6): void {
    for (let i = 0; i < this.n(count); i++) {
      const a = rnd(0, Math.PI * 2)
      const v = rnd(speed * 0.4, speed)
      this.ps.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, ay: 160, age: 0, life: life * rnd(0.7, 1.1), size: rnd(2, 4), color, rot: 0, vr: 0 })
    }
  }
  confetti(x: number, y: number, count: number): void {
    for (let i = 0; i < this.n(count); i++) {
      const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05) // 위쪽 부채꼴
      const v = rnd(120, 300)
      this.ps.push({ kind: 'confetti', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 420, age: 0, life: rnd(1, 1.6), size: rnd(8, 13), color: CONFETTI[i % CONFETTI.length], rot: rnd(0, 6), vr: rnd(-9, 9) })
    }
  }
  stars(x: number, y: number, count: number): void {
    for (let i = 0; i < this.n(count); i++) {
      const a = rnd(0, Math.PI * 2)
      const v = rnd(60, 170)
      this.ps.push({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, ay: 90, age: 0, life: rnd(0.8, 1.3), size: rnd(8, 13), color: '#ffd23a', rot: rnd(0, 6), vr: rnd(-4, 4) })
    }
  }
  /** 말랑이가 빠르게 지나간 자리에 남는 작은 빛 */
  trail(x: number, y: number, color = '#9bf0ff'): void {
    this.ps.push({ kind: 'spark', x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: rnd(-12, 12), vy: rnd(-12, 12), ay: 0, age: 0, life: 0.35, size: rnd(2, 3.2), color, rot: 0, vr: 0 })
  }
  ring(x: number, y: number, color: string, maxR = 40, life = 0.5): void {
    this.ps.push({ kind: 'ring', x, y, vx: 0, vy: 0, ay: 0, age: 0, life, size: maxR, color, rot: 0, vr: 0 })
  }
  text(x: number, y: number, text: string, color = '#fff', size = 18, life = 0.9): void {
    this.texts.push({ x, y, text, color, size, age: 0, life })
  }
  clear(): void {
    this.ps = []
    this.texts = []
  }
  update(dt: number): void {
    for (const p of this.ps) {
      p.age += dt
      p.vy += p.ay * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
    }
    this.ps = this.ps.filter((p) => p.age < p.life)
    for (const t of this.texts) {
      t.age += dt
      t.y -= 38 * dt // 떠오른다
    }
    this.texts = this.texts.filter((t) => t.age < t.life)
  }
  draw(g: CanvasRenderingContext2D): void {
    for (const p of this.ps) {
      const k = Math.max(0, 1 - p.age / p.life)
      g.globalAlpha = p.kind === 'ring' ? k * 0.8 : Math.min(1, k * 1.6)
      if (p.kind === 'spark') {
        g.fillStyle = p.color
        g.beginPath()
        g.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, Math.PI * 2)
        g.fill()
      } else if (p.kind === 'confetti') {
        g.save()
        g.translate(p.x, p.y)
        g.rotate(p.rot)
        g.fillStyle = p.color
        g.strokeStyle = 'rgba(70,40,20,0.7)'
        g.lineWidth = 1.4
        g.fillRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.5)
        g.strokeRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.5)
        g.restore()
      } else if (p.kind === 'star') {
        g.fillStyle = p.color
        g.strokeStyle = 'rgba(120,70,10,0.85)'
        g.lineWidth = 1.6
        starPath(g, p.x, p.y, p.size * (0.5 + k * 0.5), p.rot)
        g.fill()
        g.stroke()
      } else {
        g.strokeStyle = p.color
        g.lineWidth = 3 * k + 1
        g.beginPath()
        g.arc(p.x, p.y, p.size * (1 - k), 0, Math.PI * 2)
        g.stroke()
      }
    }
    g.globalAlpha = 1
    for (const t of this.texts) {
      const k = t.age / t.life
      const pop = k < 0.2 ? 0.6 + (k / 0.2) * 0.5 : 1.1 - (k - 0.2) * 0.1
      g.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1
      g.font = `800 ${Math.round(t.size * pop)}px sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.lineWidth = 4
      g.strokeStyle = 'rgba(40,20,5,0.85)'
      g.strokeText(t.text, t.x, t.y)
      g.fillStyle = t.color
      g.fillText(t.text, t.x, t.y)
    }
    g.globalAlpha = 1
  }
}
