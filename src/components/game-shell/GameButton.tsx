'use client'

import type { ButtonHTMLAttributes } from 'react'

type Variant = 'accent' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  // 네온 앰버 프라이머리 — 발광 그림자로 아케이드 버튼 느낌.
  accent:
    'bg-accent text-stone-900 shadow-[0_0_14px_rgba(251,191,36,0.45)] hover:shadow-[0_0_20px_rgba(251,191,36,0.65)]',
  // 고스트 — 네온 보더 틴트, 본문 가독성 유지.
  ghost:
    'border border-border bg-surface text-fg hover:border-neon-cyan/60 hover:text-fg',
}

/**
 * Shared button with the template's micro-interactions (hover/press scale).
 * Motion is disabled automatically under prefers-reduced-motion via `.btn-press`.
 */
export function GameButton({
  variant = 'accent',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`btn-press rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${VARIANTS[variant]} ${className}`}
    />
  )
}
