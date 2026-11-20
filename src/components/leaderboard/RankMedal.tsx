/**
 * 리더보드 1~3위 벡터 메달(리디자인 v2 — 🥇 이모지 폐기). 리본 두 갈래 + ink 윤곽 원판 + 순위 숫자.
 * 금·은·동 면색은 장식 전용(숫자는 ink #5b3a1e — 가장 어두운 동 면 #f0b37f 위 5.5:1).
 * 4위부터는 메달 없이 숫자만(같은 폭 28px 칸).
 */
const FACE = {
  1: { face: '#ffd45c', rim: '#e8b23a', ribbon: '#e8643f' },
  2: { face: '#e6e8ef', rim: '#b9bccb', ribbon: '#7aa7d9' },
  3: { face: '#f0b37f', rim: '#d08a4e', ribbon: '#8fbf6a' },
} as const

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd' } as const

export function RankMedal({ rank }: { rank: number }) {
  if (rank < 1 || rank > 3) {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-[13px] font-bold tabular-nums text-garden-ink-soft">
        <span className="sr-only">Rank </span>
        {rank}
      </span>
    )
  }
  const c = FACE[rank as 1 | 2 | 3]
  return (
    <svg
      viewBox="0 0 28 28"
      width={28}
      height={28}
      role="img"
      aria-label={`${ORDINAL[rank as 1 | 2 | 3]} place`}
      data-medal={rank}
      className="shrink-0"
    >
      {/* 리본 두 갈래 */}
      <path d="M8 1h5l3 9h-5z" fill={c.ribbon} stroke="#5b3a1e" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20 1h-5l-3 9h5z" fill={c.ribbon} stroke="#5b3a1e" strokeWidth="1.5" strokeLinejoin="round" />
      {/* 원판 */}
      <circle cx="14" cy="17.5" r="9" fill={c.face} stroke="#5b3a1e" strokeWidth="1.75" />
      <circle cx="14" cy="17.5" r="6.4" fill="none" stroke={c.rim} strokeWidth="1.25" />
      <text
        x="14"
        y="21.4"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="800"
        fill="#5b3a1e"
        style={{ fontFamily: 'var(--font-ui), system-ui, sans-serif' }}
        aria-hidden="true"
      >
        {rank}
      </text>
    </svg>
  )
}
