import type { StageState } from '@/lib/games/slime/daily'

const ICON: Record<StageState, string> = { locked: '', open: '', cleared: '✓', failed: '–' }

/** 새벽→밤 여정 막대: 8개 마디가 한 줄로 이어진다(칩 8번이 잘리던 문제 해결). 마디 크기는 화면 폭에 맞춰 줄어들고 터치 영역은 막대 전체 높이 44px. */
export function SlimeJourney({ states, current, names }: { states: StageState[]; current: number; names: string[] }) {
  return (
    <ol className="relative mb-3 flex h-11 items-center justify-between" aria-label="Today's stages">
      <span aria-hidden className="absolute inset-x-3 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#5b3a1e]/60" />
      {states.map((s, i) => {
        const here = i === current
        return (
          <li key={i} className="relative z-10 flex flex-col items-center">
            <span
              aria-current={here ? 'step' : undefined}
              aria-label={`Stage ${i + 1}, ${names[i]}: ${s}`}
              className={`flex items-center justify-center rounded-full border-[3px] font-bold transition-transform ${
                here ? 'h-9 w-9 scale-110 border-[#5b3a1e] bg-[#ffc933] text-[#5b3a1e]' : s === 'cleared' ? 'h-7 w-7 border-[#5b3a1e] bg-[#fff3dc] text-[#5b3a1e]' : s === 'locked' ? 'h-7 w-7 border-[#5b3a1e]/60 bg-[#3a2a4a] text-[#fff3dc]/50' : 'h-7 w-7 border-[#5b3a1e] bg-[#f3d9aa] text-[#5b3a1e]'
              }`}
            >
              <span className="text-xs leading-none">{s === 'locked' ? '🔒' : ICON[s] || i + 1}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
